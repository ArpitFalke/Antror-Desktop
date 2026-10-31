import { ProviderAdapter } from './base';
import { LLMProviderId, ModelInfo, StreamParams, StreamChunk } from '../../shared/types';

export class OpenAICompatibleAdapter implements ProviderAdapter {
  id: LLMProviderId;
  name: string;
  defaultBaseUrl: string;
  defaultModels: ModelInfo[];
  authHeaderName: string;

  constructor(
    id: LLMProviderId,
    name: string,
    defaultBaseUrl: string,
    defaultModels: ModelInfo[],
    authHeaderName: string = 'Authorization'
  ) {
    this.id = id;
    this.name = name;
    this.defaultBaseUrl = defaultBaseUrl;
    this.defaultModels = defaultModels;
    this.authHeaderName = authHeaderName;
  }

  async testConnection(apiKey?: string, baseUrl?: string): Promise<{ success: boolean; message: string; models?: ModelInfo[] }> {
    const url = `${baseUrl || this.defaultBaseUrl}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers[this.authHeaderName] = this.authHeaderName === 'Authorization' ? `Bearer ${apiKey}` : apiKey;
    }

    try {
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json() as any;
        const modelsList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        const models: ModelInfo[] = modelsList.map((m: any) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          contextWindow: 128000,
          supportsVision: true,
          supportsThinking: Boolean(m.id?.includes('reasoner') || m.id?.includes('o1') || m.id?.includes('o3')),
          supportsTools: true
        }));
        return {
          success: true,
          message: `Connected to ${this.name} successfully.`,
          models: models.length ? models : this.defaultModels
        };
      }
      return { success: false, message: `${this.name} status ${res.status}: ${await res.text()}` };
    } catch (e: any) {
      // For local providers like Ollama/LM Studio without auth or /models endpoint
      if (this.id === 'ollama' || this.id === 'lmstudio') {
        return { success: true, message: `Connected to ${this.name} (local).`, models: this.defaultModels };
      }
      return { success: false, message: `${this.name} connection error: ${e.message}` };
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
    const isLocal = this.id === 'ollama' || this.id === 'lmstudio';
    if (!apiKey && !isLocal) {
      onChunk({ type: 'error', error: `Missing API Key for ${this.name}. Set it in Settings > Providers.` });
      return;
    }

    let url = `${baseUrl || this.defaultBaseUrl}/chat/completions`;
    // Clean double slashes
    url = url.replace(/([^:]\/)\/+/g, '$1');

    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };
    if (apiKey) {
      headers[this.authHeaderName] = this.authHeaderName === 'Authorization' ? `Bearer ${apiKey}` : apiKey;
    }

    // Convert messages
    const messages: any[] = [];
    if (params.system) {
      messages.push({ role: 'system', content: params.system });
    }

    for (const m of params.messages) {
      if (m.role === 'system') {
        messages.push({ role: 'system', content: m.content });
        continue;
      }

      if (m.blocks && m.blocks.length > 0) {
        const contentParts: any[] = [];
        let toolCalls: any[] = [];

        for (const block of m.blocks) {
          if (block.type === 'text') {
            contentParts.push({ type: 'text', text: block.text });
          } else if (block.type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: { url: block.data }
            });
          } else if (block.type === 'tool_call') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.args)
              }
            });
          } else if (block.type === 'tool_result') {
            messages.push({
              role: 'tool',
              tool_call_id: block.toolCallId,
              content: block.content
            });
          }
        }

        if (m.role === 'assistant' && toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: contentParts.map(p => p.text).join('') || null,
            tool_calls: toolCalls
          });
        } else if (contentParts.length > 0) {
          messages.push({
            role: m.role,
            content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts
          });
        }
      } else {
        messages.push({ role: m.role, content: m.content || '' });
      }
    }

    const tools = params.tools?.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const bodyPayload: any = {
      model: params.model,
      messages,
      stream: true
    };

    if (tools && tools.length > 0) {
      bodyPayload.tools = tools;
    }

    // Reasoning models adjustment
    if (params.model.includes('o1') || params.model.includes('o3')) {
      bodyPayload.reasoning_effort = 'medium';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: params.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        onChunk({ type: 'error', error: `${this.name} API error (${response.status}): ${errText}` });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onChunk({ type: 'error', error: 'No response body received.' });
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const toolCallAcc: Record<number, { id: string; name: string; args: string }> = {};

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
          if (dataStr === '[DONE]') {
            // Flush any ongoing tool calls
            for (const idx of Object.keys(toolCallAcc)) {
              const tc = toolCallAcc[Number(idx)];
              let parsed = {};
              try {
                parsed = JSON.parse(tc.args || '{}');
              } catch {
                parsed = { raw: tc.args };
              }
              onChunk({ type: 'tool_call_end', id: tc.id, name: tc.name, args: parsed });
            }
            onChunk({ type: 'done' });
            return;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            // Handle DeepSeek / generic reasoning_content
            if (delta?.reasoning_content) {
              onChunk({ type: 'thinking_delta', delta: delta.reasoning_content });
            }

            // Handle normal text content
            if (delta?.content) {
              onChunk({ type: 'text_delta', delta: delta.content });
            }

            // Handle tool calls streaming
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0;
                if (!toolCallAcc[index]) {
                  toolCallAcc[index] = {
                    id: tc.id || `tc-${Date.now()}-${index}`,
                    name: tc.function?.name || '',
                    args: ''
                  };
                  onChunk({
                    type: 'tool_call_start',
                    id: toolCallAcc[index].id,
                    name: toolCallAcc[index].name
                  });
                }
                if (tc.function?.name && !toolCallAcc[index].name) {
                  toolCallAcc[index].name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCallAcc[index].args += tc.function.arguments;
                  onChunk({
                    type: 'tool_call_delta',
                    id: toolCallAcc[index].id,
                    delta: tc.function.arguments
                  });
                }
              }
            }

            // Usage
            if (parsed.usage) {
              onChunk({
                type: 'usage',
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0
              });
            }

            if (choice?.finish_reason && choice.finish_reason !== 'null') {
              if (choice.finish_reason === 'tool_calls') {
                for (const idx of Object.keys(toolCallAcc)) {
                  const tc = toolCallAcc[Number(idx)];
                  let pArgs = {};
                  try {
                    pArgs = JSON.parse(tc.args || '{}');
                  } catch {
                    pArgs = { raw: tc.args };
                  }
                  onChunk({ type: 'tool_call_end', id: tc.id, name: tc.name, args: pArgs });
                }
              }
            }
          } catch (e) {
            // Ignore partial SSE lines
          }
        }
      }
      onChunk({ type: 'done' });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onChunk({ type: 'done', stopReason: 'aborted' });
      } else {
        onChunk({ type: 'error', error: err.message || 'Stream failed' });
      }
    }
  }
}
