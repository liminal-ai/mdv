import { describe, expect, it } from 'vitest';

import { PackageError, PackageErrorCode } from '../../src/pkg/errors.js';
import { parseManifest } from '../../src/pkg/manifest/parser.js';
import {
  DEEP_MANIFEST,
  EMPTY_BODY_MANIFEST,
  EMPTY_LINK_MANIFEST,
  FLAT_MANIFEST,
  FULL_MANIFEST,
  GROUP_NO_CHILDREN,
  INVALID_YAML_MANIFEST,
  LARGE_MANIFEST,
  MINIMAL_MANIFEST,
  NESTED_MANIFEST,
  NON_MD_LINK_MANIFEST,
  NO_FRONTMATTER_MANIFEST,
  ORDERED_LIST_MANIFEST,
  PARAGRAPHS_BETWEEN_LISTS,
  PARAGRAPH_ONLY_MANIFEST,
  UNICODE_MANIFEST,
} from './fixtures/manifests.js';

describe('parseManifest', () => {
  it('TC-1.1a extracts all supported frontmatter fields', () => {
    const result = parseManifest(FULL_MANIFEST);

    expect(result.metadata.title).toBe('API Reference');
    expect(result.metadata.version).toBe('1.2.3');
    expect(result.metadata.author).toBe('Docs Team');
    expect(result.metadata.description).toBe('Comprehensive API package manifest');
    expect(result.metadata.type).toBe('reference');
    expect(result.metadata.status).toBe('published');
    expect(result.raw).toBe(FULL_MANIFEST);
  });

  it('TC-1.1b extracts minimal frontmatter and leaves optional fields undefined', () => {
    const result = parseManifest(MINIMAL_MANIFEST);

    expect(result.metadata.title).toBe('Quickstart');
    expect(result.metadata.version).toBe('0.1.0');
    expect(result.metadata.author).toBeUndefined();
    expect(result.metadata.description).toBeUndefined();
    expect(result.metadata.type).toBeUndefined();
    expect(result.metadata.status).toBeUndefined();
    expect(result.raw).toBe(MINIMAL_MANIFEST);
  });

  it('TC-1.1c parses manifests without frontmatter', () => {
    const result = parseManifest(NO_FRONTMATTER_MANIFEST);

    expect(result.metadata).toEqual({});
    expect(result.navigation).toHaveLength(3);
    expect(result.raw).toBe(NO_FRONTMATTER_MANIFEST);
  });

  it('TC-1.2a builds a flat navigation tree from linked list items', () => {
    const result = parseManifest(FLAT_MANIFEST);

    expect(result.navigation).toEqual([
      { displayName: 'One', filePath: 'one.md', children: [], isGroup: false },
      { displayName: 'Two', filePath: 'two.md', children: [], isGroup: false },
      { displayName: 'Three', filePath: 'three.md', children: [], isGroup: false },
    ]);
    expect(result.raw).toBe(FLAT_MANIFEST);
  });

  it('TC-1.2b builds nested groups and children from list indentation', () => {
    const result = parseManifest(NESTED_MANIFEST);

    expect(result.navigation).toHaveLength(2);
    expect(result.navigation[0]).toMatchObject({
      displayName: 'Guides',
      filePath: undefined,
      isGroup: true,
    });
    expect(result.navigation[0]?.children).toHaveLength(2);
    expect(result.navigation[1]).toMatchObject({
      displayName: 'Reference',
      filePath: undefined,
      isGroup: true,
    });
    expect(result.navigation[1]?.children).toHaveLength(1);
    expect(result.raw).toBe(NESTED_MANIFEST);
  });

  it('TC-1.2c builds navigation trees deeper than three levels', () => {
    const result = parseManifest(DEEP_MANIFEST);
    const product = result.navigation[0];
    const guides = product?.children[0];
    const gettingStarted = guides?.children[0];

    expect(product?.displayName).toBe('Product');
    expect(product?.isGroup).toBe(true);
    expect(guides?.displayName).toBe('Guides');
    expect(guides?.isGroup).toBe(true);
    expect(gettingStarted?.displayName).toBe('Getting Started');
    expect(gettingStarted?.isGroup).toBe(true);
    expect(gettingStarted?.children).toHaveLength(2);
    expect(gettingStarted?.children.map((node) => node.displayName)).toEqual([
      'Install',
      'Configure',
    ]);
    expect(result.raw).toBe(DEEP_MANIFEST);
  });

  it('TC-1.3a treats plain-text list items with children as groups', () => {
    const result = parseManifest(NESTED_MANIFEST);
    const guides = result.navigation[0];

    expect(guides).toMatchObject({
      displayName: 'Guides',
      filePath: undefined,
      isGroup: true,
    });
    expect(guides?.children).toHaveLength(2);
    expect(result.raw).toBe(NESTED_MANIFEST);
  });

  it('TC-1.3b keeps standalone plain-text list items as empty groups', () => {
    const result = parseManifest(GROUP_NO_CHILDREN);
    const authentication = result.navigation[0];

    expect(authentication).toMatchObject({
      displayName: 'Authentication',
      filePath: undefined,
      isGroup: true,
    });
    expect(authentication?.children).toHaveLength(0);
    expect(result.raw).toBe(GROUP_NO_CHILDREN);
  });

  it('TC-1.4a preserves display names and file paths for top-level links', () => {
    const result = parseManifest(FULL_MANIFEST);

    expect(result.navigation[0]).toEqual({
      displayName: 'Overview',
      filePath: 'overview.md',
      children: [],
      isGroup: false,
    });
    expect(result.raw).toBe(FULL_MANIFEST);
  });

  it('TC-1.4b preserves nested link file paths', () => {
    const result = parseManifest(FULL_MANIFEST);
    const authentication = result.navigation[1];
    const introduction = authentication?.children[0];

    expect(authentication?.displayName).toBe('Authentication');
    expect(introduction).toMatchObject({
      displayName: 'Introduction',
      filePath: 'auth/intro.md',
      isGroup: false,
    });
    expect(result.raw).toBe(FULL_MANIFEST);
  });

  it('TC-1.5a throws a manifest parse error when the body has only paragraphs', () => {
    try {
      parseManifest(PARAGRAPH_ONLY_MANIFEST);
      throw new Error('Expected parseManifest to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackageError);
      expect((error as PackageError).code).toBe(PackageErrorCode.MANIFEST_PARSE_ERROR);
    }
  });

  it('TC-1.5b throws a manifest parse error for invalid YAML frontmatter', () => {
    try {
      parseManifest(INVALID_YAML_MANIFEST);
      throw new Error('Expected parseManifest to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PackageError);
      expect((error as PackageError).code).toBe(PackageErrorCode.MANIFEST_PARSE_ERROR);
    }
  });

  it('TC-1.6a parses ordered lists in source order', () => {
    const result = parseManifest(ORDERED_LIST_MANIFEST);

    expect(result.navigation).toHaveLength(3);
    expect(result.navigation.map((node) => node.displayName)).toEqual(['First', 'Second', 'Third']);
    expect(result.raw).toBe(ORDERED_LIST_MANIFEST);
  });

  it('TC-1.6b treats empty links as group labels', () => {
    const result = parseManifest(EMPTY_LINK_MANIFEST);

    expect(result.navigation).toEqual([
      { displayName: 'Overview', children: [], isGroup: true },
      { displayName: 'Setup', children: [], isGroup: true },
    ]);
    expect(result.raw).toBe(EMPTY_LINK_MANIFEST);
  });

  it('TC-1.6c preserves non-markdown file paths', () => {
    const result = parseManifest(NON_MD_LINK_MANIFEST);

    expect(result.navigation).toEqual([
      {
        displayName: 'Data Export',
        filePath: 'exports/report.csv',
        children: [],
        isGroup: false,
      },
      {
        displayName: 'Whitepaper',
        filePath: 'docs/whitepaper.pdf',
        children: [],
        isGroup: false,
      },
    ]);
    expect(result.raw).toBe(NON_MD_LINK_MANIFEST);
  });

  it('TC-1.6d ignores paragraphs between list blocks', () => {
    const result = parseManifest(PARAGRAPHS_BETWEEN_LISTS);

    expect(result.navigation).toHaveLength(3);
    expect(result.navigation.map((node) => node.displayName)).toEqual([
      'Overview',
      'Setup',
      'Reference',
    ]);
    expect(result.raw).toBe(PARAGRAPHS_BETWEEN_LISTS);
  });

  it('TC-1.6e returns empty navigation for an empty body after frontmatter', () => {
    const result = parseManifest(EMPTY_BODY_MANIFEST);

    expect(result.metadata.title).toBe('Empty Body');
    expect(result.metadata.version).toBe('1.0.0');
    expect(result.metadata.author).toBe('Example');
    expect(result.navigation).toEqual([]);
    expect(result.raw).toBe(EMPTY_BODY_MANIFEST);
  });

  it('verifies four levels of nesting exist in the deep manifest', () => {
    const result = parseManifest(DEEP_MANIFEST);

    expect(result.navigation).toHaveLength(1);
    expect(result.navigation[0]?.displayName).toBe('Product');
    expect(result.navigation[0]?.children[0]?.displayName).toBe('Guides');
    expect(result.navigation[0]?.children[0]?.children[0]?.displayName).toBe('Getting Started');
    expect(
      result.navigation[0]?.children[0]?.children[0]?.children.map((node) => node.displayName),
    ).toEqual(['Install', 'Configure']);
    expect(result.raw).toBe(DEEP_MANIFEST);
  });

  it('parses large manifests with all entries intact', () => {
    const result = parseManifest(LARGE_MANIFEST);

    expect(result.navigation).toHaveLength(120);
    for (const node of result.navigation) {
      expect(node.displayName).toBeTruthy();
      expect(node.filePath).toBeTruthy();
      expect(node.isGroup).toBe(false);
      expect(node.children).toEqual([]);
    }
    expect(result.raw).toBe(LARGE_MANIFEST);
  });

  it('supports unicode metadata and navigation labels', () => {
    const result = parseManifest(UNICODE_MANIFEST);

    expect(result.metadata.title).toContain('国际化文档');
    expect(result.navigation[0]).toMatchObject({
      displayName: 'Résumé',
      filePath: 'profiles/resume.md',
      isGroup: false,
    });
    expect(result.navigation[1]).toMatchObject({
      displayName: '東京ガイド',
      filePath: 'guides/tokyo.md',
      isGroup: false,
    });
    expect(result.navigation[2]).toMatchObject({
      displayName: 'Café',
      isGroup: true,
    });
    expect(result.navigation[2]?.children[0]).toMatchObject({
      displayName: 'Crème brûlée',
      filePath: 'recipes/creme-brulee.md',
      isGroup: false,
    });
    expect(result.raw).toBe(UNICODE_MANIFEST);
  });
});
