// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Open document tabs
// ============================================

/**
 * The application context, assigned by createTabs(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the tab strip renderer.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createTabs(context) {
    app = context;
    return { renderTabs };
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    if (!container) return;
    container.innerHTML = app.state.tabs
        .map(
            tab => `
    <button class="tab${tab.id === app.state.activeTabId ? ' active' : ''}" data-tab-id="${tab.id}">
      <span>${app.escapeHtml(tab.name)}</span>
      <span class="tab-close" data-close-tab="${tab.id}">&times;</span>
    </button>
  `
        )
        .join('');

    container.querySelectorAll('.tab').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.classList.contains('tab-close')) return;
            const tabId = parseInt(el.dataset.tabId);
            const tab = app.state.tabs.find(t => t.id === tabId);
            if (tab) {
                app.setState({ activeTabId: tabId });
                app.openSequence(tab.seqIdx);
            }
        });
    });

    container.querySelectorAll('.tab-close').forEach(el => {
        el.addEventListener('click', e => {
            e.stopPropagation();
            const tabId = parseInt(el.dataset.closeTab);
            app.setState({ tabs: app.state.tabs.filter(t => t.id !== tabId) });
            if (app.state.activeTabId === tabId) {
                if (app.state.tabs.length > 0) {
                    app.setState({ activeTabId: app.state.tabs[app.state.tabs.length - 1].id });
                    app.openSequence(app.state.tabs[app.state.tabs.length - 1].seqIdx);
                } else {
                    app.setState({ activeTabId: null, activeSequenceIdx: -1 });
                    app.renderWelcomeScreen();
                }
            }
            renderTabs();
        });
    });
}
