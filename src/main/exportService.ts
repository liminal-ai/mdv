import path from 'node:path';

import { dialog } from 'electron';

import type { ExportPayload, ExportResult } from '../core/ipc';
import { exportDocxFromHtml } from '../core/export/docx';
import { exportHtmlFolder } from '../core/export/html';
import { exportPdfFromHtml } from '../core/export/pdf';
import { renderMarkdown } from '../core/render/markdown';
import type { MermaidRenderer, RenderResult } from '../core/types';
import type { TabService } from './tabService';

interface ExportServiceOptions {
  tabService: TabService;
  mermaidRenderer: MermaidRenderer;
}

export interface ExportService {
  exportCurrentPdfDialog(payload?: ExportPayload): Promise<ExportResult>;
  exportCurrentDocxDialog(payload?: ExportPayload): Promise<ExportResult>;
  exportCurrentHtmlDialog(payload?: ExportPayload): Promise<ExportResult>;
}

export function shouldReuseRenderForExport(renderedMarkdown: string, payloadMarkdown?: string): boolean {
  return payloadMarkdown === undefined || payloadMarkdown === renderedMarkdown;
}

export function createExportService({ tabService, mermaidRenderer }: ExportServiceOptions): ExportService {
  function getExportTab(tabId?: string) {
    if (tabId) {
      return tabService.getTabById(tabId);
    }
    return tabService.getActiveTab();
  }

  async function resolveRenderForExport(tab: NonNullable<ReturnType<TabService['getActiveTab']>>, markdown?: string): Promise<RenderResult> {
    if (shouldReuseRenderForExport(tab.renderedMarkdown, markdown)) {
      return tab.render;
    }

    return renderMarkdown(
      {
        inputPath: tab.filePath,
        markdown: markdown ?? tab.currentMarkdown,
        baseDir: path.dirname(tab.filePath),
        offline: true
      },
      mermaidRenderer
    );
  }

  async function exportCurrentPdfDialog(payload?: ExportPayload): Promise<ExportResult> {
    const tab = getExportTab(payload?.tabId);
    if (!tab) {
      return { ok: false, reason: 'No document is loaded.' };
    }

    const renderResult = await resolveRenderForExport(tab, payload?.markdown);

    const defaultName = `${path.parse(tab.filePath).name}.pdf`;
    const selection = await dialog.showSaveDialog({
      title: 'Export PDF',
      defaultPath: path.join(path.dirname(tab.filePath), defaultName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (selection.canceled || !selection.filePath) {
      return { ok: false, reason: 'cancelled' };
    }

    const warnings = await exportPdfFromHtml(
      path.parse(tab.filePath).name,
      renderResult.exportHtml,
      selection.filePath,
      undefined,
      renderResult.baseDir,
      renderResult.diagrams,
      renderResult.warnings,
      {
        pageSize: 'Letter',
        printBackground: true
      }
    );

    return { ok: true, filePath: selection.filePath, warnings };
  }

  async function exportCurrentDocxDialog(payload?: ExportPayload): Promise<ExportResult> {
    const tab = getExportTab(payload?.tabId);
    if (!tab) {
      return { ok: false, reason: 'No document is loaded.' };
    }

    const renderResult = await resolveRenderForExport(tab, payload?.markdown);
    const defaultName = `${path.parse(tab.filePath).name}.docx`;
    const selection = await dialog.showSaveDialog({
      title: 'Export DOCX',
      defaultPath: path.join(path.dirname(tab.filePath), defaultName),
      filters: [{ name: 'Word Document', extensions: ['docx'] }]
    });

    if (selection.canceled || !selection.filePath) {
      return { ok: false, reason: 'cancelled' };
    }

    const result = await exportDocxFromHtml(
      path.parse(tab.filePath).name,
      renderResult.exportHtml,
      selection.filePath,
      renderResult.baseDir,
      renderResult.diagrams,
      renderResult.warnings,
      {
        pageSize: 'Letter',
        marginsInches: {
          top: 1,
          right: 1,
          bottom: 1,
          left: 1
        }
      }
    );

    return {
      ok: true,
      filePath: result.outputFile,
      warnings: result.warnings
    };
  }

  async function exportCurrentHtmlDialog(payload?: ExportPayload): Promise<ExportResult> {
    const tab = getExportTab(payload?.tabId);
    if (!tab) {
      return { ok: false, reason: 'No document is loaded.' };
    }

    const renderResult = await resolveRenderForExport(tab, payload?.markdown);
    const selection = await dialog.showOpenDialog({
      title: 'Select Export Destination',
      properties: ['openDirectory', 'createDirectory']
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return { ok: false, reason: 'cancelled' };
    }

    const selectedDir = selection.filePaths[0];
    if (!selectedDir) {
      return { ok: false, reason: 'cancelled' };
    }

    const outputDir = path.join(selectedDir, `${path.parse(tab.filePath).name}-export`);
    const result = await exportHtmlFolder(
      outputDir,
      path.parse(tab.filePath).name,
      renderResult.exportHtml,
      renderResult.baseDir,
      renderResult.diagrams,
      renderResult.warnings
    );

    return {
      ok: true,
      filePath: result.outputFile,
      warnings: result.warnings
    };
  }

  return {
    exportCurrentPdfDialog,
    exportCurrentDocxDialog,
    exportCurrentHtmlDialog
  };
}
