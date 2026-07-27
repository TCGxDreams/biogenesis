import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { handleInput, handleRequest } from './run.js';
import { TOOLS, CONSTANTS, describeTools } from './registry.js';
import * as core from '../src/core/index.js';

const RUNNER = join(dirname(fileURLToPath(import.meta.url)), 'run.js');

/** Run the CLI the way a caller would, and return {stdout, status}. */
function cli(stdin, args = []) {
    try {
        const stdout = execFileSync('node', [RUNNER, ...args], {
            input: stdin,
            encoding: 'utf8',
        });
        return { stdout, status: 0 };
    } catch (e) {
        return { stdout: e.stdout ?? '', status: e.status };
    }
}

const call = (tool, args) => handleRequest({ tool, args });

/** Minimal valid arguments for each registered tool. */
const SAMPLE_ARGS = {
    findMotifs: { sequence: 'AAAGAATTCAAA', pattern: 'GAATTC' },
    compileMotifPattern: { pattern: 'GANTC', mode: 'iupac' },
    computeSequenceStats: { sequence: 'ATGAAATTTGGGCCCTAA', type: 'dna' },
    computePI: { sequence: 'MKWVTFISLL' },
    computeGRAVY: { sequence: 'MKWVTFISLL' },
    instabilityIndex: { sequence: 'MKWVTFISLL' },
    aminoAcidComposition: { sequence: 'MKWVTFISLL' },
    computeGcWindow: { sequence: 'ATGCATGCATGCATGC', windowSize: 4 },
    computeCodonUsage: { sequence: 'ATGATGAAA' },
    computeDotMatrix: { seqA: 'ACGTACGTAC', seqB: 'ACGTACGTAC', windowSize: 4 },
    alignPair: { seqA: 'ACGT', seqB: 'ACGT' },
    buildAlignmentReport: {
        entries: [
            { name: 'a', sequence: 'ACGTACGT', type: 'dna' },
            { name: 'b', sequence: 'ACGTACGT', type: 'dna' },
        ],
    },
    buildMatchLine: { a: 'ACGT', b: 'AGGT' },
    computeConservation: { rows: ['AC', 'AC'], consensus: 'AC' },
    buildTree: {
        sequences: [
            { name: 'A', sequence: 'ACGTACGTAA' },
            { name: 'B', sequence: 'ACGTACGTAT' },
            { name: 'C', sequence: 'TTTTGGGGCC' },
        ],
    },
    surveySites: { sequence: 'GAATTCGGATCCAAGCTT' },
    analyseDigest: { sequence: 'GAATTCGGATCCAAGCTT', enzymeNames: ['EcoRI'] },
    designPrimers: { sequence: 'ATGCATGCGC'.repeat(60) },
    checkHairpin: { sequence: 'GGGCCAAAAGGCCC' },
    analyseCodonUsage: { sequence: 'ATGCTGCTACTG', organism: 'ecoli' },
    optimiseCodons: { sequence: 'CTACTACTA', organism: 'ecoli' },
    countCodons: { sequence: 'ATGATGAAA' },
    calculateCAI: { sequence: 'CTGCTGCTG', organism: 'ecoli' },
    caiFromCounts: { counts: { CTG: 2, CTA: 1 }, organism: 'ecoli' },
    getOptimalCodon: { aa: 'L', organism: 'ecoli' },
    translateSixFrames: { sequence: 'ATGAAATTTGGGCCCTAA' },
    findFrameOrfs: { protein: `M${'K'.repeat(12)}*` },
    computeSlidingProperties: { sequence: 'ATGCATGCATGCATGC', windowSize: 4 },
    computeProperty: { sequence: 'ATGCATGCATGCATGC', metric: 'gc_content', windowSize: 4 },
    estimatePi: { sequence: 'KKKRRR' },
};

describe('registry — coverage of the core surface', () => {
    it('registers a tool for every callable core export', () => {
        const coreFunctions = Object.entries(core)
            .filter(([name, value]) => typeof value === 'function' && name !== 'BioError')
            .map(([name]) => name);

        const covered = new Set();
        for (const name of coreFunctions) {
            // Either the tool is named after the core function, or a tool wraps it.
            if (TOOLS[name]) covered.add(name);
        }
        const uncovered = coreFunctions.filter(name => !covered.has(name));
        expect(uncovered, `core functions with no headless tool: ${uncovered}`).toEqual([]);
    });

    it('gives every tool a summary and a parameter list', () => {
        for (const [name, tool] of Object.entries(TOOLS)) {
            expect(tool.name, name).toBe(name);
            expect(typeof tool.summary, name).toBe('string');
            expect(tool.summary.length, name).toBeGreaterThan(0);
            expect(Array.isArray(tool.params), name).toBe(true);
            expect(typeof tool.run, name).toBe('function');
        }
    });

    it('describes every parameter fully', () => {
        for (const [name, tool] of Object.entries(TOOLS)) {
            for (const param of tool.params) {
                expect(typeof param.name, `${name}.${param.name}`).toBe('string');
                expect(typeof param.type, `${name}.${param.name}`).toBe('string');
                expect(typeof param.required, `${name}.${param.name}`).toBe('boolean');
                expect(param.description.length, `${name}.${param.name}`).toBeGreaterThan(0);
            }
        }
    });

    it('points its uiTool ids at real registry entries', async () => {
        const { TOOL_META } = await import('../src/app/toolMeta.js');
        for (const tool of Object.values(TOOLS)) {
            if (tool.uiTool) expect(TOOL_META[tool.uiTool], tool.name).toBeDefined();
        }
    });

    it('has a sample invocation for every registered tool', () => {
        expect(Object.keys(SAMPLE_ARGS).sort()).toEqual(Object.keys(TOOLS).sort());
    });
});

describe('every tool returns JSON-serialisable output', () => {
    for (const [name, args] of Object.entries(SAMPLE_ARGS)) {
        it(`${name} succeeds and round-trips through JSON`, () => {
            const { payload, exitCode } = call(name, args);
            expect(payload.ok, JSON.stringify(payload.error)).toBe(true);
            expect(exitCode).toBe(0);
            expect(payload.tool).toBe(name);
            expect(payload.result).toBeDefined();
            const json = JSON.stringify(payload);
            expect(JSON.parse(json)).toEqual(payload);
            expect(json).not.toMatch(/<[a-z]/i);
        });
    }
});

describe('request validation', () => {
    it('rejects a non-object request', () => {
        for (const body of ['[]', '"hi"', '42', 'null']) {
            const { payload, exitCode } = handleInput(body);
            expect(payload.ok).toBe(false);
            expect(exitCode).toBe(2);
        }
    });

    it('rejects empty input', () => {
        const { payload, exitCode } = handleInput('   ');
        expect(payload.error.code).toBe('EMPTY_REQUEST');
        expect(exitCode).toBe(2);
    });

    it('rejects malformed JSON', () => {
        const { payload, exitCode } = handleInput('{not json');
        expect(payload.error.code).toBe('INVALID_JSON');
        expect(exitCode).toBe(2);
    });

    it('rejects a missing tool name', () => {
        expect(handleRequest({ args: {} }).payload.error.code).toBe('MISSING_TOOL');
    });

    it('rejects an unknown tool and lists what is available', () => {
        const { payload, exitCode } = call('nope', {});
        expect(payload.error.code).toBe('UNKNOWN_TOOL');
        expect(payload.error.available).toContain('findMotifs');
        expect(exitCode).toBe(2);
    });

    it('rejects a non-object args field', () => {
        expect(handleRequest({ tool: 'findMotifs', args: [] }).payload.error.code).toBe(
            'INVALID_ARGS'
        );
    });

    it('reports every missing required argument at once', () => {
        const { payload, exitCode } = call('findMotifs', {});
        expect(payload.error.code).toBe('MISSING_ARGUMENT');
        expect(payload.error.missing).toEqual(['sequence', 'pattern']);
        expect(payload.error.params).toBeDefined();
        expect(exitCode).toBe(2);
    });

    it('treats a missing args object as empty', () => {
        expect(handleRequest({ tool: 'findMotifs' }).payload.error.code).toBe('MISSING_ARGUMENT');
    });

    it('accepts a request with only the required arguments', () => {
        expect(call('estimatePi', { sequence: 'KKK' }).payload.ok).toBe(true);
    });
});

describe('error propagation', () => {
    it('passes a BioError code straight through', () => {
        const { payload, exitCode } = call('findMotifs', {
            sequence: 'ATGC',
            pattern: 'AT[',
            mode: 'regex',
        });
        expect(payload.ok).toBe(false);
        expect(payload.error.code).toBe('INVALID_PATTERN');
        expect(payload.error.tool).toBe('findMotifs');
        expect(exitCode).toBe(1);
    });

    it('reports the domain error for an unknown organism', () => {
        expect(
            call('analyseCodonUsage', { sequence: 'ATG', organism: 'martian' }).payload.error.code
        ).toBe('UNKNOWN_ORGANISM');
    });

    it('reports UNKNOWN_ORGANISM for the table-taking codon helpers too', () => {
        for (const tool of ['calculateCAI', 'caiFromCounts', 'getOptimalCodon']) {
            const args = { ...SAMPLE_ARGS[tool], organism: 'martian' };
            expect(call(tool, args).payload.error.code, tool).toBe('UNKNOWN_ORGANISM');
        }
    });

    it('reports too-few-sequences from buildTree', () => {
        const { payload } = call('buildTree', {
            sequences: [{ name: 'A', sequence: 'ACGT' }],
        });
        expect(payload.error.code).toBe('TOO_FEW_SEQUENCES');
    });

    it('reports an unexpected failure as INTERNAL_ERROR', () => {
        // computePI dereferences the sequence, so a number is a programmer error
        // rather than a domain one.
        const { payload, exitCode } = call('computePI', { sequence: 42 });
        expect(payload.ok).toBe(false);
        expect(payload.error.code).toBe('INTERNAL_ERROR');
        expect(exitCode).toBe(1);
    });

    it('never leaks HTML in an error message', () => {
        const { payload } = call('findMotifs', {
            sequence: 'ATGC',
            pattern: 'AT[',
            mode: 'regex',
        });
        expect(payload.error.message).not.toMatch(/<[a-z]/i);
    });
});

describe('describeTools', () => {
    it('describes every tool', () => {
        const schema = describeTools();
        expect(schema.tools).toHaveLength(Object.keys(TOOLS).length);
        for (const tool of schema.tools) {
            expect(tool.name).toBeDefined();
            expect(tool.summary).toBeDefined();
            expect(Array.isArray(tool.params)).toBe(true);
        }
    });

    it('carries the UI label through for tools that are also panels', () => {
        const motif = describeTools().tools.find(t => t.name === 'findMotifs');
        expect(motif.uiTool).toBe('motif');
        expect(motif.uiLabel).toBe('Motif Finder');
    });

    it('publishes the constants callers need to build arguments', () => {
        expect(CONSTANTS.organisms).toContain('ecoli');
        expect(CONSTANTS.metrics).toContain('gc_content');
        expect(CONSTANTS.enzymeGroups).toContain('common');
        expect(CONSTANTS.limits.dotplotMaxLength).toBe(800);
    });

    it('is JSON-serialisable', () => {
        expect(() => JSON.stringify(describeTools())).not.toThrow();
    });
});

describe('CLI', () => {
    it('runs a tool from stdin and exits 0', () => {
        const { stdout, status } = cli(
            JSON.stringify({
                tool: 'findMotifs',
                args: { sequence: 'AAAGAATTCAAA', pattern: 'GAATTC' },
            })
        );
        const body = JSON.parse(stdout);
        expect(status).toBe(0);
        expect(body.ok).toBe(true);
        expect(body.result.matches).toHaveLength(2);
    });

    it('exits 1 on a domain failure and still prints JSON', () => {
        const { stdout, status } = cli(
            JSON.stringify({
                tool: 'findMotifs',
                args: { sequence: 'A', pattern: 'AT[', mode: 'regex' },
            })
        );
        expect(status).toBe(1);
        expect(JSON.parse(stdout).error.code).toBe('INVALID_PATTERN');
    });

    it('exits 2 on a malformed request', () => {
        const { stdout, status } = cli('{nope');
        expect(status).toBe(2);
        expect(JSON.parse(stdout).error.code).toBe('INVALID_JSON');
    });

    it('--list names every tool', () => {
        const { stdout, status } = cli('', ['--list']);
        expect(status).toBe(0);
        for (const name of Object.keys(TOOLS)) expect(stdout).toContain(name);
    });

    it('--schema emits parseable JSON covering every tool', () => {
        const { stdout, status } = cli('', ['--schema']);
        expect(status).toBe(0);
        const schema = JSON.parse(stdout);
        expect(schema.tools).toHaveLength(Object.keys(TOOLS).length);
        expect(schema.constants.organisms).toContain('ecoli');
    });
});
