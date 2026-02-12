import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const DatabaseRootsContext = createContext(null);

export function DatabaseRootsProvider({ children }) {
  const [databaseRoots, setDatabaseRoots] = useState([]);

  // Map keyed by folderPath for quick lookup - memoized to avoid stale closures
  const databaseRootsMap = useMemo(
    () => new Map(databaseRoots.map(r => [r.folderPath, r])),
    [databaseRoots]
  );

  const loadDatabaseRoots = useCallback(async (folderPath) => {
    if (!window.electron?.scanDatabaseRoots) return;
    const result = await window.electron.scanDatabaseRoots(folderPath);
    if (result.success) {
      setDatabaseRoots(result.roots);
    }
  }, []);

  const addOrUpdateRoot = useCallback(async (folderPath, meta) => {
    if (!window.electron?.writeDatabaseRoot) return;
    await window.electron.writeDatabaseRoot(folderPath, meta);
    setDatabaseRoots(prev => {
      const existing = prev.findIndex(r => r.folderPath === folderPath);
      const entry = { folderPath, ...meta };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [...prev, entry];
    });
  }, []);

  const removeRoot = useCallback(async (folderPath) => {
    if (!window.electron?.removeDatabaseRoot) return;
    await window.electron.removeDatabaseRoot(folderPath);
    setDatabaseRoots(prev => prev.filter(r => r.folderPath !== folderPath));
  }, []);

  const clearRoots = useCallback(() => {
    setDatabaseRoots([]);
  }, []);

  /**
   * Walk up from filePath's directory toward projectRoot,
   * checking databaseRootsMap at each level.
   * Returns the first matching root or null.
   */
  const findDatabaseForFile = useCallback((filePath, projectRoot) => {
    if (!filePath || databaseRoots.length === 0) return null;

    // Get the directory containing the file
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash === -1) return null;
    let dir = filePath.substring(0, lastSlash);

    const normalizedRoot = projectRoot ? projectRoot.replace(/\/$/, '') : '';

    while (dir && dir.length >= normalizedRoot.length) {
      if (databaseRootsMap.has(dir)) {
        return databaseRootsMap.get(dir);
      }
      // Walk up one level
      const parentSlash = dir.lastIndexOf('/');
      if (parentSlash === -1) break;
      dir = dir.substring(0, parentSlash);
    }

    return null;
  }, [databaseRoots, databaseRootsMap]);

  // Listen for file-watcher updates from main process
  useEffect(() => {
    if (!window.electron?.onDbRootsChanged) return;
    window.electron.onDbRootsChanged((data) => {
      if (data && Array.isArray(data.roots)) {
        setDatabaseRoots(data.roots);
      }
    });
  }, []);

  const value = {
    databaseRoots,
    databaseRootsMap,
    loadDatabaseRoots,
    addOrUpdateRoot,
    removeRoot,
    clearRoots,
    findDatabaseForFile,
  };

  return (
    <DatabaseRootsContext.Provider value={value}>
      {children}
    </DatabaseRootsContext.Provider>
  );
}

export function useDatabaseRoots() {
  const ctx = useContext(DatabaseRootsContext);
  if (!ctx) throw new Error('useDatabaseRoots must be used within DatabaseRootsProvider');
  return ctx;
}
