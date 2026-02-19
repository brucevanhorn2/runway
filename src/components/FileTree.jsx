import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Tree, Dropdown, Modal, Input, message } from 'antd';
import {
  TableOutlined,
  UnorderedListOutlined,
  FileOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileMarkdownOutlined,
  FolderViewOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  FileAddOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  CodeOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import DatabaseRootModal from './DatabaseRootModal';

// File type styling configuration
const FILE_TYPE_CONFIG = {
  // SQL files - prominent
  table: {
    icon: TableOutlined,
    color: '#58a6ff',  // Blue for tables
  },
  enum: {
    icon: UnorderedListOutlined,
    color: '#d2a8ff',  // Purple for enums
  },
  other: {
    icon: FileOutlined,
    color: '#58a6ff',  // Blue for other SQL files
  },
  // Markdown - prominent
  markdown: {
    icon: FileMarkdownOutlined,
    color: '#e6db74',  // Yellow/gold for markdown
  },
  // Other file types - dimmed
  json: {
    icon: FileExcelOutlined,
    color: '#555',  // Dimmed gray
  },
  javascript: {
    icon: CodeOutlined,
    color: '#555',  // Dimmed gray
  },
  text: {
    icon: FileTextOutlined,
    color: '#555',  // Dimmed gray
  },
  yaml: {
    icon: FileTextOutlined,
    color: '#555',  // Dimmed gray
  },
  markup: {
    icon: CodeOutlined,
    color: '#555',  // Dimmed gray
  },
  // Fallback for unknown file types
  unknown: {
    icon: FileOutlined,
    color: '#555',  // Dimmed gray
  },
};

// Build hierarchical tree from flat file list
function buildTree(files, rootPath) {
  const root = { children: {} };

  files.forEach(file => {
    const parts = file.relativePath.split('/');
    let current = root;

    parts.forEach((part, index) => {
      if (!current.children[part]) {
        const isFile = index === parts.length - 1;
        current.children[part] = {
          name: part,
          children: isFile ? null : {},
          file: isFile ? file : null,
        };
      }
      current = current.children[part];
    });
  });

  // Convert to antd Tree format
  function toTreeData(node, relativePath = '') {
    const entries = Object.entries(node.children || {});

    // Sort: folders first, then files, alphabetically within each group
    entries.sort(([, a], [, b]) => {
      const aIsFolder = a.children !== null;
      const bIsFolder = b.children !== null;
      if (aIsFolder !== bIsFolder) return bIsFolder - aIsFolder;
      return a.name.localeCompare(b.name);
    });

    return entries.map(([key, value]) => {
      const newRelativePath = relativePath ? `${relativePath}/${key}` : key;
      const isFolder = value.children !== null;
      // Build absolute folder path
      const absoluteFolderPath = rootPath ? `${rootPath}/${newRelativePath}` : newRelativePath;

      if (isFolder) {
        return {
          key: `folder:${newRelativePath}`,
          title: key,
          isFolder: true,
          folderPath: absoluteFolderPath,
          children: toTreeData(value, newRelativePath),
        };
      } else {
        const typeConfig = FILE_TYPE_CONFIG[value.file.fileType] || FILE_TYPE_CONFIG.unknown;
        return {
          key: value.file.path,
          title: key,
          isFolder: false,
          file: value.file,
          icon: <typeConfig.icon style={{ color: typeConfig.color }} />,
        };
      }
    });
  }

  return toTreeData(root);
}

// Get all parent folder keys for a file path
function getParentFolderKeys(filePath, files) {
  const file = files.find(f => f.path === filePath);
  if (!file) return [];

  const parts = file.relativePath.split('/');
  const keys = [];
  let path = '';

  for (let i = 0; i < parts.length - 1; i++) {
    path = path ? `${path}/${parts[i]}` : parts[i];
    keys.push(`folder:${path}`);
  }

  return keys;
}

function FileTree({
  files,
  onFileSelect,
  highlightedFile,
  folderPath,
  databaseRoots = [],
  onDatabaseRootChange,
  showNonSqlFiles = true,
  showMarkdownFiles = true,
}) {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, node: null, x: 0, y: 0 });
  const [renameModal, setRenameModal] = useState({ visible: false, node: null, newName: '' });
  const [deleteModal, setDeleteModal] = useState({ visible: false, node: null });
  const [newFileModal, setNewFileModal] = useState({ visible: false, folderPath: '', fileName: '' });
  const [dbRootModal, setDbRootModal] = useState({ visible: false, mode: 'create', node: null, initialValues: null });
  const treeRef = useRef(null);

  // Helpers to check database root status
  const isDatabaseRoot = useCallback((absolutePath) => {
    return databaseRoots.some(r => r.folderPath === absolutePath);
  }, [databaseRoots]);

  const getDatabaseRoot = useCallback((absolutePath) => {
    return databaseRoots.find(r => r.folderPath === absolutePath) || null;
  }, [databaseRoots]);

  // Filter files based on toggle settings
  const filteredFiles = useMemo(() => {
    if (!files) return [];
    return files.filter(file => {
      const { fileType } = file;
      // Always show SQL files (table, enum, other)
      if (['table', 'enum', 'other'].includes(fileType)) return true;
      // Show markdown if toggle is on
      if (fileType === 'markdown') return showMarkdownFiles;
      // Show other files if toggle is on
      return showNonSqlFiles;
    });
  }, [files, showNonSqlFiles, showMarkdownFiles]);

  // Build tree data from filtered file list
  const treeData = useMemo(() => {
    if (!filteredFiles || filteredFiles.length === 0) return [];
    return buildTree(filteredFiles, folderPath);
  }, [filteredFiles, folderPath]);

  // Get all descendant folder keys for expand all
  const getAllDescendantKeys = useCallback((node) => {
    const keys = [];
    const traverse = (n) => {
      if (n.isFolder) {
        keys.push(n.key);
        (n.children || []).forEach(traverse);
      }
    };
    traverse(node);
    return keys;
  }, []);

  // Auto-expand to highlighted file when it changes
  useEffect(() => {
    if (highlightedFile && files) {
      const parentKeys = getParentFolderKeys(highlightedFile, files);
      if (parentKeys.length > 0) {
        setExpandedKeys(prev => {
          const newKeys = [...new Set([...prev, ...parentKeys])];
          return newKeys;
        });
      }

      // Scroll to the highlighted node after a short delay (for expansion to complete)
      setTimeout(() => {
        const node = document.querySelector(`[data-tree-node-key="${CSS.escape(highlightedFile)}"]`);
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }, [highlightedFile, files]);

  // Context menu handlers
  const handleRevealInFinder = useCallback(async (node) => {
    if (!window.electron) return;
    const path = node.isFolder ? node.folderPath : node.file.path;
    await window.electron.revealInFinder(path);
  }, []);

  const handleCopyPath = useCallback((node) => {
    const path = node.isFolder ? node.folderPath : node.file.path;
    navigator.clipboard.writeText(path);
    message.success('Path copied to clipboard');
  }, []);

  const handleRename = useCallback((node) => {
    const currentName = node.isFolder ? node.title : node.file.name;
    setRenameModal({ visible: true, node, newName: currentName });
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!window.electron || !renameModal.node) return;

    const { node, newName } = renameModal;
    if (!newName.trim()) {
      message.error('Name cannot be empty');
      return;
    }

    const oldPath = node.isFolder ? node.folderPath : node.file.path;
    const result = await window.electron.renameFile(oldPath, newName.trim());

    if (result.success) {
      message.success('Renamed successfully');
      setRenameModal({ visible: false, node: null, newName: '' });
    } else {
      message.error(result.error || 'Failed to rename');
    }
  }, [renameModal]);

  const handleDelete = useCallback((node) => {
    setDeleteModal({ visible: true, node });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!window.electron || !deleteModal.node) return;

    const { node } = deleteModal;
    const path = node.isFolder ? node.folderPath : node.file.path;
    const result = await window.electron.deleteFile(path);

    if (result.success) {
      message.success('Deleted successfully');
      setDeleteModal({ visible: false, node: null });
    } else {
      message.error(result.error || 'Failed to delete');
    }
  }, [deleteModal]);

  const handleNewFile = useCallback((node) => {
    const targetFolder = node.folderPath || folderPath;
    setNewFileModal({ visible: true, folderPath: targetFolder, fileName: '' });
  }, [folderPath]);

  const handleNewFileConfirm = useCallback(async () => {
    if (!window.electron) return;

    const { folderPath: targetFolder, fileName } = newFileModal;
    if (!fileName.trim()) {
      message.error('File name cannot be empty');
      return;
    }

    // Ensure .sql extension
    let finalName = fileName.trim();
    if (!finalName.toLowerCase().endsWith('.sql')) {
      finalName += '.sql';
    }

    const result = await window.electron.createFileInFolder(targetFolder, finalName);

    if (result.success) {
      message.success('File created');
      setNewFileModal({ visible: false, folderPath: '', fileName: '' });
    } else {
      message.error(result.error || 'Failed to create file');
    }
  }, [newFileModal]);

  // Database root handlers
  const handleMarkDbRoot = useCallback((node) => {
    setDbRootModal({
      visible: true,
      mode: 'create',
      node,
      initialValues: { name: node.title, color: '#4a9eff', description: '' },
    });
  }, []);

  const handleEditDbRoot = useCallback((node) => {
    const existing = getDatabaseRoot(node.folderPath);
    setDbRootModal({
      visible: true,
      mode: 'edit',
      node,
      initialValues: {
        name: existing?.name || node.title,
        color: existing?.color || '#4a9eff',
        description: existing?.description || '',
      },
    });
  }, [getDatabaseRoot]);

  const handleRemoveDbRoot = useCallback(async (node) => {
    if (!window.electron?.removeDatabaseRoot) return;
    const result = await window.electron.removeDatabaseRoot(node.folderPath);
    if (result.success) {
      message.success('Database root removed');
      onDatabaseRootChange?.();
    } else {
      message.error(result.error || 'Failed to remove database root');
    }
  }, [onDatabaseRootChange]);

  const handleDbRootModalConfirm = useCallback(async (values) => {
    if (!window.electron?.writeDatabaseRoot || !dbRootModal.node) return;
    const result = await window.electron.writeDatabaseRoot(dbRootModal.node.folderPath, values);
    if (result.success) {
      message.success(dbRootModal.mode === 'create' ? 'Database root created' : 'Database root updated');
      setDbRootModal({ visible: false, mode: 'create', node: null, initialValues: null });
      onDatabaseRootChange?.();
    } else {
      message.error(result.error || 'Failed to save database root');
    }
  }, [dbRootModal, onDatabaseRootChange]);

  const handleExpandAll = useCallback((node) => {
    const descendantKeys = getAllDescendantKeys(node);
    setExpandedKeys(prev => [...new Set([...prev, ...descendantKeys])]);
  }, [getAllDescendantKeys]);

  const handleCollapseAll = useCallback((node) => {
    const descendantKeys = getAllDescendantKeys(node);
    setExpandedKeys(prev => prev.filter(key => !descendantKeys.includes(key)));
  }, [getAllDescendantKeys]);

  // Build context menu items based on node type
  const getContextMenuItems = useCallback((node) => {
    if (node.isFolder) {
      const isDbRoot = isDatabaseRoot(node.folderPath);
      const dbRootItems = isDbRoot
        ? [
            {
              key: 'editDbRoot',
              icon: <DatabaseOutlined />,
              label: 'Edit Database Info...',
              onClick: () => handleEditDbRoot(node),
            },
            {
              key: 'removeDbRoot',
              icon: <DatabaseOutlined />,
              label: 'Remove Database Root',
              danger: true,
              onClick: () => handleRemoveDbRoot(node),
            },
            { type: 'divider' },
          ]
        : [
            {
              key: 'markDbRoot',
              icon: <DatabaseOutlined />,
              label: 'Mark as Database Root',
              onClick: () => handleMarkDbRoot(node),
            },
            { type: 'divider' },
          ];

      return [
        ...dbRootItems,
        {
          key: 'newFile',
          icon: <FileAddOutlined />,
          label: 'New SQL File',
          onClick: () => handleNewFile(node),
        },
        { type: 'divider' },
        {
          key: 'expandAll',
          icon: <PlusSquareOutlined />,
          label: 'Expand All',
          onClick: () => handleExpandAll(node),
        },
        {
          key: 'collapseAll',
          icon: <MinusSquareOutlined />,
          label: 'Collapse All',
          onClick: () => handleCollapseAll(node),
        },
        { type: 'divider' },
        {
          key: 'revealInFinder',
          icon: <FolderViewOutlined />,
          label: 'Reveal in Finder',
          onClick: () => handleRevealInFinder(node),
        },
        {
          key: 'copyPath',
          icon: <CopyOutlined />,
          label: 'Copy Path',
          onClick: () => handleCopyPath(node),
        },
      ];
    } else {
      return [
        {
          key: 'revealInFinder',
          icon: <FolderViewOutlined />,
          label: 'Reveal in Finder',
          onClick: () => handleRevealInFinder(node),
        },
        {
          key: 'copyPath',
          icon: <CopyOutlined />,
          label: 'Copy Path',
          onClick: () => handleCopyPath(node),
        },
        { type: 'divider' },
        {
          key: 'rename',
          icon: <EditOutlined />,
          label: 'Rename',
          onClick: () => handleRename(node),
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: 'Delete',
          danger: true,
          onClick: () => handleDelete(node),
        },
      ];
    }
  }, [handleNewFile, handleExpandAll, handleCollapseAll, handleRevealInFinder, handleCopyPath, handleRename, handleDelete, isDatabaseRoot, handleMarkDbRoot, handleEditDbRoot, handleRemoveDbRoot]);

  if (!files || files.length === 0) {
    return (
      <div className="empty-state">
        <FolderOutlined className="icon" />
        <div className="title">No folder open</div>
        <div className="subtitle">
          Use File → Open Folder (⌘O) to open a folder containing SQL files
        </div>
      </div>
    );
  }

  const handleSelect = (selectedKeys, { node }) => {
    if (!node.isFolder && node.file) {
      onFileSelect(node.file);
    }
  };

  const handleExpand = (newExpandedKeys) => {
    setExpandedKeys(newExpandedKeys);
  };

  const handleRightClick = ({ event, node }) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      node,
      x: event.clientX,
      y: event.clientY,
    });
  };

  // Custom title renderer for styling
  const titleRender = (nodeData) => {
    const isHighlighted = !nodeData.isFolder && highlightedFile === nodeData.key;
    // Dim non-SQL/non-MD files (json, javascript, text, yaml, markup, unknown)
    const isDimmed = !nodeData.isFolder &&
      ['json', 'javascript', 'text', 'yaml', 'markup', 'unknown'].includes(nodeData.file?.fileType);
    const dbRoot = nodeData.isFolder ? getDatabaseRoot(nodeData.folderPath) : null;

    return (
      <span
        data-tree-node-key={nodeData.key}
        style={{
          color: isDimmed ? '#555' : undefined,
          fontWeight: isHighlighted ? 'bold' : undefined,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
        title={nodeData.isFolder ? nodeData.title : `${nodeData.file?.path} (${nodeData.file?.fileType || 'other'})`}
      >
        {nodeData.title}
        {dbRoot && (
          <DatabaseOutlined
            style={{ color: dbRoot.color, fontSize: '11px', marginLeft: 2 }}
            title={dbRoot.name}
          />
        )}
      </span>
    );
  };

  return (
    <div style={{ padding: '8px 0' }} className="file-tree-container">
      <Tree
        ref={treeRef}
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={handleExpand}
        selectedKeys={highlightedFile ? [highlightedFile] : []}
        onSelect={handleSelect}
        onRightClick={handleRightClick}
        titleRender={titleRender}
        showIcon
        icon={(props) => {
          if (props.data.isFolder) {
            return props.expanded ?
              <FolderOpenOutlined style={{ color: '#d4a656' }} /> :
              <FolderOutlined style={{ color: '#d4a656' }} />;
          }
          return props.data.icon;
        }}
        blockNode
        className="sql-file-tree"
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <Dropdown
          menu={{ items: getContextMenuItems(contextMenu.node) }}
          open={true}
          onOpenChange={(open) => {
            if (!open) setContextMenu({ ...contextMenu, visible: false });
          }}
          trigger={['contextMenu']}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
            }}
          />
        </Dropdown>
      )}

      {/* Rename Modal */}
      <Modal
        title="Rename"
        open={renameModal.visible}
        onOk={handleRenameConfirm}
        onCancel={() => setRenameModal({ visible: false, node: null, newName: '' })}
        okText="Rename"
      >
        <Input
          value={renameModal.newName}
          onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
          onPressEnter={handleRenameConfirm}
          autoFocus
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete"
        open={deleteModal.visible}
        onOk={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ visible: false, node: null })}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to delete{' '}
          <strong>{deleteModal.node?.isFolder ? deleteModal.node?.title : deleteModal.node?.file?.name}</strong>?
        </p>
        <p style={{ color: '#888', fontSize: '12px' }}>This action cannot be undone.</p>
      </Modal>

      {/* New File Modal */}
      <Modal
        title="New SQL File"
        open={newFileModal.visible}
        onOk={handleNewFileConfirm}
        onCancel={() => setNewFileModal({ visible: false, folderPath: '', fileName: '' })}
        okText="Create"
      >
        <Input
          placeholder="filename.sql"
          value={newFileModal.fileName}
          onChange={(e) => setNewFileModal({ ...newFileModal, fileName: e.target.value })}
          onPressEnter={handleNewFileConfirm}
          autoFocus
        />
        <p style={{ color: '#888', fontSize: '12px', marginTop: 8 }}>
          Will be created in: {newFileModal.folderPath}
        </p>
      </Modal>

      {/* Database Root Modal */}
      <DatabaseRootModal
        open={dbRootModal.visible}
        mode={dbRootModal.mode}
        initialValues={dbRootModal.initialValues}
        folderName={dbRootModal.node?.title}
        onConfirm={handleDbRootModalConfirm}
        onCancel={() => setDbRootModal({ visible: false, mode: 'create', node: null, initialValues: null })}
      />
    </div>
  );
}

export default FileTree;
