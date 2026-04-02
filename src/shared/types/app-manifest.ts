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

export function getNamespacedAppToolName(appId: string, toolName: string) {
  return `${appId}.${toolName}`
}
