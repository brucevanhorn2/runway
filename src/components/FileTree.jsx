import React, { useEffect, useRef } from 'react';
import { FileOutlined, FolderOutlined } from '@ant-design/icons';

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
          Use File → Open Folder (Ctrl+O) to open a folder containing SQL files
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {files.map((file) => {
        const isHighlighted = highlightedFile && file.path === highlightedFile;

        return (
          <div
            key={file.path}
            ref={isHighlighted ? highlightedRef : null}
            className={`file-tree-item ${isHighlighted ? 'highlighted' : ''}`}
            onClick={() => onFileSelect(file)}
            title={file.path}
            style={isHighlighted ? {
              background: '#0e639c',
              borderLeft: '3px solid #f5c518',
            } : {}}
          >
            <FileOutlined className="file-icon" />
            <span>{file.relativePath}</span>
          </div>
        );
      })}
    </div>
  );
}

export default FileTree;
