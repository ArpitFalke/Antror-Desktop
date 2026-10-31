import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import path from 'path';
import { BrowserWindow } from 'electron';

export interface TerminalSessionState {
  id: string;
  cwd: string;
  process: ChildProcessWithoutNullStreams;
}

export class TerminalManager {
  private sessions: Map<string, TerminalSessionState> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  public createSession(tabId: string, customCwd?: string): void {
    if (this.sessions.has(tabId)) return;

    const cwd = customCwd || os.homedir();
    const shell = this.getDefaultShell();

    const proc = spawn(shell, [], {
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    proc.stdout.on('data', (data: Buffer) => {
      this.sendDataToRenderer(tabId, data.toString('utf-8'));
    });

    proc.stderr.on('data', (data: Buffer) => {
      this.sendDataToRenderer(tabId, data.toString('utf-8'));
    });

    proc.on('close', () => {
      this.sessions.delete(tabId);
    });

    this.sessions.set(tabId, {
      id: tabId,
      cwd,
      process: proc
    });
  }

  private sendDataToRenderer(tabId: string, data: string): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`terminal:data:${tabId}`, data);
    }
  }

  public sendInput(tabId: string, data: string): void {
    const session = this.sessions.get(tabId);
    if (session && session.process.stdin.writable) {
      session.process.stdin.write(data);
    }
  }

  public resize(tabId: string, cols: number, rows: number): void {
    // If using pty, can call resize. With raw child_process, columns environment can be refreshed.
  }

  public closeSession(tabId: string): void {
    const session = this.sessions.get(tabId);
    if (session) {
      session.process.kill();
      this.sessions.delete(tabId);
    }
  }

  public closeAll(): void {
    for (const [id, session] of this.sessions.entries()) {
      try {
        session.process.kill();
      } catch {}
    }
    this.sessions.clear();
  }
}
