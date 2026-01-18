import React, { createContext, useContext, useState, useCallback } from 'react';

const SchemaContext = createContext(null);

export function SchemaProvider({ children }) {
  const [schema, setSchema] = useState({
    tables: [],
    types: [],
    sequences: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateSchema = useCallback((newSchema) => {
    setSchema(newSchema);
    setError(null);
  }, []);

  const setParseError = useCallback((errorMessage) => {
    setError(errorMessage);
  }, []);

  const clearSchema = useCallback(() => {
    setSchema({
      tables: [],
      types: [],
      sequences: [],
    });
    setError(null);
  }, []);

  const value = {
    schema,
    isLoading,
    error,
    setIsLoading,
    updateSchema,
    setParseError,
    clearSchema,
  };

  return (
    <SchemaContext.Provider value={value}>
      {children}
    </SchemaContext.Provider>
  );
}

export function useSchema() {
  const context = useContext(SchemaContext);
  if (!context) {
    throw new Error('useSchema must be used within a SchemaProvider');
  }
  return context;
}

export default SchemaContext;
