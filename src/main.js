// ============================================
// BioGenesis — Application entry point
// ============================================
//
// Creates the store, wires the app modules together, and boots. All behaviour
// lives in src/app/*; this file only composes it.

// @ts-expect-error -- Vite resolves CSS imports; TypeScript does not.
import './style.css';
import { initLearning } from './app/learning.js';
import { initLanguage } from './app/i18n.js';
import { SAMPLE_SEQUENCES } from './data/sampleSequences.js';
import { supabase } from './services/supabase.js';
import { initAccount } from './app/account.js';
import { loadWorkspace, saveWorkspace, setWorkspaceOwner } from './utils/storage.js';

import { createAnalysisDocuments } from './app/analysisDocuments.js';
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
        analysisDocuments: [],
        activeAnalysisId: null,
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
    createAnalysisDocuments(app),
    createFileTree(app),
    createTabs(app),
    createPanel(app),
    createToolbar(app),
    createNcbiFetch(app),
    createDialogs(app)
);

app.toolBindings = createToolBindings({
    state: app.state,
    addEditedSequence: seq => {
        app.setState({sequences:[...app.state.sequences,seq],activeTool:'viewer'});
        app.renderFileTree(); app.openSequence(app.state.sequences.length-1);
        app.setStatus(`Saved edited copy: ${seq.name}`);
    },
    setSequenceTopology: (seq,topology) => {
        if (seq.type === 'protein') return;
        seq.topology = topology;
        app.setState({sequences:[...app.state.sequences]});
        app.renderFileTree(); app.setStatus(`Topology: ${topology}`);
    },
    saveAnalysisDocument: doc => {
        app.setState({analysisDocuments:[...app.state.analysisDocuments, doc]});
        app.renderFileTree();
        app.openAnalysisDocument(doc.id);
    },
    setStatus: msg => app.setStatus(msg),
    showAnnotationDialog: seq => app.showAnnotationDialog(seq),
});

/**
 * Restore the saved workspace (or fall back to the samples) and render.
 *
 * @returns {Promise<void>}
 */
async function init() {
    const sessionResult = supabase ? await supabase.auth.getSession() : null;
    const user = sessionResult?.data.session?.user || null;
    setWorkspaceOwner(user?.id || null);
    try {
        const savedState = await loadWorkspace();
        if (savedState && Array.isArray(savedState.sequences)) {
            app.setState({
                sequences: savedState.sequences,
                analysisDocuments: savedState.analysisDocuments || [],
                activeAnalysisId: savedState.activeAnalysisId || null,
                tabs: savedState.tabs || [],
                activeTabId: savedState.activeTabId,
                tabCounter: savedState.tabCounter || 0,
                activeSequenceIdx: savedState.activeSequenceIdx ?? -1,
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

    initAccount(app, store, user);
    initTheme();
    app.renderFileTree();
    app.bindToolNav();
    app.bindToolbar();
    app.bindNcbiFetch();
    initLearning(app);

    if (app.state.activeTabId != null) {
        app.renderTabs();
        app.renderToolPanel();
    } else {
        app.renderWelcomeScreen();
    }

    app.setStatus('Ready');
    initLanguage();
}

init();
