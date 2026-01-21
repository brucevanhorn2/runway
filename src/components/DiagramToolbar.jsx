import React, { useState, useCallback, useRef } from 'react';
import { Input, Button, Dropdown, Tooltip } from 'antd';
import {
  SearchOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
  ApartmentOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CompressOutlined,
  ExpandOutlined,
  FolderOutlined,
  AppstoreOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  AlignCenterOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  PicCenterOutlined,
} from '@ant-design/icons';

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    background: '#252526',
    borderBottom: '1px solid #333',
  },
  searchBox: {
    width: '180px',
  },
  divider: {
    width: '1px',
    height: '20px',
    background: '#444',
    margin: '0 4px',
  },
  label: {
    fontSize: '11px',
    color: '#888',
    marginRight: '4px',
  },
};

const LAYOUT_OPTIONS = [
  { key: 'LR', label: 'Left to Right', icon: <ColumnWidthOutlined /> },
  { key: 'TB', label: 'Top to Bottom', icon: <ColumnHeightOutlined /> },
  { key: 'RL', label: 'Right to Left', icon: <ColumnWidthOutlined style={{ transform: 'scaleX(-1)' }} /> },
  { key: 'BT', label: 'Bottom to Top', icon: <ColumnHeightOutlined style={{ transform: 'scaleY(-1)' }} /> },
];

function DiagramToolbar({
  onSearch,
  onLayoutChange,
  onResetLayout,
  onToggleMinimap,
  onToggleCollapsed,
  onToggleGroupByFolder,
  onAlign,
  currentLayout = 'LR',
  showMinimap = true,
  allCollapsed = false,
  groupByFolder = false,
  tableCount = 0,
  typeCount = 0,
  selectedCount = 0,
}) {
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef(null);

  // Handle search input
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  }, [onSearch]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onSearch?.('');
  }, [onSearch]);

  // Handle layout selection
  const handleLayoutSelect = useCallback(({ key }) => {
    onLayoutChange?.(key);
  }, [onLayoutChange]);

  // Layout menu items
  const layoutMenuItems = LAYOUT_OPTIONS.map(opt => ({
    key: opt.key,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {opt.icon}
        {opt.label}
        {opt.key === currentLayout && <span style={{ color: '#58a6ff' }}> (current)</span>}
      </span>
    ),
  }));

  return (
    <div style={styles.toolbar}>
      {/* Search */}
      <Input
        ref={searchInputRef}
        size="small"
        placeholder="Filter tables..."
        prefix={<SearchOutlined style={{ color: '#666' }} />}
        value={searchValue}
        onChange={handleSearchChange}
        allowClear
        onClear={handleClearSearch}
        style={{
          ...styles.searchBox,
          background: '#3c3c3c',
          border: '1px solid #555',
        }}
      />

      <div style={styles.divider} />

      {/* Layout dropdown */}
      <Dropdown
        menu={{ items: layoutMenuItems, onClick: handleLayoutSelect }}
        trigger={['click']}
      >
        <Tooltip title="Change Layout Direction">
          <Button
            size="small"
            icon={<ApartmentOutlined />}
            style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
          >
            Layout
          </Button>
        </Tooltip>
      </Dropdown>

      {/* Reset layout */}
      <Tooltip title="Reset Layout (re-run auto-layout)">
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onResetLayout}
          style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
        />
      </Tooltip>

      {/* Group by folder toggle */}
      <Tooltip title={groupByFolder ? 'Ungroup (show flat view)' : 'Group by Folder (UML packages)'}>
        <Button
          size="small"
          icon={groupByFolder ? <FolderOutlined /> : <AppstoreOutlined />}
          onClick={onToggleGroupByFolder}
          style={{
            background: groupByFolder ? '#1e88e5' : '#3c3c3c',
            border: groupByFolder ? '1px solid #1e88e5' : '1px solid #555',
            color: groupByFolder ? '#fff' : '#ccc',
          }}
        />
      </Tooltip>

      <div style={styles.divider} />

      {/* Collapse/Expand all */}
      <Tooltip title={allCollapsed ? 'Expand All Tables' : 'Collapse All Tables'}>
        <Button
          size="small"
          icon={allCollapsed ? <ExpandOutlined /> : <CompressOutlined />}
          onClick={onToggleCollapsed}
          style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
        />
      </Tooltip>

      {/* Minimap toggle */}
      <Tooltip title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}>
        <Button
          size="small"
          icon={showMinimap ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          onClick={onToggleMinimap}
          style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
        />
      </Tooltip>

      {/* Alignment tools - only show when 2+ nodes selected */}
      {selectedCount >= 2 && (
        <>
          <div style={styles.divider} />
          <span style={styles.label}>{selectedCount} selected</span>
          <Tooltip title="Align Left">
            <Button
              size="small"
              icon={<AlignLeftOutlined />}
              onClick={() => onAlign?.('left')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          <Tooltip title="Align Center (Horizontal)">
            <Button
              size="small"
              icon={<AlignCenterOutlined />}
              onClick={() => onAlign?.('centerH')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          <Tooltip title="Align Right">
            <Button
              size="small"
              icon={<AlignRightOutlined />}
              onClick={() => onAlign?.('right')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          <Tooltip title="Align Top">
            <Button
              size="small"
              icon={<VerticalAlignTopOutlined />}
              onClick={() => onAlign?.('top')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          <Tooltip title="Align Middle (Vertical)">
            <Button
              size="small"
              icon={<VerticalAlignMiddleOutlined />}
              onClick={() => onAlign?.('centerV')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          <Tooltip title="Align Bottom">
            <Button
              size="small"
              icon={<VerticalAlignBottomOutlined />}
              onClick={() => onAlign?.('bottom')}
              style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
            />
          </Tooltip>
          {selectedCount >= 3 && (
            <>
              <div style={styles.divider} />
              <Tooltip title="Distribute Horizontally">
                <Button
                  size="small"
                  icon={<PicCenterOutlined style={{ transform: 'rotate(90deg)' }} />}
                  onClick={() => onAlign?.('distributeH')}
                  style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
                />
              </Tooltip>
              <Tooltip title="Distribute Vertically">
                <Button
                  size="small"
                  icon={<PicCenterOutlined />}
                  onClick={() => onAlign?.('distributeV')}
                  style={{ background: '#3c3c3c', border: '1px solid #555', color: '#ccc' }}
                />
              </Tooltip>
            </>
          )}
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Stats */}
      <span style={{ fontSize: '11px', color: '#666' }}>
        {tableCount} tables, {typeCount} enums
      </span>
    </div>
  );
}

export default DiagramToolbar;
