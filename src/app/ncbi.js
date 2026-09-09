// @ts-nocheck -- DOM controller code moved verbatim from main.js in T4.3.
//                Typed in a follow-up; see the T3.2 note.
// ============================================
// BioGenesis — NCBI sequence fetch
// ============================================
//
// Fetches records from NCBI E-utilities and adds them to the workspace.

import { openDatabaseSearch } from './databaseSearch.js';
import { fetchUniProtId } from '../utils/bioUtils.js';
import { autoAnnotate } from '../utils/autoAnnotate.js';

/**
 * The application context, assigned by createNcbiFetch(). Collaborators are looked up
 * on it at call time, so wiring order does not matter.
 *
 * @type {import('./types.js').App}
 */
let app;

/**
 * Build the NCBI fetch binding.
 *
 * @param {import('./types.js').App} context
 * @returns {Object} The functions this module owns, to be merged onto `context`.
 */
export function createNcbiFetch(context) {
    app = context;
    return { bindNcbiFetch, addFastaToProject };
}

function bindNcbiFetch() {
    const open = () => openDatabaseSearch(app,
        document.getElementById('ncbi-search-input')?.value.trim() || '',
        document.getElementById('ncbi-db-select')?.value || 'nucleotide');
    document.getElementById('ncbi-fetch-btn')?.addEventListener('click', open);
    document.getElementById('database-search-btn')?.addEventListener('click', () => openDatabaseSearch(app));
    document.getElementById('ncbi-search-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') open();
    });
}

function addFastaToProject(fastaText, db) {
    const lines = fastaText.split('\n');
    const header = lines[0].substring(1).trim();
    const seqStr = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();

    if (!seqStr) return;

    // Parse NCBI FASTA header formats:
    // sp|P04637|P53_HUMAN Cellular tumor antigen p53 OS=Homo sapiens ...
    // >NM_001301717.2 Homo sapiens breast cancer 1 ...
    // >gi|12345|ref|NM_000546.6| ...
    let name = 'NCBI_seq';
    let accession = '';
    let organism = '';

    // Try UniProt format: sp|ACCESSION|NAME or tr|ACCESSION|NAME
    const uniprotMatch = header.match(/^(?:sp|tr)\|([A-Z0-9]+)\|(\S+)/);
    if (uniprotMatch) {
        accession = uniprotMatch[1];
        name = uniprotMatch[2].replace(/_\w+$/, ''); // Remove species suffix
    } else {
        // Try gi format: gi|123|ref|ACCESSION| or gi|123|gb|ACCESSION|
        const giMatch = header.match(/gi\|\d+\|(?:ref|gb|emb|dbj)\|([^|]+)\|/);
        if (giMatch) {
            accession = giMatch[1].replace(/\.\d+$/, '');
            name = accession;
        } else {
            // Try plain accession: NM_000546.6 or P04637 at start
            const plainMatch = header.match(/^([A-Z][A-Z0-9_]+(?:\.\d+)?)/);
            if (plainMatch) {
                accession = plainMatch[1].replace(/\.\d+$/, '');
                name = accession;
            }
        }
    }

    // Extract organism from [Homo sapiens] or OS=Homo sapiens
    const orgBracket = header.match(/\[([^\]]+)\]\s*$/);
    const orgOS = header.match(/OS=([^=]+?)(?:\s+OX=|\s+GN=|\s+PE=|\s*$)/);
    if (orgBracket) organism = orgBracket[1];
    else if (orgOS) organism = orgOS[1].trim();

    // Better name: take first meaningful words from description
    if (name === accession || name === 'NCBI_seq') {
        // Get description part (after accession)
        const descPart = header
            .replace(/^[^\s]+\s+/, '')
            .replace(/\[.*\]$/, '')
            .trim();
        if (descPart) {
            name = descPart.split(/\s+/).slice(0, 3).join('_').substring(0, 30);
        }
    }
    name = name || accession || 'NCBI_seq';

    // Detect type
    let type = db === 'protein' ? 'protein' : 'dna';
    if (db === 'nucleotide') {
        const hasU = /U/i.test(seqStr) && !/T/i.test(seqStr);
        if (hasU) type = 'rna';
    }

    const newSeq = {
        name: name,
        description: header,
        type: type,
        organism: organism || 'NCBI Import',
        accession: accession,
        sequence: seqStr,
        features: [],
    };

    // For proteins: check if accession looks like UniProt (for AlphaFold)
    if (type === 'protein') {
        if (accession && /^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i.test(accession)) {
            newSeq.uniprotId = accession;
        } else {
            // Try to resolve the UniProt ID automatically in background
            fetchUniProtId(accession || name).then(resolvedUniProt => {
                if (resolvedUniProt) {
                    newSeq.uniprotId = resolvedUniProt;
                    app.setState({ sequences: [...app.state.sequences] });
                    if (app.state.sequences[app.state.activeSequenceIdx] === newSeq) {
                        app.renderToolPanel(); // Refresh 3D viewer cache if open
                    }
                }
            });
        }
    }

    // Auto-annotate newly injected sequence
    autoAnnotate(newSeq);

    app.setState({ sequences: [...app.state.sequences, newSeq] });
    app.renderFileTree();
    app.openSequence(app.state.sequences.length - 1);
    app.setStatus(
        `Added ${name} (${seqStr.length} ${type === 'protein' ? 'aa' : 'bp'})${accession ? ' — ' + accession : ''}`
    );
}
