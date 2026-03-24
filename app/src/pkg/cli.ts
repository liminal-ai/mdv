#!/usr/bin/env node
import { Command } from 'commander';

import {
  PackageError,
  createPackage,
  extractPackage,
  getManifest,
  inspectPackage,
  listPackage,
  readDocument,
} from './index.js';

const program = new Command();

async function handlePackageError(commandName: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof PackageError) {
      process.stderr.write(`${commandName}: ${error.message}\n`);
      process.exit(1);
    }

    throw error;
  }
}

program.name('mdvpkg').description('Markdown package format CLI').version('0.1.0');

program
  .command('create')
  .argument('<sourceDir>')
  .description('Create a markdown package from a source directory')
  .requiredOption('-o, --output <outputPath>', 'Output package path')
  .option('--compress', 'Compress output as gzip')
  .action((sourceDir: string, options: { output: string; compress?: boolean }) => {
    return handlePackageError('create', async () => {
      await createPackage({
        sourceDir,
        outputPath: options.output,
        compress: options.compress,
      });
      console.log(`Created ${options.output}`);
    });
  });

program
  .command('extract')
  .argument('<packagePath>')
  .description('Extract a markdown package to a directory')
  .requiredOption('-o, --output <outputDir>', 'Output directory')
  .action((packagePath: string, options: { output: string }) => {
    return handlePackageError('extract', async () => {
      await extractPackage({ packagePath, outputDir: options.output });
      console.log(`Extracted to ${options.output}`);
    });
  });

program
  .command('info')
  .argument('<packagePath>')
  .description('Inspect package metadata')
  .action((packagePath: string) => {
    return handlePackageError('info', async () => {
      const result = await inspectPackage({ packagePath });
      const lines = [
        result.metadata.title ? `Title: ${result.metadata.title}` : undefined,
        result.metadata.version ? `Version: ${result.metadata.version}` : undefined,
        result.metadata.description ? `Description: ${result.metadata.description}` : undefined,
        `Format: ${result.format}`,
        `Files: ${result.files.length}`,
      ].filter((line): line is string => line !== undefined);

      console.log(lines.join('\n'));
    });
  });

program
  .command('ls')
  .argument('<packagePath>')
  .description('List package files')
  .action((packagePath: string) => {
    return handlePackageError('ls', async () => {
      const files = await listPackage({ packagePath });
      console.log(files.map((file) => `${file.path}  ${file.size}`).join('\n'));
    });
  });

program
  .command('read')
  .argument('<packagePath>')
  .description('Read a document from a package')
  .option('--file <filePath>', 'Read by file path')
  .option('--name <displayName>', 'Read by manifest display name')
  .action((packagePath: string, options: { file?: string; name?: string }) => {
    if (options.file && options.name) {
      process.stderr.write('read: provide --file or --name, not both\n');
      process.exit(1);
    }

    if (!options.file && !options.name) {
      process.stderr.write('read: --file or --name is required\n');
      process.exit(1);
    }

    return handlePackageError('read', async () => {
      const target = options.file ? { filePath: options.file } : { displayName: options.name! };
      const result = await readDocument({ packagePath, target });
      process.stdout.write(result.content);
    });
  });

program
  .command('manifest')
  .argument('<packagePath>')
  .description('Print the package manifest')
  .action((packagePath: string) => {
    return handlePackageError('manifest', async () => {
      const result = await getManifest({ packagePath });
      process.stdout.write(result.content);
    });
  });

program.parse();
