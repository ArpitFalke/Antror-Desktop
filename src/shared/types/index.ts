export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ThinkingBlock {
  type: 'thinking';
  text: string;
  isCollapsed?: boolean;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  mimeType: string;
  data: string; // base64 or URL
  name?: string;
}

export interface ToolCallBlock {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, any>;
  argsRaw?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'denied';
  output?: string;
  error?: string;
  executionTimeMs?: number;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type MessageContentBlock =
  | ThinkingBlock
  | TextBlock
  | ImageBlock
  | ToolCallBlock
  | ToolResultBlock;

export interface ChatMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string; // Plain text or primary content
  blocks?: MessageContentBlock[];
  model?: string;
  provider?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  costUsd?: number;
  createdAt: number;
  updatedAt?: number;
  parentId?: string; // For branching
}

export interface ChatSession {
  id: string;
  title: string;
  provider: string;
  model: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
  systemPrompt?: string;
  tokenCount?: number;
}

export type LLMProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'fireworks'
  | 'perplexity'
  | 'cohere'
  | 'openrouter'
  | 'azure-openai'
  | 'bedrock'
  | 'vertex'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  supportsTools?: boolean;
}

export interface ProviderConfig {
  id: LLMProviderId;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  models: ModelInfo[];
  defaultModel?: string;
  authHeader?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface StreamParams {
  provider: LLMProviderId;
  model: string;
  messages: ChatMessage[];
  system?: string;
  tools?: ToolDefinition[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export type StreamChunk =
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; delta: string }
  | { type: 'tool_call_end'; id: string; name: string; args: Record<string, any> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number }
  | { type: 'done'; stopReason?: string }
  | { type: 'error'; error: string };

export type RunStatus = 'idle' | 'running' | 'paused_permission' | 'completed' | 'error' | 'stopped';

export interface ActiveRun {
  runId: string;
  chatId: string;
  provider: LLMProviderId;
  model: string;
  status: RunStatus;
  startedAt: number;
  currentAssistantMessageId?: string;
  pendingPermission?: PermissionRequest;
  error?: string;
}

export type PermissionMode = 'ask_every_time' | 'auto_approve_edits' | 'plan_mode' | 'full_auto';

export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PermissionRequest {
  id: string;
  runId: string;
  chatId: string;
  toolName: string;
  description: string;
  params: Record<string, any>;
  riskLevel: PermissionRiskLevel;
  timestamp: number;
}

export type PermissionDecision = 'allow_once' | 'allow_always_project' | 'deny';

export interface Artifact {
  id: string;
  chatId: string;
  messageId?: string;
  title: string;
  type: 'code' | 'html' | 'react' | 'svg' | 'mermaid' | 'markdown';
  content: string;
  language?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status?: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  tools?: ToolDefinition[];
}

export interface TerminalTab {
  id: string;
  title: string;
  cwd: string;
  shell: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  instructions?: string;
  knowledgeFiles?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemoryItem {
  id: string;
  content: string;
  tags?: string[];
  projectId?: string;
  createdAt: number;
  updatedAt?: number;
  isEnabled: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  permissionMode: PermissionMode;
  defaultProvider: LLMProviderId;
  defaultModel: string;
  workspacePath: string;
  enableMemory: boolean;
  autoCompactContext: boolean;
  telemetryEnabled: boolean;
}

export interface ElectronAPI {
  // Chat & DB
  getSessions: () => Promise<ChatSession[]>;
  createSession: (data: Partial<ChatSession>) => Promise<ChatSession>;
  getSession: (id: string) => Promise<ChatSession | null>;
  deleteSession: (id: string) => Promise<void>;
  getMessages: (chatId: string) => Promise<ChatMessage[]>;
  searchChats: (query: string) => Promise<{ chatId: string; title: string; snippet: string; messageId: string }[]>;
  
  // Runs / Agent
  startRun: (chatId: string, userMessage: { text: string; images?: string[]; parentId?: string }) => Promise<string>;
  stopRun: (chatId: string) => Promise<void>;
  getActiveRuns: () => Promise<ActiveRun[]>;
  onRunEvent: (callback: (event: { type: string; runId: string; chatId: string; payload: any }) => void) => () => void;
  respondPermission: (requestId: string, decision: PermissionDecision) => Promise<void>;

  // Providers & Keys
  getProviders: () => Promise<ProviderConfig[]>;
  saveProvider: (provider: ProviderConfig) => Promise<void>;
  testConnection: (providerId: LLMProviderId, apiKey?: string, baseUrl?: string) => Promise<{ success: boolean; message: string; models?: ModelInfo[] }>;
  fetchModels: (providerId: LLMProviderId) => Promise<ModelInfo[]>;

  // Artifacts
  getArtifacts: (chatId?: string) => Promise<Artifact[]>;
  saveArtifact: (artifact: Partial<Artifact>) => Promise<Artifact>;
  saveArtifactToProject: (artifactId: string, projectId: string, filename: string) => Promise<string>;

  // Projects
  getProjects: () => Promise<Project[]>;
  createProject: (name: string, customPath?: string) => Promise<Project>;
  getProjectFiles: (projectId: string) => Promise<any[]>;
  readFileContent: (filePath: string) => Promise<string>;
  writeFileContent: (filePath: string, content: string) => Promise<void>;

  // Terminal
  createTerminal: (tabId: string, cwd?: string) => Promise<void>;
  sendTerminalInput: (tabId: string, data: string) => Promise<void>;
  resizeTerminal: (tabId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (tabId: string) => Promise<void>;
  onTerminalData: (tabId: string, callback: (data: string) => void) => () => void;

  // Browser
  browserNavigate: (url: string) => Promise<void>;
  browserGoBack: () => Promise<void>;
  browserGoForward: () => Promise<void>;
  browserReload: () => Promise<void>;
  getBrowserSnapshot: () => Promise<{ url: string; title: string; text: string }>;

  // MCP
  getMCPServers: () => Promise<MCPServerConfig[]>;
  saveMCPServer: (server: MCPServerConfig) => Promise<void>;
  deleteMCPServer: (serverId: string) => Promise<void>;
  testMCPServer: (serverId: string) => Promise<{ success: boolean; toolsCount: number; error?: string }>;

  // Memory & Settings
  getMemories: (projectId?: string) => Promise<MemoryItem[]>;
  saveMemory: (memory: Partial<MemoryItem>) => Promise<MemoryItem>;
  deleteMemory: (id: string) => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getAppPaths: () => Promise<{ workspace: string; projects: string; logs: string; memory: string }>;
  showItemInFolder: (path: string) => Promise<void>;
}

declare global {
  interface Window {
    antrorAPI: ElectronAPI;
  }
}
