// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Sidebar file tree
// ============================================
//
// Renders the document list and keeps its active row and count in sync.
// Uses one delegated click listener rather than one per row.

/**
 * The application context, assigned by createFileTree(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the file tree renderers.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createFileTree(context) {
    app = context;
    return { renderFileTree, updateFileTreeActive, updateDocsCount };
}

function renderFileTree() {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    tree.innerHTML = app.state.sequences
        .map((seq, i) => {
            const isActive = i === app.state.activeSequenceIdx;
            const typeLabel =
                seq.type === 'protein'
                    ? 'PRT'
                    : seq.type === 'rna'
                      ? 'RNA'
                      : seq.topology === 'circular'
                        ? 'CIR'
                        : 'DNA';
            return `
      <div class="file-item${isActive ? ' active' : ''}" data-idx="${i}">
        <svg class="file-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${
              seq.type === 'protein'
                  ? '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
                  : seq.topology === 'circular'
                    ? '<circle cx="12" cy="12" r="9"/>'
                    : '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>'
          }
        </svg>
        <span class="file-name">${app.escapeHtml(seq.name)}</span>
        <span class="file-type">${typeLabel}</span>
      </div>`;
        })
        .join('');

    // Event delegation — single listener instead of N listeners
    if (!tree._delegated) {
        tree.addEventListener('click', e => {
            const item = e.target.closest('.file-item');
            if (item && item.dataset.idx != null) {
                app.openSequence(parseInt(item.dataset.idx));
            }
        });
        tree._delegated = true;
    }

    updateDocsCount();
}

// Update file tree active class without full re-render
function updateFileTreeActive(newIdx) {
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    const prev = tree.querySelector('.file-item.active');
    if (prev) prev.classList.remove('active');
    const next = tree.querySelector(`.file-item[data-idx="${newIdx}"]`);
    if (next) next.classList.add('active');
}

// Update document count badge
function updateDocsCount() {
    const el = document.getElementById('docs-count');
    if (el) el.textContent = `(${app.state.sequences.length})`;
}
