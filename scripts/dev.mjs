import { createServer } from 'vite';
import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

fs.mkdirSync(path.resolve(root, 'dist/main'), { recursive: true });
fs.mkdirSync(path.resolve(root, 'dist/preload'), { recursive: true });

async function startDev() {
  console.log('Starting Vite dev server...');
  const viteServer = await createServer({
    configFile: path.resolve(root, 'vite.config.ts'),
    server: { port: 5173 }
  });
  await viteServer.listen();
  console.log('Vite dev server running on http://localhost:5173');

  // Build main and preload
  await esbuild.build({
    entryPoints: [path.resolve(root, 'src/main/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist/main/index.cjs'),
    external: ['electron'],
    sourcemap: true,
    format: 'cjs',
    define: {
      'process.env.NODE_ENV': '"development"'
    }
  });

  await esbuild.build({
    entryPoints: [path.resolve(root, 'src/main/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: path.resolve(root, 'dist/preload/index.cjs'),
    external: ['electron'],
    sourcemap: true,
    format: 'cjs'
  });

  console.log('Starting Electron...');
  const electronBinary = process.platform === 'win32'
    ? path.resolve(root, 'node_modules/electron/dist/electron.exe')
    : path.resolve(root, 'node_modules/.bin/electron');

  const electronProcess = spawn(electronBinary, [root], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: 'http://localhost:5173'
    },
    stdio: 'inherit'
  });

  electronProcess.on('close', () => {
    viteServer.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('Dev error:', err);
  process.exit(1);
});
