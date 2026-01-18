import React, { useState, useEffect, useCallback } from 'react';
import { Layout as AntLayout, Splitter } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import FileTree from './components/FileTree';
import SchemaView from './components/SchemaView';
import SqlTabs from './components/SqlTabs';
import './Layout.css';

// Import context providers
import { SchemaProvider, useSchema } from './contexts/SchemaContext';
import { EditorProvider, useEditor } from './contexts/EditorContext';
import { SelectionProvider } from './contexts/SelectionContext';

// Import parser
import { parseAllFiles } from './parser';

const { Header, Content } = AntLayout;

function LayoutInner() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [sqlFiles, setSqlFiles] = useState([]);
  const [openFolderPath, setOpenFolderPath] = useState(null);
  const [highlightedFile, setHighlightedFile] = useState(null);

  const { updateSchema, setIsLoading, setParseError, clearSchema } = useSchema();
  const { openFile } = useEditor();

  // Parse all DDL files and update schema
  const parseSchema = useCallback(async (folderPath) => {
    if (!window.electron) return;

    setIsLoading(true);
    try {
      const result = await window.electron.readAllFiles(folderPath);
      if (result.success) {
        const schema = parseAllFiles(result.files);
        updateSchema(schema);
      } else {
        setParseError(result.error);
      }
    } catch (error) {
      console.error('Failed to parse schema:', error);
      setParseError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [updateSchema, setIsLoading, setParseError]);

  // Handle folder opened
  const handleFolderOpened = useCallback((data) => {
    setSqlFiles(data.files);
    setOpenFolderPath(data.path);
    clearSchema();
    parseSchema(data.path);
  }, [clearSchema, parseSchema]);

  // Handle file changes
  const handleFileChanged = useCallback((data) => {
    if (openFolderPath) {
      parseSchema(openFolderPath);
    }
  }, [openFolderPath, parseSchema]);

  // Handle file selection in tree
  const handleFileSelect = useCallback((file) => {
    openFile(file.path, file.name);
    setHighlightedFile(file.path);
  }, [openFile]);

  // Handle table selection in diagram - highlight corresponding file
  const handleTableSelect = useCallback((tableName, sourceFile) => {
    if (sourceFile) {
      setHighlightedFile(sourceFile);
      // Also open the file in the editor
      const file = sqlFiles.find(f => f.path === sourceFile);
      if (file) {
        openFile(file.path, file.name);
      }
    }
  }, [sqlFiles, openFile]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onFolderOpened(handleFolderOpened);
      window.electron.onFileChanged(handleFileChanged);
      window.electron.onFileAdded(handleFileChanged);
      window.electron.onFileRemoved(handleFileChanged);
    }
  }, [handleFolderOpened, handleFileChanged]);

  return (
    <AntLayout style={{ height: '100vh' }}>
      <Header
        style={{
          background: '#1f1f1f',
          color: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #333',
          height: '48px',
          lineHeight: '48px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Runway</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          {openFolderPath ? openFolderPath : 'No folder open'}
        </div>
      </Header>

      <Content style={{ flex: 1, overflow: 'hidden' }}>
        <Splitter style={{ height: '100%', width: '100%' }}>
          {/* Left Pane - File Browser */}
          <Splitter.Pane
            defaultSize={leftCollapsed ? '0%' : '20%'}
            min="0%"
            max="40%"
            resizable={!leftCollapsed}
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="pane-header">
              <span>SQL Files</span>
              <button onClick={() => setLeftCollapsed(!leftCollapsed)}>
                {leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#1e1e1e' }}>
              <FileTree
                files={sqlFiles}
                onFileSelect={handleFileSelect}
                highlightedFile={highlightedFile}
              />
            </div>
          </Splitter.Pane>

          {/* Center Pane - Diagram and Editor */}
          <Splitter.Pane
            defaultSize="80%"
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Splitter layout="vertical" style={{ height: '100%' }}>
              {/* Top - Schema Diagram */}
              <Splitter.Pane
                defaultSize="60%"
                min="20%"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div className="pane-header">
                  <span>Schema Diagram</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>
                  <SchemaView onTableSelect={handleTableSelect} />
                </div>
              </Splitter.Pane>

              {/* Bottom - SQL Editor Tabs */}
              <Splitter.Pane
                defaultSize="40%"
                min="100px"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>
                  <SqlTabs />
                </div>
              </Splitter.Pane>
            </Splitter>
          </Splitter.Pane>
        </Splitter>
      </Content>
    </AntLayout>
  );
}

function Layout() {
  return (
    <SchemaProvider>
      <EditorProvider>
        <SelectionProvider>
          <LayoutInner />
        </SelectionProvider>
      </EditorProvider>
    </SchemaProvider>
  );
}

export default Layout;
