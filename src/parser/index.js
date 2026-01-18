/**
 * DDL Parser for PostgreSQL
 *
 * Parses CREATE TABLE, CREATE TYPE (enum), and CREATE SEQUENCE statements.
 * Returns a schema object with tables, types, and sequences.
 */

/**
 * Parse all DDL files and return a unified schema
 * @param {Array<{path: string, content: string}>} files
 * @returns {Object} Schema with tables, types, sequences
 */
export function parseAllFiles(files) {
  const schema = {
    tables: [],
    types: [],
    sequences: [],
  };

  for (const file of files) {
    try {
      const fileSchema = parseDDL(file.content, file.path);
      schema.tables.push(...fileSchema.tables);
      schema.types.push(...fileSchema.types);
      schema.sequences.push(...fileSchema.sequences);
    } catch (error) {
      console.error(`Error parsing ${file.path}:`, error);
    }
  }

  // Resolve foreign key references
  resolveForeignKeys(schema);

  return schema;
}

/**
 * Parse DDL content from a single file
 * @param {string} content SQL content
 * @param {string} sourceFile Source file path
 * @returns {Object} Partial schema
 */
export function parseDDL(content, sourceFile = '') {
  const schema = {
    tables: [],
    types: [],
    sequences: [],
  };

  // Remove comments
  const cleanContent = removeComments(content);

  // Parse CREATE TYPE statements (enums)
  const types = parseTypes(cleanContent, sourceFile);
  schema.types.push(...types);

  // Parse CREATE SEQUENCE statements
  const sequences = parseSequences(cleanContent, sourceFile);
  schema.sequences.push(...sequences);

  // Parse CREATE TABLE statements
  const tables = parseTables(cleanContent, sourceFile);
  schema.tables.push(...tables);

  // Parse ALTER TABLE statements for foreign keys
  parseAlterTables(cleanContent, schema.tables);

  return schema;
}

/**
 * Remove SQL comments
 */
function removeComments(content) {
  // Remove single-line comments
  let result = content.replace(/--.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

/**
 * Parse CREATE TYPE ... AS ENUM statements
 */
function parseTypes(content, sourceFile) {
  const types = [];
  const typeRegex = /CREATE\s+TYPE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["\w.]+)\s+AS\s+ENUM\s*\(\s*([^)]+)\s*\)/gi;

  let match;
  while ((match = typeRegex.exec(content)) !== null) {
    const name = cleanIdentifier(match[1]);
    const valuesStr = match[2];
    const values = valuesStr
      .split(',')
      .map(v => v.trim().replace(/^'|'$/g, ''))
      .filter(v => v.length > 0);

    types.push({
      name,
      values,
      sourceFile,
    });
  }

  return types;
}

/**
 * Parse CREATE SEQUENCE statements
 */
function parseSequences(content, sourceFile) {
  const sequences = [];
  const seqRegex = /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["\w.]+)([^;]*)/gi;

  let match;
  while ((match = seqRegex.exec(content)) !== null) {
    const name = cleanIdentifier(match[1]);
    const options = match[2];

    let start = 1;
    let increment = 1;

    const startMatch = options.match(/START\s+(?:WITH\s+)?(\d+)/i);
    if (startMatch) start = parseInt(startMatch[1], 10);

    const incMatch = options.match(/INCREMENT\s+(?:BY\s+)?(\d+)/i);
    if (incMatch) increment = parseInt(incMatch[1], 10);

    sequences.push({
      name,
      start,
      increment,
      sourceFile,
    });
  }

  return sequences;
}

/**
 * Parse CREATE TABLE statements
 */
function parseTables(content, sourceFile) {
  const tables = [];

  // Match CREATE TABLE with its body
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["\w.]+)\s*\(([\s\S]*?)\)\s*;/gi;

  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = cleanIdentifier(match[1]);
    const bodyContent = match[2];

    const table = {
      name: tableName,
      columns: [],
      primaryKey: [],
      foreignKeys: [],
      uniqueConstraints: [],
      sourceFile,
    };

    // Parse the table body
    parseTableBody(bodyContent, table);

    tables.push(table);
  }

  return tables;
}

/**
 * Parse the body of a CREATE TABLE statement
 */
function parseTableBody(bodyContent, table) {
  // Split by commas, but be careful about nested parentheses
  const parts = splitTableBody(bodyContent);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check for PRIMARY KEY constraint
    const pkMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+["\w]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      const columns = pkMatch[1].split(',').map(c => cleanIdentifier(c.trim()));
      table.primaryKey.push(...columns);
      continue;
    }

    // Check for FOREIGN KEY constraint
    const fkMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+(["\w]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(["\w.]+)\s*(?:\(([^)]+)\))?/i);
    if (fkMatch) {
      const constraintName = fkMatch[1] ? cleanIdentifier(fkMatch[1]) : null;
      const columns = fkMatch[2].split(',').map(c => cleanIdentifier(c.trim()));
      const refTable = cleanIdentifier(fkMatch[3]);
      const refColumns = fkMatch[4]
        ? fkMatch[4].split(',').map(c => cleanIdentifier(c.trim()))
        : columns;

      table.foreignKeys.push({
        constraintName,
        columns,
        referencedTable: refTable,
        referencedColumns: refColumns,
      });
      continue;
    }

    // Check for UNIQUE constraint
    const uniqueMatch = trimmed.match(/^\s*(?:CONSTRAINT\s+["\w]+\s+)?UNIQUE\s*\(([^)]+)\)/i);
    if (uniqueMatch) {
      const columns = uniqueMatch[1].split(',').map(c => cleanIdentifier(c.trim()));
      table.uniqueConstraints.push(columns);
      continue;
    }

    // Otherwise, it's a column definition
    const column = parseColumn(trimmed);
    if (column) {
      table.columns.push(column);

      // Check for inline PRIMARY KEY
      if (column.isPrimaryKey) {
        table.primaryKey.push(column.name);
      }

      // Check for inline REFERENCES (foreign key)
      if (column.references) {
        table.foreignKeys.push({
          constraintName: null,
          columns: [column.name],
          referencedTable: column.references.table,
          referencedColumns: column.references.columns,
        });
      }
    }
  }
}

/**
 * Split table body by commas, respecting parentheses
 */
function splitTableBody(content) {
  const parts = [];
  let current = '';
  let depth = 0;

  for (const char of content) {
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

/**
 * Parse a single column definition
 */
function parseColumn(definition) {
  // Column pattern: name type [constraints...]
  const columnMatch = definition.match(/^\s*(["\w]+)\s+([A-Za-z_][\w\s()[\],]*?)(\s+(?:NOT\s+NULL|NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|CONSTRAINT).*)?\s*$/i);

  if (!columnMatch) return null;

  const name = cleanIdentifier(columnMatch[1]);
  let dataType = columnMatch[2].trim();
  const constraintsPart = columnMatch[3] || '';

  // Normalize data type
  dataType = normalizeDataType(dataType);

  const column = {
    name,
    dataType,
    nullable: true,
    defaultValue: null,
    isUnique: false,
    isPrimaryKey: false,
    references: null,
  };

  // Parse constraints
  if (/NOT\s+NULL/i.test(constraintsPart)) {
    column.nullable = false;
  }

  if (/\bNULL\b/i.test(constraintsPart) && !/NOT\s+NULL/i.test(constraintsPart)) {
    column.nullable = true;
  }

  const defaultMatch = constraintsPart.match(/DEFAULT\s+([^,\s]+(?:\([^)]*\))?)/i);
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1];
  }

  if (/PRIMARY\s+KEY/i.test(constraintsPart)) {
    column.isPrimaryKey = true;
    column.nullable = false;
  }

  if (/\bUNIQUE\b/i.test(constraintsPart)) {
    column.isUnique = true;
  }

  // Inline REFERENCES
  const refMatch = constraintsPart.match(/REFERENCES\s+(["\w.]+)\s*(?:\(([^)]+)\))?/i);
  if (refMatch) {
    column.references = {
      table: cleanIdentifier(refMatch[1]),
      columns: refMatch[2]
        ? refMatch[2].split(',').map(c => cleanIdentifier(c.trim()))
        : [name],
    };
  }

  return column;
}

/**
 * Parse ALTER TABLE statements for foreign keys
 */
function parseAlterTables(content, tables) {
  const alterRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(["\w.]+)\s+ADD\s+(?:CONSTRAINT\s+(["\w]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(["\w.]+)\s*(?:\(([^)]+)\))?/gi;

  let match;
  while ((match = alterRegex.exec(content)) !== null) {
    const tableName = cleanIdentifier(match[1]);
    const constraintName = match[2] ? cleanIdentifier(match[2]) : null;
    const columns = match[3].split(',').map(c => cleanIdentifier(c.trim()));
    const refTable = cleanIdentifier(match[4]);
    const refColumns = match[5]
      ? match[5].split(',').map(c => cleanIdentifier(c.trim()))
      : columns;

    // Find the table and add the foreign key
    const table = tables.find(t => t.name === tableName);
    if (table) {
      table.foreignKeys.push({
        constraintName,
        columns,
        referencedTable: refTable,
        referencedColumns: refColumns,
      });
    }
  }
}

/**
 * Resolve foreign key references to ensure all tables exist
 */
function resolveForeignKeys(schema) {
  const tableNames = new Set(schema.tables.map(t => t.name));

  for (const table of schema.tables) {
    // Filter out foreign keys referencing non-existent tables
    table.foreignKeys = table.foreignKeys.filter(fk => {
      if (!tableNames.has(fk.referencedTable)) {
        console.warn(`Foreign key in ${table.name} references unknown table: ${fk.referencedTable}`);
        return false;
      }
      return true;
    });
  }
}

/**
 * Clean identifier (remove quotes, extract name from schema.name)
 */
function cleanIdentifier(identifier) {
  let cleaned = identifier.trim().replace(/^"|"$/g, '');
  // Handle schema.table format - take just the table name
  if (cleaned.includes('.')) {
    cleaned = cleaned.split('.').pop();
  }
  return cleaned;
}

/**
 * Normalize data type representation
 */
function normalizeDataType(dataType) {
  return dataType
    .replace(/\s+/g, ' ')
    .replace(/CHARACTER VARYING/i, 'VARCHAR')
    .replace(/INTEGER/i, 'INT')
    .replace(/BOOLEAN/i, 'BOOL')
    .trim();
}

export default { parseAllFiles, parseDDL };
