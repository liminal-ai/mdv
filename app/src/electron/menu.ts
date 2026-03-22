import { app, Menu, BrowserWindow, ipcMain } from 'electron';

interface MenuState {
  hasDocument: boolean;
  hasDirtyTab: boolean;
  activeTabDirty: boolean;
  activeTheme: string;
  activeMode: string;
  defaultMode: string;
}

let currentState: MenuState = {
  hasDocument: false,
  hasDirtyTab: false,
  activeTabDirty: false,
  activeTheme: 'light-default',
  activeMode: 'render',
  defaultMode: 'render',
};

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

export function buildMenu(win: BrowserWindow): void {
  if (!Menu?.buildFromTemplate || !Menu?.setApplicationMenu) {
    return;
  }

  function rebuild(): void {
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
            click: () => sendAction(win, 'open-file'),
          },
          {
            label: 'Open Folder',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => sendAction(win, 'open-folder'),
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            enabled: currentState.activeTabDirty,
            click: () => sendAction(win, 'save'),
          },
          {
            label: 'Save As…',
            accelerator: 'CmdOrCtrl+Shift+S',
            enabled: currentState.hasDocument,
            click: () => sendAction(win, 'save-as'),
          },
          { type: 'separator' },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            enabled: currentState.hasDocument,
            click: () => sendAction(win, 'close-tab'),
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
            click: () => sendAction(win, 'export-pdf'),
          },
          {
            label: 'DOCX',
            enabled: currentState.hasDocument,
            click: () => sendAction(win, 'export-docx'),
          },
          {
            label: 'HTML',
            enabled: currentState.hasDocument,
            click: () => sendAction(win, 'export-html'),
          },
        ],
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Sidebar',
            accelerator: 'CmdOrCtrl+\\',
            click: () => sendAction(win, 'toggle-sidebar'),
          },
          { type: 'separator' },
          {
            label: 'Theme',
            submenu: THEMES.map((theme) => ({
              label: theme.label,
              type: 'checkbox' as const,
              checked: currentState.activeTheme === theme.id,
              click: () => sendAction(win, 'set-theme', theme.id),
            })),
          },
          { type: 'separator' },
          {
            label: 'Render Mode',
            accelerator: 'CmdOrCtrl+Shift+M',
            click: () => sendAction(win, 'toggle-mode'),
          },
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ],
      },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  rebuild();

  ipcMain.on('menu:state-update', (_event, state: MenuState) => {
    currentState = state;
    rebuild();
  });
}
