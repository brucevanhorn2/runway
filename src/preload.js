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

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),

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

  saveSvg: (svgContent) => ipcRenderer.invoke('export:save-svg', svgContent),

  savePlantuml: (plantumlContent) => ipcRenderer.invoke('export:save-plantuml', plantumlContent),

  // ============================================================================
  // VIEW OPERATIONS
  // ============================================================================
  onFitDiagram: (callback) => {
    ipcRenderer.on('fit-diagram', callback);
  },
});
