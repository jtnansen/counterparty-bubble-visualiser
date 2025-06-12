import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { fetchCounterparties } from '../services/nansenApi';
import { detectChain } from '../utils/calculations';

export const useVisualizationData = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('30D');
  const [isReloading, setIsReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = useCallback((event) => {
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
  }, []);

  const handleApiDataFetch = useCallback(async (address = null, walletAddress = '') => {
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
          chain: cp.chain || detectChain(addressToFetch),
        }))
      };

      setData(prevData => [...prevData, transformedData]);
      return true; // Success
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      return false; // Failure
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

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
  }, [data, timeframe, isReloading]);

  const removeDataset = useCallback((mainAddress) => {
    setData(prevData => prevData.filter(d => d.mainAddress !== mainAddress));
  }, []);

  const clearAllData = useCallback(() => {
    setData([]);
  }, []);

  return {
    data,
    setData,
    loading,
    error,
    setError,
    timeframe,
    isReloading,
    reloadProgress,
    handleFileUpload,
    handleApiDataFetch,
    handleTimeframeChange,
    removeDataset,
    clearAllData
  };
}; 