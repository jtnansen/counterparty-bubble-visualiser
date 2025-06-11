import React, { useState, useEffect } from 'react';
import { COLORS, UI, HIGHLIGHT_COLORS } from '../../utils/constants.js';

const ContextMenu = ({ 
  visible, 
  x, 
  y, 
  node, 
  onClose, 
  onCopyAddress,
  onSetCustomLabel,
  onSetCustomHighlight,
  onAddWallet,
  onDeleteNode
}) => {
  const [showColorMenu, setShowColorMenu] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      onClose();
      setShowColorMenu(false);
    };

    if (visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [visible, onClose]);

  if (!visible || !node) return null;

  const handleMenuAction = (action, event) => {
    event.stopPropagation();
    
    switch (action) {
      case 'copyAddress':
        onCopyAddress(node.address);
        onClose();
        break;
        
      case 'label':
        const label = prompt('Enter label:', node.label || '');
        if (label !== null) {
          onSetCustomLabel(node.id, label);
        }
        onClose();
        break;
        
      case 'highlight':
        setShowColorMenu(true);
        break;
        
      case 'addWallet':
        onAddWallet(node.address);
        onClose();
        break;
        
      case 'delete':
        onDeleteNode(node.id, node.isMain);
        onClose();
        break;
        
      default:
        onClose();
    }
  };

  const handleColorSelect = (color, event) => {
    event.stopPropagation();
    onSetCustomHighlight(node.id, color);
    setShowColorMenu(false);
    onClose();
  };

  const handleRemoveHighlight = (event) => {
    event.stopPropagation();
    onSetCustomHighlight(node.id, null);
    setShowColorMenu(false);
    onClose();
  };

  const menuOptions = [
    { label: 'Copy Address', action: 'copyAddress' },
    { label: 'Add temporary label', action: 'label' },
    { label: 'Highlight', action: 'highlight' },
    ...(node.isMain ? [] : [{ label: 'Add Wallet', action: 'addWallet' }]),
    { label: 'Delete bubble', action: 'delete' }
  ];

  return (
    <>
      {/* Main Context Menu */}
      <div
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          background: COLORS.BACKGROUND,
          border: `1px solid ${COLORS.UI_BACKGROUND}`,
          borderRadius: '4px',
          padding: '5px',
          color: COLORS.WHITE,
          zIndex: UI.CONTEXT_MENU_Z_INDEX + 1,
          minWidth: '150px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuOptions.map((option, index) => (
          <div
            key={option.action}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: '3px',
              fontSize: '13px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = COLORS.UI_BACKGROUND;
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
            onClick={(e) => handleMenuAction(option.action, e)}
          >
            {option.label}
          </div>
        ))}
      </div>

      {/* Color Selection Menu */}
      {showColorMenu && (
        <div
          style={{
            position: 'fixed',
            left: `${x + 160}px`,
            top: `${y}px`,
            background: COLORS.BACKGROUND,
            border: `1px solid ${COLORS.UI_BACKGROUND}`,
            borderRadius: '4px',
            padding: '8px',
            color: COLORS.WHITE,
            zIndex: UI.CONTEXT_MENU_Z_INDEX + 2,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Remove highlight option */}
          <div
            style={{
              padding: '8px',
              cursor: 'pointer',
              borderRadius: '3px',
              marginBottom: '5px',
              background: 'black',
              position: 'relative',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={handleRemoveHighlight}
            onMouseEnter={(e) => {
              e.target.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '1';
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                background: 'linear-gradient(to right top, transparent calc(50% - 1px), red, transparent calc(50% + 1px))'
              }}
            />
            <span style={{ 
              position: 'relative', 
              zIndex: 1, 
              color: COLORS.WHITE, 
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              Remove
            </span>
          </div>

          {/* Color options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
            {HIGHLIGHT_COLORS.map((color, index) => (
              <div
                key={color}
                style={{
                  width: '30px',
                  height: '30px',
                  backgroundColor: color,
                  cursor: 'pointer',
                  borderRadius: '3px',
                  border: `2px solid ${COLORS.UI_BACKGROUND}`,
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
                onClick={(e) => handleColorSelect(color, e)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ContextMenu; 