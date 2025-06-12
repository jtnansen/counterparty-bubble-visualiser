import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { SIZES, COLORS } from '../../utils/constants';
import { calculateRadius, formatNumber } from '../../utils/calculations';

// This component will be expanded in a future step to handle the full D3 visualization
// For now, we'll use a ref that can be passed to the original createVisualization function

const D3Visualization = ({ 
  data, 
  sizeMetric, 
  scaleFactor, 
  customLabels,
  customHighlights,
  deletedNodes,
  labelMode,
  lockedNodes,
  expandedLinks,
  showSmartContracts,
  showExchanges,
  rangeMin,
  rangeMax,
  highlightShared,
  onVisualizationCreate 
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      createVisualization();
    }
  }, [
    data, 
    sizeMetric, 
    scaleFactor,
    customLabels,
    customHighlights,
    deletedNodes,
    labelMode,
    lockedNodes,
    expandedLinks,
    showSmartContracts,
    showExchanges,
    rangeMin,
    rangeMax,
    highlightShared
  ]);

  const createVisualization = () => {
    const svg = d3.select(svgRef.current);
    const width = window.innerWidth - 300; // Account for controls panel
    const height = window.innerHeight;

    // Clear previous visualization
    svg.selectAll("*").remove();
    svg.attr('width', width).attr('height', height);

    // Basic implementation - just show we have data
    if (data.length === 0) return;

    // Create simple nodes for main addresses
    const nodes = data.map((dataSet, index) => ({
      id: dataSet.mainAddress,
      x: width / 2 + (index - data.length/2) * 200,
      y: height / 2,
      isMain: true,
      address: dataSet.mainAddress,
      transactions: dataSet.transactions
    }));

    // Add counterparty nodes
    data.forEach((dataSet, mainIndex) => {
      dataSet.transactions.forEach((transaction, txIndex) => {
        if (!deletedNodes.has(transaction.interactingAddress)) {
          nodes.push({
            id: transaction.interactingAddress,
            x: width / 2 + (mainIndex - data.length/2) * 200 + Math.cos(txIndex) * 150,
            y: height / 2 + Math.sin(txIndex) * 150,
            isMain: false,
            address: transaction.interactingAddress,
            ...transaction
          });
        }
      });
    });

    // Create container
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create nodes
    const nodeElements = container.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Add circles
    nodeElements.append('circle')
      .attr('r', d => d.isMain ? SIZES.MAIN_NODE_RADIUS : 20)
      .attr('fill', d => d.isMain ? COLORS.NAVY_FILL : (d.usdNetflow > 0 ? COLORS.GREEN_FILL : COLORS.RED_FILL))
      .attr('stroke', d => d.isMain ? COLORS.MAIN_NODE_STROKE : (d.usdNetflow > 0 ? COLORS.GREEN_STROKE : COLORS.RED_STROKE))
      .attr('stroke-width', 2);

    // Add text labels
    nodeElements.append('text')
      .text(d => d.isMain ? 'Main' : d.address.slice(0, 6))
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', 'white')
      .style('font-size', '12px');

    // Add basic links
    const links = [];
    data.forEach(dataSet => {
      dataSet.transactions.forEach(transaction => {
        if (!deletedNodes.has(transaction.interactingAddress)) {
          links.push({
            source: dataSet.mainAddress,
            target: transaction.interactingAddress,
            value: transaction.usdNetflow
          });
        }
      });
    });

    // Draw links
    container.selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('x1', d => nodes.find(n => n.id === d.source)?.x || 0)
      .attr('y1', d => nodes.find(n => n.id === d.source)?.y || 0)
      .attr('x2', d => nodes.find(n => n.id === d.target)?.x || 0)
      .attr('y2', d => nodes.find(n => n.id === d.target)?.y || 0)
      .attr('stroke', d => d.value > 0 ? COLORS.GREEN_STROKE : COLORS.RED_STROKE)
      .attr('stroke-width', SIZES.AGGREGATED_LINK_WIDTH);
  };

  // Show welcome message when no data is loaded
  if (data.length === 0) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.BACKGROUND,
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: COLORS.SUCCESS, marginBottom: '20px' }}>
            🔗 Counterparty Visualizer
          </h2>
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            Welcome to the blockchain counterparty visualization tool!
          </p>
          <p style={{ marginBottom: '20px', opacity: 0.8 }}>
            Enter a wallet address in the left panel to start exploring transaction relationships.
          </p>
          <div style={{ 
            background: COLORS.BORDER, 
            padding: '15px', 
            borderRadius: '8px',
            fontSize: '14px',
            opacity: 0.9
          }}>
            <strong>Try this sample address:</strong><br/>
            <code style={{ 
              background: COLORS.BACKGROUND, 
              padding: '5px 8px', 
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '8px',
              color: COLORS.SUCCESS
            }}>
              0x742d35cc6634c0532925a3b8d3ac293c9e8c3b0f
            </code>
          </div>
        </div>
      </div>
    );
  }

  return <svg ref={svgRef} style={{ width: '100%', height: '100vh' }}></svg>;
};

export default D3Visualization; 