import { contextBridge, ipcRenderer } from 'electron';
import {
  ChatSession,
  ChatMessage,
  Artifact,
  Project,
  MemoryItem,
  AppSettings,
  ProviderConfig,
  MCPServerConfig,
  PermissionDecision,
  LLMProviderId,
  ModelInfo,
  ActiveRun
} from '../shared/types';

const api = {
  // Chat & DB
  getSessions: (): Promise<ChatSession[]> => ipcRenderer.invoke('db:getSessions'),
  createSession: (data: Partial<ChatSession>): Promise<ChatSession> => ipcRenderer.invoke('db:createSession', data),
  getSession: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke('db:getSession', id),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke('db:deleteSession', id),
  getMessages: (chatId: string): Promise<ChatMessage[]> => ipcRenderer.invoke('db:getMessages', chatId),
  searchChats: (query: string): Promise<{ chatId: string; title: string; snippet: string; messageId: string }[]> =>
    ipcRenderer.invoke('db:searchChats', query),

  // Runs / Agent
  startRun: (chatId: string, userMessage: { text: string; images?: string[]; parentId?: string }): Promise<string> =>
    ipcRenderer.invoke('run:start', { chatId, userMessage }),
  stopRun: (chatId: string): Promise<void> => ipcRenderer.invoke('run:stop', chatId),
  getActiveRuns: (): Promise<ActiveRun[]> => ipcRenderer.invoke('run:getActiveRuns'),
  onRunEvent: (callback: (event: { type: string; runId: string; chatId: string; payload: any }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('run:event', handler);
    return () => {
      ipcRenderer.removeListener('run:event', handler);
    };
  },
  respondPermission: (requestId: string, decision: PermissionDecision): Promise<void> =>
    ipcRenderer.invoke('run:respondPermission', { requestId, decision }),

  // Providers & Keys
  getProviders: (): Promise<ProviderConfig[]> => ipcRenderer.invoke('providers:getConfigs'),
  saveProvider: (provider: ProviderConfig): Promise<void> => ipcRenderer.invoke('providers:saveConfig', provider),
  testConnection: (providerId: LLMProviderId, apiKey?: string, baseUrl?: string): Promise<{ success: boolean; message: string; models?: ModelInfo[] }> =>
    ipcRenderer.invoke('providers:testConnection', { providerId, apiKey, baseUrl }),
  fetchModels: (providerId: LLMProviderId): Promise<ModelInfo[]> =>
    ipcRenderer.invoke('providers:fetchModels', providerId),

  // Artifacts
  getArtifacts: (chatId?: string): Promise<Artifact[]> => ipcRenderer.invoke('artifacts:getAll', chatId),
  saveArtifact: (artifact: Partial<Artifact>): Promise<Artifact> => ipcRenderer.invoke('artifacts:save', artifact),
  saveArtifactToProject: (artifactId: string, projectId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('artifacts:saveToProject', { artifactId, projectId, filename }),

  // Projects
  getProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:getAll'),
  createProject: (name: string, customPath?: string): Promise<Project> =>
    ipcRenderer.invoke('projects:create', { name, customPath }),
  getProjectFiles: (projectId: string): Promise<any[]> =>
    ipcRenderer.invoke('projects:getFiles', projectId),
  readFileContent: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  writeFileContent: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke('fs:writeFile', { filePath, content }),

  // Terminal
  createTerminal: (tabId: string, cwd?: string): Promise<void> =>
    ipcRenderer.invoke('terminal:create', { tabId, cwd }),
  sendTerminalInput: (tabId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('terminal:input', { tabId, data }),
  resizeTerminal: (tabId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', { tabId, cols, rows }),
  closeTerminal: (tabId: string): Promise<void> =>
    ipcRenderer.invoke('terminal:close', tabId),
  onTerminalData: (tabId: string, callback: (data: string) => void) => {
    const channel = `terminal:data:${tabId}`;
    const handler = (_event: any, data: string) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },

  // Browser
  browserNavigate: (url: string): Promise<void> => ipcRenderer.invoke('browser:navigate', url),
  browserGoBack: (): Promise<void> => ipcRenderer.invoke('browser:goBack'),
  browserGoForward: (): Promise<void> => ipcRenderer.invoke('browser:goForward'),
  browserReload: (): Promise<void> => ipcRenderer.invoke('browser:reload'),
  getBrowserSnapshot: (): Promise<{ url: string; title: string; text: string }> =>
    ipcRenderer.invoke('browser:getSnapshot'),

  // MCP
  getMCPServers: (): Promise<MCPServerConfig[]> => ipcRenderer.invoke('mcp:getServers'),
  saveMCPServer: (server: MCPServerConfig): Promise<void> => ipcRenderer.invoke('mcp:saveServer', server),
  deleteMCPServer: (serverId: string): Promise<void> => ipcRenderer.invoke('mcp:deleteServer', serverId),
  testMCPServer: (serverId: string): Promise<{ success: boolean; toolsCount: number; error?: string }> =>
    ipcRenderer.invoke('mcp:testServer', serverId),

  // Memory & Settings
  getMemories: (projectId?: string): Promise<MemoryItem[]> => ipcRenderer.invoke('memory:getAll', projectId),
  saveMemory: (memory: Partial<MemoryItem>): Promise<MemoryItem> => ipcRenderer.invoke('memory:save', memory),
  deleteMemory: (id: string): Promise<void> => ipcRenderer.invoke('memory:delete', id),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),
  getAppPaths: (): Promise<{ workspace: string; projects: string; logs: string; memory: string }> =>
    ipcRenderer.invoke('app:getPaths'),
  showItemInFolder: (path: string): Promise<void> => ipcRenderer.invoke('app:showInFolder', path)
};

contextBridge.exposeInMainWorld('antrorAPI', api);
