import { ProviderAdapter } from './base';
import { ModelInfo, StreamParams, StreamChunk } from '../../shared/types';

export class AnthropicAdapter implements ProviderAdapter {
  id = 'anthropic' as const;
  name = 'Anthropic';
  defaultBaseUrl = 'https://api.anthropic.com';

  defaultModels: ModelInfo[] = [
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
      contextWindow: 200000,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet v2',
      contextWindow: 200000,
      supportsVision: true,
      supportsThinking: false,
      supportsTools: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      supportsVision: true,
      supportsThinking: false,
      supportsTools: true
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      supportsVision: true,
      supportsThinking: false,
      supportsTools: true
    }
  ];

  async testConnection(apiKey?: string, baseUrl?: string): Promise<{ success: boolean; message: string; models?: ModelInfo[] }> {
    if (!apiKey) return { success: false, message: 'Anthropic API key is required.' };
    const url = `${baseUrl || this.defaultBaseUrl}/v1/models`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      if (res.ok) {
        const data = await res.json() as any;
        const models: ModelInfo[] = (data.data || []).map((m: any) => ({
          id: m.id,
          name: m.display_name || m.id,
          contextWindow: 200000,
          supportsVision: true,
          supportsThinking: m.id.includes('3-7'),
          supportsTools: true
        }));
        return { success: true, message: 'Connected to Anthropic successfully.', models: models.length ? models : this.defaultModels };
      }
      const errText = await res.text();
      return { success: false, message: `Anthropic authentication failed (${res.status}): ${errText}` };
    } catch (e: any) {
      return { success: false, message: `Anthropic connection error: ${e.message}` };
    }
  }

  async fetchModels(apiKey?: string, baseUrl?: string): Promise<ModelInfo[]> {
    const res = await this.testConnection(apiKey, baseUrl);
    return res.models || this.defaultModels;
  }

  async streamChat(
    params: StreamParams,
    apiKey: string | undefined,
    baseUrl: string | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    if (!apiKey) {
      onChunk({ type: 'error', error: 'Missing Anthropic API Key. Please add it in Settings > Providers.' });
      return;
    }

    const url = `${baseUrl || this.defaultBaseUrl}/v1/messages`;

    // Convert messages to Anthropic format
    const system = params.system || '';
    const messages: any[] = [];

    for (const m of params.messages) {
      if (m.role === 'system') continue;
      
      const parts: any[] = [];
      if (m.blocks && m.blocks.length > 0) {
        for (const block of m.blocks) {
          if (block.type === 'text') {
            parts.push({ type: 'text', text: block.text });
          } else if (block.type === 'image') {
            const [header, base64Data] = block.data.split(',');
            const mediaType = block.mimeType || header.match(/:(.*?);/)?.[1] || 'image/png';
            parts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data || block.data
              }
            });
          } else if (block.type === 'tool_call') {
            parts.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.args
            });
          } else if (block.type === 'tool_result') {
            parts.push({
              type: 'tool_result',
              tool_use_id: block.toolCallId,
              content: block.content,
              is_error: block.isError || false
            });
          }
        }
      } else {
        parts.push({ type: 'text', text: m.content || '' });
      }

      messages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: parts
      });
    }

    const tools = params.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));

    const bodyPayload: any = {
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      messages,
      stream: true
    };

    if (system) bodyPayload.system = system;
    if (tools && tools.length > 0) bodyPayload.tools = tools;
    if (params.model.includes('3-7')) {
      bodyPayload.thinking = {
        type: 'enabled',
        budget_tokens: 2048
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: params.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        onChunk({ type: 'error', error: `Anthropic API error (${response.status}): ${errorText}` });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onChunk({ type: 'error', error: 'No response body from Anthropic.' });
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let currentToolId = '';
      let currentToolName = '';
      let currentToolJson = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const evt = JSON.parse(dataStr);
            if (evt.type === 'content_block_start') {
              if (evt.content_block?.type === 'tool_use') {
                currentToolId = evt.content_block.id;
                currentToolName = evt.content_block.name;
                currentToolJson = '';
                onChunk({ type: 'tool_call_start', id: currentToolId, name: currentToolName });
              }
            } else if (evt.type === 'content_block_delta') {
              const delta = evt.delta;
              if (delta?.type === 'text_delta') {
                onChunk({ type: 'text_delta', delta: delta.text });
              } else if (delta?.type === 'thinking_delta') {
                onChunk({ type: 'thinking_delta', delta: delta.thinking });
              } else if (delta?.type === 'input_json_delta') {
                currentToolJson += delta.partial_json;
                onChunk({ type: 'tool_call_delta', id: currentToolId, delta: delta.partial_json });
              }
            } else if (evt.type === 'content_block_stop') {
              if (currentToolId) {
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(currentToolJson || '{}');
                } catch {
                  parsedArgs = { raw: currentToolJson };
                }
                onChunk({
                  type: 'tool_call_end',
                  id: currentToolId,
                  name: currentToolName,
                  args: parsedArgs
                });
                currentToolId = '';
                currentToolName = '';
                currentToolJson = '';
              }
            } else if (evt.type === 'message_delta') {
              if (evt.usage) {
                onChunk({
                  type: 'usage',
                  promptTokens: evt.usage.input_tokens || 0,
                  completionTokens: evt.usage.output_tokens || 0,
                  totalTokens: (evt.usage.input_tokens || 0) + (evt.usage.output_tokens || 0)
                });
              }
            } else if (evt.type === 'message_stop') {
              onChunk({ type: 'done' });
            }
          } catch (jsonErr) {
            // Ignore parse errors on malformed chunks
          }
        }
      }
      onChunk({ type: 'done' });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onChunk({ type: 'done', stopReason: 'aborted' });
      } else {
        onChunk({ type: 'error', error: err.message || 'Stream connection failed' });
      }
    }
  }
}
