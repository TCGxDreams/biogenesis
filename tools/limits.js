// ============================================
// BioGenesis — Request limits and CORS policy
// ============================================
//
// One configuration surface for both HTTP servers. The Python backend
// (backend/server.py) cannot import this file, but it reads the same
// environment variables with the same defaults and enforces the same
// behaviours, so there is a single set of knobs rather than two policies.

/**
 * Read a positive integer from the environment, falling back on a default.
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function intEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Largest accepted request body, matching MAX_PDB_BYTES in backend/server.py. */
export const MAX_BODY_BYTES = intEnv('MAX_PDB_BYTES', 5 * 1024 * 1024);

/** Requests allowed per client per window. */
export const RATE_LIMIT_REQUESTS = intEnv('RATE_LIMIT_REQUESTS', 10);

/** Length of the rate-limit window, in seconds. */
export const RATE_LIMIT_WINDOW_SECONDS = intEnv('RATE_LIMIT_WINDOW_SECONDS', 60);

/** Browser origins allowed to call the API. */
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

/**
 * Whether an Origin header is permitted.
 *
 * @param {string|undefined} origin
 * @returns {boolean}
 */
export function isOriginAllowed(origin) {
    return typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin);
}

/**
 * A fixed-window, per-client rate limiter.
 *
 * In-process and per-worker: enough to stop a runaway loop from taking a single
 * instance down, not a substitute for a real gateway limiter.
 *
 * @param {Object} [options]
 * @param {number} [options.requests]
 * @param {number} [options.windowSeconds]
 * @param {() => number} [options.now] Injectable clock, in milliseconds.
 * @returns {{check: (key: string) => {allowed: boolean, retryAfter: number}, reset: () => void}}
 */
export function createRateLimiter(options = {}) {
    const {
        requests = RATE_LIMIT_REQUESTS,
        windowSeconds = RATE_LIMIT_WINDOW_SECONDS,
        now = () => Date.now(),
    } = options;

    /** @type {Map<string, number[]>} */
    const seen = new Map();

    return {
        check(key) {
            const current = now();
            const windowMs = windowSeconds * 1000;
            const times = (seen.get(key) ?? []).filter(t => current - t <= windowMs);

            if (times.length >= requests) {
                const retryAfter = Math.ceil((windowMs - (current - times[0])) / 1000);
                seen.set(key, times);
                return { allowed: false, retryAfter: Math.max(1, retryAfter) };
            }

            times.push(current);
            seen.set(key, times);
            return { allowed: true, retryAfter: 0 };
        },

        reset() {
            seen.clear();
        },
    };
}
