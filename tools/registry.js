// ============================================
// BioGenesis — Headless tool registry
// ============================================
//
// One entry per callable in src/core/. Each entry adapts a named-argument
// object onto the core function's positional signature, so the headless surface
// is self-describing and every analysis in the app is reachable without a DOM.
//
// This file contains no domain logic: every `run` is a one-line call into core.
// The UI ids come from src/app/toolMeta.js, so the two surfaces cannot drift.

import * as core from '../src/core/index.js';
import { TOOL_META } from '../src/app/toolMeta.js';

/**
 * @typedef {Object} ToolParam
 * @property {string} name
 * @property {string} type `string`, `number`, `boolean`, `string[]`, `object`, ...
 * @property {boolean} required
 * @property {string} description
 */

/**
 * @typedef {Object} HeadlessTool
 * @property {string} name The `tool` value callers pass.
 * @property {string} summary One line describing what it returns.
 * @property {ToolParam[]} params
 * @property {(args: Object) => any} run Adapter onto the core function.
 * @property {string} [uiTool] Matching id in src/app/toolMeta.js, when the tool
 *   is also a panel in the app.
 */

const p = (name, type, required, description) => ({ name, type, required, description });

const SEQUENCE = p('sequence', 'string', true, 'Residues to analyse.');
const OPTIONS = p('options', 'object', false, 'Options forwarded to the core function.');

/** @type {HeadlessTool[]} */
const TOOL_LIST = [
    // ---- Motif search -----------------------------------------------------
    {
        name: 'findMotifs',
        uiTool: 'motif',
        summary: 'Every occurrence of a motif, on both strands, 0-based.',
        params: [
            SEQUENCE,
            p('pattern', 'string', true, 'Motif to search for.'),
            p('mode', "'exact'|'regex'|'iupac'", false, 'How the pattern is interpreted.'),
            p('strand', "'both'|'forward'|'reverse'", false, 'Strands to search.'),
            p('type', "'dna'|'rna'|'protein'", false, 'Skips the reverse strand for protein.'),
            p('contextFlank', 'number', false, 'Flanking residues returned per match.'),
        ],
        run: ({ sequence, pattern, ...options }) => core.findMotifs(sequence, pattern, options),
    },
    {
        name: 'compileMotifPattern',
        summary: 'The regex source a motif pattern compiles to.',
        params: [
            p('pattern', 'string', true, 'Motif to compile.'),
            p('mode', "'exact'|'regex'|'iupac'", false, 'How the pattern is interpreted.'),
        ],
        run: ({ pattern, mode }) => ({ source: core.compileMotifPattern(pattern, mode).source }),
    },

    // ---- Statistics -------------------------------------------------------
    {
        name: 'computeSequenceStats',
        uiTool: 'stats',
        summary: 'Length, GC, Tm, mass, composition, ORFs, codon usage.',
        params: [
            SEQUENCE,
            p('type', "'dna'|'rna'|'protein'", true, 'Sequence type.'),
            p('orfMinLength', 'number', false, 'Shortest ORF reported, in nucleotides.'),
            p('codonTopN', 'number', false, 'How many codons the top list holds.'),
            p('gcWindowMinLength', 'number', false, 'Shortest sequence that gets a GC series.'),
        ],
        run: ({ sequence, type, ...options }) => core.computeSequenceStats(sequence, type, options),
    },
    {
        name: 'computePI',
        summary: 'Isoelectric point of a protein.',
        params: [SEQUENCE],
        run: ({ sequence }) => ({ pI: core.computePI(sequence) }),
    },
    {
        name: 'computeGRAVY',
        summary: 'Grand average of hydropathy.',
        params: [SEQUENCE],
        run: ({ sequence }) => ({ gravy: core.computeGRAVY(sequence) }),
    },
    {
        name: 'instabilityIndex',
        summary: 'Guruprasad instability index; above 40 suggests instability.',
        params: [SEQUENCE],
        run: ({ sequence }) => ({ instabilityIndex: core.instabilityIndex(sequence) }),
    },
    {
        name: 'aminoAcidComposition',
        summary: 'Residue counts for a protein.',
        params: [SEQUENCE],
        run: ({ sequence }) => core.aminoAcidComposition(sequence),
    },
    {
        name: 'computeGcWindow',
        summary: 'GC percentage over a sliding window.',
        params: [SEQUENCE, p('windowSize', 'number', false, 'Residues per window.')],
        run: ({ sequence, windowSize }) => core.computeGcWindow(sequence, windowSize),
    },
    {
        name: 'computeCodonUsage',
        summary: 'Codon counts in frame +1.',
        params: [SEQUENCE, p('topN', 'number', false, 'Length of the top list.')],
        run: ({ sequence, topN }) => core.computeCodonUsage(sequence, topN),
    },

    // ---- Dot plot ---------------------------------------------------------
    {
        name: 'computeDotMatrix',
        uiTool: 'dotplot',
        summary: 'Windows where two sequences match above a threshold.',
        params: [
            p('seqA', 'string', true, 'Horizontal-axis sequence.'),
            p('seqB', 'string', true, 'Vertical-axis sequence.'),
            p('windowSize', 'number', false, 'Residues compared per test.'),
            p('threshold', 'number', false, 'Percent identity a window must reach.'),
            p('maxLength', 'number', false, 'Longest prefix compared.'),
        ],
        run: ({ seqA, seqB, ...options }) => core.computeDotMatrix(seqA, seqB, options),
    },

    // ---- Alignment --------------------------------------------------------
    {
        name: 'alignPair',
        summary: 'Global or local alignment of two sequences.',
        params: [
            p('seqA', 'string', true, 'First sequence.'),
            p('seqB', 'string', true, 'Second sequence.'),
            p('algorithm', "'nw'|'sw'", false, 'Global or local.'),
            p('isProtein', 'boolean', false, 'Score with BLOSUM62.'),
            p('gapPenalty', 'number', false, 'Gap penalty.'),
            p('maxLength', 'number', false, 'Longest prefix aligned.'),
        ],
        run: ({ seqA, seqB, ...options }) => core.alignPair(seqA, seqB, options),
    },
    {
        name: 'buildAlignmentReport',
        uiTool: 'alignment',
        summary: 'Aligned rows, consensus and per-column conservation.',
        params: [
            p('entries', 'Array<{name,sequence,type?}>', true, 'Sequences to align.'),
            p('algorithm', "'msa'|'nw'|'sw'", false, 'Alignment method.'),
            p('isProtein', 'boolean', false, 'Score with BLOSUM62.'),
            p('maxLength', 'number', false, 'Longest prefix aligned.'),
        ],
        run: ({ entries, ...options }) => core.buildAlignmentReport(entries, options),
    },
    {
        name: 'buildMatchLine',
        summary: 'The pipe/space match line between two aligned rows.',
        params: [
            p('a', 'string', true, 'First aligned row.'),
            p('b', 'string', true, 'Second aligned row.'),
        ],
        run: ({ a, b }) => ({ matchLine: core.buildMatchLine(a, b) }),
    },
    {
        name: 'computeConservation',
        summary: 'Per-column conservation of an aligned block.',
        params: [
            p('rows', 'string[]', true, 'Aligned rows of equal length.'),
            p('consensus', 'string', true, 'Consensus row.'),
        ],
        run: ({ rows, consensus }) => ({
            conservation: core.computeConservation(rows, consensus),
        }),
    },

    // ---- Phylogenetics ----------------------------------------------------
    {
        name: 'buildTree',
        uiTool: 'phylo',
        summary: 'Tree, Newick and distance matrix from named sequences.',
        params: [
            p('sequences', 'Array<{name,sequence}>', true, 'Taxa to compare.'),
            p('algorithm', "'nj'|'upgma'", false, 'Tree method.'),
            p('maxLength', 'number', false, 'Longest prefix compared.'),
        ],
        run: ({ sequences, ...options }) => core.buildTree(sequences, options),
    },

    // ---- Restriction ------------------------------------------------------
    {
        name: 'surveySites',
        uiTool: 'restriction',
        summary: 'Which enzymes cut a sequence, and where.',
        params: [SEQUENCE],
        run: ({ sequence }) => core.surveySites(sequence),
    },
    {
        name: 'analyseDigest',
        summary: 'Fragments produced by a named set of enzymes.',
        params: [SEQUENCE, p('enzymeNames', 'string[]', true, 'Enzymes to digest with.')],
        run: ({ sequence, enzymeNames }) => core.analyseDigest(sequence, enzymeNames),
    },

    // ---- Primers ----------------------------------------------------------
    {
        name: 'designPrimers',
        uiTool: 'primer',
        summary: 'Candidate PCR primer pairs across a template.',
        params: [
            SEQUENCE,
            p('minLen', 'number', false, 'Shortest primer considered.'),
            p('maxLen', 'number', false, 'Longest primer considered.'),
            p('minTm', 'number', false, 'Lowest acceptable Tm.'),
            p('maxTm', 'number', false, 'Highest acceptable Tm.'),
            p('targetStart', 'number', false, '1-based start of the region to amplify.'),
            p('targetEnd', 'number', false, '1-based end of the region to amplify.'),
        ],
        run: ({ sequence, ...config }) => core.designPrimers(sequence, config),
    },
    {
        name: 'checkHairpin',
        summary: 'Whether a primer has a self-complementary stem.',
        params: [SEQUENCE],
        run: ({ sequence }) => ({ hairpin: core.checkHairpin(sequence) }),
    },

    // ---- Codon usage ------------------------------------------------------
    {
        name: 'analyseCodonUsage',
        uiTool: 'codon',
        summary: 'CAI, per-residue codon table and rare codons.',
        params: [SEQUENCE, p('organism', 'string', true, 'Key into CODON_USAGE, e.g. "ecoli".')],
        run: ({ sequence, organism }) => core.analyseCodonUsage(sequence, organism),
    },
    {
        name: 'optimiseCodons',
        summary: 'Rewrite a coding sequence with an organism’s preferred codons.',
        params: [SEQUENCE, p('organism', 'string', true, 'Key into CODON_USAGE, e.g. "ecoli".')],
        run: ({ sequence, organism }) => core.optimiseCodons(sequence, organism),
    },
    {
        name: 'countCodons',
        summary: 'Codon counts, skipping any codon containing N.',
        params: [SEQUENCE],
        run: ({ sequence }) => core.countCodons(sequence),
    },
    {
        name: 'calculateCAI',
        summary: 'Codon adaptation index, weighting each position equally.',
        params: [SEQUENCE, p('organism', 'string', true, 'Key into CODON_USAGE.')],
        run: ({ sequence, organism }) => ({
            cai: core.calculateCAI(sequence, requireOrganismTable(organism)),
        }),
    },
    {
        name: 'caiFromCounts',
        summary: 'Codon adaptation index from a count map.',
        params: [
            p('counts', 'object', true, 'Codon to occurrence count.'),
            p('organism', 'string', true, 'Key into CODON_USAGE.'),
        ],
        run: ({ counts, organism }) => ({
            cai: core.caiFromCounts(counts, requireOrganismTable(organism)),
        }),
    },
    {
        name: 'getOptimalCodon',
        summary: 'The codon an organism uses most for a residue.',
        params: [
            p('aa', 'string', true, 'One-letter residue code.'),
            p('organism', 'string', true, 'Key into CODON_USAGE.'),
        ],
        run: ({ aa, organism }) => ({
            codon: core.getOptimalCodon(aa, requireOrganismTable(organism)),
        }),
    },

    // ---- Translation ------------------------------------------------------
    {
        name: 'translateSixFrames',
        uiTool: 'translation',
        summary: 'Six reading frames and the ORFs inside them.',
        params: [
            SEQUENCE,
            p('maxLength', 'number', false, 'Residues translated; omit for all.'),
            p('minOrfLength', 'number', false, 'Shortest ORF reported, in residues.'),
        ],
        run: ({ sequence, ...options }) => core.translateSixFrames(sequence, options),
    },
    {
        name: 'findFrameOrfs',
        summary: 'ORFs inside one already-translated frame.',
        params: [
            p('protein', 'string', true, 'Translated residues.'),
            p('frameLabel', 'string', false, 'Label recorded on each ORF.'),
            p('direction', "'forward'|'reverse'", false, 'Strand recorded on each ORF.'),
            p('minLength', 'number', false, 'Shortest ORF reported.'),
        ],
        run: ({ protein, frameLabel = '+1', direction = 'forward', minLength }) =>
            core.findFrameOrfs(protein, frameLabel, direction, minLength),
    },

    // ---- Sliding-window properties ---------------------------------------
    {
        name: 'computeSlidingProperties',
        uiTool: 'properties',
        summary: 'Several sliding-window property series at once.',
        params: [
            SEQUENCE,
            p('windowSize', 'number', false, 'Residues per window.'),
            p('metrics', 'string[]', false, 'Metric keys; omit for all.'),
        ],
        run: ({ sequence, ...options }) => core.computeSlidingProperties(sequence, options),
    },
    {
        name: 'computeProperty',
        summary: 'One sliding-window property series.',
        params: [
            SEQUENCE,
            p('metric', 'string', true, 'Metric key, e.g. "gc_content".'),
            p('windowSize', 'number', false, 'Residues per window.'),
        ],
        run: ({ sequence, metric, windowSize }) =>
            core.computeProperty(sequence, metric, windowSize),
    },
    {
        name: 'estimatePi',
        summary: 'Coarse isoelectric point band for a protein.',
        params: [SEQUENCE],
        run: ({ sequence }) => ({ band: core.estimatePi(sequence) }),
    },
];

/**
 * Resolve an organism key to its frequency table.
 *
 * The core CAI helpers take a table rather than a key, so the headless surface
 * accepts the key and fails the same way the rest of the codon tools do.
 *
 * @param {string} organism
 * @returns {{[codon: string]: number}}
 * @throws {core.BioError} `UNKNOWN_ORGANISM`
 */
function requireOrganismTable(organism) {
    const entry = core.CODON_USAGE[organism];
    if (!entry) {
        throw new core.BioError(
            `Unknown organism "${organism}". Expected one of: ${Object.keys(core.CODON_USAGE).join(', ')}.`,
            'UNKNOWN_ORGANISM'
        );
    }
    return entry.table;
}

/** @type {{[name: string]: HeadlessTool}} */
export const TOOLS = Object.fromEntries(TOOL_LIST.map(tool => [tool.name, tool]));

/** Constants callers may need to build valid arguments. */
export const CONSTANTS = {
    organisms: Object.keys(core.CODON_USAGE),
    metrics: Object.keys(core.METRICS),
    enzymeGroups: core.ENZYME_GROUPS,
    limits: {
        alignmentMaxLength: core.ALIGNMENT_MAX_LENGTH,
        dotplotMaxLength: core.DOTPLOT_MAX_LENGTH,
        phyloMaxLength: core.PHYLO_MAX_LENGTH,
        phyloMinSequences: core.PHYLO_MIN_SEQUENCES,
        sixFrameMaxLength: core.SIXFRAME_MAX_LENGTH,
        defaultMinOrfLength: core.DEFAULT_MIN_ORF_LENGTH,
        primerGcRange: core.GC_RANGE,
        primerMaxPairs: core.MAX_PAIRS,
        primerMaxTmDifference: core.MAX_TM_DIFFERENCE,
        primerMinAmpliconGap: core.MIN_AMPLICON_GAP,
        rareCodonThreshold: core.RARE_CODON_THRESHOLD,
    },
};

/**
 * The machine-readable description of the whole surface.
 *
 * @returns {Object}
 */
export function describeTools() {
    return {
        tools: Object.values(TOOLS).map(tool => ({
            name: tool.name,
            summary: tool.summary,
            uiTool: tool.uiTool ?? null,
            uiLabel: tool.uiTool ? (TOOL_META[tool.uiTool]?.label ?? null) : null,
            params: tool.params,
        })),
        constants: CONSTANTS,
    };
}
