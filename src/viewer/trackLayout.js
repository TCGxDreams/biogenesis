// ============================================
// BioGenesis — Sequence view track stacking
// ============================================
//
// Turns the set of enabled tracks into a vertical layout for one wrapped row:
// which band each track occupies and how tall a row therefore is. The renderer
// draws against these offsets and the hit-tester reads them back, so a track can
// be added or reordered in one place.

/** Height of each band, in CSS pixels. */
export const BAND_HEIGHTS = {
    enzymes: 24,
    featureLane: 16,
    ruler: 15,
    strand: 18,
    frame: 13,
    gc: 40,
};

/** Blank space below each row, separating it from the next. */
export const ROW_GAP = 14;

/**
 * Which optional tracks are switched on.
 *
 * @typedef {Object} TrackFlags
 * @property {boolean} features Annotation lanes.
 * @property {boolean} enzymes Restriction cut sites.
 * @property {boolean} complement Reverse strand residues.
 * @property {boolean} translation Three forward reading frames.
 * @property {boolean} reverseTranslation Three reverse reading frames.
 * @property {boolean} gc GC content graph.
 */

/**
 * One horizontal band within a row.
 *
 * @typedef {Object} Band
 * @property {string} id Band kind: `enzymes`, `features`, `ruler`, `forward`,
 *   `reverse`, `frame+`, `frame-` or `gc`.
 * @property {number} y Offset from the top of the row, in CSS pixels.
 * @property {number} height
 * @property {number} [frame] Reading frame, for `frame+` and `frame-` bands.
 * @property {number} [lane] Lane index, for `features` bands.
 */

/**
 * @typedef {Object} RowLayout
 * @property {Band[]} bands Top to bottom.
 * @property {number} rowHeight Total height including {@link ROW_GAP}.
 * @property {(id: string) => Band|undefined} band Look one band up by id.
 */

/**
 * Stack the enabled tracks into a row layout.
 *
 * Protein sequences get no strand, frame or GC bands however the flags are set:
 * those tracks describe nucleic acids and would otherwise render as empty
 * stripes.
 *
 * @param {Object} options
 * @param {TrackFlags} options.tracks
 * @param {number} options.laneCount Annotation lanes to make room for.
 * @param {'dna'|'rna'|'protein'} options.type
 * @returns {RowLayout}
 */
export function computeRowLayout({ tracks, laneCount, type }) {
    const nucleic = type !== 'protein';
    /** @type {Band[]} */
    const bands = [];
    let y = 0;

    /** @param {string} id @param {number} height @param {Object} [extra] */
    const push = (id, height, extra) => {
        bands.push({ id, y, height, ...extra });
        y += height;
    };

    if (nucleic && tracks.enzymes) push('enzymes', BAND_HEIGHTS.enzymes);

    if (tracks.features) {
        for (let lane = 0; lane < laneCount; lane++) {
            push('features', BAND_HEIGHTS.featureLane, { lane });
        }
    }

    push('ruler', BAND_HEIGHTS.ruler);
    push('forward', BAND_HEIGHTS.strand);

    if (nucleic && tracks.complement) push('reverse', BAND_HEIGHTS.strand);

    if (nucleic && tracks.translation) {
        for (const frame of [0, 1, 2]) push('frame+', BAND_HEIGHTS.frame, { frame });
    }
    if (nucleic && tracks.reverseTranslation) {
        for (const frame of [0, 1, 2]) push('frame-', BAND_HEIGHTS.frame, { frame });
    }
    if (nucleic && tracks.gc) push('gc', BAND_HEIGHTS.gc);

    const byId = new Map(bands.map(b => [bandKey(b), b]));

    return {
        bands,
        rowHeight: y + ROW_GAP,
        band: id => byId.get(id),
    };
}

/**
 * @param {Band} band
 * @returns {string}
 */
function bandKey(band) {
    if (band.id === 'frame+' || band.id === 'frame-') return `${band.id}${band.frame}`;
    if (band.id === 'features') return `features${band.lane}`;
    return band.id;
}

/** Tracks a freshly opened view starts with. */
export const DEFAULT_TRACKS = Object.freeze({
    features: true,
    enzymes: false,
    complement: true,
    translation: false,
    reverseTranslation: false,
    gc: false,
});
