import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();
  const address = await app.listen({ port: 3000, host: '127.0.0.1' });
  console.log(`MD Viewer running at ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
