import React, { memo } from 'react';
import { FolderOpenOutlined } from '@ant-design/icons';

// Color palette for groups (will cycle through these)
const GROUP_COLORS = [
  { bg: 'rgba(30, 136, 229, 0.08)', border: '#1e88e5', header: '#1565c0' },  // Blue
  { bg: 'rgba(67, 160, 71, 0.08)', border: '#43a047', header: '#2e7d32' },   // Green
  { bg: 'rgba(251, 140, 0, 0.08)', border: '#fb8c00', header: '#ef6c00' },   // Orange
  { bg: 'rgba(142, 36, 170, 0.08)', border: '#8e24aa', header: '#6a1b9a' },  // Purple
  { bg: 'rgba(0, 151, 167, 0.08)', border: '#00acc1', header: '#00838f' },   // Cyan
  { bg: 'rgba(216, 27, 96, 0.08)', border: '#d81b60', header: '#ad1457' },   // Pink
  { bg: 'rgba(109, 76, 65, 0.08)', border: '#6d4c41', header: '#4e342e' },   // Brown
  { bg: 'rgba(84, 110, 122, 0.08)', border: '#546e7a', header: '#37474f' },  // Blue Grey
];

/**
 * Get consistent color for a group based on its name
 */
export function getGroupColor(groupName) {
  // Simple hash to get consistent color for same group name
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = ((hash << 5) - hash) + groupName.charCodeAt(i);
    hash = hash & hash;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

const GroupNode = memo(({ data }) => {
  const { label, tableCount, typeCount, colorIndex } = data;
  const colors = GROUP_COLORS[colorIndex % GROUP_COLORS.length];

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px dashed ${colors.border}`,
        borderRadius: '8px',
        minWidth: '100%',
        minHeight: '100%',
        position: 'relative',
      }}
    >
      {/* Group Header */}
      <div
        style={{
          position: 'absolute',
          top: '-12px',
          left: '12px',
          background: colors.header,
          padding: '2px 10px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold',
          zIndex: 10,
        }}
      >
        <FolderOpenOutlined style={{ fontSize: '12px' }} />
        <span>{label}</span>
        <span style={{ opacity: 0.7, fontWeight: 'normal' }}>
          ({tableCount} tables{typeCount > 0 ? `, ${typeCount} types` : ''})
        </span>
      </div>
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;
