import type { AppState } from './types'

type MessageHandler = (message: Record<string, unknown>) => void

interface AuthConfig {
  provider: string
  scopes?: string[]
}

interface BridgeConfig {
  auth?: AuthConfig
  onInit: (data: { appId: string; sessionId: string | null; state: AppState | null }) => void
  onToolInvocation: (data: { toolName: string; args: Record<string, unknown>; invocationId: string; state: AppState | null }) => void
  onAuthResult?: (data: { success: boolean; error?: string }) => void
}

let parentOrigin = '*'
let sendMessage: ((msg: Record<string, unknown>) => void) | null = null
let authed = false

export function isAuthed(): boolean {
  return authed
}

export function initBridge(config: BridgeConfig): () => void {
  authed = false

  const handler: MessageHandler = (data) => {
    const msg = data as Record<string, unknown>

    switch (msg.type) {
      case 'init':
        if (typeof msg.parentOrigin === 'string') {
          parentOrigin = msg.parentOrigin
        }
        config.onInit({
          appId: msg.appId as string,
          sessionId: (msg.sessionId as string | null) ?? null,
          state: (msg.state as AppState | null) ?? null,
        })
        if (config.auth && !authed) {
          sendAuthRequired(config.auth.provider, config.auth.scopes)
        }
        break

      case 'tool_invocation':
        if (config.auth && !authed) return
        config.onToolInvocation({
          toolName: msg.toolName as string,
          args: (msg.args as Record<string, unknown>) ?? {},
          invocationId: msg.invocationId as string,
          state: (msg.state as AppState | null) ?? null,
        })
        break

      case 'auth_result':
        if ((msg as Record<string, unknown>).success) {
          authed = true
        }
        config.onAuthResult?.({
          success: !!(msg as Record<string, unknown>).success,
          error: (msg as Record<string, unknown>).error as string | undefined,
        })
        break

      case 'ping':
        postToParent({ type: 'pong' })
        break
    }
  }

  const onMessage = (event: MessageEvent<unknown>) => {
    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return
    handler(event.data as Record<string, unknown>)
  }

  window.addEventListener('message', onMessage)

  sendMessage = (msg) => {
    window.parent.postMessage(msg, parentOrigin)
  }

  postToParent({ type: 'ready' })

  return () => {
    window.removeEventListener('message', onMessage)
    sendMessage = null
  }
}

export function postToParent(msg: Record<string, unknown>) {
  if (sendMessage) {
    sendMessage(msg)
  } else {
    window.parent.postMessage(msg, parentOrigin)
  }
}

export function sendToolResult(invocationId: string, result: unknown, state?: AppState) {
  postToParent({
    type: 'tool_result',
    invocationId,
    result,
    ...(state !== undefined ? { state } : {}),
  })
}

export function sendStateUpdate(state: AppState) {
  postToParent({ type: 'state_update', state })
}

export function sendAuthRequired(provider: string, scopes?: string[]) {
  postToParent({ type: 'auth_required', provider, scopes })
}

export function sendError(invocationId: string, message: string, code?: string) {
  postToParent({ type: 'error', invocationId, message, code })
}

export function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}
