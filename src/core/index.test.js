import { describe, it, expect } from 'vitest';
import * as core from './index.js';

describe('core barrel', () => {
    it('re-exports BioError and every core module API', () => {
        expect(Object.keys(core).sort()).toEqual([
            'ALIGNMENT_MAX_LENGTH',
            'BioError',
            'CODON_USAGE',
            'DEFAULT_MIN_ORF_LENGTH',
            'DOTPLOT_MAX_LENGTH',
            'ENZYME_GROUPS',
            'GC_RANGE',
            'MAX_PAIRS',
            'MAX_TM_DIFFERENCE',
            'METRICS',
            'MIN_AMPLICON_GAP',
            'PHYLO_MAX_LENGTH',
            'PHYLO_MIN_SEQUENCES',
            'RARE_CODON_THRESHOLD',
            'SIXFRAME_MAX_LENGTH',
            'alignPair',
            'aminoAcidComposition',
            'analyseCodonUsage',
            'analyseDigest',
            'buildAlignmentReport',
            'buildMatchLine',
            'buildTree',
            'caiFromCounts',
            'calculateCAI',
            'checkHairpin',
            'compileMotifPattern',
            'computeCodonUsage',
            'computeConservation',
            'computeDotMatrix',
            'computeGRAVY',
            'computeGcWindow',
            'computePI',
            'computeProperty',
            'computeSequenceStats',
            'computeSlidingProperties',
            'countCodons',
            'designPrimers',
            'estimatePi',
            'findFrameOrfs',
            'findMotifs',
            'getOptimalCodon',
            'instabilityIndex',
            'optimiseCodons',
            'surveySites',
            'translateSixFrames',
        ]);
    });

    it('exports functions that are usable straight from the barrel', () => {
        expect(core.findMotifs('AAAGAATTCAAA', 'GAATTC').matches).toHaveLength(2);
        expect(() => core.findMotifs('ATGC', 'AT[', { mode: 'regex' })).toThrow(core.BioError);
    });

    it('covers all ten tools extracted in T2', () => {
        // One entry point per T2 task, so a dropped export fails loudly here.
        for (const fn of [
            'computeSequenceStats',
            'findMotifs',
            'computeDotMatrix',
            'buildAlignmentReport',
            'buildTree',
            'analyseDigest',
            'designPrimers',
            'analyseCodonUsage',
            'translateSixFrames',
            'computeSlidingProperties',
        ]) {
            expect(typeof core[fn], fn).toBe('function');
        }
    });
});
