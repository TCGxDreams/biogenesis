import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';

import { createHandler } from './serve.js';
import { createRateLimiter, MAX_BODY_BYTES, ALLOWED_ORIGINS } from './limits.js';
import { TOOLS } from './registry.js';

let server;
let base;
const rateLimiter = createRateLimiter({ requests: 1000 });

beforeAll(async () => {
    server = createServer(createHandler({ rateLimiter }));
    await new Promise(resolve => server.listen(0, resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

const post = (path, body, headers = {}) =>
    fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });

describe('GET routes', () => {
    it('/health reports the tool count', async () => {
        const res = await fetch(`${base}/health`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.tools).toBe(Object.keys(TOOLS).length);
    });

    it('/schema returns the full tool schema', async () => {
        const body = await (await fetch(`${base}/schema`)).json();
        expect(body.tools).toHaveLength(Object.keys(TOOLS).length);
        expect(body.constants.organisms).toContain('ecoli');
    });

    it('/tools lists names and summaries', async () => {
        const body = await (await fetch(`${base}/tools`)).json();
        expect(body.tools.map(t => t.name)).toContain('findMotifs');
        expect(body.tools.every(t => typeof t.summary === 'string')).toBe(true);
    });

    it('returns 404 for an unknown route', async () => {
        const res = await fetch(`${base}/nope`);
        expect(res.status).toBe(404);
        expect((await res.json()).error.code).toBe('NOT_FOUND');
    });
});

describe('POST /run', () => {
    it('runs a tool and returns 200', async () => {
        const res = await post('/run', {
            tool: 'findMotifs',
            args: { sequence: 'AAAGAATTCAAA', pattern: 'GAATTC' },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.result.matches).toHaveLength(2);
    });

    it('returns 422 for a domain failure', async () => {
        const res = await post('/run', {
            tool: 'findMotifs',
            args: { sequence: 'ATGC', pattern: 'AT[', mode: 'regex' },
        });
        expect(res.status).toBe(422);
        expect((await res.json()).error.code).toBe('INVALID_PATTERN');
    });

    it('returns 400 for an unknown tool', async () => {
        const res = await post('/run', { tool: 'nope' });
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('UNKNOWN_TOOL');
    });

    it('returns 400 for a missing required argument', async () => {
        const res = await post('/run', { tool: 'findMotifs', args: {} });
        expect(res.status).toBe(400);
        expect((await res.json()).error.missing).toEqual(['sequence', 'pattern']);
    });

    it('returns 400 for malformed JSON', async () => {
        const res = await post('/run', '{not json');
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('INVALID_JSON');
    });
});

describe('POST /tools/:name', () => {
    it('takes the tool from the path and the args from the body', async () => {
        const res = await post('/tools/computeSequenceStats', {
            sequence: 'ATGAAATTTGGGCCCTAA',
            type: 'dna',
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tool).toBe('computeSequenceStats');
        expect(body.result.length).toBe(18);
    });

    it('reaches every registered tool', async () => {
        const res = await post('/tools/estimatePi', { sequence: 'KKKRRR' });
        expect((await res.json()).result.band).toBe('> 7.0 (Basic)');
    });

    it('returns 400 for an unknown tool name in the path', async () => {
        const res = await post('/tools/nope', {});
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('UNKNOWN_TOOL');
    });
});

describe('limits', () => {
    it('rejects an oversized body with 413', async () => {
        const oversized = JSON.stringify({
            tool: 'estimatePi',
            args: { sequence: 'K'.repeat(MAX_BODY_BYTES + 1024) },
        });
        const res = await post('/run', oversized);
        expect(res.status).toBe(413);
        expect((await res.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('accepts a body under the limit', async () => {
        const res = await post('/run', {
            tool: 'estimatePi',
            args: { sequence: 'K'.repeat(1000) },
        });
        expect(res.status).toBe(200);
    });

    it('returns 429 with Retry-After once the window is exhausted', async () => {
        const limited = createServer(
            createHandler({ rateLimiter: createRateLimiter({ requests: 2, windowSeconds: 60 }) })
        );
        await new Promise(resolve => limited.listen(0, resolve));
        const url = `http://127.0.0.1:${limited.address().port}/run`;
        const body = JSON.stringify({ tool: 'estimatePi', args: { sequence: 'K' } });
        const call = () =>
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

        expect((await call()).status).toBe(200);
        expect((await call()).status).toBe(200);
        const blocked = await call();
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get('retry-after')).toBeTruthy();
        expect((await blocked.json()).error.code).toBe('RATE_LIMITED');

        await new Promise(resolve => limited.close(resolve));
    });

    it('does not rate limit the GET routes', async () => {
        const limited = createServer(
            createHandler({ rateLimiter: createRateLimiter({ requests: 1, windowSeconds: 60 }) })
        );
        await new Promise(resolve => limited.listen(0, resolve));
        const root = `http://127.0.0.1:${limited.address().port}`;
        for (let i = 0; i < 5; i++) {
            expect((await fetch(`${root}/health`)).status).toBe(200);
        }
        await new Promise(resolve => limited.close(resolve));
    });
});

describe('CORS', () => {
    it('echoes an allowed origin', async () => {
        const res = await fetch(`${base}/health`, { headers: { Origin: ALLOWED_ORIGINS[0] } });
        expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGINS[0]);
    });

    it('does not echo an unlisted origin', async () => {
        const res = await fetch(`${base}/health`, {
            headers: { Origin: 'https://evil.example.com' },
        });
        expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('answers a preflight with 204', async () => {
        const res = await fetch(`${base}/run`, {
            method: 'OPTIONS',
            headers: { Origin: ALLOWED_ORIGINS[0], 'Access-Control-Request-Method': 'POST' },
        });
        expect(res.status).toBe(204);
        expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    });

    it('always varies on Origin so caches stay correct', async () => {
        const res = await fetch(`${base}/health`);
        expect(res.headers.get('vary')).toBe('Origin');
    });
});

describe('limits module', () => {
    it('defaults to the same values as backend/server.py', () => {
        expect(MAX_BODY_BYTES).toBe(5 * 1024 * 1024);
        expect(ALLOWED_ORIGINS).toContain('http://localhost:5173');
    });

    it('expires the window as time passes', () => {
        let now = 0;
        const limiter = createRateLimiter({ requests: 2, windowSeconds: 60, now: () => now });
        expect(limiter.check('a').allowed).toBe(true);
        expect(limiter.check('a').allowed).toBe(true);
        expect(limiter.check('a').allowed).toBe(false);
        now += 61_000;
        expect(limiter.check('a').allowed).toBe(true);
    });

    it('counts each client separately', () => {
        const limiter = createRateLimiter({ requests: 1, windowSeconds: 60 });
        expect(limiter.check('a').allowed).toBe(true);
        expect(limiter.check('a').allowed).toBe(false);
        expect(limiter.check('b').allowed).toBe(true);
    });

    it('reports a positive Retry-After when blocking', () => {
        const limiter = createRateLimiter({ requests: 1, windowSeconds: 60 });
        limiter.check('a');
        expect(limiter.check('a').retryAfter).toBeGreaterThan(0);
    });

    it('reset clears the counters', () => {
        const limiter = createRateLimiter({ requests: 1, windowSeconds: 60 });
        limiter.check('a');
        limiter.reset();
        expect(limiter.check('a').allowed).toBe(true);
    });
});
