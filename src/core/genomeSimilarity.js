// ============================================
// BioGenesis — Whole-genome similarity screening (pure domain logic)
// ============================================
//
// Alignment-free comparison of whole genomes, for deciding whether two
// isolates are the same species/genus before reaching for a real aligner.
//
// The method is FracMinHash (the sketch sourmash uses, and a close cousin of
// MASH's bottom sketch): hash every canonical k-mer, keep the fraction that
// falls below a threshold, and compare the kept sets. Unlike a fixed-size
// bottom sketch, a scaled sketch supports *containment*, so genomes of very
// different lengths still compare honestly.
//
// What this can and cannot do is stated in `classify()`: a sketch sees shared
// k-mers, not alignments, so it answers the species question well and the
// "how distant is this new genus" question badly. No DOM, no HTML.

import { BioError } from './errors.js';

/** k-mer length. 21 is the standard for genome-scale nucleotide comparison. */
export const DEFAULT_K = 21;

/**
 * Keep 1 hash in `scaled`. 200 gives ~1,750 hashes for a 350 kb phage, which
 * is plenty of resolution while staying fast enough to run in a UI thread.
 */
export const DEFAULT_SCALED = 200;

/**
 * Hashes a sketch needs before its estimates settle down.
 *
 * Below roughly this many, sampling noise moves the similarity figure by
 * several points between runs — an 83-hash sketch of a 20 kb genome read a
 * 1%-divergent pair anywhere from 93% to 99%. `chooseScaled` keeps sketches
 * at or above this size by sampling small genomes more densely.
 */
export const TARGET_SKETCH_HASHES = 600;

/** Shortest input worth sketching. */
export const MIN_GENOME_LENGTH = 500;

/** ICTV demarcation thresholds for prokaryotic viruses, in percent. */
export const SPECIES_THRESHOLD = 95;
export const GENUS_THRESHOLD = 70;

/**
 * How far the ANI estimate may sit from the real figure, in percent.
 *
 * Checked against taxmyPHAGE 0.3.7 on jumbo-phage pairs and against synthetic
 * pairs mutated to a known rate: where containment supports a reading at all,
 * the estimate lands within about a point. A result inside this margin of a
 * threshold is reported as borderline rather than called.
 */
export const ESTIMATE_MARGIN = 1;

/**
 * Covered fraction a species call requires.
 *
 * Identity alone cannot separate "the same genome" from "a prophage sitting
 * inside a much larger host contig": both score high. Demanding that most of
 * the smaller genome participate keeps the second case out.
 */
export const MIN_SPECIES_COVERAGE = 0.5;

/**
 * Containment pair that marks one genome as sitting inside the other: nearly
 * all of the smaller one is present, while most of the larger one is not.
 */
export const CONTAINED_HIGH = 0.8;
export const CONTAINED_LOW = 0.5;

/**
 * Containment below which the shared k-mers are noise: a 25%-similar pair and
 * a 31%-similar pair both land here, so no figure is reported.
 */
export const MIN_MEASURABLE_CONTAINMENT = 0.02;

/** 2^32, the hash space the sketch threshold is taken from. */
const HASH_SPACE = 4294967296;

/** Two bits per base; anything else breaks the rolling encode. */
const BASE_CODE = { A: 0, C: 1, G: 2, T: 3, U: 3 };
const COMPLEMENT_CODE = { A: 3, C: 2, G: 1, T: 0, U: 0 };

/**
 * @typedef {Object} GenomeSketch
 * @property {number} k
 * @property {number} scaled
 * @property {Uint32Array} hashes Sorted, de-duplicated.
 * @property {number} length Bases in the source genome.
 * @property {number} kmers Valid k-mers seen (ambiguous positions skipped).
 * @property {number} skipped Positions dropped for non-ACGT characters.
 * @property {string} [name]
 */

/**
 * Mix a 42-bit k-mer code into a well-distributed 32-bit hash.
 *
 * Splits the code across two 32-bit halves because `Math.imul` is the only
 * fast integer multiply available, then runs an xorshift-multiply finalizer.
 *
 * @param {number} code Integer < 2^53 (k <= 26 keeps it exact).
 * @returns {number} Unsigned 32-bit hash.
 */
function hashCode(code) {
    const low = code >>> 0;
    const high = Math.floor(code / HASH_SPACE) >>> 0;
    let h = Math.imul(low ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    h = (h ^ Math.imul(high ^ (h >>> 13), 0xc2b2ae35)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
}

/**
 * Build a FracMinHash sketch of one genome.
 *
 * Both strands are encoded in the same pass and the smaller code of each
 * position is kept, so a genome and its reverse complement sketch identically.
 *
 * @param {string} sequence Nucleotides; non-ACGTU characters break k-mer runs.
 * @param {Object} [options]
 * @param {number} [options.k=21]
 * @param {number} [options.scaled=200]
 * @param {string} [options.name]
 * @returns {GenomeSketch}
 * @throws {BioError} `EMPTY_SEQUENCE`, `INVALID_K`, `INVALID_SCALED`,
 *   `SEQUENCE_TOO_SHORT`.
 */
export function sketchGenome(sequence, options = {}) {
    const { k = DEFAULT_K, scaled = DEFAULT_SCALED, name } = options;

    if (!Number.isInteger(k) || k < 7 || k > 26) {
        throw new BioError('k must be a whole number between 7 and 26.', 'INVALID_K');
    }
    if (!Number.isFinite(scaled) || scaled < 1) {
        throw new BioError('Scaled factor must be at least 1.', 'INVALID_SCALED');
    }

    const seq = String(sequence || '').toUpperCase();
    if (seq.length === 0) {
        throw new BioError('Sequence is empty.', 'EMPTY_SEQUENCE');
    }
    if (seq.length < Math.max(k, MIN_GENOME_LENGTH)) {
        throw new BioError(
            `Sequence is too short to compare; needs at least ${MIN_GENOME_LENGTH} bases.`,
            'SEQUENCE_TOO_SHORT'
        );
    }

    const threshold = HASH_SPACE / scaled;
    // 4^k overflows 2^53 past k=26, which INVALID_K already rules out.
    const topShift = Math.pow(4, k - 1);
    const mask = Math.pow(4, k);

    /** @type {number[]} */
    const kept = [];
    let forward = 0;
    let reverse = 0;
    let run = 0;
    let kmers = 0;
    let skipped = 0;

    for (let i = 0; i < seq.length; i++) {
        const base = seq[i];
        const code = BASE_CODE[base];
        if (code === undefined) {
            // An N (or any ambiguity code) cannot be encoded, so the k-mer run
            // restarts after it rather than silently spanning the gap.
            run = 0;
            forward = 0;
            reverse = 0;
            skipped++;
            continue;
        }

        forward = (forward % topShift) * 4 + code;
        reverse = Math.floor(reverse / 4) + COMPLEMENT_CODE[base] * topShift;
        run++;

        if (run < k) continue;
        kmers++;

        // Canonical form: whichever strand sorts lower.
        const canonical = forward < reverse ? forward : reverse;
        const h = hashCode(canonical % mask);
        if (h < threshold) kept.push(h);
    }

    kept.sort((a, b) => a - b);

    // De-duplicate in place; repeats inflate containment otherwise.
    let write = 0;
    for (let i = 0; i < kept.length; i++) {
        if (i === 0 || kept[i] !== kept[i - 1]) kept[write++] = kept[i];
    }

    return {
        k,
        scaled,
        hashes: Uint32Array.from(kept.slice(0, write)),
        length: seq.length,
        kmers,
        skipped,
        ...(name ? { name } : {}),
    };
}

/**
 * Hashes present in both sketches.
 *
 * @param {GenomeSketch} a
 * @param {GenomeSketch} b
 * @returns {number}
 * @throws {BioError} `SKETCH_MISMATCH` when the sketches are not comparable.
 */
export function intersectionSize(a, b) {
    if (a.k !== b.k || a.scaled !== b.scaled) {
        throw new BioError(
            'Sketches must share the same k and scaled factor to be compared.',
            'SKETCH_MISMATCH'
        );
    }
    let i = 0;
    let j = 0;
    let shared = 0;
    while (i < a.hashes.length && j < b.hashes.length) {
        if (a.hashes[i] === b.hashes[j]) {
            shared++;
            i++;
            j++;
        } else if (a.hashes[i] < b.hashes[j]) {
            i++;
        } else {
            j++;
        }
    }
    return shared;
}

/**
 * MASH distance from a Jaccard estimate.
 *
 * @param {number} jaccard
 * @param {number} k
 * @returns {number} 0 for identical sets, 1 when nothing is shared.
 */
export function mashDistance(jaccard, k) {
    if (jaccard <= 0) return 1;
    if (jaccard >= 1) return 0;
    return Math.min(1, (-1 / k) * Math.log((2 * jaccard) / (1 + jaccard)));
}

/**
 * Average nucleotide identity implied by a containment value.
 *
 * A single substitution destroys up to k overlapping k-mers, so surviving
 * k-mers fall off as identity^k — inverting that gives the identity estimate.
 * Only meaningful when most of the smaller genome is actually covered, which
 * is why `compare()` reports containment beside it.
 *
 * @param {number} containment
 * @param {number} k
 * @returns {number} 0-1.
 */
export function estimateIdentity(containment, k) {
    if (containment <= 0) return 0;
    if (containment >= 1) return 1;
    return Math.pow(containment, 1 / k);
}

/**
 * @typedef {Object} GenomeComparison
 * @property {number} shared Hashes in both sketches.
 * @property {number} jaccard
 * @property {number} containmentA Fraction of A's k-mers also in B.
 * @property {number} containmentB
 * @property {number} mashDistance
 * @property {number} identity Estimated ANI over the shared part, 0-1.
 * @property {number|null} similarity Estimated ANI as a percent; null when too
 *   few k-mers are shared for any figure to mean anything. This is identity
 *   over the regions the genomes share — NOT VIRIDIC's intergenomic
 *   similarity, which divides by the full length of both genomes and so reads
 *   lower whenever part of either genome does not align.
 * @property {number} coverage Rough fraction of the better-covered genome that
 *   participates, 0-1. Noisier than `similarity`; a guard, not a measurement.
 * @property {string} verdict One of `same-species`, `same-genus`,
 *   `borderline`, `outside-genus`, `unmeasurable`.
 * @property {boolean} reliable False when the sketch cannot support the call.
 * @property {string} note Why the verdict reads the way it does.
 */

/**
 * Compare two sketches.
 *
 * `similarity` mirrors the VIRIDIC definition — identical bases counted
 * against the summed length of both genomes — with the aligned fraction taken
 * from containment rather than from real alignments. That approximation holds
 * while the genomes are close; once they diverge past roughly 90% identity the
 * k-mer signal collapses faster than the alignment does and the figure reads
 * far too low, so `reliable` goes false and the verdict stops claiming a rank.
 *
 * @param {GenomeSketch} a
 * @param {GenomeSketch} b
 * @returns {GenomeComparison}
 */
export function compareSketches(a, b) {
    const shared = intersectionSize(a, b);
    const union = a.hashes.length + b.hashes.length - shared;
    const jaccard = union > 0 ? shared / union : 0;
    const containmentA = a.hashes.length > 0 ? shared / a.hashes.length : 0;
    const containmentB = b.hashes.length > 0 ? shared / b.hashes.length : 0;

    const bestContainment = Math.max(containmentA, containmentB);

    // Identity is read off whichever genome is better covered: a short genome
    // fully contained in a long one still shares all of its own k-mers.
    const identity = estimateIdentity(bestContainment, a.k);

    // Dice is the symmetric share of k-mers; dividing it by the survival rate
    // those substitutions imply leaves roughly the covered fraction. It is a
    // ratio of two sampled quantities, so it is far noisier than identity
    // itself — reported as a guard against high-identity fragments, never as
    // the headline number.
    const survival = Math.pow(identity, a.k);
    const dice = (2 * shared) / (a.hashes.length + b.hashes.length);
    const coverage = survival > 0 ? Math.min(1, dice / survival) : 0;

    const measurable = bestContainment >= MIN_MEASURABLE_CONTAINMENT;
    const similarity = measurable ? 100 * identity : null;

    // One genome almost entirely inside the other, while the other is mostly
    // something else: a gene in a plasmid, a prophage in a host contig. That
    // is a part-whole relationship, not two isolates of one species, and
    // identity alone cannot tell them apart.
    const leastContainment = Math.min(containmentA, containmentB);
    const contained =
        measurable && bestContainment >= CONTAINED_HIGH && leastContainment < CONTAINED_LOW;

    return {
        shared,
        jaccard,
        containmentA,
        containmentB,
        mashDistance: mashDistance(jaccard, a.k),
        identity,
        coverage,
        contained,
        similarity,
        ...classify(similarity, bestContainment, coverage, contained),
    };
}

/**
 * Turn a similarity figure into an ICTV-style verdict, refusing to call ranks
 * the sketch cannot support.
 *
 * A result within `ESTIMATE_MARGIN` of either threshold comes back
 * `borderline`: the estimate's own error is that wide, so calling the rank
 * there would be guessing with a decimal point on it.
 *
 * @param {number|null} similarity Estimated ANI as a percent, or null.
 * @param {number} containment Best of the two containment values.
 * @param {number} [coverage=1] Estimated covered fraction.
 * @param {boolean} [contained=false] One genome sits inside the other.
 * @returns {{verdict: string, reliable: boolean, note: string}}
 */
export function classify(similarity, containment, coverage = 1, contained = false) {
    // Below this, surviving k-mers are too few to separate "diverged" from
    // "barely related" — both look like noise to a sketch.
    if (similarity === null || containment < MIN_MEASURABLE_CONTAINMENT) {
        return {
            verdict: 'unmeasurable',
            reliable: false,
            note: 'Too few shared k-mers for a figure. The genomes are distant — outside the same genus on this evidence, but run VIRIDIC or BLAST to say how far.',
        };
    }
    if (contained) {
        return {
            verdict: 'contained',
            reliable: true,
            note: 'One genome is almost entirely present inside the other, which is mostly other sequence — a region or insert, not two isolates of one species.',
        };
    }
    if (similarity >= SPECIES_THRESHOLD + ESTIMATE_MARGIN) {
        if (coverage < MIN_SPECIES_COVERAGE) {
            return {
                verdict: 'borderline',
                reliable: false,
                note: `Identity is high but only about ${Math.round(coverage * 100)}% of the genome takes part, so this reads as a shared region rather than a shared species.`,
            };
        }
        return {
            verdict: 'same-species',
            reliable: true,
            note: `Clear of the ${SPECIES_THRESHOLD}% species threshold by more than the estimate's margin.`,
        };
    }
    if (similarity >= SPECIES_THRESHOLD - ESTIMATE_MARGIN) {
        return {
            verdict: 'borderline',
            reliable: false,
            note: `Within ${ESTIMATE_MARGIN} points of the ${SPECIES_THRESHOLD}% species threshold, which is this estimate's own error. Confirm with VIRIDIC before calling it.`,
        };
    }
    if (similarity >= GENUS_THRESHOLD + ESTIMATE_MARGIN) {
        return {
            verdict: 'same-genus',
            reliable: true,
            note: `Between the ${GENUS_THRESHOLD}% genus and ${SPECIES_THRESHOLD}% species thresholds.`,
        };
    }
    if (similarity >= GENUS_THRESHOLD - ESTIMATE_MARGIN) {
        return {
            verdict: 'borderline',
            reliable: false,
            note: `Within ${ESTIMATE_MARGIN} points of the ${GENUS_THRESHOLD}% genus threshold. Confirm with VIRIDIC before calling it.`,
        };
    }
    return {
        verdict: 'outside-genus',
        reliable: false,
        note: 'Below the genus threshold, where k-mer sketches read low. Treat the number as a screen, not a measurement.',
    };
}

/**
 * Pick one sampling rate for a set of genomes.
 *
 * Sketches are only comparable when they share a rate, so it is set by the
 * shortest genome in the set: that is the one whose sketch would otherwise be
 * too sparse to trust. Longer genomes simply keep more hashes.
 *
 * @param {number[]} lengths Genome lengths in bases.
 * @param {number} [target=600] Hashes the smallest genome should yield.
 * @returns {number} A scaled factor between 1 and `DEFAULT_SCALED`.
 */
export function chooseScaled(lengths, target = TARGET_SKETCH_HASHES) {
    const shortest = Math.min(...lengths.filter((n) => Number.isFinite(n) && n > 0));
    if (!Number.isFinite(shortest)) return DEFAULT_SCALED;
    return Math.max(1, Math.min(DEFAULT_SCALED, Math.floor(shortest / target)));
}

/**
 * Sketch a set of genomes and compare every pair.
 *
 * @param {{name: string, sequence: string}[]} genomes
 * @param {Object} [options] Passed through to `sketchGenome`.
 * @returns {{
 *   names: string[],
 *   sketches: GenomeSketch[],
 *   matrix: GenomeComparison[][],
 *   similarity: number[][]
 * }}
 * @throws {BioError} `NOT_ENOUGH_GENOMES`
 */
export function similarityMatrix(genomes, options = {}) {
    if (!Array.isArray(genomes) || genomes.length < 2) {
        throw new BioError('Need at least two genomes to compare.', 'NOT_ENOUGH_GENOMES');
    }

    const scaled =
        options.scaled ?? chooseScaled(genomes.map((g) => String(g.sequence || '').length));
    const sketches = genomes.map((g) =>
        sketchGenome(g.sequence, { ...options, scaled, name: g.name })
    );
    const n = sketches.length;
    const matrix = [];
    const similarity = [];

    for (let i = 0; i < n; i++) {
        matrix.push(new Array(n));
        similarity.push(new Array(n));
    }
    for (let i = 0; i < n; i++) {
        matrix[i][i] = compareSketches(sketches[i], sketches[i]);
        similarity[i][i] = 100;
        for (let j = i + 1; j < n; j++) {
            const cmp = compareSketches(sketches[i], sketches[j]);
            matrix[i][j] = cmp;
            matrix[j][i] = cmp;
            similarity[i][j] = cmp.similarity;
            similarity[j][i] = cmp.similarity;
        }
    }

    return { names: genomes.map((g) => g.name), sketches, matrix, similarity };
}

/**
 * Rank reference genomes against one query, closest first — the screening step
 * a taxonomy run starts with.
 *
 * @param {{name: string, sequence: string}} query
 * @param {{name: string, sequence: string}[]} references
 * @param {Object} [options]
 * @returns {{name: string, comparison: GenomeComparison}[]}
 */
export function rankAgainstQuery(query, references, options = {}) {
    if (!query || !query.sequence) {
        throw new BioError('A query genome is required.', 'EMPTY_SEQUENCE');
    }
    if (!Array.isArray(references) || references.length === 0) {
        throw new BioError('Need at least one reference genome.', 'NOT_ENOUGH_GENOMES');
    }

    const scaled =
        options.scaled ??
        chooseScaled([query, ...references].map((g) => String(g.sequence || '').length));
    const q = sketchGenome(query.sequence, { ...options, scaled, name: query.name });

    return references
        .map((ref) => ({
            name: ref.name,
            length: ref.sequence.length,
            comparison: compareSketches(
                q,
                sketchGenome(ref.sequence, { ...options, scaled, name: ref.name })
            ),
        }))
        // Unmeasurable pairs carry no figure, so they sort below every pair
        // that does rather than drifting to the top on a NaN comparison.
        .sort((x, y) => (y.comparison.similarity ?? -1) - (x.comparison.similarity ?? -1));
}
