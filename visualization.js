// Configuration
const width = 1200;
const height = 1200;
const radius = Math.min(width, height) / 2 - 100;

// Hue range for gradient around circle
const HUE_START = 80;  // Lime-green
const HUE_END = 300;    // Purple
const BASE_SATURATION = 50;

// Map to store family hue assignments
let familyHueMap = new Map();

// Function to get color for a node based on its family and depth
function getNodeColor(node, dimLevel = 0) {
    // Find which family this node belongs to
    let familyNode = node;
    while (familyNode && familyNode.depth > 1) {
        familyNode = familyNode.parent;
    }

    // If this is order level, use neutral dark green
    if (node.depth === 0) {
        let baseLightness = 20;
        let lightness = baseLightness;
        if (dimLevel === 1) lightness = baseLightness + 20; // Lighten for dim
        if (dimLevel === 2) lightness = baseLightness + 35; // Lighten more for very dim
        return `hsl(150, 40%, ${lightness}%)`;
    }

    // Get or assign hue for this family
    let hue;
    if (familyNode && familyNode.depth === 1) {
        if (!familyHueMap.has(familyNode)) {
            // Assign hue based on family's angular position
            const angle = familyNode.x; // radians, 0 to 2π
            const normalizedAngle = angle / (2 * Math.PI); // 0 to 1
            hue = HUE_START + (normalizedAngle * (HUE_END - HUE_START));
            familyHueMap.set(familyNode, hue);
        } else {
            hue = familyHueMap.get(familyNode);
        }
    } else {
        hue = 150; // Default green if something goes wrong
    }

    // Apply dark-to-light gradient based on depth
    let baseLightness, saturation;
    if (node.depth === 1) { // Family
        baseLightness = 45;  // Increased from 30 to be lighter
        saturation = BASE_SATURATION;
    } else if (node.depth === 2) { // Genus
        baseLightness = 60;  // Increased from 50
        saturation = BASE_SATURATION - 5;
    } else { // Species
        baseLightness = 75;  // Increased from 70
        saturation = BASE_SATURATION - 10;
    }

    // Apply dimming by increasing lightness (making paler)
    let lightness = baseLightness;
    if (dimLevel === 1) {
        lightness = Math.min(baseLightness + 15, 95); // Lighten for dim
    } else if (dimLevel === 2) {
        lightness = Math.min(baseLightness + 25, 95); // Lighten more for very dim
    }

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Function to get pale color for links (same hue as nodes, but lighter)
function getLinkColor(node, dimLevel = 0) {
    // Find which family this node belongs to
    let familyNode = node;
    while (familyNode && familyNode.depth > 1) {
        familyNode = familyNode.parent;
    }

    let hue, baseSaturation, baseLightness;

    // If this is order level, use neutral pale green
    if (node.depth === 0) {
        hue = 150;
        baseSaturation = 25;
        baseLightness = 85;
    } else {
        // Get or assign hue for this family
        if (familyNode && familyNode.depth === 1) {
            if (!familyHueMap.has(familyNode)) {
                // Assign hue based on family's angular position
                const angle = familyNode.x; // radians, 0 to 2π
                const normalizedAngle = angle / (2 * Math.PI); // 0 to 1
                hue = HUE_START + (normalizedAngle * (HUE_END - HUE_START));
                familyHueMap.set(familyNode, hue);
            } else {
                hue = familyHueMap.get(familyNode);
            }
        } else {
            hue = 150; // Default green if something goes wrong
        }

        // 🎨 ADJUST SATURATION HERE: Increase from 25% to make links more saturated
        baseSaturation = 30;  // Try values between 25-50
        baseLightness = 70;
    }

    // Apply dimming by reducing lightness (no transparency needed)
    // dimLevel: 0 = normal, 1 = slightly dimmed, 2 = very dimmed
    let lightness = baseLightness;
    if (dimLevel === 1) {
        lightness = baseLightness + 5 ; // Slightly lighter
    } else if (dimLevel === 2) {
        lightness = baseLightness + 15; // Much lighter
    }

    return `hsl(${hue}, ${baseSaturation}%, ${lightness}%)`;
}

// Create SVG container
const svgElement = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

const svg = svgElement.append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

// Track current focus node
let currentFocus = null;

// Create cluster layout (better for radial distribution)
const tree = d3.cluster()
    .size([2 * Math.PI, radius])
    .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

// Tooltip
const tooltip = d3.select('#tooltip');

// Function to load and render visualization
function loadVisualization(filename) {
    // Clear existing visualization
    svg.selectAll('*').remove();
    familyHueMap.clear();
    currentFocus = null;

    // Load and visualize data
    d3.json(filename).then(data => {
    // Create hierarchy
    const root = d3.hierarchy(data);

    // Apply tree layout
    tree(root);

    // Draw links (the branches)
    const links = svg.selectAll('.link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
            // For links from the root node, draw straight radial lines
            if (d.source.depth === 0) {
                const startX = 0;
                const startY = 0;
                const endX = d.target.y * Math.sin(d.target.x);
                const endY = -d.target.y * Math.cos(d.target.x);
                return `M${startX},${startY}L${endX},${endY}`;
            }
            // For other links, use curved radial links
            return d3.linkRadial()
                .angle(d => d.x)
                .radius(d => d.y)(d);
        })
        .style('stroke', d => getLinkColor(d.target, 0)); // Start at full brightness (dimLevel 0)

    // Draw nodes
    const nodes = svg.selectAll('.node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `
            rotate(${d.x * 180 / Math.PI - 90})
            translate(${d.y},0)
        `);

    // Zoom function
    function zoomToNode(d) {
        currentFocus = d;

        // Calculate transform
        const angle = d.x;
        const radius = d.y;

        // Calculate center position in Cartesian coordinates
        const x = radius * Math.sin(angle);
        const y = -radius * Math.cos(angle);

        // Zoom scale - zoom more for nodes further out
        const scale = d.depth === 0 ? 1 : d.depth === 1 ? 2.5 : 3.5;

        // Transform to center the clicked node
        svg.transition()
            .duration(750)
            .attr('transform', `translate(${width / 2},${height / 2}) scale(${scale}) translate(${-x},${-y})`);

        // Update node colors based on focus (no transparency)
        nodes.selectAll('circle').transition()
            .duration(750)
            .style('fill', node => {
                // Show the focused node and its descendants at full brightness
                if (node === d) return getNodeColor(node, 0);
                if (d.ancestors().includes(node)) return getNodeColor(node, 0); // show path to root

                // Check if node is a descendant of focused node
                let current = node;
                while (current.parent) {
                    if (current.parent === d) return getNodeColor(node, 0);
                    current = current.parent;
                }

                // Dim unrelated nodes by lightening them
                if (node.ancestors().includes(d)) return getNodeColor(node, 1); // ancestors slightly dimmed
                return getNodeColor(node, 2); // dim unrelated nodes more
            });

        links.transition()
            .duration(750)
            .style('stroke', link => {
                // Determine dimming level based on focus
                if (link.source === d || link.target === d) return getLinkColor(link.target, 0);
                if (d.ancestors().includes(link.source) || d.ancestors().includes(link.target)) {
                    return getLinkColor(link.target, 1);
                }

                // Check if link is within focused subtree
                let current = link.target;
                while (current.parent) {
                    if (current.parent === d) return getLinkColor(link.target, 0);
                    current = current.parent;
                }
                return getLinkColor(link.target, 2);
            });
    }

    // Reset zoom function
    function resetZoom() {
        currentFocus = null;

        svg.transition()
            .duration(750)
            .attr('transform', `translate(${width / 2},${height / 2})`);

        nodes.selectAll('circle').transition()
            .duration(750)
            .style('fill', node => getNodeColor(node, 0));

        links.transition()
            .duration(750)
            .style('stroke', link => getLinkColor(link.target, 0));
    }

    // Add circles for nodes
    nodes.append('circle')
        .attr('r', d => {
            // Size based on depth/level
            if (d.depth === 0) return 24; // order
            if (d.depth === 1) return 9; // family (1.5x original)
            if (d.depth === 2) return 6; // genus (1.5x original)
            return 3; // species (unchanged)
        })
        .style('fill', d => getNodeColor(d))
        .style('cursor', d => d.children ? 'pointer' : 'default') // pointer for clickable nodes
        .on('click', function(event, d) {
            event.stopPropagation();
            if (d.children) { // Only allow zoom on nodes with children
                if (currentFocus === d) {
                    resetZoom(); // Click again to reset
                } else {
                    zoomToNode(d);
                }
            }
        })
        .on('mouseover', function(event, d) {
            // Get all descendants of hovered node
            const descendants = d.descendants();
            const descendantSet = new Set(descendants);

            // Change both size AND color in ONE transition to avoid conflicts
            nodes.selectAll('circle')
                .transition()
                .duration(200)
                .attr('r', node => {
                    // Get original radius
                    let originalR = 3;
                    if (node.depth === 0) originalR = 24;
                    else if (node.depth === 1) originalR = 9;
                    else if (node.depth === 2) originalR = 6;

                    // 10% larger for hovered subtree
                    if (descendantSet.has(node)) {
                        return originalR * 1.2;
                    }
                    return originalR;
                })
                .style('fill', node => {
                    if (descendantSet.has(node)) return getNodeColor(node, 0); // Full brightness for subtree
                    if (d.ancestors().includes(node)) return getNodeColor(node, 1); // Ancestors slightly dimmed
                    return getNodeColor(node, 2); // Dim unrelated nodes
                });

            // Highlight links in the subtree
            links.transition()
                .duration(200)
                .style('stroke', link => {
                    if (descendantSet.has(link.target) || descendantSet.has(link.source)) {
                        return getLinkColor(link.target, 0); // Full brightness for subtree links
                    }
                    if (d.ancestors().includes(link.target) || d.ancestors().includes(link.source)) {
                        return getLinkColor(link.target, 1); // Ancestors somewhat dimmed
                    }
                    return getLinkColor(link.target, 2); // Dim unrelated links
                })
                .style('stroke-width', link => {
                    // Thicken links in the focused subtree
                    if (descendantSet.has(link.target)) {
                        return '2.5px';
                    }
                    return '1.5px';
                });

            // Show tooltip
            tooltip.classed('visible', true)
                .html(`
                    <div class="taxon-name">${d.data.name}</div>
                    ${d.data.level === 'species' && (d.data.discoveryYear || d.data.authorship) ?
                        `<div class="taxon-metadata">${d.data.discoveryYear || ''} ${d.data.discoveryYear && d.data.authorship ? '|' : ''} ${d.data.authorship || ''}</div>`
                        : ''}
                    ${d.children && d.data.actualChildCount ?
                        `<div class="taxon-counts">
                            ${d.children.length} ${d.data.level === 'order' ? 'families' : d.data.level === 'family' ? 'genera' : 'species'} displayed |
                            ${d.data.actualChildCount} total
                            (${Math.round((d.children.length / d.data.actualChildCount) * 100)}%)
                        </div>`
                        : ''}
                    <div class="taxon-level">Level: ${d.data.level}</div>
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
            // Reset node colors (respect current zoom state if any)
            if (currentFocus) {
                // If zoomed, maintain the zoom color state
                const focusDescendants = currentFocus.descendants();
                const focusSet = new Set(focusDescendants);

                // COMBINED transition: reset size AND color together
                nodes.selectAll('circle').transition()
                    .duration(200)
                    .attr('r', node => {
                        if (node.depth === 0) return 24;
                        if (node.depth === 1) return 9;
                        if (node.depth === 2) return 6;
                        return 3;
                    })
                    .style('fill', node => {
                        if (node === currentFocus) return getNodeColor(node, 0);
                        if (currentFocus.ancestors().includes(node)) return getNodeColor(node, 0);
                        if (focusSet.has(node)) return getNodeColor(node, 0);
                        if (node.ancestors().includes(currentFocus)) return getNodeColor(node, 1);
                        return getNodeColor(node, 2);
                    });

                links.transition()
                    .duration(200)
                    .style('stroke', link => {
                        if (link.source === currentFocus || link.target === currentFocus) {
                            return getLinkColor(link.target, 0);
                        }
                        if (currentFocus.ancestors().includes(link.source) || currentFocus.ancestors().includes(link.target)) {
                            return getLinkColor(link.target, 1);
                        }
                        if (focusSet.has(link.target)) return getLinkColor(link.target, 0);
                        return getLinkColor(link.target, 2);
                    })
                    .style('stroke-width', '1.5px');
            } else {
                // No zoom, restore full brightness and original size
                nodes.selectAll('circle').transition()
                    .duration(200)
                    .attr('r', node => {
                        if (node.depth === 0) return 24;
                        if (node.depth === 1) return 9;
                        if (node.depth === 2) return 6;
                        return 3;
                    })
                    .style('fill', node => getNodeColor(node, 0));

                links.transition()
                    .duration(200)
                    .style('stroke', link => getLinkColor(link.target, 0))
                    .style('stroke-width', '1.5px');
            }

            // Hide tooltip
            tooltip.classed('visible', false);
        });

    // Add text labels (only for families and genera, to avoid clutter)
    nodes.filter(d => d.depth <= 2)
        .append('text')
        .attr('dy', d => {
            // Vertical offset adjustment
            if (d.depth === 0) return '0.31em'; // center node
            if (d.depth === 1) return '-0.5em'; // families - offset above line
            return '-0.5em'; // genera - offset above line
        })
        .attr('x', d => {
            // Horizontal offset from node
            if (d.depth === 0) return 63; // root node - more padding to avoid overlap with circle
            if (d.depth === 1) return d.x < Math.PI === !d.children ? 15 : -15; // families
            return d.x < Math.PI === !d.children ? 12 : -12; // genera
        })
        .attr('text-anchor', d => {
            if (d.depth === 0) return 'middle'; // center the rotated text
            return d.x < Math.PI === !d.children ? 'start' : 'end';
        })
        .attr('transform', d => {
            if (d.depth === 0) return 'rotate(-157)'; // rotate root label 90 degrees
            return d.x >= Math.PI ? 'rotate(180)' : null;
        })
        .text(d => d.data.name)
        .style('font-size', d => d.depth === 0 ? '14px' : d.depth === 1 ? '11px' : '9px')
        .style('font-weight', d => d.depth === 0 ? 'bold' : 'normal');

    // Calculate and display statistics
    const allNodes = root.descendants();
    const families = allNodes.filter(d => d.data.level === 'family').length;
    const genera = allNodes.filter(d => d.data.level === 'genus').length;
    const species = allNodes.filter(d => d.data.level === 'species').length;

    // Get TRUE totals for ALL of Lamiales from metadata
    const metadata = root.data.metadata || {};
    const trueFamilies = metadata.totalFamiliesInLamiales || families;
    const trueGenera = metadata.totalGeneraInLamiales || 0;
    const trueSpecies = metadata.totalSpeciesInLamiales || 0;

    // Update statistics panel - displayed counts
    d3.select('#stat-total').text(allNodes.length);
    d3.select('#stat-families').text(families);
    d3.select('#stat-genera').text(genera);
    d3.select('#stat-species').text(species);

    // Update statistics panel - actual totals (TRUE totals for ALL of Lamiales)
    d3.select('#stat-families-actual').text(trueFamilies);
    d3.select('#stat-genera-actual').text(trueGenera.toLocaleString());
    d3.select('#stat-species-actual').text(trueSpecies.toLocaleString());

    // Click SVG background to reset zoom
    svgElement.on('click', function(event) {
        if (event.target === this || event.target.tagName === 'svg') {
            resetZoom();
        }
    });

    // Expose reset function globally for button
    window.resetVisualizationZoom = resetZoom;

    console.log(`Visualization loaded: ${allNodes.length} total nodes`);
    console.log(`Families: ${families}, Genera: ${genera}, Species: ${species}`);
    console.log(`Click on family or genus nodes to zoom in. Click again or click background to reset.`);
}).catch(error => {
    console.error('Error loading data:', error);
    d3.select('#visualization')
        .append('div')
        .style('color', 'red')
        .style('padding', '20px')
        .text('Error loading data. Please check the console for details.');
    });
}

// Map radio button values to filenames
const dataFiles = {
    'earliest': 'lamiales_hierarchy_proportional.json',
    'latest': 'lamiales_hierarchy_latest.json'
};

// Add event listeners for toggle
document.querySelectorAll('input[name="discovery-view"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const selectedFile = dataFiles[this.value];
        console.log(`Switching to ${this.value} discoveries...`);
        loadVisualization(selectedFile);
    });
});

// Initial load with earliest discovered (default)
loadVisualization(dataFiles['earliest']);
