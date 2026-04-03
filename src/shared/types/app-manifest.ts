import { z } from 'zod'

export const AppTypeSchema = z.enum(['internal', 'external_public', 'external_authenticated'])
export type AppType = z.infer<typeof AppTypeSchema>

export const JsonSchemaSchema = z.record(z.string(), z.unknown())
export type JsonSchema = z.infer<typeof JsonSchemaSchema>

export const AppAuthSchema = z.object({
  provider: z.string().min(1),
  scopes: z.array(z.string()).default([]),
})
export type AppAuth = z.infer<typeof AppAuthSchema>

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: JsonSchemaSchema,
  returns: JsonSchemaSchema,
  uiTrigger: z.boolean(),
  timeoutMs: z.number().int().positive().optional(),
})
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>

export const AppManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  type: AppTypeSchema,
  url: z.string().min(1),
  icon: z.string().optional(),
  tools: z.array(ToolDefinitionSchema),
  auth: AppAuthSchema.optional(),
  permissions: z.array(z.string()).default([]),
  completionSignals: z.array(z.string()).default([]),
})
export type AppManifest = z.infer<typeof AppManifestSchema>

const TOOL_NAME_SEPARATOR = '__'

export function getNamespacedAppToolName(appId: string, toolName: string) {
  return `${appId}${TOOL_NAME_SEPARATOR}${toolName}`
}

export function parseNamespacedAppToolName(namespacedToolName: string) {
  const idx = namespacedToolName.indexOf(TOOL_NAME_SEPARATOR)
  if (idx === -1) return null
  const appId = namespacedToolName.slice(0, idx)
  const toolName = namespacedToolName.slice(idx + TOOL_NAME_SEPARATOR.length)
  if (!appId || !toolName) return null
  return { appId, toolName }
}
