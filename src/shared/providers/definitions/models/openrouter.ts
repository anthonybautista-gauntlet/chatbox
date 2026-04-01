import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import AbstractAISDKModel from '../../../models/abstract-ai-sdk'
import { fetchRemoteModels } from '../../../models/openai-compatible'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'

interface ProxyConfig {
  baseURL: string
  anonKey: string
  getAccessToken: () => Promise<string | null> | string | null
}

interface Options {
  apiKey: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  proxy?: ProxyConfig
}

export default class OpenRouter extends AbstractAISDKModel {
  public name = 'OpenRouter'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
  }

  protected getCallSettings() {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
    }
  }

  private createProxyFetch(proxy: ProxyConfig): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = await proxy.getAccessToken()
      if (!token) {
        throw new Error('Not authenticated. Please sign in to use the chat.')
      }
      const headers = new Headers(init?.headers)
      headers.set('apikey', proxy.anonKey)
      headers.set('x-supabase-auth', token)
      return globalThis.fetch(input, { ...init, headers })
    }
  }

  protected getProvider() {
    if (this.options.proxy) {
      return createOpenRouter({
        apiKey: 'proxy-managed',
        baseURL: this.options.proxy.baseURL,
        fetch: this.createProxyFetch(this.options.proxy),
      })
    }

    return createOpenRouter({
      apiKey: this.options.apiKey,
      headers: {
        'HTTP-Referer': 'https://chatboxai.app',
        'X-Title': 'Chatbox AI',
      },
    })
  }

  protected getChatModel() {
    const provider = this.getProvider()
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<ProviderModelInfo[]> {
    return fetchRemoteModels(
      {
        apiHost: 'https://openrouter.ai/api/v1',
        apiKey: this.options.apiKey,
        useProxy: false,
      },
      this.dependencies
    ).catch((err) => {
      console.error(err)
      return []
    })
  }
}
