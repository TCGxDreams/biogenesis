import { describe, it, expect } from 'vitest';
import {
    sketchGenome,
    compareSketches,
    similarityMatrix,
    rankAgainstQuery,
    classify,
    chooseScaled,
    estimateIdentity,
    mashDistance,
    intersectionSize,
    SPECIES_THRESHOLD,
    GENUS_THRESHOLD,
    ESTIMATE_MARGIN,
} from './genomeSimilarity.js';
import { BioError } from './errors.js';

/** Deterministic pseudo-random generator, so every run compares the same genomes. */
function makeRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function randomGenome(length, seed) {
    const random = makeRandom(seed);
    const bases = 'ACGT';
    let out = '';
    for (let i = 0; i < length; i++) out += bases[Math.floor(random() * 4)];
    return out;
}

/** Substitute `rate` of positions, so the pair sits at a known identity. */
function mutate(sequence, rate, seed) {
    const random = makeRandom(seed);
    const bases = 'ACGT';
    const out = sequence.split('');
    for (let i = 0; i < out.length; i++) {
        if (random() < rate) {
            let b = bases[Math.floor(random() * 4)];
            while (b === out[i]) b = bases[Math.floor(random() * 4)];
            out[i] = b;
        }
    }
    return out.join('');
}

function reverseComplement(sequence) {
    const map = { A: 'T', C: 'G', G: 'C', T: 'A' };
    return sequence
        .split('')
        .reverse()
        .map(b => map[b] || b)
        .join('');
}

const GENOME = randomGenome(20000, 7);

describe('sketchGenome', () => {
    it('produces a sorted, de-duplicated sketch', () => {
        const sketch = sketchGenome(GENOME);
        expect(sketch.hashes.length).toBeGreaterThan(0);
        for (let i = 1; i < sketch.hashes.length; i++) {
            expect(sketch.hashes[i]).toBeGreaterThan(sketch.hashes[i - 1]);
        }
    });

    it('keeps roughly one hash in `scaled`', () => {
        const sketch = sketchGenome(GENOME, { scaled: 100 });
        const expected = sketch.kmers / 100;
        // Sampling is stochastic; half to double the target is a sane envelope.
        expect(sketch.hashes.length).toBeGreaterThan(expected * 0.5);
        expect(sketch.hashes.length).toBeLessThan(expected * 2);
    });

    it('sketches a genome and its reverse complement identically', () => {
        const forward = sketchGenome(GENOME);
        const reverse = sketchGenome(reverseComplement(GENOME));
        expect(Array.from(reverse.hashes)).toEqual(Array.from(forward.hashes));
    });

    it('skips ambiguous bases instead of encoding them', () => {
        const withN = `${GENOME.slice(0, 5000)}NNNNN${GENOME.slice(5005)}`;
        const sketch = sketchGenome(withN);
        expect(sketch.skipped).toBe(5);
        expect(sketch.kmers).toBeLessThan(sketchGenome(GENOME).kmers);
    });

    it('rejects input it cannot sketch', () => {
        expect(() => sketchGenome('')).toThrow(BioError);
        expect(() => sketchGenome('ACGT')).toThrow(/at least/);
        expect(() => sketchGenome(GENOME, { k: 2 })).toThrow(/between 7 and 26/);
        expect(() => sketchGenome(GENOME, { k: 40 })).toThrow(/between 7 and 26/);
        expect(() => sketchGenome(GENOME, { scaled: 0 })).toThrow(/at least 1/);
    });
});

describe('compareSketches', () => {
    it('scores a genome against itself as identical', () => {
        const sketch = sketchGenome(GENOME);
        const result = compareSketches(sketch, sketch);
        expect(result.jaccard).toBe(1);
        expect(result.containmentA).toBe(1);
        expect(result.mashDistance).toBe(0);
        expect(result.similarity).toBeCloseTo(100, 5);
        expect(result.verdict).toBe('same-species');
    });

    it('calls a 1% divergent pair the same species', () => {
        // 20 kb at the default rate yields too few hashes to be steady, which
        // is exactly what chooseScaled exists to prevent; the callers that
        // take a whole set apply it for you.
        const scaled = chooseScaled([GENOME.length]);
        const a = sketchGenome(GENOME, { scaled });
        const b = sketchGenome(mutate(GENOME, 0.01, 11), { scaled });
        const result = compareSketches(a, b);
        expect(result.verdict).toBe('same-species');
        expect(result.reliable).toBe(true);
        expect(result.similarity).toBeGreaterThan(SPECIES_THRESHOLD);
    });

    it('refuses to put a number on unrelated genomes', () => {
        const a = sketchGenome(GENOME);
        const b = sketchGenome(randomGenome(20000, 999));
        const result = compareSketches(a, b);
        expect(result.similarity).toBeNull();
        expect(result.verdict).toBe('unmeasurable');
        expect(result.reliable).toBe(false);
        expect(result.note).toMatch(/VIRIDIC|BLAST/);
    });

    it('reports lower containment for the longer genome', () => {
        const short = sketchGenome(GENOME.slice(0, 8000));
        const long = sketchGenome(GENOME);
        const result = compareSketches(short, long);
        expect(result.containmentA).toBeGreaterThan(result.containmentB);
    });

    it('will not call a species on a fragment buried in a larger genome', () => {
        // A 6 kb insert inside 60 kb of unrelated sequence: identity against
        // the insert is perfect, but almost none of the host takes part.
        const insert = GENOME.slice(0, 6000);
        const host = randomGenome(60000, 77) + insert;
        const scaled = chooseScaled([insert.length, host.length]);
        const result = compareSketches(
            sketchGenome(host, { scaled }),
            sketchGenome(insert, { scaled })
        );
        expect(result.similarity).toBeGreaterThan(SPECIES_THRESHOLD);
        expect(result.contained).toBe(true);
        expect(result.verdict).toBe('contained');
        expect(result.note).toMatch(/inside the other/);
    });

    it('refuses to compare sketches built with different settings', () => {
        const a = sketchGenome(GENOME, { k: 21 });
        const b = sketchGenome(GENOME, { k: 17 });
        expect(() => intersectionSize(a, b)).toThrow(/same k/);
    });
});

describe('classify', () => {
    it('calls a rank only outside the estimate margin', () => {
        expect(classify(SPECIES_THRESHOLD + ESTIMATE_MARGIN + 0.1, 0.9).verdict).toBe(
            'same-species'
        );
        expect(classify(SPECIES_THRESHOLD, 0.9).verdict).toBe('borderline');
        expect(classify(GENUS_THRESHOLD, 0.5).verdict).toBe('borderline');
        expect(classify(GENUS_THRESHOLD + ESTIMATE_MARGIN + 0.1, 0.5).verdict).toBe('same-genus');
        expect(classify(40, 0.2).verdict).toBe('outside-genus');
    });

    it('treats a missing figure as unmeasurable', () => {
        expect(classify(null, 0.5).verdict).toBe('unmeasurable');
        expect(classify(99, 0.001).verdict).toBe('unmeasurable');
    });

    it('marks every borderline and below-threshold call unreliable', () => {
        expect(classify(SPECIES_THRESHOLD, 0.9).reliable).toBe(false);
        expect(classify(40, 0.2).reliable).toBe(false);
        expect(classify(99, 0.9).reliable).toBe(true);
    });
});

describe('estimateIdentity and mashDistance', () => {
    it('maps the ends of the range exactly', () => {
        expect(estimateIdentity(0, 21)).toBe(0);
        expect(estimateIdentity(1, 21)).toBe(1);
        expect(mashDistance(1, 21)).toBe(0);
        expect(mashDistance(0, 21)).toBe(1);
    });

    it('recovers the identity behind a k-mer survival rate', () => {
        // 99% identity leaves 0.99^21 of k-mers intact.
        expect(estimateIdentity(Math.pow(0.99, 21), 21)).toBeCloseTo(0.99, 6);
    });

    it('grows monotonically as sequences diverge', () => {
        expect(mashDistance(0.9, 21)).toBeLessThan(mashDistance(0.5, 21));
        expect(mashDistance(0.5, 21)).toBeLessThan(mashDistance(0.1, 21));
    });
});

describe('similarityMatrix', () => {
    const genomes = [
        { name: 'query', sequence: GENOME },
        { name: 'close', sequence: mutate(GENOME, 0.01, 3) },
        { name: 'unrelated', sequence: randomGenome(20000, 42) },
    ];

    it('is symmetric with an identical diagonal', () => {
        const { similarity, matrix } = similarityMatrix(genomes);
        expect(similarity[0][0]).toBe(100);
        expect(similarity[0][1]).toBe(similarity[1][0]);
        expect(matrix[0][2].verdict).toBe('unmeasurable');
    });

    it('needs two genomes', () => {
        expect(() => similarityMatrix([genomes[0]])).toThrow(/at least two/);
    });
});

describe('rankAgainstQuery', () => {
    it('puts the closest relative first and keeps unmeasurable pairs last', () => {
        const ranked = rankAgainstQuery({ name: 'query', sequence: GENOME }, [
            { name: 'unrelated', sequence: randomGenome(20000, 5) },
            { name: 'close', sequence: mutate(GENOME, 0.005, 9) },
        ]);
        expect(ranked[0].name).toBe('close');
        expect(ranked[0].comparison.verdict).toBe('same-species');
        expect(ranked[1].comparison.similarity).toBeNull();
    });

    it('needs a query and at least one reference', () => {
        expect(() => rankAgainstQuery(null, [])).toThrow(BioError);
        expect(() => rankAgainstQuery({ name: 'q', sequence: GENOME }, [])).toThrow(
            /at least one reference/
        );
    });
});
