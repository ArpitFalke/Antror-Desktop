import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig, ToolDefinition } from '../../shared/types';
import { DatabaseService } from '../db';

export class MCPManager {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private db: DatabaseService;
  private serverTools: Map<string, ToolDefinition[]> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  public async getServers(): Promise<MCPServerConfig[]> {
    const servers = this.db.getMCPServers();
    // Return with live tools if loaded
    return servers.map(s => ({
      ...s,
      tools: this.serverTools.get(s.id) || s.tools || []
    }));
  }

  public async saveServer(server: MCPServerConfig): Promise<void> {
    this.db.saveMCPServer(server);
    if (server.enabled) {
      await this.connectServer(server);
    } else {
      this.disconnectServer(server.id);
    }
  }

  public async deleteServer(serverId: string): Promise<void> {
    this.disconnectServer(serverId);
    this.db.deleteMCPServer(serverId);
  }

  public async connectServer(server: MCPServerConfig): Promise<{ success: boolean; toolsCount: number; error?: string }> {
    this.disconnectServer(server.id);

    if (server.transport === 'stdio') {
      if (!server.command) {
        return { success: false, toolsCount: 0, error: 'Command missing for stdio transport' };
      }

      try {
        const proc = spawn(server.command, server.args || [], {
          env: {
            ...process.env,
            ...(server.env || {})
          },
          shell: true
        });

        this.activeProcesses.set(server.id, proc);

        // Standard MCP initialization handshake or discover tools
        const mockTools: ToolDefinition[] = [
          {
            name: `${server.id}_query`,
            description: `Query resources on MCP server ${server.name}`,
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              },
              required: ['query']
            }
          }
        ];
        this.serverTools.set(server.id, mockTools);

        server.status = 'connected';
        server.tools = mockTools;
        this.db.saveMCPServer(server);

        return { success: true, toolsCount: mockTools.length };
      } catch (err: any) {
        server.status = 'error';
        server.error = err.message;
        this.db.saveMCPServer(server);
        return { success: false, toolsCount: 0, error: err.message };
      }
    } else if (server.transport === 'sse' || server.transport === 'http') {
      try {
        if (!server.url) return { success: false, toolsCount: 0, error: 'URL missing for HTTP/SSE transport' };
        server.status = 'connected';
        const sampleTools: ToolDefinition[] = [
          {
            name: `${server.id}_execute`,
            description: `Execute action on remote MCP server ${server.name}`,
            parameters: {
              type: 'object',
              properties: {
                payload: { type: 'string' }
              }
            }
          }
        ];
        this.serverTools.set(server.id, sampleTools);
        server.tools = sampleTools;
        this.db.saveMCPServer(server);
        return { success: true, toolsCount: sampleTools.length };
      } catch (e: any) {
        return { success: false, toolsCount: 0, error: e.message };
      }
    }

    return { success: false, toolsCount: 0, error: 'Unsupported transport' };
  }

  public disconnectServer(serverId: string): void {
    const proc = this.activeProcesses.get(serverId);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(serverId);
    }
    this.serverTools.delete(serverId);
  }

  public getAllMCPTools(): ToolDefinition[] {
    const all: ToolDefinition[] = [];
    for (const tools of this.serverTools.values()) {
      all.push(...tools);
    }
    return all;
  }
}
