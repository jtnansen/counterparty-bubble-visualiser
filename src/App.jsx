import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';
import { fetchCounterparties } from './services/nansenApi';

const App = () => {
  const [data, setData] = useState([]);
  const [sizeMetric, setSizeMetric] = useState('uniform');
  const [showSmartContracts, setShowSmartContracts] = useState(true);
  const [showExchanges, setShowExchanges] = useState(true);
  const [rangeMin, setRangeMin] = useState('1');
  const [rangeMax, setRangeMax] = useState('');
  const [highlightShared, setHighlightShared] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [labelMode, setLabelMode] = useState('address'); // 'label' or 'address' - default to 'address'
  const svgRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });
  const [customLabels, setCustomLabels] = useState(new Map());
  const [customHighlights, setCustomHighlights] = useState(new Map());
  const [deletedNodes, setDeletedNodes] = useState(new Set());
  const [currentTransform, setCurrentTransform] = useState(null);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [deletedNodesData, setDeletedNodesData] = useState(new Map()); // Store full node data for restoration
  const [timeframe, setTimeframe] = useState('30D');
  const [isReloading, setIsReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState({ current: 0, total: 0 });
  const [lockedNodes, setLockedNodes] = useState(new Set()); // Track manually positioned nodes

  // Add these color constants near the top of the file, after the useState declarations
  const GREEN_FILL = '#061019';//'#34CF82';
  const RED_FILL = '#061019';//'#FF7F7B';
  const GREEN_STROKE = '#34CF82';//'#29A568'; // 20% darker than #34CF82
  const RED_STROKE = '#FF7F7B'; //'#CC6562'; // 20% darker than #FF7F7B
  const NAVY_FILL = '#2a3f50';//'#061019';  // Dark navy color matching the nav bar
  const MAIN_NODE_STROKE ='#061019'; //'#2a3f50';  // Light grey that matches the border color used in UI

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

        // Filter out nodes with total volume less than 1
        const filteredData = Object.values(aggregatedData).filter(d => {
          const totalVolume = Math.abs(parseFloat(d.volIn)) + Math.abs(parseFloat(d.volOut));
          return totalVolume >= 1;
        });

        setData(prevData => [...prevData, {
          mainAddress: address,
          transactions: filteredData
        }]);
      },
    });
  };

  const handleApiDataFetch = async (address = null) => {
    const addressToFetch = String(address || walletAddress).trim();
    
    if (!addressToFetch) {
      setError('Please enter a wallet address');
      return;
    }

    // Validate address format
    const isEthereumAddress = addressToFetch.startsWith('0x') && addressToFetch.length === 42;
    const isSolanaAddress = addressToFetch.length >= 32 && addressToFetch.length <= 44 && !addressToFetch.startsWith('0x');
    
    if (!isEthereumAddress && !isSolanaAddress) {
      setError('Invalid wallet address format. Must be either an Ethereum (0x...) or Solana address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiData = await fetchCounterparties(addressToFetch, timeframe);
      
      // Check if the API returned an error message
      if (apiData.error) {
        throw new Error(apiData.error);
      }
      
      // Transform API data to match CSV format
      const counterpartiesArray = Array.isArray(apiData) ? apiData : (apiData.counterparties || []);
      
      // Check if we got any data
      if (!counterpartiesArray.length) {
        setError('No counterparty data found for this address');
        return;
      }
      
      const transformedData = {
        mainAddress: addressToFetch,
        transactions: counterpartiesArray.map((cp) => ({
          interactingAddress: cp.interactingAddress || cp.address || cp.wallet_address || cp.counterparty_address,
          volIn: cp.volIn || cp.volumeIn || cp.volume_in || cp.inflow || '0',
          volOut: cp.volOut || cp.volumeOut || cp.volume_out || cp.outflow || '0',
          usdNetflow: cp.usdNetflow || cp.netFlow || cp.net_flow || cp.usd_netflow || '0',
          label: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
          interactingLabel: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
          chain: cp.chain || (addressToFetch.startsWith('0x') ? 'ethereum' : 'solana'),
        }))
      };

      setData(prevData => [...prevData, transformedData]);
      
      // Only clear the input field if we're using the input field value
      if (!address) {
        setWalletAddress('');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (newTimeframe) => {
    if (newTimeframe === timeframe || isReloading) return;
    
    setTimeframe(newTimeframe);
    
    // Get all main addresses from current data
    const mainAddresses = data.map(d => d.mainAddress);
    
    if (mainAddresses.length === 0) return;
    
    setIsReloading(true);
    setReloadProgress({ current: 0, total: mainAddresses.length });
    
    try {
      const newData = [];
      
      for (let i = 0; i < mainAddresses.length; i++) {
        const address = mainAddresses[i];
        setReloadProgress({ current: i + 1, total: mainAddresses.length });
        
        try {
          const apiData = await fetchCounterparties(address, newTimeframe);
          
          const counterpartiesArray = Array.isArray(apiData) ? apiData : (apiData.counterparties || []);
          
          const transformedData = {
            mainAddress: address,
            transactions: counterpartiesArray.map(cp => ({
              interactingAddress: cp.interactingAddress || cp.address || cp.wallet_address || cp.counterparty_address,
              volIn: cp.volIn || cp.volumeIn || cp.volume_in || cp.inflow || '0',
              volOut: cp.volOut || cp.volumeOut || cp.volume_out || cp.outflow || '0',
              usdNetflow: cp.usdNetflow || cp.netFlow || cp.net_flow || cp.usd_netflow || '0',
              label: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
              interactingLabel: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
              chain: cp.chain || 'solana',
            }))
          };
          
          newData.push(transformedData);
        } catch (err) {
          console.error(`Error reloading wallet ${address}:`, err);
        }
      }
      
      setData(newData);
    } catch (err) {
      setError(`Error changing timeframe: ${err.message}`);
    } finally {
      setIsReloading(false);
    }
  };

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      // Only apply automatic scaling if not in uniform mode
      if (sizeMetric !== 'uniform') {
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
      }
      createVisualization(data);
    }
  }, [data]);

  // Reset scale factor to 1x when switching to uniform mode
  useEffect(() => {
    if (sizeMetric === 'uniform') {
      setScaleFactor(1);
    }
  }, [sizeMetric]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      createVisualization(data);
    }
  }, [data, sizeMetric, showSmartContracts, showExchanges, rangeMin, rangeMax, highlightShared, scaleFactor, deletedNodes, labelMode, lockedNodes]);

  const calculateRadius = (d) => {
    if (d.isMain) return 30; // Increased from 20 to 26 (30% bigger)
    
    // Handle uniform sizing
    if (sizeMetric === 'uniform') {
      return 24 * scaleFactor; // Apply scale factor to uniform sizing too
    }
    
    let value;
    if (sizeMetric === 'totalVolume') {
      value = Math.abs(d.volIn + d.volOut);
    } else {
      value = Math.abs(parseFloat(d[sizeMetric]));
    }
    
    // Base radius calculation
    const baseRadius = Math.sqrt(value) / 10 + 5;
    
    // Apply scale factor to all bubbles consistently
    return baseRadius * scaleFactor;
  };

  const isSmartContract = (label) => label && label.includes('🤖');
  const isExchange = (label) => label && label.includes('🏦');

  // Function to truncate text to fit within bubble radius
  const truncateTextForBubble = (text, radius) => {
    // Use more aggressive sizing to get closer to the border
    // Estimate characters that fit within the bubble diameter with smaller font
    const maxChars = Math.floor((radius * 2.2) / 4); // Increased from 6px to 4px per char, more space
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 2) + '..';
  };

  const cleanNansenLabel = (label) => {
    if (!label) return label;
    
    // Check if the entire label is just an address in brackets (like [0x123456])
    const addressOnlyPattern = /^\s*\[([^\]]+)\]\s*$/;
    const addressOnlyMatch = label.match(addressOnlyPattern);
    
    if (addressOnlyMatch) {
      // If it's just an address in brackets, return the address without brackets
      return addressOnlyMatch[1].trim();
    }
    
    // Otherwise, remove square brackets and everything inside them
    return label.replace(/\s*\[.*?\]\s*/g, '').trim();
  };

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
            .strength(d => d.isMain ? -1200 : -400)) // Increased repulsion for main nodes
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force('collision', d3.forceCollide().radius(d => {
            const baseRadius = calculateRadius(d);
            // Add much more padding around main nodes
            return d.isMain ? baseRadius * 3 : baseRadius + 2;
        }).strength(0.95)) // Increased collision strength
        .force('mainNodeRepulsion', d => {
            // Custom force to push non-main nodes away from main nodes
            return function(alpha) {
                const nodes = simulation.nodes();
                const mainNodes = nodes.filter(n => n.isMain);
                
                nodes.forEach(node => {
                    if (!node.isMain) {
                        mainNodes.forEach(mainNode => {
                            const dx = node.x - mainNode.x;
                            const dy = node.y - mainNode.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const minDistance = calculateRadius(mainNode) * 4; // Minimum safe distance
                            
                            if (distance < minDistance) {
                                const force = (minDistance - distance) / distance * alpha;
                                node.vx += dx * force;
                                node.vy += dy * force;
                            }
                        });
                    }
                });
            };
        });

    // Add velocity decay to reduce oscillation
    simulation.velocityDecay(0.4); // Increased from default 0.4 to reduce "bounciness"

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
      dataSet.transactions.forEach((d, index) => {
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

        // Universal filter: Skip if Total Volume is less than $1 (regardless of bubble size setting)
        const totalVolume = Math.abs(volIn) + Math.abs(volOut);
        if (totalVolume < 1) {
          return;
        }

        // Skip if outside the range for the selected metric
        let metricValue;
        if (sizeMetric === 'uniform') {
          // Skip range filtering for uniform sizing
          metricValue = 0;
        } else if (sizeMetric === 'totalVolume') {
          metricValue = volIn + volOut;
        } else {
          metricValue = parseFloat(d[sizeMetric]);
        }
        
        // Only apply range filtering if not using uniform sizing
        if (sizeMetric !== 'uniform' && 
            ((rangeMin !== '' && metricValue < parseFloat(rangeMin)) ||
             (rangeMax !== '' && metricValue > parseFloat(rangeMax)))) {
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
        // Restore fixed positions for main nodes and locked counterparty nodes
        if (node.isMain || lockedNodes.has(node.id)) {
          node.fx = oldPos.fx;
          node.fy = oldPos.fy;
        }
      }
    });

    // First create the container
    const container = svg.append('g')
        .attr('class', 'zoom-container');

    // Then set up zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            const { transform } = event;
            setCurrentTransform(transform);
            
            // Use CSS transform instead of attr transform for better performance
            container.style('transform', `translate(${transform.x}px,${transform.y}px) scale(${transform.k})`);
            
            // Batch DOM updates using requestAnimationFrame
            requestAnimationFrame(() => {
                // Update link stroke width only if zoom level changed significantly
                if (Math.abs(lastZoomK - transform.k) > 0.01) {
                    link.attr('stroke-width', 1 / transform.k);
                    lastZoomK = transform.k;
                }
                
                // Use more efficient selection and update strategy
                node.each(function(d) {
                    const el = d3.select(this);
                    const circle = el.select('circle');
                    const text = el.select('text');
                    
                    // Add null checks to prevent errors
                    if (circle.empty() || text.empty()) return;
                    
                    const radiusAttr = circle.attr('r');
                    if (!radiusAttr) return;
                    
                    const radius = parseFloat(radiusAttr);
                    
                    // Keep text size constant regardless of zoom
                    // Size text based on bubble radius, not zoom level
                    const fontSize = Math.min(7.2, radius * 0.27); // Reduced by 10% from 8 and 0.3
                    text.style('font-size', `${fontSize}px`);
                });
            });
        });

    // Add this variable to track zoom level changes
    let lastZoomK = 1;

    // Use hardware acceleration for transforms
    container.style('transform-origin', '0 0')
        .style('backface-visibility', 'hidden')
        .style('will-change', 'transform');

    // Add arrow marker definition
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
      .attr('fill', '#FFFFFF')
      .attr('d', 'M0,-5L10,0L0,5');

    const link = container.append('g')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', d => {
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);
        return (sourceNode.isMain && targetNode.isMain) ? '#FFFFFF' : (d.value > 0 ? '#34CF82' : '#FF7F7B');
      })
      .attr('stroke-width', d => {
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);
        return (sourceNode.isMain && targetNode.isMain) ? 1 : 0.25;
      })
      .attr('marker-end', d => {
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);
        return (sourceNode.isMain && targetNode.isMain) ? 'url(#arrow)' : '';
      })
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
      .attr('fill', d => d.isMain ? NAVY_FILL : (d.usdNetflow > 0 ? GREEN_FILL : RED_FILL))
      .attr('stroke', d => {
        const customHighlight = customHighlights.get(d.id);
        if (customHighlight) return customHighlight;
        if (d.isMain) {
            return MAIN_NODE_STROKE;
        }
        if (highlightShared && d.connectedMainAddresses.size > 1) {
            return '#008EFF';
        }
        return d.usdNetflow > 0 ? GREEN_STROKE : RED_STROKE;
      })
      .attr('stroke-width', d => {
        if (customHighlights.has(d.id)) return 3.4;
        if (d.isMain) return 2;  // Consistent rim width for main nodes
        const radius = calculateRadius(d);
        return Math.max(1, radius * 0.1);
      });

    node.append('text')
      .text(d => {
        const customLabel = customLabels.get(d.id);
        let displayText;
        
        if (customLabel) {
          displayText = customLabel;
        } else if (labelMode === 'address') {
          // Always use exactly 6 characters for address preview
          displayText = `${d.address.slice(0, 6)}${d.isSmartContract ? ' 🤖' : ''}${d.isExchange ? ' 🏦' : ''}`;
        } else {
          const cleanLabel = cleanNansenLabel(d.label || d.address.slice(0, 6));
          displayText = `${cleanLabel}${d.isSmartContract ? ' 🤖' : ''}${d.isExchange ? ' 🏦' : ''}`;
        }
        
        // Truncate text to fit within bubble
        return truncateTextForBubble(displayText, calculateRadius(d));
      })
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .style('font-weight', d => customLabels.has(d.id) ? '900' : 'normal')
      .style('font-size', d => `${Math.min(7.2, calculateRadius(d) * 0.27)}px`) // Reduced by 10% from 8 and 0.3
      .style('pointer-events', 'none'); // Prevent text from interfering with mouse events

    // Add lock symbols for manually positioned counterparty nodes
    node.filter(d => !d.isMain && lockedNodes.has(d.id))
      .append('text')
      .attr('class', 'lock-symbol')
      .text('🔒')
      .attr('x', d => -calculateRadius(d) * 0.7) // Position at top-left corner
      .attr('y', d => -calculateRadius(d) * 0.7)
      .attr('fill', '#FFFFFF')
      .style('font-size', '12px')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .style('filter', 'brightness(0) invert(1)') // Force white color for emoji
      .on('click', function(event, d) {
        event.stopPropagation(); // Prevent triggering node click
        // Unlock the node
        setLockedNodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(d.id);
          return newSet;
        });
        // Allow the node to move freely again
        d.fx = null;
        d.fy = null;
        // Remove the lock symbol
        d3.select(this).remove();
        // Restart simulation with higher energy to properly reposition the node
        simulation.alpha(0.5).alphaTarget(0.1).restart();
        // Reset alpha target after a delay to allow natural settling
        setTimeout(() => {
          simulation.alphaTarget(0);
        }, 1000);
      });

    // Create custom tooltip div
    const tooltip = d3.select('body')
      .select('.custom-tooltip')
      .empty() ? 
      d3.select('body')
        .append('div')
        .attr('class', 'custom-tooltip')
        .style('position', 'absolute')
        .style('background-color', '#061019')
        .style('border', '1px solid #2a3f50')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('color', 'white')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('z-index', 1000)
        .style('display', 'none')
        .style('max-width', '300px')
        .style('line-height', '1.4') :
      d3.select('.custom-tooltip');

    // Add instant hover events
    node
      .on('mouseenter', function(event, d) {
        let tooltipContent;
        
        if (d.isMain) {
          const label = customLabels.get(d.id) || d.address.slice(0, 6);
          tooltipContent = `<strong>${label}</strong><br><br>Main Address<br><br>${d.address}`;
        } else {
          const label = d.label || 'N/A';
          const mainInfo = `Netflow: ${formatNumber(d.usdNetflow)}<br>Volume In: ${formatNumber(d.volIn)}<br>Volume Out: ${formatNumber(d.volOut)}<br>Total Volume: ${formatNumber(d.volIn + d.volOut)}${d.isSmartContract ? '<br>Smart Contract' : ''}${d.isExchange ? '<br>Exchange' : ''}<br>Connected to ${d.connectedMainAddresses?.size || 0} main address(es)`;
          tooltipContent = `<strong>${label}</strong><br><br>${mainInfo}<br><br>${d.address}`;
        }
        
        tooltip
          .style('display', 'block')
          .html(tooltipContent)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      })
      .on('mouseleave', function() {
        tooltip.style('display', 'none');
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`);
      });

    // Add click handler to open Nansen profiler
    node.on('click', (event, d) => {
      // Only open link if this wasn't a drag operation
      if (!d.isDragging) {
        window.open(`https://app.nansen.ai/profiler?address=${d.address}&chain=${d.chain || 'ethereum'}&tab=overview`, '_blank');
      }
    });

    // Add context menu div to the visualization
    const menu = d3.select('body')
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

    // Modify the node contextmenu handler to stop event propagation
    node.on('contextmenu', function(event, d) {
        event.preventDefault();
        event.stopPropagation(); // Stop event from bubbling up to svg

        // Hide any existing color menus
        d3.selectAll('.color-menu').remove();

        // Clear previous menu items
        menu.selectAll('div').remove();
        
        // Create menu items based on node type
        const menuOptions = [
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
          .style('hover', 'background-color: #2a3f50')
          .text(option => option.label)
          .on('click', function(event, menuItem) {
            event.preventDefault();
            event.stopPropagation();
            
            const selectedNode = d; // Use the node data from the outer scope
            const nodeElement = d3.select(event.target.closest('.bubble'));
            
            switch(menuItem.action) {
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
              
              case 'addWallet':
                menu.style('display', 'none');
                // Add the counterparty as a main wallet and fetch immediately
                (async () => {
                  try {
                    console.log('Selected node:', selectedNode);
                    const address = selectedNode.address || selectedNode.id;
                    console.log('Using address:', address);
                    await handleApiDataFetch(address);
                  } catch (err) {
                    console.error('Failed to add wallet:', err);
                    setError(`Failed to add wallet: ${err.message}`);
                  }
                })();
                break;
                
              case 'delete':
                const nodeId = selectedNode.id;
                menu.style('display', 'none');
                
                if (selectedNode.isMain) {
                    // Remove the main node's data from the data array
                    setData(prevData => prevData.filter(d => d.mainAddress !== nodeId));
                    
                    // Don't add main nodes to deletedNodes since we're removing their data completely
                    // Just trigger visualization update - the createVisualization function will
                    // rebuild everything based on the remaining data
                    createVisualization(data.filter(d => d.mainAddress !== nodeId));
                } else {
                    // Save the node data for restoration
                    setDeletedNodesData(prev => new Map(prev).set(nodeId, {
                      ...selectedNode,
                      deletedAt: new Date().toISOString()
                    }));
                    
                    // Original code for deleting counterparty nodes
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
                }
                
                simulation.alpha(1).restart();
                break;
            }
          });

    menu
        .style('display', 'block')
        .style('left', `${event.pageX}px`)
        .style('top', `${event.pageY}px`);

    // Add click handler to hide context menu when clicking outside
    svg.on('click', () => {
        // Hide context menu
        d3.selectAll('.context-menu').style('display', 'none');
        // Also hide any color menus
        d3.selectAll('.color-menu').remove();
    });
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
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dr = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate node radii
          const sourceRadius = calculateRadius(sourceNode);
          const targetRadius = calculateRadius(targetNode);
          
          // Calculate start and end points at node borders
          const startX = d.source.x + (sourceRadius * dx / dr);
          const startY = d.source.y + (sourceRadius * dy / dr);
          const endX = d.target.x - (targetRadius * dx / dr);
          const endY = d.target.y - (targetRadius * dy / dr);
          
          // Calculate the points for the curved path
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          const curvature = 0.3;
          const controlX = midX + (dy * curvature);
          const controlY = midY - (dx * curvature);
          
          // Calculate the point slightly before the target for the arrow
          const t = 0.95; // Place arrow 95% along the path
          const qt = 1 - t;
          const arrowEndX = qt * qt * startX + 2 * qt * t * controlX + t * t * endX;
          const arrowEndY = qt * qt * startY + 2 * qt * t * controlY + t * t * endY;
          
          return `M${startX},${startY} Q${controlX},${controlY} ${arrowEndX},${arrowEndY}`;
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
      
      // Track that dragging started
      d.isDragging = false; // Will be set to true if actually moved
      d.dragStartX = event.x;
      d.dragStartY = event.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
      
      // Check if we've moved enough to consider this a drag
      const dx = event.x - d.dragStartX;
      const dy = event.y - d.dragStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) { // 5px threshold for drag vs click
        d.isDragging = true;
      }
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // Make both main nodes and counterparty nodes stick where they're dropped
      d.fx = d.x;
      d.fy = d.y;
      
      // Mark counterparty nodes as locked when manually positioned (only if actually dragged)
      if (!d.isMain && d.isDragging) {
        setLockedNodes(prev => new Set(prev).add(d.id));
      }
      
      // Reset dragging flag after a short delay to allow click event to check it
      setTimeout(() => {
        d.isDragging = false;
      }, 100);
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

    // Add a custom force to repel nodes from the line between main nodes
    function arrowRepulsionForce(alpha) {
        nodes.forEach(node => {
            if (!node.isMain) {
                links.forEach(link => {
                    const sourceNode = addressMap.get(link.source.id || link.source);
                    const targetNode = addressMap.get(link.target.id || link.target);

                    if (sourceNode.isMain && targetNode.isMain) {
                        const lineVec = { x: targetNode.x - sourceNode.x, y: targetNode.y - sourceNode.y };
                        const nodeVec = { x: node.x - sourceNode.x, y: node.y - sourceNode.y };
                        const lineLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
                        const projection = (nodeVec.x * lineVec.x + nodeVec.y * lineVec.y) / lineLength;
                        const closestPoint = {
                            x: sourceNode.x + (projection / lineLength) * lineVec.x,
                            y: sourceNode.y + (projection / lineLength) * lineVec.y
                        };
                        const distToLine = Math.sqrt((node.x - closestPoint.x) ** 2 + (node.y - closestPoint.y) ** 2);

                        const minDistance = 70; // Further increased minimum distance
                        if (distToLine < minDistance) {
                            const force = (minDistance - distToLine) / distToLine * alpha;
                            node.vx += (node.x - closestPoint.x) * force;
                            node.vy += (node.y - closestPoint.y) * force;
                        }
                    }
                });
            }
        });
    }

    // Add this force to the simulation
    simulation.force('arrowRepulsion', arrowRepulsionForce);

    // Modify the link path to use a curved path and add arrows
    link.attr('d', function(d) {
        const sourceNode = addressMap.get(d.source.id || d.source);
        const targetNode = addressMap.get(d.target.id || d.target);

        if (sourceNode.isMain && targetNode.isMain) {
            // Get the netflow value for arrow direction
            const sourceTransactions = data.find(set => set.mainAddress === sourceNode.id)?.transactions || [];
            const transaction = sourceTransactions.find(t => t.interactingAddress === targetNode.id);
            const netflow = transaction ? parseFloat(transaction.usdNetflow) : 0;
            
            // Add arrow marker based on netflow direction
            const isNetFlowLink = netflow < 0;  // Flipped logic
            d3.select(this).attr('marker-mid', isNetFlowLink ? 'url(#white-arrow)' : '');
            
            // Calculate node radii and border points
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            const sourceRadius = calculateRadius(sourceNode);
            const targetRadius = calculateRadius(targetNode);
            
            const startX = d.source.x + (sourceRadius * dx / dr);
            const startY = d.source.y + (sourceRadius * dy / dr);
            const endX = d.target.x - (targetRadius * dx / dr);
            const endY = d.target.y - (targetRadius * dy / dr);
            
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const controlX = midX + (dy * 0.6); // Further increased curvature
            const controlY = midY - (dx * 0.6);
            return `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
        } else {
            return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        }
    });
  };

  // Add restore function for deleted nodes
  const restoreNode = (nodeId) => {
    setDeletedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
    
    setDeletedNodesData(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  };

  return (
    <div className="App">
      <div className="controls" style={{ position: 'fixed', top: 0, left: 0, padding: '10px', zIndex: 1000, background: '#061019', color: 'white' }}>
        {/* Add new API input section */}
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter wallet address"
            style={{
              padding: '5px',
              marginRight: '10px',
              background: '#2a3f50',
              color: 'white',
              border: '1px solid #34CF82',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={() => handleApiDataFetch()}
            disabled={loading}
            style={{
              padding: '5px 10px',
              background: '#34CF82',
              color: '#061019',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Add Wallet'}
          </button>
        </div>
        {error && (
          <div style={{ color: '#FF7F7B', marginBottom: '10px' }}>
            {error}
          </div>
        )}
        
        {/* Existing file upload control */}
        <div style={{ marginBottom: '10px' }}>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".csv"
            style={{ color: 'white' }}
          />
        </div>
        
        {/* Timeframe Selector */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Timeframe:</label>
          <select
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            disabled={isReloading}
            style={{
              padding: '5px',
              background: '#2a3f50',
              color: 'white',
              border: '1px solid #34CF82',
              borderRadius: '4px'
            }}
          >
            <option value="30D">30 Days</option>
            <option value="90D">90 Days</option>
            <option value="1Y">1 Year</option>
            <option value="5Y">5 Years</option>
          </select>
          
          {/* Loading indicator */}
          {isReloading && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <div style={{ color: '#34CF82', marginBottom: '5px' }}>
                Reloading wallets: {reloadProgress.current}/{reloadProgress.total}
              </div>
              <div 
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #2a3f50',
                  borderTop: '2px solid #34CF82',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto'
                }}
              />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
        </div>
        
        {/* Size Metric Control */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Bubble Size:</label>
          <select
            value={sizeMetric}
            onChange={(e) => setSizeMetric(e.target.value)}
            style={{
              padding: '5px',
              background: '#2a3f50',
              color: 'white',
              border: '1px solid #34CF82',
              borderRadius: '4px'
            }}
          >
            <option value="totalVolume">Total Volume</option>
            <option value="usdNetflow">USD Netflow</option>
            <option value="volIn">Volume In</option>
            <option value="volOut">Volume Out</option>
            <option value="uniform">Uniform</option>
          </select>
        </div>

        {/* Label Mode Control */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Bubble Label:</label>
          <select
            value={labelMode}
            onChange={(e) => setLabelMode(e.target.value)}
            style={{
              padding: '5px',
              background: '#2a3f50',
              color: 'white',
              border: '1px solid #34CF82',
              borderRadius: '4px'
            }}
          >
            <option value="label">Nansen Labels</option>
            <option value="address">Addresses</option>
          </select>
        </div>

        {/* Filter Controls */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <input
              type="checkbox"
              checked={showSmartContracts}
              onChange={(e) => setShowSmartContracts(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Show Smart Contracts 🤖
          </label>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <input
              type="checkbox"
              checked={showExchanges}
              onChange={(e) => setShowExchanges(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Show Exchanges 🏦
          </label>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <input
              type="checkbox"
              checked={highlightShared}
              onChange={(e) => setHighlightShared(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Highlight Shared Counterparties
          </label>
        </div>

        {/* Range Controls */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ marginBottom: '5px' }}>
            <label style={{ marginRight: '10px' }}>Min Value:</label>
            <input
              type="number"
              value={rangeMin}
              onChange={(e) => setRangeMin(e.target.value)}
              placeholder="Min"
              style={{
                padding: '3px',
                width: '80px',
                background: '#2a3f50',
                color: 'white',
                border: '1px solid #34CF82',
                borderRadius: '4px'
              }}
            />
          </div>
          <div style={{ marginBottom: '5px' }}>
            <label style={{ marginRight: '10px' }}>Max Value:</label>
            <input
              type="number"
              value={rangeMax}
              onChange={(e) => setRangeMax(e.target.value)}
              placeholder="Max"
              style={{
                padding: '3px',
                width: '80px',
                background: '#2a3f50',
                color: 'white',
                border: '1px solid #34CF82',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* Scale Factor Control */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Scale Factor: {scaleFactor.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
            style={{ width: '200px' }}
          />
        </div>

        {/* Data Info */}
        {data.length > 0 && (
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            Loaded datasets: {data.length}<br/>
            Total addresses: {data.reduce((sum, d) => sum + d.transactions.length + 1, 0)}
          </div>
        )}
        
        {/* ... rest of the existing controls ... */}
      </div>
      <svg ref={svgRef}></svg>
      
      {/* Deleted Nodes Widget */}
      {deletedNodesData.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#061019',
          border: '1px solid #2a3f50',
          borderRadius: '8px',
          padding: '10px',
          maxWidth: '250px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
          color: 'white'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#34CF82' }}>
            Deleted Nodes ({deletedNodesData.size})
          </h4>
          {Array.from(deletedNodesData.entries()).map(([nodeId, nodeData]) => (
            <div key={nodeId} style={{
              marginBottom: '8px',
              padding: '8px',
              background: '#2a3f50',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {nodeData.label || nodeId.slice(0, 8) + '...'}
              </div>
              <div style={{ opacity: 0.8, marginBottom: '6px' }}>
                {nodeData.address.slice(0, 8) + '...'}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => restoreNode(nodeId)}
                  style={{
                    background: '#34CF82',
                    color: '#061019',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => {
                    setDeletedNodesData(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(nodeId);
                      return newMap;
                    });
                  }}
                  style={{
                    background: '#FF7F7B',
                    color: '#061019',
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;

