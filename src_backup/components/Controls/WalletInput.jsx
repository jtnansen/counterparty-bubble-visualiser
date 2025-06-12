import React, { useState } from 'react';
import { COLORS } from '../../utils/constants';

const WalletInput = ({ onAddWallet, loading, error }) => {
  const [walletAddress, setWalletAddress] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (walletAddress.trim()) {
      onAddWallet(walletAddress.trim()).then(success => {
        if (success) {
          setWalletAddress(''); // Clear input on success
        }
      });
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="Enter wallet address"
          disabled={loading}
          style={{
            padding: '5px',
            background: COLORS.BORDER,
            color: 'white',
            border: `1px solid ${COLORS.SUCCESS}`,
            borderRadius: '4px',
            flex: 1
          }}
        />
        <button
          type="submit"
          disabled={loading || !walletAddress.trim()}
          style={{
            padding: '5px 10px',
            background: loading ? COLORS.BORDER : COLORS.SUCCESS,
            color: loading ? 'white' : COLORS.BACKGROUND,
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !walletAddress.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Add Wallet'}
        </button>
      </form>
      
      {error && (
        <div style={{ 
          color: COLORS.ERROR, 
          marginTop: '5px',
          fontSize: '12px'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default WalletInput; 