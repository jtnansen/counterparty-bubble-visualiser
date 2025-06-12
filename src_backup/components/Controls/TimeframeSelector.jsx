import React from 'react';
import { COLORS } from '../../utils/constants';

const TimeframeSelector = ({ 
  timeframe, 
  onTimeframeChange, 
  isReloading, 
  reloadProgress 
}) => {
  const timeframeOptions = [
    { value: '30D', label: '30 Days' },
    { value: '90D', label: '90 Days' },
    { value: '1Y', label: '1 Year' },
    { value: '5Y', label: '5 Years' }
  ];

  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ marginRight: '10px' }}>Timeframe:</label>
      <select
        value={timeframe}
        onChange={(e) => onTimeframeChange(e.target.value)}
        disabled={isReloading}
        style={{
          padding: '5px',
          background: COLORS.BORDER,
          color: 'white',
          border: `1px solid ${COLORS.SUCCESS}`,
          borderRadius: '4px'
        }}
      >
        {timeframeOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {/* Loading indicator */}
      {isReloading && (
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <div style={{ color: COLORS.SUCCESS, marginBottom: '5px' }}>
            Reloading wallets: {reloadProgress.current}/{reloadProgress.total}
          </div>
          <div 
            style={{
              width: '20px',
              height: '20px',
              border: `2px solid ${COLORS.BORDER}`,
              borderTop: `2px solid ${COLORS.SUCCESS}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default TimeframeSelector; 