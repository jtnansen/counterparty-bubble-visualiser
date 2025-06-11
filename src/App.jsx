import React, { useEffect } from 'react';
import { useVisualizationData } from './hooks/useVisualizationData.js';
import D3Visualization from './components/Visualization/D3Visualization.jsx';
import { COLORS, UI, TIMEFRAMES, SIZE_METRICS, LABEL_MODES } from './utils/constants.js';

const App = () => {
  // Use the custom hooks for data management
  const {
    // Data state
    data,
    walletAddress,
    timeframe,
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
    
    // Actions
    setWalletAddress,
    handleFileUpload,
    handleApiDataFetch,
    handleTimeframeChange,
    setSizeMetric,
    setShowSmartContracts,
    setShowExchanges,
    setRangeMin,
    setRangeMax,
    setHighlightShared,
    setScaleFactor,
    setLabelMode,
    restoreNode,
    removeDeletedNodePermanently,
    restoreAllNodes,
    removeAllDeletedNodesPermanently,
    deleteNode,
    setCustomLabel,
    setCustomHighlight,
    toggleNodeLock,
    
    // Data processing
    updateAutoScaleFactor,
    getProcessedData
  } = useVisualizationData();

  // Auto-scale calculation when data changes
  useEffect(() => {
    updateAutoScaleFactor();
  }, [data, sizeMetric, updateAutoScaleFactor]);

  // Debug logging for data changes
  useEffect(() => {
    console.log('📊 App: Data changed:', {
      datasetCount: data.length,
      datasets: data.map(d => ({ address: d.mainAddress, transactionCount: d.transactions.length }))
    });
  }, [data]);

  // Debug logging for processed data
  useEffect(() => {
    if (data.length > 0) {
      try {
        const processed = getProcessedData();
        console.log('🔧 App: Processed data:', {
          nodeCount: processed.nodes.length,
          linkCount: processed.links.length,
          mainNodes: processed.nodes.filter(n => n.isMain).length,
          counterpartyNodes: processed.nodes.filter(n => !n.isMain).length
        });
      } catch (error) {
        console.error('❌ App: Error processing data:', error);
      }
    }
  }, [data, getProcessedData]);

  return (
    <div className="App">
      {/* Top Navbar */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0,
        right: 0,
        padding: '10px 15px', 
        zIndex: UI.CONTEXT_MENU_Z_INDEX, 
        background: COLORS.BACKGROUND, 
        color: COLORS.WHITE,
        borderBottom: `1px solid ${COLORS.UI_BACKGROUND}`,
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        flexWrap: 'wrap',
        minHeight: '60px'
      }}>
        {/* Title */}
        <h3 style={{ color: COLORS.ACCENT, margin: 0, fontSize: '18px', minWidth: '90px' }}>
          🔗 Visualiser
        </h3>

        {/* Wallet Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '280px' }}>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter wallet address"
            disabled={loading}
            style={{
              flex: 1,
              padding: '6px 8px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <button
            onClick={() => handleApiDataFetch()}
            disabled={loading || !walletAddress.trim()}
            style={{
              padding: '6px 12px',
              background: (loading || !walletAddress.trim()) ? COLORS.UI_BACKGROUND : COLORS.ACCENT,
              color: (loading || !walletAddress.trim()) ? COLORS.WHITE : COLORS.BACKGROUND,
              border: 'none',
              borderRadius: '4px',
              cursor: (loading || !walletAddress.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Loading...' : 'Add'}
          </button>
        </div>

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Timeframe:</label>
          <select
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            disabled={isReloading}
            style={{
              padding: '4px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            {TIMEFRAMES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {isReloading && (
            <span style={{ fontSize: '10px', color: COLORS.ACCENT }}>
              ({reloadProgress.current}/{reloadProgress.total})
            </span>
          )}
        </div>

        {/* Size Metric Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Size:</label>
          <select
            value={sizeMetric}
            onChange={(e) => setSizeMetric(e.target.value)}
            style={{
              padding: '4px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            {SIZE_METRICS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Label Mode Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Labels:</label>
          <select
            value={labelMode}
            onChange={(e) => setLabelMode(e.target.value)}
            style={{
              padding: '4px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            {LABEL_MODES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Range Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Min:</label>
          <input
            type="number"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            placeholder="Min"
            style={{
              padding: '4px',
              width: '60px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Max:</label>
          <input
            type="number"
            value={rangeMax}
            onChange={(e) => setRangeMax(e.target.value)}
            placeholder="Max"
            style={{
              padding: '4px',
              width: '60px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
        </div>

        {/* Filter Checkboxes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={showSmartContracts}
              onChange={(e) => setShowSmartContracts(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            🤖
          </label>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={showExchanges}
              onChange={(e) => setShowExchanges(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            🏦
          </label>
          <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={highlightShared}
              onChange={(e) => setHighlightShared(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            Shared
          </label>
        </div>

        {/* Scale Factor Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: '120px' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            Scale: {scaleFactor.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
            style={{ width: '80px' }}
          />
        </div>

        {/* Data Info */}
        {data.length > 0 && (
          <div style={{ 
            fontSize: '11px', 
            opacity: 0.8, 
            padding: '4px 8px', 
            background: COLORS.UI_BACKGROUND, 
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            📊 {data.length} wallet{data.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          position: 'fixed',
          top: '70px',
          left: '15px',
          right: '15px',
          color: '#FF7F7B', 
          fontSize: '12px',
          padding: '8px',
          background: COLORS.UI_BACKGROUND,
          borderRadius: '4px',
          zIndex: UI.CONTEXT_MENU_Z_INDEX - 1
        }}>
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ marginTop: '70px', width: '100%', height: 'calc(100vh - 70px)' }}>
        {data.length === 0 ? (
          <div style={{ 
            width: '100%', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.BACKGROUND,
            color: COLORS.WHITE
          }}>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <h2 style={{ color: COLORS.ACCENT, marginBottom: '20px' }}>
                Welcome to Counterparty Visualizer
              </h2>
              <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
                Add a wallet address to start exploring transaction relationships.
              </p>
              <div style={{ 
                background: COLORS.UI_BACKGROUND, 
                padding: '15px', 
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                <strong>Try this sample:</strong><br/>
                <code style={{ 
                  background: COLORS.BACKGROUND, 
                  padding: '5px 8px', 
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '8px',
                  color: COLORS.ACCENT
                }}>
                  0x742d35cc6634c0532925a3b8d3ac293c9e8c3b0f
                </code>
              </div>
            </div>
          </div>
        ) : (
          <D3Visualization
            data={data}
            sizeMetric={sizeMetric}
            scaleFactor={scaleFactor}
            labelMode={labelMode}
            customLabels={customLabels}
            customHighlights={customHighlights}
            highlightShared={highlightShared}
            lockedNodes={lockedNodes}
            deletedNodes={deletedNodes}
            timeframe={timeframe}
            onDeleteNode={deleteNode}
            onSetCustomLabel={setCustomLabel}
            onSetCustomHighlight={setCustomHighlight}
            onToggleNodeLock={toggleNodeLock}
            onAddWallet={handleApiDataFetch}
            getProcessedData={getProcessedData}
          />
        )}
      </div>

      {/* Deleted Nodes Widget */}
      {deletedNodesData.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: COLORS.BACKGROUND,
          border: `1px solid ${COLORS.UI_BACKGROUND}`,
          borderRadius: '8px',
          padding: '10px',
          maxWidth: '250px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: UI.CONTEXT_MENU_Z_INDEX,
          color: COLORS.WHITE
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: COLORS.ACCENT }}>
            Deleted ({deletedNodesData.size})
          </h4>
          
          {/* Bulk Action Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '5px', 
            marginBottom: '10px',
            borderBottom: `1px solid ${COLORS.UI_BACKGROUND}`,
            paddingBottom: '8px'
          }}>
            <button
              onClick={restoreAllNodes}
              style={{
                flex: 1,
                background: COLORS.ACCENT,
                color: COLORS.BACKGROUND,
                border: 'none',
                borderRadius: '3px',
                padding: '6px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Restore All
            </button>
            <button
              onClick={removeAllDeletedNodesPermanently}
              style={{
                flex: 1,
                background: '#FF7F7B',
                color: COLORS.BACKGROUND,
                border: 'none',
                borderRadius: '3px',
                padding: '6px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Delete All
            </button>
          </div>
          
          {Array.from(deletedNodesData.entries()).map(([nodeId, nodeData]) => (
            <div key={nodeId} style={{
              marginBottom: '8px',
              padding: '8px',
              background: COLORS.UI_BACKGROUND,
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {nodeData.label || nodeId.slice(0, 8) + '...'}
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => restoreNode(nodeId)}
                  style={{
                    background: COLORS.ACCENT,
                    color: COLORS.BACKGROUND,
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => removeDeletedNodePermanently(nodeId)}
                  style={{
                    background: '#FF7F7B',
                    color: COLORS.BACKGROUND,
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App; 