import type { AppManifest } from '@shared/types'

export const echoTestAppManifest: AppManifest = {
  id: 'echo-test-app',
  name: 'Echo Test App',
  version: '0.1.0',
  description: 'Development-only placeholder app used to validate ChatBridge app registry plumbing.',
  type: 'internal',
  url: 'http://localhost:4174',
  permissions: [],
  completionSignals: ['completion'],
  tools: [
    {
      name: 'open',
      description:
        'Development-only app registry test tool. Use only when the user explicitly asks to test or debug app integration plumbing.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'A short message to pass into the test app.',
          },
        },
        required: ['message'],
      },
      returns: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          echo: { type: 'string' },
        },
        required: ['ok', 'echo'],
      },
      uiTrigger: true,
      timeoutMs: 30_000,
    },
  ],
}

export const defaultApps: AppManifest[] = [echoTestAppManifest]
