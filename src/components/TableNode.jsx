import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { TableOutlined, KeyOutlined, LinkOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

const TableNode = memo(({ data, selected }) => {
  const { table, isSelected, isCollapsed, isFiltered, onToggleCollapse } = data;
  const isHighlighted = selected || isSelected;
  const isDimmed = isFiltered === false; // Explicitly false means filtered out

  const isPrimaryKey = (columnName) => {
    return table.primaryKey.includes(columnName);
  };

  const isForeignKey = (columnName) => {
    return table.foreignKeys.some(fk => fk.columns.includes(columnName));
  };

  const handleToggleCollapse = useCallback((e) => {
    e.stopPropagation();
    onToggleCollapse?.(table.name);
  }, [onToggleCollapse, table.name]);

  return (
    <div
      style={{
        background: '#252526',
        border: isHighlighted ? '2px solid #f5c518' : '1px solid #444',
        borderRadius: '4px',
        minWidth: '200px',
        maxWidth: '300px',
        fontSize: '12px',
        boxShadow: isHighlighted
          ? '0 0 12px rgba(245, 197, 24, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
        opacity: isDimmed ? 0.4 : 1,
      }}
    >
      {/* Table Header */}
      <div
        style={{
          background: isHighlighted ? '#d48806' : '#0e639c',
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
        <TableOutlined />
        <span style={{ flex: 1 }}>{table.name}</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>
          ({table.columns.length})
        </span>
      </div>

      {/* Columns - only show when not collapsed */}
      {!isCollapsed && (
        <div style={{ padding: '4px 0' }}>
          {table.columns.map((column, index) => (
            <div
              key={column.name}
              style={{
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderBottom: index < table.columns.length - 1 ? '1px solid #333' : 'none',
                color: '#d4d4d4',
              }}
            >
              {/* Column Icons */}
              <div style={{ display: 'flex', gap: '2px', minWidth: '28px' }}>
                {isPrimaryKey(column.name) && (
                  <KeyOutlined style={{ color: '#f5c518', fontSize: '10px' }} title="Primary Key" />
                )}
                {isForeignKey(column.name) && (
                  <LinkOutlined style={{ color: '#6997d5', fontSize: '10px' }} title="Foreign Key" />
                )}
              </div>

              {/* Column Name */}
              <span
                style={{
                  flex: 1,
                  fontWeight: isPrimaryKey(column.name) ? 'bold' : 'normal',
                }}
              >
                {column.name}
              </span>

              {/* Column Type */}
              <span style={{ color: '#888', fontSize: '11px' }}>
                {column.dataType}
                {!column.nullable && <span style={{ color: '#f44' }}>*</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#6997d5',
          width: '8px',
          height: '8px',
          border: '2px solid #252526',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#6997d5',
          width: '8px',
          height: '8px',
          border: '2px solid #252526',
        }}
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';

export default TableNode;
