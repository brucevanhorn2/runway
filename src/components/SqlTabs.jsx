import React, { useCallback } from 'react';
import { Tabs } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useEditor } from '../contexts/EditorContext';

function SqlTabs() {
  const {
    openFiles,
    activeFilePath,
    setActiveFilePath,
    closeFile,
    updateFileContent,
  } = useEditor();

  const handleTabChange = useCallback((key) => {
    setActiveFilePath(key);
  }, [setActiveFilePath]);

  const handleEditorChange = useCallback((value, filePath) => {
    updateFileContent(filePath, value);
  }, [updateFileContent]);

  const handleClose = useCallback((e, filePath) => {
    e.stopPropagation();
    closeFile(filePath);
  }, [closeFile]);

  if (openFiles.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="title">No files open</div>
        <div className="subtitle">
          Click on a SQL file in the left panel to view its contents
        </div>
      </div>
    );
  }

  const items = openFiles.map((file) => ({
    key: file.path,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{file.isDirty ? '● ' : ''}{file.name}</span>
        <CloseOutlined
          style={{ fontSize: '10px', opacity: 0.6 }}
          onClick={(e) => handleClose(e, file.path)}
        />
      </span>
    ),
    children: (
      <Editor
        height="100%"
        language="sql"
        theme="vs-dark"
        value={file.content}
        onChange={(value) => handleEditorChange(value, file.path)}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          readOnly: false,
          tabSize: 2,
        }}
      />
    ),
  }));

  return (
    <Tabs
      type="card"
      activeKey={activeFilePath}
      onChange={handleTabChange}
      items={items}
      style={{ height: '100%' }}
      tabBarStyle={{
        margin: 0,
        background: '#252526',
        borderBottom: '1px solid #333',
      }}
    />
  );
}

export default SqlTabs;
