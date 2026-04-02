import { Alert, ActionIcon, Box, Group, Paper, Stack, Text } from '@mantine/core'
import { useAtomValue } from 'jotai'
import { debounce } from 'lodash'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconAlertCircle,
  IconArrowsMaximize,
  IconCheck,
  IconLoader,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'
import { Modal } from '@/components/layout/Overlay'
import { currentSessionIdAtom } from '@/stores/atoms'
import {
  appEventBus,
  deactivateInvocation,
  getAppById,
  getAppForTool,
  getLiveInvocation,
  registerActiveIframe,
  unregisterActiveIframe,
} from '@/packages/app-registry'
import { getLastAppState, persistAppState } from '@/packages/app-registry/state'

type AppIframeMessage =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'state_update'; state: unknown }
  | { type: 'tool_result'; invocationId?: string; result: unknown; state?: unknown }
  | { type: 'completion'; summary?: string; data?: unknown; state?: unknown }
  | { type: 'error'; invocationId?: string; code?: string; message?: string }

export interface AppIframeHostProps {
  appId: string
  toolName: string
  args: unknown
  invocationId: string
  sessionId?: string | null
  onClose?: () => void
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function AppIframeHost(props: AppIframeHostProps) {
  const { appId, toolName, args, invocationId, onClose } = props
  const { t } = useTranslation()
  const currentSessionId = useAtomValue(currentSessionIdAtom)
  const effectiveSessionId = props.sessionId ?? currentSessionId
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const invocationSentRef = useRef(false)
  const missedPingsRef = useRef(0)

  const [frameKey, setFrameKey] = useState(0)
  const [isIframeReady, setIsIframeReady] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [persistedState, setPersistedState] = useState<unknown>(null)
  const [stateLoaded, setStateLoaded] = useState(false)
  const [status, setStatus] = useState<'loading' | 'active' | 'complete' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const manifest = getAppById(appId)
  const toolRegistration = getAppForTool(`${appId}.${toolName}`)
  const liveInvocation = getLiveInvocation(invocationId)

  const iframeSrc = useMemo(() => {
    if (!manifest) {
      return null
    }

    try {
      return new URL(manifest.url, window.location.origin).toString()
    } catch (_error) {
      return null
    }
  }, [manifest])

  const iframeOrigin = useMemo(() => {
    if (!iframeSrc) {
      return null
    }

    try {
      return new URL(iframeSrc).origin
    } catch (_error) {
      return null
    }
  }, [iframeSrc])

  const sandbox =
    manifest?.type === 'external_authenticated'
      ? 'allow-scripts allow-forms allow-popups'
      : manifest?.type === 'internal'
        ? 'allow-scripts allow-forms allow-downloads'
        : 'allow-scripts allow-forms'

  const debouncedPersistState = useMemo(
    () =>
      debounce(async (nextState: unknown) => {
        if (!effectiveSessionId) {
          return
        }
        await persistAppState(effectiveSessionId, appId, nextState)
      }, 500),
    [appId, effectiveSessionId]
  )

  useEffect(() => {
    return () => {
      debouncedPersistState.flush()
    }
  }, [debouncedPersistState])

  useEffect(() => {
    setStateLoaded(false)
    if (!effectiveSessionId) {
      setPersistedState(null)
      setStateLoaded(true)
      return
    }

    let cancelled = false
    void getLastAppState(effectiveSessionId, appId).then((nextState) => {
      if (!cancelled) {
        setPersistedState(nextState)
        setStateLoaded(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [appId, effectiveSessionId, frameKey])

  // Sandboxed iframes without allow-same-origin get an opaque "null" origin,
  // so targetOrigin must be '*'. This is safe because we post to a specific
  // contentWindow reference and validate event.source on incoming messages.
  const needsWildcardOrigin = sandbox.indexOf('allow-same-origin') === -1

  const sendToIframe = useCallback(
    (message: Record<string, unknown>) => {
      if (!iframeRef.current?.contentWindow) {
        return
      }
      const targetOrigin = needsWildcardOrigin ? '*' : (iframeOrigin ?? '*')
      iframeRef.current.contentWindow.postMessage(message, targetOrigin)
    },
    [iframeOrigin, needsWildcardOrigin]
  )

  useEffect(() => {
    if (isIframeReady) {
      registerActiveIframe(appId, sendToIframe)
    }
    return () => {
      unregisterActiveIframe(appId)
    }
  }, [appId, isIframeReady, sendToIframe])

  const reinitializeFrame = useCallback(() => {
    invocationSentRef.current = false
    missedPingsRef.current = 0
    setIsIframeReady(false)
    setStatus('loading')
    setErrorMessage(null)
    setFrameKey((current) => current + 1)
  }, [])

  const handleClose = useCallback(() => {
    deactivateInvocation(invocationId)
    void appEventBus.emit('cancel', {
      invocationId,
      reason: 'Closed by user',
    })
    onClose?.()
  }, [invocationId, onClose])

  useEffect(() => {
    if (!manifest || !iframeSrc || !iframeOrigin) {
      setStatus('error')
      setErrorMessage('App manifest is missing or has an invalid URL.')
    }
  }, [iframeOrigin, iframeSrc, manifest])

  useEffect(() => {
    if (!isIframeReady || !stateLoaded) {
      return
    }

    sendToIframe({
      type: 'init',
      appId,
      toolName,
      invocationId,
      sessionId: effectiveSessionId || null,
      parentOrigin: window.location.origin,
      state: persistedState,
      capabilities: {
        heartbeat: true,
        statePersistence: true,
      },
    })

    if (!invocationSentRef.current) {
      sendToIframe({
        type: 'tool_invocation',
        toolName,
        args,
        invocationId,
        state: persistedState,
      })
      invocationSentRef.current = true
    }
  }, [appId, args, effectiveSessionId, invocationId, isIframeReady, persistedState, sendToIframe, stateLoaded, toolName])

  useEffect(() => {
    if (!isIframeReady) {
      return
    }

    const interval = window.setInterval(() => {
      missedPingsRef.current += 1
      if (missedPingsRef.current >= 3) {
        window.clearInterval(interval)
        setStatus('error')
        setErrorMessage('App heartbeat timed out.')
        void appEventBus.emit('error', {
          invocationId,
          error: {
            code: 'heartbeat_timeout',
            message: 'App heartbeat timed out.',
          },
        })
        return
      }

      sendToIframe({
        type: 'ping',
        invocationId,
      })
    }, 10_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [invocationId, isIframeReady, sendToIframe])

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) {
        return
      }

      // Sandboxed iframes without allow-same-origin may report "null" even when the src origin is trusted.
      if (iframeOrigin && event.origin !== iframeOrigin && event.origin !== 'null') {
        return
      }

      if (!isObjectLike(event.data) || typeof event.data.type !== 'string') {
        return
      }

      const data = event.data as AppIframeMessage

      switch (data.type) {
        case 'ready':
          missedPingsRef.current = 0
          setIsIframeReady(true)
          setStatus('active')
          setErrorMessage(null)
          return
        case 'pong':
          missedPingsRef.current = 0
          return
        case 'state_update':
          setPersistedState(data.state)
          void debouncedPersistState(data.state)
          return
        case 'tool_result':
          if (data.state !== undefined) {
            setPersistedState(data.state)
            void debouncedPersistState(data.state)
          }
          setStatus('active')
          void appEventBus.emit('result', {
            invocationId: data.invocationId || invocationId,
            result: data.result,
          })
          return
        case 'completion':
          if (data.state !== undefined) {
            setPersistedState(data.state)
            if (effectiveSessionId) {
              void persistAppState(effectiveSessionId, appId, data.state).catch(console.error)
            }
          }
          setStatus('complete')
          if (data.data !== undefined) {
            void appEventBus.emit('result', {
              invocationId,
              result: data.data,
            })
          }
          return
        case 'error': {
          const message = data.message || 'App execution failed.'
          setStatus('error')
          setErrorMessage(message)
          void appEventBus.emit('error', {
            invocationId: data.invocationId || invocationId,
            error: {
              code: data.code,
              message,
            },
          })
          return
        }
        default:
          return
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [appId, debouncedPersistState, effectiveSessionId, iframeOrigin, invocationId])

  if (!manifest || !toolRegistration) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
        {t('App tool registration is missing.')}
      </Alert>
    )
  }

  const renderFrame = (fullscreen: boolean) => (
    <Paper withBorder radius="md" p="xs" className="h-full flex flex-col">
      <Group justify="space-between" align="center" className="shrink-0">
        <Group gap="xs">
          <Text fw={600}>{manifest.name}</Text>
          {status === 'loading' ? (
            <IconLoader size={16} className="animate-spin" />
          ) : status === 'error' ? (
            <IconAlertCircle size={16} color="var(--chatbox-tint-error)" />
          ) : (
            <IconCheck size={16} color="var(--chatbox-tint-success)" />
          )}
          <Text size="sm" c="dimmed">
            {status === 'loading'
              ? t('Loading')
              : status === 'active'
                ? t('Active')
                : status === 'complete'
                  ? t('Complete')
                  : t('Error')}
          </Text>
        </Group>
        <Group gap={4}>
          <ActionIcon variant="subtle" onClick={reinitializeFrame} aria-label={t('Reload')}>
            <IconRefresh size={16} />
          </ActionIcon>
          {!fullscreen && (
            <ActionIcon
              variant="subtle"
              onClick={() => {
                setIsFullscreen(true)
                reinitializeFrame()
              }}
              aria-label={t('Fullscreen')}
            >
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" color="red" onClick={handleClose} aria-label={t('Close')}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {errorMessage && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" className="shrink-0 mt-1">
          {errorMessage}
        </Alert>
      )}

      <Box className={fullscreen ? 'h-[70vh]' : 'flex-1 min-h-0 mt-1'}>
        <iframe
          key={`${invocationId}:${frameKey}:${fullscreen ? 'fullscreen' : 'inline'}`}
          ref={iframeRef}
          className="h-full w-full border-none"
          sandbox={sandbox}
          referrerPolicy="no-referrer"
          src={iframeSrc ?? undefined}
          title={`${manifest.name} app iframe`}
        />
      </Box>
    </Paper>
  )

  return (
    <>
      {!isFullscreen && renderFrame(false)}
      <Modal
        opened={isFullscreen}
        onClose={() => {
          setIsFullscreen(false)
          reinitializeFrame()
        }}
        title={manifest.name}
        size="xl"
        centered
      >
        {renderFrame(true)}
      </Modal>
    </>
  )
}
