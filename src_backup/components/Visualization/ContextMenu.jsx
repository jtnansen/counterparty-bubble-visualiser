import React from 'react';
import * as d3 from 'd3';
import { COLORS } from '../../utils/constants';

const ContextMenu = ({ 
  onAddWallet,
  customLabels, 
  setCustomLabels, 
  customHighlights, 
  setCustomHighlights,
  deletedNodes,
  setDeletedNodes,
  setDeletedNodesData,
  data,
  setData,
  highlightShared
}) => {
  
  const handleContextMenu = (event, d, nodeElement) => {
    event.preventDefault();
    event.stopPropagation();

    // Hide any existing color menus
    d3.selectAll('.color-menu').remove();

    // Create menu container
    const menu = d3.select('body')
      .append('div')
      .attr('class', 'context-menu')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background-color', COLORS.BACKGROUND)
      .style('border', `1px solid ${COLORS.BORDER}`)
      .style('padding', '5px')
      .style('border-radius', '4px')
      .style('color', 'white')
      .style('z-index', 1000);

    // Create menu items based on node type
    const menuOptions = [
      { label: 'Copy Address', action: 'copyAddress' },
      { label: 'Add temporary label', action: 'label' },
      { label: 'Highlight', action: 'highlight' },
      ...(d.isMain ? [] : [{ label: 'Add Wallet', action: 'addWallet' }]),
      { label: 'Delete bubble', action: 'delete' }
    ];

    menu.selectAll('div')
      .data(menuOptions)
      .enter()
      .append('div')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('hover', `background-color: ${COLORS.BORDER}`)
      .text(option => option.label)
      .on('click', function(event, menuItem) {
        event.preventDefault();
        event.stopPropagation();
        
        handleMenuAction(menuItem.action, d, nodeElement, menu, event);
      });

    menu
      .style('display', 'block')
      .style('left', `${event.pageX}px`)
      .style('top', `${event.pageY}px`);
  };

  const handleMenuAction = (action, selectedNode, nodeElement, menu, clickEvent) => {
    switch(action) {
      case 'copyAddress':
        navigator.clipboard.writeText(selectedNode.address).then(() => {
          console.log('Address copied to clipboard:', selectedNode.address);
        }).catch(err => {
          console.error('Failed to copy address:', err);
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = selectedNode.address;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        });
        menu.style('display', 'none');
        break;
      
      case 'label':
        const label = prompt('Enter label:');
        if (label) {
          setCustomLabels(prev => new Map(prev).set(selectedNode.id, label));
          nodeElement.select('text').text(label);
        }
        menu.style('display', 'none');
        break;
      
      case 'highlight':
        showHighlightMenu(selectedNode, nodeElement, menu, clickEvent);
        break;
      
      case 'addWallet':
        menu.style('display', 'none');
        // Add the counterparty as a main wallet and fetch immediately
        const address = selectedNode.address || selectedNode.id;
        onAddWallet(address);
        break;
        
      case 'delete':
        handleDeleteNode(selectedNode, menu);
        break;
    }
  };

  const showHighlightMenu = (selectedNode, nodeElement, menu, clickEvent) => {
    const colors = ['red', '#00FF00', 'yellow', '#8A2BE2', 'orange', 'white', '#87CEEB'];
    const colorMenu = d3.select('body')
      .append('div')
      .attr('class', 'color-menu')
      .style('position', 'absolute')
      .style('left', `${clickEvent.pageX}px`)
      .style('top', `${clickEvent.pageY}px`)
      .style('background-color', COLORS.BACKGROUND)
      .style('border', `1px solid ${COLORS.BORDER}`)
      .style('padding', '5px')
      .style('border-radius', '4px')
      .style('z-index', 1000);

    // Add remove highlight option
    colorMenu.append('div')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('background-color', 'black')
      .style('margin', '2px')
      .style('position', 'relative')
      .style('height', '20px')
      .on('click', function() {
        setCustomHighlights(prev => {
          const newHighlights = new Map(prev);
          newHighlights.delete(selectedNode.id);
          return newHighlights;
        });
        // Update node stroke to show shared highlight if applicable
        nodeElement.select('circle')
          .attr('stroke', (!selectedNode.isMain && highlightShared && selectedNode.connectedMainAddresses.size > 1) ? COLORS.SHARED_HIGHLIGHT : 'none')
          .attr('stroke-width', 2.6);
        colorMenu.remove();
        menu.style('display', 'none');
      })
      .append('div')
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .style('right', '0')
      .style('bottom', '0')
      .style('background', 'linear-gradient(to right top, transparent calc(50% - 1px), red, transparent calc(50% + 1px))');

    colorMenu.selectAll('.color-option')
      .data(colors)
      .enter()
      .append('div')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('background-color', d => d)
      .style('margin', '2px')
      .style('color', d => ['white', '#87CEEB'].includes(d) ? 'black' : 'white')
      .on('click', function(event, color) {
        setCustomHighlights(prev => new Map(prev).set(selectedNode.id, color));
        nodeElement.select('circle')
          .attr('stroke', color)
          .attr('stroke-width', 3.4);
        colorMenu.remove();
        menu.style('display', 'none');
      });

    menu.style('display', 'none');
  };

  const handleDeleteNode = (selectedNode, menu) => {
    const nodeId = selectedNode.id;
    menu.style('display', 'none');
    
    if (selectedNode.isMain) {
      // Remove the main node's data from the data array
      setData(prevData => prevData.filter(d => d.mainAddress !== nodeId));
    } else {
      // Save the node data for restoration
      setDeletedNodesData(prev => new Map(prev).set(nodeId, {
        ...selectedNode,
        deletedAt: new Date().toISOString()
      }));
      
      // Add to deleted nodes set
      setDeletedNodes(prev => new Set(prev).add(nodeId));
    }
  };

  return { handleContextMenu };
};

export default ContextMenu; 