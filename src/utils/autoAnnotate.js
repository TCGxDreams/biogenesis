// ============================================
// BioGenesis — Auto Annotator
// ============================================

import { reverseComplement } from './bioUtils.js';

// Common biological features
const COMMON_FEATURES = [
    // Promoters
    { name: 'T7 promoter', sequence: 'TAATACGACTCACTATAGGG', type: 'promoter', color: '#8b5cf6' },
    { name: 'T3 promoter', sequence: 'AATTAACCCTCACTAAAGGG', type: 'promoter', color: '#8b5cf6' },
    { name: 'SP6 promoter', sequence: 'ATTTAGGTGACACTATAG', type: 'promoter', color: '#8b5cf6' },
    { name: 'lac promoter', sequence: 'GCTCGTATAATGTGTGG', type: 'promoter', color: '#8b5cf6' },

    // Terminators
    { name: 'T7 terminator', sequence: 'GCTAGTTATTGCTCAGCGG', type: 'terminator', color: '#ef4444' },

    // Tags
    { name: '6xHis tag', sequence: 'CATCACCATCACCATCAC', type: 'CDS', color: '#f59e0b' },
    { name: 'FLAG tag', sequence: 'GATTACAAGGATGACGACGATAAG', type: 'CDS', color: '#f59e0b' },
    { name: 'HA tag', sequence: 'TACCCATACGATGTTCCTGACTATGCGGG', type: 'CDS', color: '#f59e0b' },
    { name: 'Myc tag', sequence: 'GAACAAAAACTCATCTCAGAAGAGGATCTG', type: 'CDS', color: '#f59e0b' },

    // Resistance Genes
    { name: 'AmpR', sequence: 'ATGAGTATTCAACATTTCCGTGTCGCCCTTATTCCCTTTTTTGCGGCATTTTGCCTTCCTGTTTTTGCTCACCCAGAAACGCTGGTGAAAGTAAAAGATGCTGAAGATCAGTTGGGTGCACGAGTGGGTTACATCGAACTGGATCTCAACAGCGGTAAGATCCTTGAGAGTTTTCGCCCCGAAGAACGTTTTCCAATGATGAGCACTTTTAAAGTTCTGCTATGTGGCGCGGTATTATCCCGTGTTGACGCCGGGCAAGAGCAACTCGGTCGCCGCATACACTATTCTCAGAATGACTTGGTTGAGTACTCACCAGTCACAGAAAAGCATCTTACGGATGGCATGACAGTAAGAGAATTATGCAGTGCTGCCATAACCATGAGTGATAACACTGCGGCCAACTTACTTCTGACAACGATCGGAGGACCGAAGGAGCTAACCGCTTTTTTGCACAACATGGGGGATCATGTAACTCGCCTTGATCGTTGGGAACCGGAGCTGAATGAAGCCATACCAAACGACGAGCGTGACACCACGATGCCTGCAGCAATGGCAACAACGTTGCGCAAACTATTAACTGGCGAACTACTTACTCTAGCTTCCCGGCAACAATTAATAGACTGGATGGAGGCGGATAAAGTTGCAGGACCACTTCTGCGCTCGGCCCTTCCGGCTGGCTGGTTTATTGCTGATAAATCTGGAGCCGGTGAGCGTGGGTCTCGCGGTATCATTGCAGCACTGGGGCCAGATGGTAAGCCCTCCCGTATCGTAGTTATCTACACGACGGGGAGTCAGGCAACTATGGATGAACGAAATAGACAGATCGCTGAGATAGGTGCCTCACTGATTAAGCATTGG', type: 'gene', color: '#10b981' },
    { name: 'KanR', sequence: 'ATGAGCCATATTCAACGGGAAACGTCTTGCTCGAGGCCGCGATTAAATTCCAACATGGATGCTGATTTATATGGGTATAAATGGGCTCGCGATAATGTCGGGCAATCAGGTGCGACAATCTATCGATTGTATGGGAAGCCCGATGCGCCAGAGTTGTTTCTGAAACATGGCAAAGGTAGCGTTGCCAATGATGTTACAGATGAGATGGTCAGACTAAACTGGCTGACGGAATTTATGCCTCTTCCGACCATCAAGCATTTTATCCGTACTCCTGATGATGCATGGTTACTCACCACTGCGATCCCCGGGAAAACAGCATTCCAGGTATTAGAAGAATATCCTGATTCAGGTGAAAATATTGTTGATGCGCTGGCAGTGTTCCTGCGCCGGTTGCATTCGATTCCTGTTTGTAATTGTCCTTTTAACAGCGATCGCGTATTTCGTCTCGCTCAGGCGCAATCACGAATGAATAACGGTTTGGTTGATGCGAGTGATTTTGATGACGAGCGTAATGGCTGGCCTGTTGAACAAGTCTGGAAAGAAATGCATAAGCTTTTGCCATTCTCACCGGATTCAGTCGTCACTCATGGTGATTTCTCACTTGATAACCTTATTTTTGACGAGGGGAAATTAATAGGTTGTATTGATGTTGGACGAGTCGGAATCGCAGACCGATACCAGGATCTTGCCATCCTATGGAACTGCCTCGGTGAGTTTTCTCCTTCATTACAGAAACGGCTTTTTCAAAAATATGGTATTGATAATCCTGATATGAATAAATTGCAGTTTCATTTGATGCTCGATGAGTTTTTCTAAT', type: 'gene', color: '#10b981' },

    // Origins of Replication
    { name: 'ColE1 ori', sequence: 'CCCTCGAGGGCCTGACGCGCGTCCCGCCCCGGAGTCCGCCCCCGCCCGCGCCCGCCCGCCCCCGCGCCCGCCCGCCGCGCGCCGCGCGCGCCCGG', type: 'rep_origin', color: '#ec4899' },
    { name: 'pUC ori', sequence: 'CCCGTAGAAAAGATCAAAGGATCTTCTTGAGATCCTTTTTTTCTGCGCGTAATCTGCTGCTTGCAAACAAAAAAACCACCGCTACCAGCGGTGGTTTGTTTGCCGGATCAAGAGCTACCAACTCTTTTTCCGAAGGTAACTGGCTTCAGCAGAGCGCAGATACCAAATACTGTGCTTCTAGTGTAGCCGTAGTTAGGCCACCACTTCAAGAACTCTGTAGCACCGCCTACATACCTCGCTCTGCTAATCCTGTTACCAGTGGCTGCTGCCAGTGGCGATAAGTCGTGTCTTACCGGGTTGGACTCAAGACGATAGTTACCGGATAAGGCGCAGCGGTCGGGCTGAACGGGGGGTTCGTGCACACAGCCCAGCTTGGAGCGAACGACCTACACCGAACTGAGATACCTACAGCGTGAGCTATGAGAAAGCGCCACGCTTCCCGAAGGGAGAAAGGCGGACAGGTATCCGGTAAGCGGCAGGGTCGGAACAGGAGAGCGCACGAGGGAGCTTCCAGGGGGAAACGCCTGGTATCTTTATAGTCCTGTCGGGTTTCGCCACCTCTGACTTGAGCGTCGATTTTTGTGATGCTCGTCAGGGGGGCGGAGCCTATGGAAAAACGCCAGCAACGCGGCCTTTTTACGGTTCCTGGCCTTTTGCTGGCCTTTTGCTCACATGTT', type: 'rep_origin', color: '#ec4899' },

    // Reporters
    { name: 'GFP', sequence: 'ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCTTGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAGCGGCACGACTTCTTCAAGAGCGCCATGCCTGAGGGATACGTGCAGGAGAGGACCATCTTCTTCAAGGACGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAGGGAGACACCCTCGTCAACAGGATCGAGCTTAAGGGAATCGATTTCAAGGAGGACGGAAACATCCTCGGCCACAAGTTGGAATACAACTACAACTCCCACAACGTATACATCATGGCCGACAAGCAAAAGAACGGCATCAAAGTCAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAG', type: 'gene', color: '#3b82f6' }
];

/**
 * Annotate a sequence in place with any known feature it contains, on either
 * strand, in forward-strand coordinates. Idempotent: re-running adds nothing.
 * Protein sequences are returned untouched.
 *
 * @param {import('../core/types.js').Sequence} sequenceObj Mutated in place.
 * @returns {import('../core/types.js').Sequence} The same object.
 */
export function autoAnnotate(sequenceObj) {
    if (!sequenceObj || !sequenceObj.sequence) return sequenceObj;

    // Only auto-annotate DNA/RNA
    if (sequenceObj.type === 'protein') return sequenceObj;

    const seqText = sequenceObj.sequence.toUpperCase();
    const rcText = reverseComplement(seqText);
    let annotations = sequenceObj.annotations || [];

    // Create a fast lookup Set to avoid duplicate overlapping annotations of the same feature
    const existingKeys = new Set(
        annotations.map(a => `${a.name}-${a.start}-${a.end}-${a.direction}`)
    );

    COMMON_FEATURES.forEach(feature => {
        // Check Forward strand
        let idx = -1;
        while ((idx = seqText.indexOf(feature.sequence, idx + 1)) !== -1) {
            const start = idx;
            const end = idx + feature.sequence.length;
            const key = `${feature.name}-${start}-${end}-forward`;

            if (!existingKeys.has(key)) {
                annotations.push({
                    name: feature.name,
                    type: feature.type,
                    start: start,
                    end: end,
                    direction: 'forward',
                    color: feature.color
                });
                existingKeys.add(key);
            }
        }

        // Check Reverse strand
        let rcIdx = -1;
        while ((rcIdx = rcText.indexOf(feature.sequence, rcIdx + 1)) !== -1) {
            // Convert RC index to Forward strand coordinates
            const start = seqText.length - (rcIdx + feature.sequence.length);
            const end = seqText.length - rcIdx;
            const key = `${feature.name}-${start}-${end}-reverse`;

            if (!existingKeys.has(key)) {
                annotations.push({
                    name: feature.name,
                    type: feature.type,
                    start: start,
                    end: end,
                    direction: 'reverse',
                    color: feature.color
                });
                existingKeys.add(key);
            }
        }
    });

    sequenceObj.annotations = annotations;
    return sequenceObj;
}
