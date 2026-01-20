import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UserPreferencesContext = createContext(null);

// Default user preferences
const DEFAULT_PREFERENCES = {
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'on',
    showMinimap: true,
    formatOnSave: false,
  },
  diagram: {
    defaultLayout: 'LR',
    showMinimap: true,
    showEdgeLabels: true,
    animateEdges: false,
  },
  general: {
    confirmBeforeClose: true,
    autoOpenLastFolder: true,
  },
};

export function UserPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (window.electron?.loadUserPreferences) {
        try {
          const saved = await window.electron.loadUserPreferences();
          if (saved) {
            // Deep merge with defaults to handle new preference keys
            const merged = {
              editor: { ...DEFAULT_PREFERENCES.editor, ...saved.editor },
              diagram: { ...DEFAULT_PREFERENCES.diagram, ...saved.diagram },
              general: { ...DEFAULT_PREFERENCES.general, ...saved.general },
            };
            setPreferences(merged);
            console.log('[UserPreferences] Loaded preferences');
          }
        } catch (err) {
          console.error('[UserPreferences] Failed to load:', err);
        }
      }
      setIsLoaded(true);
    };

    loadPreferences();
  }, []);

  // Save preferences
  const savePreferences = useCallback(async (newPreferences) => {
    setPreferences(newPreferences);
    if (window.electron?.saveUserPreferences) {
      try {
        await window.electron.saveUserPreferences(newPreferences);
        console.log('[UserPreferences] Saved preferences');
      } catch (err) {
        console.error('[UserPreferences] Failed to save:', err);
      }
    }
  }, []);

  // Update a specific preference section
  const updatePreferences = useCallback((section, updates) => {
    setPreferences(prev => {
      const newPrefs = {
        ...prev,
        [section]: {
          ...prev[section],
          ...updates,
        },
      };
      // Save asynchronously
      if (window.electron?.saveUserPreferences) {
        window.electron.saveUserPreferences(newPrefs).catch(err => {
          console.error('[UserPreferences] Failed to save:', err);
        });
      }
      return newPrefs;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        isLoaded,
        updatePreferences,
        savePreferences,
        resetToDefaults,
        DEFAULT_PREFERENCES,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
}
