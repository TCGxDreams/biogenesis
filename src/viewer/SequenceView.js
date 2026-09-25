// ============================================
// BioGenesis — Interactive sequence view
// ============================================
//
// The workspace's main surface: a scrolling, zoomable, selectable rendering of
// one sequence with its annotation, translation, cut-site and GC tracks drawn in
// register with the residues.
//
// Rendering is a virtualised canvas. A sizer div gives the scroller its real
// height while a single viewport-sized canvas is translated to follow the scroll
// offset, so memory and paint cost stay flat whether the sequence is a 200 bp
// primer or a 200 Mb chromosome. Every geometric question — which residue is
// under the pointer, where a residue is drawn — is answered by core/viewport.js,
// so hit-testing and painting cannot drift apart.

import {
    computeLayout,
    residueAtPoint,
    rowOfResidue,
    zoomToFit,
    charWidthToZoom,
    zoomToCharWidth,
    zoomByFactor,
    DEFAULT_GUTTER_WIDTH,
    clamp,
} from '../core/viewport.js';
import { packFeatureLanes, buildGcIndex } from '../core/tracks.js';
import { computeRowLayout, DEFAULT_TRACKS } from './trackLayout.js';
import { drawView } from './renderer.js';
import { getPalette, invalidatePalette } from './theme.js';
import { openContextMenu, closeContextMenu } from './contextMenu.js';
import { reverseComplement, translate, gcContent } from '../utils/bioUtils.js';
import { findRestrictionSites, RESTRICTION_ENZYMES_UNIQUE } from '../utils/restriction.js';

/** Enzymes offered in the cut-site track: the common cloning panel only. */
const VIEW_ENZYME_PANEL = RESTRICTION_ENZYMES_UNIQUE.filter(e => e.group === 'common');

/** Residue cell width a view opens at: comfortably readable without crowding. */
const DEFAULT_CHAR_WIDTH = 9.5;

/** How much one zoom step multiplies the residue width by. */
const ZOOM_FACTOR = 1.4;

/** @type {Array<{key: keyof import('./trackLayout.js').TrackFlags, label: string, nucleicOnly: boolean}>} */
const TRACK_TOGGLES = [
    { key: 'features', label: 'Annotations', nucleicOnly: false },
    { key: 'complement', label: 'Complement', nucleicOnly: true },
    { key: 'translation', label: 'Translation', nucleicOnly: true },
    { key: 'reverseTranslation', label: 'Rev. translation', nucleicOnly: true },
    { key: 'enzymes', label: 'Cut sites', nucleicOnly: true },
    { key: 'gc', label: 'GC graph', nucleicOnly: true },
];

/**
 * @typedef {Object} SequenceViewOptions
 * @property {(action: string, range: {start: number, end: number}) => void} [onRegionAction]
 * @property {HTMLElement} host Element the view takes over. Its contents are replaced.
 * @property {import('../core/types.js').Sequence} sequence
 * @property {(summary: string) => void} [onStatus] Receives the selection
 *   readout, for the application status bar.
 * @property {(range: {start: number, end: number, sequence: string}) => void} [onExtract]
 *   Called when the user extracts a selection to a new document.
 * @property {(range: {start: number, end: number}) => void} [onAnnotate]
 *   Called when the user asks to annotate a selection.
 */

/**
 * @typedef {Object} SequenceViewHandle
 * @property {() => void} destroy Remove listeners and DOM.
 * @property {() => {start: number, end: number}|null} getSelection
 * @property {(start: number, end: number) => void} select
 * @property {(index: number) => void} scrollToResidue
 * @property {() => void} redraw Repaint, e.g. after a theme change.
 */

/**
 * Mount an interactive sequence view.
 *
 * @param {SequenceViewOptions} options
 * @returns {SequenceViewHandle}
 */
export function createSequenceView({ host, sequence, onStatus, onExtract, onAnnotate, onRegionAction }) {
    const seqStr = sequence.sequence || '';
    const length = seqStr.length;
    const type = /** @type {'dna'|'rna'|'protein'} */ (sequence.type || 'dna');
    const nucleic = type !== 'protein';
    const unit = type === 'protein' ? 'aa' : 'bp';

    const state = {
        zoom: 1,
        /** @type {import('./trackLayout.js').TrackFlags} */
        tracks: { ...DEFAULT_TRACKS, features: (sequence.features?.length ?? 0) > 0 },
        colorResidues: true,
        // While set, the zoom is re-derived on every relayout so the whole
        // sequence keeps filling the window as it is resized.
        fitMode: false,
        /** @type {{start: number, end: number}|null} */
        selection: null,
        /** @type {number|null} */
        cursor: null,
        /** @type {number|null} */
        anchor: null,
        dragging: false,
        scrollTop: 0,
        /** @type {number[]} */
        findMatches: [],
        findIndex: -1,
    };

    const featureLanes = packFeatureLanes(sequence.features || []);
    /** @type {Array<{name: string, positions: number[]}>|null} */
    let cutSites = null;
    /** @type {import('../core/tracks.js').GcIndex|null} */
    let gcIndex = null;

    host.innerHTML = '';
    const dom = buildScaffold(host, sequence, type, length, unit, nucleic);
    const ctx = /** @type {CanvasRenderingContext2D} */ (dom.canvas.getContext('2d'));

    let layout = emptyLayout();
    let rowLayout = computeRowLayout({ tracks: state.tracks, laneCount: 0, type });

    // ---- geometry ----

    /** @returns {import('../core/viewport.js').ViewLayout} */
    function emptyLayout() {
        return computeLayout({ length: Math.max(1, length), viewportWidth: 800, zoom: state.zoom });
    }

    /**
     * Recompute layout, canvas size and scroll extent, then repaint.
     *
     * @returns {void}
     */
    function relayout() {
        const rect = dom.scroll.getBoundingClientRect();
        const viewportWidth = Math.max(200, rect.width);
        const viewportHeight = Math.max(80, rect.height);

        if (state.fitMode) {
            state.zoom = zoomToFit(length, Math.max(1, viewportWidth - DEFAULT_GUTTER_WIDTH));
            dom.zoomSlider.value = String(state.zoom);
        }

        layout = computeLayout({
            length: Math.max(1, length),
            viewportWidth,
            zoom: state.zoom,
        });
        rowLayout = computeRowLayout({
            tracks: state.tracks,
            laneCount: state.tracks.features ? featureLanes.length : 0,
            type,
        });

        dom.sizer.style.height = `${layout.rowCount * rowLayout.rowHeight}px`;
        updateZoomLabel();

        const dpr = window.devicePixelRatio || 1;
        dom.canvas.width = Math.round(viewportWidth * dpr);
        dom.canvas.height = Math.round(viewportHeight * dpr);
        dom.canvas.style.width = `${viewportWidth}px`;
        dom.canvas.style.height = `${viewportHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        state.scrollTop = dom.scroll.scrollTop;
        draw();
    }

    /** @returns {void} */
    function draw() {
        const rect = dom.scroll.getBoundingClientRect();
        dom.canvas.style.transform = `translateY(${state.scrollTop}px)`;
        drawView(ctx, {
            sequence: seqStr,
            type,
            layout,
            rowLayout,
            tracks: state.tracks,
            featureLanes: state.tracks.features ? featureLanes : [],
            cutSites: state.tracks.enzymes ? enzymeCuts() : [],
            gcIndex: state.tracks.gc && nucleic ? (gcIndex ??= buildGcIndex(seqStr)) : null,
            selection: state.selection,
            cursor: state.cursor,
            scrollTop: state.scrollTop,
            width: Math.max(200, rect.width),
            height: Math.max(80, rect.height),
            palette: getPalette(host),
            colorResidues: state.colorResidues,
        });
    }

    /**
     * Cut positions for the enzyme track, computed once and reused.
     *
     * The scan reports recognition-site starts; the track shows where the enzyme
     * actually cuts, which is what a cloning coordinate refers to.
     *
     * @returns {Array<{name: string, positions: number[]}>}
     */
    function enzymeCuts() {
        if (cutSites) return cutSites;
        if (!nucleic) return (cutSites = []);
        cutSites = findRestrictionSites(seqStr, VIEW_ENZYME_PANEL).map(site => ({
            name: site.name,
            positions: site.positions.map(p =>
                Math.min(length - 1, p + Math.min(site.cut, site.site.length))
            ),
        }));
        return cutSites;
    }

    // ---- selection ----

    /**
     * @param {number} index
     * @param {boolean} extend Keep the existing anchor instead of moving it.
     * @returns {void}
     */
    function setCursor(index, extend) {
        const i = clamp(index, 0, Math.max(0, length - 1));
        if (!extend || state.anchor == null) state.anchor = i;
        state.cursor = i;
        const from = Math.min(state.anchor, i);
        const to = Math.max(state.anchor, i) + 1;
        state.selection = extend || state.dragging ? { start: from, end: to } : null;
        emitStatus();
        draw();
    }

    /**
     * @param {number} start 0-based, inclusive.
     * @param {number} end 0-based, exclusive.
     * @returns {void}
     */
    function select(start, end) {
        const from = clamp(Math.min(start, end), 0, length);
        const to = clamp(Math.max(start, end), 0, length);
        state.selection = to > from ? { start: from, end: to } : null;
        state.anchor = from;
        state.cursor = Math.max(from, to - 1);
        emitStatus();
        draw();
    }

    /** @returns {string} */
    function selectedText() {
        if (!state.selection) return '';
        return seqStr.slice(state.selection.start, state.selection.end);
    }

    /** @returns {void} */
    function emitStatus() {
        const sel = state.selection;
        let text;
        if (sel && sel.end > sel.start) {
            const span = sel.end - sel.start;
            const parts = [
                `${(sel.start + 1).toLocaleString()} → ${sel.end.toLocaleString()}`,
                `${span.toLocaleString()} ${unit}`,
            ];
            if (nucleic) parts.push(`GC ${gcContent(selectedText()).toFixed(1)}%`);
            if (nucleic && span % 3 === 0) parts.push(`${span / 3} codons`);
            text = parts.join('  ·  ');
        } else if (state.cursor != null) {
            text = `Position ${(state.cursor + 1).toLocaleString()} / ${length.toLocaleString()} ${unit}`;
        } else {
            text = `${length.toLocaleString()} ${unit}`;
        }
        dom.readout.textContent = text;
        onStatus?.(text);
    }

    // ---- zoom ----

    /**
     * @param {number} zoom 0-1.
     * @param {number} [focusResidue] Residue to keep under the pointer.
     * @returns {void}
     */
    function setZoom(zoom, focusResidue) {
        // Any explicit zoom is the user taking over from `Fit`.
        state.fitMode = false;
        state.zoom = clamp(zoom, 0, 1);
        dom.zoomSlider.value = String(state.zoom);
        relayout();
        if (focusResidue != null) scrollToResidue(focusResidue, false);
    }

    /**
     * Fit the whole sequence to the window, and keep it fitted as the window
     * changes size until the user zooms explicitly.
     *
     * @returns {void}
     */
    function fitToWindow() {
        state.fitMode = true;
        relayout();
        dom.scroll.scrollTop = 0;
    }

    /** @returns {void} */
    function updateZoomLabel() {
        const cw = zoomToCharWidth(state.zoom);
        if (cw >= 1) {
            dom.zoomLabel.textContent = `${cw.toFixed(1)} px/${unit}`;
            return;
        }
        // Below one pixel per residue the reciprocal is the readable figure, and
        // near the crossover it needs a decimal to distinguish adjacent steps.
        const perPixel = 1 / cw;
        dom.zoomLabel.textContent = `${
            perPixel < 10 ? perPixel.toFixed(1) : Math.round(perPixel).toLocaleString()
        } ${unit}/px`;
    }

    /**
     * @param {number} index
     * @param {boolean} [centre=true] Centre the row instead of merely revealing it.
     * @returns {void}
     */
    function scrollToResidue(index, centre = true) {
        const row = rowOfResidue(clamp(index, 0, Math.max(0, length - 1)), layout.basesPerRow);
        const y = row * rowLayout.rowHeight;
        const viewport = dom.scroll.clientHeight;
        dom.scroll.scrollTop = centre ? Math.max(0, y - viewport / 2 + rowLayout.rowHeight / 2) : y;
    }

    // ---- find ----

    /**
     * Locate every occurrence of a pattern on both strands.
     *
     * @param {string} query
     * @returns {void}
     */
    function runFind(query) {
        const needle = query.trim().toUpperCase();
        state.findMatches = [];
        state.findIndex = -1;
        if (needle.length > 0) {
            collectMatches(seqStr, needle, state.findMatches);
            if (nucleic) {
                const rc = reverseComplement(needle);
                if (rc !== needle) collectMatches(seqStr, rc, state.findMatches);
            }
            state.findMatches.sort((a, b) => a - b);
        }
        dom.findCount.textContent = needle
            ? `${state.findMatches.length} hit${state.findMatches.length === 1 ? '' : 's'}`
            : '';
        if (state.findMatches.length > 0) stepFind(1, needle.length);
        else draw();
    }

    /**
     * @param {number} delta +1 for next, -1 for previous.
     * @param {number} matchLength
     * @returns {void}
     */
    function stepFind(delta, matchLength) {
        if (state.findMatches.length === 0) return;
        state.findIndex =
            (state.findIndex + delta + state.findMatches.length) % state.findMatches.length;
        const at = state.findMatches[state.findIndex];
        select(at, at + matchLength);
        scrollToResidue(at);
        dom.findCount.textContent = `${state.findIndex + 1} / ${state.findMatches.length}`;
    }

    // ---- events ----

    /** @type {Array<() => void>} */
    const cleanups = [];

    /**
     * @param {EventTarget} target
     * @param {string} event
     * @param {(e: any) => void} handler
     * @param {AddEventListenerOptions} [options]
     * @returns {void}
     */
    function on(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        cleanups.push(() => target.removeEventListener(event, handler, options));
    }

    /**
     * @param {MouseEvent} e
     * @returns {number} Residue index under the pointer.
     */
    function residueFromEvent(e) {
        const rect = dom.canvas.getBoundingClientRect();
        return residueAtPoint({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top + state.scrollTop,
            layout,
            rowHeight: rowLayout.rowHeight,
            length,
        });
    }

    /**
     * The annotation drawn under a point, if any.
     *
     * @param {MouseEvent} e
     * @returns {import('../core/types.js').Feature|null}
     */
    function featureFromEvent(e) {
        if (!state.tracks.features) return null;
        const rect = dom.canvas.getBoundingClientRect();
        const y = e.clientY - rect.top + state.scrollTop;
        const withinRow = y % rowLayout.rowHeight;
        const band = rowLayout.bands.find(
            b => b.id === 'features' && withinRow >= b.y && withinRow < b.y + b.height
        );
        if (!band) return null;
        const index = residueFromEvent(e);
        return featureLanes[band.lane ?? 0]?.find(f => index >= f.start && index < f.end) || null;
    }

    on(dom.scroll, 'scroll', () => {
        state.scrollTop = dom.scroll.scrollTop;
        closeContextMenu();
        draw();
    });

    let touchStart = /** @type {{x:number,y:number,scroll:number}|null} */ (null);
    on(dom.canvas, 'pointerdown', e => {
        if (e.pointerType === 'touch') {
            if (!e.isPrimary) { touchStart = null; return; }
            touchStart = {x:e.clientX,y:e.clientY,scroll:dom.scroll.scrollTop};
            return;
        }
        if (e.button !== 0) return;
        dom.canvas.focus();
        state.dragging = true;
        setCursor(residueFromEvent(e), e.shiftKey);
        e.preventDefault();
    });

    on(window, 'pointermove', e => {
        if (!state.dragging || e.pointerType === 'touch') return;
        setCursor(residueFromEvent(e), true);
    });

    on(window, 'pointerup', e => {
        if (e.pointerType === 'touch') {
            if (touchStart && Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y) < 10 && Math.abs(dom.scroll.scrollTop-touchStart.scroll) < 5) {
                const at = residueFromEvent(e);
                select(at, at+1);
            }
            touchStart = null;
            return;
        }
        if (!state.dragging) return;
        state.dragging = false;
        // A click that never moved leaves a one-residue range; collapse it to a
        // caret so "click to place, drag to select" behaves as expected.
        if (state.selection && state.selection.end - state.selection.start === 1) {
            state.selection = null;
            emitStatus();
            draw();
        }
    });

    on(window, 'pointercancel', () => { state.dragging = false; touchStart = null; });

    on(dom.canvas, 'dblclick', e => {
        const feature = featureFromEvent(e);
        if (feature) {
            select(feature.start, feature.end);
            scrollToResidue(feature.start);
            return;
        }
        // No annotation under the pointer: select the codon, which is the unit a
        // double-click most usefully grabs in a coding sequence.
        const index = residueFromEvent(e);
        if (nucleic) select(index - (index % 3), index - (index % 3) + 3);
    });

    on(dom.canvas, 'mousemove', e => {
        const feature = featureFromEvent(e);
        if (feature) {
            dom.canvas.title = `${feature.name || feature.type} · ${feature.type} · ${(feature.start + 1).toLocaleString()}..${feature.end.toLocaleString()} (${feature.direction === 'reverse' ? '−' : '+'})`;
            dom.canvas.style.cursor = 'pointer';
        } else {
            dom.canvas.title = '';
            dom.canvas.style.cursor = 'text';
        }
    });

    on(
        dom.scroll,
        'wheel',
        e => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const focus = residueFromEvent(e);
            setZoom(zoomByFactor(state.zoom, e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR), focus);
        },
        { passive: false }
    );

    on(dom.canvas, 'contextmenu', e => {
        e.preventDefault();
        const index = residueFromEvent(e);
        if (!state.selection) {
            setCursor(index, false);
        }
        showMenu(e.clientX, e.clientY);
    });

    on(dom.canvas, 'keydown', e => {
        const step = e.metaKey || e.ctrlKey ? layout.basesPerRow : 1;
        const at = state.cursor ?? 0;
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            e.preventDefault();
            const rect = dom.selectionActions.getBoundingClientRect();
            showMenu(rect.left, rect.bottom);
            return;
        }
        switch (e.key) {
            case 'ArrowLeft':
                setCursor(at - step, e.shiftKey);
                break;
            case 'ArrowRight':
                setCursor(at + step, e.shiftKey);
                break;
            case 'ArrowUp':
                setCursor(at - layout.basesPerRow, e.shiftKey);
                break;
            case 'ArrowDown':
                setCursor(at + layout.basesPerRow, e.shiftKey);
                break;
            case 'Home':
                setCursor(e.ctrlKey || e.metaKey ? 0 : at - (at % layout.basesPerRow), e.shiftKey);
                break;
            case 'End':
                setCursor(
                    e.ctrlKey || e.metaKey
                        ? length - 1
                        : at - (at % layout.basesPerRow) + layout.basesPerRow - 1,
                    e.shiftKey
                );
                break;
            case 'a':
                if (e.ctrlKey || e.metaKey) {
                    select(0, length);
                    break;
                }
                return;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    copy(selectedText() || seqStr);
                    break;
                }
                return;
            case '=':
            case '+':
                setZoom(zoomByFactor(state.zoom, ZOOM_FACTOR), state.cursor ?? undefined);
                break;
            case '-':
                setZoom(zoomByFactor(state.zoom, 1 / ZOOM_FACTOR), state.cursor ?? undefined);
                break;
            default:
                return;
        }
        e.preventDefault();
        if (state.cursor != null) ensureVisible(state.cursor);
    });

    /**
     * Scroll just far enough to bring a residue's row into view.
     *
     * @param {number} index
     * @returns {void}
     */
    function ensureVisible(index) {
        const row = rowOfResidue(index, layout.basesPerRow);
        const top = row * rowLayout.rowHeight;
        const bottom = top + rowLayout.rowHeight;
        if (top < dom.scroll.scrollTop) dom.scroll.scrollTop = top;
        else if (bottom > dom.scroll.scrollTop + dom.scroll.clientHeight) {
            dom.scroll.scrollTop = bottom - dom.scroll.clientHeight;
        }
    }

    /**
     * @param {number} x Client x.
     * @param {number} y Client y.
     * @returns {void}
     */
    function showMenu(x, y) {
        const sel = state.selection;
        const hasSelection = !!sel && sel.end > sel.start;
        const text = selectedText();

        /** @param {string} vi @param {string} en */
        const label = (vi, en) => document.documentElement.lang === 'en' ? en : vi;
        openContextMenu({
            x,
            y,
            items: [
                ...[
                    { action: 'primer', vi: 'Thiết kế mồi cho vùng chọn…', en: 'Design primers for selection…', allowed: type === 'dna' },
                    { action: 'translation', vi: 'Dịch mã vùng chọn…', en: 'Translate selection…', allowed: nucleic },
                    { action: 'restriction', vi: 'Tìm vị trí cắt trong vùng chọn…', en: 'Restriction sites in selection…', allowed: type === 'dna' },
                    { action: 'stats', vi: 'Thống kê vùng chọn…', en: 'Selection statistics…', allowed: true },
                    { action: 'export', vi: 'Xuất vùng chọn thành FASTA', en: 'Export selection as FASTA', allowed: true },
                ].filter(item => item.allowed).map(item => ({
                    label: label(item.vi, item.en),
                    disabled: !hasSelection || !onRegionAction,
                    onSelect: () => { if (sel) onRegionAction?.(item.action, {...sel}); },
                })),
                { separator: true },
                {
                    label: label('Sao chép', 'Copy'),
                    accelerator: '⌘C',
                    disabled: !hasSelection,
                    onSelect: () => copy(text),
                },
                {
                    label: label('Sao chép chuỗi bổ sung đảo', 'Copy reverse complement'),
                    disabled: !hasSelection || !nucleic,
                    onSelect: () => copy(reverseComplement(text)),
                },
                {
                    label: label('Sao chép bản dịch mã', 'Copy translation'),
                    disabled: !hasSelection || !nucleic,
                    onSelect: () => copy(translate(text)),
                },
                { separator: true },
                {
                    label: label('Trích thành tài liệu mới', 'Extract to new document'),
                    disabled: !hasSelection || !onExtract,
                    onSelect: () =>
                        sel && onExtract?.({ start: sel.start, end: sel.end, sequence: text }),
                },
                {
                    label: label('Thêm chú thích cho vùng chọn', 'Add annotation here'),
                    disabled: !hasSelection || !onAnnotate,
                    onSelect: () => sel && onAnnotate?.({ start: sel.start, end: sel.end }),
                },
                { separator: true },
                {
                    label: label('Phóng to vùng chọn', 'Zoom to selection'),
                    disabled: !hasSelection,
                    onSelect: () => {
                        if (!sel) return;
                        setZoom(zoomToFit(sel.end - sel.start, layout.trackWidth));
                        scrollToResidue(sel.start);
                    },
                },
                { label: label('Vừa màn hình', 'Zoom to fit'), onSelect: fitToWindow },
                { label: label('Chọn tất cả', 'Select all'), accelerator: '⌘A', onSelect: () => select(0, length) },
            ],
        });
    }

    /**
     * @param {string} text
     * @returns {void}
     */
    function copy(text) {
        if (!text) return;
        navigator.clipboard?.writeText(text).then(
            () => onStatus?.(`Copied ${text.length.toLocaleString()} ${unit}`),
            () => onStatus?.('Copy failed — clipboard unavailable')
        );
    }

    // ---- toolbar wiring ----

    on(dom.zoomSlider, 'input', () => setZoom(parseFloat(dom.zoomSlider.value), state.cursor ?? 0));
    on(dom.zoomIn, 'click', () =>
        setZoom(zoomByFactor(state.zoom, ZOOM_FACTOR), state.cursor ?? 0)
    );
    on(dom.zoomOut, 'click', () =>
        setZoom(zoomByFactor(state.zoom, 1 / ZOOM_FACTOR), state.cursor ?? 0)
    );
    on(dom.zoomFit, 'click', fitToWindow);

    for (const [trackKey, button] of Object.entries(dom.trackButtons)) {
        const key = /** @type {keyof import('./trackLayout.js').TrackFlags} */ (trackKey);
        on(button, 'click', () => {
            state.tracks = { ...state.tracks, [key]: !state.tracks[key] };
            button.classList.toggle('active', state.tracks[key]);
            button.setAttribute('aria-pressed', String(state.tracks[key]));
            relayout();
        });
    }

    on(dom.colorToggle, 'click', () => {
        state.colorResidues = !state.colorResidues;
        dom.colorToggle.classList.toggle('active', state.colorResidues);
        dom.colorToggle.setAttribute('aria-pressed', String(state.colorResidues));
        draw();
    });

    let findTimer = /** @type {ReturnType<typeof setTimeout>|null} */ (null);
    on(dom.findInput, 'input', () => {
        if (findTimer) clearTimeout(findTimer);
        // Debounced: scanning a large sequence on every keystroke is wasted work.
        findTimer = setTimeout(() => runFind(dom.findInput.value), 180);
    });
    on(dom.findInput, 'keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (state.findMatches.length > 0)
            stepFind(e.shiftKey ? -1 : 1, dom.findInput.value.trim().length);
        else runFind(dom.findInput.value);
    });
    on(dom.findPrev, 'click', () => stepFind(-1, dom.findInput.value.trim().length));
    on(dom.findNext, 'click', () => stepFind(1, dom.findInput.value.trim().length));

    function goToInput() {
        const target = parseCoordinate(dom.gotoInput.value, length);
        if (!target) { onStatus?.('Enter a position or range, e.g. 1..100'); return; }
        select(target.start, target.end);
        scrollToResidue(target.start);
    }
    on(dom.gotoInput, 'keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault(); goToInput();
    });
    on(dom.gotoButton, 'click', goToInput);
    on(dom.selectionActions, 'click', () => {
        const rect = dom.selectionActions.getBoundingClientRect();
        showMenu(rect.left, rect.bottom);
    });

    // ---- lifecycle ----

    // Fires once on observe as well as on every later resize, which is what
    // re-lays-out a view first mounted into a host that had no size yet.
    const resizeObserver = new ResizeObserver(() => relayout());
    resizeObserver.observe(dom.scroll);
    cleanups.push(() => resizeObserver.disconnect());

    const themeObserver = new MutationObserver(() => {
        invalidatePalette();
        draw();
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
    cleanups.push(() => themeObserver.disconnect());

    // Open at a readable residue size rather than fitted to the window.
    // Virtualisation makes the row count irrelevant to performance, and landing
    // on legible residues is what a sequence view is for; `Fit` is one click away.
    //
    // Laid out synchronously rather than on an animation frame: a background tab
    // never runs one, and a view that only finishes mounting once its tab is
    // looked at is a view that reports the wrong zoom to anything asking earlier.
    setZoom(charWidthToZoom(DEFAULT_CHAR_WIDTH));
    emitStatus();

    return {
        destroy() {
            closeContextMenu();
            for (const off of cleanups) off();
            cleanups.length = 0;
            host.innerHTML = '';
        },
        getSelection: () => state.selection,
        select,
        scrollToResidue,
        redraw: () => {
            invalidatePalette();
            draw();
        },
    };
}

/**
 * Parse a `goto` box entry: a single coordinate, or a `start..end` range in
 * either GenBank (`100..200`) or hyphen (`100-200`) form. Coordinates are
 * 1-based on the way in and 0-based on the way out.
 *
 * @param {string} raw
 * @param {number} length
 * @returns {{start: number, end: number}|null} Null when unparseable.
 */
export function parseCoordinate(raw, length) {
    const text = raw.replace(/[,\s]/g, '');
    if (!text) return null;
    const range = text.match(/^(\d+)(?:\.\.|-|:)(\d+)$/);
    if (range) {
        const a = clamp(parseInt(range[1], 10) - 1, 0, Math.max(0, length - 1));
        const b = clamp(parseInt(range[2], 10), 1, length);
        return b > a ? { start: a, end: b } : { start: a, end: a + 1 };
    }
    if (!/^\d+$/.test(text)) return null;
    const at = clamp(parseInt(text, 10) - 1, 0, Math.max(0, length - 1));
    return { start: at, end: at + 1 };
}

/**
 * @param {string} sequence
 * @param {string} needle Uppercase.
 * @param {number[]} out Receives 0-based match starts.
 * @returns {void}
 */
function collectMatches(sequence, needle, out) {
    let from = 0;
    for (;;) {
        const at = sequence.indexOf(needle, from);
        if (at < 0) return;
        out.push(at);
        // Step by one so overlapping repeats are all reported.
        from = at + 1;
    }
}

/**
 * Build the view's DOM once. Returns the elements the controller needs.
 *
 * @param {HTMLElement} host
 * @param {import('../core/types.js').Sequence} sequence
 * @param {string} type
 * @param {number} length
 * @param {string} unit
 * @param {boolean} nucleic
 */
function buildScaffold(host, sequence, type, length, unit, nucleic) {
    const root = document.createElement('div');
    root.className = 'sv-root';

    const toggles = TRACK_TOGGLES.filter(t => nucleic || !t.nucleicOnly);

    root.innerHTML = `
      <div class="sv-toolbar">
        <div class="sv-group sv-zoom">
          <button type="button" class="sv-btn sv-icon" data-role="zoom-out" title="Zoom out (−)">−</button>
          <input type="range" class="sv-slider" data-role="zoom" min="0" max="1" step="0.001" value="1"
                 aria-label="Zoom" />
          <button type="button" class="sv-btn sv-icon" data-role="zoom-in" title="Zoom in (+)">+</button>
          <button type="button" class="sv-btn" data-role="zoom-fit" title="Fit whole sequence"><span data-i18n="Fit">Fit</span></button>
          <span class="sv-zoom-label" data-role="zoom-label"></span>
        </div>
        <div class="sv-group sv-tracks">
          ${toggles
              .map(
                  t =>
                      `<button type="button" class="sv-chip" data-track="${t.key}" aria-pressed="false"><span data-i18n="${t.label}">${t.label}</span></button>`
              )
              .join('')}
          <button type="button" class="sv-chip active" data-role="color" aria-pressed="true"><span data-i18n="Colour">Colour</span></button>
        </div>
        <div class="sv-group sv-find">
          <input type="search" class="sv-input" data-role="find" placeholder="Find sequence…" data-i18n-placeholder="Find sequence…"
                 aria-label="Find sequence" data-i18n-aria-label="Find sequence" spellcheck="false" />
          <button type="button" class="sv-btn sv-icon" data-role="find-prev" title="Previous hit">↑</button>
          <button type="button" class="sv-btn sv-icon" data-role="find-next" title="Next hit">↓</button>
          <span class="sv-find-count" data-role="find-count"></span>
          <input type="text" class="sv-input sv-goto" data-role="goto" placeholder="Go to 1..100" data-i18n-placeholder="Go to 1..100"
                 aria-label="Go to position" data-i18n-aria-label="Go to position" spellcheck="false" />
          <button type="button" class="sv-btn" data-role="goto-button"><span data-en="Go" data-vi="Đến">Go</span></button>
          <button type="button" class="sv-btn" data-role="selection-actions"><span data-en="Selection actions" data-vi="Thao tác vùng chọn">Selection actions</span></button>
        </div>
      </div>
      <div class="sv-scroll" data-role="scroll">
        <div class="sv-sizer" data-role="sizer"></div>
        <canvas class="sv-canvas" data-role="canvas" tabindex="0"
                aria-label="Sequence ${escapeAttribute(sequence.name || '')}"></canvas>
      </div>
      <div class="sv-footer">
        <span class="sv-doc-name">${escapeAttribute(sequence.name || 'Untitled')}</span>
        <span class="sv-doc-meta">${type.toUpperCase()}${sequence.topology === 'circular' ? ' · circular' : ''} · ${length.toLocaleString()} ${unit}</span>
        <span class="sv-readout" data-role="readout"></span>
      </div>
    `;
    host.appendChild(root);

    /** @param {string} role @returns {any} */
    const byRole = role => root.querySelector(`[data-role="${role}"]`);

    /** @type {{[key: string]: HTMLButtonElement}} */
    const trackButtons = {};
    for (const toggle of toggles) {
        trackButtons[toggle.key] = /** @type {HTMLButtonElement} */ (
            root.querySelector(`[data-track="${toggle.key}"]`)
        );
    }

    return {
        root,
        scroll: byRole('scroll'),
        sizer: byRole('sizer'),
        canvas: byRole('canvas'),
        readout: byRole('readout'),
        zoomSlider: byRole('zoom'),
        zoomIn: byRole('zoom-in'),
        zoomOut: byRole('zoom-out'),
        zoomFit: byRole('zoom-fit'),
        zoomLabel: byRole('zoom-label'),
        findInput: byRole('find'),
        findNext: byRole('find-next'),
        findPrev: byRole('find-prev'),
        findCount: byRole('find-count'),
        gotoInput: byRole('goto'),
        gotoButton: byRole('goto-button'),
        selectionActions: byRole('selection-actions'),
        colorToggle: byRole('color'),
        trackButtons,
    };
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
