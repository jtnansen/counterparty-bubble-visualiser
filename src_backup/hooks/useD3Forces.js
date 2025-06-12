import { useCallback } from 'react';
import * as d3 from 'd3';
import { PHYSICS } from '../utils/constants';
import { calculateRadius } from '../utils/calculations';

export const useD3Forces = (sizeMetric, scaleFactor, lockedNodes) => {
  
  const createSimulation = useCallback((allData) => {
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id)
        .distance(d => {
          const sourceNode = allData.flatMap(ds => [
            { ...ds, id: ds.mainAddress, isMain: true },
            ...ds.transactions.map(t => ({ ...t, id: t.interactingAddress, isMain: false }))
          ]).find(n => n.id === d.source) || {};
          const targetNode = allData.flatMap(ds => [
            { ...ds, id: ds.mainAddress, isMain: true },
            ...ds.transactions.map(t => ({ ...t, id: t.interactingAddress, isMain: false }))
          ]).find(n => n.id === d.target) || {};
          
          // Longer pendulum distances for main-to-counterparty connections
          if ((sourceNode.isMain && !targetNode.isMain) || (!sourceNode.isMain && targetNode.isMain)) {
            return PHYSICS.PENDULUM_DISTANCE;
          }
          return PHYSICS.MAIN_TO_MAIN_DISTANCE;
        })
        .strength(PHYSICS.LINK_STRENGTH))
      .force('charge', d3.forceManyBody()
        .strength(d => d.isMain ? PHYSICS.MAIN_NODE_CHARGE : PHYSICS.COUNTERPARTY_CHARGE))
      .force('collision', d3.forceCollide().radius(d => {
        const baseRadius = calculateRadius(d, sizeMetric, scaleFactor);
        return d.isMain ? baseRadius * 4 : baseRadius + 1;
      }).strength(PHYSICS.COLLISION_STRENGTH))
      .force('mainNodeRepulsion', () => {
        return function(alpha) {
          const nodes = simulation.nodes();
          const mainNodes = nodes.filter(n => n.isMain);
          
          nodes.forEach(node => {
            if (!node.isMain) {
              mainNodes.forEach(mainNode => {
                const dx = node.x - mainNode.x;
                const dy = node.y - mainNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = calculateRadius(mainNode, sizeMetric, scaleFactor) * PHYSICS.MAIN_NODE_BUFFER_MULTIPLIER;
                
                if (distance < minDistance) {
                  const force = (minDistance - distance) / distance * alpha * 0.5;
                  node.vx += dx * force;
                  node.vy += dy * force;
                }
              });
            }
          });
        };
      })
      .force('pendulumMaintenance', () => {
        return function(alpha) {
          const nodes = simulation.nodes();
          
          nodes.forEach(node => {
            if (!node.isMain && !lockedNodes.has(node.id)) {
              // Find the main node this counterparty is connected to
              const connectedMainAddress = Array.from(node.connectedMainAddresses || [])[0];
              const mainNode = nodes.find(n => n.id === connectedMainAddress);
              
              if (mainNode) {
                const dx = node.x - mainNode.x;
                const dy = node.y - mainNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const idealDistance = PHYSICS.PENDULUM_DISTANCE;
                
                if (Math.abs(distance - idealDistance) > 20) {
                  const forceStrength = (distance - idealDistance) / distance * alpha * 0.4;
                  node.vx -= dx * forceStrength;
                  node.vy -= dy * forceStrength;
                }
              }
            }
          });
        };
      });

    // Increased velocity decay for more damping
    simulation.velocityDecay(PHYSICS.VELOCITY_DECAY);

    return simulation;
  }, [sizeMetric, scaleFactor, lockedNodes]);

  const createArrowRepulsionForce = useCallback((addressMap, finalLinks, sizeMetric, scaleFactor) => {
    return function(alpha) {
      const nodes = this.nodes();
      nodes.forEach(node => {
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

              if (distToLine < PHYSICS.ARROW_REPULSION_DISTANCE) {
                const force = (PHYSICS.ARROW_REPULSION_DISTANCE - distToLine) / distToLine * alpha * 0.4;
                node.vx += (node.x - closestPoint.x) * force;
                node.vy += (node.y - closestPoint.y) * force;
              }
            }
          });
        }
      });
    };
  }, []);

  const createDragBehaviors = useCallback((simulation, lockedNodes, setLockedNodes, tooltip) => {
    const dragstarted = (event, d) => {
      // Hide all context menus when starting to drag
      d3.selectAll('.context-menu').style('display', 'none');
      d3.selectAll('.color-menu').remove();
      
      // Hide tooltip when starting to drag
      tooltip.style('display', 'none');
      
      if (!event.active) simulation.alphaTarget(0.1).restart();
      d.fx = d.x;
      d.fy = d.y;
      
      // Track that dragging started
      d.isDragging = false;
      d.dragStartX = event.x;
      d.dragStartY = event.y;
      
      // If dragging a main node, store initial relative angles of connected counterparties
      if (d.isMain) {
        d.counterpartyAngles = new Map();
        simulation.nodes().forEach(node => {
          if (!node.isMain && !lockedNodes.has(node.id) && node.connectedMainAddresses && node.connectedMainAddresses.has(d.id)) {
            const dx = node.x - d.x;
            const dy = node.y - d.y;
            const angle = Math.atan2(dy, dx);
            const distance = Math.sqrt(dx * dx + dy * dy);
            d.counterpartyAngles.set(node.id, { angle, idealDistance: distance });
          }
        });
      }
    };

    const dragged = (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
      
      // If dragging a main node, apply gentle forces to maintain relative positions
      if (d.isMain && d.counterpartyAngles) {
        simulation.nodes().forEach(node => {
          if (!node.isMain && !lockedNodes.has(node.id) && d.counterpartyAngles.has(node.id)) {
            const stored = d.counterpartyAngles.get(node.id);
            const currentDx = node.x - d.fx;
            const currentDy = node.y - d.fy;
            const currentDistance = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
            
            // Calculate ideal position based on stored angle and distance
            const idealX = d.fx + stored.idealDistance * Math.cos(stored.angle);
            const idealY = d.fy + stored.idealDistance * Math.sin(stored.angle);
            
            // Apply gentle force towards ideal position
            const forceStrength = 0.15;
            const pullX = (idealX - node.x) * forceStrength;
            const pullY = (idealY - node.y) * forceStrength;
            
            node.vx += pullX;
            node.vy += pullY;
            
            // Also prevent excessive stretching
            const maxDistance = stored.idealDistance * 1.3;
            if (currentDistance > maxDistance) {
              const pullStrength = 0.2;
              const excessPullFactor = (currentDistance - maxDistance) / currentDistance * pullStrength;
              node.vx -= currentDx * excessPullFactor;
              node.vy -= currentDy * excessPullFactor;
            }
          }
        });
      }
      
      // Check if we've moved enough to consider this a drag
      const dragDistance = Math.sqrt((event.x - d.dragStartX) ** 2 + (event.y - d.dragStartY) ** 2);
      
      if (dragDistance > 5) { // 5px threshold for drag vs click
        d.isDragging = true;
      }
    };

    const dragended = (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = d.x;
      d.fy = d.y;
      
      // Clean up stored angles
      if (d.isMain && d.counterpartyAngles) {
        delete d.counterpartyAngles;
      }
      
      // Mark counterparty nodes as locked when manually positioned
      if (!d.isMain && d.isDragging) {
        setLockedNodes(prev => new Set(prev).add(d.id));
      }
      
      // Reset dragging flag after a short delay to allow click event to check it
      setTimeout(() => {
        d.isDragging = false;
      }, 100);
    };

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }, []);

  return {
    createSimulation,
    createArrowRepulsionForce,
    createDragBehaviors
  };
}; 