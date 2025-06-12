import React from 'react';
import { COLORS, UI } from '../../utils/constants.js';

const DeletedNodesWidget = ({
  deletedNodesData,
  restoreAllNodes,
  removeAllDeletedNodesPermanently,
  restoreNode,
  removeDeletedNodePermanently
}) => {
  if (deletedNodesData.size === 0) return null;

  return (
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
      
      {/* Individual Node Items */}
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
  );
};

export default DeletedNodesWidget; 