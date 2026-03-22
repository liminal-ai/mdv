import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist/client', { recursive: true, force: true });
await mkdir('dist/client', { recursive: true });

await build({
  entryPoints: ['src/client/app.ts'],
  outdir: 'dist/client',
  platform: 'browser',
  format: 'esm',
  bundle: true,
  splitting: true,
});

await cp('src/client/index.html', 'dist/client/index.html');
await cp('src/client/styles', 'dist/client/styles', { recursive: true });
await cp('assets/icon', 'dist/client/assets/icon', { recursive: true });
