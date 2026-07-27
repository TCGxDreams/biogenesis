// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Tool panel routing
// ============================================
//
// Decides what the main panel shows: the welcome screen when nothing is open,
// otherwise the active tool from the registry. Also keeps the sidebar's tool
// list in step with what the current selection can actually run.

import { TOOLS, getTool, toolUnavailableReason } from './tools.js';

/**
 * The application context, assigned by createPanel(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the panel renderer and sequence opener.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createPanel(context) {
    app = context;
    return {
        openSequence,
        renderToolPanel,
        updateToolAvailability,
        renderWelcomeScreen,
        makeWelcomeCard,
        renderQuickActions,
        bindCrossToolActions,
    };
}

function openSequence(idx) {
    app.setState({ activeSequenceIdx: idx });
    // Toggle active class without re-rendering entire file tree
    app.updateFileTreeActive(idx);

    const seq = app.state.sequences[idx];
    let existingTab = app.state.tabs.find(t => t.seqIdx === idx);
    if (!existingTab) {
        const tab = { id: ++app.state.tabCounter, seqIdx: idx, name: seq.name };
        app.setState({ tabs: [...app.state.tabs, tab] });
        existingTab = tab;
    }
    app.setState({ activeTabId: existingTab.id });
    app.renderTabs();
    renderToolPanel();
    app.setStatus(
        `Viewing: ${seq.name} (${seq.sequence.length} ${seq.type === 'protein' ? 'aa' : 'bp'})`
    );
}

function renderWelcomeScreen() {
    const panel = document.getElementById('panel-container');
    if (!panel) return;
    panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:40px;">
      <div style="width:64px;height:64px;border-radius:50%;border:2px solid var(--accent-cyan);display:flex;align-items:center;justify-content:center;opacity:0.6;">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <path d="M8 14 C8 8, 14 6, 14 14 C14 6, 20 8, 20 14 C20 20, 14 22, 14 14 C14 22, 8 20, 8 14Z" fill="url(#wg)"/>
          <defs><linearGradient id="wg" x1="0" y1="0" x2="28" y2="28"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
        </svg>
      </div>
      <h1 style="font-size:28px;font-weight:700;background:var(--gradient-accent);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">BioGenesis</h1>
      <p style="color:var(--text-secondary);font-size:14px;max-width:500px;text-align:center;line-height:1.6;">Premium Bioinformatics Suite — Sequence Analysis, Alignment, Phylogenetics, Cloning, and More</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
        ${makeWelcomeCard('Import File', 'import', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>')}
        ${makeWelcomeCard('New Sequence', 'new', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>')}
        ${makeWelcomeCard('Sample: pUC19', 'sample-0', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3a3 3 0 013 3" stroke-width="2.5" opacity="0.5"/></svg>')}
        ${makeWelcomeCard('Sample: GFP', 'sample-1', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>')}
        ${makeWelcomeCard('BLAST Search', 'blast', '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>')}
      </div>
    </div>
  `;

    panel.querySelectorAll('.welcome-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            if (action === 'import') document.getElementById('file-input')?.click();
            else if (action === 'new') app.showNewSequenceDialog();
            else if (action === 'blast') app.switchTool('blast');
            else if (action.startsWith('sample-')) openSequence(parseInt(action.split('-')[1]));
        });
    });
}

function makeWelcomeCard(label, action, iconSvg) {
    return `
    <div class="welcome-card" data-action="${action}" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 28px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-lg);cursor:pointer;transition:all var(--transition-normal);min-width:120px;" onmouseover="this.style.borderColor='var(--accent-cyan)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border-default)';this.style.transform='none'">
      <span style="color:var(--text-muted);">${iconSvg}</span>
      <span style="font-size:12px;color:var(--text-secondary);">${label}</span>
    </div>`;
}

function renderToolPanel() {
    const panel = document.getElementById('panel-container');
    if (!panel) return;

    const tool = getTool(app.state.activeTool);
    const context = {
        sequences: app.state.sequences,
        activeSequenceIdx: app.state.activeSequenceIdx,
    };
    const seq =
        app.state.activeSequenceIdx >= 0 ? app.state.sequences[app.state.activeSequenceIdx] : null;

    if (!seq && tool.usesActiveSequence !== false) {
        renderWelcomeScreen();
        return;
    }

    panel.innerHTML =
        tool.render(seq, context) + (tool.appendQuickActions ? renderQuickActions(seq) : '');
    tool.bind?.(seq, context);
    app.toolBindings[tool.id]?.(seq);

    bindCrossToolActions();
    updateToolAvailability();
}

// Disable tools that cannot run on the current selection, rather than letting
// them render an error after the fact.
function updateToolAvailability() {
    const context = {
        sequences: app.state.sequences,
        activeSequenceIdx: app.state.activeSequenceIdx,
    };
    document.querySelectorAll('.tool-btn').forEach(btn => {
        const tool = TOOLS[btn.dataset.tool];
        if (!tool) return;
        const reason = toolUnavailableReason(tool, context);
        btn.disabled = reason !== null;
        btn.classList.toggle('tool-btn-disabled', reason !== null);
        if (reason) btn.title = reason;
        else btn.removeAttribute('title');
    });
}

function renderQuickActions(seq) {
    if (!seq) return '';
    const isProtein = seq.type === 'protein';
    const isDNA = seq.type === 'dna';
    const isRNA = seq.type === 'rna';
    const hasPdb = !!seq.pdbId;
    const isCircular = seq.topology === 'circular';

    const actions = [];
    if (isDNA || isRNA) {
        actions.push({
            tool: 'translation',
            label: 'Translate',
            icon: '<path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04z"/><path d="M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>',
        });
        actions.push({
            tool: 'properties',
            label: 'GC Plot',
            icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        });
        actions.push({
            tool: 'restriction',
            label: 'Restriction Sites',
            icon: '<path d="M14.5 2H18l-4 8 4 8h-3.5L11 12z"/><path d="M5.5 2H9l4 8-4 8H5.5l4-8z"/>',
        });
        actions.push({
            tool: 'motif',
            label: 'Find Motifs',
            icon: '<circle cx="10" cy="10" r="7"/><path d="M20 21l-4.35-4.35"/><line x1="8" y1="10" x2="12" y2="10"/><line x1="10" y1="8" x2="10" y2="12"/>',
        });
        actions.push({
            tool: 'primer',
            label: 'Design Primers',
            icon: '<path d="M2 12h6"/><path d="M16 12h6"/><circle cx="12" cy="12" r="4"/>',
        });
        if (isDNA)
            actions.push({
                tool: 'codon',
                label: 'Codon Optimize',
                icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
            });
    }
    if (isCircular) {
        actions.push({
            tool: 'plasmid',
            label: 'Plasmid Map',
            icon: '<circle cx="12" cy="12" r="9"/>',
        });
    }
    actions.push({
        tool: 'linearmap',
        label: 'Linear Map',
        icon: '<line x1="2" y1="12" x2="22" y2="12"/><circle cx="2" cy="12" r="1.5" fill="currentColor"/><circle cx="22" cy="12" r="1.5" fill="currentColor"/>',
    });
    if (isProtein || hasPdb) {
        actions.push({
            tool: 'protein3d',
            label: 'View 3D Structure',
            icon: '<path d="M12 2l8 4.5v9L12 22l-8-6.5v-9L12 2z"/>',
        });
    }
    if (isProtein) {
        actions.push({
            tool: 'properties',
            label: 'Hydrophobicity',
            icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        });
    }
    actions.push({
        tool: 'stats',
        label: 'Statistics',
        icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>',
    });

    return `
    <div style="padding:12px 16px;border-top:1px solid var(--border-muted);">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Quick Actions</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${actions
            .map(
                a => `
          <button class="cross-tool-btn" data-cross-tool="${a.tool}"
            style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg-tertiary);border:1px solid var(--border-muted);border-radius:var(--radius-sm);color:var(--text-secondary);font-size:11px;cursor:pointer;transition:all 0.15s;font-family:var(--font-sans);"
            onmouseover="this.style.borderColor='var(--accent-cyan)';this.style.color='var(--accent-cyan)'"
            onmouseout="this.style.borderColor='var(--border-muted)';this.style.color='var(--text-secondary)'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.icon}</svg>
            ${a.label}
          </button>
        `
            )
            .join('')}
      </div>
    </div>
  `;
}

function bindCrossToolActions() {
    document.querySelectorAll('.cross-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.crossTool;
            if (tool) app.switchTool(tool);
        });
    });
}
