import { ipcMain, shell, BrowserWindow } from 'electron';
import { DatabaseService } from '../db';
import { KeychainService } from '../security/keychain';
import { ProviderManager } from '../providers/manager';
import { RunManager } from '../runs/manager';
import { ProjectManager } from '../projects/manager';
import { TerminalManager } from '../terminal/manager';
import { BrowserManager } from '../browser/manager';
import { MCPManager } from '../mcp/client';
import { AppPaths } from '../db/paths';
import {
  ChatSession,
  ProviderConfig,
  MCPServerConfig,
  PermissionDecision,
  AppSettings,
  Artifact,
  LLMProviderId
} from '../../shared/types';

export function registerIpcHandlers(
  db: DatabaseService,
  keychain: KeychainService,
  providerManager: ProviderManager,
  runManager: RunManager,
  projectManager: ProjectManager,
  terminalManager: TerminalManager,
  browserManager: BrowserManager,
  mcpManager: MCPManager,
  paths: AppPaths
): void {
  // --- Sessions & Messages ---
  ipcMain.handle('db:getSessions', async () => {
    return db.getSessions();
  });

  ipcMain.handle('db:getSession', async (_e, id: string) => {
    return db.getSession(id);
  });

  ipcMain.handle('db:createSession', async (_e, data: Partial<ChatSession>) => {
    const session: ChatSession = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: data.title || 'New Chat',
      provider: data.provider || 'anthropic',
      model: data.model || 'claude-3-7-sonnet-20250219',
      projectId: data.projectId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      systemPrompt: data.systemPrompt
    };
    db.saveSession(session);
    return session;
  });

  ipcMain.handle('db:deleteSession', async (_e, id: string) => {
    db.deleteSession(id);
  });

  ipcMain.handle('db:getMessages', async (_e, chatId: string) => {
    return db.getMessages(chatId);
  });

  ipcMain.handle('db:searchChats', async (_e, query: string) => {
    return db.search(query);
  });

  // --- Runs ---
  ipcMain.handle('run:start', async (_e, { chatId, userMessage }) => {
    return runManager.startRun(chatId, userMessage);
  });

  ipcMain.handle('run:stop', async (_e, chatId: string) => {
    return runManager.stopRun(chatId);
  });

  ipcMain.handle('run:getActiveRuns', async () => {
    return runManager.getActiveRuns();
  });

  ipcMain.handle('run:respondPermission', async (_e, { requestId, decision }: { requestId: string; decision: PermissionDecision }) => {
    // Handled by permissionEngine via RunManager
    // In our PermissionEngine, respondPermission accepts requestId, decision
    (runManager as any).permissionEngine.respondPermission(requestId, decision);
  });

  // --- Providers & Keys ---
  ipcMain.handle('providers:getConfigs', async () => {
    return providerManager.getConfigs();
  });

  ipcMain.handle('providers:saveConfig', async (_e, config: ProviderConfig) => {
    providerManager.saveConfig(config);
  });

  ipcMain.handle('providers:testConnection', async (_e, { providerId, apiKey, baseUrl }: { providerId: LLMProviderId; apiKey?: string; baseUrl?: string }) => {
    return providerManager.testConnection(providerId, apiKey, baseUrl);
  });

  ipcMain.handle('providers:fetchModels', async (_e, providerId: LLMProviderId) => {
    return providerManager.fetchModels(providerId);
  });

  // --- Artifacts ---
  ipcMain.handle('artifacts:getAll', async (_e, chatId?: string) => {
    return db.getArtifacts(chatId);
  });

  ipcMain.handle('artifacts:save', async (_e, artifact: Partial<Artifact>) => {
    const full: Artifact = {
      id: artifact.id || `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      chatId: artifact.chatId || '',
      messageId: artifact.messageId,
      title: artifact.title || 'Untitled Artifact',
      type: artifact.type || 'code',
      content: artifact.content || '',
      language: artifact.language,
      version: artifact.version || 1,
      createdAt: artifact.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    db.saveArtifact(full);
    return full;
  });

  ipcMain.handle('artifacts:saveToProject', async (_e, { artifactId, projectId, filename }) => {
    return projectManager.saveArtifactToProject(artifactId, projectId, filename);
  });

  // --- Projects ---
  ipcMain.handle('projects:getAll', async () => {
    return projectManager.getProjects();
  });

  ipcMain.handle('projects:create', async (_e, { name, customPath }) => {
    return projectManager.createProject(name, customPath);
  });

  ipcMain.handle('projects:getFiles', async (_e, projectId: string) => {
    return projectManager.getProjectFiles(projectId);
  });

  ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
    return projectManager.readFile(filePath);
  });

  ipcMain.handle('fs:writeFile', async (_e, { filePath, content }) => {
    return projectManager.writeFile(filePath, content);
  });

  // --- Terminal ---
  ipcMain.handle('terminal:create', async (_e, { tabId, cwd }) => {
    terminalManager.createSession(tabId, cwd);
  });

  ipcMain.handle('terminal:input', async (_e, { tabId, data }) => {
    terminalManager.sendInput(tabId, data);
  });

  ipcMain.handle('terminal:resize', async (_e, { tabId, cols, rows }) => {
    terminalManager.resize(tabId, cols, rows);
  });

  ipcMain.handle('terminal:close', async (_e, tabId: string) => {
    terminalManager.closeSession(tabId);
  });

  // --- Browser ---
  ipcMain.handle('browser:navigate', async (_e, url: string) => {
    await browserManager.navigate(url);
  });

  ipcMain.handle('browser:goBack', async () => {
    await browserManager.goBack();
  });

  ipcMain.handle('browser:goForward', async () => {
    await browserManager.goForward();
  });

  ipcMain.handle('browser:reload', async () => {
    await browserManager.reload();
  });

  ipcMain.handle('browser:getSnapshot', async () => {
    return browserManager.getSnapshot();
  });

  // --- MCP ---
  ipcMain.handle('mcp:getServers', async () => {
    return mcpManager.getServers();
  });

  ipcMain.handle('mcp:saveServer', async (_e, server: MCPServerConfig) => {
    await mcpManager.saveServer(server);
  });

  ipcMain.handle('mcp:deleteServer', async (_e, serverId: string) => {
    await mcpManager.deleteServer(serverId);
  });

  ipcMain.handle('mcp:testServer', async (_e, serverId: string) => {
    const servers = await mcpManager.getServers();
    const target = servers.find(s => s.id === serverId);
    if (!target) return { success: false, toolsCount: 0, error: 'Server not found' };
    return mcpManager.connectServer(target);
  });

  // --- Memory & Settings ---
  ipcMain.handle('memory:getAll', async (_e, projectId?: string) => {
    return db.getMemories(projectId);
  });

  ipcMain.handle('memory:save', async (_e, memory) => {
    const full = {
      id: memory.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content: memory.content || '',
      tags: memory.tags || [],
      projectId: memory.projectId,
      createdAt: memory.createdAt || Date.now(),
      updatedAt: Date.now(),
      isEnabled: memory.isEnabled !== undefined ? memory.isEnabled : true
    };
    db.saveMemory(full);
    return full;
  });

  ipcMain.handle('memory:delete', async (_e, id: string) => {
    db.deleteMemory(id);
  });

  ipcMain.handle('settings:get', async () => {
    return db.getSettings();
  });

  ipcMain.handle('settings:save', async (_e, newSettings: Partial<AppSettings>) => {
    return db.saveSettings(newSettings);
  });

  ipcMain.handle('app:getPaths', async () => {
    return paths.getPaths();
  });

  ipcMain.handle('app:showInFolder', async (_e, itemPath: string) => {
    shell.showItemInFolder(itemPath);
  });
}
