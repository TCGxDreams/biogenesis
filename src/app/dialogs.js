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
let previousFocus;

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
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;"><span data-i18n="New Sequence">New Sequence</span></h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label"><span data-i18n="Name">Name</span></label>
      <input class="form-input" id="new-seq-name" type="text" placeholder="My Sequence" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label"><span data-i18n="Sequence">Sequence</span></label>
      <textarea id="new-seq-data" rows="6" placeholder="ATCGATCG..." style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-family:var(--font-mono);font-size:13px;resize:vertical;outline:none;"></textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;"><span data-i18n="Cancel">Cancel</span></button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;"><span data-i18n="Create">Create</span></button>
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

// `range` pre-fills the coordinate boxes, so annotating a selection made in the
// sequence view does not mean retyping what the user already picked out.
function showAnnotationDialog(seq, range) {
    const presetStart = range ? range.start + 1 : 1;
    const presetEnd = range ? range.end : Math.min(100, seq.sequence.length);
    showModal(`
    <h3 style="margin-bottom:16px;font-size:15px;font-weight:600;"><span data-i18n="Add Annotation">Add Annotation</span></h3>
    <div class="form-group" style="margin-bottom:12px;">
      <label class="form-label"><span data-i18n="Feature Name">Feature Name</span></label>
      <input class="form-input" id="ann-name" type="text" placeholder="e.g., GFP" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label"><span data-i18n="Type">Type</span></label>
        <select id="ann-type" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="gene">Gene</option><option value="CDS">CDS</option><option value="promoter">Promoter</option>
          <option value="terminator">Terminator</option><option value="rep_origin">Origin of Replication</option>
          <option value="primer_bind">Primer Binding Site</option><option value="misc_feature">Misc Feature</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label"><span data-i18n="Strand">Strand</span></label>
        <select id="ann-strand" style="width:100%;padding:6px 8px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:12px;">
          <option value="forward" data-i18n="Forward (+)">Forward (+)</option><option value="reverse" data-i18n="Reverse (-)">Reverse (-)</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:12px;">
      <div class="form-group" style="flex:1;">
        <label class="form-label"><span data-i18n="Start Position">Start Position</span></label>
        <input class="form-input" id="ann-start" type="number" value="${presetStart}" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
      <div class="form-group" style="flex:1;">
        <label class="form-label"><span data-i18n="End Position">End Position</span></label>
        <input class="form-input" id="ann-end" type="number" value="${presetEnd}" min="1" max="${seq.sequence.length}" style="width:100%;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;outline:none;" />
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn" id="modal-cancel" style="padding:6px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;"><span data-i18n="Cancel">Cancel</span></button>
      <button class="btn btn-primary" id="modal-confirm" style="padding:6px 16px;background:var(--accent-cyan);border:none;border-radius:var(--radius-sm);color:#000;font-weight:600;cursor:pointer;"><span data-i18n="Add">Add</span></button>
    </div>
  `);

    document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
        const name = document.getElementById('ann-name')?.value || 'Feature';
        const type = document.getElementById('ann-type')?.value || 'misc_feature';
        const strand = document.getElementById('ann-strand')?.value || 'forward';
        const start = Number(document.getElementById('ann-start')?.value) - 1;
        const end = Number(document.getElementById('ann-end')?.value);
        if (!Number.isInteger(start) || !Number.isInteger(end) ||
            start < 0 || end <= start || end > seq.sequence.length) {
            app.setStatus(`Enter a valid range: 1 ≤ start ≤ end ≤ ${seq.sequence.length}`);
            return;
        }
        // Written to `features`, which is the list every renderer reads.
        // `annotations` is the auto-annotator's own scratch list and shows up
        // nowhere, so an annotation added there would silently vanish.
        if (!seq.features) seq.features = [];
        seq.features.push({ name, type, start, end, direction: strand });
        app.setState({ sequences: [...app.state.sequences] });
        hideModal();
        app.renderToolPanel();
        app.setStatus(`Added annotation: ${name}`);
    });
}

function showModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    if (overlay && modalContent) {
        previousFocus = document.activeElement;
        modalContent.innerHTML = `<button type="button" class="modal-dismiss" aria-label="Đóng / Close">×</button>` + content;
        modalContent.setAttribute?.('role','dialog');
        modalContent.setAttribute?.('aria-modal','true');
        modalContent.setAttribute?.('aria-label','BioGenesis');
        modalContent.querySelector?.('.modal-dismiss')?.addEventListener('click',hideModal);
        if (!overlay._dialogEvents) {
            overlay.addEventListener('click', event => { if (event.target === overlay) hideModal(); });
            overlay.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); hideModal(); }
                if (event.key !== 'Tab') return;
                const controls = Array.from(modalContent.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')).filter(el => el.getClientRects().length);
                const first = controls[0], last = controls[controls.length-1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            });
            overlay._dialogEvents = true;
        }
        overlay.classList.remove('hidden');
        modalContent.querySelector?.('input,textarea,select,button')?.focus();
    }
}

function hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    previousFocus?.focus?.();
}
