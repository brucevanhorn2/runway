import React, { useEffect, useRef } from 'react';
import { TableOutlined, UnorderedListOutlined, FileOutlined, FolderOutlined } from '@ant-design/icons';

// File type styling configuration
const FILE_TYPE_CONFIG = {
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
    color: '#6e7681',  // Gray for other files
  },
};

function FileTree({ files, onFileSelect, highlightedFile }) {
  const highlightedRef = useRef(null);

  // Scroll highlighted file into view
  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [highlightedFile]);

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

  return (
    <div style={{ padding: '8px 0' }}>
      {files.map((file) => {
        const isHighlighted = highlightedFile && file.path === highlightedFile;
        const typeConfig = FILE_TYPE_CONFIG[file.fileType] || FILE_TYPE_CONFIG.other;
        const IconComponent = typeConfig.icon;

        return (
          <div
            key={file.path}
            ref={isHighlighted ? highlightedRef : null}
            className={`file-tree-item ${isHighlighted ? 'highlighted' : ''}`}
            onClick={() => onFileSelect(file)}
            title={`${file.path} (${file.fileType || 'other'})`}
            style={isHighlighted ? {
              background: '#0e639c',
              borderLeft: '3px solid #f5c518',
            } : {}}
          >
            <IconComponent className="file-icon" style={{ color: typeConfig.color }} />
            <span style={{ color: file.fileType === 'other' ? '#6e7681' : undefined }}>
              {file.relativePath}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default FileTree;
