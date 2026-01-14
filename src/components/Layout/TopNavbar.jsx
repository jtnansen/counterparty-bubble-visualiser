import React, { useState, useEffect, useRef } from 'react';
import { COLORS, UI, TIMEFRAMES, SIZE_METRICS, LABEL_MODES } from '../../utils/constants.js';

const TopNavbar = ({
  // Data state
  data,
  walletAddress,
  timeframe,
  loading,
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
  zoomToNode,
  onDeleteWallet
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);
  return (
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
          onKeyPress={(e) => {
            if (e.key === 'Enter' && walletAddress.trim() && !loading) {
              handleApiDataFetch();
            }
          }}
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

      {/* Main Nodes Dropdown */}
      {data.length > 0 && (
        <div ref={dropdownRef} style={{ display: 'flex', alignItems: 'center', gap: '5px', position: 'relative' }}>
          <label style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>Main Nodes:</label>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              padding: '6px 8px',
              background: COLORS.UI_BACKGROUND,
              color: COLORS.WHITE,
              border: `1px solid ${COLORS.ACCENT}`,
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '150px',
              textAlign: 'left'
            }}
          >
            Select node ({data.length}) ▼
          </button>

          {/* Custom dropdown menu */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '85px',
                marginTop: '2px',
                background: COLORS.UI_BACKGROUND,
                border: `1px solid ${COLORS.ACCENT}`,
                borderRadius: '4px',
                zIndex: UI.CONTEXT_MENU_Z_INDEX + 1,
                minWidth: '300px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}
            >
              {data.map((dataset) => (
                <div
                  key={dataset.mainAddress}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderBottom: `1px solid ${COLORS.BACKGROUND}`,
                    fontSize: '12px',
                    color: COLORS.WHITE
                  }}
                >
                  <span
                    onClick={() => {
                      // Copy address to clipboard
                      navigator.clipboard.writeText(dataset.mainAddress);
                      console.log('Main node address copied:', dataset.mainAddress);

                      // Zoom to the selected node
                      if (zoomToNode) {
                        zoomToNode(dataset.mainAddress);
                      }

                      setShowDropdown(false);
                    }}
                    style={{
                      flex: 1,
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = COLORS.ACCENT;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = COLORS.WHITE;
                    }}
                  >
                    {dataset.mainAddress.slice(0, 10)}...{dataset.mainAddress.slice(-6)} ({dataset.transactions.length} counterparties)
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteWallet) {
                        onDeleteWallet(dataset.mainAddress, true);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FF7F7B',
                      cursor: 'pointer',
                      fontSize: '16px',
                      padding: '0 4px',
                      marginLeft: '8px'
                    }}
                    title="Delete wallet"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
  );
};

export default TopNavbar; 