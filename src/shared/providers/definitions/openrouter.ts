import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenRouter from './models/openrouter'

function getWebProxyConfig() {
  const isWeb = (process.env.CHATBOX_BUILD_PLATFORM || 'unknown') === 'web'
  if (!isWeb) return undefined

  const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) return undefined

  return {
    baseURL: `${supabaseUrl}/functions/v1/llm-proxy`,
    anonKey,
    getAccessToken: async () => {
      try {
        const [{ supabaseAuthStore }, { supabase }] = await Promise.all([
          import('../../../renderer/stores/supabaseAuthStore.js'),
          import('../../../renderer/lib/supabase.js'),
        ])

        const storeToken = supabaseAuthStore.getState().getAccessToken()
        if (storeToken) return storeToken

        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) return session.access_token
      } catch {
        // Fall back to persisted session parsing below if module loading or auth state lookup fails.
      }

      try {
        const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
        const raw = localStorage.getItem(storageKey)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed?.access_token ?? parsed?.currentSession?.access_token ?? parsed?.session?.access_token ?? null
      } catch {
        return null
      }
    },
  }
}

export const openRouterProvider = defineProvider({
  id: ModelProviderEnum.OpenRouter,
  name: 'OpenRouter',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://openrouter.ai/',
  },
  defaultSettings: {
    apiHost: 'https://openrouter.ai/api/v1',
    models: [
      {
        modelId: 'anthropic/claude-opus-4.5',
        type: 'chat',
        nickname: 'Anthropic: Claude Opus 4.5',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 200000,
      },
      {
        modelId: 'anthropic/claude-sonnet-4.5',
        type: 'chat',
        nickname: 'Anthropic: Claude Sonnet 4.5',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 1000000,
      },
      {
        modelId: 'anthropic/claude-haiku-4.5',
        type: 'chat',
        nickname: 'Anthropic: Claude Haiku 4.5',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 200000,
      },
      {
        modelId: 'openai/gpt-4o',
        type: 'chat',
        nickname: 'OpenAI: GPT-4o',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 128000,
      },
      {
        modelId: 'openai/gpt-4o-mini',
        type: 'chat',
        nickname: 'OpenAI: GPT-4o Mini',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 128000,
      },
      {
        modelId: 'google/gemini-3.1-flash-lite-preview',
        type: 'chat',
        nickname: 'Google: Gemini 3.1 Flash Lite Preview',
        capabilities: ['vision'],
        contextWindow: 1048576,
      },
      {
        modelId: 'google/gemini-3.1-pro-preview',
        type: 'chat',
        nickname: 'Google: Gemini 3.1 Pro Preview',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 1048576,
      },
      {
        modelId: 'moonshotai/kimi-k2.5',
        type: 'chat',
        nickname: 'MoonshotAI: Kimi K2.5',
        capabilities: ['tool_use', 'vision'],
        contextWindow: 262144,
      },
    ],
  },
  createModel: (config) => {
    return new OpenRouter(
      {
        apiKey: config.providerSetting.apiKey || '',
        model: config.model,
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        stream: config.settings.stream,
        proxy: getWebProxyConfig(),
      },
      config.dependencies
    )
  },
  getDisplayName: (modelId, providerSettings) => {
    return `OpenRouter API (${providerSettings?.models?.find((m) => m.modelId === modelId)?.nickname || modelId})`
  },
})
