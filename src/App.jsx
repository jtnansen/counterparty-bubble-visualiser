import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';

const App = () => {
  const [data, setData] = useState([]);
  const [sizeMetric, setSizeMetric] = useState('totalVolume');
  const [showSmartContracts, setShowSmartContracts] = useState(true);
  const [showExchanges, setShowExchanges] = useState(true);
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [highlightShared, setHighlightShared] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const svgRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });
  const [customLabels, setCustomLabels] = useState(new Map());
  const [customHighlights, setCustomHighlights] = useState(new Map());
  const [deletedNodes, setDeletedNodes] = useState(new Set());
  const [currentTransform, setCurrentTransform] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const fileName = file.name;
    const address = fileName.split('.')[0]; // Extract address from filename

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        // Filter out any rows with empty or invalid data
        const validData = results.data.filter(row => 
          row.interactingAddress && 
          (parseFloat(row.volIn) !== 0 || parseFloat(row.volOut) !== 0 || parseFloat(row.usdNetflow) !== 0)
        );

        // Aggregate transactions by interacting address
        const aggregatedData = validData.reduce((acc, row) => {
          const key = row.interactingAddress;
          if (!acc[key]) {
            acc[key] = { ...row };
          } else {
            acc[key].volIn = (parseFloat(acc[key].volIn) + parseFloat(row.volIn)).toString();
            acc[key].volOut = (parseFloat(acc[key].volOut) + parseFloat(row.volOut)).toString();
            acc[key].usdNetflow = (parseFloat(acc[key].usdNetflow) + parseFloat(row.usdNetflow)).toString();
          }
          return acc;
        }, {});

        setData(prevData => [...prevData, {
          mainAddress: address,
          transactions: Object.values(aggregatedData)
        }]);
      },
    });
  };

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      // Check maximum total volume of any counterparty
      let maxTotalVolume = 0;
      data.forEach(dataSet => {
        dataSet.transactions.forEach(d => {
          const totalVolume = Math.abs(parseFloat(d.volIn)) + Math.abs(parseFloat(d.volOut));
          if (!d.isMain && totalVolume > maxTotalVolume) {
            maxTotalVolume = totalVolume;
          }
        });
      });

      // Set scale factor based on max total volume
      let newScaleFactor;
      if (maxTotalVolume > 30000000) {
        newScaleFactor = 0.1;
      } else if (maxTotalVolume > 20000000) {
        newScaleFactor = 0.2;
      } else if (maxTotalVolume > 10000000) {
        newScaleFactor = 0.3;
      } else if (maxTotalVolume > 5000000) {
        newScaleFactor = 0.4;
      } else if (maxTotalVolume > 1000000) {
        newScaleFactor = 0.5;
      } else {
        newScaleFactor = 1; // Default scale for smaller volumes
      }

      setScaleFactor(newScaleFactor);
      createVisualization(data);
    }
  }, [data]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      createVisualization(data);
    }
  }, [data, sizeMetric, showSmartContracts, showExchanges, rangeMin, rangeMax, highlightShared, scaleFactor, deletedNodes]);

  const calculateRadius = (d) => {
    if (d.isMain) return 20; // Main bubbles stay the same size
    
    let value;
    if (sizeMetric === 'totalVolume') {
      value = Math.abs(d.volIn + d.volOut);
    } else {
      value = Math.abs(parseFloat(d[sizeMetric]));
    }
    
    // Base radius calculation
    const baseRadius = Math.sqrt(value) / 10 + 5;
    
    // Apply non-linear scaling that affects larger bubbles more
    // For small bubbles (baseRadius < 20), scaling has minimal effect
    // For large bubbles, scaling has more dramatic effect
    const scaledRadius = baseRadius <= 20 
      ? baseRadius 
      : 20 + (baseRadius - 20) * scaleFactor;
    
    return scaledRadius;
  };

  const isSmartContract = (label) => label && label.includes('🤖');
  const isExchange = (label) => label && label.includes('🏦');

  const formatNumber = (value) => {
    const absValue = Math.abs(value);
    
    // Under 1,000
    if (absValue < 1000) {
      return `$${Math.round(value)}`;
    }
    // 1,000 - 100,000
    else if (absValue < 100000) {
      return `$${(Math.round(value / 100) / 10).toFixed(1)}K`;
    }
    // 100,000 - 1,000,000
    else if (absValue < 1000000) {
      return `$${(Math.round(value / 500) / 2).toFixed(1)}K`;
    }
    // 1,000,000 - 1,000,000,000
    else if (absValue < 1000000000) {
      return `$${(Math.round(value / 10000) / 100).toFixed(2)}M`;
    }
    // 1,000,000,000 - 1,000,000,000,000
    else if (absValue < 1000000000000) {
      return `$${(Math.round(value / 10000000) / 100).toFixed(2)}B`;
    }
    // Over 1 trillion
    else {
      return `$${(Math.round(value / 10000000000) / 100).toFixed(2)}T`;
    }
  };

  const createVisualization = (allData) => {
    // Modify simulation with stronger forces and custom collision handling
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody()
            .strength(d => d.isMain ? -800 : -400)) // Stronger repulsion for main nodes
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force('collision', d3.forceCollide().radius(d => {
            const baseRadius = calculateRadius(d);
            // Add extra padding around main nodes
            return d.isMain ? baseRadius * 2 : baseRadius + 5;
        }).strength(0.8)); // Increase collision strength

    // Add an additional force to push non-main nodes away from main nodes
    simulation.force('mainNodeRepulsion', d3.forceManyBody()
        .strength((d, i) => {
            if (d.isMain) return 0; // Main nodes don't repel each other
            return -600; // Strong repulsion for non-main nodes from main nodes
        })
        .distanceMax(300) // Limit the distance of repulsion effect
    );

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Store current transform before clearing
    const oldTransform = currentTransform || d3.zoomIdentity;

    // Store existing node positions before rebuilding
    const oldNodes = new Map();
    svg.selectAll('.bubble').each(function(d) {
      oldNodes.set(d.id, {
        x: d.x,
        y: d.y,
        fx: d.fx,
        fy: d.fy
      });
    });

    svg.selectAll("*").remove();
    svg.attr('width', width).attr('height', height);

    // Declare these as let instead of const since they're modified later
    let nodes = [];
    let links = [];
    const addressMap = new Map();

    // First pass: add all main addresses
    allData.forEach((dataSet) => {
      let mainWallet = addressMap.get(dataSet.mainAddress);
      if (!mainWallet) {
        mainWallet = { 
          id: dataSet.mainAddress,
          address: dataSet.mainAddress, 
          usdNetflow: 0, 
          volIn: 0,
          volOut: 0,
          x: Math.random() * width,
          y: Math.random() * height,
          isMain: true
        };
        nodes.push(mainWallet);
        addressMap.set(dataSet.mainAddress, mainWallet);
      } else {
        // Promote to main address if it was previously a counterparty
        mainWallet.isMain = true;
        mainWallet.x = mainWallet.x || Math.random() * width;
        mainWallet.y = mainWallet.y || Math.random() * height;
      }
    });

    // Second pass: add counterparties and links
    allData.forEach((dataSet) => {
      dataSet.transactions.forEach((d) => {
        // Skip if node was previously deleted
        if (deletedNodes.has(d.interactingAddress)) {
          return;
        }

        const usdNetflow = parseFloat(d.usdNetflow);
        const volIn = parseFloat(d.volIn);
        const volOut = parseFloat(d.volOut);

        // Skip if all values are zero
        if (usdNetflow === 0 && volIn === 0 && volOut === 0) {
          return;
        }

        // Skip if outside the range for the selected metric
        let metricValue;
        if (sizeMetric === 'totalVolume') {
          metricValue = volIn + volOut;
        } else {
          metricValue = parseFloat(d[sizeMetric]);
        }
        if ((rangeMin !== '' && metricValue < parseFloat(rangeMin)) ||
            (rangeMax !== '' && metricValue > parseFloat(rangeMax))) {
          return;
        }

        if ((!showSmartContracts && isSmartContract(d.interactingLabel)) ||
            (!showExchanges && isExchange(d.interactingLabel))) {
          return; // Skip if it's a hidden smart contract or exchange
        }

        let node = addressMap.get(d.interactingAddress);
        if (!node) {
          node = {
            id: d.interactingAddress,
            address: d.interactingAddress,
            label: customLabels.get(d.interactingAddress) || d.interactingLabel,
            usdNetflow: usdNetflow,
            volIn: volIn,
            volOut: volOut,
            chain: d.chain,
            isMain: false,
            isSmartContract: isSmartContract(d.interactingLabel),
            isExchange: isExchange(d.interactingLabel),
            connectedMainAddresses: new Set([dataSet.mainAddress])
          };
          nodes.push(node);
          addressMap.set(d.interactingAddress, node);
        } else if (!node.isMain) {
          node.usdNetflow += usdNetflow;
          node.volIn += volIn;
          node.volOut += volOut;
          node.connectedMainAddresses.add(dataSet.mainAddress);
        }

        links.push({
          source: dataSet.mainAddress,
          target: d.interactingAddress,
          value: usdNetflow
        });
      });
    });

    // When creating new nodes, restore their previous positions
    nodes.forEach(node => {
      const oldPos = oldNodes.get(node.id);
      if (oldPos) {
        node.x = oldPos.x;
        node.y = oldPos.y;
        if (node.isMain) {
          node.fx = oldPos.fx;
          node.fy = oldPos.fy;
        }
      }
    });

    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        setCurrentTransform(transform); // Store current transform
        svg.select('g.zoom-container')
          .attr('transform', transform);
        
        link
          .attr('stroke-width', 1 / transform.k);
        
        node.selectAll('circle')
          .attr('stroke-width', 2.6 / transform.k);
        
        node.each(function(d) {
          const circle = d3.select(this).select('circle');
          const text = d3.select(this).select('text');
          const radius = parseFloat(circle.attr('r'));
          const fontSize = Math.min(12 / transform.k, radius * 1.5);
          text.style('font-size', `${fontSize}px`);
        });
      });

    const container = svg.append('g')
      .attr('class', 'zoom-container');

    // Add arrow marker definition
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'white-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 5)
      .attr('refY', 0)
      .attr('markerWidth', 9)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', 'white')
      .attr('d', 'M0,-5L10,0L0,5');

    const link = container.append('g')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', d => {
        // Check if both nodes are main nodes by looking up their current status
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);
        return (sourceNode.isMain && targetNode.isMain) ? '#FFFFFF' : (d.value > 0 ? '#34CF82' : '#FF7F7B');
      })
      .attr('stroke-width', 1)
      .attr('fill', 'none');

    const node = container.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'bubble')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', d => calculateRadius(d))
      .attr('fill', d => d.isMain ? '#FFFFFF' : (d.usdNetflow > 0 ? '#34CF82' : '#FF7F7B'))
      .attr('stroke', d => {
        const customHighlight = customHighlights.get(d.id);
        if (customHighlight) return customHighlight;
        return (!d.isMain && highlightShared && d.connectedMainAddresses.size > 1) ? '#008EFF' : 'none';
      })
      .attr('stroke-width', d => customHighlights.has(d.id) ? 3.4 : 2.6);

    node.append('text')
      .text(d => {
        // Get first 6 characters without assuming "0x" prefix
        const addressStart = d.address.slice(0, 6);
        return `${addressStart}${d.isSmartContract ? ' 🤖' : ''}${d.isExchange ? ' 🏦' : ''}`;
      })
      .attr('dy', 4)
      .attr('fill', d => d.isMain ? '#000000' : '#FFFFFF');

    node.append('title')
      .text(d => {
        const totalVolume = d.volIn + d.volOut;
        return `Address: ${d.address}
Label: ${d.label || 'Main Address'}
Netflow: ${formatNumber(d.usdNetflow)}
Volume In: ${formatNumber(d.volIn)}
Volume Out: ${formatNumber(d.volOut)}
Total Volume: ${formatNumber(totalVolume)}${d.isSmartContract ? '\nSmart Contract' : ''}${d.isExchange ? '\nExchange' : ''}${!d.isMain ? `\nConnected to ${d.connectedMainAddresses.size} main address(es)` : ''}`;
      });

    node.on('click', (event, d) => {
      window.open(`https://app.nansen.ai/profiler?address=${d.address}&chain=${d.chain || 'ethereum'}&tab=overview`, '_blank');
    });

    // Add context menu div to the visualization
    const menu = d3.select('.visualizer')
      .append('div')
      .attr('class', 'context-menu')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background-color', '#061019')
      .style('border', '1px solid #2a3f50')
      .style('padding', '5px')
      .style('border-radius', '4px')
      .style('color', 'white')
      .style('z-index', 1000);

    // Add menu items
    const menuItems = menu.selectAll('div')
      .data([
        { label: 'Add temporary label', action: 'label' },
        { label: 'Highlight', action: 'highlight' },
        { label: 'Delete bubble', action: 'delete' }
      ])
      .enter()
      .append('div')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('hover', 'background-color: #2a3f50')
      .text(d => d.label)
      .on('click', function(event, d) {
        event.preventDefault();
        event.stopPropagation();
        
        const selectedNode = menu.node().__data__;
        const nodeElement = d3.select(menu.node().__element__);
        
        switch(d.action) {
          case 'label':
            const label = prompt('Enter label:');
            if (label) {
              setCustomLabels(prev => new Map(prev).set(selectedNode.id, label));
              nodeElement.select('text').text(label);
            }
            menu.style('display', 'none');
            break;
            
          case 'highlight':
            const colors = ['red', '#00FF00', 'yellow', '#8A2BE2', 'orange', 'white', '#87CEEB'];
            const colorMenu = d3.select('body')
              .append('div')
              .attr('class', 'color-menu')
              .style('position', 'absolute')
              .style('left', `${event.pageX}px`)
              .style('top', `${event.pageY}px`)
              .style('background-color', '#061019')
              .style('border', '1px solid #2a3f50')
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
                  .attr('stroke', (!selectedNode.isMain && highlightShared && selectedNode.connectedMainAddresses.size > 1) ? '#008EFF' : 'none')
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
                  .attr('stroke-width', 3.4); // 30% thicker
                colorMenu.remove();
                menu.style('display', 'none');
              });

            menu.style('display', 'none');
            break;
            
          case 'delete':
            const nodeId = selectedNode.id;
            menu.style('display', 'none');
            
            setDeletedNodes(prev => new Set(prev).add(nodeId));
            
            const newLinks = links.filter(l => l.source.id !== nodeId && l.target.id !== nodeId);
            const newNodes = nodes.filter(n => n.id !== nodeId);
            
            nodeElement.remove();
            link.filter(l => l.source.id === nodeId || l.target.id === nodeId).remove();
            
            simulation
              .nodes(newNodes)
              .force('link', d3.forceLink(newLinks).id(d => d.id).distance(100));
            
            links = newLinks;
            nodes = newNodes;
            
            simulation.alpha(1).restart();
            break;
        }
      });

    // Handle right-click on nodes
    node.on('contextmenu', function(event, d) {
      event.preventDefault();
      if (d.isMain) return; // Prevent context menu on main nodes

      // Hide any existing color menus
      d3.selectAll('.color-menu').remove();

      menu
        .style('display', 'block')
        .style('left', `${event.pageX}px`)
        .style('top', `${event.pageY}px`);

      // Store the selected node and its DOM element
      menu.node().__data__ = d;
      menu.node().__element__ = this;
    });

    simulation
      .nodes(nodes)
      .on('tick', ticked);

    simulation.force('link')
      .links(links);

    // Apply zoom transform at the end
    svg.call(zoom)
       .call(zoom.transform, oldTransform);

    // Gentle simulation restart
    simulation.alpha(0.3).restart();

    function ticked() {
      link.attr('d', function(d) {
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);
        
        if (sourceNode.isMain && targetNode.isMain) {
          // Get the netflow value from the source node's transactions
          const sourceTransactions = data.find(set => set.mainAddress === sourceNode.id)?.transactions || [];
          const transaction = sourceTransactions.find(t => t.interactingAddress === targetNode.id);
          const netflow = transaction ? parseFloat(transaction.usdNetflow) : 0;
          
          // FLIPPED LOGIC:
          // If netflow is positive, money is flowing TO source, arrow points FROM target TO source
          // If netflow is negative, money is flowing FROM source, arrow points FROM source TO target
          const isNetFlowLink = netflow < 0;  // Flipped from > to <
          
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          
          d3.select(this)
            .attr('marker-mid', isNetFlowLink ? 'url(#white-arrow)' : '');
          
          return `M${d.source.x},${d.source.y} L${midX},${midY} L${d.target.x},${d.target.y}`;
        } else {
          return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        }
      });

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    }

    function dragstarted(event, d) {
      // Hide all context menus when starting to drag
      d3.selectAll('.context-menu').style('display', 'none');
      d3.selectAll('.color-menu').remove();
      
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      if (d.isMain) {
        // Keep main addresses fixed at their new position
        d.fx = d.x;
        d.fy = d.y;
      } else {
        // Allow counterparty bubbles to float freely again
        d.fx = null;
        d.fy = null;
      }
    }

    // Apply stored highlights after node creation
    node.each(function(d) {
      const highlightColor = customHighlights.get(d.id);
      if (highlightColor) {
        d3.select(this).select('circle')
          .attr('stroke', highlightColor)
          .attr('stroke-width', 2.6);
      }
    });
  };

  return (
    <div className="App">
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0,
        backgroundColor: '#061019', 
        padding: '10px',
        zIndex: 1000,
        borderBottom: '1px solid #2a3f50',
        color: 'white',
        minHeight: '150px',
        display: 'block'
      }}>
        <input type="file" onChange={handleFileUpload} accept=".csv" />
        <div>
          <label>
            <input
              type="radio"
              value="usdNetflow"
              checked={sizeMetric === 'usdNetflow'}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setSizeMetric(e.target.value);
              }}
            /> USD Netflow
          </label>
          <label>
            <input
              type="radio"
              value="volIn"
              checked={sizeMetric === 'volIn'}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setSizeMetric(e.target.value);
              }}
            /> Volume In
          </label>
          <label>
            <input
              type="radio"
              value="volOut"
              checked={sizeMetric === 'volOut'}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setSizeMetric(e.target.value);
              }}
            /> Volume Out
          </label>
          <label>
            <input
              type="radio"
              value="totalVolume"
              checked={sizeMetric === 'totalVolume'}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setSizeMetric(e.target.value);
              }}
            /> Total Volume
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={showSmartContracts}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setShowSmartContracts(e.target.checked);
              }}
            /> Show Smart Contracts
          </label>
          <label>
            <input
              type="checkbox"
              checked={showExchanges}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setShowExchanges(e.target.checked);
              }}
            /> Show Exchanges
          </label>
          <label>
            <input
              type="checkbox"
              checked={highlightShared}
              onChange={(e) => {
                d3.selectAll('.color-menu').remove();
                setHighlightShared(e.target.checked);
              }}
            /> Highlight Shared Counterparties
          </label>
        </div>
        <div>
          <label>Min {sizeMetric}:</label>
          <input
            type="text"
            value={rangeMin}
            onChange={(e) => {
              d3.selectAll('.color-menu').remove();
              setRangeMin(e.target.value);
            }}
          />
          <label>Max {sizeMetric}:</label>
          <input
            type="text"
            value={rangeMax}
            onChange={(e) => {
              d3.selectAll('.color-menu').remove();
              setRangeMax(e.target.value);
            }}
          />
        </div>
        <div>
          <label>Bubble Size Scale:</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={scaleFactor}
            onChange={(e) => {
              d3.selectAll('.color-menu').remove();
              setScaleFactor(parseFloat(e.target.value));
            }}
          />
          {scaleFactor}x
        </div>
      </div>

      {/* Add deleted nodes list */}
      <div className="deleted-nodes-box" style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        maxHeight: '200px',
        width: '250px',
        backgroundColor: '#061019',
        border: '1px solid #2a3f50',
        borderRadius: '4px',
        padding: '10px',
        overflowY: 'auto',
        color: 'white',
        zIndex: 1000
      }}>
        <div style={{ 
          borderBottom: '1px solid #2a3f50', 
          paddingBottom: '5px', 
          marginBottom: '5px',
          fontWeight: 'bold' 
        }}>
          Deleted Nodes ({deletedNodes.size})
        </div>
        {Array.from(deletedNodes).map(address => (
          <div key={address} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '5px 0',
            borderBottom: '1px solid #2a3f50',
            fontSize: '0.9em'
          }}>
            <span>0x{address.slice(2, 6)}...</span>
            <button
              onClick={() => {
                // Remove from deleted nodes
                setDeletedNodes(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(address);
                  return newSet;
                });
                // Hide context menu
                d3.selectAll('.context-menu').style('display', 'none');
                // Trigger complete visualization update with all data
                createVisualization(data);
              }}
              style={{
                backgroundColor: '#2a3f50',
                border: 'none',
                color: 'white',
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Restore
            </button>
          </div>
        ))}
        {deletedNodes.size === 0 && (
          <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
            No deleted nodes
          </div>
        )}
      </div>

      <div className="visualizer" style={{ marginTop: '200px' }}>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default App;
