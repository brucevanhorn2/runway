import React, { memo } from 'react';
import { DatabaseOutlined } from '@ant-design/icons';
import { NodeResizer } from 'reactflow';

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DatabaseGroupNode = memo(({ id, data, selected }) => {
  const { name, description, color, tableCount, typeCount, onGroupResize } = data;
  const safeColor = color || '#4a9eff';

  return (
    <div
      style={{
        // Dark charcoal fill — clearly visible on the #1e1e1e canvas without washing out nodes
        background: '#26262c',
        border: `2px solid ${safeColor}`,
        borderRadius: '8px',
        // Fill the full size React Flow assigns via the node's style prop
        width: '100%',
        height: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        // Subtle inner glow along the border so the colour reads at a glance
        boxShadow: `inset 0 0 0 1px ${hexToRgba(safeColor, 0.25)}`,
      }}
    >
      <NodeResizer
        color={safeColor}
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        onResizeEnd={(_event, params) => {
          if (onGroupResize) onGroupResize(id, params.width, params.height);
        }}
      />
      {/* Header badge — floats above the top-left corner of the container */}
      <div
        style={{
          position: 'absolute',
          top: '-14px',
          left: '12px',
          background: safeColor,
          padding: '2px 10px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold',
          zIndex: 10,
          whiteSpace: 'nowrap',
          // Keep the badge readable: darken slightly if colour is very light
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}
      >
        <DatabaseOutlined style={{ fontSize: '11px' }} />
        <span>{name}</span>
        <span style={{ opacity: 0.75, fontWeight: 'normal' }}>
          ({tableCount} tables{typeCount > 0 ? `, ${typeCount} types` : ''})
        </span>
      </div>

      {/* Optional description — sits just inside the top edge below the badge */}
      {description && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '14px',
            right: '14px',
            color: hexToRgba(safeColor, 0.7),
            fontSize: '10px',
            fontStyle: 'italic',
            pointerEvents: 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
});

DatabaseGroupNode.displayName = 'DatabaseGroupNode';

export default DatabaseGroupNode;
