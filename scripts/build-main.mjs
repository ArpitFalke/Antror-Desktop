import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

fs.mkdirSync(path.resolve(root, 'dist/main'), { recursive: true });
fs.mkdirSync(path.resolve(root, 'dist/preload'), { recursive: true });

async function build() {
  console.log('Building main process and preload...');
  
  // Build main process
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
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }
  });

  // Build preload script
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

  console.log('Main and preload build complete.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
