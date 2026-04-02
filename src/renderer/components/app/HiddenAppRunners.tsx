import { Box } from '@mantine/core'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { currentSessionIdAtom } from '@/stores/atoms'
import { appEventBus, getLiveInvocation, type LiveAppInvocation } from '@/packages/app-registry'
import { AppIframeHost } from './AppIframeHost'

const HIDDEN_CONTAINER_STYLE = {
  position: 'fixed' as const,
  top: -10_000,
  left: -10_000,
  width: 1,
  height: 1,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none' as const,
}

export function HiddenAppRunners() {
  const currentSessionId = useAtomValue(currentSessionIdAtom)
  const [hiddenInvocations, setHiddenInvocations] = useState<LiveAppInvocation[]>([])

  useEffect(() => {
    const handleInvoke = (event: { invocationId: string }) => {
      const live = getLiveInvocation(event.invocationId)
      if (!live || live.uiTrigger) {
        return
      }

      setHiddenInvocations((current) => {
        const next = current.filter((item) => item.invocationId !== live.invocationId)
        return [...next, live]
      })
    }

    const removeInvocation = ({ invocationId }: { invocationId: string }) => {
      setHiddenInvocations((current) => current.filter((item) => item.invocationId !== invocationId))
    }

    const unsubscribeInvoke = appEventBus.on('invoke', handleInvoke)
    const unsubscribeResult = appEventBus.on('result', removeInvocation)
    const unsubscribeError = appEventBus.on('error', removeInvocation)
    const unsubscribeCancel = appEventBus.on('cancel', removeInvocation)

    return () => {
      unsubscribeInvoke()
      unsubscribeResult()
      unsubscribeError()
      unsubscribeCancel()
    }
  }, [])

  useEffect(() => {
    setHiddenInvocations([])
  }, [currentSessionId])

  if (hiddenInvocations.length === 0) {
    return null
  }

  return (
    <Box style={HIDDEN_CONTAINER_STYLE} aria-hidden="true">
      {hiddenInvocations.map((invocation) => (
        <Box key={invocation.invocationId} style={{ width: 1, height: 1 }}>
          <AppIframeHost
            appId={invocation.appId}
            toolName={invocation.toolName}
            args={invocation.args}
            invocationId={invocation.invocationId}
            sessionId={currentSessionId}
          />
        </Box>
      ))}
    </Box>
  )
}
