// Deliberately synthetic examples with reproducible learning outcomes.
const coding = 'ATGAAAGGCTTTCCGGAATAA';
/** @param {string} name @param {string} sequence @param {'dna'|'rna'|'protein'} [type] */
const sample = (name, sequence, type = 'dna') => ({ name, sequence, type, topology: 'linear', organism: 'Synthetic teaching example', description: 'Synthetic teaching example; not a biological reference sequence.', features: [] });
export const PRACTICE_PACKS = [
    { id: 'translation', title: 'Reading frames', vi: 'Khung đọc & đột biến', tool: 'translation',
      goal: 'Compare a coding sequence, a substitution and a one-base insertion.', goalVi: 'So sánh trình tự mã hóa, thay thế một base và chèn một base.',
      samples: [sample('Demo_CDS_reference', coding), sample('Demo_CDS_substitution', 'ATGAAAGGCTATCCGGAATAA'), sample('Demo_CDS_frameshift', 'ATGCAAAGGCTTTCCGGAATAA'), sample('Demo_RNA', coding.replaceAll('T','U'), 'rna')] },
    { id: 'composition', title: 'GC & motifs', vi: 'GC & motif', tool: 'statistics',
      goal: 'Compare 20%, 50% and 80% GC, then find repeated ATG motifs.', goalVi: 'So sánh GC 20%, 50%, 80%, rồi tìm motif ATG lặp lại.',
      samples: [sample('Demo_GC20', 'AAAATTTTGC'.repeat(20)), sample('Demo_GC50', 'ATGC'.repeat(50)), sample('Demo_GC80', 'GGGGCCCCAT'.repeat(20)), sample('Demo_motif', 'CCCATGAAATGCCCATGTTT')] },
    { id: 'alignment', title: 'Sequence comparison', vi: 'So sánh trình tự', tool: 'alignment',
      goal: 'Align related toy sequences and identify substitutions and gaps.', goalVi: 'Căn chỉnh các trình tự mô phỏng để tìm thay thế và khoảng trống.',
      samples: [sample('Demo_align_A', 'ATGCGTACGTTAGCTAGCTAGGCTAA'), sample('Demo_align_B', 'ATGCGTACGCTAGCTAGCTAGGCTAA'), sample('Demo_align_C', 'ATGCGTACGTTAGCTAGGCTAA'), sample('Demo_align_D', 'ATGCGTACGTTAGCTAGCTAGGCTGA')] },
    { id: 'restriction', title: 'Restriction digest', vi: 'Enzyme cắt giới hạn', tool: 'restriction',
      goal: 'Locate EcoRI and BamHI sites in a short synthetic construct.', goalVi: 'Xác định vị trí EcoRI và BamHI trong cấu trúc tổng hợp ngắn.',
      samples: [sample('Demo_digest_linear', 'ATGCCAGAATTCTTTGCGGATCCAAATTTGAATTCCCGTAA'), { ...sample('Demo_digest_circular', 'ATGCCAGAATTCTTTGCGGATCCAAATTTGAATTCCCGTAA'), topology: 'circular' }] },
    { id: 'protein', title: 'Protein properties', vi: 'Đặc tính protein', tool: 'properties',
      goal: 'Compare hydrophobic and charged amino-acid compositions.', goalVi: 'So sánh thành phần amino acid kỵ nước và tích điện.',
      samples: [sample('Demo_protein_hydrophobic', 'MLVAILVAILVAILVAILVAI', 'protein'), sample('Demo_protein_charged', 'MDEKRDEKRDEKRDEKRDEKR', 'protein')] },
];

// Tools and samples opened by each beginner step; teaching copy lives in beginnerSteps.js.
export const LESSONS = [
    { id: 'first', pack: 'translation', title: '1. Read DNA and protein', vi: '1. Đọc DNA và protein', steps: [
        { tool: 'viewer' }, { tool: 'translation' }, { tool: 'translation', sample: 2 },
    ] },
    { id: 'gc', pack: 'composition', title: '2. Count and find patterns', vi: '2. Đếm và tìm đoạn ngắn', steps: [
        { tool: 'statistics' }, { tool: 'statistics', sample: 2 }, { tool: 'motif', sample: 3 },
    ] },
    { id: 'compare', pack: 'alignment', title: '3. Compare sequences', vi: '3. So sánh trình tự', steps: [
        { tool: 'viewer' }, { tool: 'alignment' }, { tool: 'alignment' },
    ] },
];
