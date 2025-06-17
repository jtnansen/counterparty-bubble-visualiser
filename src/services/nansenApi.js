// API endpoints - will be proxied by Vite locally and Vercel functions in production
const NANSEN_API_URL = '/api/nansen/api/beta/profiler/address/counterparties';
const NANSEN_TRANSACTIONS_API_URL = '/api/nansen/api/beta/profiler/address/transactions';

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

  // Calculate date range based on timeframe - use same format as counterparties API
  const today = new Date();
  const daysBack = {
    '30D': 30,
    '90D': 90,
    '1Y': 365,
    '5Y': 365 * 5
  };
  
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack[timeframe]);
  
  // Format dates as YYYY-MM-DD to match counterparties API
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const fromDate = customTimeRange.from || formatDate(startDate);
  const toDate = customTimeRange.to || formatDate(today);

  console.log('📅 Date calculation debug:');
  console.log('   Today:', today.toISOString());
  console.log('   Days back for', timeframe, ':', daysBack[timeframe]);
  console.log('   Start date:', startDate.toISOString());
  console.log('   Formatted from:', fromDate);
  console.log('   Formatted to:', toDate);

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

export async function fetchTransactionsBetweenAddresses(mainAddress, counterpartyAddress, timeframe = '30D') {
  const apiKey = import.meta.env.VITE_NANSEN_API_KEY;
  
  console.log('🔍 Fetching transactions between addresses:');
  console.log('   Main:', mainAddress);
  console.log('   Counterparty:', counterpartyAddress);
  console.log('   Timeframe:', timeframe);
  
  if (!apiKey) {
    throw new Error('Nansen API key not found. Please add it to your .env file.');
  }

  if (!mainAddress || !counterpartyAddress) {
    throw new Error('Both main address and counterparty address are required');
  }

  // Detect chain based on main address format
  let chain = "ethereum"; // default
  
  if (mainAddress.startsWith('0x') && mainAddress.length === 42) {
    chain = "ethereum";
  } else if (mainAddress.length >= 32 && mainAddress.length <= 44 && !mainAddress.startsWith('0x')) {
    chain = "solana";
  }

  // Calculate date range based on timeframe - use same format as counterparties API
  const today = new Date();
  const daysBack = {
    '30D': 30,
    '90D': 90,
    '1Y': 365,
    '5Y': 365 * 5
  };
  
  const startDate = new Date();
  startDate.setDate(today.getDate() - daysBack[timeframe]);
  
  // Format dates as YYYY-MM-DD to match counterparties API
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const fromDate = formatDate(startDate);
  const toDate = formatDate(today);

  console.log('📅 Date calculation debug:');
  console.log('   Today:', today.toISOString());
  console.log('   Days back for', timeframe, ':', daysBack[timeframe]);
  console.log('   Start date:', startDate.toISOString());
  console.log('   Formatted from:', fromDate);
  console.log('   Formatted to:', toDate);

  // Ensure consistent case for Ethereum addresses (lowercase)
  const normalizedMainAddress = chain === 'ethereum' ? mainAddress.toLowerCase() : mainAddress;
  const normalizedCounterpartyAddress = chain === 'ethereum' ? counterpartyAddress.toLowerCase() : counterpartyAddress;

  const requestBody = {
    "parameters": {
      "chain": chain,
      "walletAddresses": [normalizedMainAddress],
      "hideSpamToken": true
    },
    "pagination": {
      "page": 1,
      "recordsPerPage": 100  // Get more transactions for detailed view
    },
    "filters": {
      "volumeUsd": {
        "from": 0.1
      },
      "blockTimestamp": {
        "from": fromDate,
        "to": toDate
      },
      "counterpartyAddressHex": normalizedCounterpartyAddress
    }
  };

  console.log('📡 Transactions API request body:', JSON.stringify(requestBody, null, 2));
  console.log('🆚 COMPARISON WITH WORKING tx.py:');
  console.log('   tx.py uses dates: 2024-05-08 to 2025-01-07');
  console.log('   Our app uses dates:', fromDate, 'to', toDate);
  console.log('   tx.py main address: 0x4a7c6899cdcb379e284fbfd045462e751da4c7ce');
  console.log('   Our main address:', normalizedMainAddress);
  console.log('   tx.py counterparty: 0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c');
  console.log('   Our counterparty:', normalizedCounterpartyAddress);

  try {
    const response = await fetch(NANSEN_TRANSACTIONS_API_URL, {
      method: 'POST',
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    console.log('🌐 Response status:', response.status);
    console.log('🌐 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = JSON.stringify(errorData);
      } catch {
        errorMessage = await response.text();
      }
      console.error('Transactions API Response not OK:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorMessage
      });
      throw new Error(`Transactions API request failed (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    console.log('✅ Transactions API Response:', data);
    
    // Fix response parsing - the response might be a direct array or have different structure
    let transactions = [];
    if (Array.isArray(data)) {
      // Direct array response
      transactions = data;
    } else if (data.data && Array.isArray(data.data)) {
      // Wrapped in data property
      transactions = data.data;
    } else if (data.transactions && Array.isArray(data.transactions)) {
      // Wrapped in transactions property
      transactions = data.transactions;
    }
    
    // Log structure info for development
    if (transactions.length > 0) {
      console.log(`📊 Found ${transactions.length} transactions`);
      console.log('🎯 Sample transaction fields:', Object.keys(transactions[0]));
      console.log('🎯 Sample transaction:', transactions[0]);
    } else {
      console.log('⚠️ No transactions found between these addresses');
      console.log('🔍 Check if addresses are correctly formatted:');
      console.log('   Normalized main:', normalizedMainAddress);
      console.log('   Normalized counterparty:', normalizedCounterpartyAddress);
      console.log('🔍 Date range being used:', fromDate, 'to', toDate);
      console.log('🔍 Raw response structure:', data);
      
      // Test with exact same parameters as working tx.py
      if (normalizedMainAddress === '0x4a7c6899cdcb379e284fbfd045462e751da4c7ce' && 
          normalizedCounterpartyAddress === '0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c') {
        console.log('🚨 EXACT SAME ADDRESSES AS tx.py BUT NO RESULTS - API PROXY ISSUE?');
      }
    }
    
    // Return data in consistent format
    return {
      data: transactions,
      ...data
    };
  } catch (error) {
    console.error('❌ Error fetching transactions:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
} 