/**
 * Application constants
 */

export const APP_NAME = 'Runway';
export const APP_VERSION = '0.1.0';

// Colors (VS Code dark theme)
export const COLORS = {
  background: '#1e1e1e',
  backgroundLight: '#252526',
  backgroundDark: '#1a1a1a',
  text: '#d4d4d4',
  textMuted: '#888888',
  textDim: '#666666',
  accent: '#0e639c',
  accentHover: '#1177bb',
  border: '#333333',
  borderLight: '#444444',
  primaryKey: '#f5c518',
  foreignKey: '#6997d5',
  error: '#f44336',
  warning: '#ff9800',
  success: '#4caf50',
};

// Diagram settings
export const DIAGRAM = {
  nodeWidth: 250,
  nodeHeight: 200,
  nodeSeparation: 80,
  rankSeparation: 100,
};

// Supported PostgreSQL data types
export const DATA_TYPES = [
  // Numeric
  'SMALLINT', 'INTEGER', 'INT', 'BIGINT',
  'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
  'SMALLSERIAL', 'SERIAL', 'BIGSERIAL',

  // Character
  'CHAR', 'CHARACTER', 'VARCHAR', 'CHARACTER VARYING', 'TEXT',

  // Binary
  'BYTEA',

  // Date/Time
  'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ',
  'INTERVAL',

  // Boolean
  'BOOLEAN', 'BOOL',

  // UUID
  'UUID',

  // JSON
  'JSON', 'JSONB',

  // Arrays
  'ARRAY',

  // Other
  'MONEY', 'INET', 'CIDR', 'MACADDR',
];
