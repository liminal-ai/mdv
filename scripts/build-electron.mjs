import { context } from 'esbuild';
import { rm } from 'node:fs/promises';

const watchMode = process.argv.includes('--watch');

await rm('dist/electron', { recursive: true, force: true });

const contexts = await Promise.all([
  context({
    entryPoints: ['src/electron/main.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'dist/electron/main.js',
    external: ['electron', 'electron-window-state'],
  }),
  context({
    entryPoints: ['src/electron/preload.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'dist/electron/preload.cjs',
    external: ['electron'],
  }),
]);

if (watchMode) {
  await Promise.all(contexts.map((entry) => entry.watch()));
  await Promise.all(contexts.map((entry) => entry.rebuild()));
  await new Promise(() => {});
} else {
  await Promise.all(contexts.map((entry) => entry.rebuild()));
  await Promise.all(contexts.map((entry) => entry.dispose()));
}
