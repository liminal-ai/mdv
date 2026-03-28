import { context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watchMode = process.argv.includes('--watch');
const outputDir = 'dist/client';

async function syncStaticAssets(): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await cp('src/client/index.html', `${outputDir}/index.html`);
  await rm(`${outputDir}/styles`, { recursive: true, force: true });
  await mkdir(`${outputDir}/styles`, { recursive: true });
  await cp('src/client/styles/.', `${outputDir}/styles`, { recursive: true });
  await rm(`${outputDir}/assets/icon`, { recursive: true, force: true });
  await mkdir(`${outputDir}/assets/icon`, { recursive: true });
  await cp('assets/icon/.', `${outputDir}/assets/icon`, { recursive: true });
}

const clientContext = await context({
  entryPoints: ['src/client/app.ts'],
  outdir: outputDir,
  platform: 'browser',
  format: 'esm',
  bundle: true,
  splitting: true,
  plugins: [
    {
      name: 'sync-client-static-assets',
      setup(build) {
        build.onStart(async () => {
          if (!watchMode) {
            await rm(outputDir, { recursive: true, force: true });
          }
          await mkdir(outputDir, { recursive: true });
        });

        build.onEnd(async (result) => {
          if (result.errors.length === 0) {
            await syncStaticAssets();
          }
        });
      },
    },
  ],
});

if (watchMode) {
  await clientContext.watch();
  await clientContext.rebuild();
  await new Promise(() => {});
} else {
  await clientContext.rebuild();
  await clientContext.dispose();
}
