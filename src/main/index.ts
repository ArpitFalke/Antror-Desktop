import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, dialog } from 'electron';
import path from 'path';
import { AppPaths } from './db/paths';
import { DatabaseService } from './db';
import { KeychainService } from './security/keychain';
import { ProviderManager } from './providers/manager';
import { ToolEngine } from './tools';
import { PermissionEngine } from './permissions/engine';
import { RunManager } from './runs/manager';
import { ProjectManager } from './projects/manager';
import { TerminalManager } from './terminal/manager';
import { BrowserManager } from './browser/manager';
import { MCPManager } from './mcp/client';
import { registerIpcHandlers } from './ipc/register';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let runManager: RunManager | null = null;

async function createWindow() {
  const paths = new AppPaths();
  const keychain = new KeychainService(paths.configDir);
  const db = new DatabaseService(paths);
  await db.initialize();

  const permissionEngine = new PermissionEngine('ask_every_time');
  const providerManager = new ProviderManager(keychain, db);
  const terminalManager = new TerminalManager();
  const browserManager = new BrowserManager();
  const mcpManager = new MCPManager(db);
  const projectManager = new ProjectManager(paths, db);

  const toolEngine = new ToolEngine(db, terminalManager, browserManager);
  runManager = new RunManager(db, providerManager, toolEngine, permissionEngine);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Antror Desktop',
    backgroundColor: '#141413',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  runManager.setMainWindow(mainWindow);
  terminalManager.setMainWindow(mainWindow);
  browserManager.setMainWindow(mainWindow);

  registerIpcHandlers(
    db,
    keychain,
    providerManager,
    runManager,
    projectManager,
    terminalManager,
    browserManager,
    mcpManager,
    paths
  );

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    terminalManager.closeAll();
  });
}

// App quitting protection
app.on('before-quit', (e) => {
  if (runManager) {
    const active = runManager.getActiveRuns();
    if (active.length > 0) {
      const choice = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['Quit Anyway', 'Keep Running'],
        defaultId: 1,
        title: 'Runs in Progress',
        message: `There are ${active.length} active agent run(s) executing in the background. Are you sure you want to quit?`
      });
      if (choice === 1) {
        e.preventDefault();
        return;
      }
    }
  }
});

app.whenReady().then(async () => {
  await createWindow();

  // Global Quick Entry Hotkey
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
