export type RenderWarningCode =
  | 'REMOTE_IMAGE_BLOCKED'
  | 'MISSING_LOCAL_IMAGE'
  | 'MERMAID_RENDER_FAILED'
  | 'DOCX_IMAGE_CONVERSION_FAILED';

export interface RenderWarning {
  code: RenderWarningCode;
  message: string;
  location?: string;
}

export interface PdfOptions {
  pageSize: 'Letter' | 'A4';
  printBackground: boolean;
}

export interface DocxOptions {
  pageSize: 'Letter' | 'A4';
  marginsInches: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface RenderRequest {
  inputPath: string;
  markdown: string;
  baseDir: string;
  offline: true;
}

export type MarkdownBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'blockquote'
  | 'image'
  | 'mermaid'
  | 'page-break'
  | 'warning';

export type LayoutHint = 'keep-with-next' | 'keep-together' | 'allow-split' | 'figure' | 'table-header-repeat';

export type TableAlignment = 'left' | 'center' | 'right' | 'default';

export interface TableCellModel {
  html: string;
  text: string;
  align: TableAlignment;
  isHeader: boolean;
  columnIndex: number;
}

export interface TableRowModel {
  cells: TableCellModel[];
}

export interface TableModel {
  alignments: TableAlignment[];
  headerRows: TableRowModel[];
  bodyRows: TableRowModel[];
}

export interface ResolvedAsset {
  id: string;
  kind: 'local-image' | 'mermaid-diagram';
  originalSrc: string;
  previewSrc?: string;
  exportSrc: string;
  alt: string;
  mime: string;
  svgContent?: string;
}

export interface RenderedBlock {
  id: string;
  kind: MarkdownBlockKind;
  html: string;
  layoutHints: LayoutHint[];
  signature: string;
}

export interface NormalizedBlock {
  id: string;
  kind: MarkdownBlockKind;
  textContent: string;
  layoutHints: LayoutHint[];
  previewHtml: string;
  exportHtml: string;
  signature: string;
  asset?: ResolvedAsset;
  table?: TableModel;
}

export interface NormalizedDocument {
  blocks: NormalizedBlock[];
  assets: ResolvedAsset[];
}

export interface DiagramAsset {
  id: string;
  source: string;
  svgPath: string;
  pngPath?: string;
  svgContent?: string;
}

export interface RenderResult {
  html: string;
  exportHtml: string;
  previewBlocks: RenderedBlock[];
  exportBlocks: RenderedBlock[];
  document: NormalizedDocument;
  diagrams: DiagramAsset[];
  warnings: RenderWarning[];
  baseDir: string;
  inputPath: string;
}

export interface DocumentPayload {
  filePath: string;
  markdown: string;
  html: string;
  warnings: RenderWarning[];
}

export interface RenderPreviewPayload {
  html: string;
  blocks: RenderedBlock[];
  warnings: RenderWarning[];
}

export interface DocumentTabSession {
  tabId: string;
  filePath: string;
  title: string;
  savedMarkdown: string;
  currentMarkdown: string;
  renderHtml: string;
  renderBlocks: RenderedBlock[];
  warnings: RenderWarning[];
  isDirty: boolean;
  hasExternalChange: boolean;
  lastDiskMtimeMs?: number;
}

export interface TabsStatePayload {
  tabs: DocumentTabSession[];
  activeTabId: string | null;
}

export interface OpenDocumentResult {
  ok: boolean;
  tabId?: string;
  reason?: string;
}

export interface ExportRequest {
  render: RenderResult;
  format: 'pdf' | 'html' | 'docx';
  outputPath: string;
  pdf: PdfOptions;
}

export interface DocxExportResult {
  outputFile: string;
  warnings: RenderWarning[];
}

export interface FolderNode {
  type: 'dir' | 'file';
  name: string;
  path: string;
  children?: FolderNode[];
}

export interface PinnedFolder {
  path: string;
  label: string;
}

export interface AppPreferences {
  pinnedFolders: string[];
  lastRootFolder?: string;
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  openTabs?: string[];
  activeTabPath?: string;
}

export interface MermaidRenderOutcome {
  ok: boolean;
  svg?: string;
  error?: string;
}

export interface MermaidRenderer {
  renderDiagram(id: string, source: string): Promise<MermaidRenderOutcome>;
  dispose(): Promise<void>;
}
