import React, { createContext, useContext, useState, useCallback } from 'react';

const EditorContext = createContext(null);

export function EditorProvider({ children }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState(null);

  const openFile = useCallback(async (filePath, fileName) => {
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === filePath);
    if (existingFile) {
      setActiveFilePath(filePath);
      return;
    }

    // Read file content
    if (window.electron) {
      const result = await window.electron.readFile(filePath);
      if (result.success) {
        const newFile = {
          path: filePath,
          name: fileName || filePath.split(/[/\\]/).pop(),
          content: result.content,
          originalContent: result.content,
          isDirty: false,
        };
        setOpenFiles(prev => [...prev, newFile]);
        setActiveFilePath(filePath);
      }
    }
  }, [openFiles]);

  const closeFile = useCallback((filePath) => {
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));

    // If we closed the active file, switch to another one
    if (activeFilePath === filePath) {
      setActiveFilePath(() => {
        const remaining = openFiles.filter(f => f.path !== filePath);
        return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
      });
    }
  }, [activeFilePath, openFiles]);

  const updateFileContent = useCallback((filePath, newContent) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.path === filePath) {
        return {
          ...f,
          content: newContent,
          isDirty: newContent !== f.originalContent,
        };
      }
      return f;
    }));
  }, []);

  const saveFile = useCallback(async (filePath) => {
    const file = openFiles.find(f => f.path === filePath);
    if (!file || !window.electron) return false;

    const result = await window.electron.saveFile(filePath, file.content);
    if (result.success) {
      setOpenFiles(prev => prev.map(f => {
        if (f.path === filePath) {
          return {
            ...f,
            originalContent: f.content,
            isDirty: false,
          };
        }
        return f;
      }));
      return true;
    }
    return false;
  }, [openFiles]);

  const getActiveFile = useCallback(() => {
    return openFiles.find(f => f.path === activeFilePath) || null;
  }, [openFiles, activeFilePath]);

  const value = {
    openFiles,
    activeFilePath,
    setActiveFilePath,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    getActiveFile,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}

export default EditorContext;
