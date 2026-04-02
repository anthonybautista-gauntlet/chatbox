import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import {
  AppManifestSchema,
  getNamespacedAppToolName,
  type AppManifest,
  type JsonSchema,
  type ToolDefinition,
} from '@shared/types'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { appEventBus } from './event-bus'
import { defaultApps } from './manifests'

export { appEventBus } from './event-bus'

type JsonSchemaRecord = JsonSchema

interface PendingInvocation {
  invocationId: string
  appId: string
  toolName: string
  args: unknown
  sessionId?: string
  timeoutId: ReturnType<typeof setTimeout>
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export interface LiveAppInvocation {
  invocationId: string
  appId: string
  toolName: string
  args: unknown
  sessionId?: string
  uiTrigger: boolean
  status: 'pending' | 'result' | 'error' | 'cancelled' | 'awaiting_auth'
  result?: unknown
  error?: { message: string; code?: string }
  startedAt: number
  completedAt?: number
}

const registeredApps = new Map<string, AppManifest>()
const remoteAppIds = new Set<string>()
const pendingInvocations = new Map<string, PendingInvocation>()
const liveInvocations = new Map<string, LiveAppInvocation>()

type RegistryListener = () => void
const registryListeners = new Set<RegistryListener>()
let registrySnapshot: AppManifest[] = []

function notifyRegistryChange() {
  registrySnapshot = Array.from(registeredApps.values())
  for (const listener of registryListeners) {
    listener()
  }
}

export function subscribeToRegistry(listener: RegistryListener): () => void {
  registryListeners.add(listener)
  return () => registryListeners.delete(listener)
}

export function getRegistrySnapshot(): AppManifest[] {
  return registrySnapshot
}

interface ActiveIframeRef {
  sendMessage: (message: Record<string, unknown>) => void
}

const activeIframeRefs = new Map<string, ActiveIframeRef>()

export function registerActiveIframe(appId: string, sendMessage: (msg: Record<string, unknown>) => void) {
  activeIframeRefs.set(appId, { sendMessage })
}

export function unregisterActiveIframe(appId: string) {
  activeIframeRefs.delete(appId)
}

export function getActiveIframe(appId: string) {
  return activeIframeRefs.get(appId)
}

function asSchemaRecord(value: unknown): JsonSchemaRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as JsonSchemaRecord
}

function withDescription(schema: z.ZodTypeAny, jsonSchema: JsonSchemaRecord) {
  const description = typeof jsonSchema.description === 'string' ? jsonSchema.description : null
  return description ? schema.describe(description) : schema
}

function buildEnumSchema(values: unknown[], jsonSchema: JsonSchemaRecord) {
  if (values.length === 0) {
    return withDescription(z.any(), jsonSchema)
  }
  if (values.length === 1) {
    return withDescription(z.literal(values[0]), jsonSchema)
  }
  const literalSchemas = values.map((value) => z.literal(value))
  return withDescription(z.union(literalSchemas as [z.ZodLiteral<unknown>, z.ZodLiteral<unknown>, ...z.ZodLiteral<unknown>[]]), jsonSchema)
}

function jsonSchemaToZod(schema: JsonSchemaRecord | null): z.ZodTypeAny {
  if (!schema) {
    return z.any()
  }

  const enumValues = Array.isArray(schema.enum) ? schema.enum : null
  if (enumValues) {
    return buildEnumSchema(enumValues, schema)
  }

  const schemaType = Array.isArray(schema.type)
    ? schema.type.find((value): value is string => typeof value === 'string')
    : typeof schema.type === 'string'
      ? schema.type
      : null

  switch (schemaType) {
    case 'string':
      return withDescription(z.string(), schema)
    case 'number':
      return withDescription(z.number(), schema)
    case 'integer':
      return withDescription(z.number().int(), schema)
    case 'boolean':
      return withDescription(z.boolean(), schema)
    case 'array': {
      const itemSchema = jsonSchemaToZod(asSchemaRecord(schema.items))
      return withDescription(z.array(itemSchema), schema)
    }
    case 'object': {
      const properties = asSchemaRecord(schema.properties) || {}
      const requiredKeys = new Set(Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : [])
      const shape: Record<string, z.ZodTypeAny> = {}

      for (const [key, value] of Object.entries(properties)) {
        const propertySchema = jsonSchemaToZod(asSchemaRecord(value))
        shape[key] = requiredKeys.has(key) ? propertySchema : propertySchema.optional()
      }

      return withDescription(z.object(shape).passthrough(), schema)
    }
    default:
      return withDescription(z.any(), schema)
  }
}

function createInvocationTimeout(invocationId: string, timeoutMs: number) {
  return setTimeout(() => {
    const pending = pendingInvocations.get(invocationId)
    if (!pending) {
      return
    }

    pendingInvocations.delete(invocationId)
    const liveInvocation = liveInvocations.get(invocationId)
    if (liveInvocation) {
      liveInvocations.set(invocationId, {
        ...liveInvocation,
        status: 'error',
        completedAt: Date.now(),
        error: { message: 'App tool invocation timed out', code: 'timeout' },
      })
    }
    pending.reject(new Error('App tool invocation timed out'))
  }, timeoutMs)
}

function createAppTool(manifest: AppManifest, definition: ToolDefinition, sessionId?: string) {
  const inputSchema = jsonSchemaToZod(definition.parameters)
  const timeoutMs = definition.timeoutMs ?? 30_000

  return tool({
    description: `${definition.description}\n\nApp: ${manifest.name}. Use this namespaced tool only when the user explicitly needs this app workflow.`,
    inputSchema,
    execute: async (args: unknown, context?: { toolCallId?: string }) => {
      const invocationId = context?.toolCallId || crypto.randomUUID()

      const pendingPromise = new Promise<unknown>((resolve, reject) => {
        const timeoutId = createInvocationTimeout(invocationId, timeoutMs)
        pendingInvocations.set(invocationId, {
          invocationId,
          appId: manifest.id,
          toolName: definition.name,
          args,
          sessionId,
          timeoutId,
          resolve,
          reject,
        })
      })

      liveInvocations.set(invocationId, {
        invocationId,
        appId: manifest.id,
        toolName: definition.name,
        args,
        sessionId,
        uiTrigger: definition.uiTrigger,
        status: 'pending',
        startedAt: Date.now(),
      })

      const activeIframe = activeIframeRefs.get(manifest.id)
      if (activeIframe) {
        activeIframe.sendMessage({
          type: 'tool_invocation',
          toolName: definition.name,
          args,
          invocationId,
          state: null,
        })
      } else {
        void appEventBus.emit('invoke', {
          appId: manifest.id,
          toolName: definition.name,
          args,
          invocationId,
          sessionId,
        })
      }

      return await pendingPromise
    },
  })
}

function settleInvocation(
  invocationId: string,
  nextStatus: LiveAppInvocation['status'],
  payload?: { result?: unknown; error?: { message: string; code?: string } }
) {
  const pending = pendingInvocations.get(invocationId)
  if (!pending) {
    return
  }

  clearTimeout(pending.timeoutId)
  pendingInvocations.delete(invocationId)

  const liveInvocation = liveInvocations.get(invocationId)
  if (liveInvocation) {
    const shouldKeepLiveSession = liveInvocation.uiTrigger && nextStatus !== 'cancelled'
    if (shouldKeepLiveSession) {
      liveInvocations.set(invocationId, {
        ...liveInvocation,
        status: nextStatus,
        result: payload?.result,
        error: payload?.error,
        completedAt: Date.now(),
      })
    } else {
      liveInvocations.delete(invocationId)
    }
  }

  if (nextStatus === 'result') {
    pending.resolve(payload?.result)
    return
  }

  if (nextStatus === 'cancelled') {
    pending.reject(new Error(payload?.error?.message || 'App tool invocation cancelled'))
    return
  }

  pending.reject(new Error(payload?.error?.message || 'App tool invocation failed'))
}

appEventBus.on('result', ({ invocationId, result }) => {
  settleInvocation(invocationId, 'result', { result })
})

appEventBus.on('error', ({ invocationId, error }) => {
  settleInvocation(invocationId, 'error', { error })
})

appEventBus.on('cancel', ({ invocationId, reason }) => {
  settleInvocation(invocationId, 'cancelled', {
    error: {
      message: reason || 'App tool invocation cancelled',
      code: 'cancelled',
    },
  })
})

export function registerApp(manifest: AppManifest, remote = false) {
  const parsedManifest = AppManifestSchema.parse(manifest)
  registeredApps.set(parsedManifest.id, parsedManifest)
  if (remote) remoteAppIds.add(parsedManifest.id)
  notifyRegistryChange()
  return parsedManifest
}

export function getAppById(id: string) {
  return registeredApps.get(id)
}

export function getAppForTool(namespacedToolName: string) {
  const [appId, ...toolNameParts] = namespacedToolName.split('.')
  if (!appId || toolNameParts.length === 0) {
    return null
  }

  const manifest = registeredApps.get(appId)
  if (!manifest) {
    return null
  }

  const toolName = toolNameParts.join('.')
  const definition = manifest.tools.find((toolDefinition) => toolDefinition.name === toolName)
  if (!definition) {
    return null
  }

  return {
    manifest,
    definition,
    appId,
    toolName,
  }
}

export function getAppToolsForSession(sessionId?: string): ToolSet {
  const tools: ToolSet = {}

  for (const manifest of registeredApps.values()) {
    for (const definition of manifest.tools) {
      tools[getNamespacedAppToolName(manifest.id, definition.name)] = createAppTool(manifest, definition, sessionId)
    }
  }

  return tools
}

export function getLiveInvocation(invocationId: string) {
  return liveInvocations.get(invocationId)
}

export function isLiveInvocation(invocationId: string) {
  return liveInvocations.has(invocationId)
}

export function deactivateInvocation(invocationId: string) {
  liveInvocations.delete(invocationId)
}

export function suspendInvocationForAuth(invocationId: string) {
  const pending = pendingInvocations.get(invocationId)
  if (pending) {
    clearTimeout(pending.timeoutId)
  }
  const live = liveInvocations.get(invocationId)
  if (live) {
    liveInvocations.set(invocationId, { ...live, status: 'awaiting_auth' })
  }
}

export function resumeInvocationAfterAuth(invocationId: string) {
  const pending = pendingInvocations.get(invocationId)
  if (pending) {
    const definition = registeredApps.get(pending.appId)?.tools.find((t) => t.name === pending.toolName)
    const timeoutMs = definition?.timeoutMs ?? 30_000
    pending.timeoutId = createInvocationTimeout(invocationId, timeoutMs)
  }
  const live = liveInvocations.get(invocationId)
  if (live) {
    liveInvocations.set(invocationId, { ...live, status: 'pending' })
  }
}

export function failInvocationAuth(invocationId: string) {
  settleInvocation(invocationId, 'error', {
    error: { message: 'Authorization failed or was cancelled', code: 'auth_failed' },
  })
}

export function getRegisteredApps() {
  return Array.from(registeredApps.values())
}

for (const manifest of defaultApps) {
  registerApp(manifest)
}

export async function loadRemoteApps(): Promise<void> {
  if (!isSupabaseConfigured) return

  const { data, error } = await supabase
    .from('app_registrations')
    .select('manifest')
    .eq('status', 'APPROVED')

  if (error || !data) return

  const freshRemoteIds = new Set<string>()

  for (const row of data) {
    const manifest = row.manifest as AppManifest
    if (!manifest?.id) continue
    freshRemoteIds.add(manifest.id)
    if (registeredApps.has(manifest.id)) continue
    try {
      registerApp(manifest, true)
    } catch {
      // skip invalid manifests
    }
  }

  let changed = false
  for (const id of remoteAppIds) {
    if (!freshRemoteIds.has(id)) {
      registeredApps.delete(id)
      remoteAppIds.delete(id)
      changed = true
    }
  }
  if (changed) notifyRegistryChange()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => void loadRemoteApps())
}
