import React, { createContext, useContext, useState, useCallback } from 'react';

const SelectionContext = createContext(null);

export function SelectionProvider({ children }) {
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSequence, setSelectedSequence] = useState(null);

  const selectTable = useCallback((tableName) => {
    setSelectedTable(tableName);
    setSelectedColumn(null);
    setSelectedType(null);
    setSelectedSequence(null);
  }, []);

  const selectColumn = useCallback((tableName, columnName) => {
    setSelectedTable(tableName);
    setSelectedColumn(columnName);
    setSelectedType(null);
    setSelectedSequence(null);
  }, []);

  const selectType = useCallback((typeName) => {
    setSelectedType(typeName);
    setSelectedTable(null);
    setSelectedColumn(null);
    setSelectedSequence(null);
  }, []);

  const selectSequence = useCallback((sequenceName) => {
    setSelectedSequence(sequenceName);
    setSelectedTable(null);
    setSelectedColumn(null);
    setSelectedType(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTable(null);
    setSelectedColumn(null);
    setSelectedType(null);
    setSelectedSequence(null);
  }, []);

  const value = {
    selectedTable,
    selectedColumn,
    selectedType,
    selectedSequence,
    selectTable,
    selectColumn,
    selectType,
    selectSequence,
    clearSelection,
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

export default SelectionContext;
