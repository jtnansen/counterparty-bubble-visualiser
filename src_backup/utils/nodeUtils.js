export const isSmartContract = (label) => label && label.includes('🤖');
export const isExchange = (label) => label && label.includes('🏦');

export const truncateTextForBubble = (text, radius) => {
  // Use more aggressive sizing to get closer to the border
  // Estimate characters that fit within the bubble diameter with smaller font
  const maxChars = Math.floor((radius * 2.2) / 4); // Increased from 6px to 4px per char, more space
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 2) + '..';
};

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

export const getNodeDisplayText = (node, labelMode, customLabels) => {
  const customLabel = customLabels.get(node.id);
  let displayText;
  
  if (customLabel) {
    displayText = customLabel;
  } else if (labelMode === 'address') {
    // Always use exactly 6 characters for address preview
    displayText = `${node.address.slice(0, 6)}${node.isSmartContract ? ' 🤖' : ''}${node.isExchange ? ' 🏦' : ''}`;
  } else {
    const cleanLabel = cleanNansenLabel(node.label || node.address.slice(0, 6));
    displayText = `${cleanLabel}${node.isSmartContract ? ' 🤖' : ''}${node.isExchange ? ' 🏦' : ''}`;
  }
  
  return displayText;
};

export const generateNodeTooltipContent = (node, customLabels, formatNumber) => {
  if (node.isMain) {
    const label = customLabels.get(node.id) || node.address.slice(0, 6);
    return `<strong>${label}</strong><br><br>Main Address<br><br>${node.address}`;
  } else {
    const label = node.label || 'N/A';
    const mainInfo = `Netflow: ${formatNumber(node.usdNetflow)}<br>Volume In: ${formatNumber(node.volIn)}<br>Volume Out: ${formatNumber(node.volOut)}<br>Total Volume: ${formatNumber(node.volIn + node.volOut)}${node.isSmartContract ? '<br>Smart Contract' : ''}${node.isExchange ? '<br>Exchange' : ''}<br>Connected to ${node.connectedMainAddresses?.size || 0} main address(es)`;
    return `<strong>${label}</strong><br><br>${mainInfo}<br><br>${node.address}`;
  }
};

export const positionNewCounterpartyNode = (node, addressMap, width, height) => {
  // Find the main node this counterparty is connected to
  const connectedMainAddress = Array.from(node.connectedMainAddresses)[0];
  const mainNode = addressMap.get(connectedMainAddress);
  
  if (mainNode && mainNode.x && mainNode.y) {
    // Positive netflow (receiving money) goes to the left, negative netflow (sending money) goes to the right
    const side = node.usdNetflow > 0 ? -1 : 1; // Left side for positive, right side for negative
    const distance = 150 + Math.random() * 100; // Random distance between 150-250px
    const angle = (Math.random() - 0.5) * Math.PI * 0.6; // ±54 degrees spread
    
    node.x = mainNode.x + side * distance * Math.cos(angle);
    node.y = mainNode.y + distance * Math.sin(angle);
  } else {
    // Fallback to random positioning if main node position is not available
    node.x = Math.random() * width;
    node.y = Math.random() * height;
  }
};

export const shouldSkipNode = (d, deletedNodes, rangeMin, rangeMax, sizeMetric, showSmartContracts, showExchanges) => {
  // Skip if node was previously deleted
  if (deletedNodes.has(d.interactingAddress)) {
    return true;
  }

  const usdNetflow = parseFloat(d.usdNetflow);
  const volIn = parseFloat(d.volIn);
  const volOut = parseFloat(d.volOut);

  // Skip if all values are zero
  if (usdNetflow === 0 && volIn === 0 && volOut === 0) {
    return true;
  }

  // Universal filter: Skip if Total Volume is less than $1
  const totalVolume = Math.abs(volIn) + Math.abs(volOut);
  if (totalVolume < 1) {
    return true;
  }

  // Skip if outside the range for the selected metric
  let metricValue;
  if (sizeMetric === 'uniform') {
    metricValue = 0; // Skip range filtering for uniform sizing
  } else if (sizeMetric === 'totalVolume') {
    metricValue = volIn + volOut;
  } else {
    metricValue = parseFloat(d[sizeMetric]);
  }
  
  // Only apply range filtering if not using uniform sizing
  if (sizeMetric !== 'uniform' && 
      ((rangeMin !== '' && metricValue < parseFloat(rangeMin)) ||
       (rangeMax !== '' && metricValue > parseFloat(rangeMax)))) {
    return true;
  }

  if ((!showSmartContracts && isSmartContract(d.interactingLabel)) ||
      (!showExchanges && isExchange(d.interactingLabel))) {
    return true;
  }

  return false;
}; 