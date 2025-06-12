import React from 'react';
import { COLORS, DEFAULTS } from '../../utils/constants';

const FilterControls = ({
  sizeMetric,
  setSizeMetric,
  labelMode,
  setLabelMode,
  showSmartContracts,
  setShowSmartContracts,
  showExchanges,
  setShowExchanges,
  highlightShared,
  setHighlightShared,
  rangeMin,
  setRangeMin,
  rangeMax,
  setRangeMax,
  scaleFactor,
  setScaleFactor,
  onFileUpload
}) => {
  
  const sizeMetricOptions = [
    { value: 'totalVolume', label: 'Total Volume' },
    { value: 'usdNetflow', label: 'USD Netflow' },
    { value: 'volIn', label: 'Volume In' },
    { value: 'volOut', label: 'Volume Out' },
    { value: 'uniform', label: 'Uniform' }
  ];

  const labelModeOptions = [
    { value: 'label', label: 'Nansen Labels' },
    { value: 'address', label: 'Addresses' }
  ];

  return (
    <div>
      {/* File Upload Control */}
      <div style={{ marginBottom: '10px' }}>
        <input
          type="file"
          onChange={onFileUpload}
          accept=".csv"
          style={{ color: 'white' }}
        />
      </div>

      {/* Size Metric Control */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '10px' }}>Bubble Size:</label>
        <select
          value={sizeMetric}
          onChange={(e) => setSizeMetric(e.target.value)}
          style={{
            padding: '5px',
            background: COLORS.BORDER,
            color: 'white',
            border: `1px solid ${COLORS.SUCCESS}`,
            borderRadius: '4px'
          }}
        >
          {sizeMetricOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Label Mode Control */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '10px' }}>Bubble Label:</label>
        <select
          value={labelMode}
          onChange={(e) => setLabelMode(e.target.value)}
          style={{
            padding: '5px',
            background: COLORS.BORDER,
            color: 'white',
            border: `1px solid ${COLORS.SUCCESS}`,
            borderRadius: '4px'
          }}
        >
          {labelModeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filter Checkboxes */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={showSmartContracts}
            onChange={(e) => setShowSmartContracts(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Show Smart Contracts 🤖
        </label>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={showExchanges}
            onChange={(e) => setShowExchanges(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Show Exchanges 🏦
        </label>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={highlightShared}
            onChange={(e) => setHighlightShared(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Highlight Shared Counterparties
        </label>
      </div>

      {/* Range Controls */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ marginBottom: '5px' }}>
          <label style={{ marginRight: '10px' }}>Min Value:</label>
          <input
            type="number"
            value={rangeMin}
            onChange={(e) => setRangeMin(e.target.value)}
            placeholder="Min"
            style={{
              padding: '3px',
              width: '80px',
              background: COLORS.BORDER,
              color: 'white',
              border: `1px solid ${COLORS.SUCCESS}`,
              borderRadius: '4px'
            }}
          />
        </div>
        <div style={{ marginBottom: '5px' }}>
          <label style={{ marginRight: '10px' }}>Max Value:</label>
          <input
            type="number"
            value={rangeMax}
            onChange={(e) => setRangeMax(e.target.value)}
            placeholder="Max"
            style={{
              padding: '3px',
              width: '80px',
              background: COLORS.BORDER,
              color: 'white',
              border: `1px solid ${COLORS.SUCCESS}`,
              borderRadius: '4px'
            }}
          />
        </div>
      </div>

      {/* Scale Factor Control */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Scale Factor: {scaleFactor.toFixed(1)}
        </label>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          value={scaleFactor}
          onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
          style={{ width: '200px' }}
        />
      </div>
    </div>
  );
};

export default FilterControls; 