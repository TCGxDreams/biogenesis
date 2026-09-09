// ============================================
// BioGenesis — Tool metadata
// ============================================
//
// What each tool is and what it can run on, with no reference to rendering.
// Kept free of component imports so it loads anywhere: the browser registry
// composes it with render/bind functions, and the headless tool wrappers
// (AGENT_TASKS.md T6.1) can consume the same descriptions without a DOM.

/** Every sequence type, for tools that do not care which they get. */
export const ALL_TYPES = ['dna', 'rna', 'protein'];

/**
 * @typedef {Object} ToolMeta
 * @property {string} id Matches the `data-tool` attribute in index.html.
 * @property {string} label Human-readable name.
 * @property {string[]} accepts Sequence types the tool can analyse.
 * @property {number} needsSequences How many sequences must exist in the
 *   workspace before the tool can run.
 * @property {boolean} [usesActiveSequence=true] False for tools that choose
 *   their own sequences and so open without an active one.
 * @property {boolean} [appendQuickActions=false] Whether the cross-tool quick
 *   action strip is appended below the panel.
 */

/**
 * @typedef {Object} ToolContext
 * @property {import('../core/types.js').Sequence[]} sequences The whole workspace.
 * @property {number} activeSequenceIdx -1 when nothing is open.
 */

/** @type {{[id: string]: ToolMeta}} */
export const TOOL_META = {
    viewer: {
        id: 'viewer',
        label: 'Sequence View',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    editor: {
        id: 'editor',
        label: 'Sequence Editor',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    linearmap: {
        id: 'linearmap',
        label: 'Linear Map',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    plasmid: {
        id: 'plasmid',
        label: 'Plasmid Map',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    alignment: {
        id: 'alignment',
        label: 'Sequence Alignment',
        accepts: ALL_TYPES,
        needsSequences: 2,
        usesActiveSequence: false,
    },
    dotplot: {
        id: 'dotplot',
        label: 'Dot Plot',
        accepts: ALL_TYPES,
        needsSequences: 2,
        usesActiveSequence: false,
    },
    phylo: {
        id: 'phylo',
        label: 'Phylogenetic Tree',
        accepts: ALL_TYPES,
        needsSequences: 3,
        usesActiveSequence: false,
    },
    stats: {
        id: 'stats',
        label: 'Statistics',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    motif: {
        id: 'motif',
        label: 'Motif Finder',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    properties: {
        id: 'properties',
        label: 'Properties Plot',
        accepts: ALL_TYPES,
        needsSequences: 1,
    },
    restriction: {
        id: 'restriction',
        label: 'Restriction Analysis',
        accepts: ['dna', 'rna'],
        needsSequences: 1,
    },
    primer: {
        id: 'primer',
        label: 'Primer Design',
        accepts: ['dna', 'rna'],
        needsSequences: 1,
    },
    translation: {
        id: 'translation',
        label: '6-Frame Translation',
        accepts: ['dna', 'rna'],
        needsSequences: 1,
    },
    codon: {
        id: 'codon',
        label: 'Codon Optimization',
        accepts: ['dna', 'rna'],
        needsSequences: 1,
    },
    protein3d: {
        id: 'protein3d',
        label: '3D Structure',
        accepts: ALL_TYPES,
        needsSequences: 0,
        usesActiveSequence: false,
    },
    blast: {
        id: 'blast',
        label: 'BLAST Search',
        accepts: ALL_TYPES,
        needsSequences: 0,
        usesActiveSequence: false,
    },
};

/** The tool shown when none has been chosen, or when an id is unknown. */
export const DEFAULT_TOOL_ID = 'viewer';

/**
 * Why a tool cannot run right now, or null when it can.
 *
 * @param {ToolMeta} tool
 * @param {ToolContext} context
 * @returns {string|null} A message suitable for a tooltip.
 */
export function toolUnavailableReason(tool, context) {
    const { sequences, activeSequenceIdx } = context;

    if (sequences.length < tool.needsSequences) {
        const noun = tool.needsSequences === 1 ? 'sequence' : 'sequences';
        return `Needs at least ${tool.needsSequences} ${noun} in the workspace`;
    }

    if (tool.usesActiveSequence === false) return null;

    const seq = activeSequenceIdx >= 0 ? sequences[activeSequenceIdx] : null;
    if (!seq) return null; // the welcome screen covers this case

    if (!tool.accepts.includes(seq.type)) {
        return `Not available for ${seq.type.toUpperCase()} sequences`;
    }
    return null;
}

/**
 * Whether a tool can run against the current workspace.
 *
 * @param {ToolMeta} tool
 * @param {ToolContext} context
 * @returns {boolean}
 */
export function isToolAvailable(tool, context) {
    return toolUnavailableReason(tool, context) === null;
}
