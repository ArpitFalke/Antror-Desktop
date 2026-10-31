import { BrowserWindow, Notification } from 'electron';
import { DatabaseService } from '../db';
import { ProviderManager } from '../providers/manager';
import { ToolEngine } from '../tools';
import { PermissionEngine } from '../permissions/engine';
import {
  ActiveRun,
  ChatMessage,
  ChatSession,
  MessageContentBlock,
  StreamChunk,
  ToolCallBlock,
  ThinkingBlock,
  TextBlock,
  ToolResultBlock,
  Artifact
} from '../../shared/types';

export class RunManager {
  private runs: Map<string, {
    run: ActiveRun;
    abortController: AbortController;
    assistantMessage: ChatMessage;
    session: ChatSession;
  }> = new Map();

  private db: DatabaseService;
  private providerManager: ProviderManager;
  private toolEngine: ToolEngine;
  private permissionEngine: PermissionEngine;
  private mainWindow: BrowserWindow | null = null;

  constructor(
    db: DatabaseService,
    providerManager: ProviderManager,
    toolEngine: ToolEngine,
    permissionEngine: PermissionEngine
  ) {
    this.db = db;
    this.providerManager = providerManager;
    this.toolEngine = toolEngine;
    this.permissionEngine = permissionEngine;

    // Connect sub-agent recursive execution
    this.toolEngine.setSubAgentRunner(async (prompt, role) => {
      return this.runSubAgent(prompt, role);
    });
  }

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  public getActiveRuns(): ActiveRun[] {
    return Array.from(this.runs.values()).map(r => r.run);
  }

  public isChatRunning(chatId: string): boolean {
    const run = this.runs.get(chatId);
    return Boolean(run && run.run.status === 'running');
  }

  private broadcastEvent(type: string, runId: string, chatId: string, payload: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('run:event', {
        type,
        runId,
        chatId,
        payload
      });
    }
  }

  public async startRun(
    chatId: string,
    userMessageData: { text: string; images?: string[]; parentId?: string }
  ): Promise<string> {
    // If run already active for this chat, stop it first
    if (this.runs.has(chatId)) {
      await this.stopRun(chatId);
    }

    const session = this.db.getSession(chatId);
    if (!session) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const abortController = new AbortController();

    // 1. Create and persist user message
    const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const userBlocks: MessageContentBlock[] = [];
    if (userMessageData.images && userMessageData.images.length > 0) {
      for (const img of userMessageData.images) {
        userBlocks.push({
          type: 'image',
          mimeType: 'image/png',
          data: img
        });
      }
    }
    if (userMessageData.text) {
      userBlocks.push({
        type: 'text',
        text: userMessageData.text
      });
    }

    const userMessage: ChatMessage = {
      id: userMessageId,
      chatId,
      role: 'user',
      content: userMessageData.text || '',
      blocks: userBlocks,
      createdAt: Date.now(),
      parentId: userMessageData.parentId
    };
    this.db.saveMessage(userMessage);

    // Update session title if first turn
    const existingMessages = this.db.getMessages(chatId);
    if (existingMessages.length <= 2 && userMessageData.text) {
      session.title = userMessageData.text.slice(0, 40) + (userMessageData.text.length > 40 ? '...' : '');
      session.updatedAt = Date.now();
      this.db.saveSession(session);
    }

    // 2. Create placeholder assistant message
    const assistantMessageId = `msg-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      chatId,
      role: 'assistant',
      content: '',
      blocks: [],
      model: session.model,
      provider: session.provider,
      createdAt: Date.now()
    };
    this.db.saveMessage(assistantMessage);

    const activeRun: ActiveRun = {
      runId,
      chatId,
      provider: session.provider as any,
      model: session.model,
      status: 'running',
      startedAt: Date.now(),
      currentAssistantMessageId: assistantMessageId
    };

    this.runs.set(chatId, {
      run: activeRun,
      abortController,
      assistantMessage,
      session
    });

    this.broadcastEvent('run_started', runId, chatId, { run: activeRun });

    // 3. Kick off agent execution in background (unawaited)
    this.executeAgentLoop(chatId, runId).catch((err) => {
      console.error(`Error in run ${runId}:`, err);
    });

    return runId;
  }

  public async stopRun(chatId: string): Promise<void> {
    const runCtx = this.runs.get(chatId);
    if (!runCtx) return;

    runCtx.abortController.abort();
    runCtx.run.status = 'stopped';
    this.broadcastEvent('run_stopped', runCtx.run.runId, chatId, {});
    this.runs.delete(chatId);
  }

  private async executeAgentLoop(chatId: string, runId: string): Promise<void> {
    const runCtx = this.runs.get(chatId);
    if (!runCtx) return;

    const { session, abortController } = runCtx;
    let keepGoing = true;
    let turnCount = 0;
    const maxTurns = 20;

    while (keepGoing && turnCount < maxTurns) {
      if (abortController.signal.aborted) break;
      turnCount++;

      // Refresh message history
      const history = this.db.getMessages(chatId);

      // System prompt construction
      let systemPrompt = session.systemPrompt || 'You are Antror, a brilliant, helpful, and versatile AI assistant.';
      
      // Inject global instructions and memories
      const memories = this.db.getMemories(session.projectId);
      if (memories.length > 0) {
        systemPrompt += `\n\nLong-term Memories:\n` + memories.map(m => `- ${m.content}`).join('\n');
      }

      const tools = this.toolEngine.getToolDefinitions();

      let currentThinkingBlock: ThinkingBlock | null = null;
      let currentTextBlock: TextBlock | null = null;
      const pendingToolCalls: Map<string, ToolCallBlock> = new Map();

      try {
        await this.providerManager.streamChat(
          {
            provider: session.provider as any,
            model: session.model,
            messages: history,
            system: systemPrompt,
            tools,
            signal: abortController.signal
          },
          (chunk: StreamChunk) => {
            if (abortController.signal.aborted) return;

            if (chunk.type === 'thinking_delta') {
              if (!currentThinkingBlock) {
                currentThinkingBlock = { type: 'thinking', text: '' };
                runCtx.assistantMessage.blocks = runCtx.assistantMessage.blocks || [];
                runCtx.assistantMessage.blocks.push(currentThinkingBlock);
              }
              currentThinkingBlock.text += chunk.delta;
              this.broadcastEvent('thinking_delta', runId, chatId, { delta: chunk.delta });
            } else if (chunk.type === 'text_delta') {
              if (!currentTextBlock) {
                currentTextBlock = { type: 'text', text: '' };
                runCtx.assistantMessage.blocks = runCtx.assistantMessage.blocks || [];
                runCtx.assistantMessage.blocks.push(currentTextBlock);
              }
              currentTextBlock.text += chunk.delta;
              runCtx.assistantMessage.content = (runCtx.assistantMessage.content || '') + chunk.delta;
              this.broadcastEvent('text_delta', runId, chatId, { delta: chunk.delta });
            } else if (chunk.type === 'tool_call_start') {
              const tcBlock: ToolCallBlock = {
                type: 'tool_call',
                id: chunk.id,
                name: chunk.name,
                args: {},
                status: 'pending'
              };
              pendingToolCalls.set(chunk.id, tcBlock);
              runCtx.assistantMessage.blocks = runCtx.assistantMessage.blocks || [];
              runCtx.assistantMessage.blocks.push(tcBlock);
              this.broadcastEvent('tool_call_start', runId, chatId, { toolCall: tcBlock });
            } else if (chunk.type === 'tool_call_delta') {
              const tc = pendingToolCalls.get(chunk.id);
              if (tc) {
                tc.argsRaw = (tc.argsRaw || '') + chunk.delta;
              }
            } else if (chunk.type === 'tool_call_end') {
              const tc = pendingToolCalls.get(chunk.id);
              if (tc) {
                tc.args = chunk.args;
                this.broadcastEvent('tool_call_ready', runId, chatId, { toolCall: tc });
              }
            } else if (chunk.type === 'usage') {
              runCtx.assistantMessage.tokens = {
                prompt: chunk.promptTokens,
                completion: chunk.completionTokens,
                total: chunk.totalTokens
              };
            } else if (chunk.type === 'error') {
              runCtx.run.status = 'error';
              runCtx.run.error = chunk.error;
              this.broadcastEvent('run_error', runId, chatId, { error: chunk.error });
            }
          }
        );
      } catch (streamErr: any) {
        if (!abortController.signal.aborted) {
          runCtx.run.status = 'error';
          runCtx.run.error = streamErr.message;
          this.broadcastEvent('run_error', runId, chatId, { error: streamErr.message });
        }
        break;
      }

      // Check artifacts generated in message content
      this.detectAndExtractArtifacts(chatId, runCtx.assistantMessage);

      // Persist latest assistant message
      this.db.saveMessage(runCtx.assistantMessage);

      // If there are tool calls to execute
      if (pendingToolCalls.size > 0 && !abortController.signal.aborted) {
        const toolCallsList = Array.from(pendingToolCalls.values());
        
        for (const tc of toolCallsList) {
          if (abortController.signal.aborted) break;

          tc.status = 'running';
          this.broadcastEvent('tool_call_running', runId, chatId, { toolCallId: tc.id });

          // Permission check
          const isAllowed = await this.permissionEngine.requestPermission(
            runId,
            chatId,
            tc.name,
            tc.args,
            session.projectId,
            (permReq) => {
              runCtx.run.status = 'paused_permission';
              runCtx.run.pendingPermission = permReq;
              this.broadcastEvent('permission_required', runId, chatId, { request: permReq });
            }
          );

          runCtx.run.status = 'running';
          runCtx.run.pendingPermission = undefined;

          let toolOutput = '';
          if (isAllowed) {
            const startT = Date.now();
            toolOutput = await this.toolEngine.executeTool(tc.name, tc.args, {
              chatId,
              projectId: session.projectId
            });
            tc.executionTimeMs = Date.now() - startT;
            tc.status = 'completed';
            tc.output = toolOutput;
          } else {
            tc.status = 'denied';
            toolOutput = `Tool execution was denied by the user.`;
          }

          // Create ToolResultBlock in the message
          const trBlock: ToolResultBlock = {
            type: 'tool_result',
            toolCallId: tc.id,
            name: tc.name,
            content: toolOutput,
            isError: tc.status === 'denied'
          };
          runCtx.assistantMessage.blocks = runCtx.assistantMessage.blocks || [];
          runCtx.assistantMessage.blocks.push(trBlock);

          this.broadcastEvent('tool_call_completed', runId, chatId, {
            toolCallId: tc.id,
            status: tc.status,
            output: toolOutput
          });
        }

        // Save progress to DB before next model turn
        this.db.saveMessage(runCtx.assistantMessage);

        // Prepare new assistant message container for next model turn
        const nextAssistantMsgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        runCtx.assistantMessage = {
          id: nextAssistantMsgId,
          chatId,
          role: 'assistant',
          content: '',
          blocks: [],
          model: session.model,
          provider: session.provider,
          createdAt: Date.now()
        };
        this.db.saveMessage(runCtx.assistantMessage);
      } else {
        // No more tool calls: agent is done!
        keepGoing = false;
      }
    }

    if (!abortController.signal.aborted) {
      runCtx.run.status = 'completed';
      this.broadcastEvent('run_completed', runId, chatId, {});

      // Native desktop notification if enabled
      try {
        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Antror Assistant',
            body: `Finished response for "${session.title}"`,
            silent: false
          });
          notif.show();
        }
      } catch (nErr) {}
    }

    this.runs.delete(chatId);
  }

  private detectAndExtractArtifacts(chatId: string, msg: ChatMessage): void {
    const text = msg.content || '';
    // Match code blocks like ```html ... ``` or ```mermaid ... ``` or tagged artifacts
    const artifactRegex = /```(html|react|svg|mermaid|markdown|python|typescript|javascript|tsx|jsx)\s+([\s\S]*?)```/g;
    let match;
    while ((match = artifactRegex.exec(text)) !== null) {
      const lang = match[1];
      const code = match[2].trim();
      if (code.length > 40) {
        let type: Artifact['type'] = 'code';
        if (lang === 'html') type = 'html';
        else if (lang === 'react' || lang === 'tsx') type = 'react';
        else if (lang === 'svg') type = 'svg';
        else if (lang === 'mermaid') type = 'mermaid';
        else if (lang === 'markdown') type = 'markdown';

        const title = `${type.toUpperCase()} Component (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        const artifact: Artifact = {
          id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          chatId,
          messageId: msg.id,
          title,
          type,
          content: code,
          language: lang,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.db.saveArtifact(artifact);
        this.broadcastEvent('artifact_created', '', chatId, { artifact });
        break; // Extract primary artifact
      }
    }
  }

  private async runSubAgent(prompt: string, role: string): Promise<string> {
    const subAgentSystem = `You are a specialized sub-agent with role: ${role}. Solve the assigned task concisely and accurately.`;
    let responseText = '';
    const tempChat: ChatMessage[] = [
      {
        id: 'sub-user-1',
        chatId: 'sub-agent',
        role: 'user',
        content: prompt,
        createdAt: Date.now()
      }
    ];

    try {
      await this.providerManager.streamChat(
        {
          provider: 'anthropic',
          model: 'claude-3-5-haiku-20241022',
          messages: tempChat,
          system: subAgentSystem
        },
        (chunk) => {
          if (chunk.type === 'text_delta') {
            responseText += chunk.delta;
          }
        }
      );
      return responseText || `Sub-agent (${role}) finished task.`;
    } catch (e: any) {
      return `Sub-agent error: ${e.message}`;
    }
  }
}
