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
import { SelectionProvider, useSelection } from './contexts/SelectionContext';

// Import parser
import { parseAllFiles } from './parser';

// Import documentation generator
import { generateMarkdownDocs, generateDataDictionary } from './utils/docGenerator';

const { Header, Content } = AntLayout;

function LayoutInner() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [sqlFiles, setSqlFiles] = useState([]);
  const [openFolderPath, setOpenFolderPath] = useState(null);
  const [highlightedFile, setHighlightedFile] = useState(null);

  const { schema, updateSchema, setIsLoading, setParseError, clearSchema } = useSchema();
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

  // Handle file changes - update file type in tree and re-parse schema
  const handleFileChanged = useCallback((data) => {
    // Update the file's type in the file tree
    setSqlFiles(prevFiles => prevFiles.map(file =>
      file.path === data.path
        ? { ...file, fileType: data.fileType }
        : file
    ));

    // Re-parse schema to update diagram
    if (openFolderPath) {
      parseSchema(openFolderPath);
    }
  }, [openFolderPath, parseSchema]);

  // Handle new file added (from file watcher)
  const handleFileAdded = useCallback((data) => {
    // Add new file to the tree
    setSqlFiles(prevFiles => {
      // Check if file already exists
      if (prevFiles.some(f => f.path === data.path)) {
        return prevFiles;
      }
      // Add and sort by relativePath
      const newFiles = [...prevFiles, {
        path: data.path,
        relativePath: data.relativePath || data.path,
        name: data.name || data.path.split('/').pop(),
        fileType: data.fileType || 'other',
      }];
      return newFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    });

    // Re-parse schema
    if (openFolderPath) {
      parseSchema(openFolderPath);
    }
  }, [openFolderPath, parseSchema]);

  // Handle file created (from New File menu)
  const handleFileCreated = useCallback((data) => {
    // Add to file tree if within current folder
    if (!data.outsideFolder) {
      setSqlFiles(prevFiles => {
        const newFiles = [...prevFiles, {
          path: data.path,
          relativePath: data.relativePath,
          name: data.name,
          fileType: data.fileType,
        }];
        return newFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      });
    }

    // Open the file in editor
    openFile(data.path, data.name);
    setHighlightedFile(data.path);
  }, [openFile]);

  // Handle file removed
  const handleFileRemoved = useCallback((data) => {
    // Remove from file tree
    setSqlFiles(prevFiles => prevFiles.filter(f => f.path !== data.path));

    // Re-parse schema
    if (openFolderPath) {
      parseSchema(openFolderPath);
    }
  }, [openFolderPath, parseSchema]);

  const { selectTable } = useSelection();

  // Handle file selection in tree
  const handleFileSelect = useCallback((file) => {
    openFile(file.path, file.name);
    setHighlightedFile(file.path);
    
    // Find and select the table defined in this file
    const table = schema.tables.find(t => t.sourceFile === file.path);
    if (table) {
      selectTable(table.name);
    }
  }, [openFile, selectTable, schema]);

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

  // Handle documentation exports
  const handleExportMarkdownDocs = useCallback(async () => {
    if (!window.electron) return;
    const markdown = generateMarkdownDocs(schema, {
      title: openFolderPath ? openFolderPath.split('/').pop() + ' Schema' : 'Database Schema',
    });
    await window.electron.saveMarkdownDocs(markdown);
  }, [schema, openFolderPath]);

  const handleExportDataDictionary = useCallback(async () => {
    if (!window.electron) return;
    const dictionary = generateDataDictionary(schema);
    await window.electron.saveDataDictionary(dictionary);
  }, [schema]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onFolderOpened(handleFolderOpened);
      window.electron.onFileChanged(handleFileChanged);
      window.electron.onFileAdded(handleFileAdded);
      window.electron.onFileRemoved(handleFileRemoved);
      window.electron.onFileCreated(handleFileCreated);
      window.electron.onExportMarkdownDocs(handleExportMarkdownDocs);
      window.electron.onExportDataDictionary(handleExportDataDictionary);
    }
  }, [handleFolderOpened, handleFileChanged, handleFileAdded, handleFileRemoved, handleFileCreated, handleExportMarkdownDocs, handleExportDataDictionary]);

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
