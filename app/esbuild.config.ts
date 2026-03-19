import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist/client', { recursive: true, force: true });
await mkdir('dist/client', { recursive: true });

await build({
  entryPoints: ['src/client/app.ts'],
  outfile: 'dist/client/app.js',
  platform: 'browser',
  format: 'esm',
  bundle: true,
});

await cp('src/client/index.html', 'dist/client/index.html');
await cp('src/client/styles', 'dist/client/styles', { recursive: true });
