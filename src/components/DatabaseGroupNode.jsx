import React, { memo } from 'react';
import { DatabaseOutlined } from '@ant-design/icons';

export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DatabaseGroupNode = memo(({ data }) => {
  const { name, description, color, tableCount, typeCount } = data;
  const safeColor = color || '#4a9eff';

  return (
    <div
      style={{
        background: hexToRgba(safeColor, 0.06),
        border: `2px solid ${safeColor}`,
        borderRadius: '8px',
        minWidth: '100%',
        minHeight: '100%',
        position: 'relative',
      }}
    >
      {/* Header badge - floats above top-left */}
      <div
        style={{
          position: 'absolute',
          top: '-14px',
          left: '12px',
          background: hexToRgba(safeColor, 0.85),
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
        }}
      >
        <DatabaseOutlined style={{ fontSize: '11px' }} />
        <span>{name}</span>
        <span style={{ opacity: 0.8, fontWeight: 'normal' }}>
          ({tableCount} tables{typeCount > 0 ? `, ${typeCount} types` : ''})
        </span>
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '12px',
            right: '12px',
            color: safeColor,
            fontSize: '10px',
            fontStyle: 'italic',
            opacity: 0.8,
            pointerEvents: 'none',
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
