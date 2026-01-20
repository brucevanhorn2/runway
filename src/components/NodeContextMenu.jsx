import React, { useCallback, useEffect, useRef } from 'react';
import {
  FileSearchOutlined,
  LinkOutlined,
  CompressOutlined,
  ExpandOutlined,
  AimOutlined,
  CopyOutlined,
} from '@ant-design/icons';

const styles = {
  menu: {
    position: 'fixed',
    background: '#2d2d2d',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '4px 0',
    minWidth: '180px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    color: '#ccc',
    fontSize: '13px',
  },
  menuItemHover: {
    background: '#3c3c3c',
  },
  menuItemDisabled: {
    color: '#666',
    cursor: 'not-allowed',
  },
  divider: {
    height: '1px',
    background: '#444',
    margin: '4px 0',
  },
  shortcut: {
    marginLeft: 'auto',
    fontSize: '11px',
    color: '#666',
  },
};

function NodeContextMenu({
  x,
  y,
  node,
  isCollapsed,
  onClose,
  onGoToDefinition,
  onFindUsages,
  onToggleCollapse,
  onCenterOnNode,
  onCopyName,
}) {
  const menuRef = useRef(null);
  const [hoveredItem, setHoveredItem] = React.useState(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200;
    const menuHeight = 200;
    const padding = 10;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > window.innerWidth - padding) {
      adjustedX = window.innerWidth - menuWidth - padding;
    }

    if (y + menuHeight > window.innerHeight - padding) {
      adjustedY = window.innerHeight - menuHeight - padding;
    }

    return { x: adjustedX, y: adjustedY };
  }, [x, y]);

  const handleItemClick = useCallback((action) => {
    action();
    onClose();
  }, [onClose]);

  const menuItems = [
    {
      key: 'goToDefinition',
      icon: <FileSearchOutlined />,
      label: 'Go to Definition',
      shortcut: 'Cmd+G',
      onClick: onGoToDefinition,
      disabled: !node,
    },
    {
      key: 'findUsages',
      icon: <LinkOutlined />,
      label: 'Find Usages',
      shortcut: 'Alt+F7',
      onClick: onFindUsages,
      disabled: !node || node.type === 'type',
    },
    { key: 'divider1', type: 'divider' },
    {
      key: 'toggleCollapse',
      icon: isCollapsed ? <ExpandOutlined /> : <CompressOutlined />,
      label: isCollapsed ? 'Expand' : 'Collapse',
      onClick: onToggleCollapse,
      disabled: !node,
    },
    {
      key: 'centerOnNode',
      icon: <AimOutlined />,
      label: 'Center on Node',
      onClick: onCenterOnNode,
      disabled: !node,
    },
    { key: 'divider2', type: 'divider' },
    {
      key: 'copyName',
      icon: <CopyOutlined />,
      label: 'Copy Name',
      onClick: onCopyName,
      disabled: !node,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        ...styles.menu,
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {menuItems.map((item) => {
        if (item.type === 'divider') {
          return <div key={item.key} style={styles.divider} />;
        }

        const isHovered = hoveredItem === item.key;
        const itemStyle = {
          ...styles.menuItem,
          ...(isHovered && !item.disabled ? styles.menuItemHover : {}),
          ...(item.disabled ? styles.menuItemDisabled : {}),
        };

        return (
          <div
            key={item.key}
            style={itemStyle}
            onMouseEnter={() => setHoveredItem(item.key)}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => !item.disabled && handleItemClick(item.onClick)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.shortcut && <span style={styles.shortcut}>{item.shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default NodeContextMenu;
