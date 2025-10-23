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
const svg = d3.select('#visualization')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

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

    // Add circles for nodes
    nodes.append('circle')
        .attr('r', d => {
            // Size based on depth/level
            if (d.depth === 0) return 8; // order
            if (d.depth === 1) return 6; // family
            if (d.depth === 2) return 4; // genus
            return 3; // species
        })
        .style('fill', d => colorScale[d.data.level] || '#97d492')
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
                    if (d.depth === 0) return 8;
                    if (d.depth === 1) return 6;
                    if (d.depth === 2) return 4;
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
            return '0.31em'; // genera
        })
        .attr('x', d => {
            // Horizontal offset from node - larger for root and families
            if (d.depth === 0) return 15; // root node - more space
            if (d.depth === 1) return d.x < Math.PI === !d.children ? 12 : -12; // families - more space
            return d.x < Math.PI === !d.children ? 6 : -6; // genera
        })
        .attr('text-anchor', d => {
            if (d.depth === 0) return 'start'; // root always starts from right
            return d.x < Math.PI === !d.children ? 'start' : 'end';
        })
        .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
        .text(d => d.data.name)
        .style('font-size', d => d.depth === 0 ? '14px' : d.depth === 1 ? '11px' : '9px')
        .style('font-weight', d => d.depth === 0 ? 'bold' : 'normal');

    console.log(`Visualization loaded: ${root.descendants().length} total nodes`);
    console.log(`Depth levels: ${root.height + 1}`);
}).catch(error => {
    console.error('Error loading data:', error);
    d3.select('#visualization')
        .append('div')
        .style('color', 'red')
        .style('padding', '20px')
        .text('Error loading data. Please check the console for details.');
});
