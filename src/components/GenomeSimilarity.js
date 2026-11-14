// @ts-nocheck -- TODO(T4): this layer is untyped until main.js is decomposed
//                and the components are rewired onto the typed core contract.
// ============================================
// BioGenesis — Genome Similarity Component
// ============================================
//
// Screens whole genomes against each other the way a taxonomy run opens: sketch
// every genome, rank by shared k-mers, and say where each pair falls against
// the ICTV species and genus thresholds. The panel is deliberate about what it
// will not claim — see the caveat it prints under the matrix.

import {
    similarityMatrix,
    rankAgainstQuery,
    SPECIES_THRESHOLD,
    GENUS_THRESHOLD,
} from '../core/genomeSimilarity.js';
import { lengthWindow, searchGenomes, fetchGenomes } from '../services/genomeSearch.js';
import {
    matrixReport,
    relativesReport,
    reportToTsv,
    reportToMarkdown,
    reportFilename,
} from '../core/genome-similarity-report.js';
import { downloadFile } from '../utils/bioUtils.js';
import { BioError } from '../core/errors.js';

/**
 * The report behind whatever the panel is currently showing.
 *
 * Held here rather than re-derived on export so the file matches the table on
 * screen exactly, even after the selection above it changes.
 */
let currentReport = null;

/** Genomes ticked when the panel opens. */
const PRESELECTED = 4;

/** Verdicts, in the words the panel shows and the colour each gets. */
const VERDICT_STYLE = {
    'same-species': { label: 'Same species', color: '#b91c1c', bg: '#fee2e2' },
    'same-genus': { label: 'Same genus', color: '#b45309', bg: '#fef3c7' },
    borderline: { label: 'Borderline', color: '#6d28d9', bg: '#ede9fe' },
    contained: { label: 'Contained in', color: '#0f766e', bg: '#ccfbf1' },
    'outside-genus': { label: 'Outside genus', color: '#1d4ed8', bg: '#dbeafe' },
    unmeasurable: { label: 'Too distant', color: '#475569', bg: '#f1f5f9' },
};

export function renderGenomeSimilarity(sequences) {
    const nucleotide = sequences
        .map((s, i) => ({ seq: s, index: i }))
        .filter(({ seq }) => seq.type !== 'protein');

    // Pre-tick the first few so the panel always opens on something runnable;
    // every pair is compared, so ticking a long workspace by default would
    // quietly start a quadratic job nobody asked for.
    const checkboxes = nucleotide
        .map(
            ({ seq, index }, position) => `
        <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <input type="checkbox" class="genomesim-seq-check" value="${index}" ${position < PRESELECTED ? 'checked' : ''}>
          <span>${escapeHtml(seq.name)}</span>
          <span style="color:var(--text-muted);font-size:12px;">${seq.sequence.length.toLocaleString()} bp</span>
        </label>`
        )
        .join('');

    return `
    <div class="panel active">
      <div class="panel-header">
        <h2 data-i18n="Genome Similarity">Genome Similarity</h2>
        <p>Alignment-free screening of whole genomes against the ICTV ${SPECIES_THRESHOLD}% species and ${GENUS_THRESHOLD}% genus thresholds</p>
      </div>
      <div class="panel-controls">
        <div class="form-group" style="flex:1;min-width:260px;">
          <label class="form-label" data-i18n="Genomes to compare">Genomes to compare</label>
          <div id="genomesim-seq-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:8px;">
            ${checkboxes || '<p style="color:var(--text-muted);margin:0;">No nucleotide sequences loaded.</p>'}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="k-mer size">k-mer size</label>
          <select class="form-select" id="genomesim-k">
            <option value="17">17 (more sensitive)</option>
            <option value="21" selected>21 (standard)</option>
            <option value="25">25 (more specific)</option>
          </select>
        </div>
        <button class="btn btn-primary" id="run-genomesim-btn" data-i18n="Compare Genomes">Compare Genomes</button>
      </div>
      <div class="panel-controls" style="border-top:1px solid var(--border);">
        <div class="form-group" style="flex:1 1 320px;min-width:260px;">
          <label class="form-label" style="white-space:nowrap;" data-i18n="GenBank term">GenBank term</label>
          <input class="form-input" id="genomesim-term" type="text" value="phage[Title]"
                 placeholder="phage[Title]" title="Entrez search term; the length filter is added for you"
                 style="flex:1;min-width:160px;">
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="Length window">Length window</label>
          <select class="form-select" id="genomesim-tolerance">
            <option value="0.1">±10%</option>
            <option value="0.2" selected>±20%</option>
            <option value="0.35">±35%</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="Candidates">Candidates</label>
          <select class="form-select" id="genomesim-limit">
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="50">50</option>
          </select>
        </div>
        <button class="btn" id="run-genomesim-ncbi-btn" data-i18n="Find Relatives">Find Relatives</button>
        <p style="flex-basis:100%;margin:6px 0 0;font-size:12px;color:var(--text-muted);"
           data-i18n="Screens the first ticked genome against GenBank records of similar length.">
          Screens the first ticked genome against GenBank records of similar length.
        </p>
      </div>
      <div class="panel-body" id="genomesim-result">
        <div class="empty-state">
          <span class="empty-state-icon" style="font-size:32px;opacity:0.3;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </span>
          <p data-i18n="Select two or more genomes and run the comparison.">Select two or more genomes and run the comparison.</p>
        </div>
      </div>
    </div>`;
}

export function bindGenomeSimilarityEvents(seq, context) {
    const sequences = context?.sequences || [];
    document.getElementById('run-genomesim-btn')?.addEventListener('click', () => {
        const checked = Array.from(document.querySelectorAll('.genomesim-seq-check:checked'));
        const picked = checked.map(c => sequences[parseInt(c.value, 10)]).filter(Boolean);
        const k = parseInt(document.getElementById('genomesim-k')?.value || '21', 10);
        const result = document.getElementById('genomesim-result');
        if (!result) return;

        if (picked.length < 2) {
            result.innerHTML =
                '<p style="color:var(--text-muted);padding:20px;">Select at least two genomes.</p>';
            return;
        }

        result.innerHTML =
            '<p style="color:var(--text-muted);padding:20px;">Sketching genomes…</p>';
        // Yield once so the message paints before the sketching blocks the thread.
        setTimeout(() => {
            result.innerHTML = computeAndRender(picked, k);
        }, 0);
    });

    document
        .getElementById('run-genomesim-ncbi-btn')
        ?.addEventListener('click', () => findRelatives(sequences));

    // Delegated: the result area is rewritten on every run, so binding the
    // export buttons themselves would go stale each time.
    document.getElementById('genomesim-result')?.addEventListener('click', event => {
        const format = event.target?.closest?.('[data-export]')?.dataset?.export;
        if (!format || !currentReport) return;
        const text =
            format === 'tsv' ? reportToTsv(currentReport) : reportToMarkdown(currentReport);
        downloadFile(text, reportFilename(currentReport, format === 'tsv' ? 'tsv' : 'md'));
    });
}

/** Buttons that turn whatever is on screen into a file. */
function exportBar() {
    return `
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      <button class="btn" data-export="tsv" data-i18n="Export TSV">Export TSV</button>
      <button class="btn" data-export="md" data-i18n="Export Markdown">Export Markdown</button>
    </div>`;
}

/**
 * Screen the first ticked genome against GenBank: search by keyword and
 * length, pull the candidates, sketch them, rank them.
 *
 * This is the step a taxonomy run opens with, and the step that decides
 * whether a "new genus" verdict means anything — a reference set that excludes
 * the real relatives will always report novelty.
 */
async function findRelatives(sequences) {
    const result = document.getElementById('genomesim-result');
    if (!result) return;

    const firstChecked = document.querySelector('.genomesim-seq-check:checked');
    const query = firstChecked ? sequences[parseInt(firstChecked.value, 10)] : null;
    if (!query) {
        result.innerHTML =
            '<p style="color:var(--text-muted);padding:20px;">Tick the genome you want to screen.</p>';
        return;
    }

    const term = document.getElementById('genomesim-term')?.value || '';
    const tolerance = parseFloat(document.getElementById('genomesim-tolerance')?.value || '0.2');
    const limit = parseInt(document.getElementById('genomesim-limit')?.value || '20', 10);
    const k = parseInt(document.getElementById('genomesim-k')?.value || '21', 10);
    const range = lengthWindow(query.sequence.length, tolerance);

    const status = message => {
        result.innerHTML = `<p style="color:var(--text-muted);padding:20px;">${escapeHtml(message)}</p>`;
    };

    try {
        status(
            `Searching GenBank for ${range.min.toLocaleString()}–${range.max.toLocaleString()} bp records…`
        );
        const { total, records } = await searchGenomes(term, { window: range, limit });
        if (records.length === 0) {
            status('No records matched. Try a wider length window or a different term.');
            return;
        }

        status(`Found ${total.toLocaleString()} matches; downloading ${records.length}…`);
        const genomes = await fetchGenomes(records, {
            onProgress: (done, count) => status(`Downloading genomes… ${done}/${count}`),
        });

        status(`Sketching ${genomes.length} genomes…`);
        const started = performance.now();
        const ranked = rankAgainstQuery(
            { name: query.name, sequence: query.sequence },
            genomes.map(g => ({ name: g.name, sequence: g.sequence })),
            { k }
        );
        const elapsed = Math.round(performance.now() - started);
        currentReport = relativesReport(query, ranked, { k, total, range, term });
        result.innerHTML = renderRelatives(query, ranked, { total, elapsed, k, range });
    } catch (error) {
        currentReport = null;
        const message =
            error instanceof BioError || error instanceof Error
                ? error.message
                : 'The search failed.';
        result.innerHTML = `<p style="color:var(--danger,#b91c1c);padding:20px;">${escapeHtml(message)}</p>`;
    }
}

function renderRelatives(query, ranked, { total, elapsed, k, range }) {
    const rows = ranked
        .map(({ name, length, comparison }) => {
            const style = VERDICT_STYLE[comparison.verdict] || VERDICT_STYLE.unmeasurable;
            return `
        <tr>
          <td style="padding:6px 10px;font-size:12px;">${escapeHtml(shorten(name, 52))}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;">${length.toLocaleString()}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;font-weight:600;">${comparison.similarity === null ? '—' : comparison.similarity.toFixed(2)}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;">${(comparison.containmentA * 100).toFixed(1)}%</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;">${comparison.mashDistance.toFixed(4)}</td>
          <td style="padding:6px 10px;">
            <span style="background:${style.bg};color:${style.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${style.label}</span>
          </td>
        </tr>`;
        })
        .join('');

    const best = ranked.find(r => r.comparison.similarity !== null);
    const headline = best
        ? `Closest: <strong>${escapeHtml(shorten(best.name, 60))}</strong> at ${best.comparison.similarity.toFixed(2)}% estimated identity.`
        : 'No candidate shared enough k-mers to measure.';

    return `
    ${exportBar()}
    <h3 style="margin:0 0 6px;font-size:14px;">${escapeHtml(shorten(query.name, 40))} against GenBank</h3>
    <p style="margin:0 0 12px;font-size:13px;">${headline}</p>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted);">Record</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">Length</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">Identity %</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">k-mers shared</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">MASH dist</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted);">Verdict</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="color:var(--text-muted);font-size:12px;margin-top:16px;line-height:1.6;">
      Screened ${ranked.length} of ${total.toLocaleString()} GenBank records in the
      ${range.min.toLocaleString()}–${range.max.toLocaleString()} bp window, k=${k}, ${elapsed} ms of sketching.
      Only the records this search returned were compared, so an absent relative reads as novelty —
      widen the term or the window before concluding a genome is new. Figures are estimated identity
      over shared regions, not VIRIDIC intergenomic similarity.
    </p>`;
}

function computeAndRender(genomes, k) {
    const started = performance.now();
    let data;
    try {
        data = similarityMatrix(
            genomes.map(g => ({ name: g.name, sequence: g.sequence })),
            { k }
        );
    } catch (error) {
        currentReport = null;
        const message = error instanceof BioError ? error.message : 'Comparison failed.';
        return `<p style="color:var(--danger,#b91c1c);padding:20px;">${escapeHtml(message)}</p>`;
    }
    const elapsed = Math.round(performance.now() - started);
    currentReport = matrixReport(data, { k });

    return `
    ${exportBar()}
    ${renderMatrix(data)}
    ${renderPairs(data)}
    <p style="color:var(--text-muted);font-size:12px;margin-top:16px;line-height:1.6;">
      Figures are estimated average nucleotide identity over the regions two genomes share,
      from a FracMinHash k-mer sketch (k=${k}). This is not VIRIDIC's intergenomic similarity:
      VIRIDIC divides by the full length of both genomes, so it reads lower whenever part of a
      genome does not align — on a test set of jumbo phages it ran 2–3 points below these
      figures. Pairs marked <em>Too distant</em> share too few k-mers to measure at all.
      Use this to screen and to settle species-level questions; confirm anything near a
      threshold with VIRIDIC or BLAST. Computed in ${elapsed} ms.
    </p>`;
}

function renderMatrix({ names, matrix, similarity }) {
    const header = names
        .map(
            n =>
                `<th style="font-size:11px;font-weight:600;padding:4px;writing-mode:vertical-rl;text-orientation:mixed;max-height:120px;">${escapeHtml(shorten(n))}</th>`
        )
        .join('');

    const rows = names
        .map((name, i) => {
            const cells = names
                .map((_, j) => {
                    if (i === j) {
                        return `<td style="background:#111827;color:#fff;text-align:center;padding:6px 8px;font-size:12px;">100</td>`;
                    }
                    const value = similarity[i][j];
                    const cmp = matrix[i][j];
                    const style = VERDICT_STYLE[cmp.verdict] || VERDICT_STYLE.unmeasurable;
                    const text = value === null ? '—' : value.toFixed(1);
                    return `<td title="${escapeHtml(cmp.note)}" style="background:${style.bg};color:${style.color};text-align:center;padding:6px 8px;font-size:12px;font-weight:600;">${text}</td>`;
                })
                .join('');
            return `<tr><th style="text-align:left;font-size:12px;font-weight:600;padding:4px 8px;white-space:nowrap;">${escapeHtml(shorten(name))}</th>${cells}</tr>`;
        })
        .join('');

    const legend = Object.entries(VERDICT_STYLE)
        .map(
            ([, s]) =>
                `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:12px;">
                   <span style="width:12px;height:12px;border-radius:3px;background:${s.bg};border:1px solid ${s.color};"></span>${s.label}
                 </span>`
        )
        .join('');

    return `
    <h3 style="margin:0 0 10px;font-size:14px;">Estimated identity (%)</h3>
    <div style="overflow-x:auto;">
      <table style="border-collapse:separate;border-spacing:2px;">
        <thead><tr><th></th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin:10px 0 18px;">${legend}</div>`;
}

function renderPairs({ names, matrix, similarity }) {
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            pairs.push({ a: names[i], b: names[j], value: similarity[i][j], cmp: matrix[i][j] });
        }
    }
    pairs.sort((x, y) => (y.value ?? -1) - (x.value ?? -1));

    const rows = pairs
        .map(({ a, b, value, cmp }) => {
            const style = VERDICT_STYLE[cmp.verdict] || VERDICT_STYLE.unmeasurable;
            return `
        <tr>
          <td style="padding:6px 10px;font-size:12px;">${escapeHtml(shorten(a))}</td>
          <td style="padding:6px 10px;font-size:12px;">${escapeHtml(shorten(b))}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;font-weight:600;">${value === null ? '—' : value.toFixed(2)}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;">${(cmp.containmentA * 100).toFixed(1)}%</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;">${cmp.mashDistance.toFixed(4)}</td>
          <td style="padding:6px 10px;">
            <span style="background:${style.bg};color:${style.color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">${style.label}</span>
          </td>
        </tr>`;
        })
        .join('');

    return `
    <h3 style="margin:18px 0 10px;font-size:14px;">Pairs, closest first</h3>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted);">Genome A</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted);">Genome B</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">Identity %</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">k-mers shared</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:var(--text-muted);">MASH dist</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text-muted);">Verdict</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function shorten(name, max = 28) {
    const s = String(name || '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function escapeHtml(str) {
    return String(str ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
}
