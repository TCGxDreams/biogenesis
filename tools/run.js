#!/usr/bin/env node
// ============================================
// BioGenesis — Headless tool runner
// ============================================
//
// Reads a JSON request from stdin, dispatches to src/core/, writes JSON to
// stdout. Every analysis the app offers is callable this way, with no DOM.
//
//   echo '{"tool":"findMotifs","args":{"sequence":"AAAGAATTCAAA","pattern":"GAATTC"}}' \
//     | node tools/run.js
//
//   node tools/run.js --list      # names and summaries
//   node tools/run.js --schema    # full parameter schema as JSON
//
// Exit codes: 0 on success, 1 on a failed request, 2 on a malformed one.

import { pathToFileURL } from 'node:url';

import { BioError } from '../src/core/errors.js';
import { TOOLS, describeTools } from './registry.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_BAD_REQUEST = 2;

/**
 * Read all of stdin.
 *
 * @returns {Promise<string>}
 */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

/**
 * Serialise a successful result.
 *
 * @param {string} tool
 * @param {any} result
 * @returns {Object}
 */
function ok(tool, result) {
    return { ok: true, tool, result };
}

/**
 * Serialise a failure. BioError codes are passed through so callers can branch
 * on them rather than on message text.
 *
 * @param {string} code
 * @param {string} message
 * @param {Object} [extra]
 * @returns {Object}
 */
function fail(code, message, extra = {}) {
    return { ok: false, error: { code, message, ...extra } };
}

/**
 * Run one request object.
 *
 * @param {Object} request
 * @returns {{payload: Object, exitCode: number}}
 */
export function handleRequest(request) {
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
        return {
            payload: fail('INVALID_REQUEST', 'Request must be a JSON object.'),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    const { tool, args } = request;
    if (typeof tool !== 'string' || tool.length === 0) {
        return {
            payload: fail('MISSING_TOOL', 'Request must name a tool.', {
                available: Object.keys(TOOLS),
            }),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    const entry = TOOLS[tool];
    if (!entry) {
        return {
            payload: fail('UNKNOWN_TOOL', `Unknown tool "${tool}".`, {
                available: Object.keys(TOOLS),
            }),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    if (args !== undefined && (args === null || typeof args !== 'object' || Array.isArray(args))) {
        return {
            payload: fail('INVALID_ARGS', 'The "args" field must be a JSON object.'),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    const suppliedArgs = args ?? {};
    const missing = entry.params
        .filter(param => param.required && suppliedArgs[param.name] === undefined)
        .map(param => param.name);
    if (missing.length > 0) {
        return {
            payload: fail(
                'MISSING_ARGUMENT',
                `Missing required argument(s): ${missing.join(', ')}.`,
                { tool, missing, params: entry.params }
            ),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    try {
        return { payload: ok(tool, entry.run(suppliedArgs)), exitCode: EXIT_OK };
    } catch (e) {
        if (e instanceof BioError) {
            return { payload: fail(e.code, e.message, { tool }), exitCode: EXIT_FAILED };
        }
        return {
            payload: fail('INTERNAL_ERROR', e instanceof Error ? e.message : String(e), { tool }),
            exitCode: EXIT_FAILED,
        };
    }
}

/**
 * Parse stdin and run it.
 *
 * @param {string} input
 * @returns {{payload: Object, exitCode: number}}
 */
export function handleInput(input) {
    const text = input.trim();
    if (text.length === 0) {
        return {
            payload: fail('EMPTY_REQUEST', 'Expected a JSON request on stdin.', {
                available: Object.keys(TOOLS),
            }),
            exitCode: EXIT_BAD_REQUEST,
        };
    }

    let request;
    try {
        request = JSON.parse(text);
    } catch (e) {
        return {
            payload: fail('INVALID_JSON', `Could not parse stdin as JSON: ${e.message}`),
            exitCode: EXIT_BAD_REQUEST,
        };
    }
    return handleRequest(request);
}

/**
 * CLI entry point.
 *
 * @param {string[]} argv
 * @returns {Promise<number>} Process exit code.
 */
export async function main(argv) {
    if (argv.includes('--schema')) {
        process.stdout.write(JSON.stringify(describeTools(), null, 2) + '\n');
        return EXIT_OK;
    }

    if (argv.includes('--list')) {
        const width = Math.max(...Object.keys(TOOLS).map(name => name.length));
        for (const tool of Object.values(TOOLS)) {
            process.stdout.write(`${tool.name.padEnd(width)}  ${tool.summary}\n`);
        }
        return EXIT_OK;
    }

    const { payload, exitCode } = handleInput(await readStdin());
    process.stdout.write(JSON.stringify(payload) + '\n');
    return exitCode;
}

// Only run when invoked directly, so the module stays importable by tests.
// pathToFileURL is required rather than string concatenation: the repo path can
// contain spaces, which import.meta.url percent-encodes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main(process.argv.slice(2)).then(code => {
        process.exitCode = code;
    });
}
