// ============================================
// BioGenesis — Central type definitions
// ============================================
//
// The single source of truth for every shape that crosses a layer boundary.
// Core functions consume and return these; the headless tool wrappers
// (AGENT_TASKS.md T6) and any HTTP schema derive from them. Treat a change here
// as a change to a published contract, not an implementation detail.
//
// Conventions:
//   - Coordinates are 0-based, `start` inclusive and `end` exclusive. They are
//     converted to 1-based only at the rendering layer.
//   - Residues are uppercase.
//   - Percentages are 0-100; fractions are 0-1. The field name says which.
//
// This module exports nothing at runtime; it exists for `checkJs`.

/**
 * A biological sequence and its annotations.
 *
 * @typedef {Object} Sequence
 * @property {string} name
 * @property {string} description
 * @property {SequenceType} type
 * @property {'linear'|'circular'} [topology] DNA and RNA only.
 * @property {string} [organism]
 * @property {string} [accession]
 * @property {string} sequence Uppercase residues.
 * @property {Feature[]} [features]
 * @property {Feature[]} [annotations] Written by the auto-annotator.
 */

/**
 * @typedef {'dna'|'rna'|'protein'} SequenceType
 */

/**
 * An annotated region of a sequence.
 *
 * @typedef {Object} Feature
 * @property {string} type `gene`, `CDS`, `promoter`, `misc_feature`,
 *   `rep_origin`, and so on.
 * @property {string} name
 * @property {number} start 0-based, inclusive.
 * @property {number} end 0-based, exclusive.
 * @property {'forward'|'reverse'} direction
 * @property {string} [color] Hex colour.
 */

// ---- Motif search (core/motif.js) ----

/**
 * @typedef {'exact'|'regex'|'iupac'} MotifMode
 */

/**
 * @typedef {'both'|'forward'|'reverse'} StrandSelection
 */

/**
 * One occurrence of a motif.
 *
 * @typedef {Object} MotifMatch
 * @property {number} position 0-based, inclusive start on the forward strand.
 * @property {number} length Length of the match in residues.
 * @property {string} match The matched residues, as read on `strand`.
 * @property {'+'|'-'} strand Forward or reverse-complement.
 * @property {string} forwardSlice The residues the match spans, always read on
 *   the forward strand. Identical to `match` for `+` matches.
 * @property {string} contextBefore Flanking residues before the match, forward strand.
 * @property {string} contextAfter Flanking residues after the match, forward strand.
 */

/**
 * @typedef {Object} MotifSearchResult
 * @property {MotifMatch[]} matches Sorted by ascending `position`.
 * @property {string} pattern The pattern as supplied by the caller.
 * @property {MotifMode} mode
 * @property {StrandSelection} strand
 * @property {number} sequenceLength
 * @property {number} forwardCount
 * @property {number} reverseCount
 */

// ---- Statistics (core/statistics.js) ----

/**
 * Residue counts. Nucleic acids use the fixed `A/T/C/G/U/other` keys; proteins
 * get one key per residue observed.
 *
 * @typedef {{[residue: string]: number}} Composition
 */

/**
 * @typedef {Object} ProteinStats
 * @property {number} pI Isoelectric point.
 * @property {number} gravy Grand average of hydropathy.
 * @property {number} instabilityIndex Above 40 suggests an unstable protein.
 * @property {number} total Residues counted.
 * @property {Array<[string, number]>} residues Residue/count pairs, most frequent first.
 * @property {AaGroupCounts} groups
 */

/**
 * @typedef {Object} AaGroupCounts
 * @property {number} hydrophobic
 * @property {number} polar
 * @property {number} positive
 * @property {number} negative
 * @property {number} special Whatever the other four do not claim.
 */

/**
 * @typedef {Object} CodonUsage
 * @property {{[codon: string]: number}} counts
 * @property {number} total
 * @property {Array<[string, number]>} top Most frequent first.
 */

/**
 * @typedef {Object} GcWindowSeries
 * @property {number} windowSize
 * @property {number} step
 * @property {number} sequenceLength After non-ACGTU characters are removed.
 * @property {Array<{x: number, y: number}>} points `x` is the midpoint in
 *   residues, `y` the GC percentage over that span.
 */

/**
 * Everything the Statistics panel displays, in one object.
 *
 * @typedef {Object} SequenceStats
 * @property {number} length
 * @property {string} type
 * @property {number} molecularWeight Daltons.
 * @property {number|null} gc GC percentage, null for protein.
 * @property {number|null} meltingTemp °C, null for protein.
 * @property {Composition} composition
 * @property {ProteinStats|null} protein
 * @property {Orf[]|null} orfs Null for protein.
 * @property {CodonUsage|null} codonUsage
 * @property {GcWindowSeries|null} gcWindow
 */

/**
 * An open reading frame located by `utils/bioUtils.findORFs`.
 *
 * @typedef {Object} Orf
 * @property {number} frame 1, 2 or 3.
 * @property {number} start 0-based, inclusive.
 * @property {number} end 0-based, exclusive.
 * @property {number} length In nucleotides.
 * @property {string} protein Translation, including the trailing stop.
 */

// ---- Dot plot (core/dotplot.js) ----

/**
 * @typedef {Object} DotPoint
 * @property {number} x 0-based offset into sequence A where the span starts.
 * @property {number} y 0-based offset into sequence B where the span starts.
 * @property {number} matches Identical residues within the compared span.
 * @property {number} identity `matches / windowSize`, in [0, 1].
 */

/**
 * @typedef {Object} DotMatrixDimensions
 * @property {number} lengthA Compared length of A, after truncation.
 * @property {number} lengthB Compared length of B, after truncation.
 * @property {boolean} truncatedA
 * @property {boolean} truncatedB
 * @property {number} windowSize
 * @property {number} threshold Percentage, 0-100.
 * @property {number} thresholdCount Minimum matches a span needs to be plotted.
 * @property {number} stepA Sampling stride along A.
 * @property {number} stepB Sampling stride along B.
 */

/**
 * @typedef {Object} DotMatrix
 * @property {DotPoint[]} points Spans that met the threshold, ordered by x then y.
 * @property {DotMatrixDimensions} dimensions
 */

// ---- Alignment (core/alignment-report.js) ----

/**
 * @typedef {'msa'|'nw'|'sw'} AlignmentAlgorithm
 */

/**
 * The raw result of `utils/alignment.needlemanWunsch` / `smithWaterman`.
 *
 * @typedef {Object} PairwiseAlignment
 * @property {string} aligned1
 * @property {string} aligned2
 * @property {number} score
 * @property {number} identity Percentage over ungapped columns.
 * @property {number} gaps Columns where either row holds a gap.
 * @property {number} [start1] 0-based start of the local hit in seq1, `sw` only.
 * @property {number} [start2] 0-based start of the local hit in seq2, `sw` only.
 */

/**
 * A pairwise alignment as the core layer publishes it.
 *
 * @typedef {Object} AlignmentResult
 * @property {string} alignedA Sequence A with gaps inserted.
 * @property {string} alignedB Sequence B with gaps inserted.
 * @property {number} score
 * @property {number} identity Percentage over ungapped columns.
 * @property {number} gaps
 * @property {string} matchLine `|` where the rows agree, a space otherwise.
 * @property {number} length Aligned length, in columns.
 * @property {'nw'|'sw'} algorithm
 * @property {number|null} startA 0-based start of the local hit in A, `sw` only.
 * @property {number|null} startB 0-based start of the local hit in B, `sw` only.
 */

/**
 * @typedef {Object} AlignmentRow
 * @property {string} name
 * @property {string} aligned
 */

/**
 * @typedef {Object} AlignmentReport
 * @property {AlignmentAlgorithm} algorithm
 * @property {boolean} isProtein
 * @property {AlignmentRow[]} rows
 * @property {string} consensus
 * @property {number[]} conservation Per column, in [0, 1].
 * @property {number} length Aligned length, in columns.
 * @property {AlignmentResult|null} pairwise Present for `nw` and `sw`.
 */

// ---- Phylogenetics (core/phylo-report.js) ----

/**
 * @typedef {Object} TreeNode
 * @property {string} name Empty for internal nodes.
 * @property {number} [length] Branch length to the parent.
 * @property {TreeNode[]} [children] Absent on leaves.
 */

/**
 * @typedef {Object} TreeReport
 * @property {TreeNode} tree Root of the inferred tree.
 * @property {string} newick Newick serialisation, terminated with `;`.
 * @property {number[][]} distanceMatrix Symmetric, zero diagonal.
 * @property {string[]} names Taxon labels, in input order.
 * @property {'nj'|'upgma'} algorithm
 */

// ---- Restriction analysis (core/restriction-report.js) ----

/**
 * An enzyme definition from `utils/restriction.RESTRICTION_ENZYMES_UNIQUE`.
 *
 * @typedef {Object} Enzyme
 * @property {string} name
 * @property {string} site Recognition sequence, possibly with IUPAC codes.
 * @property {number} cut Offset of the cut on the top strand.
 * @property {number} cutComplement Offset of the cut on the bottom strand.
 * @property {'5prime'|'3prime'|'blunt'} overhang
 * @property {string} group `common`, `4cutter`, `rare`, `golden`, `methylation`.
 */

/**
 * An enzyme together with where it cuts a particular sequence.
 *
 * @typedef {Enzyme & {positions: number[], numCuts: number}} RestrictionSite
 */

/**
 * @typedef {Object} CutMark
 * @property {number} position 0-based cut site start.
 * @property {string} enzyme
 * @property {'5prime'|'3prime'|'blunt'} overhang
 */

/**
 * @typedef {Object} SurveySummary
 * @property {number} cutterCount Enzymes with at least one site.
 * @property {number} uniqueCutterCount Enzymes cutting exactly once.
 * @property {number} totalCuts Sum of all occurrences.
 * @property {number} nonCutterCount Enzymes in the panel with no site.
 * @property {number} panelSize Enzymes considered.
 * @property {{[group: string]: number}} groups Cutters per enzyme group.
 */

/**
 * @typedef {Object} SiteSurvey
 * @property {RestrictionSite[]} sites Sorted by enzyme name.
 * @property {SurveySummary} summary
 * @property {CutMark[]} cutMap Every cut, ascending by position.
 * @property {number} sequenceLength
 */

/**
 * One product of a simulated digest.
 *
 * @typedef {Object} Fragment
 * @property {number} start 0-based, inclusive.
 * @property {number} end 0-based, exclusive.
 * @property {number} size
 * @property {string} sequence
 */

/**
 * @typedef {Object} DigestEnzymeSummary
 * @property {string[]} requested Names as supplied.
 * @property {string[]} matched Requested names that cut.
 * @property {string[]} unmatched Requested names that do not cut.
 * @property {number} totalCuts
 * @property {number} fragmentCount
 */

/**
 * @typedef {Object} DigestReport
 * @property {RestrictionSite[]} sites Sites of the selected enzymes only.
 * @property {Fragment[]} fragments Largest first; sizes sum to the sequence length.
 * @property {DigestEnzymeSummary} enzymeSummary
 * @property {number} sequenceLength
 */

// ---- Primer design (core/primer.js) ----

/**
 * @typedef {Object} Primer
 * @property {string} sequence 5'->3' as ordered; reverse primers are already
 *   reverse-complemented.
 * @property {number} start 0-based, inclusive, on the forward strand.
 * @property {number} end 0-based, exclusive, on the forward strand.
 * @property {number} tm Nearest-neighbour melting temperature, °C.
 * @property {number} gc GC content, percent.
 * @property {'fwd'|'rev'} [direction]
 * @property {boolean} hairpin Whether a self-complementary stem was detected.
 */

/**
 * @typedef {Object} PrimerPair
 * @property {Primer} fwd
 * @property {Primer} rev
 * @property {number} score Lower is better: Tm difference plus a GC penalty.
 * @property {boolean} heterodimer Simplified self-complementarity check.
 */

/**
 * @typedef {Object} PrimerDesignResult
 * @property {PrimerPair[]} pairs Best score first.
 * @property {{forward: Primer[], reverse: Primer[]}} candidates The pools the
 *   pairs were drawn from.
 */

// ---- Codon usage (core/codon.js) ----

/**
 * @typedef {Object} CodonEntry
 * @property {string} codon
 * @property {string} aa One-letter residue, `*` for stop.
 * @property {number} organismFreq Frequency per 1000 in the target organism.
 * @property {number} count Occurrences in the analysed sequence.
 * @property {number} sequenceFreq Occurrences per 1000 codons of the sequence.
 * @property {number} maxSynonymFreq Highest organism frequency among synonyms.
 * @property {boolean} isOptimal Whether this is the organism's preferred codon.
 * @property {number} relativeAdaptiveness `organismFreq / maxSynonymFreq`.
 */

/**
 * @typedef {Object} CodonUsageReport
 * @property {{key: string, name: string, table: {[codon: string]: number}}} organism
 * @property {{[codon: string]: number}} counts Codons seen, excluding any with N.
 * @property {number} totalCodons
 * @property {number} cai Codon adaptation index, count-weighted.
 * @property {Array<{aa: string, codons: CodonEntry[]}>} usage One group per
 *   residue, sorted by residue, stops excluded.
 * @property {CodonEntry[]} rareCodons Worst relative adaptiveness first.
 */

/**
 * @typedef {Object} CodonOptimisation
 * @property {string} optimised The rewritten coding sequence.
 * @property {string} protein The protein both sequences encode.
 * @property {number} changedCodons
 * @property {number} cai CAI of the optimised sequence.
 * @property {number} originalCai CAI of the input sequence.
 */

// ---- Six-frame translation (core/translation.js) ----

/**
 * An ORF found inside one translated reading frame.
 *
 * @typedef {Object} FrameOrf
 * @property {string} frame Frame label, e.g. `+1` or `-2`.
 * @property {'forward'|'reverse'} direction
 * @property {number} start 0-based index of the initiator M in the frame's protein.
 * @property {number} end 0-based index of the stop codon in the frame's protein.
 * @property {number} length Residues between the M and the stop, excluding both.
 * @property {string} protein The ORF including its trailing stop character.
 */

/**
 * @typedef {Object} Frame
 * @property {string} label `+1`..`+3` or `-1`..`-3`.
 * @property {number} frame Offset 0, 1 or 2 within its strand.
 * @property {'forward'|'reverse'} direction
 * @property {string} protein Translated residues, `*` for stops, `X` for unknown.
 * @property {FrameOrf[]} orfs ORFs in this frame, in positional order.
 */

/**
 * @typedef {Object} SixFrameResult
 * @property {Frame[]} frames Three forward frames, then three reverse.
 * @property {FrameOrf[]} orfs Every ORF across all frames, longest first.
 * @property {string} dna Forward strand actually translated, after truncation.
 * @property {string} rcDna Reverse complement actually translated.
 * @property {number} sequenceLength Full input length, before truncation.
 * @property {boolean} truncated Whether the input exceeded the length cap.
 */

// ---- Sliding-window properties (core/properties.js) ----

/**
 * @typedef {Object} PropertySeries
 * @property {string} metric
 * @property {string} label Axis label.
 * @property {string} unit
 * @property {number[]} values One value per window start, left-aligned: index
 *   `i` covers residues `[i, i + windowSize)`.
 * @property {number} windowSize
 * @property {Object} stats Whole-sequence figures for this metric; the shape
 *   varies per metric and is empty for metrics that report none.
 */

/**
 * @typedef {Object} SlidingPropertyResult
 * @property {{[metric: string]: PropertySeries}} series
 * @property {number} windowSize
 * @property {number} sequenceLength
 */

// ---- Parsing (utils/bioUtils.js) ----

/**
 * A record produced by `parseFasta`.
 *
 * @typedef {Object} FastaRecord
 * @property {string} name
 * @property {string} description
 * @property {string} sequence
 * @property {SequenceType|'unknown'} type
 */

/**
 * A feature as `parseGenBank` reports it, before it is normalised into a
 * {@link Feature}.
 *
 * @typedef {Object} GenBankFeature
 * @property {string} type
 * @property {number} start 0-based, inclusive.
 * @property {number} end 0-based, exclusive.
 * @property {boolean} complement
 * @property {{[qualifier: string]: string}} qualifiers
 */

/**
 * A record produced by `parseGenBank`.
 *
 * @typedef {Object} GenBankRecord
 * @property {string} name
 * @property {string} description
 * @property {string} sequence Uppercase residues.
 * @property {SequenceType|'unknown'} type
 * @property {GenBankFeature[]} features
 * @property {'genbank'} format
 */

export {};
