import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useExpandedLinks } from '../../hooks/useExpandedLinks.js';
import ContextMenu from './ContextMenu.jsx';
import { COLORS, PHYSICS, UI, SIZES, ANIMATION } from '../../utils/constants.js';
import { calculateRadius, calculateCollisionRadius, formatNumber } from '../../utils/calculations.js';
import { 
  getNodeDisplayText, 
  calculateFontSize, 
  positionNewCounterpartyNode,
  getNodeStrokeColor,
  getNodeFillColor,
  generateNodeTooltip
} from '../../utils/nodeUtils.js';

const D3Visualization = ({
  data,
  sizeMetric,
  scaleFactor,
  labelMode,
  customLabels,
  customHighlights,
  highlightShared,
  lockedNodes,
  deletedNodes,
  timeframe,
  onDeleteNode,
  onSetCustomLabel,
  onSetCustomHighlight,
  onToggleNodeLock,
  onAddWallet,
  getProcessedData
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [currentTransform, setCurrentTransform] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Get expanded links functionality
  const { 
    expandedLinks, 
    processLinksWithExpansions,
    toggleLinkExpansion,
    isLinkLoading
  } = useExpandedLinks(timeframe);

  // Context menu handlers
  const handleCopyAddress = useCallback((address) => {
    navigator.clipboard.writeText(address).then(() => {
      console.log('Address copied to clipboard:', address);
    }).catch(err => {
      console.error('Failed to copy address:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const createVisualization = useCallback(() => {
    if (!data.length || !svgRef.current) return;

    try {
      const { nodes, links, addressMap } = getProcessedData();
      
      console.log(`📊 Processing ${nodes.length} nodes and ${links.length} links`);
      
      if (nodes.length === 0) {
        console.warn('No nodes to display after filtering');
        return;
      }

      const finalLinks = processLinksWithExpansions(links, addressMap);

      // Set up SVG
      const svg = d3.select(svgRef.current);
      const width = window.innerWidth - UI.CONTROLS_WIDTH;
      const height = window.innerHeight;

      console.log(`🚀 CREATE VISUALIZATION - Start`);
      console.log(`📊 Processing ${nodes.length} nodes and ${links.length} original links`);
      console.log(`🔗 Final links after expansion processing: ${finalLinks.length}`);
      
      // Count transaction links at start
      const initialTransactionLinks = finalLinks.filter(link => link.isTransactionLink);
      const initialAggregatedLinks = finalLinks.filter(link => !link.isTransactionLink);
      console.log(`📈 INITIAL: Transaction links: ${initialTransactionLinks.length}, Aggregated links: ${initialAggregatedLinks.length}`);
      
      if (initialTransactionLinks.length > 0) {
        console.log(`🔗 Found ${initialTransactionLinks.length} transaction links to render`);
      }

      // Store current transform before clearing
      const oldTransform = currentTransform || d3.zoomIdentity;

      // Store existing node positions before rebuilding
      const oldNodes = new Map();
      svg.selectAll('.bubble').each(function(d) {
        if (d) {
          oldNodes.set(d.id, {
            x: d.x,
            y: d.y,
            fx: d.fx,
            fy: d.fy
          });
        }
      });

      svg.selectAll("*").remove();
      svg.attr('width', width).attr('height', height);

      // Position nodes with better initialization
      nodes.forEach(node => {
        const oldPos = oldNodes.get(node.id);
        if (oldPos) {
          node.x = oldPos.x;
          node.y = oldPos.y;
          // Restore fixed positions for main nodes and locked counterparty nodes
          if (node.isMain || lockedNodes.has(node.id)) {
            node.fx = oldPos.fx;
            node.fy = oldPos.fy;
          }
        } else if (!node.isMain) {
          // Position new counterparty nodes based on netflow
          // Find the main node this counterparty is connected to
          const connectedMainAddress = Array.from(node.connectedMainAddresses)[0];
          const mainNode = addressMap.get(connectedMainAddress);
          
          positionNewCounterpartyNode(node, mainNode, width, height);
        } else {
          // Position main nodes randomly if not positioned yet
          node.x = Math.random() * width;
          node.y = Math.random() * height;
        }
      });

      // Create physics simulation
      const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id)
          .distance(d => {
            const sourceNode = nodes.find(n => n.id === d.source) || {};
            const targetNode = nodes.find(n => n.id === d.target) || {};
            
            // Longer pendulum distances for main-to-counterparty connections
            if ((sourceNode.isMain && !targetNode.isMain) || (!sourceNode.isMain && targetNode.isMain)) {
              return PHYSICS.LINK_DISTANCE.MAIN_TO_COUNTERPARTY;
            }
            return PHYSICS.LINK_DISTANCE.MAIN_TO_MAIN;
          })
          .strength(PHYSICS.FORCES.LINK_STRENGTH))
        .force('charge', d3.forceManyBody()
          .strength(d => d.isMain ? PHYSICS.FORCES.CHARGE_MAIN : PHYSICS.FORCES.CHARGE_COUNTERPARTY))
        .force('collision', d3.forceCollide()
          .radius(d => calculateCollisionRadius(d, sizeMetric, scaleFactor))
          .strength(PHYSICS.FORCES.COLLISION_STRENGTH))
        .force('mainNodeRepulsion', d => {
          // Stronger force to maintain bigger buffer around main nodes
          return function(alpha) {
            const simulationNodes = simulation.nodes();
            const mainNodes = simulationNodes.filter(n => n.isMain);
            
            simulationNodes.forEach(node => {
              if (!node.isMain) {
                mainNodes.forEach(mainNode => {
                  const dx = node.x - mainNode.x;
                  const dy = node.y - mainNode.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const minDistance = calculateRadius(mainNode, sizeMetric, scaleFactor) * PHYSICS.FORCES.MAIN_NODE_REPULSION_MULTIPLIER;
                  
                  if (distance < minDistance) {
                    const force = (minDistance - distance) / distance * alpha * PHYSICS.FORCES.MAIN_NODE_REPULSION_STRENGTH; 
                    node.vx += dx * force;
                    node.vy += dy * force;
                  }
                });
              }
            });
          };
        })
        .force('pendulumMaintenance', d => {
          // Stronger force to help counterparty nodes maintain their pendulum relationship with main nodes
          return function(alpha) {
            const simulationNodes = simulation.nodes();
            
            simulationNodes.forEach(node => {
              if (!node.isMain && !lockedNodes.has(node.id)) {
                // Find the main node this counterparty is connected to
                const connectedMainAddress = Array.from(node.connectedMainAddresses || [])[0];
                const mainNode = simulationNodes.find(n => n.id === connectedMainAddress);
                
                if (mainNode) {
                  const dx = node.x - mainNode.x;
                  const dy = node.y - mainNode.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  const idealDistance = PHYSICS.LINK_DISTANCE.MAIN_TO_COUNTERPARTY;
                  
                  // Tighter tolerance and stronger force for more consistent distances
                  if (Math.abs(distance - idealDistance) > PHYSICS.FORCES.PENDULUM_MAINTENANCE_TOLERANCE) {
                    const forceStrength = (distance - idealDistance) / distance * alpha * PHYSICS.FORCES.PENDULUM_MAINTENANCE_ALPHA;
                    node.vx -= dx * forceStrength;
                    node.vy -= dy * forceStrength;
                  }
                }
              }
            });
          };
        })
        .force('arrowRepulsion', d => {
          // Add a custom force to repel nodes from the line between main nodes
          return function(alpha) {
            const simulationNodes = simulation.nodes();
            
            simulationNodes.forEach(node => {
              if (!node.isMain) {
                finalLinks.forEach(link => {
                  const sourceNode = addressMap.get(link.source.id || link.source);
                  const targetNode = addressMap.get(link.target.id || link.target);

                  if (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) {
                    const lineVec = { x: targetNode.x - sourceNode.x, y: targetNode.y - sourceNode.y };
                    const nodeVec = { x: node.x - sourceNode.x, y: node.y - sourceNode.y };
                    const lineLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
                    const projection = (nodeVec.x * lineVec.x + nodeVec.y * lineVec.y) / lineLength;
                    const closestPoint = {
                      x: sourceNode.x + (projection / lineLength) * lineVec.x,
                      y: sourceNode.y + (projection / lineLength) * lineVec.y
                    };
                    const distToLine = Math.sqrt((node.x - closestPoint.x) ** 2 + (node.y - closestPoint.y) ** 2);

                    const minDistance = PHYSICS.FORCES.ARROW_REPULSION_MIN_DISTANCE;
                    if (distToLine < minDistance) {
                      const force = (minDistance - distToLine) / distToLine * alpha * PHYSICS.FORCES.ARROW_REPULSION_STRENGTH;
                      node.vx += (node.x - closestPoint.x) * force;
                      node.vy += (node.y - closestPoint.y) * force;
                    }
                  }
                });
              }
            });
          };
        })
        .velocityDecay(PHYSICS.VELOCITY_DECAY);

      // Create container for zoom
      const container = svg.append('g').attr('class', 'zoom-container');

      // Set up zoom behavior
      const zoom = d3.zoom()
        .scaleExtent(UI.ZOOM_SCALE_EXTENT)
        .on('zoom', (event) => {
          const { transform } = event;
          setCurrentTransform(transform);
          // Zoom transform applied to container only - links maintain constant width
          container.style('transform', `translate(${transform.x}px,${transform.y}px) scale(${transform.k})`);
        });

      // Add arrow markers
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 5)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', COLORS.WHITE)
        .attr('d', 'M0,-5L10,0L0,5');

      // Create tooltip
      const tooltip = d3.select('body')
        .selectAll('.custom-tooltip')
        .data([0])
        .join('div')
        .attr('class', 'custom-tooltip')
        .style('position', 'absolute')
        .style('background-color', COLORS.BACKGROUND)
        .style('border', `1px solid ${COLORS.UI_BACKGROUND}`)
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('color', COLORS.WHITE)
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', UI.CONTEXT_MENU_Z_INDEX)
        .style('display', 'none')
        .style('max-width', '300px')
        .style('line-height', '1.4');

      // Function to update links in place without full rebuild
      let link; // Declare link variable to be accessible in updateLinksInPlace
      
      const updateLinksInPlace = () => {
        const { nodes: currentNodes, links: currentLinks, addressMap: currentAddressMap } = getProcessedData();
        const updatedFinalLinks = processLinksWithExpansions(currentLinks, currentAddressMap);
        
        // Count transaction links
        const transactionLinks = updatedFinalLinks.filter(link => link.isTransactionLink);
        if (transactionLinks.length > 0) {
          console.log(`🔗 Updating ${transactionLinks.length} transaction links`);
        }
        
        // Update the link data and redraw
        const linkContainer = container.select('g.links-container');
        const linkSelection = linkContainer.selectAll('path')
          .data(updatedFinalLinks, d => d.linkId || `${d.source.id || d.source}-${d.target.id || d.target}-${d.transactionIndex || 0}`);
        
        // Remove old links
        linkSelection.exit().remove();
        
        // Add new links
        const newLinks = linkSelection.enter()
          .append('path')
          .attr('class', 'link')
          .attr('fill', 'none');
        
        // Update all links (new and existing)
        const allLinks = linkSelection.merge(newLinks)
          .attr('stroke', d => {
            const sourceNode = currentAddressMap.get(d.source.id || d.source);
            const targetNode = currentAddressMap.get(d.target.id || d.target);
            
            if (d.isTransactionLink) {
              const color = d.direction === 'incoming' ? COLORS.GREEN_STROKE : COLORS.RED_STROKE;
              return color;
            }
            
            return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) 
              ? COLORS.WHITE 
              : (d.value > 0 ? COLORS.GREEN_STROKE : COLORS.RED_STROKE);
          })
          .attr('stroke-width', d => {
            const sourceNode = currentAddressMap.get(d.source.id || d.source);
            const targetNode = currentAddressMap.get(d.target.id || d.target);
            
            if (d.isTransactionLink) {
              return SIZES.LINK_WIDTH.TRANSACTION;
            }
            
            return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) 
              ? SIZES.LINK_WIDTH.MAIN_TO_MAIN
              : SIZES.LINK_WIDTH.AGGREGATED;
          })
          .attr('marker-end', d => {
            const sourceNode = currentAddressMap.get(d.source.id || d.source);
            const targetNode = currentAddressMap.get(d.target.id || d.target);
            return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) ? 'url(#arrow)' : '';
          })
          .style('cursor', d => {
            const sourceNode = currentAddressMap.get(d.source.id || d.source);
            const targetNode = currentAddressMap.get(d.target.id || d.target);

            if (d.isTransactionLink) {
              return 'pointer'; // Transaction links are now clickable to copy hash
            }

            return ((sourceNode?.isMain && !targetNode?.isMain) || (!sourceNode?.isMain && targetNode?.isMain)) ? 'pointer' : 'default';
          })
          .on('click', async function(event, d) {
            // If it's a transaction link, copy the hash to clipboard
            if (d.isTransactionLink) {
              if (d.transaction?.transactionHash) {
                try {
                  await navigator.clipboard.writeText(d.transaction.transactionHash);
                  console.log('Transaction hash copied:', d.transaction.transactionHash);

                  // Show a brief confirmation
                  tooltip
                    .style('display', 'block')
                    .html('<strong style="color: #34CF82;">Hash copied!</strong>')
                    .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
                    .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);

                  setTimeout(() => {
                    tooltip.style('display', 'none');
                  }, 1000);
                } catch (err) {
                  console.error('Failed to copy hash:', err);
                }
              }
              return;
            }

            const sourceNode = currentAddressMap.get(d.source.id || d.source);
            const targetNode = currentAddressMap.get(d.target.id || d.target);

            if (!((sourceNode?.isMain && !targetNode?.isMain) || (!sourceNode?.isMain && targetNode?.isMain))) {
              return;
            }

            event.stopPropagation();

            const mainNode = sourceNode?.isMain ? sourceNode : targetNode;
            const counterpartyNode = sourceNode?.isMain ? targetNode : sourceNode;

            if (mainNode && counterpartyNode) {
              const result = await toggleLinkExpansion(mainNode.id, counterpartyNode.id);
              if (result.expanded || result.collapsed) {
                updateLinksInPlace();
              }
            }
          })
          .on('mouseenter', function(event, d) {
            if (d.isTransactionLink && d.transaction) {
              const tx = d.transaction;
              let tokenSymbol = 'Unknown';
              let tokenAmount = '';

              // v1 API uses objects with token_symbol property, not arrays
              if (tx.tokensSent && tx.tokensSent.length > 0) {
                const token = tx.tokensSent[0];
                tokenSymbol = token.token_symbol || 'Unknown';
                if (token.token_amount) {
                  tokenAmount = ` (${Number(token.token_amount).toLocaleString()})`;
                }
              } else if (tx.tokensReceived && tx.tokensReceived.length > 0) {
                const token = tx.tokensReceived[0];
                tokenSymbol = token.token_symbol || 'Unknown';
                if (token.token_amount) {
                  tokenAmount = ` (${Number(token.token_amount).toLocaleString()})`;
                }
              }

              // Show transaction hash preview (first 10 chars)
              const hashPreview = tx.transactionHash ?
                `${tx.transactionHash.slice(0, 10)}...` :
                'No hash';

              const tooltipContent = `<strong>${formatNumber(tx.volumeUsd)}</strong><br>${tokenSymbol}${tokenAmount}<br><small>${new Date(tx.blockTimestamp).toLocaleDateString()}</small><br><span style="color: #888; font-size: 10px;">${hashPreview}</span><br><small style="color: #34CF82;">Click to copy hash</small>`;

              tooltip
                .style('display', 'block')
                .html(tooltipContent)
                .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
                .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
            }
          })
          .on('mouseleave', function() {
            tooltip.style('display', 'none');
          })
          .on('mousemove', function(event) {
            if (tooltip.style('display') === 'block') {
              tooltip
                .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
                .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
            }
          });

        // Update simulation with new links
        simulation.force('link').links(updatedFinalLinks);
        simulation.alpha(0.1).restart(); // Gentle restart

        // Update the link reference
        link = allLinks;
      };

      // Create links with container for organized grouping
      link = container.append('g')
        .attr('class', 'links-container')
        .selectAll('path')
        .data(finalLinks)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('stroke', d => {
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);
          
          if (d.isTransactionLink) {
            const color = d.direction === 'incoming' ? COLORS.GREEN_STROKE : COLORS.RED_STROKE;
            return color;
          }
          
          return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) 
            ? COLORS.WHITE 
            : (d.value > 0 ? COLORS.GREEN_STROKE : COLORS.RED_STROKE);
        })
        .attr('stroke-width', d => {
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);
          
          if (d.isTransactionLink) {
            return SIZES.LINK_WIDTH.TRANSACTION;
          }
          
          return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) 
            ? SIZES.LINK_WIDTH.MAIN_TO_MAIN 
            : SIZES.LINK_WIDTH.AGGREGATED;
        })
        .attr('marker-end', d => {
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);
          return (sourceNode && targetNode && sourceNode.isMain && targetNode.isMain) ? 'url(#arrow)' : '';
        })
        .attr('fill', 'none')
        .style('cursor', d => {
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);

          if (d.isTransactionLink) {
            return 'pointer'; // Transaction links are now clickable to copy hash
          }

          return ((sourceNode?.isMain && !targetNode?.isMain) || (!sourceNode?.isMain && targetNode?.isMain)) ? 'pointer' : 'default';
        })
        .on('click', async function(event, d) {
          // If it's a transaction link, copy the hash to clipboard
          if (d.isTransactionLink) {
            if (d.transaction?.transactionHash) {
              try {
                await navigator.clipboard.writeText(d.transaction.transactionHash);
                console.log('Transaction hash copied:', d.transaction.transactionHash);

                // Show a brief confirmation
                tooltip
                  .style('display', 'block')
                  .html('<strong style="color: #34CF82;">Hash copied!</strong>')
                  .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
                  .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);

                setTimeout(() => {
                  tooltip.style('display', 'none');
                }, 1000);
              } catch (err) {
                console.error('Failed to copy hash:', err);
              }
            }
            return;
          }
          
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);
          
          if (!((sourceNode?.isMain && !targetNode?.isMain) || (!sourceNode?.isMain && targetNode?.isMain))) {
            return;
          }
          
          event.stopPropagation();
          
          const mainNode = sourceNode?.isMain ? sourceNode : targetNode;
          const counterpartyNode = sourceNode?.isMain ? targetNode : sourceNode;
          
          if (mainNode && counterpartyNode) {
            const result = await toggleLinkExpansion(mainNode.id, counterpartyNode.id);
            if (result.expanded || result.collapsed) {
              updateLinksInPlace();
            }
          }
        })
        .on('mouseenter', function(event, d) {
          if (d.isTransactionLink && d.transaction) {
            const tx = d.transaction;
            let tokenSymbol = 'Unknown';
            let tokenAmount = '';

            // v1 API uses objects with token_symbol property, not arrays
            if (tx.tokensSent && tx.tokensSent.length > 0) {
              const token = tx.tokensSent[0];
              tokenSymbol = token.token_symbol || 'Unknown';
              if (token.token_amount) {
                tokenAmount = ` (${Number(token.token_amount).toLocaleString()})`;
              }
            } else if (tx.tokensReceived && tx.tokensReceived.length > 0) {
              const token = tx.tokensReceived[0];
              tokenSymbol = token.token_symbol || 'Unknown';
              if (token.token_amount) {
                tokenAmount = ` (${Number(token.token_amount).toLocaleString()})`;
              }
            }

            const tooltipContent = `<strong>${formatNumber(tx.volumeUsd)}</strong><br>${tokenSymbol}${tokenAmount}<br><small>${new Date(tx.blockTimestamp).toLocaleDateString()}</small>`;

            tooltip
              .style('display', 'block')
              .html(tooltipContent)
              .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
              .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
          }
        })
        .on('mouseleave', function() {
          tooltip.style('display', 'none');
        })
        .on('mousemove', function(event) {
          if (tooltip.style('display') === 'block') {
            tooltip
              .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
              .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
          }
        });

      // Create nodes
      const node = container.append('g')
        .selectAll('g')
        .data(nodes)
        .enter().append('g')
        .attr('class', 'bubble')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      // Add circles
      node.append('circle')
        .attr('r', d => calculateRadius(d, sizeMetric, scaleFactor))
        .attr('fill', d => getNodeFillColor(d))
        .attr('stroke', d => getNodeStrokeColor(d, customHighlights, highlightShared))
        .attr('stroke-width', d => {
          if (customHighlights.has(d.id)) return SIZES.STROKE_WIDTH.HIGHLIGHTED;
          if (d.isMain) return SIZES.STROKE_WIDTH.MAIN_NODE;
          const radius = calculateRadius(d, sizeMetric, scaleFactor);
          return Math.max(1, radius * SIZES.STROKE_WIDTH.COUNTERPARTY_BASE);
        });

      // Add text labels
      node.append('text')
        .text(d => getNodeDisplayText(d, labelMode, customLabels, sizeMetric, scaleFactor))
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .attr('fill', COLORS.WHITE)
        .style('font-weight', d => customLabels.has(d.id) ? '900' : 'normal')
        .style('font-size', d => `${calculateFontSize(d, sizeMetric, scaleFactor)}px`)
        .style('pointer-events', 'none');

      // Add lock symbols for manually positioned counterparty nodes
      node.filter(d => !d.isMain && lockedNodes.has(d.id))
        .append('text')
        .attr('class', 'lock-symbol')
        .text('🔒') // Simple lock character that can be styled
        .attr('x', d => -calculateRadius(d, sizeMetric, scaleFactor) * 0.7)
        .attr('y', d => -calculateRadius(d, sizeMetric, scaleFactor) * 0.7)
        .attr('fill', COLORS.WHITE)
        .style('font-size', ANIMATION.LOCK_SYMBOL_SIZE)
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .style('color', COLORS.WHITE)
        .style('-webkit-text-stroke', '1px white')
        .style('text-stroke', '1px white')
        .style('filter', 'grayscale(100%) brightness(0) invert(1)')
        .on('click', function(event, d) {
          event.stopPropagation();
          onToggleNodeLock(d.id, false);
          d.fx = null;
          d.fy = null;
          d3.select(this).remove();
        });

      // Add node interactions
      node
        .on('mouseenter', function(event, d) {
          // Don't show tooltip if node is being dragged
          if (d.isDragging) return;
          
          const tooltipContent = generateNodeTooltip(d, customLabels, formatNumber);
          tooltip
            .style('display', 'block')
            .html(tooltipContent)
            .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
            .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
        })
        .on('mouseleave', function() {
          tooltip.style('display', 'none');
        })
        .on('mousemove', function(event, d) {
          // Don't update tooltip position if node is being dragged
          if (d.isDragging) {
            tooltip.style('display', 'none');
            return;
          }
          
          if (tooltip.style('display') === 'block') {
            tooltip
              .style('left', `${event.pageX + UI.TOOLTIP_OFFSET}px`)
              .style('top', `${event.pageY - UI.TOOLTIP_OFFSET}px`);
          }
        })
        .on('click', (event, d) => {
          if (!d.isDragging) {
            window.open(`https://app.nansen.ai/profiler?address=${d.address}&chain=${d.chain || 'ethereum'}&tab=overview`, '_blank');
          }
        })
        .on('contextmenu', function(event, d) {
          event.preventDefault();
          event.stopPropagation();
          
          setContextMenu({
            visible: true,
            x: event.pageX,
            y: event.pageY,
            node: d
          });
        });

      // Add click handler to SVG to close context menu
      svg.on('click', () => {
        closeContextMenu();
      });

      // Simulation tick function
      function ticked() {
        link.attr('d', function(d) {
          const sourceNode = addressMap.get(d.source.id || d.source);
          const targetNode = addressMap.get(d.target.id || d.target);
          
          if (!sourceNode || !targetNode) return '';
          
          if (sourceNode.isMain && targetNode.isMain) {
            // Main-to-main links with curved arrows
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            
            const sourceRadius = calculateRadius(sourceNode, sizeMetric, scaleFactor);
            const targetRadius = calculateRadius(targetNode, sizeMetric, scaleFactor);
            
            const startX = sourceNode.x + (sourceRadius * dx / dr);
            const startY = sourceNode.y + (sourceRadius * dy / dr);
            const endX = targetNode.x - (targetRadius * dx / dr);
            const endY = targetNode.y - (targetRadius * dy / dr);
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const curvature = 0.3;
            const controlX = midX + (dy * curvature);
            const controlY = midY - (dx * curvature);
            
            const t = 0.95;
            const qt = 1 - t;
            const arrowEndX = qt * qt * startX + 2 * qt * t * controlX + t * t * endX;
            const arrowEndY = qt * qt * startY + 2 * qt * t * controlY + t * t * endY;
            
            return `M${startX},${startY} Q${controlX},${controlY} ${arrowEndX},${arrowEndY}`;
          } else {
            // Handle transaction links and regular aggregated links
            if (d.isTransactionLink && d.totalTransactions > 1) {
              const dx = targetNode.x - sourceNode.x;
              const dy = targetNode.y - sourceNode.y;
              const dr = Math.sqrt(dx * dx + dy * dy);
              
              const sourceRadius = calculateRadius(sourceNode, sizeMetric, scaleFactor);
              const targetRadius = calculateRadius(targetNode, sizeMetric, scaleFactor);
              
              const startX = sourceNode.x + (sourceRadius * dx / dr);
              const startY = sourceNode.y + (sourceRadius * dy / dr);
              const endX = targetNode.x - (targetRadius * dx / dr);
              const endY = targetNode.y - (targetRadius * dy / dr);
              
              // Create curves for multiple transactions
              const transactionIndex = d.transactionIndex || 0;
              const totalTransactions = d.totalTransactions;
              const spreadRange = 1.0;
              const spreadStep = spreadRange / Math.max(1, totalTransactions - 1);
              const spreadOffset = (transactionIndex * spreadStep) - (spreadRange / 2);
              
              const perpX = -dy / dr;
              const perpY = dx / dr;
              const curveDistance = 25 + Math.abs(spreadOffset) * 40;
              
              const midX = (startX + endX) / 2;
              const midY = (startY + endY) / 2;
              const controlX = midX + perpX * curveDistance * Math.sign(spreadOffset || 1);
              const controlY = midY + perpY * curveDistance * Math.sign(spreadOffset || 1);
              
              return `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
            } else {
              // Regular straight line
              return `M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`;
            }
          }
        });

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      }

      // Drag functions
      function dragstarted(event, d) {
        tooltip.style('display', 'none');
        closeContextMenu();
        
        // Gentle simulation activation for drag responsiveness - but only if simulation is stopped
        if (!event.active) simulation.alphaTarget(0.05).restart();
        d.fx = d.x;
        d.fy = d.y;
        
        // Track that dragging started
        d.isDragging = false; // Will be set to true if actually moved
        d.dragStartX = event.x;
        d.dragStartY = event.y;
        
        // If dragging a main node, store initial relative angles of connected counterparties
        if (d.isMain) {
          d.counterpartyAngles = new Map();
          nodes.forEach(node => {
            if (!node.isMain && !lockedNodes.has(node.id) && node.connectedMainAddresses && node.connectedMainAddresses.has(d.id)) {
              const dx = node.x - d.x;
              const dy = node.y - d.y;
              const angle = Math.atan2(dy, dx);
              const distance = Math.sqrt(dx * dx + dy * dy);
              d.counterpartyAngles.set(node.id, { angle, idealDistance: distance });
            }
          });
        }
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        
        // Set isDragging immediately when dragging starts
        d.isDragging = true;
        
        // Hide tooltip during drag
        tooltip.style('display', 'none');
        
        // If dragging a main node, apply gentle forces to maintain relative positions
        if (d.isMain && d.counterpartyAngles) {
          nodes.forEach(node => {
            if (!node.isMain && !lockedNodes.has(node.id) && d.counterpartyAngles.has(node.id)) {
              const stored = d.counterpartyAngles.get(node.id);
              const currentDx = node.x - d.fx;
              const currentDy = node.y - d.fy;
              const currentDistance = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
              
              // Calculate ideal position based on stored angle and distance
              const idealX = d.fx + stored.idealDistance * Math.cos(stored.angle);
              const idealY = d.fy + stored.idealDistance * Math.sin(stored.angle);
              
              // Apply gentle force towards ideal position (but not too strong to allow natural movement)
              const forceStrength = 0.15; // Gentle force to maintain position
              const pullX = (idealX - node.x) * forceStrength;
              const pullY = (idealY - node.y) * forceStrength;
              
              node.vx += pullX;
              node.vy += pullY;
              
              // Also prevent excessive stretching
              const maxDistance = stored.idealDistance * 1.3; // Allow 30% stretch
              if (currentDistance > maxDistance) {
                const pullStrength = 0.2;
                const excessPullFactor = (currentDistance - maxDistance) / currentDistance * pullStrength;
                node.vx -= currentDx * excessPullFactor;
                node.vy -= currentDy * excessPullFactor;
              }
            }
          });
        }
      }

      function dragended(event, d) {
        // Properly stop simulation when drag ends
        if (!event.active) simulation.alphaTarget(0);
        // Make both main nodes and counterparty nodes stick where they're dropped
        d.fx = d.x;
        d.fy = d.y;
        
        // Clean up stored angles
        if (d.isMain && d.counterpartyAngles) {
          delete d.counterpartyAngles;
        }
        
        // Mark counterparty nodes as locked when manually positioned (only if actually dragged)
        if (!d.isMain && d.isDragging) {
          onToggleNodeLock(d.id, true);
        }
        
        // Reset dragging flag after a short delay to allow click event to check it
        setTimeout(() => {
          d.isDragging = false;
        }, 100);
      }

      // Start simulation
      simulation
        .nodes(nodes)
        .on('tick', ticked);

      simulation.force('link').links(finalLinks);

      // Apply zoom transform
      svg.call(zoom).call(zoom.transform, oldTransform);

      // Gentle simulation restart
      simulation.alpha(0.1).restart(); // Reduced from 0.3 to prevent spasming

    } catch (error) {
      console.error('Error creating visualization:', error);
    }
  }, [data, sizeMetric, scaleFactor, labelMode, customLabels, customHighlights, highlightShared, lockedNodes, deletedNodes, expandedLinks, getProcessedData, processLinksWithExpansions, toggleLinkExpansion, timeframe, closeContextMenu]);

  // Effect to trigger visualization updates
  useEffect(() => {
    createVisualization();
  }, [createVisualization]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      createVisualization();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [createVisualization]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100vh',
          background: COLORS.BACKGROUND
        }}
      />

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          padding: '8px 12px',
          background: COLORS.UI_BACKGROUND,
          border: '1px solid #555',
          borderRadius: '4px',
          color: COLORS.TEXT,
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
        title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen'}
      >
        <span>{isFullscreen ? '⊡' : '⛶'}</span>
        <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
      </button>

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        node={contextMenu.node}
        onClose={closeContextMenu}
        onCopyAddress={handleCopyAddress}
        onSetCustomLabel={onSetCustomLabel}
        onSetCustomHighlight={onSetCustomHighlight}
        onAddWallet={onAddWallet}
        onDeleteNode={onDeleteNode}
      />
    </div>
  );
};

export default D3Visualization; 