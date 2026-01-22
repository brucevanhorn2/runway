const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');

const isDev = process.env.NODE_ENV === 'development';

// Set app name for macOS menu bar (fixes "Electron" showing in dev mode)
app.name = 'Runway';

let mainWindow;
let fileWatcher = null;
let currentFolderPath = null;

// ============================================================================
// SETTINGS MANAGEMENT
// ============================================================================

const MAX_RECENT_FOLDERS = 10;
let settings = {
  lastOpenedFolder: null,
  recentFolders: [],
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (fsSync.existsSync(settingsPath)) {
      const data = fsSync.readFileSync(settingsPath, 'utf-8');
      settings = { ...settings, ...JSON.parse(data) };
      console.log('[Main] Settings loaded:', settingsPath);
    }
  } catch (error) {
    console.error('[Main] Failed to load settings:', error);
  }
}

async function saveSettings() {
  try {
    const settingsPath = getSettingsPath();
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[Main] Settings saved');
  } catch (error) {
    console.error('[Main] Failed to save settings:', error);
  }
}

function addRecentFolder(folderPath) {
  // Remove if already exists
  settings.recentFolders = settings.recentFolders.filter(f => f !== folderPath);
  // Add to front
  settings.recentFolders.unshift(folderPath);
  // Limit size
  settings.recentFolders = settings.recentFolders.slice(0, MAX_RECENT_FOLDERS);
  // Update last opened
  settings.lastOpenedFolder = folderPath;
  // Save and rebuild menu
  saveSettings();
  createMenu();
  // Update menu item states after rebuilding
  updateMenuState();
}

// ============================================================================
// USER PREFERENCES MANAGEMENT
// ============================================================================

let userPreferences = null;

function getUserPreferencesPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadUserPreferences() {
  try {
    const prefsPath = getUserPreferencesPath();
    if (fsSync.existsSync(prefsPath)) {
      const data = fsSync.readFileSync(prefsPath, 'utf-8');
      userPreferences = JSON.parse(data);
      console.log('[Main] User preferences loaded');
      return userPreferences;
    }
  } catch (error) {
    console.error('[Main] Failed to load user preferences:', error);
  }
  return null;
}

async function saveUserPreferences(prefs) {
  try {
    userPreferences = prefs;
    const prefsPath = getUserPreferencesPath();
    await fs.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8');
    console.log('[Main] User preferences saved');
  } catch (error) {
    console.error('[Main] Failed to save user preferences:', error);
    throw error;
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Runway',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = isDev
    ? 'http://localhost:2112'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (fileWatcher) {
      fileWatcher.close();
      fileWatcher = null;
    }
  });

  createMenu();
};

const createMenu = () => {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // macOS app menu (will be replaced with "Runway" or "Electron" on macOS)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-preferences');
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New SQL Project',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: async () => {
            await createNewProject();
          },
        },
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              const folderPath = result.filePaths[0];
              await openFolder(folderPath);
            }
          },
        },
        {
          label: 'Recent Folders',
          submenu: settings.recentFolders.length > 0
            ? [
                ...settings.recentFolders.map((folderPath, index) => ({
                  label: `${index + 1}. ${folderPath.split(/[/\\]/).pop()}`,
                  sublabel: folderPath,
                  click: async () => {
                    await openFolder(folderPath);
                  },
                })),
                { type: 'separator' },
                {
                  label: 'Clear Recent Folders',
                  click: async () => {
                    settings.recentFolders = [];
                    await saveSettings();
                    createMenu();
                  },
                },
              ]
            : [{ label: 'No Recent Folders', enabled: false }],
        },
        {
          type: 'separator',
        },
        {
          id: 'new-sql-file',
          label: 'New SQL File',
          accelerator: 'CmdOrCtrl+N',
          enabled: false,
          click: async () => {
            await createNewFile();
          },
        },
        {
          id: 'save-file',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('save-file');
          },
        },
        {
          type: 'separator',
        },
        {
          id: 'export-svg',
          label: 'Export as SVG',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('export-svg');
          },
        },
        {
          id: 'export-plantuml',
          label: 'Export as PlantUML',
          accelerator: 'CmdOrCtrl+Shift+P',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('export-plantuml');
          },
        },
        {
          type: 'separator',
        },
        {
          id: 'export-markdown-docs',
          label: 'Export Documentation (Markdown)',
          accelerator: 'CmdOrCtrl+Shift+D',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('export-markdown-docs');
          },
        },
        {
          id: 'export-data-dictionary',
          label: 'Export Data Dictionary',
          accelerator: 'CmdOrCtrl+Shift+R',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('export-data-dictionary');
          },
        },
        ...(!isMac ? [
          {
            type: 'separator',
          },
          {
            label: 'Exit',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              app.quit();
            },
          },
        ] : []),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        // On non-Mac, add Preferences here
        ...(!isMac ? [
          { type: 'separator' },
          {
            label: 'Preferences...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              mainWindow.webContents.send('open-preferences');
            },
          },
        ] : []),
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Fit Diagram',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow.webContents.send('fit-diagram');
          },
        },
        {
          id: 'schema-analysis',
          label: 'Analyze Schema',
          accelerator: 'CmdOrCtrl+Shift+A',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('analyze-schema');
          },
        },
        { type: 'separator' },
        {
          id: 'search-files',
          label: 'Search in Files',
          accelerator: 'CmdOrCtrl+Shift+F',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('toggle-search');
          },
        },
        {
          id: 'find-usages',
          label: 'Find Usages',
          accelerator: 'Alt+F7',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('find-usages');
          },
        },
        {
          id: 'go-to-definition',
          label: 'Go to Definition',
          accelerator: 'CmdOrCtrl+G',
          enabled: false,
          click: () => {
            mainWindow.webContents.send('go-to-definition');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

/**
 * Update menu item enabled states based on whether a folder is open
 */
function updateMenuState() {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  const hasFolderOpen = currentFolderPath !== null;

  const newFileItem = menu.getMenuItemById('new-sql-file');
  const saveFileItem = menu.getMenuItemById('save-file');
  const exportSvgItem = menu.getMenuItemById('export-svg');
  const exportPlantumlItem = menu.getMenuItemById('export-plantuml');
  const exportMarkdownDocsItem = menu.getMenuItemById('export-markdown-docs');
  const exportDataDictItem = menu.getMenuItemById('export-data-dictionary');
  const searchFilesItem = menu.getMenuItemById('search-files');
  const findUsagesItem = menu.getMenuItemById('find-usages');
  const goToDefItem = menu.getMenuItemById('go-to-definition');
  const schemaAnalysisItem = menu.getMenuItemById('schema-analysis');

  if (newFileItem) newFileItem.enabled = hasFolderOpen;
  if (saveFileItem) saveFileItem.enabled = hasFolderOpen;
  if (exportSvgItem) exportSvgItem.enabled = hasFolderOpen;
  if (exportPlantumlItem) exportPlantumlItem.enabled = hasFolderOpen;
  if (exportMarkdownDocsItem) exportMarkdownDocsItem.enabled = hasFolderOpen;
  if (exportDataDictItem) exportDataDictItem.enabled = hasFolderOpen;
  if (searchFilesItem) searchFilesItem.enabled = hasFolderOpen;
  if (findUsagesItem) findUsagesItem.enabled = hasFolderOpen;
  if (goToDefItem) goToDefItem.enabled = hasFolderOpen;
  if (schemaAnalysisItem) schemaAnalysisItem.enabled = hasFolderOpen;
}

/**
 * Create a new SQL project (folder)
 */
async function createNewProject() {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Create New SQL Project',
      buttonLabel: 'Create Project',
      properties: ['createDirectory'],
      nameFieldLabel: 'Project Name',
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    const projectPath = result.filePath;

    // Create the directory
    await fs.mkdir(projectPath, { recursive: true });

    // Open the new folder
    await openFolder(projectPath);

    console.log('[Main] New project created:', projectPath);
  } catch (error) {
    console.error('[Main] Error creating project:', error);
    dialog.showErrorBox('Error', `Failed to create project: ${error.message}`);
  }
}

/**
 * Open a folder and scan for SQL files
 */
async function openFolder(folderPath) {
  try {
    // Stop existing watcher
    if (fileWatcher) {
      fileWatcher.close();
      fileWatcher = null;
    }

    // Scan for project files (SQL and Markdown) and determine their types
    const allFiles = await scanProjectFiles(folderPath);
    const files = [];
    for (const file of allFiles) {
      const content = await fs.readFile(file.path, 'utf-8');
      files.push({
        ...file,
        fileType: getFileType(content, file.path),
      });
    }

    // Track the current folder
    currentFolderPath = folderPath;

    // Update menu state (enable New SQL File, exports, etc.)
    updateMenuState();

    // Add to recent folders
    addRecentFolder(folderPath);

    // Send folder data to renderer (all files with their types)
    mainWindow.webContents.send('folder-opened', {
      path: folderPath,
      files: files,
    });

    // Set up file watcher for .sql and .md files
    fileWatcher = chokidar.watch([
      path.join(folderPath, '**/*.sql'),
      path.join(folderPath, '**/*.md'),
    ], {
      persistent: true,
      ignoreInitial: true,
    });

    fileWatcher.on('add', async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(folderPath, filePath);
        mainWindow.webContents.send('file-added', {
          path: filePath,
          relativePath: relativePath,
          name: path.basename(filePath),
          fileType: getFileType(content, filePath),
        });
      } catch (error) {
        console.error('[Main] Error reading added file:', error);
      }
    });

    fileWatcher.on('change', async (filePath) => {
      // Read the file and determine its new type
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(folderPath, filePath);
        mainWindow.webContents.send('file-changed', {
          path: filePath,
          relativePath: relativePath,
          name: path.basename(filePath),
          fileType: getFileType(content, filePath),
        });
      } catch (error) {
        console.error('[Main] Error reading changed file:', error);
      }
    });

    fileWatcher.on('unlink', (filePath) => {
      mainWindow.webContents.send('file-removed', { path: filePath });
    });

    console.log('[Main] Folder opened:', folderPath);
  } catch (error) {
    console.error('[Main] Error opening folder:', error);
    dialog.showErrorBox('Error', `Failed to open folder: ${error.message}`);
  }
}

/**
 * Create a new SQL file
 */
async function createNewFile() {
  try {
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Create New SQL File',
      defaultPath: currentFolderPath
        ? path.join(currentFolderPath, 'new_table.sql')
        : 'new_table.sql',
      filters: [{ name: 'SQL Files', extensions: ['sql'] }],
    });

    if (result.canceled || !result.filePath) {
      return;
    }

    const filePath = result.filePath;

    // Create empty file with a helpful comment
    const initialContent = '-- New SQL file\n-- Add your CREATE TABLE or CREATE TYPE statement here\n\n';
    await fs.writeFile(filePath, initialContent, 'utf-8');

    // If the file is within the current folder, add it to the file tree
    if (currentFolderPath && filePath.startsWith(currentFolderPath)) {
      const relativePath = path.relative(currentFolderPath, filePath);
      const fileType = getFileType(initialContent, filePath);

      mainWindow.webContents.send('file-created', {
        path: filePath,
        relativePath: relativePath,
        name: path.basename(filePath),
        fileType: fileType,
      });
    } else {
      // File created outside current folder - just notify to open it
      mainWindow.webContents.send('file-created', {
        path: filePath,
        relativePath: path.basename(filePath),
        name: path.basename(filePath),
        fileType: 'other',
        outsideFolder: true,
      });
    }

    console.log('[Main] New file created:', filePath);
  } catch (error) {
    console.error('[Main] Error creating file:', error);
    dialog.showErrorBox('Error', `Failed to create file: ${error.message}`);
  }
}

/**
 * Recursively scan directory for project files (SQL and Markdown)
 */
async function scanProjectFiles(dirPath, basePath = dirPath) {
  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await scanProjectFiles(fullPath, basePath);
        files.push(...subFiles);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.sql') || entry.name.endsWith('.md'))) {
      files.push({
        name: entry.name,
        path: fullPath,
        relativePath: relativePath,
      });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

// Keep for backwards compatibility with folder:read-all
async function scanSqlFiles(dirPath, basePath = dirPath) {
  const files = await scanProjectFiles(dirPath, basePath);
  return files.filter(f => f.name.endsWith('.sql'));
}

/**
 * Check if SQL content contains diagram-relevant DDL (CREATE TABLE or CREATE TYPE ENUM)
 * Excludes files that only contain database setup (CREATE DATABASE, GRANT, etc.)
 */
function containsDiagramDDL(content) {
  const fileType = getFileType(content);
  return fileType === 'table' || fileType === 'enum';
}

/**
 * Determine the type of file content
 * Returns: 'table', 'enum', 'markdown', or 'other'
 */
function getFileType(content, filePath = '') {
  // Check for markdown files by extension
  if (filePath && filePath.endsWith('.md')) {
    return 'markdown';
  }

  // Remove comments to avoid false positives
  const cleanContent = content
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Check for CREATE TABLE (prioritize table over enum if both present)
  if (/CREATE\s+TABLE\s+/i.test(cleanContent)) {
    return 'table';
  }

  // Check for CREATE TYPE ... AS ENUM
  if (/CREATE\s+TYPE\s+[\w."]+\s+AS\s+ENUM/i.test(cleanContent)) {
    return 'enum';
  }

  return 'other';
}

/**
 * Setup IPC handlers
 */
const setupIPC = () => {
  // Read file contents
  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('[Main] Failed to read file:', error);
      return { success: false, error: error.message };
    }
  });

  // Save file contents
  ipcMain.handle('file:save', async (event, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to save file:', error);
      return { success: false, error: error.message };
    }
  });

  // Reveal file/folder in Finder/Explorer
  ipcMain.handle('file:reveal-in-finder', async (event, filePath) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to reveal in finder:', error);
      return { success: false, error: error.message };
    }
  });

  // Rename file or folder
  ipcMain.handle('file:rename', async (event, oldPath, newName) => {
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);

      // Check if new path already exists
      const exists = await fs.access(newPath).then(() => true).catch(() => false);
      if (exists) {
        return { success: false, error: 'A file or folder with that name already exists' };
      }

      await fs.rename(oldPath, newPath);
      return { success: true, newPath };
    } catch (error) {
      console.error('[Main] Failed to rename:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete file or folder
  ipcMain.handle('file:delete', async (event, filePath) => {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rm(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to delete:', error);
      return { success: false, error: error.message };
    }
  });

  // Create new file in a specific folder
  ipcMain.handle('file:create-in-folder', async (event, folderPath, fileName) => {
    try {
      const filePath = path.join(folderPath, fileName);

      // Check if file already exists
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      if (exists) {
        return { success: false, error: 'A file with that name already exists' };
      }

      // Create the file with initial content
      const initialContent = '-- New SQL file\n-- Add your CREATE TABLE or CREATE TYPE statement here\n\n';
      await fs.writeFile(filePath, initialContent, 'utf-8');

      // The file watcher will pick up the new file automatically
      return { success: true, path: filePath };
    } catch (error) {
      console.error('[Main] Failed to create file:', error);
      return { success: false, error: error.message };
    }
  });

  // Read all SQL files in folder (filtered to only diagram-relevant DDL)
  ipcMain.handle('folder:read-all', async (event, folderPath) => {
    try {
      const files = await scanSqlFiles(folderPath);
      const fileContents = [];

      for (const file of files) {
        const content = await fs.readFile(file.path, 'utf-8');
        // Only include files that contain CREATE TABLE or CREATE TYPE ENUM
        if (containsDiagramDDL(content)) {
          fileContents.push({
            ...file,
            content,
          });
        }
      }

      return { success: true, files: fileContents };
    } catch (error) {
      console.error('[Main] Failed to read folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Save SVG export
  ipcMain.handle('export:save-svg', async (event, svgContent) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export as SVG',
        defaultPath: 'schema.svg',
        filters: [{ name: 'SVG Files', extensions: ['svg'] }],
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, svgContent, 'utf-8');
        return { success: true, path: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('[Main] Failed to export SVG:', error);
      return { success: false, error: error.message };
    }
  });

  // Save PlantUML export
  ipcMain.handle('export:save-plantuml', async (event, plantumlContent) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export as PlantUML',
        defaultPath: 'schema.puml',
        filters: [{ name: 'PlantUML Files', extensions: ['puml', 'plantuml'] }],
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, plantumlContent, 'utf-8');
        return { success: true, path: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('[Main] Failed to export PlantUML:', error);
      return { success: false, error: error.message };
    }
  });

  // Save Markdown Documentation export
  ipcMain.handle('export:save-markdown-docs', async (event, markdownContent) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Documentation',
        defaultPath: 'SCHEMA.md',
        filters: [{ name: 'Markdown Files', extensions: ['md'] }],
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, markdownContent, 'utf-8');
        return { success: true, path: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('[Main] Failed to export Markdown docs:', error);
      return { success: false, error: error.message };
    }
  });

  // Save Data Dictionary export
  ipcMain.handle('export:save-data-dictionary', async (event, dictContent) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Data Dictionary',
        defaultPath: 'DATA_DICTIONARY.md',
        filters: [{ name: 'Markdown Files', extensions: ['md'] }],
      });

      if (!result.canceled && result.filePath) {
        await fs.writeFile(result.filePath, dictContent, 'utf-8');
        return { success: true, path: result.filePath };
      }
      return { success: false, canceled: true };
    } catch (error) {
      console.error('[Main] Failed to export Data Dictionary:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // PROJECT SETTINGS (.runway file)
  // ============================================================================

  // Load project settings from .runway file in folder
  ipcMain.handle('project:load-settings', async (event, folderPath) => {
    try {
      const settingsPath = path.join(folderPath, '.runway');
      const exists = await fs.access(settingsPath).then(() => true).catch(() => false);

      if (!exists) {
        return { success: true, settings: null };
      }

      const content = await fs.readFile(settingsPath, 'utf-8');
      const projectSettings = JSON.parse(content);
      return { success: true, settings: projectSettings };
    } catch (error) {
      console.error('[Main] Error loading project settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Save project settings to .runway file in folder
  ipcMain.handle('project:save-settings', async (event, folderPath, projectSettings) => {
    try {
      const settingsPath = path.join(folderPath, '.runway');
      await fs.writeFile(settingsPath, JSON.stringify(projectSettings, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('[Main] Error saving project settings:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // SEARCH
  // ============================================================================

  // Search across all files in folder
  ipcMain.handle('search:files', async (event, folderPath, query) => {
    try {
      if (!query || query.trim().length === 0) {
        return { success: true, matches: [] };
      }

      const files = await scanProjectFiles(folderPath);
      const matches = [];
      const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

      for (const file of files) {
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const lines = content.split('\n');
          const fileMatches = [];

          lines.forEach((line, index) => {
            if (searchRegex.test(line)) {
              fileMatches.push({
                lineNumber: index + 1,
                lineContent: line.substring(0, 200), // Limit line length
              });
              // Reset regex lastIndex for next test
              searchRegex.lastIndex = 0;
            }
          });

          if (fileMatches.length > 0) {
            matches.push({
              filePath: file.path,
              fileName: file.name,
              relativePath: file.relativePath,
              matches: fileMatches,
            });
          }
        } catch (fileError) {
          console.error(`[Main] Error reading file for search: ${file.path}`, fileError);
        }
      }

      return { success: true, matches };
    } catch (error) {
      console.error('[Main] Search error:', error);
      return { success: false, error: error.message };
    }
  });

  // Find usages - which tables reference a given table
  ipcMain.handle('search:find-usages', async (event, folderPath, tableName) => {
    try {
      const files = await scanSqlFiles(folderPath);
      const usages = [];
      const referencePattern = new RegExp(`REFERENCES\\s+["']?${tableName}["']?`, 'gi');

      for (const file of files) {
        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const lines = content.split('\n');
          const fileUsages = [];

          lines.forEach((line, index) => {
            if (referencePattern.test(line)) {
              fileUsages.push({
                lineNumber: index + 1,
                lineContent: line.trim().substring(0, 200),
              });
              referencePattern.lastIndex = 0;
            }
          });

          if (fileUsages.length > 0) {
            usages.push({
              filePath: file.path,
              fileName: file.name,
              relativePath: file.relativePath,
              matches: fileUsages,
            });
          }
        } catch (fileError) {
          console.error(`[Main] Error reading file for usages: ${file.path}`, fileError);
        }
      }

      return { success: true, usages };
    } catch (error) {
      console.error('[Main] Find usages error:', error);
      return { success: false, error: error.message };
    }
  });

  // User preferences
  ipcMain.handle('preferences:load', async () => {
    return loadUserPreferences();
  });

  ipcMain.handle('preferences:save', async (event, prefs) => {
    await saveUserPreferences(prefs);
    return { success: true };
  });

  // ============================================================================
  // SPELL CHECKING
  // ============================================================================

  // Load dictionary file (aff or dic)
  ipcMain.handle('spellcheck:load-dictionary', async (event, filename) => {
    try {
      // Try multiple paths to find the dictionary
      const possiblePaths = [
        // In development: node_modules
        path.join(__dirname, '..', 'node_modules', 'typo-js', 'dictionaries', 'en_US', filename),
        // In production: resources
        path.join(process.resourcesPath, 'dictionaries', 'en_US', filename),
        // Alternative production path
        path.join(__dirname, 'dictionaries', 'en_US', filename),
      ];

      for (const dictPath of possiblePaths) {
        try {
          const content = await fs.readFile(dictPath, 'utf-8');
          console.log(`[Main] Loaded dictionary file: ${dictPath}`);
          return { success: true, content };
        } catch (_e) {
          // Try next path
        }
      }

      throw new Error(`Dictionary file not found: ${filename}`);
    } catch (error) {
      console.error('[Main] Failed to load dictionary:', error);
      return { success: false, error: error.message };
    }
  });

  // Load custom dictionary (user-added words)
  ipcMain.handle('spellcheck:load-custom', async () => {
    try {
      const customDictPath = path.join(app.getPath('userData'), 'custom-dictionary.json');
      const exists = await fs.access(customDictPath).then(() => true).catch(() => false);

      if (!exists) {
        return { words: [] };
      }

      const content = await fs.readFile(customDictPath, 'utf-8');
      const data = JSON.parse(content);
      return { words: data.words || [] };
    } catch (error) {
      console.error('[Main] Failed to load custom dictionary:', error);
      return { words: [] };
    }
  });

  // Save custom dictionary
  ipcMain.handle('spellcheck:save-custom', async (event, words) => {
    try {
      const customDictPath = path.join(app.getPath('userData'), 'custom-dictionary.json');
      await fs.writeFile(customDictPath, JSON.stringify({ words }, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to save custom dictionary:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[Main] IPC handlers registered');
};

app.on('ready', () => {
  // Load settings before creating window (so menu has recent folders)
  loadSettings();
  setupIPC();
  createWindow();

  // Auto-open last folder once window is ready
  mainWindow.webContents.on('did-finish-load', async () => {
    if (settings.lastOpenedFolder) {
      try {
        // Verify the folder still exists
        await fs.access(settings.lastOpenedFolder);
        await openFolder(settings.lastOpenedFolder);
        console.log('[Main] Auto-opened last folder:', settings.lastOpenedFolder);
      } catch (_error) {
        console.log('[Main] Last folder no longer exists:', settings.lastOpenedFolder);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
