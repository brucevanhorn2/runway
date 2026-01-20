import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { UnorderedListOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

const TypeNode = memo(({ data, selected }) => {
  const { type, isSelected, isCollapsed, isFiltered, onToggleCollapse } = data;
  const isHighlighted = selected || isSelected;
  const isDimmed = isFiltered === false;

  const handleToggleCollapse = useCallback((e) => {
    e.stopPropagation();
    onToggleCollapse?.(type.name);
  }, [onToggleCollapse, type.name]);

  return (
    <div
      style={{
        background: '#252526',
        border: isHighlighted ? '2px solid #f5c518' : '1px solid #444',
        borderRadius: '4px',
        minWidth: '180px',
        maxWidth: '250px',
        fontSize: '12px',
        boxShadow: isHighlighted
          ? '0 0 12px rgba(245, 197, 24, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
        opacity: isDimmed ? 0.4 : 1,
      }}
    >
      {/* Type Header */}
      <div
        style={{
          background: isHighlighted ? '#d48806' : '#2d7c47',
          padding: '8px 12px',
          borderRadius: isCollapsed ? '3px' : '3px 3px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
        onClick={handleToggleCollapse}
      >
        {isCollapsed ? (
          <RightOutlined style={{ fontSize: '10px' }} />
        ) : (
          <DownOutlined style={{ fontSize: '10px' }} />
        )}
        <UnorderedListOutlined />
        <span style={{ flex: 1 }}>{type.name}</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>
          ({type.values.length})
        </span>
      </div>

      {/* Enum Values - only show when not collapsed */}
      {!isCollapsed && (
        <div style={{ padding: '4px 0' }}>
          {type.values.map((value, index) => (
            <div
              key={value}
              style={{
                padding: '4px 12px',
                borderBottom: index < type.values.length - 1 ? '1px solid #333' : 'none',
                color: '#d4d4d4',
              }}
            >
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#2d7c47',
          width: '8px',
          height: '8px',
          border: '2px solid #252526',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#2d7c47',
          width: '8px',
          height: '8px',
          border: '2px solid #252526',
        }}
      />
    </div>
  );
});

TypeNode.displayName = 'TypeNode';

export default TypeNode;
