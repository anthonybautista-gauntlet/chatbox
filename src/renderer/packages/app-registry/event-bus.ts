import Emittery from 'emittery'

export interface AppInvokeEvent {
  appId: string
  toolName: string
  args: unknown
  invocationId: string
  sessionId?: string
}

export interface AppResultEvent {
  invocationId: string
  result: unknown
}

export interface AppErrorEvent {
  invocationId: string
  error: { message: string; code?: string }
}

export interface AppCancelEvent {
  invocationId: string
  reason?: string
}

export interface AppContextRequestEvent {
  appId: string
  requestId: string
}

export interface AppHydrateStateEvent {
  appId: string
  state: unknown
}

export interface AppRegistryEvents {
  invoke: AppInvokeEvent
  result: AppResultEvent
  error: AppErrorEvent
  cancel: AppCancelEvent
  context_request: AppContextRequestEvent
  hydrate_state: AppHydrateStateEvent
}

export const appEventBus = new Emittery<AppRegistryEvents>()
