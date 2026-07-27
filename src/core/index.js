// ============================================
// BioGenesis — Core domain layer
// ============================================
//
// Pure domain logic: no DOM, no HTML, plain objects in and out. This barrel is
// the single entry point for components, the future headless tool wrappers
// (AGENT_TASKS.md T6.1) and any HTTP surface built on top.

export { BioError } from './errors.js';
export { findMotifs, compileMotifPattern } from './motif.js';
export {
    computeSequenceStats,
    computePI,
    computeGRAVY,
    instabilityIndex,
    aminoAcidComposition,
    computeGcWindow,
    computeCodonUsage,
} from './statistics.js';
export { computeDotMatrix, DEFAULT_MAX_LENGTH as DOTPLOT_MAX_LENGTH } from './dotplot.js';
export {
    alignPair,
    buildAlignmentReport,
    buildMatchLine,
    computeConservation,
    DEFAULT_MAX_LENGTH as ALIGNMENT_MAX_LENGTH,
} from './alignment-report.js';
export {
    buildTree,
    MIN_SEQUENCES as PHYLO_MIN_SEQUENCES,
    DEFAULT_MAX_LENGTH as PHYLO_MAX_LENGTH,
} from './phylo-report.js';
export { surveySites, analyseDigest, ENZYME_GROUPS } from './restriction-report.js';
export {
    designPrimers,
    checkHairpin,
    GC_RANGE,
    MAX_TM_DIFFERENCE,
    MIN_AMPLICON_GAP,
    MAX_PAIRS,
} from './primer.js';
export {
    CODON_USAGE,
    RARE_CODON_THRESHOLD,
    analyseCodonUsage,
    optimiseCodons,
    countCodons,
    calculateCAI,
    caiFromCounts,
    getOptimalCodon,
} from './codon.js';
export {
    translateSixFrames,
    findFrameOrfs,
    DEFAULT_MIN_ORF_LENGTH,
    DEFAULT_MAX_LENGTH as SIXFRAME_MAX_LENGTH,
} from './translation.js';
export { computeSlidingProperties, computeProperty, estimatePi, METRICS } from './properties.js';
