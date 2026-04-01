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

export interface AppRegistryEvents {
  invoke: AppInvokeEvent
  result: AppResultEvent
  error: AppErrorEvent
  cancel: AppCancelEvent
}

export const appEventBus = new Emittery<AppRegistryEvents>()
