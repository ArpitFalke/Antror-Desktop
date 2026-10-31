import {
  LLMProviderId,
  ModelInfo,
  ProviderConfig,
  StreamParams,
  StreamChunk
} from '../../shared/types';

export interface ProviderAdapter {
  id: LLMProviderId;
  name: string;
  defaultBaseUrl: string;
  defaultModels: ModelInfo[];
  streamChat(
    params: StreamParams,
    apiKey: string | undefined,
    baseUrl: string | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
  testConnection(
    apiKey: string | undefined,
    baseUrl: string | undefined
  ): Promise<{ success: boolean; message: string; models?: ModelInfo[] }>;
  fetchModels(
    apiKey: string | undefined,
    baseUrl: string | undefined
  ): Promise<ModelInfo[]>;
}
