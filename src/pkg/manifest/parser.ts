import MarkdownIt from 'markdown-it';
// @ts-expect-error -- js-yaml is available at runtime in this repo, but typings are not installed.
import yaml from 'js-yaml';

import { PackageError, PackageErrorCode } from '../errors.js';
import type { ManifestMetadata, NavigationNode, ParsedManifest } from '../types.js';

const markdown = new MarkdownIt();
type MarkdownToken = ReturnType<MarkdownIt['parse']>[number];

const METADATA_KEYS = [
  'title',
  'version',
  'author',
  'description',
  'type',
  'status',
] as const satisfies ReadonlyArray<keyof ManifestMetadata>;

export function parseManifest(content: string): ParsedManifest {
  const { metadata, body } = extractFrontmatter(content);

  if (body.trim().length === 0) {
    return {
      metadata,
      navigation: [],
      raw: content,
    };
  }

  const tokens = markdown.parse(body, {});
  const hasListItems = tokens.some((token) => token.type === 'list_item_open');

  if (!hasListItems) {
    throw new PackageError(
      PackageErrorCode.MANIFEST_PARSE_ERROR,
      'Manifest body must contain at least one list item.',
    );
  }

  const navigation = parseTopLevelNavigation(tokens);

  return {
    metadata,
    navigation,
    raw: content,
  };
}

function extractFrontmatter(content: string): { metadata: ManifestMetadata; body: string } {
  if (!content.startsWith('---\n')) {
    return {
      metadata: {},
      body: content,
    };
  }

  const match = /^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/.exec(content);

  if (!match) {
    return {
      metadata: {},
      body: content,
    };
  }

  const [, frontmatter, body = ''] = match;

  try {
    const parsed = yaml.load(frontmatter);
    return {
      metadata: normalizeMetadata(parsed),
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown YAML parse error';
    throw new PackageError(
      PackageErrorCode.MANIFEST_PARSE_ERROR,
      `Failed to parse manifest frontmatter: ${message}`,
    );
  }
}

function normalizeMetadata(parsed: unknown): ManifestMetadata {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const source = parsed as Record<string, unknown>;
  const metadata: ManifestMetadata = {};

  for (const key of METADATA_KEYS) {
    const value = source[key];
    if (value === undefined || value === null) {
      continue;
    }

    metadata[key] = String(value);
  }

  return metadata;
}

function parseTopLevelNavigation(tokens: MarkdownToken[]): NavigationNode[] {
  const navigation: NavigationNode[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (isListOpen(token)) {
      const parsed = parseList(tokens, index);
      navigation.push(...parsed.nodes);
      index = parsed.nextIndex;
      continue;
    }

    index += 1;
  }

  return navigation;
}

function parseList(
  tokens: MarkdownToken[],
  startIndex: number,
): { nodes: NavigationNode[]; nextIndex: number } {
  const listType = tokens[startIndex]?.type;
  const closeType = listType === 'ordered_list_open' ? 'ordered_list_close' : 'bullet_list_close';
  const nodes: NavigationNode[] = [];
  let index = startIndex + 1;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === closeType) {
      return {
        nodes,
        nextIndex: index + 1,
      };
    }

    if (token.type === 'list_item_open') {
      const parsed = parseListItem(tokens, index);
      nodes.push(parsed.node);
      index = parsed.nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    nodes,
    nextIndex: index,
  };
}

function parseListItem(
  tokens: MarkdownToken[],
  startIndex: number,
): { node: NavigationNode; nextIndex: number } {
  let displayName = '';
  let filePath: string | undefined;
  let children: NavigationNode[] = [];
  let index = startIndex + 1;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === 'list_item_close') {
      return {
        node: {
          displayName,
          filePath,
          children,
          isGroup: filePath === undefined,
        },
        nextIndex: index + 1,
      };
    }

    if (token.type === 'inline' && displayName.length === 0) {
      const parsed = parseInlineNode(token);
      displayName = parsed.displayName;
      filePath = parsed.filePath;
    } else if (isListOpen(token)) {
      const parsed = parseList(tokens, index);
      children = children.concat(parsed.nodes);
      index = parsed.nextIndex;
      continue;
    }

    index += 1;
  }

  return {
    node: {
      displayName,
      filePath,
      children,
      isGroup: filePath === undefined,
    },
    nextIndex: index,
  };
}

function parseInlineNode(token: MarkdownToken): { displayName: string; filePath?: string } {
  const children = token.children ?? [];
  let linkStart = -1;
  let linkEnd = -1;
  let href = '';

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (child.type !== 'link_open') {
      continue;
    }

    linkStart = index;
    href = decodeURIComponent(child.attrGet('href') ?? '');

    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      if (children[cursor]?.type === 'link_close') {
        linkEnd = cursor;
        break;
      }
    }

    break;
  }

  if (linkStart >= 0 && linkEnd > linkStart) {
    const displayName = stringifyInlineText(children.slice(linkStart + 1, linkEnd));
    return href.length > 0 ? { displayName, filePath: href } : { displayName };
  }

  return {
    displayName: stringifyInlineText(children),
  };
}

function stringifyInlineText(tokens: MarkdownToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'softbreak' || token.type === 'hardbreak') {
        return ' ';
      }

      if (
        token.type === 'text' ||
        token.type === 'code_inline' ||
        token.type === 'html_inline' ||
        token.type === 'image'
      ) {
        return token.content;
      }

      return '';
    })
    .join('')
    .trim();
}

function isListOpen(token: MarkdownToken | undefined): boolean {
  return token?.type === 'bullet_list_open' || token?.type === 'ordered_list_open';
}
