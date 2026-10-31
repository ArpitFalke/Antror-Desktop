import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const outDir = path.resolve(root, 'dist/renderer');
const assetsDir = path.resolve(outDir, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

async function buildRenderer() {
  console.log('Building renderer process...');

  // 1. Compile Tailwind CSS
  console.log('Compiling Tailwind CSS with PostCSS...');
  const cssInputPath = path.resolve(root, 'src/renderer/src/index.css');
  const cssInput = fs.readFileSync(cssInputPath, 'utf-8');
  const postcssResult = await postcss([tailwindcss, autoprefixer]).process(cssInput, {
    from: cssInputPath,
    to: path.resolve(assetsDir, 'index.css')
  });
  fs.writeFileSync(path.resolve(assetsDir, 'index.css'), postcssResult.css);
  console.log('CSS compiled successfully.');

  // 2. Bundle JS with esbuild
  console.log('Bundling React client with esbuild...');
  await esbuild.build({
    entryPoints: [{ in: path.resolve(root, 'src/renderer/src/main.tsx'), out: 'main' }],
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    outdir: assetsDir,
    splitting: true,
    sourcemap: true,
    loader: {
      '.css': 'empty',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.svg': 'text'
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window'
    }
  });

  // 3. Generate production index.html
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Antror Desktop</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
    <link rel="stylesheet" href="./assets/index.css" />
  </head>
  <body class="bg-antror-900 text-antror-100 antialiased selection:bg-brand-500 selection:text-white overflow-hidden select-none">
    <div id="root" class="h-screen w-screen flex flex-col"></div>
    <script type="module" src="./assets/main.js"></script>
  </body>
</html>`;

  fs.writeFileSync(path.resolve(outDir, 'index.html'), htmlContent);
  console.log('Renderer build completed successfully.');
}

buildRenderer().catch(err => {
  console.error('Renderer build failed:', err);
  process.exit(1);
});
