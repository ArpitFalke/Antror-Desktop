import { describe, it, expect, vi } from 'vitest';
import { MCPManager } from '../src/main/mcp/client';

describe('MCPManager', () => {
  it('manages server configs and tools', async () => {
    const mockDb: any = {
      getMCPServers: vi.fn().mockReturnValue([
        { id: 'srv-1', name: 'File Server', transport: 'stdio', command: 'echo', enabled: true }
      ]),
      saveMCPServer: vi.fn(),
      deleteMCPServer: vi.fn()
    };

    const mcp = new MCPManager(mockDb);
    const servers = await mcp.getServers();
    expect(servers.length).toBe(1);
    expect(servers[0].name).toBe('File Server');
  });
});
