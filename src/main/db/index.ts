import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { AppPaths } from './paths';
import {
  ChatSession,
  ChatMessage,
  Artifact,
  Project,
  MemoryItem,
  AppSettings,
  MCPServerConfig
} from '../../shared/types';

export class DatabaseService {
  private db: SqlJsDatabase | null = null;
  private paths: AppPaths;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(paths: AppPaths) {
    this.paths = paths;
  }

  public async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    const dbPath = this.paths.dbPath;

    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Error loading existing SQLite database, creating fresh:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.saveToDiskSync();
  }

  private runMigrations(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        project_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_archived INTEGER DEFAULT 0,
        system_prompt TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        blocks_json TEXT,
        model TEXT,
        provider TEXT,
        tokens_json TEXT,
        cost_usd REAL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        parent_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        message_id TEXT,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        language TEXT,
        version INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        instructions TEXT,
        knowledge_files_json TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags_json TEXT,
        project_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        is_enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        enabled INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);
  }

  public saveToDisk(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToDiskSync();
    }, 300);
  }

  public saveToDiskSync(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.mkdirSync(path.dirname(this.paths.dbPath), { recursive: true });
      fs.writeFileSync(this.paths.dbPath, buffer);
    } catch (err) {
      console.error('Failed to write database to disk:', err);
    }
  }

  // --- Sessions ---
  public getSessions(): ChatSession[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE is_archived = 0 ORDER BY updated_at DESC');
    const sessions: ChatSession[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      sessions.push({
        id: row.id,
        title: row.title,
        provider: row.provider,
        model: row.model,
        projectId: row.project_id || undefined,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        isArchived: Boolean(row.is_archived),
        systemPrompt: row.system_prompt || undefined
      });
    }
    stmt.free();
    return sessions;
  }

  public getSession(id: string): ChatSession | null {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = :id');
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        title: row.title,
        provider: row.provider,
        model: row.model,
        projectId: row.project_id || undefined,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
        isArchived: Boolean(row.is_archived),
        systemPrompt: row.system_prompt || undefined
      };
    }
    stmt.free();
    return null;
  }

  public saveSession(session: ChatSession): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, provider, model, project_id, created_at, updated_at, is_archived, system_prompt)
      VALUES (:id, :title, :provider, :model, :projectId, :createdAt, :updatedAt, :isArchived, :systemPrompt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        provider = excluded.provider,
        model = excluded.model,
        project_id = excluded.project_id,
        updated_at = excluded.updated_at,
        is_archived = excluded.is_archived,
        system_prompt = excluded.system_prompt
    `);
    stmt.run({
      ':id': session.id,
      ':title': session.title,
      ':provider': session.provider,
      ':model': session.model,
      ':projectId': session.projectId || null,
      ':createdAt': session.createdAt,
      ':updatedAt': session.updatedAt,
      ':isArchived': session.isArchived ? 1 : 0,
      ':systemPrompt': session.systemPrompt || null
    });
    stmt.free();
    this.saveToDisk();
  }

  public deleteSession(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM sessions WHERE id = :id', { ':id': id });
    this.db.run('DELETE FROM messages WHERE chat_id = :id', { ':id': id });
    this.db.run('DELETE FROM artifacts WHERE chat_id = :id', { ':id': id });
    this.saveToDisk();
  }

  // --- Messages ---
  public getMessages(chatId: string): ChatMessage[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM messages WHERE chat_id = :chatId ORDER BY created_at ASC');
    stmt.bind({ ':chatId': chatId });
    const messages: ChatMessage[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      messages.push({
        id: row.id,
        chatId: row.chat_id,
        role: row.role,
        content: row.content,
        blocks: row.blocks_json ? JSON.parse(row.blocks_json) : undefined,
        model: row.model || undefined,
        provider: row.provider || undefined,
        tokens: row.tokens_json ? JSON.parse(row.tokens_json) : undefined,
        costUsd: row.cost_usd ? Number(row.cost_usd) : undefined,
        createdAt: Number(row.created_at),
        updatedAt: row.updated_at ? Number(row.updated_at) : undefined,
        parentId: row.parent_id || undefined
      });
    }
    stmt.free();
    return messages;
  }

  public saveMessage(message: ChatMessage): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, chat_id, role, content, blocks_json, model, provider, tokens_json, cost_usd, created_at, updated_at, parent_id)
      VALUES (:id, :chatId, :role, :content, :blocksJson, :model, :provider, :tokensJson, :costUsd, :createdAt, :updatedAt, :parentId)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        blocks_json = excluded.blocks_json,
        model = excluded.model,
        provider = excluded.provider,
        tokens_json = excluded.tokens_json,
        cost_usd = excluded.cost_usd,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      ':id': message.id,
      ':chatId': message.chatId,
      ':role': message.role,
      ':content': message.content || '',
      ':blocksJson': message.blocks ? JSON.stringify(message.blocks) : null,
      ':model': message.model || null,
      ':provider': message.provider || null,
      ':tokensJson': message.tokens ? JSON.stringify(message.tokens) : null,
      ':costUsd': message.costUsd || null,
      ':createdAt': message.createdAt,
      ':updatedAt': message.updatedAt || Date.now(),
      ':parentId': message.parentId || null
    });
    stmt.free();
    this.saveToDisk();
  }

  public search(query: string): { chatId: string; title: string; snippet: string; messageId: string }[] {
    if (!this.db || !query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    const stmt = this.db.prepare(`
      SELECT m.id as message_id, m.chat_id, m.content, s.title
      FROM messages m
      JOIN sessions s ON s.id = m.chat_id
      WHERE LOWER(m.content) LIKE :queryPattern
      ORDER BY m.created_at DESC
      LIMIT 30
    `);
    stmt.bind({ ':queryPattern': `%${lowerQuery}%` });
    const results: { chatId: string; title: string; snippet: string; messageId: string }[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const content = String(row.content);
      const idx = content.toLowerCase().indexOf(lowerQuery);
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + query.length + 60);
      const snippet = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');

      results.push({
        chatId: row.chat_id,
        title: row.title,
        snippet,
        messageId: row.message_id
      });
    }
    stmt.free();
    return results;
  }

  // --- Artifacts ---
  public getArtifacts(chatId?: string): Artifact[] {
    if (!this.db) return [];
    const query = chatId
      ? 'SELECT * FROM artifacts WHERE chat_id = :chatId ORDER BY updated_at DESC'
      : 'SELECT * FROM artifacts ORDER BY updated_at DESC';
    const stmt = this.db.prepare(query);
    if (chatId) stmt.bind({ ':chatId': chatId });
    const artifacts: Artifact[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      artifacts.push({
        id: row.id,
        chatId: row.chat_id,
        messageId: row.message_id || undefined,
        title: row.title,
        type: row.type,
        content: row.content,
        language: row.language || undefined,
        version: Number(row.version),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at)
      });
    }
    stmt.free();
    return artifacts;
  }

  public saveArtifact(artifact: Artifact): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (id, chat_id, message_id, title, type, content, language, version, created_at, updated_at)
      VALUES (:id, :chatId, :messageId, :title, :type, :content, :language, :version, :createdAt, :updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        type = excluded.type,
        content = excluded.content,
        language = excluded.language,
        version = excluded.version,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      ':id': artifact.id,
      ':chatId': artifact.chatId,
      ':messageId': artifact.messageId || null,
      ':title': artifact.title,
      ':type': artifact.type,
      ':content': artifact.content,
      ':language': artifact.language || null,
      ':version': artifact.version,
      ':createdAt': artifact.createdAt,
      ':updatedAt': artifact.updatedAt
    });
    stmt.free();
    this.saveToDisk();
  }

  // --- Projects ---
  public getProjects(): Project[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    const projects: Project[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      projects.push({
        id: row.id,
        name: row.name,
        path: row.path,
        instructions: row.instructions || undefined,
        knowledgeFiles: row.knowledge_files_json ? JSON.parse(row.knowledge_files_json) : [],
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at)
      });
    }
    stmt.free();
    return projects;
  }

  public saveProject(project: Project): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, instructions, knowledge_files_json, created_at, updated_at)
      VALUES (:id, :name, :path, :instructions, :knowledgeFilesJson, :createdAt, :updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        instructions = excluded.instructions,
        knowledge_files_json = excluded.knowledge_files_json,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      ':id': project.id,
      ':name': project.name,
      ':path': project.path,
      ':instructions': project.instructions || null,
      ':knowledgeFilesJson': project.knowledgeFiles ? JSON.stringify(project.knowledgeFiles) : '[]',
      ':createdAt': project.createdAt,
      ':updatedAt': project.updatedAt
    });
    stmt.free();
    this.saveToDisk();
  }

  // --- Memories ---
  public getMemories(projectId?: string): MemoryItem[] {
    if (!this.db) return [];
    const query = projectId
      ? 'SELECT * FROM memories WHERE is_enabled = 1 AND (project_id = :projectId OR project_id IS NULL) ORDER BY created_at DESC'
      : 'SELECT * FROM memories WHERE is_enabled = 1 ORDER BY created_at DESC';
    const stmt = this.db.prepare(query);
    if (projectId) stmt.bind({ ':projectId': projectId });
    const items: MemoryItem[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      items.push({
        id: row.id,
        content: row.content,
        tags: row.tags_json ? JSON.parse(row.tags_json) : [],
        projectId: row.project_id || undefined,
        createdAt: Number(row.created_at),
        updatedAt: row.updated_at ? Number(row.updated_at) : undefined,
        isEnabled: Boolean(row.is_enabled)
      });
    }
    stmt.free();
    return items;
  }

  public saveMemory(memory: MemoryItem): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, content, tags_json, project_id, created_at, updated_at, is_enabled)
      VALUES (:id, :content, :tagsJson, :projectId, :createdAt, :updatedAt, :isEnabled)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        tags_json = excluded.tags_json,
        project_id = excluded.project_id,
        updated_at = excluded.updated_at,
        is_enabled = excluded.is_enabled
    `);
    stmt.run({
      ':id': memory.id,
      ':content': memory.content,
      ':tagsJson': memory.tags ? JSON.stringify(memory.tags) : '[]',
      ':projectId': memory.projectId || null,
      ':createdAt': memory.createdAt,
      ':updatedAt': memory.updatedAt || Date.now(),
      ':isEnabled': memory.isEnabled ? 1 : 0
    });
    stmt.free();
    this.saveToDisk();
  }

  public deleteMemory(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM memories WHERE id = :id', { ':id': id });
    this.saveToDisk();
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    const defaults: AppSettings = {
      theme: 'system',
      permissionMode: 'ask_every_time',
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-7-sonnet-20250219',
      workspacePath: this.paths.baseDir,
      enableMemory: true,
      autoCompactContext: true,
      telemetryEnabled: false
    };

    if (!this.db) return defaults;
    const stmt = this.db.prepare('SELECT value_json FROM settings WHERE key = "app_settings"');
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      try {
        return { ...defaults, ...JSON.parse(row.value_json) };
      } catch {
        return defaults;
      }
    }
    stmt.free();
    return defaults;
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO settings (key, value_json) VALUES ("app_settings", :val)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
      `);
      stmt.run({ ':val': JSON.stringify(updated) });
      stmt.free();
      this.saveToDisk();
    }
    return updated;
  }

  // --- MCP Servers ---
  public getMCPServers(): MCPServerConfig[] {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM mcp_servers');
    const servers: MCPServerConfig[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      try {
        const config = JSON.parse(row.config_json);
        servers.push({
          ...config,
          id: row.id,
          name: row.name,
          enabled: Boolean(row.enabled)
        });
      } catch (e) {
        console.error('Failed to parse MCP server config:', e);
      }
    }
    stmt.free();
    return servers;
  }

  public saveMCPServer(server: MCPServerConfig): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO mcp_servers (id, name, config_json, enabled)
      VALUES (:id, :name, :configJson, :enabled)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        config_json = excluded.config_json,
        enabled = excluded.enabled
    `);
    stmt.run({
      ':id': server.id,
      ':name': server.name,
      ':configJson': JSON.stringify(server),
      ':enabled': server.enabled ? 1 : 0
    });
    stmt.free();
    this.saveToDisk();
  }

  public deleteMCPServer(id: string): void {
    if (!this.db) return;
    this.db.run('DELETE FROM mcp_servers WHERE id = :id', { ':id': id });
    this.saveToDisk();
  }
}
