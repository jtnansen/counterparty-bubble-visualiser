import React from 'react';
import { COLORS } from '../../utils/constants.js';

const WelcomeScreen = () => {
  return (
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
  );
};

export default WelcomeScreen; 