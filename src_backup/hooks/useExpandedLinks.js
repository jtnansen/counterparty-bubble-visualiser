import { useState, useCallback } from 'react';
import { fetchTransactionsBetweenAddresses } from '../services/nansenApi';

export const useExpandedLinks = (timeframe, setError) => {
  const [expandedLinks, setExpandedLinks] = useState(new Map());
  const [loadingTransactions, setLoadingTransactions] = useState(new Set());

  const toggleLinkExpansion = useCallback(async (mainNode, counterpartyNode) => {
    const linkId = `${mainNode.id}-${counterpartyNode.id}`;
    
    // Check if link is already expanded
    if (expandedLinks.has(linkId)) {
      // Collapse: remove expanded transactions
      setExpandedLinks(prev => {
        const newMap = new Map(prev);
        newMap.delete(linkId);
        return newMap;
      });
      return true; // Signal that we need to re-render
    }
    
    // Expand: fetch individual transactions
    setLoadingTransactions(prev => new Set(prev).add(linkId));
    
    try {
      console.log(`🔍 Fetching transactions between ${mainNode.id} and ${counterpartyNode.id}`);
      const transactionData = await fetchTransactionsBetweenAddresses(
        mainNode.id, 
        counterpartyNode.id, 
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
        return true; // Signal that we need to re-render
      } else {
        console.log('No transactions found between these addresses');
        return false; // No re-render needed
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(`Failed to load transactions: ${error.message}`);
      return false; // No re-render needed
    } finally {
      setLoadingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(linkId);
        return newSet;
      });
    }
  }, [expandedLinks, timeframe, setError]);

  const processExpandedLinks = useCallback((originalLinks, addressMap) => {
    // If no expanded links, return original links
    if (expandedLinks.size === 0) {
      return originalLinks;
    }

    let finalLinks = [];
    const processedExpandedLinks = new Set();
    
    originalLinks.forEach(link => {
      const sourceNode = addressMap.get(link.source);
      const targetNode = addressMap.get(link.target);
      
      if (sourceNode && targetNode) {
        const mainNode = sourceNode.isMain ? sourceNode : targetNode;
        const counterpartyNode = sourceNode.isMain ? targetNode : sourceNode;
        const linkId = `${mainNode.id}-${counterpartyNode.id}`;
        
        if (expandedLinks.has(linkId) && !processedExpandedLinks.has(linkId)) {
          // Replace with individual transaction links
          const transactions = expandedLinks.get(linkId);
          processedExpandedLinks.add(linkId);
          
          transactions.forEach((tx, index) => {
            // Analyze transaction direction
            let isOutgoing = false;
            let debugInfo = {};
            
            // Check if main address is sending the primary token
            if (tx.tokenSent && tx.tokenSent.length > 0) {
              const tokenSentData = tx.tokenSent[0];
              const fromAddr = tokenSentData[9]; // fromAddr2 field
              const toAddr = tokenSentData[10]; // toAddr2 field
              
              debugInfo.tokenSent = {
                fromAddr,
                toAddr,
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
              
              debugInfo.tokenReceived = {
                fromAddr,
                toAddr,
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
            
            // If we still haven't determined direction, use the volumeUsd or fallback
            if (!debugInfo.tokenSent?.isMainSender && !debugInfo.tokenReceived?.isMainReceiver) {
              isOutgoing = tx.volumeUsd < 0;
              debugInfo.fallback = true;
            }
            
            const direction = isOutgoing ? 'outgoing' : 'incoming';
            
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

    return finalLinks;
  }, [expandedLinks]);

  const clearExpandedLinks = useCallback(() => {
    setExpandedLinks(new Map());
    setLoadingTransactions(new Set());
  }, []);

  return {
    expandedLinks,
    loadingTransactions,
    toggleLinkExpansion,
    processExpandedLinks,
    clearExpandedLinks
  };
}; 