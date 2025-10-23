// Configuration
const width = 1200;
const height = 1200;
const radius = Math.min(width, height) / 2 - 100;

// Color scale for different taxonomic levels
const colorScale = {
    order: '#2c5f2d',
    family: '#4a7c59',
    genus: '#69b578',
    species: '#97d492'
};

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

// Load and visualize data
d3.json('lamiales_hierarchy.json').then(data => {
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
        });

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

        // Update node visibility/opacity based on focus
        nodes.transition()
            .duration(750)
            .style('opacity', node => {
                // Show the focused node and its descendants
                if (node === d) return 1;
                if (node.ancestors().includes(d)) return 0.3; // ancestors dimmed
                if (d.ancestors().includes(node)) return 1; // show path to root

                // Check if node is a descendant of focused node
                let current = node;
                while (current.parent) {
                    if (current.parent === d) return 1;
                    current = current.parent;
                }
                return 0.15; // dim unrelated nodes
            });

        links.transition()
            .duration(750)
            .style('opacity', link => {
                // Show links in the focused subtree
                if (link.source === d || link.target === d) return 1;
                if (d.ancestors().includes(link.source) || d.ancestors().includes(link.target)) return 0.6;

                // Check if link is within focused subtree
                let current = link.target;
                while (current.parent) {
                    if (current.parent === d) return 1;
                    current = current.parent;
                }
                return 0.1;
            });
    }

    // Reset zoom function
    function resetZoom() {
        currentFocus = null;

        svg.transition()
            .duration(750)
            .attr('transform', `translate(${width / 2},${height / 2})`);

        nodes.transition()
            .duration(750)
            .style('opacity', 1);

        links.transition()
            .duration(750)
            .style('opacity', 1);
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
        .style('fill', d => colorScale[d.data.level] || '#97d492')
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
            // Highlight node
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', parseFloat(d3.select(this).attr('r')) * 1.5);

            // Show tooltip
            tooltip.classed('visible', true)
                .html(`
                    <div class="taxon-name">${d.data.name}</div>
                    <div class="taxon-level">Level: ${d.data.level}</div>
                    ${d.children ? `<div>Children: ${d.children.length}</div>` : ''}
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
            // Reset node size
            d3.select(this)
                .transition()
                .duration(200)
                .attr('r', d => {
                    if (d.depth === 0) return 24;
                    if (d.depth === 1) return 9;
                    if (d.depth === 2) return 6;
                    return 3;
                });

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
            if (d.depth === 0) return 'rotate(-105)'; // rotate root label 90 degrees
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

    // Update statistics panel
    d3.select('#stat-total').text(allNodes.length);
    d3.select('#stat-families').text(families);
    d3.select('#stat-genera').text(genera);
    d3.select('#stat-species').text(species);

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
