import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { UnorderedListOutlined } from '@ant-design/icons';

const TypeNode = memo(({ data, selected }) => {
  const { type, isSelected } = data;
  const isHighlighted = selected || isSelected;

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
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Type Header */}
      <div
        style={{
          background: '#2d7c47',
          padding: '8px 12px',
          borderRadius: '3px 3px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#fff',
          fontWeight: 'bold',
        }}
      >
        <UnorderedListOutlined />
        <span>{type.name}</span>
      </div>

      {/* Enum Values */}
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
