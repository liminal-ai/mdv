import fs from 'node:fs';
import path from 'node:path';

import { BrowserWindow, Menu, MenuItemConstructorOptions, app, dialog, shell } from 'electron';

interface MenuHandlers {
  openMarkdown: () => void;
  openFolder: () => void;
  reloadDocument: () => void;
  saveDocument: () => void;
  saveDocumentAs: () => void;
  closeTab: () => void;
  nextDocumentTab: () => void;
  previousDocumentTab: () => void;
  exportPdf: () => void;
  exportDocx: () => void;
  exportHtml: () => void;
  toggleSidebar: () => void;
  showEditTab: () => void;
  showRenderTab: () => void;
  getWindow: () => BrowserWindow | null;
}

async function openReadme(): Promise<void> {
  const candidate = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(candidate)) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'README unavailable',
      message: 'README.md was not found in the current working directory.'
    });
    return;
  }

  const errorText = await shell.openPath(candidate);
  if (errorText) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Open README failed',
      message: errorText
    });
  }
}

function exportCapabilitiesText(): string {
  return [
    'MD Viewer capabilities:',
    '- Open and preview .md/.markdown files',
    '- Local Mermaid rendering',
    '- Export: PDF, DOCX, HTML folder',
    '- Offline-safe remote image blocking',
    '- Sidebar markdown navigator with pinned folders'
  ].join('\n');
}

export function buildApplicationMenu(handlers: MenuHandlers): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Markdown…',
          accelerator: 'CmdOrCtrl+O',
          click: () => handlers.openMarkdown()
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => handlers.openFolder()
        },
        {
          label: 'Reload Current Markdown',
          accelerator: 'CmdOrCtrl+R',
          click: () => handlers.reloadDocument()
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => handlers.saveDocument()
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => handlers.saveDocumentAs()
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => handlers.closeTab()
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Export',
      submenu: [
        {
          label: 'Export PDF…',
          click: () => handlers.exportPdf()
        },
        {
          label: 'Export DOCX…',
          click: () => handlers.exportDocx()
        },
        {
          label: 'Export HTML Folder…',
          click: () => handlers.exportHtml()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => handlers.toggleSidebar()
        },
        {
          label: 'Render Tab',
          accelerator: 'CmdOrCtrl+1',
          click: () => handlers.showRenderTab()
        },
        {
          label: 'Edit Tab',
          accelerator: 'CmdOrCtrl+2',
          click: () => handlers.showEditTab()
        },
        { type: 'separator' },
        {
          label: 'Next Document Tab',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: () => handlers.nextDocumentTab()
        },
        {
          label: 'Previous Document Tab',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: () => handlers.previousDocumentTab()
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open README',
          click: () => {
            void openReadme();
          }
        },
        {
          label: 'Export Capabilities',
          click: () => {
            const window = handlers.getWindow();
            const options = {
              type: 'info' as const,
              title: 'Export Capabilities',
              message: exportCapabilitiesText()
            };
            if (window) {
              void dialog.showMessageBox(window, options);
            } else {
              void dialog.showMessageBox(options);
            }
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
