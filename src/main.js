// ============================================
// BioGenesis — Application entry point
// ============================================
//
// Creates the store, wires the app modules together, and boots. All behaviour
// lives in src/app/*; this file only composes it.

// @ts-expect-error -- Vite resolves CSS imports; TypeScript does not.
import './style.css';
import { SAMPLE_SEQUENCES } from './data/sampleSequences.js';
import { loadWorkspace, saveWorkspace } from './utils/storage.js';

import { createStore } from './app/store.js';
import { createStatusBar, escapeHtml, initTheme } from './app/ui.js';
import { createFileTree } from './app/fileTree.js';
import { createTabs } from './app/tabs.js';
import { createPanel } from './app/panel.js';
import { createToolbar } from './app/toolbar.js';
import { createNcbiFetch } from './app/ncbi.js';
import { createDialogs } from './app/dialogs.js';
import { createToolBindings } from './app/toolBindings.js';

/**
 * @typedef {import('./app/types.js').App} App
 * @typedef {import('./app/types.js').WorkspaceState} WorkspaceState
 */

const store = createStore(
    {
        sequences: [],
        activeSequenceIdx: -1,
        activeTool: 'viewer',
        tabs: [],
        activeTabId: null,
        tabCounter: 0,
    },
    { persist: /** @type {(state: Object) => Promise<void>} */ (saveWorkspace), debounceMs: 1000 }
);

// Built in two steps: the base fields first, then the module factories, which
// need `app` to exist before they can look collaborators up on it.
const app = /** @type {App} */ ({
    state: store.getState(),
    setState: store.setState,
    escapeHtml,
});

Object.assign(
    app,
    createStatusBar(app),
    createFileTree(app),
    createTabs(app),
    createPanel(app),
    createToolbar(app),
    createNcbiFetch(app),
    createDialogs(app)
);

app.toolBindings = createToolBindings({
    state: app.state,
    setStatus: msg => app.setStatus(msg),
    showAnnotationDialog: seq => app.showAnnotationDialog(seq),
});

/**
 * Restore the saved workspace (or fall back to the samples) and render.
 *
 * @returns {Promise<void>}
 */
async function init() {
    try {
        const savedState = await loadWorkspace();
        if (savedState && savedState.sequences && savedState.sequences.length > 0) {
            app.setState({
                sequences: savedState.sequences,
                tabs: savedState.tabs || [],
                activeTabId: savedState.activeTabId,
                tabCounter: savedState.tabCounter || 0,
                activeSequenceIdx: savedState.activeSequenceIdx || -1,
            });
        } else {
            app.setState({ sequences: [...SAMPLE_SEQUENCES] });
        }
    } catch (err) {
        console.warn('Failed to load workspace, using default', err);
        app.setState({ sequences: [...SAMPLE_SEQUENCES] });
    }
    // Restoring is not a user edit; drop the save the writes above scheduled.
    store.cancelPendingSave();

    initTheme();
    app.renderFileTree();
    app.bindToolNav();
    app.bindToolbar();
    app.bindNcbiFetch();

    if (app.state.activeTabId != null) {
        app.renderTabs();
        app.renderToolPanel();
    } else {
        app.renderWelcomeScreen();
    }

    app.setStatus('Ready');
}

init();
