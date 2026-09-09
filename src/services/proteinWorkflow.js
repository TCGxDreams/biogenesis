/** Resolve a public structure identifier without requiring a source choice.
 * @param {string} input
 */
export function resolveStructureInput(input) {
    const id = input.trim().toUpperCase();
    if (/^[0-9][A-Z0-9]{3}$/.test(id)) return {id,source:'pdb'};
    if (/^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/.test(id)) return {id,source:'alphafold'};
    throw new Error('Nhập mã PDB (1EMA) hoặc UniProt (P04637). / Enter a PDB or UniProt accession.');
}
export const PROTEIN_PRESETS = Object.freeze({
    explore:{threshold:0.4,topN:25},
    strict:{threshold:0.7,topN:10},
    broad:{threshold:0.2,topN:100},
});

/** Normalise a document title or common spelling without selecting an organism.
 * @param {string} value
 */
export function proteinNameQuery(value) {
    return value.trim().replace(/_/g,' ').replace(/\bisulin\b/gi,'insulin').replace(/\s+/g,' ');
}
