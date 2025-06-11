import { SIZES, SCALE_FACTOR_RANGES, PHYSICS } from './constants.js';

/**
 * Calculate the radius for a node based on its properties and the current size metric
 */
export const calculateRadius = (node, sizeMetric, scaleFactor) => {
  if (node.isMain) {
    return SIZES.MAIN_NODE_RADIUS;
  }
  
  // Handle uniform sizing
  if (sizeMetric === 'uniform') {
    return SIZES.DEFAULT_COUNTERPARTY_RADIUS * scaleFactor;
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

/**
 * Format a number as a readable currency string
 */
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

/**
 * Calculate the appropriate scale factor based on the maximum volume in the dataset
 */
export const calculateAutoScaleFactor = (data, sizeMetric) => {
  if (sizeMetric === 'uniform') {
    return 1;
  }

  let maxTotalVolume = 0;
  data.forEach(dataSet => {
    dataSet.transactions.forEach(d => {
      const totalVolume = Math.abs(parseFloat(d.volIn)) + Math.abs(parseFloat(d.volOut));
      if (!d.isMain && totalVolume > maxTotalVolume) {
        maxTotalVolume = totalVolume;
      }
    });
  });

  // Find the appropriate scale factor
  for (const range of SCALE_FACTOR_RANGES) {
    if (maxTotalVolume > range.threshold) {
      return range.factor;
    }
  }
  
  return 1; // Default fallback
};

/**
 * Check if a value is within the specified range
 */
export const isWithinRange = (value, rangeMin, rangeMax) => {
  const min = rangeMin !== '' ? parseFloat(rangeMin) : null;
  const max = rangeMax !== '' ? parseFloat(rangeMax) : null;
  
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  
  return true;
};

/**
 * Calculate the distance between two points
 */
export const calculateDistance = (point1, point2) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate angle between two points
 */
export const calculateAngle = (point1, point2) => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.atan2(dy, dx);
};

/**
 * Calculate stroke width for a node based on its radius
 */
export const calculateStrokeWidth = (node, isHighlighted = false) => {
  if (isHighlighted) {
    return SIZES.STROKE_WIDTH.HIGHLIGHTED;
  }
  
  if (node.isMain) {
    return SIZES.STROKE_WIDTH.MAIN_NODE;
  }
  
  const radius = calculateRadius(node);
  return Math.max(1, radius * SIZES.STROKE_WIDTH.COUNTERPARTY_BASE);
};

/**
 * Validate if an address is a valid Ethereum or Solana address
 */
export const validateAddress = (address) => {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Address is required' };
  }

  const trimmed = address.trim();
  const isEthereum = trimmed.startsWith('0x') && trimmed.length === 42;
  const isSolana = trimmed.length >= 32 && trimmed.length <= 44 && !trimmed.startsWith('0x');
  
  if (!isEthereum && !isSolana) {
    return { 
      isValid: false, 
      error: 'Invalid wallet address format. Must be either an Ethereum (0x...) or Solana address' 
    };
  }
  
  return { isValid: true, address: trimmed, type: isEthereum ? 'ethereum' : 'solana' };
};

/**
 * Calculate collision radius for physics simulation
 */
export const calculateCollisionRadius = (node, sizeMetric, scaleFactor) => {
  const baseRadius = calculateRadius(node, sizeMetric, scaleFactor);
  return node.isMain 
    ? baseRadius * PHYSICS.COLLISION_PADDING_MAIN 
    : baseRadius + PHYSICS.COLLISION_PADDING_COUNTERPARTY;
}; 