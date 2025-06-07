const NANSEN_API_URL = '/api/nansen/api/beta/profiler/address/counterparties';

export async function fetchCounterparties(walletAddresses, timeframe = '30D', customTimeRange = { from: '', to: '' }) {
  const apiKey = import.meta.env.VITE_NANSEN_API_KEY;
  
  console.log('Environment variables available:', import.meta.env);
  console.log('API Key present:', !!apiKey);
  console.log('Input wallet addresses:', walletAddresses);
  console.log('Input timeframe:', timeframe);
  
  if (!apiKey) {
    throw new Error('Nansen API key not found. Please add it to your .env file.');
  }

  // Validate and format the address
  const address = Array.isArray(walletAddresses) ? walletAddresses[0] : walletAddresses;
  if (!address) {
    throw new Error('No wallet address provided');
  }

  // Detect chain based on address format
  let chain = "ethereum"; // default
  
  if (address.startsWith('0x') && address.length === 42) {
    chain = "ethereum";
  } else if (address.length >= 32 && address.length <= 44 && !address.startsWith('0x')) {
    chain = "solana";
  }
  
  console.log('Detected chain:', chain, 'for address:', address);

  // Calculate dates based on timeframe
  const today = new Date();
  const daysBack = {
    '30D': 30,
    '90D': 90,
    '1Y': 365,
    '5Y': 365 * 5
  };
  
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack[timeframe]);
  
  // Format dates as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const fromDate = customTimeRange.from || formatDate(startDate);
  const toDate = customTimeRange.to || formatDate(today);

  // Use the exact format from the API documentation
  const requestBody = {
    "parameters": {
      "walletAddresses": [address], // Always send as array with single address
      "chain": chain,
      "sourceInput": "Combined",
      "groupBy": "wallet",
      "timeRange": {
        "from": fromDate,
        "to": toDate
      }
    },
    "pagination": {
      "page": 1,
      "recordsPerPage": 100
    }
  };

  console.log('Complete request body being sent:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(NANSEN_API_URL, {
      method: 'POST',
      headers: {
        "apiKey": apiKey, // Revert back to original working format
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = JSON.stringify(errorData);
      } catch {
        errorMessage = await response.text();
      }
      console.error('API Response not OK:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorMessage
      });
      throw new Error(`API request failed (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    console.log('API Response:', data);
    return data;
  } catch (error) {
    console.error('Error fetching counterparty data:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
} 