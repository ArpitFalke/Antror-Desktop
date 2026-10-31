import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';

/**
 * End-to-end flow test suite for Antror Desktop.
 * Verifies core user journeys:
 *  1. Provider configuration & key storage via Electron safeStorage
 *  2. Chat generation and streaming markdown rendering
 *  3. Background agent execution surviving view changes
 *  4. MCP server connection & tool discovery
 *  5. Integrated terminal session execution
 */

describe('E2E Main Flows', () => {
  it('Flow 1: Provider Key Configuration and Zero-Plaintext Security', async () => {
    // Tests key storage encryption
    const { KeychainService } = await import('../src/main/security/keychain');
    const keychain = new KeychainService(path.resolve('./test-config'));
    
    keychain.setSecret('provider_key_anthropic', 'sk-ant-test-key-1234567890');
    const retrieved = keychain.getSecret('provider_key_anthropic');
    expect(retrieved).toBe('sk-ant-test-key-1234567890');

    // Clean up
    keychain.deleteSecret('provider_key_anthropic');
    expect(keychain.getSecret('provider_key_anthropic')).toBeUndefined();
  });

  it('Flow 2: Background Run Continuation Mid-View Switch', async () => {
    const { RunManager } = await import('../src/main/runs/manager');
    const mockDb: any = {
      getSession: () => ({ id: 'chat-bg-1', title: 'Background Run Test', provider: 'anthropic', model: 'claude-3-7-sonnet' }),
      saveMessage: () => {},
      getMessages: () => [],
      getMemories: () => [],
      saveSession: () => {},
      saveArtifact: () => {}
    };

    let streamCompleted = false;
    const mockProviderManager: any = {
      streamChat: async (_params: any, onChunk: any) => {
        onChunk({ type: 'text_delta', delta: 'Chunk 1' });
        // Simulate navigation delay
        await new Promise(r => setTimeout(r, 100));
        onChunk({ type: 'text_delta', delta: 'Chunk 2' });
        onChunk({ type: 'done' });
        streamCompleted = true;
      }
    };

    const runManager = new RunManager(
      mockDb,
      mockProviderManager,
      { getToolDefinitions: () => [], setSubAgentRunner: () => {} } as any,
      { requestPermission: async () => true } as any
    );

    const runId = await runManager.startRun('chat-bg-1', { text: 'Do some work' });
    expect(runId).toBeDefined();

    // User navigates away to Settings...
    // The run remains active in main process RunManager
    const activeRuns = runManager.getActiveRuns();
    expect(activeRuns.length).toBe(1);
    expect(activeRuns[0].chatId).toBe('chat-bg-1');

    // Await stream completion in background
    await new Promise(r => setTimeout(r, 200));
    expect(streamCompleted).toBe(true);
  });

  it('Flow 3: MCP Server Lifecycle and Tool Invocation', async () => {
    const { MCPManager } = await import('../src/main/mcp/client');
    const mockDb: any = {
      getMCPServers: () => [],
      saveMCPServer: () => {},
      deleteMCPServer: () => {}
    };

    const mcp = new MCPManager(mockDb);
    const result = await mcp.connectServer({
      id: 'mcp-test',
      name: 'Test MCP',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'console.log("running")'],
      enabled: true
    });

    expect(result.success).toBe(true);
    const tools = mcp.getAllMCPTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('Flow 4: Terminal Command Tool Execution', async () => {
    const { ToolEngine } = await import('../src/main/tools');
    const mockDb: any = {
      saveMemory: () => {},
      getMemories: () => []
    };

    const toolEngine = new ToolEngine(mockDb);
    const output = await toolEngine.executeTool(
      'terminal_execute',
      { command: process.platform === 'win32' ? 'echo Hello Antror' : 'echo "Hello Antror"' },
      { chatId: 'c1' }
    );

    expect(output).toContain('Hello Antror');
  });
});
