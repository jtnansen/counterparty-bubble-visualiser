import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { fetchCounterparties } from '../services/nansenApi';
import { validateAddress, calculateAutoScaleFactor } from '../utils/calculations.js';
import { transformApiTransaction, shouldFilterNode } from '../utils/nodeUtils.js';
import { FILTERS } from '../utils/constants.js';

export const useVisualizationData = () => {
  // Core data state
  const [data, setData] = useState([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [timeframe, setTimeframe] = useState('30D');
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState({ current: 0, total: 0 });
  
  // Filter states
  const [sizeMetric, setSizeMetric] = useState('uniform');
  const [showSmartContracts, setShowSmartContracts] = useState(true);
  const [showExchanges, setShowExchanges] = useState(true);
  const [rangeMin, setRangeMin] = useState(FILTERS.DEFAULT_RANGE_MIN);
  const [rangeMax, setRangeMax] = useState(FILTERS.DEFAULT_RANGE_MAX);
  const [highlightShared, setHighlightShared] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [labelMode, setLabelMode] = useState('address');
  
  // Node state management
  const [customLabels, setCustomLabels] = useState(new Map());
  const [customHighlights, setCustomHighlights] = useState(new Map());
  const [deletedNodes, setDeletedNodes] = useState(new Set());
  const [deletedNodesData, setDeletedNodesData] = useState(new Map());
  const [lockedNodes, setLockedNodes] = useState(new Set());

  // Clear error when user starts typing
  const handleWalletAddressChange = useCallback((address) => {
    setWalletAddress(address);
    if (error) setError(null);
  }, [error]);

  // Handle CSV file upload
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

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
          return totalVolume >= FILTERS.MIN_TOTAL_VOLUME;
        });

        setData(prevData => [...prevData, {
          mainAddress: address,
          transactions: filteredData
        }]);
      },
    });
  }, []);

  // Fetch API data for a wallet
  const handleApiDataFetch = useCallback(async (address = null) => {
    const addressToFetch = address || walletAddress;
    
    // Validate address
    const validation = validateAddress(addressToFetch);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiData = await fetchCounterparties(validation.address, timeframe);
      
      // Check if the API returned an error message
      if (apiData.error) {
        throw new Error(apiData.error);
      }
      
      // Transform API data to match internal format
      const counterpartiesArray = Array.isArray(apiData) ? apiData : (apiData.counterparties || []);
      
      // Check if we got any data
      if (!counterpartiesArray.length) {
        setError('No counterparty data found for this address');
        return;
      }
      
      const transformedData = {
        mainAddress: validation.address,
        transactions: counterpartiesArray.map(cp => transformApiTransaction(cp, validation.address))
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
  }, [walletAddress, timeframe]);

  // Handle timeframe changes and reload all wallets
  const handleTimeframeChange = useCallback(async (newTimeframe) => {
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
            transactions: counterpartiesArray.map(cp => transformApiTransaction(cp, address))
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
  }, [timeframe, isReloading, data]);

  // Auto-scale calculation when data or size metric changes
  const updateAutoScaleFactor = useCallback(() => {
    if (data.length > 0 && sizeMetric !== 'uniform') {
      const newScaleFactor = calculateAutoScaleFactor(data, sizeMetric);
      setScaleFactor(newScaleFactor);
    }
  }, [data, sizeMetric]);

  // Reset scale factor when switching to uniform
  const handleSizeMetricChange = useCallback((newSizeMetric) => {
    setSizeMetric(newSizeMetric);
    if (newSizeMetric === 'uniform') {
      setScaleFactor(1);
    } else {
      // Recalculate auto scale factor for new metric
      const newScaleFactor = calculateAutoScaleFactor(data, newSizeMetric);
      setScaleFactor(newScaleFactor);
    }
  }, [data]);

  // Process data with current filters to get nodes and links
  const getProcessedData = useCallback(() => {
    const nodes = [];
    const links = [];
    const addressMap = new Map();

    // First pass: add all main addresses
    data.forEach((dataSet) => {
      let mainWallet = addressMap.get(dataSet.mainAddress);
      if (!mainWallet) {
        mainWallet = { 
          id: dataSet.mainAddress,
          address: dataSet.mainAddress, 
          usdNetflow: 0, 
          volIn: 0,
          volOut: 0,
          isMain: true
        };
        nodes.push(mainWallet);
        addressMap.set(dataSet.mainAddress, mainWallet);
      } else {
        // Promote to main address if it was previously a counterparty
        mainWallet.isMain = true;
      }
    });

    // Second pass: add counterparties and links
    data.forEach((dataSet) => {
      dataSet.transactions.forEach((transaction) => {
        // Skip deleted nodes
        if (deletedNodes.has(transaction.interactingAddress)) {
          return;
        }

        const usdNetflow = parseFloat(transaction.usdNetflow);
        const volIn = parseFloat(transaction.volIn);
        const volOut = parseFloat(transaction.volOut);

        // Skip if all values are zero
        if (usdNetflow === 0 && volIn === 0 && volOut === 0) {
          return;
        }

        // Universal filter: Skip if Total Volume is less than $1
        const totalVolume = Math.abs(volIn) + Math.abs(volOut);
        if (totalVolume < FILTERS.MIN_TOTAL_VOLUME) {
          return;
        }

        // Filter smart contracts and exchanges
        const isSmartContractNode = transaction.interactingLabel?.includes(FILTERS.SMART_CONTRACT_EMOJI);
        const isExchangeNode = transaction.interactingLabel?.includes(FILTERS.EXCHANGE_EMOJI);
        
        if ((!showSmartContracts && isSmartContractNode) ||
            (!showExchanges && isExchangeNode)) {
          return;
        }

        // Range filtering
        let metricValue;
        if (sizeMetric === 'uniform') {
          metricValue = 0; // Skip range filtering for uniform sizing
        } else if (sizeMetric === 'totalVolume') {
          metricValue = volIn + volOut;
        } else {
          metricValue = parseFloat(transaction[sizeMetric]);
        }
        
        // Only apply range filtering if not using uniform sizing
        if (sizeMetric !== 'uniform' && 
            ((rangeMin !== '' && metricValue < parseFloat(rangeMin)) ||
             (rangeMax !== '' && metricValue > parseFloat(rangeMax)))) {
          return;
        }

        let node = addressMap.get(transaction.interactingAddress);
        if (!node) {
          node = {
            id: transaction.interactingAddress,
            address: transaction.interactingAddress,
            label: customLabels.get(transaction.interactingAddress) || transaction.interactingLabel,
            usdNetflow: usdNetflow,
            volIn: volIn,
            volOut: volOut,
            chain: transaction.chain,
            isMain: false,
            isSmartContract: isSmartContractNode,
            isExchange: isExchangeNode,
            connectedMainAddresses: new Set([dataSet.mainAddress])
          };
          nodes.push(node);
          addressMap.set(transaction.interactingAddress, node);
        } else if (!node.isMain) {
          node.usdNetflow += usdNetflow;
          node.volIn += volIn;
          node.volOut += volOut;
          node.connectedMainAddresses.add(dataSet.mainAddress);
        }

        links.push({
          source: dataSet.mainAddress,
          target: transaction.interactingAddress,
          value: usdNetflow
        });
      });
    });

    return { nodes, links, addressMap };
  }, [data, showSmartContracts, showExchanges, sizeMetric, rangeMin, rangeMax, deletedNodes, customLabels]);

  // Node management functions
  const deleteNode = useCallback((nodeId, isMainNode = false) => {
    if (isMainNode) {
      // Remove the main node's data from the data array
      setData(prevData => prevData.filter(d => d.mainAddress !== nodeId));
    } else {
      // Save the node data for restoration
      const { nodes } = getProcessedData();
      const nodeToDelete = nodes.find(n => n.id === nodeId);
      
      if (nodeToDelete) {
        setDeletedNodesData(prev => new Map(prev).set(nodeId, {
          ...nodeToDelete,
          deletedAt: new Date().toISOString()
        }));
      }
      
      // Add to deleted nodes set
      setDeletedNodes(prev => new Set(prev).add(nodeId));
    }
  }, [getProcessedData]);

  const restoreNode = useCallback((nodeId) => {
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
  }, []);

  const removeDeletedNodePermanently = useCallback((nodeId) => {
    setDeletedNodesData(prev => {
      const newMap = new Map(prev);
      newMap.delete(nodeId);
      return newMap;
    });
  }, []);

  // Bulk operations for deleted nodes
  const restoreAllNodes = useCallback(() => {
    setDeletedNodes(new Set());
    setDeletedNodesData(new Map());
  }, []);

  const removeAllDeletedNodesPermanently = useCallback(() => {
    setDeletedNodesData(new Map());
  }, []);

  // Custom label management
  const setCustomLabel = useCallback((nodeId, label) => {
    setCustomLabels(prev => new Map(prev).set(nodeId, label));
  }, []);

  // Custom highlight management
  const setCustomHighlight = useCallback((nodeId, color) => {
    if (color) {
      setCustomHighlights(prev => new Map(prev).set(nodeId, color));
    } else {
      setCustomHighlights(prev => {
        const newMap = new Map(prev);
        newMap.delete(nodeId);
        return newMap;
      });
    }
  }, []);

  // Lock/unlock nodes
  const toggleNodeLock = useCallback((nodeId, isLocked) => {
    if (isLocked) {
      setLockedNodes(prev => new Set(prev).add(nodeId));
    } else {
      setLockedNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  }, []);

  return {
    // Data state
    data,
    walletAddress,
    timeframe,
    
    // Loading states
    loading,
    error,
    isReloading,
    reloadProgress,
    
    // Filter states
    sizeMetric,
    showSmartContracts,
    showExchanges,
    rangeMin,
    rangeMax,
    highlightShared,
    scaleFactor,
    labelMode,
    
    // Node states
    customLabels,
    customHighlights,
    deletedNodes,
    deletedNodesData,
    lockedNodes,
    
    // Data processing
    getProcessedData,
    
    // Data management actions
    setWalletAddress: handleWalletAddressChange,
    handleFileUpload,
    handleApiDataFetch,
    handleTimeframeChange,
    handleSizeMetricChange,
    
    // Filter actions
    setSizeMetric: handleSizeMetricChange,
    setShowSmartContracts,
    setShowExchanges,
    setRangeMin,
    setRangeMax,
    setHighlightShared,
    setScaleFactor,
    setLabelMode,
    
    // Node management actions
    deleteNode,
    restoreNode,
    removeDeletedNodePermanently,
    restoreAllNodes,
    removeAllDeletedNodesPermanently,
    setCustomLabel,
    setCustomHighlight,
    toggleNodeLock,
    
    // Utility actions
    updateAutoScaleFactor
  };
}; 