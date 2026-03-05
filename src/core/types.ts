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
  warnings: RenderWarning[];
}

export interface DocumentTabSession {
  tabId: string;
  filePath: string;
  title: string;
  savedMarkdown: string;
  currentMarkdown: string;
  renderHtml: string;
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
