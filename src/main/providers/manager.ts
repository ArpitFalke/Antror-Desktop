import { ProviderAdapter } from './base';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';
import { OpenAICompatibleAdapter } from './openai-compatible';
import { KeychainService } from '../security/keychain';
import { DatabaseService } from '../db';
import {
  LLMProviderId,
  ModelInfo,
  ProviderConfig,
  StreamParams,
  StreamChunk
} from '../../shared/types';

export class ProviderManager {
  private adapters: Map<LLMProviderId, ProviderAdapter> = new Map();
  private keychain: KeychainService;
  private db: DatabaseService;

  constructor(keychain: KeychainService, db: DatabaseService) {
    this.keychain = keychain;
    this.db = db;
    this.registerDefaultAdapters();
  }

  private registerDefaultAdapters(): void {
    // 1. Anthropic
    this.registerAdapter(new AnthropicAdapter());

    // 2. Google Gemini
    this.registerAdapter(new GeminiAdapter());

    // 3. OpenAI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'openai',
        'OpenAI',
        'https://api.openai.com/v1',
        [
          { id: 'gpt-4o', name: 'GPT-4o (Omni)', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true },
          { id: 'o3-mini', name: 'o3-mini (High Reasoning)', contextWindow: 200000, supportsVision: false, supportsThinking: true, supportsTools: true },
          { id: 'o1', name: 'o1 (Full Reasoning)', contextWindow: 200000, supportsVision: true, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 4. DeepSeek
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'deepseek',
        'DeepSeek',
        'https://api.deepseek.com',
        [
          { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', contextWindow: 64000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', contextWindow: 64000, supportsVision: false, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 5. Groq
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'groq',
        'Groq (Ultra-Fast LPU)',
        'https://api.groq.com/openai/v1',
        [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B 32k', contextWindow: 32768, supportsVision: false, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 6. Mistral AI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'mistral',
        'Mistral AI',
        'https://api.mistral.ai/v1',
        [
          { id: 'mistral-large-latest', name: 'Mistral Large 2', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true },
          { id: 'codestral-latest', name: 'Codestral (Code specialist)', contextWindow: 32000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'mistral-small-latest', name: 'Mistral Small', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 7. xAI (Grok)
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'xai',
        'xAI (Grok)',
        'https://api.x.ai/v1',
        [
          { id: 'grok-2-1212', name: 'Grok 2 (Latest)', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true },
          { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', contextWindow: 32768, supportsVision: true, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 8. OpenRouter
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'openrouter',
        'OpenRouter',
        'https://openrouter.ai/api/v1',
        [
          { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (via OpenRouter)', contextWindow: 200000, supportsVision: true, supportsThinking: true, supportsTools: true },
          { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (via OpenRouter)', contextWindow: 64000, supportsVision: false, supportsThinking: true, supportsTools: true },
          { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 9. Together AI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'together',
        'Together AI',
        'https://api.together.xyz/v1',
        [
          { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', contextWindow: 64000, supportsVision: false, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 10. Fireworks AI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'fireworks',
        'Fireworks AI',
        'https://api.fireworks.ai/inference/v1',
        [
          { id: 'accounts/fireworks/models/llama-v3p1-70b-instruct', name: 'Llama 3.1 70B Instruct', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'accounts/fireworks/models/deepseek-r1', name: 'DeepSeek R1', contextWindow: 64000, supportsVision: false, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 11. Perplexity AI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'perplexity',
        'Perplexity',
        'https://api.perplexity.ai',
        [
          { id: 'sonar-pro', name: 'Sonar Pro (Search-grounded)', contextWindow: 200000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'sonar-reasoning', name: 'Sonar Reasoning', contextWindow: 128000, supportsVision: false, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 12. Cohere
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'cohere',
        'Cohere',
        'https://api.cohere.com/v2',
        [
          { id: 'command-r-plus-08-2024', name: 'Command R+', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'command-r-08-2024', name: 'Command R', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 13. Ollama (Local)
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'ollama',
        'Ollama (Local)',
        'http://localhost:11434/v1',
        [
          { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, supportsVision: false, supportsThinking: false, supportsTools: true },
          { id: 'deepseek-r1:7b', name: 'DeepSeek R1 7B', contextWindow: 32000, supportsVision: false, supportsThinking: true, supportsTools: true },
          { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B', contextWindow: 32000, supportsVision: false, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 14. LM Studio (Local)
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'lmstudio',
        'LM Studio (Local)',
        'http://localhost:1234/v1',
        [
          { id: 'local-model', name: 'Loaded Local Model', contextWindow: 32000, supportsVision: true, supportsThinking: true, supportsTools: true }
        ]
      )
    );

    // 15. Azure OpenAI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'azure-openai',
        'Azure OpenAI',
        'https://your-resource.openai.azure.com/openai/deployments',
        [
          { id: 'gpt-4o', name: 'Azure GPT-4o Deployment', contextWindow: 128000, supportsVision: true, supportsThinking: false, supportsTools: true }
        ],
        'api-key'
      )
    );

    // 16. AWS Bedrock
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'bedrock',
        'AWS Bedrock',
        'https://bedrock-runtime.us-east-1.amazonaws.com',
        [
          { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', name: 'Claude 3.5 Sonnet (Bedrock)', contextWindow: 200000, supportsVision: true, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 17. Google Vertex AI
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'vertex',
        'Google Vertex AI',
        'https://us-central1-aiplatform.googleapis.com',
        [
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Vertex)', contextWindow: 1000000, supportsVision: true, supportsThinking: false, supportsTools: true }
        ]
      )
    );

    // 18. Custom OpenAI-Compatible
    this.registerAdapter(
      new OpenAICompatibleAdapter(
        'custom',
        'Custom OpenAI-Compatible',
        'http://localhost:8000/v1',
        [
          { id: 'custom-model', name: 'Custom Model', contextWindow: 32000, supportsVision: true, supportsThinking: false, supportsTools: true }
        ]
      )
    );
  }

  public registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: LLMProviderId): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  public getConfigs(): ProviderConfig[] {
    const configs: ProviderConfig[] = [];
    for (const [id, adapter] of this.adapters.entries()) {
      const apiKey = this.keychain.getSecret(`provider_key_${id}`);
      const baseUrl = this.keychain.getSecret(`provider_url_${id}`) || adapter.defaultBaseUrl;
      const isEnabled = this.keychain.getSecret(`provider_enabled_${id}`) !== 'false';

      configs.push({
        id,
        name: adapter.name,
        apiKey: apiKey ? '••••••••' + apiKey.slice(-4) : '',
        baseUrl,
        isEnabled,
        models: adapter.defaultModels,
        defaultModel: adapter.defaultModels[0]?.id
      });
    }
    return configs;
  }

  public saveConfig(config: ProviderConfig): void {
    if (config.apiKey && !config.apiKey.startsWith('••••••••')) {
      this.keychain.setSecret(`provider_key_${config.id}`, config.apiKey);
    }
    if (config.baseUrl) {
      this.keychain.setSecret(`provider_url_${config.id}`, config.baseUrl);
    }
    this.keychain.setSecret(`provider_enabled_${config.id}`, String(config.isEnabled));
  }

  public getApiKey(id: LLMProviderId): string | undefined {
    return this.keychain.getSecret(`provider_key_${id}`);
  }

  public getBaseUrl(id: LLMProviderId): string | undefined {
    const saved = this.keychain.getSecret(`provider_url_${id}`);
    if (saved) return saved;
    return this.adapters.get(id)?.defaultBaseUrl;
  }

  public async testConnection(
    providerId: LLMProviderId,
    testApiKey?: string,
    testBaseUrl?: string
  ): Promise<{ success: boolean; message: string; models?: ModelInfo[] }> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      return { success: false, message: `Unknown provider ${providerId}` };
    }
    const key = testApiKey || this.getApiKey(providerId);
    const url = testBaseUrl || this.getBaseUrl(providerId);
    return adapter.testConnection(key, url);
  }

  public async fetchModels(providerId: LLMProviderId): Promise<ModelInfo[]> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) return [];
    const key = this.getApiKey(providerId);
    const url = this.getBaseUrl(providerId);
    return adapter.fetchModels(key, url);
  }

  public async streamChat(
    params: StreamParams,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const adapter = this.adapters.get(params.provider);
    if (!adapter) {
      onChunk({ type: 'error', error: `Unsupported provider: ${params.provider}` });
      return;
    }
    const apiKey = this.getApiKey(params.provider);
    const baseUrl = this.getBaseUrl(params.provider);
    return adapter.streamChat(params, apiKey, baseUrl, onChunk);
  }
}
