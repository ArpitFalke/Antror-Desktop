import { ProviderAdapter } from './base';
import { ModelInfo, StreamParams, StreamChunk } from '../../shared/types';

export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini' as const;
  name = 'Google Gemini';
  defaultBaseUrl = 'https://generativelanguage.googleapis.com';

  defaultModels: ModelInfo[] = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash (Next-Gen Multi-Turn & Reasoning)',
      contextWindow: 2000000,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true
    },
    {
      id: 'gemini-3.5-flash',
      name: 'Gemini 3.5 Flash (Ultra-Low Latency)',
      contextWindow: 1000000,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro (Deep Multimodal Reasoning)',
      contextWindow: 2000000,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      contextWindow: 1000000,
      supportsVision: true,
      supportsThinking: true,
      supportsTools: true
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      supportsVision: true,
      supportsThinking: false,
      supportsTools: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      supportsVision: true,
      supportsThinking: false,
      supportsTools: true
    }
  ];

  async testConnection(apiKey?: string, baseUrl?: string): Promise<{ success: boolean; message: string; models?: ModelInfo[] }> {
    if (!apiKey) return { success: false, message: 'Gemini API key is required.' };
    const url = `${baseUrl || this.defaultBaseUrl}/v1beta/models?key=${apiKey}`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const data = await res.json() as any;
        const models: ModelInfo[] = (data.models || [])
          .filter((m: any) => m.name.includes('gemini'))
          .map((m: any) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', ''),
            contextWindow: m.inputTokenLimit || 1000000,
            supportsVision: true,
            supportsThinking: m.name.includes('2.5'),
            supportsTools: true
          }));
        return { success: true, message: 'Connected to Gemini successfully.', models: models.length ? models : this.defaultModels };
      }
      return { success: false, message: `Gemini error ${res.status}: ${await res.text()}` };
    } catch (e: any) {
      return { success: false, message: `Gemini connection failed: ${e.message}` };
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
      onChunk({ type: 'error', error: 'Missing Gemini API Key. Please add it in Settings > Providers.' });
      return;
    }

    const cleanModel = params.model.replace('models/', '');
    const url = `${baseUrl || this.defaultBaseUrl}/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    // Format Gemini contents
    const contents: any[] = [];
    for (const m of params.messages) {
      if (m.role === 'system') continue;
      const parts: any[] = [];

      if (m.blocks && m.blocks.length > 0) {
        for (const b of m.blocks) {
          if (b.type === 'text') {
            parts.push({ text: b.text });
          } else if (b.type === 'image') {
            const [header, base64Data] = b.data.split(',');
            const mimeType = b.mimeType || header.match(/:(.*?);/)?.[1] || 'image/png';
            parts.push({
              inline_data: {
                mime_type: mimeType,
                data: base64Data || b.data
              }
            });
          } else if (b.type === 'tool_call') {
            parts.push({
              functionCall: {
                name: b.name,
                args: b.args
              }
            });
          } else if (b.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: b.name,
                response: { content: b.content }
              }
            });
          }
        }
      } else {
        parts.push({ text: m.content || '' });
      }

      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      });
    }

    const bodyPayload: any = {
      contents
    };

    if (params.system) {
      bodyPayload.systemInstruction = {
        parts: [{ text: params.system }]
      };
    }

    if (params.tools && params.tools.length > 0) {
      bodyPayload.tools = [
        {
          functionDeclarations: params.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ];
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: params.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        onChunk({ type: 'error', error: `Gemini API error (${response.status}): ${errorText}` });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onChunk({ type: 'error', error: 'No response body from Gemini.' });
        return;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

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
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            const candidate = parsed.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            for (const part of parts) {
              if (part.thought) {
                onChunk({ type: 'thinking_delta', delta: part.text });
              } else if (part.text) {
                onChunk({ type: 'text_delta', delta: part.text });
              } else if (part.functionCall) {
                const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                onChunk({ type: 'tool_call_start', id: callId, name: part.functionCall.name });
                onChunk({
                  type: 'tool_call_end',
                  id: callId,
                  name: part.functionCall.name,
                  args: part.functionCall.args || {}
                });
              }
            }

            if (parsed.usageMetadata) {
              onChunk({
                type: 'usage',
                promptTokens: parsed.usageMetadata.promptTokenCount || 0,
                completionTokens: parsed.usageMetadata.candidatesTokenCount || 0,
                totalTokens: parsed.usageMetadata.totalTokenCount || 0
              });
            }
          } catch (e) {
            // Ignore parse errors on partial frames
          }
        }
      }
      onChunk({ type: 'done' });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onChunk({ type: 'done', stopReason: 'aborted' });
      } else {
        onChunk({ type: 'error', error: err.message || 'Gemini stream failed' });
      }
    }
  }
}
