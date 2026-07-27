#!/usr/bin/env node
// ============================================
// BioGenesis — HTTP surface for src/core/
// ============================================
//
// Exposes every headless tool over HTTP, using the same registry as
// tools/run.js and the same limits and CORS policy as backend/server.py
// (see tools/limits.js).
//
//   node tools/serve.js                    # listens on :8787
//   PORT=9000 node tools/serve.js
//
//   GET  /health          liveness
//   GET  /schema          the full tool schema
//   GET  /tools           names and summaries
//   POST /run             {"tool": "...", "args": {...}}
//   POST /tools/:name     {...args}
//
// Uses only node:http — no new npm dependency.

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { TOOLS, describeTools } from './registry.js';
import { handleRequest } from './run.js';
import {
    ALLOWED_ORIGINS,
    MAX_BODY_BYTES,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_SECONDS,
    createRateLimiter,
    isOriginAllowed,
} from './limits.js';

/** Maps the runner's exit codes onto HTTP statuses. */
const STATUS_FOR_EXIT = { 0: 200, 1: 422, 2: 400 };

/**
 * Identify the caller, preferring the proxy-forwarded address.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {string}
 */
function clientKey(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Read a request body, stopping once it exceeds the limit.
 *
 * The body is never buffered beyond the limit: once exceeded, further chunks
 * are discarded while the stream drains, so the client can still read the 413
 * instead of seeing the connection torn down mid-upload.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<{ok: true, body: string}|{ok: false, reason: 'too-large'}>}
 */
function readBody(req) {
    return new Promise(resolve => {
        const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
            resolve({ ok: false, reason: 'too-large' });
            req.resume(); // drain and discard so the client can read the 413
            return;
        }

        const chunks = [];
        let size = 0;
        let rejected = false;

        req.on('data', chunk => {
            if (rejected) return; // still draining; discard rather than buffer
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                rejected = true;
                chunks.length = 0; // release what was buffered
                resolve({ ok: false, reason: 'too-large' });
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (!rejected) resolve({ ok: true, body: Buffer.concat(chunks).toString('utf8') });
        });
        req.on('error', () => {
            if (!rejected) resolve({ ok: true, body: '' });
        });
    });
}

/**
 * Build the request handler.
 *
 * @param {Object} [options]
 * @param {ReturnType<typeof createRateLimiter>} [options.rateLimiter]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createHandler(options = {}) {
    const rateLimiter = options.rateLimiter ?? createRateLimiter();

    return async function handle(req, res) {
        const origin = req.headers.origin;
        const corsHeaders = isOriginAllowed(origin)
            ? {
                  'Access-Control-Allow-Origin': origin,
                  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type',
                  Vary: 'Origin',
              }
            : { Vary: 'Origin' };

        /** @param {number} status @param {Object} payload @param {Object} [extraHeaders] */
        const send = (status, payload, extraHeaders = {}) => {
            const body = JSON.stringify(payload);
            res.writeHead(status, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body),
                ...corsHeaders,
                ...extraHeaders,
            });
            res.end(body);
        };

        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname.replace(/\/+$/, '') || '/';

        if (req.method === 'OPTIONS') {
            res.writeHead(204, corsHeaders);
            res.end();
            return;
        }

        if (req.method === 'GET' && path === '/health') {
            send(200, { status: 'ok', tools: Object.keys(TOOLS).length });
            return;
        }
        if (req.method === 'GET' && path === '/schema') {
            send(200, describeTools());
            return;
        }
        if (req.method === 'GET' && path === '/tools') {
            send(200, {
                tools: Object.values(TOOLS).map(t => ({ name: t.name, summary: t.summary })),
            });
            return;
        }

        const isRun = req.method === 'POST' && path === '/run';
        const named =
            req.method === 'POST' && path.startsWith('/tools/')
                ? decodeURIComponent(path.slice('/tools/'.length))
                : null;

        if (!isRun && named === null) {
            send(404, {
                ok: false,
                error: { code: 'NOT_FOUND', message: `No route for ${path}.` },
            });
            return;
        }

        const limit = rateLimiter.check(clientKey(req));
        if (!limit.allowed) {
            send(
                429,
                {
                    ok: false,
                    error: {
                        code: 'RATE_LIMITED',
                        message:
                            `Rate limit exceeded: ${RATE_LIMIT_REQUESTS} requests per ` +
                            `${RATE_LIMIT_WINDOW_SECONDS} seconds.`,
                    },
                },
                { 'Retry-After': String(limit.retryAfter) }
            );
            return;
        }

        const read = await readBody(req);
        if (!read.ok) {
            send(413, {
                ok: false,
                error: {
                    code: 'PAYLOAD_TOO_LARGE',
                    message: `Request body exceeds the ${MAX_BODY_BYTES} byte limit.`,
                },
            });
            return;
        }

        let parsed;
        try {
            parsed = read.body.trim() === '' ? {} : JSON.parse(read.body);
        } catch (e) {
            send(400, {
                ok: false,
                error: {
                    code: 'INVALID_JSON',
                    message: `Could not parse body as JSON: ${e.message}`,
                },
            });
            return;
        }

        const request = named === null ? parsed : { tool: named, args: parsed };
        const { payload, exitCode } = handleRequest(request);
        send(STATUS_FOR_EXIT[exitCode] ?? 500, payload);
    };
}

/**
 * Start the server.
 *
 * @param {Object} [options]
 * @param {number} [options.port]
 * @returns {import('node:http').Server}
 */
export function startServer(options = {}) {
    const port = options.port ?? Number.parseInt(process.env.PORT ?? '8787', 10);
    const server = createServer(createHandler(options));
    server.listen(port, () => {
        console.warn(`BioGenesis core API on http://localhost:${port}`);
        console.warn(`  tools: ${Object.keys(TOOLS).length}`);
        console.warn(`  origins: ${ALLOWED_ORIGINS.join(', ')}`);
        console.warn(
            `  limits: ${MAX_BODY_BYTES} bytes, ${RATE_LIMIT_REQUESTS}/${RATE_LIMIT_WINDOW_SECONDS}s`
        );
    });
    return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    startServer();
}
