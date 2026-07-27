// ============================================
// BioGenesis — Core error type
// ============================================
//
// src/core/ throws; it never returns error strings, HTML or null for failure.
// Components catch BioError and render the empty/error state; main.js catches
// anything else and reports via setStatus(). See AGENTS.md.

export class BioError extends Error {
    /**
     * @param {string} message Human-readable message, safe to show to a user.
     *   Must never contain HTML.
     * @param {string} code Stable machine-readable code, e.g. 'INVALID_PATTERN'.
     */
    constructor(message, code) {
        super(message);
        this.name = 'BioError';
        this.code = code;
    }
}
