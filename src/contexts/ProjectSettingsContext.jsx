import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ProjectSettingsContext = createContext(null);

// Default settings structure
const DEFAULT_SETTINGS = {
  splitter: {
    leftPaneSize: '20%',
    diagramPaneSize: '60%',
  },
  nodePositions: {},  // { nodeId: { x, y } }
};

// Debounce helper to avoid saving too frequently
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function ProjectSettingsProvider({ children }) {
  const [folderPath, setFolderPath] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Save settings to disk (debounced)
  const saveSettingsToDisk = useCallback(async (path, settingsToSave) => {
    if (!path || !window.electron) return;

    try {
      await window.electron.saveProjectSettings(path, settingsToSave);
      console.log('[ProjectSettings] Saved to .runway');
    } catch (error) {
      console.error('[ProjectSettings] Failed to save:', error);
    }
  }, []);

  // Create debounced save function using ref to avoid exhaustive-deps warning
  const debouncedSaveRef = useRef(null);
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce((path, settingsToSave) => {
      saveSettingsToDisk(path, settingsToSave);
    }, 500);
  }
  const debouncedSave = debouncedSaveRef.current;

  // Load settings when folder changes
  const loadSettings = useCallback(async (newFolderPath) => {
    if (!window.electron) return;

    setFolderPath(newFolderPath);
    setIsLoaded(false);

    try {
      const result = await window.electron.loadProjectSettings(newFolderPath);
      if (result.success && result.settings) {
        // Merge with defaults to ensure all keys exist
        const loadedSettings = {
          ...DEFAULT_SETTINGS,
          ...result.settings,
          splitter: {
            ...DEFAULT_SETTINGS.splitter,
            ...(result.settings.splitter || {}),
          },
        };
        setSettings(loadedSettings);
        console.log('[ProjectSettings] Loaded from .runway');
      } else {
        // No settings file, use defaults
        setSettings(DEFAULT_SETTINGS);
        console.log('[ProjectSettings] Using defaults (no .runway file)');
      }
    } catch (error) {
      console.error('[ProjectSettings] Failed to load:', error);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Update a specific setting and save
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      // Schedule save
      if (folderPath) {
        debouncedSave(folderPath, newSettings);
      }
      return newSettings;
    });
  }, [folderPath, debouncedSave]);

  // Update splitter settings
  const updateSplitterSizes = useCallback((leftPaneSize, diagramPaneSize) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        splitter: {
          leftPaneSize: leftPaneSize ?? prev.splitter.leftPaneSize,
          diagramPaneSize: diagramPaneSize ?? prev.splitter.diagramPaneSize,
        },
      };
      if (folderPath) {
        debouncedSave(folderPath, newSettings);
      }
      return newSettings;
    });
  }, [folderPath, debouncedSave]);

  // Update node positions
  const updateNodePositions = useCallback((positions) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        nodePositions: positions,
      };
      if (folderPath) {
        debouncedSave(folderPath, newSettings);
      }
      return newSettings;
    });
  }, [folderPath, debouncedSave]);

  // Update a single node position
  const updateNodePosition = useCallback((nodeId, position) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        nodePositions: {
          ...prev.nodePositions,
          [nodeId]: position,
        },
      };
      if (folderPath) {
        debouncedSave(folderPath, newSettings);
      }
      return newSettings;
    });
  }, [folderPath, debouncedSave]);

  // Clear settings (when folder is closed)
  const clearSettings = useCallback(() => {
    setFolderPath(null);
    setSettings(DEFAULT_SETTINGS);
    setIsLoaded(false);
  }, []);

  const value = {
    folderPath,
    settings,
    isLoaded,
    loadSettings,
    updateSetting,
    updateSplitterSizes,
    updateNodePositions,
    updateNodePosition,
    clearSettings,
  };

  return (
    <ProjectSettingsContext.Provider value={value}>
      {children}
    </ProjectSettingsContext.Provider>
  );
}

export function useProjectSettings() {
  const context = useContext(ProjectSettingsContext);
  if (!context) {
    throw new Error('useProjectSettings must be used within ProjectSettingsProvider');
  }
  return context;
}
