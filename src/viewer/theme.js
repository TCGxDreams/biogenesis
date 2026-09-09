// ============================================
// BioGenesis — Canvas palette
// ============================================
//
// Canvas has no access to CSS custom properties, so the sequence view resolves
// the ones it needs into concrete colour strings and hands them to the renderer.
// Re-read the palette whenever the theme changes; the values are cached until
// then because `getComputedStyle` is far too slow to call per frame.

/**
 * Every colour the renderer draws with.
 *
 * @typedef {Object} Palette
 * @property {string} background
 * @property {string} rowAlt Banding behind alternate rows.
 * @property {string} gutter Coordinate gutter text.
 * @property {string} ruler Ruler ticks and labels.
 * @property {string} text Residue letters at `letters` detail.
 * @property {string} textMuted
 * @property {string} border
 * @property {string} selection Fill behind selected residues.
 * @property {string} selectionEdge
 * @property {string} cursor Caret between residues.
 * @property {string} hover
 * @property {{[base: string]: string}} nucleotide Per-base block colours.
 * @property {{[group: string]: string}} aminoAcid Per-property residue colours.
 * @property {{[type: string]: string}} feature Per-feature-type fallback colours.
 * @property {string} orfForward
 * @property {string} orfReverse
 * @property {string} stopCodon
 * @property {string} startCodon
 * @property {string} enzyme
 * @property {string} gcLine
 * @property {string} gcFill
 * @property {string} gcMidline
 */

/** @type {Palette|null} */
let cached = null;

/** @type {string|null} */
let cachedTheme = null;

/**
 * Resolve the palette for the current theme, reusing the last result while the
 * theme is unchanged.
 *
 * @param {HTMLElement} [host] Element to resolve custom properties against.
 *   Defaults to the document root.
 * @returns {Palette}
 */
export function getPalette(host) {
    const theme = document.documentElement.dataset.theme || 'light';
    if (cached && cachedTheme === theme) return cached;

    const style = getComputedStyle(host || document.documentElement);
    /** @param {string} name @param {string} fallback @returns {string} */
    const v = (name, fallback) => style.getPropertyValue(name).trim() || fallback;

    const dark = theme === 'dark';

    cached = {
        background: v('--bg-elevated', dark ? '#0f2740' : '#ffffff'),
        rowAlt: dark ? 'rgba(255,255,255,0.022)' : 'rgba(10,36,64,0.022)',
        gutter: v('--text-muted', '#5c7690'),
        ruler: v('--text-muted', '#5c7690'),
        text: v('--text-primary', '#0a2440'),
        textMuted: v('--text-muted', '#5c7690'),
        border: v('--border-muted', 'rgba(10,36,64,0.08)'),
        selection: dark ? 'rgba(143,196,238,0.28)' : 'rgba(61,122,181,0.22)',
        selectionEdge: v('--accent-blue', '#3d7ab5'),
        cursor: v('--accent-blue', '#3d7ab5'),
        hover: dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,36,64,0.05)',
        nucleotide: {
            A: v('--nt-a', '#2e7d32'),
            T: v('--nt-t', '#c62828'),
            U: v('--nt-u', '#d81b60'),
            C: v('--nt-c', '#3d7ab5'),
            G: v('--nt-g', '#b8912f'),
            N: v('--text-muted', '#5c7690'),
        },
        aminoAcid: {
            hydrophobic: v('--aa-hydrophobic', '#b8912f'),
            polar: v('--aa-polar', '#2e7d32'),
            positive: v('--aa-charged-pos', '#3d7ab5'),
            negative: v('--aa-charged-neg', '#d81b60'),
            special: v('--aa-special', '#f9a825'),
        },
        feature: {
            gene: v('--feat-gene', '#2e7d32'),
            CDS: v('--feat-cds', '#3d7ab5'),
            promoter: v('--feat-promoter', '#c62828'),
            terminator: v('--feat-terminator', '#c62828'),
            rep_origin: v('--feat-rep-origin', '#7c4dff'),
            misc_feature: v('--feat-misc', '#b8912f'),
            regulatory: v('--feat-regulatory', '#d81b60'),
            primer_bind: v('--feat-primer-bind', '#b8912f'),
            exon: v('--feat-exon', '#3d7ab5'),
            default: v('--text-muted', '#5c7690'),
        },
        orfForward: v('--accent-green', '#2e7d32'),
        orfReverse: v('--accent-purple', '#7c4dff'),
        stopCodon: v('--accent-red', '#c62828'),
        startCodon: v('--accent-green', '#2e7d32'),
        enzyme: v('--accent-orange', '#b8912f'),
        gcLine: v('--accent-blue', '#3d7ab5'),
        gcFill: dark ? 'rgba(143,196,238,0.18)' : 'rgba(61,122,181,0.14)',
        gcMidline: dark ? 'rgba(255,255,255,0.12)' : 'rgba(10,36,64,0.1)',
    };
    cachedTheme = theme;
    return cached;
}

/**
 * Drop the cached palette so the next {@link getPalette} re-reads the CSS.
 *
 * @returns {void}
 */
export function invalidatePalette() {
    cached = null;
    cachedTheme = null;
}

/** Residues grouped by the property that colours them. */
const AA_GROUPS = {
    hydrophobic: 'AVLIMFWPC',
    polar: 'STNQGY',
    positive: 'KRH',
    negative: 'DE',
};

/**
 * The palette colour for one residue.
 *
 * @param {string} residue Single character.
 * @param {'dna'|'rna'|'protein'} type
 * @param {Palette} palette
 * @returns {string}
 */
export function residueColor(residue, type, palette) {
    const c = residue.toUpperCase();
    if (type === 'protein') {
        for (const [group, members] of Object.entries(AA_GROUPS)) {
            if (members.includes(c)) return palette.aminoAcid[group];
        }
        return palette.aminoAcid.special;
    }
    return palette.nucleotide[c] || palette.nucleotide.N;
}

/**
 * The palette colour for a feature, preferring the colour it carries.
 *
 * @param {import('../core/types.js').Feature} feature
 * @param {Palette} palette
 * @returns {string}
 */
export function featureColor(feature, palette) {
    return feature.color || palette.feature[feature.type] || palette.feature.default;
}
