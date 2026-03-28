import type { ExportFormat } from '../../shared/types.js';
import type { ApiClient } from '../api.js';
import type { StateStore, TabState } from '../state.js';
import { directoryName, exportBaseName } from '../utils/file-paths.js';
import type { ShellCapabilities } from '../utils/shell-capabilities.js';

type ExportDirtyChoice = 'save-and-export' | 'export-anyway' | 'cancel';

export interface ExportsModule {
  handleExportClick: (
    format: ExportFormat,
    options?: { allowDirty?: boolean; tabId?: string },
  ) => Promise<void>;
  resolveExportDirtyWarning: (choice: ExportDirtyChoice) => Promise<void>;
}

interface ExportsModuleDependencies {
  api: Pick<ApiClient, 'exportDocument' | 'setLastExportDir'>;
  store: StateStore;
  shellCapabilities: Pick<ShellCapabilities, 'saveDialog'>;
  setError: (error: unknown) => void;
  getErrorMessage: (error: unknown) => { code: string; message: string; timeout?: boolean };
  getTabById: (tabId: string | null) => TabState | null;
  saveTab: (tabId: string) => Promise<boolean>;
}

export function createExportsModule(dependencies: ExportsModuleDependencies): ExportsModule {
  const { api, store, shellCapabilities, setError, getErrorMessage, getTabById, saveTab } =
    dependencies;

  const proceedWithExport = async (tab: TabState, format: ExportFormat) => {
    if (tab.status !== 'ok' || store.get().exportState.inProgress) {
      return;
    }

    const defaultDir = store.get().session.lastExportDir ?? directoryName(tab.path);
    const defaultFilename = `${exportBaseName(tab.path)}.${format}`;

    let selection: { path: string } | null;
    try {
      selection = await shellCapabilities.saveDialog({
        defaultPath: defaultDir,
        defaultFilename,
        prompt: 'Export document',
      });
    } catch (error) {
      setError(error);
      return;
    }

    if (!selection) {
      return;
    }

    void api
      .setLastExportDir(directoryName(selection.path))
      .then((session) => {
        store.update({ session, error: null }, ['session', 'error']);
      })
      .catch((error) => {
        console.warn('Failed to persist last export directory', error);
      });

    store.update(
      {
        exportState: {
          inProgress: true,
          activeFormat: format,
          result: null,
        },
      },
      ['exportState'],
    );

    try {
      const result = await api.exportDocument({
        path: tab.path,
        format,
        savePath: selection.path,
        theme: store.get().session.theme,
      });

      store.update(
        {
          exportState: {
            inProgress: false,
            activeFormat: null,
            result: {
              type: 'success',
              outputPath: result.outputPath,
              warnings: result.warnings,
              completedAt: new Date().toISOString(),
            },
          },
        },
        ['exportState'],
      );
    } catch (error) {
      store.update(
        {
          exportState: {
            inProgress: false,
            activeFormat: null,
            result: {
              type: 'error',
              warnings: [],
              error: getErrorMessage(error).message,
              completedAt: new Date().toISOString(),
            },
          },
        },
        ['exportState'],
      );
    }
  };

  const handleExportClick = async (
    format: ExportFormat,
    options: { allowDirty?: boolean; tabId?: string } = {},
  ) => {
    const state = store.get();
    const tabId = options.tabId ?? state.activeTabId;
    const activeTab = getTabById(tabId);
    if (!activeTab || activeTab.status !== 'ok' || state.exportState.inProgress) {
      return;
    }

    if (activeTab.dirty && !options.allowDirty) {
      store.update(
        {
          exportDirtyWarning: {
            tabId: activeTab.id,
            format,
          },
        },
        ['exportDirtyWarning'],
      );
      return;
    }

    await proceedWithExport(activeTab, format);
  };

  const resolveExportDirtyWarning = async (choice: ExportDirtyChoice) => {
    const warning = store.get().exportDirtyWarning;
    if (!warning) {
      return;
    }

    store.update({ exportDirtyWarning: null }, ['exportDirtyWarning']);

    if (choice === 'cancel') {
      return;
    }

    const warningTab = getTabById(warning.tabId);
    if (!warningTab) {
      return;
    }

    if (choice === 'save-and-export') {
      const saved = await saveTab(warning.tabId);
      if (!saved) {
        return;
      }

      const latestTab = getTabById(warning.tabId);
      if (!latestTab) {
        return;
      }

      await handleExportClick(warning.format, {
        allowDirty: true,
        tabId: latestTab.id,
      });
      return;
    }

    if (choice === 'export-anyway') {
      await handleExportClick(warning.format, {
        allowDirty: true,
        tabId: warningTab.id,
      });
    }
  };

  return {
    handleExportClick,
    resolveExportDirtyWarning,
  };
}
