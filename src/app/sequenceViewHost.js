// ============================================
// BioGenesis — Sequence view mounting
// ============================================
//
// The sequence view owns a canvas and window-level listeners, so unlike the
// string-rendering tools it cannot simply be overwritten by the next
// `innerHTML`. This module keeps the single live instance and tears it down
// before the panel is re-rendered, which is the one thing every caller must not
// forget.

import { createSequenceView } from '../viewer/SequenceView.js';

/** @type {import('../viewer/SequenceView.js').SequenceViewHandle|null} */
let active = null;

/**
 * Markup for the panel slot the view mounts into.
 *
 * @returns {string}
 */
export function sequenceViewMarkup() {
    return `<div class="selection-workflow"><span id="selection-action-hint" data-vi="Tô đoạn → chuột phải để chọn thao tác" data-en="Select a region → right-click for actions">Tô đoạn → chuột phải để chọn thao tác</span><div>${[['primer','Thiết kế mồi','Design primers'],['translation','Dịch đoạn chọn','Translate region'],['export','Xuất FASTA','Export FASTA']].map(([id,vi,en]) => `<button class="btn btn-secondary" data-region-action="${id}" disabled data-vi="${vi}" data-en="${en}">${vi}</button>`).join('')}</div></div><div class="sv-host" id="sequence-view-host"></div>`;
}

/**
 * Mount the view over the slot rendered by {@link sequenceViewMarkup}.
 *
 * @param {import('../core/types.js').Sequence} sequence
 * @param {Object} handlers
 * @param {(msg: string) => void} handlers.setStatus
 * @param {(range: {start: number, end: number, sequence: string}) => void} handlers.onExtract
 * @param {(range: {start: number, end: number}) => void} handlers.onAnnotate
 * @param {(action: string, range: {start: number, end: number}) => void} [handlers.onRegionAction]
 * @returns {void}
 */
export function mountSequenceView(sequence, { setStatus, onExtract, onAnnotate, onRegionAction }) {
    destroySequenceView();
    const host = document.getElementById('sequence-view-host');
    if (!host || !sequence) return;

    active = createSequenceView({
        host,
        sequence,
        onStatus: summary => {
            const el = document.getElementById('status-selection');
            if (el) el.textContent = summary;
            setStatus(summary);
            const range = active?.getSelection();
            document.querySelectorAll('[data-region-action]').forEach(element => {
                const button = /** @type {HTMLButtonElement} */ (element);
                button.disabled = !range || (button.dataset.regionAction !== 'export' && sequence.type === 'protein') || (button.dataset.regionAction === 'primer' && sequence.type !== 'dna');
            });
        },
        onExtract,
        onAnnotate,
        onRegionAction,
    });
    document.querySelectorAll('[data-region-action]').forEach(element => {
        const button = /** @type {HTMLButtonElement} */ (element);
        button.addEventListener('click', () => {
            const range = active?.getSelection();
            if (range) onRegionAction?.(button.dataset.regionAction || '', {...range});
        });
    });
}

/**
 * Tear the live view down, if there is one. Safe to call when there is not.
 *
 * @returns {void}
 */
export function destroySequenceView() {
    active?.destroy();
    active = null;
    const el = document.getElementById('status-selection');
    if (el) el.textContent = '';
}

/**
 * The live view, for callers that want to drive its selection.
 *
 * @returns {import('../viewer/SequenceView.js').SequenceViewHandle|null}
 */
export function activeSequenceView() {
    return active;
}
