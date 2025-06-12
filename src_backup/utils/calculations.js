import { SIZES } from './constants.js';

export const calculateRadius = (node, sizeMetric, scaleFactor) => {
  if (node.isMain) return SIZES.MAIN_NODE_RADIUS;
  
  // Handle uniform sizing
  if (sizeMetric === 'uniform') {
    return SIZES.UNIFORM_NODE_RADIUS * scaleFactor;
  }
  
  let value;
  if (sizeMetric === 'totalVolume') {
    value = Math.abs(node.volIn + node.volOut);
  } else {
    value = Math.abs(parseFloat(node[sizeMetric]));
  }
  
  // Base radius calculation
  const baseRadius = Math.sqrt(value) / 10 + 5;
  
  // Apply scale factor to all bubbles consistently
  return baseRadius * scaleFactor;
};

export const formatNumber = (value) => {
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

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const detectChain = (address) => {
  if (address.startsWith('0x') && address.length === 42) {
    return 'ethereum';
  } else if (address.length >= 32 && address.length <= 44 && !address.startsWith('0x')) {
    return 'solana';
  }
  return 'ethereum'; // default
};

export const normalizeAddress = (address, chain) => {
  return chain === 'ethereum' ? address.toLowerCase() : address;
};

export const calculateAutoScaleFactor = (data, sizeMetric) => {
  if (sizeMetric === 'uniform') return 1;
  
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
  if (maxTotalVolume > 30000000) {
    return 0.1;
  } else if (maxTotalVolume > 20000000) {
    return 0.2;
  } else if (maxTotalVolume > 10000000) {
    return 0.3;
  } else if (maxTotalVolume > 5000000) {
    return 0.4;
  } else if (maxTotalVolume > 1000000) {
    return 0.5;
  } else {
    return 1; // Default scale for smaller volumes
  }
}; 