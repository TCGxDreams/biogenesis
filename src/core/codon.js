// ============================================
// BioGenesis — Codon usage and optimisation (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';
import { translate, CODON_TABLE } from '../utils/bioUtils.js';

/**
 * @typedef {import('./types.js').CodonEntry} CodonEntry
 * @typedef {import('./types.js').CodonUsageReport} CodonUsageReport
 */

/**
 * Codon usage tables, in frequency per 1000 codons.
 *
 * @type {{[organism: string]: {name: string, table: {[codon: string]: number}}}}
 */
export const CODON_USAGE = {
    ecoli: {
        name: 'E. coli K12',
        table: {
            TTT: 22.0,
            TTC: 16.2,
            TTA: 13.8,
            TTG: 13.5,
            CTT: 11.6,
            CTC: 10.9,
            CTA: 3.9,
            CTG: 51.3,
            ATT: 30.6,
            ATC: 24.5,
            ATA: 4.7,
            ATG: 27.3,
            GTT: 18.3,
            GTC: 15.0,
            GTA: 10.8,
            GTG: 25.7,
            TAT: 16.2,
            TAC: 12.1,
            TAA: 2.0,
            TAG: 0.3,
            TGT: 5.2,
            TGC: 6.3,
            TGA: 1.0,
            TGG: 15.2,
            TCT: 8.6,
            TCC: 8.7,
            TCA: 7.6,
            TCG: 8.7,
            CCT: 7.2,
            CCC: 5.5,
            CCA: 8.4,
            CCG: 22.6,
            ACT: 9.0,
            ACC: 22.9,
            ACA: 7.6,
            ACG: 14.4,
            GCT: 15.5,
            GCC: 25.3,
            GCA: 20.3,
            GCG: 32.7,
            GAT: 32.4,
            GAC: 19.0,
            GAA: 39.3,
            GAG: 18.3,
            CAT: 12.8,
            CAC: 9.4,
            CAA: 15.3,
            CAG: 28.8,
            AAT: 18.3,
            AAC: 21.4,
            AAA: 33.9,
            AAG: 10.7,
            CGT: 20.7,
            CGC: 21.5,
            CGA: 3.7,
            CGG: 5.7,
            AGT: 9.0,
            AGC: 15.9,
            AGA: 2.3,
            AGG: 1.5,
            GGT: 24.5,
            GGC: 28.5,
            GGA: 8.1,
            GGG: 11.2,
        },
    },
    human: {
        name: 'Homo sapiens',
        table: {
            TTT: 17.6,
            TTC: 20.3,
            TTA: 7.7,
            TTG: 12.9,
            CTT: 13.2,
            CTC: 19.6,
            CTA: 7.2,
            CTG: 39.6,
            ATT: 16.0,
            ATC: 20.8,
            ATA: 7.5,
            ATG: 22.0,
            GTT: 11.0,
            GTC: 14.5,
            GTA: 7.1,
            GTG: 28.1,
            TAT: 12.2,
            TAC: 15.3,
            TAA: 1.0,
            TAG: 0.8,
            TGT: 10.6,
            TGC: 12.6,
            TGA: 1.6,
            TGG: 13.2,
            TCT: 15.2,
            TCC: 17.7,
            TCA: 12.2,
            TCG: 4.4,
            CCT: 17.5,
            CCC: 19.8,
            CCA: 16.9,
            CCG: 6.9,
            ACT: 13.1,
            ACC: 18.9,
            ACA: 15.1,
            ACG: 6.1,
            GCT: 18.4,
            GCC: 27.7,
            GCA: 15.8,
            GCG: 7.4,
            GAT: 21.8,
            GAC: 25.1,
            GAA: 29.0,
            GAG: 39.6,
            CAT: 10.9,
            CAC: 15.1,
            CAA: 12.3,
            CAG: 34.2,
            AAT: 17.0,
            AAC: 19.1,
            AAA: 24.4,
            AAG: 31.9,
            CGT: 4.5,
            CGC: 10.4,
            CGA: 6.2,
            CGG: 11.4,
            AGT: 12.1,
            AGC: 19.5,
            AGA: 12.2,
            AGG: 12.0,
            GGT: 10.8,
            GGC: 22.2,
            GGA: 16.5,
            GGG: 16.5,
        },
    },
    yeast: {
        name: 'S. cerevisiae',
        table: {
            TTT: 26.1,
            TTC: 18.2,
            TTA: 26.2,
            TTG: 27.1,
            CTT: 12.3,
            CTC: 5.4,
            CTA: 13.4,
            CTG: 10.4,
            ATT: 30.1,
            ATC: 17.1,
            ATA: 17.8,
            ATG: 20.9,
            GTT: 22.1,
            GTC: 11.7,
            GTA: 11.8,
            GTG: 10.7,
            TAT: 18.8,
            TAC: 14.7,
            TAA: 1.1,
            TAG: 0.5,
            TGT: 8.0,
            TGC: 4.7,
            TGA: 0.7,
            TGG: 10.4,
            TCT: 23.5,
            TCC: 14.2,
            TCA: 18.7,
            TCG: 8.5,
            CCT: 13.5,
            CCC: 6.8,
            CCA: 18.2,
            CCG: 5.3,
            ACT: 20.3,
            ACC: 12.7,
            ACA: 17.8,
            ACG: 8.0,
            GCT: 21.1,
            GCC: 12.5,
            GCA: 16.2,
            GCG: 6.1,
            GAT: 37.6,
            GAC: 20.2,
            GAA: 45.6,
            GAG: 19.4,
            CAT: 13.6,
            CAC: 7.8,
            CAA: 27.3,
            CAG: 12.1,
            AAT: 35.7,
            AAC: 24.8,
            AAA: 41.9,
            AAG: 30.8,
            CGT: 6.3,
            CGC: 2.6,
            CGA: 3.0,
            CGG: 1.7,
            AGT: 14.2,
            AGC: 9.9,
            AGA: 21.3,
            AGG: 9.2,
            GGT: 23.7,
            GGC: 9.8,
            GGA: 10.9,
            GGG: 6.0,
        },
    },
};

/** Relative adaptiveness below which a codon counts as rare. */
export const RARE_CODON_THRESHOLD = 0.2;

/** Codons grouped by the amino acid they encode. */
const AA_SYNONYMS = /** @type {{[aa: string]: string[]}} */ (
    (() => {
        /** @type {{[aa: string]: string[]}} */
        const groups = {};
        for (const [codon, aa] of Object.entries(CODON_TABLE)) {
            if (!groups[aa]) groups[aa] = [];
            groups[aa].push(codon);
        }
        return groups;
    })()
);

/**
 * @param {string} organismKey
 * @returns {{name: string, table: {[codon: string]: number}}}
 */
function requireOrganism(organismKey) {
    const usage = CODON_USAGE[organismKey];
    if (!usage) {
        throw new BioError(
            `Unknown organism "${organismKey}". Expected one of: ${Object.keys(CODON_USAGE).join(', ')}.`,
            'UNKNOWN_ORGANISM'
        );
    }
    return usage;
}

/**
 * @param {string} sequence
 * @returns {string} Uppercased.
 */
function requireSequence(sequence) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    return sequence.toUpperCase();
}

/**
 * @param {string} aa
 * @param {{[codon: string]: number}} table
 * @returns {number}
 */
function maxSynonymFreq(aa, table) {
    const synonyms = AA_SYNONYMS[aa] || [];
    return synonyms.length ? Math.max(...synonyms.map(c => table[c] || 0)) : 0;
}

/**
 * Count codons in reading frame +1, skipping any codon containing N.
 *
 * @param {string} sequence
 * @returns {{counts: {[codon: string]: number}, totalCodons: number}}
 */
export function countCodons(sequence) {
    const upper = requireSequence(sequence);
    /** @type {{[codon: string]: number}} */
    const counts = {};
    let totalCodons = 0;
    for (let i = 0; i + 2 < upper.length; i += 3) {
        const codon = upper.substring(i, i + 3);
        if (codon.length === 3 && !codon.includes('N')) {
            counts[codon] = (counts[codon] || 0) + 1;
            totalCodons++;
        }
    }
    return { counts, totalCodons };
}

/**
 * Codon adaptation index, weighted by how often each codon occurs.
 *
 * @param {{[codon: string]: number}} counts
 * @param {{[codon: string]: number}} table Organism frequencies.
 * @returns {number} 0 when nothing scorable is present.
 */
export function caiFromCounts(counts, table) {
    let sum = 0;
    let n = 0;
    for (const [codon, count] of Object.entries(counts)) {
        const aa = CODON_TABLE[codon];
        if (!aa || aa === '*') continue;
        const maxFreq = maxSynonymFreq(aa, table);
        const thisFreq = table[codon] || 0.1;
        if (maxFreq > 0) {
            sum += count * Math.log(thisFreq / maxFreq);
            n += count;
        }
    }
    return n > 0 ? Math.exp(sum / n) : 0;
}

/**
 * Codon adaptation index over a sequence, weighting every codon position
 * equally.
 *
 * @param {string} sequence
 * @param {{[codon: string]: number}} table Organism frequencies.
 * @returns {number} 0 when nothing scorable is present.
 */
export function calculateCAI(sequence, table) {
    const upper = requireSequence(sequence);
    let sum = 0;
    let count = 0;
    for (let i = 0; i + 2 < upper.length; i += 3) {
        const codon = upper.substring(i, i + 3);
        const aa = CODON_TABLE[codon];
        if (!aa || aa === '*') continue;
        const maxFreq = maxSynonymFreq(aa, table);
        const thisFreq = table[codon] || 0.1;
        if (maxFreq > 0) {
            sum += Math.log(thisFreq / maxFreq);
            count++;
        }
    }
    return count > 0 ? Math.exp(sum / count) : 0;
}

/**
 * The codon an organism uses most often for a residue.
 *
 * Falls back to the first codon in the standard table when no synonym has a
 * recorded frequency, and to `NNN` when the residue is unknown.
 *
 * @param {string} aa One-letter residue code.
 * @param {{[codon: string]: number}} table Organism frequencies.
 * @returns {string}
 */
export function getOptimalCodon(aa, table) {
    const candidates = AA_SYNONYMS[aa];
    if (!candidates || candidates.length === 0) return 'NNN';
    let best = candidates[0];
    let bestFreq = 0;
    for (const codon of candidates) {
        const freq = table[codon] || 0;
        if (freq > bestFreq) {
            bestFreq = freq;
            best = codon;
        }
    }
    return best;
}

/**
 * Analyse how well a coding sequence matches an organism's codon preferences.
 *
 * @param {string} dnaSequence Coding sequence, read in frame +1.
 * @param {string} organismKey Key into CODON_USAGE.
 * @returns {CodonUsageReport}
 * @throws {BioError} `INVALID_SEQUENCE`, `UNKNOWN_ORGANISM`
 */
export function analyseCodonUsage(dnaSequence, organismKey) {
    const upper = requireSequence(dnaSequence);
    const organism = requireOrganism(organismKey);
    const table = organism.table;

    const { counts, totalCodons } = countCodons(upper);

    /**
     * @param {string} codon
     * @param {string} aa
     * @returns {CodonEntry}
     */
    const entryFor = (codon, aa) => {
        const organismFreq = table[codon] || 0;
        const max = maxSynonymFreq(aa, table);
        const count = counts[codon] || 0;
        return {
            codon,
            aa,
            organismFreq,
            count,
            sequenceFreq: totalCodons > 0 ? (count / totalCodons) * 1000 : 0,
            maxSynonymFreq: max,
            isOptimal: organismFreq === max && max > 0,
            relativeAdaptiveness: max > 0 ? organismFreq / max : 0,
        };
    };

    const residues = [...new Set(Object.values(CODON_TABLE))].filter(a => a !== '*').sort();
    const usage = residues
        .map(aa => ({ aa, codons: (AA_SYNONYMS[aa] || []).map(c => entryFor(c, aa)) }))
        .filter(group => group.codons.length > 0);

    const rareCodons = Object.keys(counts)
        .filter(codon => CODON_TABLE[codon] && CODON_TABLE[codon] !== '*')
        .map(codon => entryFor(codon, CODON_TABLE[codon]))
        .filter(e => e.maxSynonymFreq > 0 && e.relativeAdaptiveness < RARE_CODON_THRESHOLD)
        .sort((a, b) => a.relativeAdaptiveness - b.relativeAdaptiveness);

    return {
        organism: { key: organismKey, name: organism.name, table },
        counts,
        totalCodons,
        cai: caiFromCounts(counts, table),
        usage,
        rareCodons,
    };
}

/**
 * Rewrite a coding sequence using the organism's preferred codon for every
 * residue. The encoded protein is unchanged.
 *
 * @param {string} dnaSequence Coding sequence, read in frame +1.
 * @param {string} organismKey Key into CODON_USAGE.
 * @returns {{optimised: string, protein: string, changedCodons: number,
 *   cai: number, originalCai: number}}
 * @throws {BioError} `INVALID_SEQUENCE`, `UNKNOWN_ORGANISM`
 */
export function optimiseCodons(dnaSequence, organismKey) {
    const upper = requireSequence(dnaSequence);
    const organism = requireOrganism(organismKey);
    const table = organism.table;

    const protein = translate(upper);
    let optimised = '';
    for (const aa of protein) optimised += getOptimalCodon(aa, table);

    let changedCodons = 0;
    for (let i = 0; i < Math.min(upper.length, optimised.length) - 2; i += 3) {
        if (upper.substring(i, i + 3) !== optimised.substring(i, i + 3)) changedCodons++;
    }

    return {
        optimised,
        protein,
        changedCodons,
        cai: calculateCAI(optimised, table),
        originalCai: calculateCAI(upper, table),
    };
}
