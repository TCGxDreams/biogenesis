// ============================================
// BioGenesis — Restriction analysis reports (pure domain logic)
// ============================================
//
// No DOM, no HTML. Returns plain objects; throws BioError on bad input.

import { BioError } from './errors.js';

/**
 * @typedef {import('./types.js').RestrictionSite} RestrictionSite
 * @typedef {import('./types.js').CutMark} CutMark
 * @typedef {import('./types.js').SurveySummary} SurveySummary
 * @typedef {import('./types.js').SiteSurvey} SiteSurvey
 * @typedef {import('./types.js').Fragment} Fragment
 * @typedef {import('./types.js').DigestReport} DigestReport
 */

import {
    RESTRICTION_ENZYMES_UNIQUE,
    findRestrictionSites,
    simulateDigest,
} from '../utils/restriction.js';

/** Enzyme groups tallied in the survey summary. */
export const ENZYME_GROUPS = ['common', '4cutter', 'rare', 'golden', 'methylation'];

/**
 * @param {string} sequence
 * @returns {void}
 * @throws {BioError} `INVALID_SEQUENCE`, `EMPTY_SEQUENCE`
 */
function assertSequence(sequence) {
    if (typeof sequence !== 'string') {
        throw new BioError('Sequence must be a string.', 'INVALID_SEQUENCE');
    }
    if (sequence.length === 0) {
        throw new BioError('Sequence is empty.', 'EMPTY_SEQUENCE');
    }
}

/**
 * Survey which enzymes of a panel cut a sequence, and where.
 *
 * @param {string} sequence
 * @param {Object} [options]
 * @param {RestrictionSite[]} [options.enzymes] Panel to search, defaults to the
 *   full deduplicated enzyme table.
 * @returns {SiteSurvey}
 * @throws {BioError} `INVALID_SEQUENCE`, `EMPTY_SEQUENCE`
 */
export function surveySites(sequence, options = {}) {
    assertSequence(sequence);
    const panel = options.enzymes || RESTRICTION_ENZYMES_UNIQUE;

    const sites = findRestrictionSites(sequence, panel);

    const groups = Object.fromEntries(ENZYME_GROUPS.map(g => [g, 0]));
    let totalCuts = 0;
    let uniqueCutterCount = 0;
    for (const site of sites) {
        totalCuts += site.numCuts;
        if (site.numCuts === 1) uniqueCutterCount++;
        if (groups[site.group] !== undefined) groups[site.group]++;
    }

    const cutMap = sites
        .flatMap(site =>
            site.positions.map(position => ({
                position,
                enzyme: site.name,
                overhang: site.overhang,
            }))
        )
        .sort((a, b) => a.position - b.position);

    return {
        sites,
        summary: {
            cutterCount: sites.length,
            uniqueCutterCount,
            totalCuts,
            nonCutterCount: panel.length - sites.length,
            panelSize: panel.length,
            groups,
        },
        cutMap,
        sequenceLength: sequence.length,
    };
}

/**
 * Simulate a digest with a named set of enzymes.
 *
 * The sequence is treated as linear: `n` cuts yield `n + 1` fragments whose
 * sizes sum to the sequence length.
 *
 * @param {string} sequence
 * @param {string[]} enzymeNames Enzymes to digest with. An empty list is valid
 *   and returns the intact sequence as one fragment.
 * @param {Object} [options]
 * @param {RestrictionSite[]} [options.enzymes] Panel to search.
 * @returns {DigestReport}
 * @throws {BioError} `INVALID_SEQUENCE`, `EMPTY_SEQUENCE`, `INVALID_ENZYME_LIST`
 */
export function analyseDigest(sequence, enzymeNames, options = {}) {
    assertSequence(sequence);
    if (!Array.isArray(enzymeNames)) {
        throw new BioError('Enzyme names must be an array.', 'INVALID_ENZYME_LIST');
    }

    const panel = options.enzymes || RESTRICTION_ENZYMES_UNIQUE;
    const all = findRestrictionSites(sequence, panel);
    const sites = all.filter(r => enzymeNames.includes(r.name));
    const fragments = simulateDigest(sequence, sites);

    const matched = sites.map(s => s.name);
    return {
        sites,
        fragments,
        enzymeSummary: {
            requested: [...enzymeNames],
            matched,
            unmatched: enzymeNames.filter(n => !matched.includes(n)),
            totalCuts: sites.reduce((sum, s) => sum + s.numCuts, 0),
            fragmentCount: fragments.length,
        },
        sequenceLength: sequence.length,
    };
}
