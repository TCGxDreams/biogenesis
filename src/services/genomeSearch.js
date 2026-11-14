// ============================================
// BioGenesis — Genome-scale GenBank search
// ============================================
//
// The document import path caps records at IMPORT_LIMIT residues so a student
// cannot pull a chromosome into the workspace by accident. Screening a phage
// against its relatives needs the opposite: whole genomes, several at a time,
// held only long enough to sketch. This module is that separate path — it
// never adds anything to the workspace, and carries its own, larger cap.

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';

/** Longest single record this path will accept, in bases. */
export const GENOME_LIMIT = 800000;

/** Most genomes one search may pull, to bound both time and memory. */
export const MAX_RELATIVES = 50;

/** E-utilities asks unauthenticated clients to stay under ~3 requests/second. */
const REQUEST_SPACING_MS = 400;

/** Records fetched per efetch call. */
const FETCH_BATCH = 5;

/**
 * @typedef {Object} GenomeRecord
 * @property {string} id NCBI UID.
 * @property {string} accession
 * @property {string} title
 * @property {string} organism
 * @property {number} length
 */

/**
 * A length window around a genome, as GenBank's `[SLEN]` filter wants it.
 *
 * Relatives of a phage are about the same size — the jumbo phages that matter
 * here all sit within a few percent of each other — so this cuts the candidate
 * set down before any sequence is transferred.
 *
 * @param {number} length Query genome length.
 * @param {number} [tolerance=0.2] Fraction either side.
 * @returns {{min: number, max: number}}
 */
export function lengthWindow(length, tolerance = 0.2) {
    const n = Math.max(1, Math.round(length));
    const spread = Math.round(n * Math.min(Math.max(tolerance, 0), 1));
    return { min: Math.max(1, n - spread), max: n + spread };
}

/**
 * Compose the Entrez term for a relative search.
 *
 * Only the length filter is added. An earlier version also forced
 * `biomol_genomic[PROP]`, which silently dropped whole classes of record —
 * cloning vectors and plasmids are not filed as genomic, so a pUC19 search
 * returned nothing at all. A reference set that quietly excludes the real
 * relatives is exactly how a known genome gets reported as novel, so any
 * further filtering is the caller's to type and to see.
 *
 * @param {string} term Free-text part, e.g. `phage[Title]`.
 * @param {{min: number, max: number}} window
 * @returns {string}
 * @throws {Error} When the term is empty.
 */
export function buildGenomeQuery(term, window) {
    const text = String(term || '').trim();
    if (!text) throw new Error('Enter a search term, for example: phage[Title]');
    return `(${text}) AND ${window.min}:${window.max}[SLEN]`;
}

/**
 * Split a multi-FASTA payload into records.
 *
 * @param {string} text
 * @returns {{name: string, accession: string, sequence: string}[]}
 */
export function parseMultiFasta(text) {
    const out = [];
    let current = null;
    for (const line of String(text || '').split(/\r?\n/)) {
        if (line.startsWith('>')) {
            const header = line.slice(1).trim();
            const accession = header.split(/\s+/)[0] || header;
            current = { name: header, accession, sequence: '' };
            out.push(current);
        } else if (current) {
            current.sequence += line.trim();
        }
    }
    return out.filter((r) => r.sequence.length > 0);
}

/** @param {string} url @param {AbortSignal} [signal] */
async function request(url, signal) {
    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
        throw new Error(
            response.status === 429
                ? 'NCBI rate limit reached. Wait a moment and retry.'
                : `NCBI returned HTTP ${response.status}. Please retry.`
        );
    }
    return response;
}

function pause(signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, REQUEST_SPACING_MS);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(signal.reason ?? new Error('Aborted'));
            },
            { once: true }
        );
    });
}

/**
 * Find candidate relatives by keyword and length, without transferring any
 * sequence yet — the caller decides what is worth fetching.
 *
 * @param {string} term
 * @param {Object} options
 * @param {{min: number, max: number}} options.window
 * @param {number} [options.limit=20]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{total: number, records: GenomeRecord[]}>}
 */
export async function searchGenomes(term, { window, limit = 20, signal } = {}) {
    if (!window || !Number.isFinite(window.min) || !Number.isFinite(window.max)) {
        throw new Error('A length window is required.');
    }
    const capped = Math.max(1, Math.min(MAX_RELATIVES, Math.floor(limit)));
    const query = buildGenomeQuery(term, window);

    const searchParams = new URLSearchParams({
        db: 'nuccore',
        term: query,
        retmode: 'json',
        retmax: String(capped),
    });
    const search = await (await request(`${BASE}esearch.fcgi?${searchParams}`, signal)).json();
    if (search.error || search.esearchresult?.ERROR) {
        throw new Error('NCBI could not interpret this query.');
    }
    const ids = search.esearchresult?.idlist;
    if (!Array.isArray(ids)) throw new Error('Invalid search response. Please retry.');
    const total = Number(search.esearchresult?.count || 0);
    if (ids.length === 0) return { total, records: [] };

    await pause(signal);
    const summaryParams = new URLSearchParams({
        db: 'nuccore',
        id: ids.join(','),
        retmode: 'json',
    });
    const summaries = await (
        await request(`${BASE}esummary.fcgi?${summaryParams}`, signal)
    ).json();
    if (!summaries.result) throw new Error('Could not read record summaries. Please retry.');

    const records = ids
        .map((id) => {
            const r = summaries.result[id];
            if (!r || r.error) return null;
            return {
                id,
                accession: r.accessionversion || r.caption || id,
                title: r.title || '',
                organism: r.organism || '',
                length: Number(r.slen || 0),
            };
        })
        .filter((r) => r && r.length > 0 && r.length <= GENOME_LIMIT);

    return { total, records };
}

/**
 * Fetch the sequences for chosen records, in paced batches.
 *
 * @param {GenomeRecord[]} records
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {(done: number, total: number) => void} [options.onProgress]
 * @returns {Promise<{name: string, accession: string, sequence: string}[]>}
 */
export async function fetchGenomes(records, { signal, onProgress } = {}) {
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('No records to fetch.');
    }
    const wanted = records.slice(0, MAX_RELATIVES);
    /** @type {{name: string, accession: string, sequence: string}[]} */
    const out = [];

    for (let i = 0; i < wanted.length; i += FETCH_BATCH) {
        const batch = wanted.slice(i, i + FETCH_BATCH);
        const params = new URLSearchParams({
            db: 'nuccore',
            id: batch.map((r) => r.id).join(','),
            rettype: 'fasta',
            retmode: 'text',
        });
        const text = await (await request(`${BASE}efetch.fcgi?${params}`, signal)).text();
        for (const record of parseMultiFasta(text)) {
            if (record.sequence.length <= GENOME_LIMIT) out.push(record);
        }
        onProgress?.(Math.min(i + FETCH_BATCH, wanted.length), wanted.length);
        if (i + FETCH_BATCH < wanted.length) await pause(signal);
    }

    if (out.length === 0) throw new Error('NCBI returned no usable sequences.');
    return out;
}
