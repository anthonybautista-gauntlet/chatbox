import { Box } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { appEventBus, getLiveInvocation, type LiveAppInvocation } from '@/packages/app-registry'
import { currentSessionIdAtom } from '@/stores/atoms'
import { AppIframeHost } from './AppIframeHost'

const DEFAULT_HEIGHT = 500
const MIN_HEIGHT = 250
const MAX_HEIGHT = 800

export function ActiveAppPanel() {
  const currentSessionId = useAtomValue(currentSessionIdAtom)
  const [activeInvocation, setActiveInvocation] = useState<LiveAppInvocation | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)

  const dragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  useEffect(() => {
    const handleInvoke = (event: { appId: string; invocationId: string }) => {
      const live = getLiveInvocation(event.invocationId)
      if (live?.uiTrigger) {
        setActiveInvocation(live)
        setDismissed(false)
      }
    }

    const unsubscribe = appEventBus.on('invoke', handleInvoke)
    return () => { unsubscribe() }
  }, [])

  useEffect(() => {
    setActiveInvocation(null)
    setDismissed(false)
  }, [currentSessionId])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startHeight.current = height
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [height])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = startY.current - e.clientY
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta)))
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  if (!activeInvocation || dismissed) {
    return null
  }

  return (
    <Box className="shrink-0 flex flex-col" style={{ height }}>
      <div
        className="h-1.5 cursor-ns-resize shrink-0 flex items-center justify-center hover:bg-[var(--chatbox-border-primary)] transition-colors"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="w-8 h-0.5 rounded bg-[var(--chatbox-border-primary)]" />
      </div>
      <Box className="flex-1 min-h-0">
        <AppIframeHost
          appId={activeInvocation.appId}
          toolName={activeInvocation.toolName}
          args={activeInvocation.args}
          invocationId={activeInvocation.invocationId}
          sessionId={currentSessionId}
          onClose={() => setDismissed(true)}
        />
      </Box>
    </Box>
  )
}
