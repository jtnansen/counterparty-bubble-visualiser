import { FILTERS, UI, POSITIONING, COLORS } from './constants.js';
import { calculateRadius } from './calculations.js';

/**
 * Check if a label indicates a smart contract
 */
export const isSmartContract = (label) => {
  return label && label.includes(FILTERS.SMART_CONTRACT_EMOJI);
};

/**
 * Check if a label indicates an exchange
 */
export const isExchange = (label) => {
  return label && label.includes(FILTERS.EXCHANGE_EMOJI);
};

/**
 * Clean Nansen labels by removing address brackets
 */
export const cleanNansenLabel = (label) => {
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

/**
 * Truncate text to fit within a bubble radius
 */
export const truncateTextForBubble = (text, radius) => {
  // Use more aggressive sizing to get closer to the border
  // Estimate characters that fit within the bubble diameter with smaller font
  const maxChars = Math.floor((radius * UI.TEXT_TRUNCATION_RATIO) / 4);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 2) + '..';
};

/**
 * Get display text for a node based on label mode and custom settings
 */
export const getNodeDisplayText = (node, labelMode, customLabels, sizeMetric, scaleFactor) => {
  const customLabel = customLabels.get(node.id);
  let displayText;
  
  if (customLabel) {
    displayText = customLabel;
  } else if (labelMode === 'address') {
    // Always use exactly 6 characters for address preview
    displayText = `${node.address.slice(0, 6)}${node.isSmartContract ? ` ${FILTERS.SMART_CONTRACT_EMOJI}` : ''}${node.isExchange ? ` ${FILTERS.EXCHANGE_EMOJI}` : ''}`;
  } else {
    const cleanLabel = cleanNansenLabel(node.label || node.address.slice(0, 6));
    displayText = `${cleanLabel}${node.isSmartContract ? ` ${FILTERS.SMART_CONTRACT_EMOJI}` : ''}${node.isExchange ? ` ${FILTERS.EXCHANGE_EMOJI}` : ''}`;
  }
  
  // Truncate text to fit within bubble
  const radius = calculateRadius(node, sizeMetric, scaleFactor);
  return truncateTextForBubble(displayText, radius);
};

/**
 * Calculate font size for node text based on radius
 */
export const calculateFontSize = (node, sizeMetric, scaleFactor) => {
  const radius = calculateRadius(node, sizeMetric, scaleFactor);
  return Math.min(UI.FONT_SIZE_MAX, radius * UI.FONT_SIZE_RATIO);
};

/**
 * Position new counterparty nodes based on netflow relative to main node
 */
export const positionNewCounterpartyNode = (node, mainNode, width, height) => {
  if (mainNode && mainNode.x && mainNode.y) {
    // Positive netflow (receiving money) goes to the left, negative netflow (sending money) goes to the right
    const side = node.usdNetflow > 0 ? -1 : 1; // Left side for positive, right side for negative
    const distance = POSITIONING.PENDULUM_BASE_DISTANCE + Math.random() * POSITIONING.PENDULUM_DISTANCE_VARIANCE;
    const angle = (Math.random() - 0.5) * Math.PI * POSITIONING.PENDULUM_ANGLE_SPREAD;
    
    node.x = mainNode.x + side * distance * Math.cos(angle);
    node.y = mainNode.y + distance * Math.sin(angle);
  } else {
    // Fallback to random positioning if main node position is not available
    node.x = Math.random() * width;
    node.y = Math.random() * height;
  }
};

/**
 * Get stroke color for a node based on its properties and state
 */
export const getNodeStrokeColor = (node, customHighlights, highlightShared, selectedNodeId = null) => {
  const customHighlight = customHighlights.get(node.id);
  if (customHighlight) return customHighlight;

  // Highlight selected node from dropdown
  if (selectedNodeId && node.id === selectedNodeId) {
    return COLORS.BLUE_HIGHLIGHT;
  }

  if (node.isMain) {
    return COLORS.MAIN_NODE_STROKE;
  }

  if (highlightShared && node.connectedMainAddresses?.size > 1) {
    return COLORS.BLUE_HIGHLIGHT;
  }

  return node.usdNetflow > 0 ? COLORS.GREEN_STROKE : COLORS.RED_STROKE;
};

/**
 * Get fill color for a node
 */
export const getNodeFillColor = (node) => {
  if (node.isMain) {
    return COLORS.NAVY_FILL;
  }
  
  return node.usdNetflow > 0 ? COLORS.GREEN_FILL : COLORS.RED_FILL;
};

/**
 * Check if a node should be filtered out based on current filter settings
 */
export const shouldFilterNode = (transaction, filters) => {
  const {
    showSmartContracts,
    showExchanges, 
    sizeMetric,
    rangeMin,
    rangeMax,
    deletedNodes
  } = filters;

  // Skip if node was previously deleted
  if (deletedNodes.has(transaction.interactingAddress)) {
    return true;
  }

  const usdNetflow = parseFloat(transaction.usdNetflow);
  const volIn = parseFloat(transaction.volIn);
  const volOut = parseFloat(transaction.volOut);

  // Skip if all values are zero
  if (usdNetflow === 0 && volIn === 0 && volOut === 0) {
    return true;
  }

  // Universal filter: Skip if Total Volume is less than $1
  const totalVolume = Math.abs(volIn) + Math.abs(volOut);
  if (totalVolume < FILTERS.MIN_TOTAL_VOLUME) {
    return true;
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
    return true;
  }

  // Filter smart contracts and exchanges
  if ((!showSmartContracts && isSmartContract(transaction.interactingLabel)) ||
      (!showExchanges && isExchange(transaction.interactingLabel))) {
    return true;
  }

  return false;
};

/**
 * Generate tooltip content for a node
 */
export const generateNodeTooltip = (node, customLabels, formatNumber) => {
  if (node.isMain) {
    const label = customLabels.get(node.id) || node.address.slice(0, 6);
    return `<strong>${label}</strong><br><br>Main Address<br><br>${node.address}`;
  } else {
    const label = node.label || 'N/A';
    const mainInfo = `Netflow: ${formatNumber(node.usdNetflow)}<br>Volume In: ${formatNumber(node.volIn)}<br>Volume Out: ${formatNumber(node.volOut)}<br>Total Volume: ${formatNumber(node.volIn + node.volOut)}${node.isSmartContract ? '<br>Smart Contract' : ''}${node.isExchange ? '<br>Exchange' : ''}<br>Connected to ${node.connectedMainAddresses?.size || 0} main address(es)`;
    return `<strong>${label}</strong><br><br>${mainInfo}<br><br>${node.address}`;
  }
};

/**
 * Transform raw API data into internal node format
 */
export const transformApiTransaction = (cp, mainAddress) => ({
  interactingAddress: cp.interactingAddress || cp.address || cp.wallet_address || cp.counterparty_address,
  volIn: cp.volIn || cp.volumeIn || cp.volume_in || cp.inflow || '0',
  volOut: cp.volOut || cp.volumeOut || cp.volume_out || cp.outflow || '0',
  usdNetflow: cp.usdNetflow || cp.netFlow || cp.net_flow || cp.usd_netflow || '0',
  label: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
  interactingLabel: cp.interactingLabel || cp.name || cp.symbol || cp.label || '',
  chain: cp.chain || (mainAddress.startsWith('0x') ? 'ethereum' : 'solana'),
});

/**
 * Create a new node object from transaction data
 */
export const createNodeFromTransaction = (transaction, mainAddress, customLabels) => ({
  id: transaction.interactingAddress,
  address: transaction.interactingAddress,
  label: customLabels.get(transaction.interactingAddress) || transaction.interactingLabel,
  usdNetflow: parseFloat(transaction.usdNetflow),
  volIn: parseFloat(transaction.volIn),
  volOut: parseFloat(transaction.volOut),
  chain: transaction.chain,
  isMain: false,
  isSmartContract: isSmartContract(transaction.interactingLabel),
  isExchange: isExchange(transaction.interactingLabel),
  connectedMainAddresses: new Set([mainAddress])
}); 