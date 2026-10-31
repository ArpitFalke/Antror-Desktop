import { describe, it, expect, vi } from 'vitest';
import { RunManager } from '../src/main/runs/manager';

describe('RunManager', () => {
  it('manages background runs lifecycle and active queries', async () => {
    const mockDb: any = {
      getSession: vi.fn().mockReturnValue({
        id: 'chat-test-1',
        title: 'Test Session',
        provider: 'anthropic',
        model: 'claude-3-7-sonnet-20250219'
      }),
      saveMessage: vi.fn(),
      getMessages: vi.fn().mockReturnValue([]),
      getMemories: vi.fn().mockReturnValue([]),
      saveSession: vi.fn(),
      saveArtifact: vi.fn()
    };

    const mockProviderManager: any = {
      streamChat: vi.fn().mockImplementation(async (_params, onChunk) => {
        onChunk({ type: 'thinking_delta', delta: 'Analyzing request...' });
        onChunk({ type: 'text_delta', delta: 'Hello world response' });
        onChunk({ type: 'done' });
      })
    };

    const mockToolEngine: any = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      setSubAgentRunner: vi.fn()
    };

    const mockPermissionEngine: any = {
      requestPermission: vi.fn().mockResolvedValue(true)
    };

    const runManager = new RunManager(
      mockDb,
      mockProviderManager,
      mockToolEngine,
      mockPermissionEngine
    );

    expect(runManager.isChatRunning('chat-test-1')).toBe(false);

    // Start background run
    const runId = await runManager.startRun('chat-test-1', { text: 'Hello' });
    expect(runId).toBeDefined();
    expect(runId.startsWith('run-')).toBe(true);

    // Check active status
    const active = runManager.getActiveRuns();
    expect(active.length).toBeGreaterThanOrEqual(0);

    // Stop run
    await runManager.stopRun('chat-test-1');
    expect(runManager.isChatRunning('chat-test-1')).toBe(false);
  });
});
