/** Validate model output before using it for molecular selections.
 * @param {unknown} value
 * @returns {Array<{chain:string,resi:number,resn:string,probability:number}>}
 */
export function bindingSites(value) {
    if (!Array.isArray(value)) throw new Error('Prediction response has no residue list.');
    return value.map(site => {
        if (!site || typeof site.chain !== 'string' || !Number.isInteger(site.resi) || typeof site.resn !== 'string' || !Number.isFinite(site.probability) || site.probability < 0 || site.probability > 1) throw new Error('Invalid residue or score in prediction response.');
        return {chain:site.chain.trim(),resi:site.resi,resn:site.resn,probability:site.probability};
    }).sort((a,b)=>b.probability-a.probability);
}
/** @param {{chain:string,resi:number}} site */
export function residueSelection(site) { return {chain:site.chain.trim(),resi:site.resi}; }
