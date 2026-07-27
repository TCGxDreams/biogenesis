// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — Modal dialogs
// ============================================
//
// The shared modal plus the dialogs that use it.

import { detectSequenceType } from '../utils/bioUtils.js';
import { autoAnnotate } from '../utils/autoAnnotate.js';

/**
 * The application context, assigned by createDialogs(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the modal and its dialogs.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createDialogs(context) {
    app = context;
    return { showNewSequenceDialog, showAnnotationDialog, showModal, hideModal };
}

function showNewSequenceDialog() {
    showModal(`
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;">New Sequence</h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Name</label>
      <input class="form-input" id="new-seq-name" type="text" placeholder="My Sequence" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Sequence</label>
      <textarea id="new-seq-data" rows="6" placeholder="ATCGATCG..." style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;resize:vertical;outline:none;"></textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;">Create</button>
    </div>
  `);

    document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
        const name = document.getElementById('new-seq-name')?.value || 'Untitled';
        const seqData = (document.getElementById('new-seq-data')?.value || '').replace(
            /[^A-Za-z*]/g,
            ''
        );
        if (!seqData) {
            app.setStatus('Please enter a sequence');
            return;
        }
        const type = detectSequenceType(seqData);
        const newSeq = {
            name,
            sequence: seqData,
            type,
            annotations: [],
            description: 'User-created sequence',
        };
        autoAnnotate(newSeq);
        app.setState({ sequences: [...app.state.sequences, newSeq] });
        app.renderFileTree();
        app.openSequence(app.state.sequences.length - 1);
        hideModal();
        app.setStatus(`Created: ${name}`);
    });
}

function showAnnotationDialog(seq) {
    showModal(`
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;">Add Annotation</h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label">Feature Name</label>
      <input class="form-input" id="ann-name" type="text" placeholder="e.g., GFP" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Type</label>
        <select id="ann-type" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="gene">Gene</option><option value="CDS">CDS</option><option value="promoter">Promoter</option>
          <option value="terminator">Terminator</option><option value="rep_origin">Origin of Replication</option>
          <option value="primer_bind">Primer Binding Site</option><option value="misc_feature">Misc Feature</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">Strand</label>
        <select id="ann-strand" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="forward">Forward (+)</option><option value="reverse">Reverse (-)</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label">Start Position</label>
        <input class="form-input" id="ann-start" type="number" value="1" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label">End Position</label>
        <input class="form-input" id="ann-end" type="number" value="${Math.min(100, seq.sequence.length)}" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;">Cancel</button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;">Add</button>
    </div>
  `);

    document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
        const name = document.getElementById('ann-name')?.value || 'Feature';
        const type = document.getElementById('ann-type')?.value || 'misc_feature';
        const strand = document.getElementById('ann-strand')?.value || 'forward';
        const start = parseInt(document.getElementById('ann-start')?.value || '1') - 1;
        const end = parseInt(document.getElementById('ann-end')?.value || '100');
        if (!seq.annotations) seq.annotations = [];
        seq.annotations.push({ name, type, start, end, direction: strand });
        hideModal();
        app.renderToolPanel();
        app.setStatus(`Added annotation: ${name}`);
    });
}

function showModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    if (overlay && modalContent) {
        modalContent.innerHTML = content;
        overlay.classList.remove('hidden');
    }
}

function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
}
