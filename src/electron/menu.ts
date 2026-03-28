import { app, Menu, BrowserWindow, ipcMain } from 'electron';
import type { MenuState } from '../shared/contracts/electron.js';

let currentState: MenuState = {
  hasDocument: false,
  hasDirtyTab: false,
  activeTabDirty: false,
  activeTheme: 'light-default',
  activeMode: 'render',
  defaultMode: 'render',
};

let activeWindow: BrowserWindow | null = null;
let menuStateListenerRegistered = false;

const THEMES = [
  { id: 'light-default', label: 'Light Default' },
  { id: 'light-warm', label: 'Light Warm' },
  { id: 'dark-default', label: 'Dark Default' },
  { id: 'dark-cool', label: 'Dark Cool' },
];

function sendAction(win: BrowserWindow, action: string, args?: unknown): void {
  if (args === undefined) {
    win.webContents.send('menu:action', action);
    return;
  }

  win.webContents.send('menu:action', action, args);
}

function sendActionToActiveWindow(action: string, args?: unknown): void {
  if (!activeWindow) {
    return;
  }

  sendAction(activeWindow, action, args);
}

function rebuildMenu(): void {
  if (!Menu?.buildFromTemplate || !Menu?.setApplicationMenu || !activeWindow) {
    return;
  }

  const template: Electron.MenuItemConstructorOptions[] = [
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
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendActionToActiveWindow('open-file'),
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendActionToActiveWindow('open-folder'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: currentState.activeTabDirty,
          click: () => sendActionToActiveWindow('save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow('save-as'),
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow('close-tab'),
        },
      ],
    },
    {
      label: 'Export',
      submenu: [
        {
          label: 'PDF',
          accelerator: 'CmdOrCtrl+Shift+E',
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow('export-pdf'),
        },
        {
          label: 'DOCX',
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow('export-docx'),
        },
        {
          label: 'HTML',
          enabled: currentState.hasDocument,
          click: () => sendActionToActiveWindow('export-html'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+\\',
          click: () => sendActionToActiveWindow('toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: 'Theme',
          submenu: THEMES.map((theme) => ({
            label: theme.label,
            type: 'checkbox' as const,
            checked: currentState.activeTheme === theme.id,
            click: () => sendActionToActiveWindow('set-theme', theme.id),
          })),
        },
        { type: 'separator' },
        {
          label: 'Render Mode',
          accelerator: 'CmdOrCtrl+Shift+M',
          type: 'checkbox',
          checked: currentState.activeMode === 'render',
          click: () => sendActionToActiveWindow('toggle-mode'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

export function buildMenu(win: BrowserWindow): void {
  if (!Menu?.buildFromTemplate || !Menu?.setApplicationMenu) {
    return;
  }

  activeWindow = win;
  rebuildMenu();

  if (!menuStateListenerRegistered) {
    ipcMain.on('menu:state-update', (_event, state: MenuState) => {
      currentState = state;
      rebuildMenu();
    });
    menuStateListenerRegistered = true;
  }
}
