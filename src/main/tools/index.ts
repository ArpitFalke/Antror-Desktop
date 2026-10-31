import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ToolDefinition } from '../../shared/types';
import { DatabaseService } from '../db';
import { TerminalManager } from '../terminal/manager';
import { BrowserManager } from '../browser/manager';

export class ToolEngine {
  private db: DatabaseService;
  private terminalManager?: TerminalManager;
  private browserManager?: BrowserManager;
  private subAgentRunner?: (prompt: string, role: string) => Promise<string>;

  constructor(
    db: DatabaseService,
    terminalManager?: TerminalManager,
    browserManager?: BrowserManager
  ) {
    this.db = db;
    this.terminalManager = terminalManager;
    this.browserManager = browserManager;
  }

  public setSubAgentRunner(runner: (prompt: string, role: string) => Promise<string>): void {
    this.subAgentRunner = runner;
  }

  public getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'file_read',
        description: 'Read the contents of a file at the specified path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The absolute or workspace-relative path of the file to read.' },
            limit: { type: 'number', description: 'Maximum lines or bytes to read.' }
          },
          required: ['path']
        }
      },
      {
        name: 'file_write',
        description: 'Write content to a file, creating parent directories if necessary.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'The destination file path.' },
            content: { type: 'string', description: 'The file text content to write.' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'file_edit',
        description: 'Edit a file by replacing an exact string target with replacement text.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to edit.' },
            target: { type: 'string', description: 'Exact string in the file to replace.' },
            replacement: { type: 'string', description: 'New string to insert in place of target.' }
          },
          required: ['path', 'target', 'replacement']
        }
      },
      {
        name: 'list_dir',
        description: 'List files and directories in a given path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list.' }
          },
          required: ['path']
        }
      },
      {
        name: 'grep_search',
        description: 'Search for text pattern across files in a directory.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term or regex pattern.' },
            cwd: { type: 'string', description: 'Directory to search within.' }
          },
          required: ['query']
        }
      },
      {
        name: 'terminal_execute',
        description: 'Execute a shell command with real device access.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command line to run.' },
            cwd: { type: 'string', description: 'Working directory.' },
            timeoutMs: { type: 'number', description: 'Timeout in milliseconds (default: 30000).' }
          },
          required: ['command']
        }
      },
      {
        name: 'web_fetch',
        description: 'Fetch URL contents (HTML or JSON) from the web.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch.' }
          },
          required: ['url']
        }
      },
      {
        name: 'web_search',
        description: 'Search the web for up-to-date information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keywords.' }
          },
          required: ['query']
        }
      },
      {
        name: 'memory_save',
        description: 'Save an important fact, preference, or project insight to persistent long-term memory.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Fact or user preference to remember.' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags or keywords.' }
          },
          required: ['content']
        }
      },
      {
        name: 'memory_recall',
        description: 'Recall long-term memories relevant to a query or project.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Memory query.' }
          }
        }
      },
      {
        name: 'browser_action',
        description: 'Drive the built-in browser (navigate, read page text, screenshot).',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['navigate', 'get_content', 'reload'], description: 'Action to perform.' },
            url: { type: 'string', description: 'URL when action is navigate.' }
          },
          required: ['action']
        }
      },
      {
        name: 'sub_agent',
        description: 'Launch an isolated sub-agent with a specialized role and prompt to solve a subtask.',
        parameters: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Sub-agent role title.' },
            prompt: { type: 'string', description: 'Task prompt for sub-agent.' }
          },
          required: ['role', 'prompt']
        }
      }
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, any>,
    context: { chatId: string; projectId?: string; defaultCwd?: string }
  ): Promise<string> {
    try {
      switch (name) {
        case 'file_read': {
          const filePath = path.resolve(context.defaultCwd || '.', args.path);
          if (!fs.existsSync(filePath)) {
            return `Error: File not found at ${filePath}`;
          }
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          if (args.limit && lines.length > args.limit) {
            return lines.slice(0, args.limit).join('\n') + `\n\n... (truncated ${lines.length - args.limit} lines)`;
          }
          return content;
        }

        case 'file_write': {
          const filePath = path.resolve(context.defaultCwd || '.', args.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, args.content, 'utf8');
          return `Successfully wrote ${args.content.length} characters to ${filePath}`;
        }

        case 'file_edit': {
          const filePath = path.resolve(context.defaultCwd || '.', args.path);
          if (!fs.existsSync(filePath)) {
            return `Error: File not found at ${filePath}`;
          }
          const content = fs.readFileSync(filePath, 'utf8');
          if (!content.includes(args.target)) {
            return `Error: Target string not found in ${filePath}. Check indentation and exact whitespace.`;
          }
          const newContent = content.split(args.target).join(args.replacement);
          fs.writeFileSync(filePath, newContent, 'utf8');
          return `Successfully replaced target in ${filePath}`;
        }

        case 'list_dir': {
          const dirPath = path.resolve(context.defaultCwd || '.', args.path || '.');
          if (!fs.existsSync(dirPath)) {
            return `Error: Directory not found at ${dirPath}`;
          }
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          const list = entries.map(e => `${e.isDirectory() ? '[DIR] ' : '[FILE]'} ${e.name}`);
          return list.join('\n');
        }

        case 'grep_search': {
          const dirPath = path.resolve(context.defaultCwd || '.', args.cwd || '.');
          const query = args.query.toLowerCase();
          const matches: string[] = [];

          function walk(dir: string, depth: number = 0) {
            if (depth > 5 || matches.length > 50) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
              if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
              const full = path.join(dir, e.name);
              if (e.isDirectory()) {
                walk(full, depth + 1);
              } else if (e.isFile()) {
                try {
                  const data = fs.readFileSync(full, 'utf8');
                  const lines = data.split('\n');
                  lines.forEach((l, i) => {
                    if (l.toLowerCase().includes(query) && matches.length < 50) {
                      matches.push(`${path.relative(dirPath, full)}:${i + 1}: ${l.trim()}`);
                    }
                  });
                } catch {}
              }
            }
          }

          walk(dirPath);
          return matches.length ? matches.join('\n') : `No matches found for "${args.query}"`;
        }

        case 'terminal_execute': {
          const cwd = path.resolve(context.defaultCwd || '.', args.cwd || '.');
          const command = args.command;
          const timeout = args.timeoutMs || 30000;

          return new Promise<string>((resolve) => {
            exec(command, { cwd, timeout, maxBuffer: 1024 * 1024 * 2 }, (error, stdout, stderr) => {
              let output = '';
              if (stdout) output += stdout;
              if (stderr) output += (output ? '\n' : '') + stderr;
              if (error) {
                resolve(`Command failed (code ${error.code || 1}):\n${output || error.message}`);
              } else {
                resolve(output || 'Command completed with exit code 0.');
              }
            });
          });
        }

        case 'web_fetch': {
          const res = await fetch(args.url, {
            headers: { 'User-Agent': 'AntrorDesktop/1.0' }
          });
          const text = await res.text();
          return text.slice(0, 100000);
        }

        case 'web_search': {
          // DuckDuckGo instant API or search query
          const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`;
          try {
            const res = await fetch(searchUrl);
            const data = await res.json() as any;
            let results = `Abstract: ${data.AbstractText || 'No direct abstract.'}\n\n`;
            if (data.RelatedTopics?.length) {
              results += 'Related Topics:\n';
              for (const item of data.RelatedTopics.slice(0, 5)) {
                if (item.Text) results += `- ${item.Text} (${item.FirstURL || ''})\n`;
              }
            }
            return results || `Searched web for "${args.query}".`;
          } catch (e: any) {
            return `Web search error: ${e.message}`;
          }
        }

        case 'memory_save': {
          this.db.saveMemory({
            id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            content: args.content,
            tags: args.tags || [],
            projectId: context.projectId,
            createdAt: Date.now(),
            isEnabled: true
          });
          return `Successfully saved memory: "${args.content}"`;
        }

        case 'memory_recall': {
          const memories = this.db.getMemories(context.projectId);
          if (args.query) {
            const q = args.query.toLowerCase();
            const filtered = memories.filter(m => m.content.toLowerCase().includes(q) || m.tags?.some(t => t.toLowerCase().includes(q)));
            return filtered.map(m => `- ${m.content}`).join('\n') || 'No matching memories found.';
          }
          return memories.map(m => `- ${m.content}`).join('\n') || 'No stored memories yet.';
        }

        case 'browser_action': {
          if (!this.browserManager) return 'Browser manager is not initialized.';
          if (args.action === 'navigate') {
            await this.browserManager.navigate(args.url);
            return `Navigated browser to ${args.url}`;
          } else if (args.action === 'get_content') {
            const snapshot = await this.browserManager.getSnapshot();
            return `Page Title: ${snapshot.title}\nURL: ${snapshot.url}\n\nContent:\n${snapshot.text.slice(0, 30000)}`;
          } else if (args.action === 'reload') {
            await this.browserManager.reload();
            return 'Browser reloaded.';
          }
          return `Unsupported action: ${args.action}`;
        }

        case 'sub_agent': {
          if (!this.subAgentRunner) {
            return 'Sub-agent runner is not configured.';
          }
          const response = await this.subAgentRunner(args.prompt, args.role);
          return response;
        }

        default:
          return `Error: Unknown tool "${name}"`;
      }
    } catch (err: any) {
      return `Tool execution error in ${name}: ${err.message}`;
    }
  }
}
