/**
 * Canonical manifest file name.
 */
export const MANIFEST_FILENAME = '_nav.md';

/**
 * Known Mermaid diagram type keywords for basic validation.
 */
export const MERMAID_DIAGRAM_TYPES = new Set([
  'graph',
  'flowchart',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'erdiagram',
  'pie',
  'gantt',
  'gitgraph',
  'mindmap',
  'timeline',
  'quadrantchart',
  'requirementdiagram',
  'journey',
  'c4context',
  'c4container',
  'c4component',
  'c4deployment',
  'block-beta',
  'sankey-beta',
  'xychart-beta',
  'packet-beta',
]);

export interface ManifestMetadata {
  title?: string;
  version?: string;
  author?: string;
  description?: string;
  type?: string;
  status?: string;
}

export interface NavigationNode {
  displayName: string;
  filePath?: string;
  children: NavigationNode[];
  isGroup: boolean;
}

export interface ParsedManifest {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  raw: string;
}

export interface PackageInfo {
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
  files: FileEntry[];
  format: 'mpk' | 'mpkz';
}

export interface FileEntry {
  path: string;
  size: number;
}

export interface CreateOptions {
  sourceDir: string;
  outputPath: string;
  compress?: boolean;
}

export interface ExtractOptions {
  packagePath: string;
  outputDir: string;
}

export interface InspectOptions {
  packagePath: string;
}

export interface ListOptions {
  packagePath: string;
}

export interface ManifestOptions {
  packagePath: string;
}

export type ReadTarget = { filePath: string } | { displayName: string };

export interface ReadOptions {
  packagePath: string;
  target: ReadTarget;
}

export interface ManifestResult {
  content: string;
  metadata: ManifestMetadata;
  navigation: NavigationNode[];
}

export interface ReadResult {
  content: string;
  filePath: string;
}

export interface RenderOptions {
  syntaxHighlight?: boolean;
  mermaid?: boolean;
}

export interface RenderResult {
  html: string;
}
