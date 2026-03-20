import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { BrowserWindow } from 'electron';

import { MermaidRenderOutcome, MermaidRenderer } from '../core/types';

interface MermaidRenderRawResponse {
  ok: boolean;
  svg?: string;
  error?: string;
}

export class ElectronMermaidRenderer implements MermaidRenderer {
  private window: BrowserWindow | null = null;

  private shellPath: string | null = null;

  async renderDiagram(id: string, source: string): Promise<MermaidRenderOutcome> {
    await this.ensureWindow();

    if (!this.window) {
      return {
        ok: false,
        error: 'Mermaid renderer is unavailable.'
      };
    }

    const safeId = `${id}-${Date.now()}`;
    const script = `window.__mdvRenderMermaid(${JSON.stringify(safeId)}, ${JSON.stringify(source)});`;

    try {
      const result = (await this.window.webContents.executeJavaScript(
        script,
        true
      )) as MermaidRenderRawResponse;

      return {
        ok: Boolean(result.ok),
        svg: result.svg,
        error: result.error
      };
    } catch (error) {
      return {
        ok: false,
        error: String(error)
      };
    }
  }

  async dispose(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;

    if (this.shellPath) {
      await fs.rm(this.shellPath, { force: true }).catch(() => {});
      this.shellPath = null;
    }
  }

  private async ensureWindow(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return;
    }

    this.shellPath = await this.createShellHtml();
    this.window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    await this.window.loadFile(this.shellPath);
  }

  private async createShellHtml(): Promise<string> {
    const mermaidModulePath = require.resolve('mermaid/dist/mermaid.esm.min.mjs');
    const mermaidModuleUrl = pathToFileURL(mermaidModulePath).toString();

    const html = `<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module">
      import mermaid from '${mermaidModuleUrl}';
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default'
      });

      window.__mdvRenderMermaid = async function(id, source) {
        try {
          const rendered = await mermaid.render(id, source);
          return { ok: true, svg: rendered.svg };
        } catch (error) {
          return { ok: false, error: String(error) };
        }
      };
    </script>
  </body>
</html>`;

    const shellPath = path.join(os.tmpdir(), `mdv-mermaid-${process.pid}-${Date.now()}.html`);
    await fs.writeFile(shellPath, html, 'utf8');
    return shellPath;
  }
}
