import { PackageError, PackageErrorCode } from '../errors.js';
import type { NavigationNode, ReadOptions, ReadResult } from '../types.js';
import { MANIFEST_FILENAME } from '../types.js';
import { parseManifest } from '../manifest/parser.js';
import { drainEntry, readEntryContent, scanPackage } from './shared.js';

function findMatchingNavigationNodes(
  navigation: NavigationNode[],
  displayName: string,
): Array<{ displayName: string; filePath: string }> {
  const matches: Array<{ displayName: string; filePath: string }> = [];

  for (const node of navigation) {
    if (!node.isGroup && node.filePath && node.displayName === displayName) {
      matches.push({ displayName: node.displayName, filePath: node.filePath });
    }

    matches.push(...findMatchingNavigationNodes(node.children, displayName));
  }

  return matches;
}

async function readFileFromPackage(
  packagePath: string,
  filePath: string,
): Promise<string | undefined> {
  let content: string | undefined;

  await scanPackage(packagePath, async (header, stream) => {
    if (header.name !== filePath) {
      await drainEntry(stream);
      return;
    }

    content = (await readEntryContent(stream)).toString('utf8');
  });

  return content;
}

async function readManifestFromPackage(packagePath: string): Promise<string | undefined> {
  let manifestContent: string | undefined;

  await scanPackage(packagePath, async (header, stream) => {
    if (header.name !== MANIFEST_FILENAME) {
      await drainEntry(stream);
      return;
    }

    manifestContent = (await readEntryContent(stream)).toString('utf8');
  });

  return manifestContent;
}

export async function readDocument(options: ReadOptions): Promise<ReadResult> {
  if (!options?.packagePath || !options.target) {
    throw new TypeError('readDocument requires packagePath and target');
  }

  let filePath: string;

  if ('displayName' in options.target) {
    const manifestContent = await readManifestFromPackage(options.packagePath);

    if (manifestContent === undefined) {
      throw new PackageError(
        PackageErrorCode.FILE_NOT_FOUND,
        `No navigation entry matches display name: ${options.target.displayName}`,
        options.target.displayName,
      );
    }

    const parsed = parseManifest(manifestContent);
    const matches = findMatchingNavigationNodes(parsed.navigation, options.target.displayName);

    if (matches.length === 0) {
      throw new PackageError(
        PackageErrorCode.FILE_NOT_FOUND,
        `No navigation entry matches display name: ${options.target.displayName}`,
        options.target.displayName,
      );
    }

    if (matches.length > 1) {
      const conflicts = matches
        .map((match) => `${match.displayName} (${match.filePath})`)
        .join(', ');

      throw new PackageError(
        PackageErrorCode.AMBIGUOUS_DISPLAY_NAME,
        `Display name is ambiguous: ${options.target.displayName}. Matches: ${conflicts}`,
        options.target.displayName,
      );
    }

    filePath = matches[0]!.filePath;
  } else {
    filePath = options.target.filePath;
  }

  const content = await readFileFromPackage(options.packagePath, filePath);

  if (content === undefined) {
    throw new PackageError(
      PackageErrorCode.FILE_NOT_FOUND,
      `File not found in package: ${filePath}`,
      filePath,
    );
  }

  return {
    content,
    filePath,
  };
}
