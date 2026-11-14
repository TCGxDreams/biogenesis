// ============================================
// BioGenesis — Genome similarity reports (pure domain logic)
// ============================================
//
// Turns a comparison into something that leaves the app: a table to paste into
// a manuscript, or a file to attach to one. Every serializer carries the method
// and its limits with the numbers, because a bare percentage invites exactly
// the mistake these tools make easiest — reading an estimate as a measurement.
//
// No DOM, no HTML. Returns plain objects and strings.

import { BioError } from './errors.js';
import { SPECIES_THRESHOLD, GENUS_THRESHOLD } from './genomeSimilarity.js';

/** What each verdict means, spelled out once for every serializer. */
export const VERDICT_TEXT = {
    'same-species': 'same species',
    'same-genus': 'same genus',
    borderline: 'borderline — confirm with VIRIDIC',
    contained: 'one genome contained in the other',
    'outside-genus': 'outside genus',
    unmeasurable: 'too distant to measure',
};

/**
 * The sentence that has to travel with the numbers.
 *
 * ANI over shared regions is not VIRIDIC's intergenomic similarity, and on the
 * jumbo-phage set these were checked against it ran 2-3 points higher. Anyone
 * quoting a figure from here needs to know which quantity it is.
 */
export const METHOD_NOTE =
    'Estimated average nucleotide identity over shared regions, from a FracMinHash ' +
    'k-mer sketch. Not VIRIDIC intergenomic similarity, which divides by the full ' +
    'length of both genomes and reads lower when part of a genome does not align. ' +
    `ICTV demarcation: ${SPECIES_THRESHOLD}% species, ${GENUS_THRESHOLD}% genus.`;

/**
 * @typedef {Object} ReportPair
 * @property {string} a
 * @property {string} b
 * @property {number|null} similarity
 * @property {number} containment
 * @property {number} mashDistance
 * @property {string} verdict
 */

/**
 * @typedef {Object} SimilarityReport
 * @property {'matrix'|'relatives'} kind
 * @property {string} title
 * @property {number} k
 * @property {string} generatedAt ISO timestamp.
 * @property {ReportPair[]} pairs
 * @property {string[]} notes Extra lines specific to this run.
 */

/**
 * Build a report from an all-against-all comparison.
 *
 * @param {{names: string[], matrix: any[][], similarity: (number|null)[][]}} data
 * @param {Object} options
 * @param {number} options.k
 * @param {string} [options.generatedAt]
 * @returns {SimilarityReport}
 * @throws {BioError} `EMPTY_REPORT`
 */
export function matrixReport(data, { k, generatedAt } = {}) {
    if (!data || !Array.isArray(data.names) || data.names.length < 2) {
        throw new BioError('Nothing to report.', 'EMPTY_REPORT');
    }
    const pairs = [];
    for (let i = 0; i < data.names.length; i++) {
        for (let j = i + 1; j < data.names.length; j++) {
            const cmp = data.matrix[i][j];
            pairs.push({
                a: data.names[i],
                b: data.names[j],
                similarity: cmp.similarity,
                containment: cmp.containmentA,
                mashDistance: cmp.mashDistance,
                verdict: cmp.verdict,
            });
        }
    }
    pairs.sort((x, y) => (y.similarity ?? -1) - (x.similarity ?? -1));

    return {
        kind: 'matrix',
        title: `Genome similarity — ${data.names.length} genomes`,
        k,
        generatedAt: generatedAt || new Date().toISOString(),
        pairs,
        notes: [],
    };
}

/**
 * Build a report from a search against a reference set.
 *
 * @param {{name: string}} query
 * @param {{name: string, comparison: any}[]} ranked
 * @param {Object} options
 * @param {number} options.k
 * @param {number} [options.total] Records the search matched in all.
 * @param {{min: number, max: number}} [options.range]
 * @param {string} [options.term]
 * @param {string} [options.generatedAt]
 * @returns {SimilarityReport}
 * @throws {BioError} `EMPTY_REPORT`
 */
export function relativesReport(query, ranked, { k, total, range, term, generatedAt } = {}) {
    if (!query?.name || !Array.isArray(ranked) || ranked.length === 0) {
        throw new BioError('Nothing to report.', 'EMPTY_REPORT');
    }
    const notes = [];
    if (term) notes.push(`GenBank term: ${term}`);
    if (range) {
        notes.push(
            `Length window: ${range.min.toLocaleString('en-US')}–${range.max.toLocaleString('en-US')} bp`
        );
    }
    if (Number.isFinite(total)) {
        notes.push(
            `Compared ${ranked.length} of ${Number(total).toLocaleString('en-US')} matching records. ` +
                'A relative the search did not return reads as novelty.'
        );
    }

    return {
        kind: 'relatives',
        title: `Genome similarity — ${query.name} against a reference set`,
        k,
        generatedAt: generatedAt || new Date().toISOString(),
        pairs: ranked.map((r) => ({
            a: query.name,
            b: r.name,
            similarity: r.comparison.similarity,
            containment: r.comparison.containmentA,
            mashDistance: r.comparison.mashDistance,
            verdict: r.comparison.verdict,
        })),
        notes,
    };
}

/** Format a similarity for output, keeping "not measurable" distinct from zero. */
function formatSimilarity(value) {
    return value === null || value === undefined ? 'NA' : value.toFixed(2);
}

/**
 * Tab-separated table, for a spreadsheet or a stats package.
 *
 * Comment lines are prefixed with `#` so the method note travels with the data
 * without breaking a reader that skips comments.
 *
 * @param {SimilarityReport} report
 * @returns {string}
 */
export function reportToTsv(report) {
    const lines = [
        `# ${report.title}`,
        `# generated: ${report.generatedAt}`,
        `# k-mer size: ${report.k}`,
        `# ${METHOD_NOTE}`,
        ...report.notes.map((n) => `# ${n}`),
        ['genome_a', 'genome_b', 'identity_percent', 'kmer_containment', 'mash_distance', 'verdict'].join(
            '\t'
        ),
    ];
    for (const p of report.pairs) {
        lines.push(
            [
                p.a,
                p.b,
                formatSimilarity(p.similarity),
                p.containment.toFixed(4),
                p.mashDistance.toFixed(4),
                VERDICT_TEXT[p.verdict] || p.verdict,
            ].join('\t')
        );
    }
    return `${lines.join('\n')}\n`;
}

/**
 * Markdown, for pasting straight into a write-up.
 *
 * @param {SimilarityReport} report
 * @returns {string}
 */
export function reportToMarkdown(report) {
    const rows = report.pairs
        .map(
            (p) =>
                `| ${p.a} | ${p.b} | ${formatSimilarity(p.similarity)} | ${(p.containment * 100).toFixed(1)}% | ${p.mashDistance.toFixed(4)} | ${VERDICT_TEXT[p.verdict] || p.verdict} |`
        )
        .join('\n');

    return [
        `# ${report.title}`,
        '',
        `Generated ${report.generatedAt} · k = ${report.k}`,
        '',
        ...(report.notes.length ? [...report.notes.map((n) => `- ${n}`), ''] : []),
        '| Genome A | Genome B | Identity % | k-mers shared | MASH distance | Verdict |',
        '| --- | --- | --- | --- | --- | --- |',
        rows,
        '',
        `> ${METHOD_NOTE}`,
        '',
    ].join('\n');
}

/**
 * A filename that is safe on every platform and says what the file holds.
 *
 * @param {SimilarityReport} report
 * @param {string} extension
 * @returns {string}
 */
export function reportFilename(report, extension) {
    const stamp = report.generatedAt.slice(0, 19).replace(/[:T]/g, '-');
    return `genome-similarity-${report.kind}-${stamp}.${extension}`;
}
