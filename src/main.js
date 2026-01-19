const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let fileWatcher = null;

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
          type: 'separator',
        },
        {
          label: 'Export as SVG',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('export-svg');
          },
        },
        {
          label: 'Export as PlantUML',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('export-plantuml');
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
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

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

    // Scan for SQL files
    const files = await scanSqlFiles(folderPath);

    // Send folder data to renderer
    mainWindow.webContents.send('folder-opened', {
      path: folderPath,
      files: files,
    });

    // Set up file watcher for .sql files
    fileWatcher = chokidar.watch(path.join(folderPath, '**/*.sql'), {
      persistent: true,
      ignoreInitial: true,
    });

    fileWatcher.on('add', (filePath) => {
      mainWindow.webContents.send('file-added', { path: filePath });
    });

    fileWatcher.on('change', (filePath) => {
      mainWindow.webContents.send('file-changed', { path: filePath });
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
 * Recursively scan directory for SQL files
 */
async function scanSqlFiles(dirPath, basePath = dirPath) {
  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await scanSqlFiles(fullPath, basePath);
        files.push(...subFiles);
      }
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push({
        name: entry.name,
        path: fullPath,
        relativePath: relativePath,
      });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
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

  // Read all SQL files in folder
  ipcMain.handle('folder:read-all', async (event, folderPath) => {
    try {
      const files = await scanSqlFiles(folderPath);
      const fileContents = [];

      for (const file of files) {
        const content = await fs.readFile(file.path, 'utf-8');
        fileContents.push({
          ...file,
          content,
        });
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

  console.log('[Main] IPC handlers registered');
};

app.on('ready', () => {
  setupIPC();
  createWindow();
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
