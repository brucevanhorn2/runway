import React, { useState, useEffect, useCallback } from 'react';
import { Layout as AntLayout, Splitter } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined } from '@ant-design/icons';
import FileTree from './components/FileTree';
import SchemaView from './components/SchemaView';
import SqlTabs from './components/SqlTabs';
import SearchPanel from './components/SearchPanel';
import FindUsagesPanel from './components/FindUsagesPanel';
import SchemaAnalysisPanel from './components/SchemaAnalysisPanel';
import Breadcrumb from './components/Breadcrumb';
import PreferencesDialog from './components/PreferencesDialog';
import './Layout.css';

// Import context providers
import { SchemaProvider, useSchema } from './contexts/SchemaContext';
import { EditorProvider, useEditor } from './contexts/EditorContext';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { ProjectSettingsProvider, useProjectSettings } from './contexts/ProjectSettingsContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';

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
  const [showSearch, setShowSearch] = useState(false);
  const [showFindUsages, setShowFindUsages] = useState(false);
  const [findUsagesTable, setFindUsagesTable] = useState(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

  const { schema, updateSchema, setIsLoading, setParseError, clearSchema } = useSchema();
  const { openFile, saveFile, activeFilePath } = useEditor();
  const { settings, loadSettings, updateSplitterSizes, isLoaded } = useProjectSettings();
  const { selectedTable } = useSelection();

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
    // Load project-specific settings (.runway file)
    loadSettings(data.path);
  }, [clearSchema, parseSchema, loadSettings]);

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

  // Handle search toggle
  const handleToggleSearch = useCallback(() => {
    setShowSearch(prev => !prev);
    setShowFindUsages(false);
    setShowAnalysisPanel(false);
  }, []);

  // Handle find usages
  const handleFindUsages = useCallback(() => {
    if (selectedTable) {
      setFindUsagesTable(selectedTable);
      setShowFindUsages(true);
      setShowSearch(false);
      setShowAnalysisPanel(false);
    }
  }, [selectedTable]);

  // Close search panel
  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
  }, []);

  // Close find usages panel
  const handleCloseFindUsages = useCallback(() => {
    setShowFindUsages(false);
    setFindUsagesTable(null);
  }, []);

  // Handle go to definition - jump to the selected table's source file
  const handleGoToDefinition = useCallback(() => {
    if (selectedTable) {
      const table = schema.tables.find(t => t.name === selectedTable);
      if (table && table.sourceFile) {
        openFile(table.sourceFile, table.sourceFile.split('/').pop());
        setHighlightedFile(table.sourceFile);
      }
    }
  }, [selectedTable, schema, openFile]);

  // Handle go to definition from context menu (with specific table name)
  const handleGoToDefinitionForTable = useCallback((tableName, sourceFile) => {
    if (sourceFile) {
      openFile(sourceFile, sourceFile.split('/').pop());
      setHighlightedFile(sourceFile);
    }
  }, [openFile]);

  // Handle find usages from context menu (with specific table name)
  const handleFindUsagesForTable = useCallback((tableName) => {
    if (tableName) {
      setFindUsagesTable(tableName);
      setShowFindUsages(true);
      setShowSearch(false);
      setShowAnalysisPanel(false);
    }
  }, []);

  // Handle open preferences
  const handleOpenPreferences = useCallback(() => {
    setShowPreferences(true);
  }, []);

  // Handle close preferences
  const handleClosePreferences = useCallback(() => {
    setShowPreferences(false);
  }, []);

  // Handle save file (from menu)
  const handleSaveFile = useCallback(async () => {
    if (activeFilePath) {
      await saveFile(activeFilePath);
    }
  }, [activeFilePath, saveFile]);

  // Handle analyze schema
  const handleAnalyzeSchema = useCallback(() => {
    setShowAnalysisPanel(true);
    setShowSearch(false);
    setShowFindUsages(false);
  }, []);

  // Handle close analysis panel
  const handleCloseAnalysisPanel = useCallback(() => {
    setShowAnalysisPanel(false);
  }, []);

  // Handle navigate to table from analysis panel
  const handleNavigateToTableFromAnalysis = useCallback((tableName, sourceFile) => {
    if (tableName) {
      selectTable(tableName);
    }
    if (sourceFile) {
      setHighlightedFile(sourceFile);
      const file = sqlFiles.find(f => f.path === sourceFile);
      if (file) {
        openFile(file.path, file.name);
      }
    }
  }, [selectTable, sqlFiles, openFile]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onFolderOpened(handleFolderOpened);
      window.electron.onFileChanged(handleFileChanged);
      window.electron.onFileAdded(handleFileAdded);
      window.electron.onFileRemoved(handleFileRemoved);
      window.electron.onFileCreated(handleFileCreated);
      window.electron.onExportMarkdownDocs(handleExportMarkdownDocs);
      window.electron.onExportDataDictionary(handleExportDataDictionary);
      window.electron.onToggleSearch(handleToggleSearch);
      window.electron.onFindUsages(handleFindUsages);
      window.electron.onGoToDefinition(handleGoToDefinition);
      window.electron.onOpenPreferences(handleOpenPreferences);
      window.electron.onAnalyzeSchema(handleAnalyzeSchema);
      window.electron.onSaveFile(handleSaveFile);
    }
  }, [handleFolderOpened, handleFileChanged, handleFileAdded, handleFileRemoved, handleFileCreated, handleExportMarkdownDocs, handleExportDataDictionary, handleToggleSearch, handleFindUsages, handleGoToDefinition, handleOpenPreferences, handleAnalyzeSchema, handleSaveFile]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {openFolderPath ? openFolderPath : 'No folder open'}
          </div>
          {openFolderPath && (
            <button
              onClick={handleToggleSearch}
              style={{
                background: showSearch ? '#0e639c' : 'transparent',
                border: '1px solid #555',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#ccc',
                fontSize: '12px',
              }}
              title="Search in Files (Cmd+Shift+F)"
            >
              <SearchOutlined />
              Search
            </button>
          )}
        </div>
      </Header>

      <Content style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Breadcrumb Navigation */}
        <Breadcrumb folderPath={openFolderPath} sqlFiles={sqlFiles} />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {/* Search Panel - slides in from left */}
          {showSearch && (
            <div style={{ width: '350px', borderRight: '1px solid #333', flexShrink: 0 }}>
              <SearchPanel
                files={sqlFiles}
                folderPath={openFolderPath}
                onClose={handleCloseSearch}
              />
            </div>
          )}

          {/* Find Usages Panel - slides in from left */}
          {showFindUsages && findUsagesTable && (
            <div style={{ width: '350px', borderRight: '1px solid #333', flexShrink: 0 }}>
              <FindUsagesPanel
                tableName={findUsagesTable}
                folderPath={openFolderPath}
                onClose={handleCloseFindUsages}
              />
            </div>
          )}

          {/* Schema Analysis Panel - slides in from left */}
          {showAnalysisPanel && (
            <div style={{ width: '400px', borderRight: '1px solid #333', flexShrink: 0 }}>
              <SchemaAnalysisPanel
                schema={schema}
                onClose={handleCloseAnalysisPanel}
                onNavigateToTable={handleNavigateToTableFromAnalysis}
              />
            </div>
          )}

          <Splitter
            style={{ height: '100%', flex: 1 }}
            onResizeEnd={(sizes) => {
              // Save left pane size when resize ends
              if (sizes[0] !== undefined) {
                updateSplitterSizes(sizes[0] + 'px', null);
              }
            }}
          >
            {/* Left Pane - File Browser */}
            <Splitter.Pane
              size={leftCollapsed ? 0 : (isLoaded ? settings.splitter.leftPaneSize : '20%')}
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
            style={{
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Splitter
              layout="vertical"
              style={{ height: '100%' }}
              onResizeEnd={(sizes) => {
                // Save diagram pane size when resize ends
                if (sizes[0] !== undefined) {
                  updateSplitterSizes(null, sizes[0] + 'px');
                }
              }}
            >
              {/* Top - Schema Diagram */}
              <Splitter.Pane
                size={isLoaded ? settings.splitter.diagramPaneSize : '60%'}
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
                  <SchemaView
                    onTableSelect={handleTableSelect}
                    onGoToDefinition={handleGoToDefinitionForTable}
                    onFindUsages={handleFindUsagesForTable}
                    projectRoot={openFolderPath}
                  />
                </div>
              </Splitter.Pane>

              {/* Bottom - SQL Editor Tabs */}
              <Splitter.Pane
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
        </div>
      </Content>

      {/* Preferences Dialog */}
      <PreferencesDialog
        open={showPreferences}
        onClose={handleClosePreferences}
      />
    </AntLayout>
  );
}

function Layout() {
  return (
    <UserPreferencesProvider>
      <ProjectSettingsProvider>
        <SchemaProvider>
          <EditorProvider>
            <SelectionProvider>
              <LayoutInner />
            </SelectionProvider>
          </EditorProvider>
        </SchemaProvider>
      </ProjectSettingsProvider>
    </UserPreferencesProvider>
  );
}

export default Layout;
