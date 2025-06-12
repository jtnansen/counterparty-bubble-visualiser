import { useState, useCallback } from 'react';
import { fetchTransactionsBetweenAddresses } from '../services/nansenApi';

export const useExpandedLinks = (timeframe) => {
  // State for tracking expanded transaction links
  const [expandedLinks, setExpandedLinks] = useState(new Map());
  const [loadingTransactions, setLoadingTransactions] = useState(new Set());

  // Expand or collapse a link between two addresses
  const toggleLinkExpansion = useCallback(async (mainNodeId, counterpartyNodeId) => {
    const linkId = `${mainNodeId}-${counterpartyNodeId}`;
    
    // Check if link is already expanded
    if (expandedLinks.has(linkId)) {
      // Collapse: remove expanded transactions
      setExpandedLinks(prev => {
        const newMap = new Map(prev);
        newMap.delete(linkId);
        return newMap;
      });
      return { collapsed: true };
    }
    
    // Expand: fetch individual transactions
    setLoadingTransactions(prev => new Set(prev).add(linkId));
    
    try {
      console.log(`🔍 Fetching transactions between ${mainNodeId} and ${counterpartyNodeId}`);
      const transactionData = await fetchTransactionsBetweenAddresses(
        mainNodeId, 
        counterpartyNodeId, 
        timeframe
      );
      
      if (transactionData.data && transactionData.data.length > 0) {
        console.log(`💾 Storing ${transactionData.data.length} transactions for link ${linkId}`);
        setExpandedLinks(prev => {
          const newMap = new Map(prev);
          newMap.set(linkId, transactionData.data);
          console.log(`📊 ExpandedLinks now has ${newMap.size} expanded links`);
          return newMap;
        });
        return { expanded: true, transactions: transactionData.data };
      } else {
        console.log('No transactions found between these addresses');
        return { expanded: false, error: 'No transactions found' };
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return { expanded: false, error: `Failed to load transactions: ${error.message}` };
    } finally {
      setLoadingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(linkId);
        return newSet;
      });
    }
  }, [expandedLinks, timeframe]);

  // Process links to replace aggregated ones with individual transaction links where expanded
  const processLinksWithExpansions = useCallback((originalLinks, addressMap) => {
    // If no expanded links, return original links
    if (expandedLinks.size === 0) {
      return originalLinks;
    }

    let finalLinks = [];
    const processedExpandedLinks = new Set();
    
    originalLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const sourceNode = addressMap.get(sourceId);
      const targetNode = addressMap.get(targetId);
      
      if (sourceNode && targetNode) {
        const mainNode = sourceNode.isMain ? sourceNode : targetNode;
        const counterpartyNode = sourceNode.isMain ? targetNode : sourceNode;
        const linkId = `${mainNode.id}-${counterpartyNode.id}`;
        
        if (expandedLinks.has(linkId) && !processedExpandedLinks.has(linkId)) {
          // Replace with individual transaction links
          const transactions = expandedLinks.get(linkId);
          processedExpandedLinks.add(linkId);
          
          transactions.forEach((tx, index) => {
            // Detailed debugging to understand the transaction structure
            console.log(`🔍 Raw Transaction ${index}:`, {
              tokenSent: tx.tokenSent,
              tokenReceived: tx.tokenReceived,
              volumeUsd: tx.volumeUsd,
              mainNodeId: mainNode.id,
              counterpartyNodeId: counterpartyNode.id
            });
            
            // Fix direction detection - focus on primary transaction direction
            let isOutgoing = false;
            let debugInfo = {};
            
            // Check if main address is sending the primary token
            if (tx.tokenSent && tx.tokenSent.length > 0) {
              const tokenSentData = tx.tokenSent[0];
              const fromAddr = tokenSentData[9]; // fromAddr2 field
              const toAddr = tokenSentData[10]; // toAddr2 field
              const sentAmount = tokenSentData[3]; // USD value
              
              debugInfo.tokenSent = {
                fromAddr,
                toAddr,
                sentAmount,
                isMainSender: fromAddr?.toLowerCase() === mainNode.id.toLowerCase(),
                isCounterpartyReceiver: toAddr?.toLowerCase() === counterpartyNode.id.toLowerCase()
              };
              
              // If main is sender TO counterparty, it's outgoing
              if (fromAddr?.toLowerCase() === mainNode.id.toLowerCase() && 
                  toAddr?.toLowerCase() === counterpartyNode.id.toLowerCase()) {
                isOutgoing = true;
              }
            }
            
            // Check if main address is receiving the primary token
            if (tx.tokenReceived && tx.tokenReceived.length > 0) {
              const tokenReceivedData = tx.tokenReceived[0];
              const fromAddr = tokenReceivedData[9]; // fromAddr2 field
              const toAddr = tokenReceivedData[10]; // toAddr2 field
              const receivedAmount = tokenReceivedData[3]; // USD value
              
              debugInfo.tokenReceived = {
                fromAddr,
                toAddr,
                receivedAmount,
                isCounterpartySender: fromAddr?.toLowerCase() === counterpartyNode.id.toLowerCase(),
                isMainReceiver: toAddr?.toLowerCase() === mainNode.id.toLowerCase()
              };
              
              // If counterparty is sender TO main, it's incoming (and not already determined as outgoing)
              if (!isOutgoing && 
                  fromAddr?.toLowerCase() === counterpartyNode.id.toLowerCase() && 
                  toAddr?.toLowerCase() === mainNode.id.toLowerCase()) {
                isOutgoing = false;
              }
            }
            
            // If we still haven't determined direction, use the volumeUsd sign or default logic
            if (!debugInfo.tokenSent?.isMainSender && !debugInfo.tokenReceived?.isMainReceiver) {
              // Fallback to original aggregated link direction
              isOutgoing = tx.volumeUsd < 0;
              debugInfo.fallback = true;
            }
            
            const direction = isOutgoing ? 'outgoing' : 'incoming';
            
            console.log(`🎯 Transaction ${index} ANALYSIS:`, {
              ...debugInfo,
              finalDirection: direction,
              isOutgoing: isOutgoing,
              reasoning: isOutgoing ? 'Main → Counterparty' : 'Counterparty → Main'
            });
            
            finalLinks.push({
              source: link.source,
              target: link.target,
              value: isOutgoing ? -Math.abs(tx.volumeUsd) : Math.abs(tx.volumeUsd),
              isTransactionLink: true,
              transaction: tx,
              direction: direction,
              linkId: linkId,
              transactionIndex: index,
              totalTransactions: transactions.length
            });
          });
        } else {
          // Keep original aggregated link (not expanded)
          finalLinks.push(link);
        }
      } else {
        // If we can't find the nodes, keep the original link
        finalLinks.push(link);
      }
    });

    console.log(`🔗 Debug: Created ${originalLinks.length} original links, ${finalLinks.length} final links`);
    console.log('🔗 Final links sample:', finalLinks.slice(0, 3));
    console.log('🔗 Expanded links count:', expandedLinks.size);
    if (expandedLinks.size > 0) {
      console.log('🔗 Expanded links data:', Array.from(expandedLinks.entries()));
    }

    return finalLinks;
  }, [expandedLinks]);

  // Check if a specific link is currently loading
  const isLinkLoading = useCallback((mainNodeId, counterpartyNodeId) => {
    const linkId = `${mainNodeId}-${counterpartyNodeId}`;
    return loadingTransactions.has(linkId);
  }, [loadingTransactions]);

  // Check if a specific link is expanded
  const isLinkExpanded = useCallback((mainNodeId, counterpartyNodeId) => {
    const linkId = `${mainNodeId}-${counterpartyNodeId}`;
    return expandedLinks.has(linkId);
  }, [expandedLinks]);

  // Get transactions for a specific expanded link
  const getLinkTransactions = useCallback((mainNodeId, counterpartyNodeId) => {
    const linkId = `${mainNodeId}-${counterpartyNodeId}`;
    return expandedLinks.get(linkId) || [];
  }, [expandedLinks]);

  // Clear all expanded links (useful when data changes)
  const clearExpandedLinks = useCallback(() => {
    setExpandedLinks(new Map());
    setLoadingTransactions(new Set());
  }, []);

  return {
    // State
    expandedLinks,
    loadingTransactions,
    
    // Actions
    toggleLinkExpansion,
    processLinksWithExpansions,
    clearExpandedLinks,
    
    // Queries
    isLinkLoading,
    isLinkExpanded,
    getLinkTransactions
  };
}; 