// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Tool panel routing
// ============================================
//
// Decides what the main panel shows: the welcome screen when nothing is open,
// otherwise the active tool from the registry. Also keeps the sidebar's tool
// list in step with what the current selection can actually run.

import { workspaceMarkup } from './workspace.js';
import { TOOLS, getTool, toolUnavailableReason } from './tools.js';
import { mountSequenceView, destroySequenceView } from './sequenceViewHost.js';

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
    app.setState({ activeSequenceIdx: idx, activeAnalysisId: null });
    // Toggle active class without re-rendering entire file tree
    app.updateFileTreeActive(idx);

    const seq = app.state.sequences[idx];
    if (toolUnavailableReason(getTool(app.state.activeTool),app.state)) app.setState({activeTool:'viewer'});
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
    destroySequenceView();
    document.getElementById('workspace-context')?.remove();
    panel.innerHTML = workspaceMarkup(app.state.sequences);
    if (app.state.analysisDocuments?.length) {
        const section = document.createElement('section');
        section.className = 'analysis-document panel-body';
        section.innerHTML = `<h2 data-vi="Tài liệu phân tích đã lưu" data-en="Saved analysis documents">Tài liệu phân tích đã lưu</h2><div class="analysis-actions">${app.state.analysisDocuments.map(doc => `<button class="btn btn-secondary" data-analysis-id="${app.escapeHtml(doc.id)}">${doc.kind === 'alignment' ? 'ALN' : 'TREE'} · ${app.escapeHtml(doc.name)}</button>`).join('')}</div>`;
        panel.append(section);
        section.querySelectorAll('[data-analysis-id]').forEach(button => button.addEventListener('click', () => app.openAnalysisDocument(button.dataset.analysisId)));
    }
    updateToolAvailability();
    panel.querySelectorAll('[data-open-document]').forEach(button => {
        button.addEventListener('click', () => {
            app.setState({ activeTool: button.dataset.documentTool || 'viewer' });
            openSequence(Number(button.dataset.openDocument));
        });
    });
    panel.querySelectorAll('[data-workspace-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.workspaceAction;
            if (action === 'library') document.getElementById('learning-hub-btn')?.click();
            if (action === 'database') document.getElementById('database-search-btn')?.click();
            if (action === 'import') document.getElementById('btn-import')?.click();
            if (action === 'new') app.showNewSequenceDialog();
            if (action === 'learn') {
                document.dispatchEvent(new Event('biogenesis:start-first-lesson'));
            }
        });
    });
    let selectedType = 'all';
    const filter = () => {
        const query = panel.querySelector('#workspace-search').value.trim().toLowerCase();
        const type = selectedType;
        let count = 0;
        panel.querySelectorAll('[data-document-row]').forEach(row => {
            row.hidden = !row.dataset.name.includes(query) || (type !== 'all' && row.dataset.type !== type);
            if (!row.hidden) count++;
        });
        panel.querySelector('#workspace-no-results').hidden = count > 0;
        panel.querySelector('#workspace-result-count').innerHTML = `<span data-vi="Hiển thị ${count} / ${app.state.sequences.length} trình tự" data-en="Showing ${count} of ${app.state.sequences.length} sequences">Hiển thị ${count} / ${app.state.sequences.length} trình tự</span>`;
    };
    panel.querySelector('#workspace-search').addEventListener('input', filter);
    panel.querySelectorAll('[data-workspace-type]').forEach(button => {
        button.addEventListener('click', () => {
            selectedType = button.dataset.workspaceType;
            panel.querySelectorAll('[data-workspace-type]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
            filter();
        });
    });
    filter();
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

    // The sequence view holds canvas and window listeners that outlive an
    // `innerHTML` swap, so it has to be torn down before anything is written.
    destroySequenceView();

    if (app.state.activeAnalysisId) {
        app.renderAnalysisDocument();
        updateToolAvailability();
        return;
    }

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

    renderContext(seq, tool);
    panel.innerHTML =
        tool.render(seq, context) + (tool.appendQuickActions ? renderQuickActions(seq) : '');
    tool.bind?.(seq, context);
    app.toolBindings[tool.id]?.(seq);

    if (tool.id === 'viewer' && seq) {
        mountSequenceView(seq, {
            setStatus: msg => app.setStatus(msg),
            onExtract: range => extractToDocument(seq, range),
            onAnnotate: range => app.showAnnotationDialog(seq, range),
        });
    }

    bindCrossToolActions();
    updateToolAvailability();
}

function renderContext(seq, tool) {
    document.getElementById('workspace-context')?.remove();
    const bar = document.createElement('div');
    bar.id = 'workspace-context';
    bar.innerHTML = `<div class="context-heading"><span>${seq ? app.escapeHtml(seq.name) : 'Workspace analysis'}</span><small>${seq ? `${seq.type.toUpperCase()} · ${seq.sequence.length.toLocaleString()} ${seq.type === 'protein' ? 'aa' : 'bp'}` : tool.label}</small></div>
      <nav aria-label="Document views">${(seq?.type === 'protein' ? ['viewer', 'protein3d', 'stats', 'editor'] : ['viewer', 'editor', 'linearmap', 'plasmid', 'stats', 'translation']).map(id => {
          const item = TOOLS[id];
          if (!item || toolUnavailableReason(item, app.state)) return '';
          return `<button data-view="${id}" aria-pressed="${tool.id === id}" class="${tool.id === id ? 'active' : ''}">${id === 'protein3d' ? '<span data-vi="Xem 3D / Dự đoán" data-en="3D / Predict">Xem 3D / Dự đoán</span>' : `<span data-i18n="${item.label}">${item.label}</span>`}</button>`;
      }).join('')}</nav>`;
    document.getElementById('panel-container').before(bar);
    bar.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => app.switchTool(button.dataset.view)));
}

// Disable tools that cannot run on the current selection, rather than letting
// them render an error after the fact.
function updateToolAvailability() {
    const selected = app.state.sequences[app.state.activeSequenceIdx];
    for (const id of ['btn-export', 'btn-rc', 'btn-translate']) {
        const button = document.getElementById(id);
        if (button) button.disabled = id === 'btn-export' && app.state.activeAnalysisId ? false : !selected || (id !== 'btn-export' && selected.type === 'protein');
    }
    const alignButton = document.getElementById('btn-align');
    if (alignButton) { alignButton.disabled = app.state.sequences.length < 2; alignButton.title = alignButton.disabled ? 'Import at least 2 sequences' : 'Align sequences'; }
    const context = {
        sequences: app.state.sequences,
        activeSequenceIdx: app.state.activeSequenceIdx,
    };
    document.querySelectorAll('.tool-btn').forEach(btn => {
        const tool = TOOLS[btn.dataset.tool];
        if (!tool) return;
        const reason = toolUnavailableReason(tool, context);
        btn.classList.toggle('active', !app.state.activeAnalysisId && btn.dataset.tool === app.state.activeTool && (app.state.activeSequenceIdx >= 0 || tool.usesActiveSequence === false));
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

// Extracting a region produces a new document rather than mutating the source,
// which is what makes a selection safe to experiment with.
function extractToDocument(source, { start, end, sequence }) {
    const extracted = {
        name: `${source.name} ${start + 1}..${end}`,
        description: `Extracted from ${source.name} (${(end - start).toLocaleString()} ${source.type === 'protein' ? 'aa' : 'bp'})`,
        type: source.type,
        topology: 'linear',
        organism: source.organism,
        sequence,
        // Features that fall entirely inside the extracted span come with it,
        // rebased onto the new coordinates; partial overlaps are dropped rather
        // than silently truncated into something biologically wrong.
        features: (source.features || [])
            .filter(f => f.start >= start && f.end <= end)
            .map(f => ({ ...f, start: f.start - start, end: f.end - start })),
    };

    app.setState({ sequences: [...app.state.sequences, extracted] });
    app.renderFileTree();
    openSequence(app.state.sequences.length - 1);
    app.setStatus(`Extracted ${extracted.name}`);
}

function bindCrossToolActions() {
    document.querySelectorAll('.cross-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.crossTool;
            if (tool) app.switchTool(tool);
        });
    });
}
