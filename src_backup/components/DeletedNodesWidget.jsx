import React from 'react';
import { COLORS } from '../utils/constants';

const DeletedNodesWidget = ({ 
  deletedNodesData, 
  onRestoreNode, 
  onRemoveNode 
}) => {
  if (deletedNodesData.size === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: COLORS.BACKGROUND,
      border: `1px solid ${COLORS.BORDER}`,
      borderRadius: '8px',
      padding: '10px',
      maxWidth: '250px',
      maxHeight: '300px',
      overflowY: 'auto',
      zIndex: 1000,
      color: 'white'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: COLORS.SUCCESS }}>
        Deleted Nodes ({deletedNodesData.size})
      </h4>
      {Array.from(deletedNodesData.entries()).map(([nodeId, nodeData]) => (
        <div key={nodeId} style={{
          marginBottom: '8px',
          padding: '8px',
          background: COLORS.BORDER,
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {nodeData.label || nodeId.slice(0, 8) + '...'}
          </div>
          <div style={{ opacity: 0.8, marginBottom: '6px' }}>
            {nodeData.address.slice(0, 8) + '...'}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => onRestoreNode(nodeId)}
              style={{
                background: COLORS.SUCCESS,
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
              onClick={() => onRemoveNode(nodeId)}
              style={{
                background: COLORS.ERROR,
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
  );
};

export default DeletedNodesWidget; 