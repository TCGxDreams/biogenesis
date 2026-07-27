import { describe, it, expect } from 'vitest';
import {
    TOOL_META as TOOLS,
    isToolAvailable,
    toolUnavailableReason,
    DEFAULT_TOOL_ID,
} from './toolMeta.js';

const dna = { name: 'a', type: 'dna', sequence: 'ATGC' };
const rna = { name: 'b', type: 'rna', sequence: 'AUGC' };
const protein = { name: 'c', type: 'protein', sequence: 'MKWV' };

const ctx = (sequences, activeSequenceIdx = 0) => ({ sequences, activeSequenceIdx });

describe('TOOL_META', () => {
    it('registers all sixteen tools', () => {
        expect(Object.keys(TOOLS)).toHaveLength(16);
    });

    it('gives every entry an id matching its key', () => {
        for (const [key, tool] of Object.entries(TOOLS)) {
            expect(tool.id, key).toBe(key);
        }
    });

    it('gives every entry a label and availability metadata', () => {
        for (const [key, tool] of Object.entries(TOOLS)) {
            expect(typeof tool.label, key).toBe('string');
            expect(tool.label.length, key).toBeGreaterThan(0);
            expect(Array.isArray(tool.accepts), key).toBe(true);
            expect(tool.accepts.length, key).toBeGreaterThan(0);
            expect(typeof tool.needsSequences, key).toBe('number');
        }
    });

    it('only accepts known sequence types', () => {
        for (const [key, tool] of Object.entries(TOOLS)) {
            for (const type of tool.accepts) {
                expect(['dna', 'rna', 'protein'], `${key}/${type}`).toContain(type);
            }
        }
    });

    it('restricts the nucleotide-only tools to DNA and RNA', () => {
        for (const id of ['restriction', 'primer', 'translation', 'codon']) {
            expect(TOOLS[id].accepts, id).toEqual(['dna', 'rna']);
        }
    });

    it('marks the multi-sequence tools as not needing an active sequence', () => {
        for (const id of ['alignment', 'dotplot', 'phylo', 'blast', 'protein3d']) {
            expect(TOOLS[id].usesActiveSequence, id).toBe(false);
        }
    });

    it('requires the right number of sequences for the comparison tools', () => {
        expect(TOOLS.alignment.needsSequences).toBe(2);
        expect(TOOLS.dotplot.needsSequences).toBe(2);
        expect(TOOLS.phylo.needsSequences).toBe(3);
    });
});

describe('DEFAULT_TOOL_ID', () => {
    it('is the sequence viewer', () => {
        expect(DEFAULT_TOOL_ID).toBe('viewer');
        expect(TOOLS[DEFAULT_TOOL_ID]).toBeDefined();
    });
});

describe('toolUnavailableReason — sequence count', () => {
    it('blocks a tool when the workspace has too few sequences', () => {
        expect(toolUnavailableReason(TOOLS.phylo, ctx([dna, rna]))).toBe(
            'Needs at least 3 sequences in the workspace'
        );
    });

    it('allows the tool once enough sequences exist', () => {
        expect(toolUnavailableReason(TOOLS.phylo, ctx([dna, rna, protein]))).toBeNull();
    });

    it('uses the singular noun for a one-sequence requirement', () => {
        expect(toolUnavailableReason(TOOLS.stats, ctx([], -1))).toBe(
            'Needs at least 1 sequence in the workspace'
        );
    });

    it('never blocks the tools that need no sequences', () => {
        expect(toolUnavailableReason(TOOLS.blast, ctx([], -1))).toBeNull();
        expect(toolUnavailableReason(TOOLS.protein3d, ctx([], -1))).toBeNull();
    });

    it('checks the sequence count before the type', () => {
        // Only one sequence, and it is a protein: the count is the first failure.
        expect(toolUnavailableReason(TOOLS.alignment, ctx([protein]))).toContain('at least 2');
    });
});

describe('toolUnavailableReason — sequence type', () => {
    it('blocks the nucleotide-only tools for a protein', () => {
        for (const id of ['restriction', 'primer', 'translation', 'codon']) {
            expect(toolUnavailableReason(TOOLS[id], ctx([protein])), id).toBe(
                'Not available for PROTEIN sequences'
            );
        }
    });

    it('allows the nucleotide-only tools for DNA and RNA', () => {
        for (const id of ['restriction', 'primer', 'translation', 'codon']) {
            expect(toolUnavailableReason(TOOLS[id], ctx([dna])), id).toBeNull();
            expect(toolUnavailableReason(TOOLS[id], ctx([rna])), id).toBeNull();
        }
    });

    it('allows the type-agnostic tools for every type', () => {
        for (const seq of [dna, rna, protein]) {
            expect(toolUnavailableReason(TOOLS.stats, ctx([seq])), seq.type).toBeNull();
            expect(toolUnavailableReason(TOOLS.viewer, ctx([seq])), seq.type).toBeNull();
        }
    });

    it('ignores the active sequence type for tools that pick their own', () => {
        expect(toolUnavailableReason(TOOLS.alignment, ctx([protein, protein]))).toBeNull();
    });

    it('does not block on type when nothing is open', () => {
        // The welcome screen handles the empty case, so no tooltip is needed.
        expect(toolUnavailableReason(TOOLS.restriction, ctx([dna], -1))).toBeNull();
    });
});

describe('isToolAvailable', () => {
    it('is the boolean form of toolUnavailableReason', () => {
        const context = ctx([protein]);
        for (const tool of Object.values(TOOLS)) {
            expect(isToolAvailable(tool, context)).toBe(
                toolUnavailableReason(tool, context) === null
            );
        }
    });

    it('reports the nucleotide tools unavailable for a protein', () => {
        expect(isToolAvailable(TOOLS.codon, ctx([protein]))).toBe(false);
        expect(isToolAvailable(TOOLS.codon, ctx([dna]))).toBe(true);
    });
});
