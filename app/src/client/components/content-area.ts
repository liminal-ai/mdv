import type { RenderWarning } from '../../shared/types.js';
import { Editor } from './editor.js';
import { attach as attachLinkHandler } from '../utils/link-handler.js';
import type { StateStore, TabState } from '../state.js';
import { createElement } from '../utils/dom.js';
import { renderMermaidBlocks } from '../utils/mermaid-renderer.js';

function fileName(filePath: string): string {
  const segments = filePath.split('/').filter(Boolean);
  return segments.at(-1) ?? filePath;
}

function warningsEqual(left: RenderWarning[], right: RenderWarning[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((warning, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      warning.type === other.type &&
      warning.source === other.source &&
      warning.message === other.message &&
      warning.line === other.line
    );
  });
}

export interface ContentAreaActions {
  onBrowse: () => void | Promise<void>;
  onOpenFile: () => void | Promise<void>;
  onOpenRecentFile?: (path: string) => void | Promise<void>;
  onOpenMarkdownLink?: (path: string, anchor?: string) => void | Promise<void>;
  onOpenExternalLink?: (path: string) => Promise<{ ok: true }>;
  onRenderContent?: (
    content: string,
    documentPath: string,
  ) => Promise<{ html: string; warnings: RenderWarning[] }>;
  onLinkError?: (error: unknown) => void;
}

export function mountContentArea(
  container: HTMLElement,
  store: StateStore,
  actions: ContentAreaActions,
): () => void {
  const dirtyTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let editor: Editor | null = null;
  let editorHost: HTMLElement | null = null;
  let editorTabId: string | null = null;
  let lastVisibleTabId: string | null = null;
  let lastVisibleMode: TabState['mode'] | null = null;
  const lastRenderedDirtyContent = new Map<string, string>();

  const getScrollPercentage = (element: HTMLElement | null): number => {
    if (!element) {
      return 0;
    }

    const maxScroll = element.scrollHeight - element.clientHeight;
    if (maxScroll <= 0) {
      return 0;
    }

    return element.scrollTop / maxScroll;
  };

  const persistEditorState = (
    currentEditor: Editor | null = editor,
    currentEditorTabId: string | null = editorTabId,
  ) => {
    if (!currentEditor || !currentEditorTabId) {
      return;
    }

    const state = store.get();
    const targetTab = state.tabs.find((tab) => tab.id === currentEditorTabId) ?? null;
    if (!targetTab) {
      return;
    }

    const nextContent = currentEditor.getContent();
    const nextScrollTop = currentEditor.getScrollTop();
    if (targetTab.editContent === nextContent && targetTab.editScrollPosition === nextScrollTop) {
      return;
    }

    store.update(
      {
        tabs: state.tabs.map((tab) =>
          tab.id === currentEditorTabId
            ? {
                ...tab,
                editContent: nextContent,
                editScrollPosition: nextScrollTop,
              }
            : tab,
        ),
      },
      ['tabs'],
    );
  };

  const destroyEditor = (options: { persist?: boolean } = {}) => {
    if (!editor) {
      return;
    }

    const currentEditor = editor;
    const currentEditorTabId = editorTabId;
    editor = null;
    editorHost = null;
    editorTabId = null;

    if (options.persist !== false) {
      persistEditorState(currentEditor, currentEditorTabId);
    }

    currentEditor.destroy();
  };

  const scheduleDirtyTruthCheck = (tabId: string) => {
    const existingTimer = dirtyTimers.get(tabId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      dirtyTimers.delete(tabId);
      const state = store.get();
      const tab = state.tabs.find((candidate) => candidate.id === tabId) ?? null;
      if (!tab) {
        return;
      }

      const isDirty = (tab.editContent ?? tab.content) !== tab.content;
      if (tab.dirty === isDirty && tab.editedSinceLastSave === isDirty) {
        return;
      }

      store.update(
        {
          tabs: state.tabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  dirty: isDirty,
                  editedSinceLastSave: isDirty,
                }
              : candidate,
          ),
        },
        ['tabs'],
      );
    }, 300);

    dirtyTimers.set(tabId, timer);
  };

  const updateActiveTab = (updateTab: (tab: TabState) => TabState) => {
    const state = store.get();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
    if (!activeTab) {
      return;
    }

    store.update(
      {
        tabs: state.tabs.map((tab) => (tab.id === activeTab.id ? updateTab(activeTab) : tab)),
      },
      ['tabs'],
    );
  };

  const ensureEditor = (parent: HTMLElement, tabId: string) => {
    if (editor && editorHost === parent) {
      return editor;
    }

    destroyEditor();
    editorHost = parent;
    editorTabId = tabId;
    editor = new Editor(parent, {
      onContentChange: (content) => {
        const activeTab = getActiveTab();
        if (!activeTab) {
          return;
        }

        const existingTimer = dirtyTimers.get(activeTab.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
          dirtyTimers.delete(activeTab.id);
        }

        const matchesSavedContent = content === activeTab.content;

        updateActiveTab((tab) => ({
          ...tab,
          editContent: content,
          dirty: matchesSavedContent ? false : true,
          editedSinceLastSave: matchesSavedContent ? false : true,
        }));

        if (!matchesSavedContent) {
          scheduleDirtyTruthCheck(activeTab.id);
        }
      },
      onCursorChange: (line, column) => {
        updateActiveTab((tab) => ({
          ...tab,
          cursorPosition: { line, column },
        }));
      },
      shouldSuppressUpdates: () => false,
    });

    return editor;
  };

  const getActiveTab = () => {
    const state = store.get();
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
  };

  const renderEmptyState = () => {
    const { session } = store.get();
    const recentFiles =
      session.recentFiles.length > 0
        ? createElement('ul', {
            className: 'content-area__recent-list',
            children: session.recentFiles.map((recentFile) =>
              createElement('li', {
                className: 'content-area__recent-item',
                children: [
                  createElement('button', {
                    className: 'content-area__recent-button',
                    attrs: { type: 'button' },
                    on: {
                      click: () => {
                        void actions.onOpenRecentFile?.(recentFile.path);
                      },
                    },
                    children: [
                      createElement('span', {
                        className: 'content-area__recent-name',
                        text: fileName(recentFile.path),
                      }),
                      createElement('span', {
                        className: 'content-area__recent-path',
                        text: recentFile.path,
                      }),
                    ],
                  }),
                ],
              }),
            ),
          })
        : createElement('p', {
            className: 'content-area__empty-recent',
            text: 'No recent files',
          });

    const openFolderButton = createElement('button', {
      className: 'content-area__button content-area__button--primary',
      text: 'Open Folder',
      attrs: { type: 'button' },
      on: {
        click: () => {
          void actions.onBrowse();
        },
      },
    });
    const openFileButton = createElement('button', {
      className: 'content-area__button',
      text: 'Open File',
      attrs: { type: 'button' },
      on: {
        click: () => {
          void actions.onOpenFile();
        },
      },
    });

    container.replaceChildren(
      createElement('section', {
        className: 'content-area__empty-state',
        children: [
          createElement('p', { className: 'content-area__eyebrow', text: 'MD Viewer' }),
          createElement('h1', {
            className: 'content-area__title',
            text: 'Open a markdown file to begin.',
          }),
          createElement('p', {
            className: 'content-area__copy',
            text: 'Keep related docs open in tabs and jump back into recent reading quickly.',
          }),
          createElement('div', {
            className: 'content-area__actions',
            children: [openFileButton, openFolderButton],
          }),
          createElement('div', {
            className: 'content-area__recent',
            children: [
              createElement('h2', {
                className: 'content-area__recent-title',
                text: 'Recent files',
              }),
              recentFiles,
            ],
          }),
        ],
      }),
    );
  };

  const render = async () => {
    const state = store.get();
    const activeTab = getActiveTab();

    if (!activeTab) {
      destroyEditor();
      lastVisibleTabId = null;
      lastVisibleMode = null;
      renderEmptyState();
      return;
    }

    if (
      activeTab.mode === 'edit' &&
      !activeTab.loading &&
      activeTab.status === 'ok' &&
      editor &&
      editorTabId === activeTab.id &&
      editorHost?.isConnected &&
      lastVisibleTabId === activeTab.id &&
      lastVisibleMode === 'edit'
    ) {
      const editorContent = activeTab.editContent ?? activeTab.content;
      if (editor.getContent() !== editorContent) {
        editor.setContent(editorContent);
      }
      return;
    }

    const renderScrollPercentage =
      activeTab.mode === 'edit' && lastVisibleTabId === activeTab.id && lastVisibleMode === 'render'
        ? getScrollPercentage(container.querySelector<HTMLElement>('.content-area__body'))
        : null;

    const bodyChildren: Array<Node | null> = [];

    if (activeTab.loading) {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__loading',
          children: [
            createElement('div', {
              className: 'content-area__spinner',
              attrs: { 'aria-hidden': 'true' },
            }),
            createElement('p', {
              className: 'content-area__loading-copy',
              text: `Loading ${activeTab.filename}...`,
            }),
          ],
        }),
      );
    } else if (activeTab.status === 'deleted') {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__deleted',
          children: [
            createElement('div', {
              className: 'content-area__deleted-banner',
              text: 'File not found. Showing the last known rendered content.',
            }),
            createElement('article', {
              className: 'markdown-body markdown-body--muted',
              attrs: { 'aria-label': activeTab.filename },
            }),
          ],
        }),
      );
    } else if (activeTab.status === 'error') {
      destroyEditor();
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__error',
          text: activeTab.errorMessage ?? 'Failed to load this document.',
        }),
      );
    } else {
      bodyChildren.push(
        createElement('div', {
          className: 'content-area__document',
          children: [
            createElement('article', {
              className: 'markdown-body',
              attrs: {
                'aria-label': activeTab.filename,
                hidden: activeTab.mode === 'edit',
              },
            }),
            createElement('div', {
              className: 'editor-container',
              attrs: {
                hidden: activeTab.mode !== 'edit',
              },
            }),
          ],
        }),
      );
    }

    if (activeTab.mode !== 'edit') {
      destroyEditor();
    }

    container.replaceChildren(
      createElement('section', {
        className: 'content-area__view',
        children: [
          createElement('div', {
            className: 'content-area__body',
            children: bodyChildren,
          }),
        ],
      }),
    );

    if (activeTab.loading || activeTab.status === 'error') {
      if (activeTab.status === 'error') {
        lastVisibleTabId = null;
        lastVisibleMode = null;
      }
      return;
    }

    const markdownBody = container.querySelector<HTMLElement>('.markdown-body');
    if (!markdownBody) {
      return;
    }

    if (activeTab.status === 'deleted') {
      markdownBody.innerHTML = activeTab.html;
      lastVisibleTabId = activeTab.id;
      lastVisibleMode = 'render';
      return;
    }

    if (activeTab.mode === 'edit') {
      const nextEditorHost = container.querySelector<HTMLElement>('.editor-container');
      if (!nextEditorHost) {
        return;
      }

      const currentEditor = ensureEditor(nextEditorHost, activeTab.id);
      const editorContent = activeTab.editContent ?? activeTab.content;
      if (currentEditor.getContent() !== editorContent) {
        currentEditor.setContent(editorContent);
      }
      if (renderScrollPercentage !== null) {
        currentEditor.scrollToPercentage(renderScrollPercentage);
      } else {
        currentEditor.setScrollTop(activeTab.editScrollPosition);
      }
      currentEditor.focus();
      lastVisibleTabId = activeTab.id;
      lastVisibleMode = 'edit';
      return;
    }

    let html = activeTab.html;
    let serverWarnings = activeTab.warnings.filter((warning) => warning.type !== 'mermaid-error');
    const renderingGeneration = activeTab.renderGeneration ?? 0;

    if (
      activeTab.dirty &&
      activeTab.editContent &&
      actions.onRenderContent &&
      lastRenderedDirtyContent.get(activeTab.id) !== activeTab.editContent
    ) {
      const response = await actions.onRenderContent(activeTab.editContent, activeTab.path);
      const latestTab = getActiveTab();
      if (
        !latestTab ||
        latestTab.id !== activeTab.id ||
        latestTab.mode !== 'render' ||
        (latestTab.renderGeneration ?? 0) !== renderingGeneration
      ) {
        return;
      }

      html = response.html;
      serverWarnings = response.warnings;
      lastRenderedDirtyContent.set(activeTab.id, activeTab.editContent);

      if (
        latestTab.html !== response.html ||
        !warningsEqual(
          latestTab.warnings.filter((warning) => warning.type !== 'mermaid-error'),
          response.warnings,
        )
      ) {
        store.update(
          {
            tabs: store
              .get()
              .tabs.map((tab) =>
                tab.id === activeTab.id
                  ? { ...tab, html: response.html, warnings: response.warnings }
                  : tab,
              ),
          },
          ['tabs'],
        );
      }
    } else if (!activeTab.dirty || !activeTab.editContent) {
      lastRenderedDirtyContent.delete(activeTab.id);
    }

    markdownBody.innerHTML = html;
    if (actions.onOpenMarkdownLink && actions.onOpenExternalLink && actions.onLinkError) {
      attachLinkHandler(markdownBody, {
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        openFile: actions.onOpenMarkdownLink,
        api: {
          openExternal: actions.onOpenExternalLink,
        },
        showError: actions.onLinkError,
      });
    }

    lastVisibleTabId = activeTab.id;
    lastVisibleMode = 'render';

    const renderingTabId = activeTab.id;
    const mermaidResult = await renderMermaidBlocks(markdownBody);
    const currentState = store.get();
    if (currentState.activeTabId !== renderingTabId) {
      return;
    }

    const currentTab = currentState.tabs.find((tab) => tab.id === renderingTabId);
    if (!currentTab) {
      return;
    }
    if (
      (currentTab.renderGeneration ?? 0) !== renderingGeneration ||
      currentTab.mode !== 'render'
    ) {
      return;
    }

    const allWarnings = [...serverWarnings, ...mermaidResult.warnings];
    if (warningsEqual(currentTab.warnings, allWarnings)) {
      return;
    }

    store.update(
      {
        tabs: currentState.tabs.map((tab) =>
          tab.id === renderingTabId ? { ...tab, warnings: allWarnings } : tab,
        ),
      },
      ['tabs'],
    );
  };

  void render();
  const unsubscribe = store.subscribe(() => {
    void render();
  });

  return () => {
    unsubscribe();
    for (const timer of dirtyTimers.values()) {
      clearTimeout(timer);
    }
    dirtyTimers.clear();
    destroyEditor();
  };
}
