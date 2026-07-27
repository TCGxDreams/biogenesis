// ============================================
// BioGenesis — Core Bioinformatics Utilities
// ============================================

// Codon table (standard genetic code)
/**
 * The standard genetic code: 64 codons to one-letter residues, `*` for stops.
 *
 * @type {{[codon: string]: string}}
 */
export const CODON_TABLE = /** @type {{[codon: string]: string}} */ ({
    'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L', 'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
    'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M', 'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
    'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S', 'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
    'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T', 'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
    'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*', 'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K', 'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
    'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W', 'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
    'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R', 'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
});

/**
 * Base complements, in both cases. U maps to A, so complementing RNA yields
 * DNA-alphabet output.
 *
 * @type {{[base: string]: string}}
 */
export const COMPLEMENT = /** @type {{[base: string]: string}} */ ({ 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C', 'U': 'A', 'a': 't', 't': 'a', 'c': 'g', 'g': 'c', 'u': 'a' });

/**
 * Free amino acid masses in daltons; peptide bonds subtract one water each.
 *
 * @type {{[residue: string]: number}}
 */
export const AA_WEIGHTS = /** @type {{[residue: string]: number}} */ ({
    'A': 89.09, 'R': 174.20, 'N': 132.12, 'D': 133.10, 'C': 121.16, 'E': 147.13, 'Q': 146.15,
    'G': 75.03, 'H': 155.16, 'I': 131.17, 'L': 131.17, 'K': 146.19, 'M': 149.21, 'F': 165.19,
    'P': 115.13, 'S': 105.09, 'T': 119.12, 'W': 204.23, 'Y': 181.19, 'V': 117.15
});

/**
 * Nucleotide monophosphate masses in daltons.
 *
 * @type {{[base: string]: number}}
 */
export const NT_WEIGHTS = /** @type {{[base: string]: number}} */ ({ 'A': 331.2, 'T': 322.2, 'C': 307.2, 'G': 347.2, 'U': 308.2 });

// ---- Sequence manipulation ----

/**
 * Complement each base, preserving case. Unknown characters pass through.
 *
 * @param {string} seq
 * @returns {string}
 */
export function complement(seq) {
    return seq.split('').map(c => COMPLEMENT[c] || c).join('');
}

/**
 * Reverse complement: complement each base, then reverse the string.
 *
 * @param {string} seq
 * @returns {string}
 */
export function reverseComplement(seq) {
    return complement(seq).split('').reverse().join('');
}

/**
 * DNA to RNA: replace T with U, preserving case.
 *
 * @param {string} dnaSeq
 * @returns {string}
 */
export function transcribe(dnaSeq) {
    return dnaSeq.replace(/T/gi, m => m === 'T' ? 'U' : 'u');
}

/**
 * RNA to DNA: replace U with T, preserving case.
 *
 * @param {string} rnaSeq
 * @returns {string}
 */
export function reverseTranscribe(rnaSeq) {
    return rnaSeq.replace(/U/gi, m => m === 'U' ? 'T' : 't');
}

/**
 * Translate a nucleotide sequence in one reading frame.
 *
 * A trailing partial codon is dropped; codons outside the standard table
 * translate to `X`.
 *
 * @param {string} dnaSeq
 * @param {number} [frame=0] Offset 0, 1 or 2.
 * @returns {string} Residues, `*` for stops.
 */
export function translate(dnaSeq, frame = 0) {
    const seq = dnaSeq.toUpperCase();
    let protein = '';
    for (let i = frame; i + 2 < seq.length; i += 3) {
        const codon = seq.substring(i, i + 3);
        protein += CODON_TABLE[codon] || 'X';
    }
    return protein;
}

// ---- Statistics ----

/**
 * GC content as a percentage of the ACGTU characters present.
 *
 * @param {string} seq
 * @returns {number} 0-100; 0 for a sequence with no ACGTU characters.
 */
export function gcContent(seq) {
    const upper = seq.toUpperCase();
    const gc = (upper.split('').filter(c => c === 'G' || c === 'C').length);
    const total = upper.split('').filter(c => 'ATCGU'.includes(c)).length;
    return total > 0 ? (gc / total * 100) : 0;
}

/**
 * Count each base, bucketing everything else into `other`.
 *
 * @param {string} seq
 * @returns {{A: number, T: number, C: number, G: number, U: number, other: number}}
 */
export function nucleotideComposition(seq) {
    const upper = seq.toUpperCase();
    /** @type {{A: number, T: number, C: number, G: number, U: number, other: number, [k: string]: number}} */
    const comp = { A: 0, T: 0, C: 0, G: 0, U: 0, other: 0 };
    for (const c of upper) {
        if (comp.hasOwnProperty(c)) comp[c]++;
        else comp.other++;
    }
    return comp;
}

/**
 * Molecular weight in daltons.
 *
 * Proteins add one water for the free termini and subtract one per peptide
 * bond; nucleic acids sum monophosphate masses.
 *
 * @param {string} seq
 * @param {'dna'|'rna'|'protein'|string} [type='dna']
 * @returns {number}
 */
export function molecularWeight(seq, type = 'dna') {
    const upper = seq.toUpperCase();
    if (type === 'protein') {
        let weight = 18.02; // water
        for (const c of upper) {
            weight += (AA_WEIGHTS[c] || 0) - 18.02;
        }
        return weight;
    }
    let weight = 0;
    for (const c of upper) {
        weight += NT_WEIGHTS[c] || 0;
    }
    return weight;
}

/**
 * Melting temperature: the Wallace rule below 14 nt, the salt-adjusted formula
 * at 14 nt and above.
 *
 * @param {string} seq
 * @returns {number} °C; 0 for an empty sequence.
 */
export function meltingTemp(seq) {
    const upper = seq.toUpperCase();
    const len = upper.length;
    if (len === 0) return 0;
    const comp = nucleotideComposition(upper);
    if (len < 14) {
        return 2 * (comp.A + comp.T) + 4 * (comp.G + comp.C);
    }
    return 64.9 + 41 * (comp.G + comp.C - 16.4) / len;
}

// Nearest-Neighbor Thermodynamics (SantaLucia 1998)
// ΔH (kcal/mol), ΔS (cal/K·mol)
const NN_PARAMS = /** @type {{[pair: string]: {dH: number, dS: number}}} */ ({
    'AA': { dH: -7.9, dS: -22.2 }, 'TT': { dH: -7.9, dS: -22.2 },
    'AT': { dH: -7.2, dS: -20.4 }, 'TA': { dH: -7.2, dS: -21.3 },
    'CA': { dH: -8.5, dS: -22.7 }, 'TG': { dH: -8.5, dS: -22.7 },
    'GT': { dH: -8.4, dS: -22.4 }, 'AC': { dH: -8.4, dS: -22.4 },
    'CT': { dH: -7.8, dS: -21.0 }, 'AG': { dH: -7.8, dS: -21.0 },
    'GA': { dH: -8.2, dS: -22.2 }, 'TC': { dH: -8.2, dS: -22.2 },
    'CG': { dH: -10.6, dS: -27.2 }, 'GC': { dH: -9.8, dS: -24.4 },
    'GG': { dH: -8.0, dS: -19.9 }, 'CC': { dH: -8.0, dS: -19.9 },
    // Initiation penalties
    'initA': { dH: 2.3, dS: 4.1 }, 'initT': { dH: 2.3, dS: 4.1 },
    'initG': { dH: 0.1, dS: -2.8 }, 'initC': { dH: 0.1, dS: -2.8 },
});

/**
 * Melting temperature by nearest-neighbour thermodynamics (SantaLucia 1998),
 * with a Schildkraut-Lifson salt correction.
 *
 * Falls back to {@link meltingTemp} below 8 nt, where the model does not apply.
 *
 * @param {string} seq
 * @param {number} [primerConc=5e-8] Primer concentration, molar.
 * @param {number} [naConc=0.05] Sodium concentration, molar.
 * @returns {number} °C, never negative.
 */
export function calculateTmNN(seq, primerConc = 50e-9, naConc = 0.05) {
    const upper = seq.toUpperCase().replace(/[^ATCG]/g, '');
    if (upper.length < 8) return meltingTemp(upper); // fallback for very short

    let dH = 0; // kcal/mol
    let dS = 0; // cal/K·mol

    // Initiation
    const first = upper[0];
    const last = upper[upper.length - 1];
    dH += NN_PARAMS[`init${first}`]?.dH || 0;
    dS += NN_PARAMS[`init${first}`]?.dS || 0;
    dH += NN_PARAMS[`init${last}`]?.dH || 0;
    dS += NN_PARAMS[`init${last}`]?.dS || 0;

    // Nearest Neighbor pairs
    for (let i = 0; i < upper.length - 1; i++) {
        const pair = upper.substring(i, i + 2);
        if (NN_PARAMS[pair]) {
            dH += NN_PARAMS[pair].dH;
            dS += NN_PARAMS[pair].dS;
        }
    }

    // Convert dH to cal/mol
    dH *= 1000;

    // Salt correction (Schildkraut and Lifson 1965 formulation on entropy)
    dS += 0.368 * (upper.length - 1) * Math.log(naConc);

    // Tm = (dH / (dS + R * ln(C/4))) - 273.15
    const R = 1.987; // Gas constant
    const tm = (dH / (dS + R * Math.log(primerConc / 4))) - 273.15;

    return Math.max(0, tm);
}


// ---- ORF Finding ----

/**
 * Find open reading frames on the forward strand, in all three frames.
 *
 * An ATG opens an ORF and the next in-frame stop closes it.
 *
 * @param {string} seq
 * @param {number} [minLength=30] Shortest ORF reported, in nucleotides.
 * @returns {import('../core/types.js').Orf[]} Longest first.
 */
export function findORFs(seq, minLength = 30) {
    const upper = seq.toUpperCase();
    const orfs = [];
    for (let frame = 0; frame < 3; frame++) {
        let start = -1;
        for (let i = frame; i + 2 < upper.length; i += 3) {
            const codon = upper.substring(i, i + 3);
            if (codon === 'ATG' && start === -1) {
                start = i;
            } else if ((codon === 'TAA' || codon === 'TAG' || codon === 'TGA') && start !== -1) {
                const length = i + 3 - start;
                if (length >= minLength) {
                    orfs.push({ frame: frame + 1, start, end: i + 3, length, protein: translate(upper.substring(start, i + 3)) });
                }
                start = -1;
            }
        }
    }
    return orfs.sort((a, b) => b.length - a.length);
}

// ---- Sequence type detection ----

/**
 * Guess whether a sequence is DNA, RNA or protein.
 *
 * Residues that cannot be nucleotides decide it for protein; otherwise U
 * without T means RNA, and a high ACGTN fraction means DNA.
 *
 * @param {string} seq
 * @returns {'dna'|'rna'|'protein'|'unknown'} `unknown` only for empty input.
 */
export function detectSequenceType(seq) {
    const upper = seq.toUpperCase().replace(/[\s\d\n\r*]/g, '');
    const dnaChars = new Set('ATCGN');
    const rnaChars = new Set('AUCGN');
    const proteinExclusive = new Set('DEFHIKLMPQRSVWY'); // Excludes A, C, G, T, U, N
    let dnaCount = 0, rnaCount = 0, exclusiveProteinCount = 0;
    for (const c of upper) {
        if (dnaChars.has(c)) dnaCount++;
        if (rnaChars.has(c)) rnaCount++;
        if (proteinExclusive.has(c)) exclusiveProteinCount++;
    }
    const total = upper.length;
    if (total === 0) return 'unknown';

    // If it has a clear number of exclusive protein chars, it's a protein
    if (exclusiveProteinCount / total > 0.05 || exclusiveProteinCount > 5) return 'protein';

    if (upper.includes('U') && !upper.includes('T')) return 'rna';
    if (dnaCount / total > 0.85) return 'dna';
    if (rnaCount / total > 0.85) return 'rna';
    return 'protein';
}

// ---- Color coding ----

/**
 * CSS class for colour-coding a nucleotide.
 *
 * @param {string} char
 * @returns {string} Empty string when the character has no class.
 */
export function getNucleotideClass(char) {
    const c = char.toUpperCase();
    switch (c) {
        case 'A': return 'nt-a';
        case 'T': return 'nt-t';
        case 'C': return 'nt-c';
        case 'G': return 'nt-g';
        case 'U': return 'nt-u';
        case '-': return 'nt-gap';
        default: return '';
    }
}

/**
 * CSS class grouping an amino acid by chemistry.
 *
 * @param {string} char
 * @returns {string} Empty string when the character has no class.
 */
export function getAminoAcidClass(char) {
    const c = char.toUpperCase();
    if ('AILMFWVP'.includes(c)) return 'aa-hydrophobic';
    if ('STYNQHC'.includes(c)) return 'aa-polar';
    if ('RK'.includes(c)) return 'aa-positive';
    if ('DE'.includes(c)) return 'aa-negative';
    if ('G'.includes(c)) return 'aa-special';
    return '';
}

// ---- File Parsers ----

/**
 * Parse FASTA text into records. Handles multiple records, wrapped lines,
 * blank lines and CRLF endings. Text before the first `>` is ignored.
 *
 * @param {string} text
 * @returns {import('../core/types.js').FastaRecord[]}
 */
export function parseFasta(text) {
    const sequences = [];
    const lines = text.split('\n');
    let currentName = '';
    let currentSeq = '';
    let currentDesc = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('>')) {
            if (currentName) {
                sequences.push({ name: currentName, description: currentDesc, sequence: currentSeq, type: detectSequenceType(currentSeq) });
            }
            const headerParts = trimmed.substring(1).split(/\s+/);
            currentName = headerParts[0] || 'Unnamed';
            currentDesc = headerParts.slice(1).join(' ');
            currentSeq = '';
        } else if (trimmed) {
            currentSeq += trimmed.replace(/\s/g, '');
        }
    }
    if (currentName) {
        sequences.push({ name: currentName, description: currentDesc, sequence: currentSeq, type: detectSequenceType(currentSeq) });
    }
    return sequences;
}

/**
 * Parse GenBank text into records, converting 1-based feature locations to
 * 0-based half-open coordinates. Records with no ORIGIN block are skipped.
 *
 * @param {string} text
 * @returns {import('../core/types.js').GenBankRecord[]}
 */
export function parseGenBank(text) {
    /** @type {import('../core/types.js').GenBankRecord[]} */
    const sequences = [];
    const entries = text.split('//').filter(e => e.trim());

    for (const entry of entries) {
        const lines = entry.split('\n');
        let name = 'Unknown';
        let description = '';
        let sequence = '';
        let features = [];
        let inOrigin = false;
        let inFeatures = false;
        let currentFeature = null;

        for (const line of lines) {
            if (line.startsWith('LOCUS')) {
                const parts = line.split(/\s+/);
                name = parts[1] || 'Unknown';
            } else if (line.startsWith('DEFINITION')) {
                description = line.substring(12).trim();
            } else if (line.startsWith('FEATURES')) {
                inFeatures = true;
            } else if (line.startsWith('ORIGIN')) {
                inFeatures = false;
                inOrigin = true;
            } else if (inOrigin) {
                sequence += line.replace(/[\s\d\/]/g, '');
            } else if (inFeatures) {
                const featureMatch = line.match(/^\s{5}(\S+)\s+(complement\()?(\d+)\.\.(\d+)\)?/);
                if (featureMatch) {
                    if (currentFeature) features.push(currentFeature);
                    currentFeature = /** @type {import('../core/types.js').GenBankFeature} */ ({
                        type: featureMatch[1],
                        start: parseInt(featureMatch[3]) - 1,
                        end: parseInt(featureMatch[4]),
                        complement: !!featureMatch[2],
                        qualifiers: {}
                    });
                } else if (currentFeature) {
                    const qualMatch = line.match(/^\s+\/(\w+)="?([^"]*)"?/);
                    if (qualMatch) {
                        currentFeature.qualifiers[qualMatch[1]] = qualMatch[2];
                    }
                }
            }
        }
        if (currentFeature) features.push(currentFeature);

        if (sequence) {
            sequences.push({
                name,
                description,
                sequence: sequence.toUpperCase(),
                type: detectSequenceType(sequence),
                features,
                format: /** @type {'genbank'} */ ('genbank')
            });
        }
    }
    return sequences;
}

// ---- Exporters ----

/**
 * Serialise one record as FASTA, wrapping the sequence.
 *
 * @param {string} name Header text, written after the `>`.
 * @param {string} sequence
 * @param {number} [lineWidth=70] Residues per line.
 * @returns {string} Always ends with a newline.
 */
export function toFasta(name, sequence, lineWidth = 70) {
    let fasta = `>${name}\n`;
    for (let i = 0; i < sequence.length; i += lineWidth) {
        fasta += sequence.substring(i, i + lineWidth) + '\n';
    }
    return fasta;
}

/**
 * Trigger a browser download of in-memory content.
 *
 * TODO(layering): this touches the DOM and does not belong in `src/utils/`.
 * Move it to a browser-side module so the pure-layer lint rule can be raised
 * from `warn` to `error`. See AGENTS.md.
 *
 * @param {string} content
 * @param {string} filename
 * @param {string} [mimeType='text/plain']
 * @returns {void}
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ---- External DB Mapping ----

/**
 * Look up a UniProt accession for a query, preferring reviewed (Swiss-Prot)
 * entries. Any version suffix on the query is stripped.
 *
 * @param {string} query Accession or keyword.
 * @returns {Promise<string|null>} Null when nothing matches or the request fails.
 */
export async function fetchUniProtId(query) {
    if (!query) return null;
    // Strip version number from accession (e.g., NP_000537.1 -> NP_000537)
    const cleanQuery = query.split('.')[0];

    try {
        const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(cleanQuery)}&format=json&fields=accession&size=1`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            // Find a reviewed (Swiss-Prot) entry if possible, otherwise take the first
            const reviewed = data.results.find(
                /** @param {{entryType: string}} r */ r =>
                    r.entryType === 'UniProtKB reviewed (Swiss-Prot)'
            );
            return reviewed ? reviewed.primaryAccession : data.results[0].primaryAccession;
        }
    } catch (e) {
        console.warn("Error fetching UniProt ID:", e);
    }
    return null;
}
