const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder-opened', (event, data) => {
      callback(data);
    });
  },

  onFileAdded: (callback) => {
    ipcRenderer.on('file-added', (event, data) => {
      callback(data);
    });
  },

  onFileChanged: (callback) => {
    ipcRenderer.on('file-changed', (event, data) => {
      callback(data);
    });
  },

  onFileRemoved: (callback) => {
    ipcRenderer.on('file-removed', (event, data) => {
      callback(data);
    });
  },

  onFileCreated: (callback) => {
    ipcRenderer.on('file-created', (event, data) => {
      callback(data);
    });
  },

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),

  onSaveFile: (callback) => {
    ipcRenderer.on('save-file', callback);
  },

  readAllFiles: (folderPath) => ipcRenderer.invoke('folder:read-all', folderPath),

  // ============================================================================
  // EXPORT OPERATIONS
  // ============================================================================
  onExportSvg: (callback) => {
    ipcRenderer.on('export-svg', callback);
  },

  onExportPlantuml: (callback) => {
    ipcRenderer.on('export-plantuml', callback);
  },

  onExportMarkdownDocs: (callback) => {
    ipcRenderer.on('export-markdown-docs', callback);
  },

  onExportDataDictionary: (callback) => {
    ipcRenderer.on('export-data-dictionary', callback);
  },

  saveSvg: (svgContent) => ipcRenderer.invoke('export:save-svg', svgContent),

  savePlantuml: (plantumlContent) => ipcRenderer.invoke('export:save-plantuml', plantumlContent),

  saveMarkdownDocs: (markdownContent) => ipcRenderer.invoke('export:save-markdown-docs', markdownContent),

  saveDataDictionary: (dictContent) => ipcRenderer.invoke('export:save-data-dictionary', dictContent),

  // ============================================================================
  // VIEW OPERATIONS
  // ============================================================================
  onFitDiagram: (callback) => {
    ipcRenderer.on('fit-diagram', callback);
  },

  // ============================================================================
  // PROJECT SETTINGS (.runway file)
  // ============================================================================
  loadProjectSettings: (folderPath) => ipcRenderer.invoke('project:load-settings', folderPath),

  saveProjectSettings: (folderPath, settings) => ipcRenderer.invoke('project:save-settings', folderPath, settings),

  // ============================================================================
  // SEARCH
  // ============================================================================
  searchFiles: (folderPath, query) => ipcRenderer.invoke('search:files', folderPath, query),

  findUsages: (folderPath, tableName) => ipcRenderer.invoke('search:find-usages', folderPath, tableName),

  onToggleSearch: (callback) => {
    ipcRenderer.on('toggle-search', callback);
  },

  onFindUsages: (callback) => {
    ipcRenderer.on('find-usages', callback);
  },

  onGoToDefinition: (callback) => {
    ipcRenderer.on('go-to-definition', callback);
  },

  onAnalyzeSchema: (callback) => {
    ipcRenderer.on('analyze-schema', callback);
  },

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================
  loadUserPreferences: () => ipcRenderer.invoke('preferences:load'),

  saveUserPreferences: (prefs) => ipcRenderer.invoke('preferences:save', prefs),

  onOpenPreferences: (callback) => {
    ipcRenderer.on('open-preferences', callback);
  },
});
