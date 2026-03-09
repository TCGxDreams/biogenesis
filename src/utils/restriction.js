// ============================================
// BioGenesis — Restriction Enzyme Database (v2 — 100+ enzymes)
// ============================================

export const RESTRICTION_ENZYMES = [
    // === 6-CUTTER COMMON (cloning workhorses) ===
    { name: 'EcoRI', site: 'GAATTC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BamHI', site: 'GGATCC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'HindIII', site: 'AAGCTT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'XhoI', site: 'CTCGAG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'NdeI', site: 'CATATG', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'XbaI', site: 'TCTAGA', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'SalI', site: 'GTCGAC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'PstI', site: 'CTGCAG', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'SphI', site: 'GCATGC', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'KpnI', site: 'GGTACC', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'NotI', site: 'GCGGCCGC', cut: 2, cutComplement: 6, overhang: '5prime', group: 'common' },
    { name: 'SmaI', site: 'CCCGGG', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'EcoRV', site: 'GATATC', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'StuI', site: 'AGGCCT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'NcoI', site: 'CCATGG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BglII', site: 'AGATCT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'ClaI', site: 'ATCGAT', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'ApaI', site: 'GGGCCC', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'SacI', site: 'GAGCTC', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'SacII', site: 'CCGCGG', cut: 4, cutComplement: 2, overhang: '3prime', group: 'common' },
    { name: 'NheI', site: 'GCTAGC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'MluI', site: 'ACGCGT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AvrII', site: 'CCTAGG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'ScaI', site: 'AGTACT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'BsaI', site: 'GGTCTC', cut: 7, cutComplement: 11, overhang: '5prime', group: 'common' },
    { name: 'AgeI', site: 'ACCGGT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AflII', site: 'CTTAAG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'SpeI', site: 'ACTAGT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'PvuI', site: 'CGATCG', cut: 4, cutComplement: 2, overhang: '3prime', group: 'common' },
    { name: 'PvuII', site: 'CAGCTG', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },

    // === 4-CUTTERS (frequent cutters) ===
    { name: 'MboI', site: 'GATC', cut: 0, cutComplement: 4, overhang: '5prime', group: '4cutter' },
    { name: 'Sau3AI', site: 'GATC', cut: 0, cutComplement: 4, overhang: '5prime', group: '4cutter' },
    { name: 'MspI', site: 'CCGG', cut: 1, cutComplement: 3, overhang: '5prime', group: '4cutter' },
    { name: 'HpaII', site: 'CCGG', cut: 1, cutComplement: 3, overhang: '5prime', group: '4cutter' },
    { name: 'TaqI', site: 'TCGA', cut: 1, cutComplement: 3, overhang: '5prime', group: '4cutter' },
    { name: 'AluI', site: 'AGCT', cut: 2, cutComplement: 2, overhang: 'blunt', group: '4cutter' },
    { name: 'HaeIII', site: 'GGCC', cut: 2, cutComplement: 2, overhang: 'blunt', group: '4cutter' },
    { name: 'RsaI', site: 'GTAC', cut: 2, cutComplement: 2, overhang: 'blunt', group: '4cutter' },
    { name: 'CfoI', site: 'GCGC', cut: 3, cutComplement: 1, overhang: '3prime', group: '4cutter' },
    { name: 'HinfI', site: 'GANTC', cut: 1, cutComplement: 4, overhang: '5prime', group: '4cutter' },
    { name: 'MaeI', site: 'CTAG', cut: 1, cutComplement: 3, overhang: '5prime', group: '4cutter' },
    { name: 'DpnI', site: 'GATC', cut: 2, cutComplement: 2, overhang: 'blunt', group: '4cutter' },
    { name: 'HpaI', site: 'GTTAAC', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'NlaIII', site: 'CATG', cut: 4, cutComplement: 0, overhang: '3prime', group: '4cutter' },

    // === RARE CUTTERS (8-base) ===
    { name: 'PacI', site: 'TTAATTAA', cut: 3, cutComplement: 5, overhang: '3prime', group: 'rare' },
    { name: 'SwaI', site: 'ATTTAAAT', cut: 4, cutComplement: 4, overhang: 'blunt', group: 'rare' },
    { name: 'SfiI', site: 'GGCCNNNNNGGCC', cut: 8, cutComplement: 4, overhang: '3prime', group: 'rare' },
    { name: 'AscI', site: 'GGCGCGCC', cut: 2, cutComplement: 6, overhang: '5prime', group: 'rare' },
    { name: 'FseI', site: 'GGCCGGCC', cut: 6, cutComplement: 2, overhang: '3prime', group: 'rare' },
    { name: 'SrfI', site: 'GCCCGGGC', cut: 4, cutComplement: 4, overhang: 'blunt', group: 'rare' },
    { name: 'PmeI', site: 'GTTTAAAC', cut: 4, cutComplement: 4, overhang: 'blunt', group: 'rare' },
    { name: 'SgfI', site: 'GCGATCGC', cut: 5, cutComplement: 3, overhang: '3prime', group: 'rare' },

    // === METHYLATION-SENSITIVE ===
    { name: 'McrBC', site: 'RGNNNNNNNNNNNNNNNNNNNNNNNNNHGY', cut: 15, cutComplement: 9, overhang: '5prime', group: 'methylation' },
    { name: 'SssI', site: 'CCGG', cut: 1, cutComplement: 3, overhang: '5prime', group: 'methylation' },

    // === GOLDEN GATE / SYNTHETIC ===
    { name: 'BbsI', site: 'GAAGAC', cut: 8, cutComplement: 12, overhang: '5prime', group: 'golden' },
    { name: 'BtgZI', site: 'GCGATG', cut: 10, cutComplement: 14, overhang: '5prime', group: 'golden' },
    { name: 'BsmBI', site: 'CGTCTC', cut: 7, cutComplement: 11, overhang: '5prime', group: 'golden' },
    { name: 'SapI', site: 'GCTCTTC', cut: 8, cutComplement: 11, overhang: '5prime', group: 'golden' },
    { name: 'LguI', site: 'GCTCTTC', cut: 8, cutComplement: 11, overhang: '5prime', group: 'golden' },

    // === MORE 6-CUTTERS ===
    { name: 'AccI', site: 'GTYRAC', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'AclI', site: 'AACGTT', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'AfeI', site: 'AGCGCT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'AflIII', site: 'ACRYGT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AgeI', site: 'ACCGGT', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AhdI', site: 'GACNNNNNGTC', cut: 6, cutComplement: 5, overhang: 'blunt', group: 'common' },
    { name: 'AloI', site: 'GAACNNNNNNTCC', cut: 12, cutComplement: 9, overhang: '5prime', group: 'common' },
    { name: 'ApaLI', site: 'GTGCAC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AseI', site: 'ATTAAT', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'AsiSI', site: 'GCGATCGC', cut: 5, cutComplement: 3, overhang: '3prime', group: 'common' },
    { name: 'AvaI', site: 'CYCGRG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'AvaII', site: 'GGWCC', cut: 1, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'AviII', site: 'TGCGCA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'BclI', site: 'TGATCA', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BglI', site: 'GCCNNNNNGGC', cut: 7, cutComplement: 4, overhang: '3prime', group: 'common' },
    { name: 'BlpI', site: 'GCTNAGC', cut: 2, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BmgBI', site: 'CACGTC', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'BseYI', site: 'CCCAGC', cut: -5, cutComplement: -1, overhang: '5prime', group: 'common' },
    { name: 'BseRI', site: 'GAGGAG', cut: 10, cutComplement: 14, overhang: '5prime', group: 'common' },
    { name: 'BsgI', site: 'GTGCAG', cut: 16, cutComplement: 14, overhang: '3prime', group: 'common' },
    { name: 'BsiEI', site: 'CGRYCG', cut: 4, cutComplement: 2, overhang: '3prime', group: 'common' },
    { name: 'BsiWI', site: 'CGTACG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BsmI', site: 'GAATGC', cut: 7, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BspEI', site: 'TCCGGA', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BspHI', site: 'TCATGA', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BsrGI', site: 'TGTACA', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BssHII', site: 'GCGCGC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'BstAPI', site: 'GCANNNNNTGC', cut: 7, cutComplement: 4, overhang: '3prime', group: 'common' },
    { name: 'BstBI', site: 'TTCGAA', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'BstEII', site: 'GGTNACC', cut: 1, cutComplement: 6, overhang: '5prime', group: 'common' },
    { name: 'BstUI', site: 'CGCG', cut: 2, cutComplement: 2, overhang: 'blunt', group: 'common' },
    { name: 'BstXI', site: 'CCANNNNNTGG', cut: 8, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'DraI', site: 'TTTAAA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'DrdI', site: 'GACNNNNNNGTC', cut: 7, cutComplement: 6, overhang: 'blunt', group: 'common' },
    { name: 'EarI', site: 'CTCTTC', cut: 7, cutComplement: 10, overhang: '5prime', group: 'common' },
    { name: 'EciI', site: 'GGCGGA', cut: 11, cutComplement: 15, overhang: '5prime', group: 'common' },
    { name: 'Eco47III', site: 'AGCGCT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'EcoNI', site: 'CCTNNNNNNNAGG', cut: 5, cutComplement: 8, overhang: '5prime', group: 'common' },
    { name: 'EcoO109I', site: 'RGGNCCY', cut: 2, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'EcoRI', site: 'GAATTC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'FspI', site: 'TGCGCA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'MfeI', site: 'CAATTG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'MscI', site: 'TGGCCA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'MspA1I', site: 'CMGCKG', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'MunI', site: 'CAATTG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'NaeI', site: 'GCCGGC', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'NarI', site: 'GGCGCC', cut: 2, cutComplement: 4, overhang: '5prime', group: 'common' },
    { name: 'NgoMIV', site: 'GCCGGC', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'NsiI', site: 'ATGCAT', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'NspI', site: 'RCATGY', cut: 5, cutComplement: 1, overhang: '3prime', group: 'common' },
    { name: 'PflMI', site: 'CCANNNNNTGG', cut: 7, cutComplement: 4, overhang: '3prime', group: 'common' },
    { name: 'PmlI', site: 'CACGTG', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'PsiI', site: 'TTATAA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'RsrII', site: 'CGGWCCG', cut: 2, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'SbfI', site: 'CCTGCAGG', cut: 6, cutComplement: 2, overhang: '3prime', group: 'common' },
    { name: 'SciI', site: 'CTCGAG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'SexAI', site: 'ACCWGGT', cut: 1, cutComplement: 6, overhang: '5prime', group: 'common' },
    { name: 'SfaNI', site: 'GCATGNNNNN', cut: 10, cutComplement: 8, overhang: '3prime', group: 'common' },
    { name: 'SgrAI', site: 'CRCCGGYG', cut: 2, cutComplement: 6, overhang: '5prime', group: 'common' },
    { name: 'SmlI', site: 'CTYRAG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'SnaBI', site: 'TACGTA', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'SrfI', site: 'GCCCGGGC', cut: 4, cutComplement: 4, overhang: 'blunt', group: 'common' },
    { name: 'SspI', site: 'AATATT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'StuI', site: 'AGGCCT', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
    { name: 'SwaI', site: 'ATTTAAAT', cut: 4, cutComplement: 4, overhang: 'blunt', group: 'rare' },
    { name: 'XmaI', site: 'CCCGGG', cut: 1, cutComplement: 5, overhang: '5prime', group: 'common' },
    { name: 'XmnI', site: 'GAANNNNTTC', cut: 5, cutComplement: 5, overhang: 'blunt', group: 'common' },
    { name: 'ZraI', site: 'GACGTC', cut: 3, cutComplement: 3, overhang: 'blunt', group: 'common' },
];

// Deduplicate by name+site
const seen = new Set();
export const RESTRICTION_ENZYMES_UNIQUE = RESTRICTION_ENZYMES.filter(e => {
    const key = `${e.name}_${e.site}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
}).sort((a, b) => a.name.localeCompare(b.name));

// Find restriction sites in a sequence
export function findRestrictionSites(sequence, enzymes = RESTRICTION_ENZYMES_UNIQUE) {
    const upper = sequence.toUpperCase();
    const results = [];

    for (const enzyme of enzymes) {
        // Handle degenerate bases in recognition site
        const pattern = enzyme.site.toUpperCase()
            .replace(/N/g, '[ACGT]')
            .replace(/R/g, '[AG]')
            .replace(/Y/g, '[CT]')
            .replace(/W/g, '[AT]')
            .replace(/S/g, '[GC]')
            .replace(/K/g, '[GT]')
            .replace(/M/g, '[AC]')
            .replace(/B/g, '[CGT]')
            .replace(/D/g, '[AGT]')
            .replace(/H/g, '[ACT]')
            .replace(/V/g, '[ACG]');

        const sites = [];
        try {
            const re = new RegExp(pattern, 'g');
            let m;
            while ((m = re.exec(upper)) !== null) {
                sites.push(m.index);
                re.lastIndex = m.index + 1;
            }
        } catch (_) { continue; }

        if (sites.length > 0) {
            results.push({
                ...enzyme,
                positions: sites,
                numCuts: sites.length
            });
        }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
}

// Simulate restriction digest — returns fragment sizes
export function simulateDigest(sequence, enzymes) {
    const seqLen = sequence.length;
    const cutPositions = new Set([0, seqLen]);

    for (const enzyme of enzymes) {
        if (enzyme.positions) {
            for (const pos of enzyme.positions) {
                cutPositions.add(pos + Math.min(enzyme.cut, enzyme.site.length));
            }
        }
    }

    const sorted = [...cutPositions].sort((a, b) => a - b);
    const fragments = [];

    for (let i = 0; i < sorted.length - 1; i++) {
        const size = sorted[i + 1] - sorted[i];
        if (size > 0) {
            fragments.push({
                start: sorted[i],
                end: sorted[i + 1],
                size,
                sequence: sequence.substring(sorted[i], sorted[i + 1])
            });
        }
    }

    return fragments.sort((a, b) => b.size - a.size);
}

// Render virtual gel electrophoresis (improved)
export function renderGelSVG(fragments, seqLength, width = 180, height = 380) {
    const margin = { top: 45, bottom: 15 };
    const plotHeight = height - margin.top - margin.bottom;
    const maxSize = seqLength;
    const minSize = Math.max(Math.min(...fragments.map(f => f.size), 50), 10);
    const logMax = Math.log10(maxSize);
    const logMin = Math.log10(minSize);

    const yPos = size => {
        const logS = Math.log10(Math.max(size, 1));
        return margin.top + ((logMax - logS) / Math.max(logMax - logMin, 1)) * plotHeight;
    };

    const markers = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250, 100]
        .filter(s => s <= maxSize * 2 && s >= minSize * 0.5);

    let svg = `<svg width="${width}" height="${height}" style="background:#0a0e18;border-radius:8px;border:1px solid #1e3055;">`;

    // Gel lane background
    svg += `<rect x="8" y="34" width="${width - 16}" height="${height - 40}" fill="#070c14" rx="3"/>`;

    // Column headers
    svg += `<text x="${width * 0.28}" y="18" text-anchor="middle" fill="#4d6a96" font-size="9" font-family="monospace">LADDER</text>`;
    svg += `<text x="${width * 0.72}" y="18" text-anchor="middle" fill="#4d6a96" font-size="9" font-family="monospace">DIGEST</text>`;

    // Wells
    svg += `<rect x="${width * 0.28 - 18}" y="32" width="36" height="5" fill="#162040" rx="1"/>`;
    svg += `<rect x="${width * 0.72 - 18}" y="32" width="36" height="5" fill="#162040" rx="1"/>`;

    // Lane divider
    svg += `<line x1="${width / 2}" y1="34" x2="${width / 2}" y2="${height - 8}" stroke="#111d33" stroke-width="1"/>`;

    // Marker bands
    for (const m of markers) {
        const y = yPos(m);
        if (y < margin.top || y > height - margin.bottom) continue;
        svg += `<rect x="${width * 0.28 - 16}" y="${y - 1}" width="32" height="2.5" fill="rgba(0,229,255,0.35)" rx="1"/>`;
        svg += `<text x="6" y="${y + 3}" fill="#3a5070" font-size="7.5" font-family="monospace">${m >= 1000 ? (m / 1000) + 'k' : m}</text>`;
    }

    // Sample bands
    for (const b of fragments) {
        const y = yPos(b.size);
        if (y < margin.top || y > height - margin.bottom) continue;
        const brightness = Math.min(0.9, 0.2 + b.size / maxSize * 0.8);
        svg += `<rect x="${width * 0.72 - 18}" y="${y - 1.5}" width="36" height="3" fill="rgba(63,185,80,${brightness})" rx="1">
      <title>${b.size} bp</title>
    </rect>`;
        if (fragments.length <= 12) {
            svg += `<text x="${width - 6}" y="${y + 3}" fill="#3a5070" font-size="7.5" font-family="monospace" text-anchor="end">${b.size}</text>`;
        }
    }

    svg += '</svg>';
    return svg;
}
