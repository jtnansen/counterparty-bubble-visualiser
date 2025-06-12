import React, { useEffect } from 'react';
import { useVisualizationData } from './hooks/useVisualizationData.js';
import D3Visualization from './components/Visualization/D3Visualization.jsx';
import TopNavbar from './components/Layout/TopNavbar.jsx';
import WelcomeScreen from './components/Layout/WelcomeScreen.jsx';
import DeletedNodesWidget from './components/Layout/DeletedNodesWidget.jsx';
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
      <TopNavbar
        data={data}
        walletAddress={walletAddress}
        timeframe={timeframe}
        loading={loading}
        isReloading={isReloading}
        reloadProgress={reloadProgress}
        sizeMetric={sizeMetric}
        showSmartContracts={showSmartContracts}
        showExchanges={showExchanges}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        highlightShared={highlightShared}
        scaleFactor={scaleFactor}
        labelMode={labelMode}
        setWalletAddress={setWalletAddress}
        handleApiDataFetch={handleApiDataFetch}
        handleTimeframeChange={handleTimeframeChange}
        setSizeMetric={setSizeMetric}
        setShowSmartContracts={setShowSmartContracts}
        setShowExchanges={setShowExchanges}
        setRangeMin={setRangeMin}
        setRangeMax={setRangeMax}
        setHighlightShared={setHighlightShared}
        setScaleFactor={setScaleFactor}
        setLabelMode={setLabelMode}
      />

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
          <WelcomeScreen />
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
      <DeletedNodesWidget
        deletedNodesData={deletedNodesData}
        restoreAllNodes={restoreAllNodes}
        removeAllDeletedNodesPermanently={removeAllDeletedNodesPermanently}
        restoreNode={restoreNode}
        removeDeletedNodePermanently={removeDeletedNodePermanently}
      />
    </div>
  );
};

export default App; 