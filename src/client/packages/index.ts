import type { PackageCreateResponse, PackageOpenResponse } from '../../shared/types.js';
import { ApiError, type ApiClient } from '../api.js';
import type { ClientError, ClientState, StateStore } from '../state.js';
import { getDefaultPackageState } from '../state.js';
import { fileName } from '../utils/file-paths.js';
import type { ShellCapabilities } from '../utils/shell-capabilities.js';
import { MANIFEST_FILENAME } from '../../pkg/types.js';

export interface PackagesModule {
  openPackage: (filePath: string) => Promise<void>;
  pickAndOpenPackage: () => Promise<void>;
  createPackage: () => Promise<void>;
  exportPackage: () => Promise<void>;
  restoreActivePackage: (
    activePackage: NonNullable<ClientState['session']['activePackage']>,
  ) => Promise<void>;
  getPackageDisplayName: (absolutePath: string) => string | null;
  clearForRootSwitch: () => string | null;
  getManifestPath: () => string | null;
}

interface PackagesModuleDependencies {
  api: Pick<
    ApiClient,
    'openPackage' | 'createPackage' | 'exportPackage' | 'getPackageManifest' | 'saveDialog'
  >;
  store: StateStore;
  shellCapabilities: Pick<ShellCapabilities, 'pickPackage' | 'saveDialog'>;
  setError: (error: unknown) => void;
  setClientError: (code: string, message: string, severity?: ClientError['severity']) => void;
  closeTabsUnderRoot: (root: string) => void;
  loadPackageFallbackTree: (root: string) => Promise<void>;
}

export function createPackagesModule(dependencies: PackagesModuleDependencies): PackagesModule {
  const {
    api,
    store,
    shellCapabilities,
    setError,
    setClientError,
    closeTabsUnderRoot,
    loadPackageFallbackTree,
  } = dependencies;

  const handlePackageOpen = async (response: PackageOpenResponse): Promise<void> => {
    const { metadata, navigation, packageInfo } = response;
    const previousRoot = store.get().packageState.effectiveRoot;
    if (previousRoot) {
      closeTabsUnderRoot(previousRoot);
    }

    store.update(
      {
        packageState: {
          active: true,
          sidebarMode: packageInfo.manifestStatus === 'present' ? 'package' : 'fallback',
          sourcePath: packageInfo.sourcePath,
          effectiveRoot: packageInfo.extractedRoot,
          format: packageInfo.format,
          mode: 'extracted',
          navigation: navigation as ClientState['packageState']['navigation'],
          metadata: metadata as ClientState['packageState']['metadata'],
          stale: false,
          manifestStatus: packageInfo.manifestStatus,
          manifestError: packageInfo.manifestError ?? null,
          manifestPath:
            packageInfo.manifestStatus === 'present'
              ? `${packageInfo.extractedRoot}/${MANIFEST_FILENAME}`
              : null,
          collapsedGroups: new Set(),
        },
        session: {
          ...store.get().session,
          lastRoot: packageInfo.extractedRoot,
        },
      },
      ['packageState', 'session'],
    );

    if (packageInfo.manifestStatus !== 'present') {
      await loadPackageFallbackTree(packageInfo.extractedRoot);
    }
  };

  const handlePackageCreated = (response: PackageCreateResponse): void => {
    const root = store.get().session.lastRoot;
    store.update(
      {
        packageState: {
          active: true,
          sidebarMode: 'package',
          sourcePath: root,
          effectiveRoot: root,
          format: 'mpk',
          mode: 'directory',
          navigation: response.navigation as ClientState['packageState']['navigation'],
          metadata: response.metadata as ClientState['packageState']['metadata'],
          stale: false,
          manifestStatus: 'present',
          manifestError: null,
          manifestPath: response.manifestPath,
          collapsedGroups: new Set(),
        },
      },
      ['packageState'],
    );
  };

  const openPackage = async (filePath: string): Promise<void> => {
    try {
      const response = await api.openPackage(filePath);
      await handlePackageOpen(response);
    } catch (error) {
      setError(error);
    }
  };

  const pickAndOpenPackage = async () => {
    const result = await shellCapabilities.pickPackage();
    if (!result) {
      return;
    }

    await openPackage(result.path);
  };

  const createPackage = async (): Promise<void> => {
    const state = store.get();
    const pkgState = state.packageState;

    if (pkgState.active && pkgState.sidebarMode === 'fallback' && pkgState.effectiveRoot) {
      const hasExistingManifest = pkgState.manifestStatus === 'unreadable';

      if (hasExistingManifest) {
        const confirmed = window.confirm(
          'The existing manifest could not be parsed. Overwrite with a new scaffold?',
        );
        if (!confirmed) {
          return;
        }
      }

      try {
        const response = await api.createPackage({
          rootDir: pkgState.effectiveRoot,
          overwrite: hasExistingManifest,
        });

        store.update(
          {
            packageState: {
              ...store.get().packageState,
              sidebarMode: 'package',
              navigation: response.navigation as ClientState['packageState']['navigation'],
              metadata: response.metadata as ClientState['packageState']['metadata'],
              manifestStatus: 'present',
              manifestError: null,
              manifestPath: response.manifestPath,
              stale: true,
            },
          },
          ['packageState'],
        );
      } catch (error) {
        setError(error);
      }
      return;
    }

    const root = state.session.lastRoot;
    if (!root) {
      return;
    }

    try {
      const response = await api.createPackage({ rootDir: root });
      handlePackageCreated(response);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'MANIFEST_EXISTS') {
        const confirmed = window.confirm(
          'A manifest already exists. Overwrite it with a new scaffold?',
        );
        if (confirmed) {
          try {
            const response = await api.createPackage({ rootDir: root, overwrite: true });
            handlePackageCreated(response);
          } catch (retryError) {
            setError(retryError);
          }
        }
        return;
      }

      setError(error);
    }
  };

  const exportPackage = async (): Promise<void> => {
    const state = store.get();
    const pkgState = state.packageState;
    const sourceName = pkgState.sourcePath
      ? fileName(pkgState.sourcePath).replace(/\.(mpk|mpkz)$/i, '')
      : null;
    const baseName =
      pkgState.metadata?.title ??
      sourceName ??
      (state.session.lastRoot ? fileName(state.session.lastRoot) : 'package');
    const defaultFilename = `${baseName}.mpk`;

    const selection = await shellCapabilities.saveDialog({
      defaultPath: state.session.lastRoot ?? '',
      defaultFilename,
      prompt: 'Export Package',
    });

    if (!selection) {
      return;
    }

    const outputPath = selection.path;
    const compress = outputPath.endsWith('.mpkz');
    const sourceDir = pkgState.effectiveRoot ?? state.session.lastRoot ?? undefined;

    try {
      const result = await api.exportPackage({
        outputPath,
        compress,
        sourceDir,
      });

      if (
        pkgState.mode === 'extracted' &&
        pkgState.sourcePath &&
        outputPath === pkgState.sourcePath
      ) {
        store.update(
          {
            packageState: {
              ...store.get().packageState,
              stale: false,
            },
          },
          ['packageState'],
        );
      }

      setClientError('EXPORT_SUCCESS', `Package exported to ${result.outputPath}`, 'info');
    } catch (error) {
      setError(error);
    }
  };

  const clearForRootSwitch = (): string | null => {
    const prevRoot = store.get().packageState.effectiveRoot;
    if (store.get().packageState.active) {
      store.update({ packageState: getDefaultPackageState() }, ['packageState']);
    }
    return prevRoot;
  };

  const getPackageDisplayName = (absolutePath: string): string | null => {
    const { packageState } = store.get();
    if (!packageState.active || !packageState.effectiveRoot) {
      return null;
    }

    const prefix = `${packageState.effectiveRoot.replace(/\/$/, '')}/`;
    if (!absolutePath.startsWith(prefix)) {
      return null;
    }

    const relativePath = absolutePath.slice(prefix.length);
    const findDisplayName = (nodes: ClientState['packageState']['navigation']): string | null => {
      for (const node of nodes) {
        if (node.filePath === relativePath) {
          return node.displayName;
        }

        const childMatch = findDisplayName(node.children);
        if (childMatch) {
          return childMatch;
        }
      }

      return null;
    };

    return findDisplayName(packageState.navigation);
  };

  const restoreActivePackage = async (
    activePackage: NonNullable<ClientState['session']['activePackage']>,
  ) => {
    const sidebarMode = activePackage.manifestStatus === 'present' ? 'package' : 'fallback';
    let navigation: ClientState['packageState']['navigation'] = [];
    let metadata: ClientState['packageState']['metadata'] = {};
    let shouldRestorePackage = sidebarMode === 'fallback';

    if (sidebarMode === 'package') {
      try {
        const manifest = await api.getPackageManifest();
        navigation = manifest.navigation as ClientState['packageState']['navigation'];
        metadata = manifest.metadata as ClientState['packageState']['metadata'];
        shouldRestorePackage = true;
      } catch {
        navigation = [];
        metadata = {};
      }
    }

    if (shouldRestorePackage) {
      store.update(
        {
          packageState: {
            active: true,
            sidebarMode,
            sourcePath: activePackage.sourcePath,
            effectiveRoot: activePackage.extractedRoot,
            format: activePackage.format,
            mode: activePackage.mode,
            navigation,
            metadata,
            stale: activePackage.stale,
            manifestStatus: activePackage.manifestStatus,
            manifestError: null,
            manifestPath:
              activePackage.manifestStatus === 'present'
                ? `${activePackage.extractedRoot}/${MANIFEST_FILENAME}`
                : null,
            collapsedGroups: new Set(),
          },
        },
        ['packageState'],
      );

      if (sidebarMode === 'fallback') {
        await loadPackageFallbackTree(activePackage.extractedRoot);
      }
    }
  };

  const getManifestPath = () => store.get().packageState.manifestPath;

  return {
    openPackage,
    pickAndOpenPackage,
    createPackage,
    exportPackage,
    restoreActivePackage,
    getPackageDisplayName,
    clearForRootSwitch,
    getManifestPath,
  };
}
