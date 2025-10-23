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

    // Add curved text labels
    // First, create a group for text paths
    const textNodes = nodes.filter(d => d.depth <= 2);

    // Add curved labels for families and genera
    textNodes.each(function(d, i) {
        const node = d3.select(this);

        if (d.depth === 0) {
            // Keep root label straight
            node.append('text')
                .attr('dy', '0.31em')
                .attr('x', 15)
                .attr('text-anchor', 'start')
                .text(d.data.name)
                .style('font-size', '14px')
                .style('font-weight', 'bold');
        } else {
            // Create curved text for families and genera
            const angle = d.x;
            const radius = d.y;
            const textRadius = radius + (d.depth === 1 ? 15 : 10); // Offset from node

            // Create unique ID for path
            const pathId = `text-path-${i}`;

            // Determine arc direction and span based on position
            const isRightSide = angle < Math.PI;
            const arcSpan = 0.3; // Arc length in radians

            let startAngle, endAngle;
            if (isRightSide) {
                startAngle = angle - arcSpan / 2;
                endAngle = angle + arcSpan / 2;
            } else {
                // Flip for left side so text reads correctly
                startAngle = angle + arcSpan / 2;
                endAngle = angle - arcSpan / 2;
            }

            // Convert to Cartesian coordinates
            const x1 = textRadius * Math.sin(startAngle);
            const y1 = -textRadius * Math.cos(startAngle);
            const x2 = textRadius * Math.sin(endAngle);
            const y2 = -textRadius * Math.cos(endAngle);

            // Create arc path
            const arcPath = d3.path();
            arcPath.moveTo(x1, y1);
            arcPath.arc(0, 0, textRadius, startAngle - Math.PI/2, endAngle - Math.PI/2, !isRightSide);

            // Add path definition to SVG defs
            svg.append('defs')
                .append('path')
                .attr('id', pathId)
                .attr('d', arcPath.toString());

            // Add text along the path
            node.append('text')
                .append('textPath')
                .attr('href', `#${pathId}`)
                .attr('startOffset', '50%')
                .attr('text-anchor', 'middle')
                .text(d.data.name)
                .style('font-size', d.depth === 1 ? '11px' : '9px')
                .style('font-weight', 'normal');
        }
    });

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

    console.log(`Visualization loaded: ${allNodes.length} total nodes`);
    console.log(`Families: ${families}, Genera: ${genera}, Species: ${species}`);
}).catch(error => {
    console.error('Error loading data:', error);
    d3.select('#visualization')
        .append('div')
        .style('color', 'red')
        .style('padding', '20px')
        .text('Error loading data. Please check the console for details.');
});
