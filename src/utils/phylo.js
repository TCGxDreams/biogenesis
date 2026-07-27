// ============================================
// BioGenesis — Phylogenetic Tree Utilities
// ============================================

import { needlemanWunsch } from './alignment.js';

/**
 * @typedef {import('../core/types.js').TreeNode} TreeNode
 */

/**
 * A tree node after `renderTreeSVG` has stashed its screen coordinates on it.
 *
 * @typedef {TreeNode & {_x?: number, _y?: number}} LaidOutNode
 */

// Calculate distance matrix from sequences
/**
 * Pairwise distance matrix from global alignments, where distance is
 * `1 - identity`.
 *
 * @param {string[]} sequences
 * @param {string[]} [names] Defaults to `Seq1`, `Seq2`, ...
 * @returns {{matrix: number[][], names: string[]}} Symmetric, zero diagonal.
 */
export function calculateDistanceMatrix(sequences, names) {
    const n = sequences.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const aln = needlemanWunsch(sequences[i], sequences[j]);
            const distance = 1 - (aln.identity / 100);
            matrix[i][j] = distance;
            matrix[j][i] = distance;
        }
    }

    return { matrix, names: names || sequences.map((_, i) => `Seq${i + 1}`) };
}

// Neighbor-Joining algorithm
/**
 * Neighbour-joining tree construction. Branch lengths are clamped at 0.
 *
 * @param {number[][]} distMatrix Symmetric, zero diagonal.
 * @param {string[]} names Taxon labels, matching the matrix order.
 * @returns {import('../core/types.js').TreeNode} Root node; a bare leaf for one taxon.
 */
export function neighborJoining(distMatrix, names) {
    const n = names.length;
    if (n < 2) return { name: names[0] || 'root', length: 0 };
    if (n === 2) {
        return {
            name: '',
            children: [
                { name: names[0], length: distMatrix[0][1] / 2 },
                { name: names[1], length: distMatrix[0][1] / 2 }
            ]
        };
    }

    // Working copies
    let d = distMatrix.map(row => [...row]);
    /** @type {import('../core/types.js').TreeNode[]} */
    let nodes = names.map(name => ({ name, length: 0 }));

    while (nodes.length > 2) {
        const size = nodes.length;

        // Calculate r values
        const r = new Array(size).fill(0);
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                r[i] += d[i][j];
            }
        }

        // Find minimum Q value
        let minQ = Infinity, minI = 0, minJ = 1;
        for (let i = 0; i < size; i++) {
            for (let j = i + 1; j < size; j++) {
                const q = (size - 2) * d[i][j] - r[i] - r[j];
                if (q < minQ) {
                    minQ = q;
                    minI = i;
                    minJ = j;
                }
            }
        }

        // Calculate branch lengths
        const branchI = d[minI][minJ] / 2 + (r[minI] - r[minJ]) / (2 * (size - 2));
        const branchJ = d[minI][minJ] - branchI;

        // Create new node
        /** @type {import('../core/types.js').TreeNode} */
        const newNode = {
            name: '',
            children: [
                { ...nodes[minI], length: Math.max(0, branchI) },
                { ...nodes[minJ], length: Math.max(0, branchJ) }
            ]
        };

        // Calculate new distances
        const newDist = [];
        const keep = [];
        for (let k = 0; k < size; k++) {
            if (k !== minI && k !== minJ) {
                keep.push(k);
                newDist.push((d[k][minI] + d[k][minJ] - d[minI][minJ]) / 2);
            }
        }

        // Build new distance matrix
        const newSize = keep.length + 1;
        const newD = Array.from({ length: newSize }, () => new Array(newSize).fill(0));

        for (let i = 0; i < keep.length; i++) {
            for (let j = i + 1; j < keep.length; j++) {
                newD[i][j] = d[keep[i]][keep[j]];
                newD[j][i] = d[keep[i]][keep[j]];
            }
            newD[i][keep.length] = newDist[i];
            newD[keep.length][i] = newDist[i];
        }

        // Update arrays
        const newNodes = keep.map(k => nodes[k]);
        newNodes.push(newNode);

        d = newD;
        nodes = newNodes;
    }

    // Final join
    return {
        name: '',
        children: [
            { ...nodes[0], length: d[0][1] / 2 },
            { ...nodes[1], length: d[0][1] / 2 }
        ]
    };
}

// Parse Newick format
/**
 * Parse a Newick string into a tree. A missing branch length becomes 0.
 *
 * @param {string} str
 * @returns {import('../core/types.js').TreeNode}
 */
export function parseNewick(str) {
    let i = 0;

    /** @returns {TreeNode} */
    function parseNode() {
        /** @type {TreeNode & {children: TreeNode[]}} */
        const node = { name: '', children: [], length: 0 };

        if (str[i] === '(') {
            i++; // skip (
            node.children.push(parseNode());
            while (str[i] === ',') {
                i++;
                node.children.push(parseNode());
            }
            i++; // skip )
        }

        // Parse name
        let name = '';
        while (i < str.length && str[i] !== ':' && str[i] !== ',' && str[i] !== ')' && str[i] !== ';') {
            name += str[i];
            i++;
        }
        node.name = name.trim();

        // Parse length
        if (str[i] === ':') {
            i++;
            let len = '';
            while (i < str.length && str[i] !== ',' && str[i] !== ')' && str[i] !== ';') {
                len += str[i];
                i++;
            }
            node.length = parseFloat(len) || 0;
        }

        return node;
    }

    const tree = parseNode();
    return tree;
}

// Convert tree to Newick format
/**
 * Serialise a tree to Newick, with branch lengths to four decimals. No trailing
 * semicolon is added.
 *
 * @param {import('../core/types.js').TreeNode} node
 * @returns {string}
 */
export function toNewick(node) {
    if (!node.children || node.children.length === 0) {
        return node.name + (node.length ? ':' + Math.max(0.0001, node.length).toFixed(4) : '');
    }
    const children = node.children.map(c => toNewick(c)).join(',');
    return '(' + children + ')' + node.name + (node.length ? ':' + Math.max(0.0001, node.length).toFixed(4) : '');
}

// UPGMA Algorithm
/**
 * UPGMA (average linkage) tree construction, which produces an ultrametric tree.
 *
 * @param {number[][]} distMatrix Symmetric, zero diagonal.
 * @param {string[]} names Taxon labels, matching the matrix order.
 * @returns {import('../core/types.js').TreeNode} Root node.
 */
export function upgma(distMatrix, names) {
    /** @type {Array<{name: string, size: number, node: import('../core/types.js').TreeNode, height?: number, id?: number}>} */
    let clusters = names.map((name, i) => ({ name, size: 1, node: { name, length: 0 }, id: i }));
    let d = distMatrix.map(row => [...row]);

    while (clusters.length > 2) {
        let minD = Infinity, minI = 0, minJ = 1;
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                if (d[i][j] < minD) {
                    minD = d[i][j];
                    minI = i;
                    minJ = j;
                }
            }
        }

        const c1 = clusters[minI];
        const c2 = clusters[minJ];
        const branchLen = minD / 2;

        /** @type {import('../core/types.js').TreeNode & {height: number}} */
        const newNode = {
            name: '',
            children: [
                { ...c1.node, length: Math.max(0, branchLen - (c1.height || 0)) },
                { ...c2.node, length: Math.max(0, branchLen - (c2.height || 0)) }
            ],
            height: branchLen
        };

        const newD = [];
        const newClusters = [];

        for (let k = 0; k < clusters.length; k++) {
            if (k !== minI && k !== minJ) {
                newClusters.push(clusters[k]);
                const distToNew = (d[k][minI] * c1.size + d[k][minJ] * c2.size) / (c1.size + c2.size);
                newD.push(distToNew);
            }
        }

        const nextD = Array.from({ length: newClusters.length + 1 }, () => new Array(newClusters.length + 1).fill(0));
        for (let i = 0; i < newClusters.length; i++) {
            for (let j = 0; j < newClusters.length; j++) {
                nextD[i][j] = d[clusters.indexOf(newClusters[i])][clusters.indexOf(newClusters[j])];
            }
            nextD[i][newClusters.length] = newD[i];
            nextD[newClusters.length][i] = newD[i];
        }

        d = nextD;
        clusters = newClusters;
        clusters.push({ name: '', size: c1.size + c2.size, node: newNode, height: branchLen });
    }

    if (clusters.length === 2) {
        const branchLen = d[0][1] / 2;
        return {
            name: '',
            children: [
                { ...clusters[0].node, length: Math.max(0, branchLen - (clusters[0].height || 0)) },
                { ...clusters[1].node, length: Math.max(0, branchLen - (clusters[1].height || 0)) }
            ]
        };
    }
    return clusters[0].node;
}

// Render phylogenetic tree as SVG
/**
 * Draw a rectangular cladogram with a scale bar. Leaf labels are HTML-escaped.
 *
 * @param {import('../core/types.js').TreeNode} tree
 * @param {number} [width=700]
 * @param {number} [height=400]
 * @returns {string} SVG markup.
 */
export function renderTreeSVG(tree, width = 700, height = 400) {
    const leaves = getLeafNodes(tree);
    const numLeaves = leaves.length;
    if (numLeaves === 0) return '<svg></svg>';

    const margin = { top: 40, right: 180, bottom: 50, left: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const maxDepth = getMaxDepth(tree);
    const xScale = maxDepth > 0 ? plotWidth / maxDepth : plotWidth;
    const yStep = plotHeight / Math.max(numLeaves - 1, 1);

    let leafIndex = 0;
    /** @type {string[]} */
    const paths = [];
    /** @type {string[]} */
    const labels = [];
    /** @type {string[]} */
    const dots = [];

    // Colors derived from BioGenesis premium theme
    const strokeColor = "var(--accent-cyan)";
    const labelColor = "var(--text-primary)";
    const nodeColor = "var(--bg-primary)";

    /**
     * @param {LaidOutNode} node
     * @param {number} [x=0] Cumulative branch length from the root.
     * @returns {number} The node's y coordinate.
     */
    function layout(node, x = 0) {
        if (!node.children || node.children.length === 0) {
            const y = margin.top + leafIndex * yStep;
            leafIndex++;
            node._x = margin.left + x * xScale;
            node._y = y;

            labels.push(`<text x="${node._x + 12}" y="${node._y + 4}" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="${labelColor}">${escapeHtml(node.name)}</text>`);
            dots.push(`<circle cx="${node._x}" cy="${node._y}" r="4" fill="${strokeColor}" stroke="${nodeColor}" stroke-width="2"/>`);
            return y;
        }

        const childYs = node.children.map(
            (/** @type {LaidOutNode} */ child) => layout(child, x + (child.length || 0.05))
        );
        const minY = Math.min(...childYs);
        const maxY = Math.max(...childYs);
        const midY = (minY + maxY) / 2;

        node._x = margin.left + x * xScale;
        node._y = midY;

        // Draw vertical spine
        paths.push(`<path d="M${node._x},${minY} V${maxY}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);

        // Draw horizontal branches to children
        for (const child of /** @type {LaidOutNode[]} */ (node.children)) {
            paths.push(`<path d="M${node._x},${child._y} H${child._x}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>`);
        }

        dots.push(`<circle cx="${node._x}" cy="${node._y}" r="3" fill="${nodeColor}" stroke="${strokeColor}" stroke-width="1.5"/>`);
        return midY;
    }

    layout(tree);

    // Beautiful Scale bar
    const scaleLen = maxDepth > 0 ? Number.parseFloat((maxDepth * 0.2).toPrecision(1)) : 0.1;
    const scaleX = margin.left;
    const scaleY = height - 20;
    const scalePx = scaleLen * xScale;

    // Draw scale block
    const scaleBar = `
        <g transform="translate(${scaleX}, ${scaleY})">
            <line x1="0" y1="0" x2="${scalePx}" y2="0" stroke="var(--text-muted)" stroke-width="2"/>
            <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--text-muted)" stroke-width="2"/>
            <line x1="${scalePx}" y1="-4" x2="${scalePx}" y2="4" stroke="var(--text-muted)" stroke-width="2"/>
            <text x="${scalePx / 2}" y="-8" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="var(--text-muted)">${scaleLen} substitutions/site</text>
        </g>
    `;

    return `<svg class="phylo-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:transparent;">
        <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
        <g style="filter: url(#glow);">
            ${paths.join('\n')}
        </g>
        ${dots.join('\n')}
        ${labels.join('\n')}
        ${scaleBar}
    </svg>`;
}

/**
 * @param {import('../core/types.js').TreeNode} node
 * @returns {import('../core/types.js').TreeNode[]}
 */
function getLeafNodes(node) {
    if (!node.children || node.children.length === 0) return [node];
    return node.children.flatMap(getLeafNodes);
}

/**
 * @param {import('../core/types.js').TreeNode} node
 * @param {number} [depth=0]
 * @returns {number} Deepest cumulative branch length below this node.
 */
function getMaxDepth(node, depth = 0) {
    if (!node.children || node.children.length === 0) return depth;
    return Math.max(
        ...node.children.map((/** @type {import('../core/types.js').TreeNode} */ c) => getMaxDepth(c, depth + (c.length || 0.1)))
    );
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
