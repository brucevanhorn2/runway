/**
 * DDL Parser for PostgreSQL using AST
 *
 * Parses CREATE TABLE, CREATE TYPE (enum), and CREATE SEQUENCE statements.
 * Returns a schema object with tables, types, and sequences.
 */

import { parse } from 'pgsql-ast-parser';

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
    alterTableConstraints: [], // Store ALTER TABLE statements to apply later
  };

  for (const file of files) {
    try {
      const fileSchema = parseDDL(file.content, file.path);
      schema.tables.push(...fileSchema.tables);
      schema.types.push(...fileSchema.types);
      schema.sequences.push(...fileSchema.sequences);
      schema.alterTableConstraints.push(...fileSchema.alterTableConstraints);
    } catch (error) {
      console.error(`Error parsing ${file.path}:`, error);
    }
  }

  // Apply ALTER TABLE constraints
  applyAlterTableConstraints(schema);

  // Resolve foreign key references
  resolveForeignKeys(schema);

  return schema;
}

/**
 * Parse DDL content from a single file using AST parser
 * @param {string} content SQL content
 * @param {string} sourceFile Source file path
 * @returns {Object} Partial schema
 */
export function parseDDL(content, sourceFile = '') {
  const schema = {
    tables: [],
    types: [],
    sequences: [],
    alterTableConstraints: [],
  };

  try {
    const ast = parse(content, { locationTracking: false });

    for (const statement of ast) {
      if (statement.type === 'create enum') {
        schema.types.push(parseEnumType(statement, sourceFile));
      } else if (statement.type === 'create table') {
        schema.tables.push(parseTable(statement, sourceFile));
      } else if (statement.type === 'create sequence') {
        schema.sequences.push(parseSequence(statement, sourceFile));
      } else if (statement.type === 'alter table') {
        schema.alterTableConstraints.push(parseAlterTable(statement));
      }
    }
  } catch (error) {
    console.warn(`AST parse error in ${sourceFile}:`, error.message);
    // File might have syntax errors or unsupported constructs, skip it
  }

  return schema;
}

/**
 * Parse CREATE TYPE ... AS ENUM from AST
 */
function parseEnumType(statement, sourceFile) {
  return {
    name: cleanIdentifier(statement.name),
    values: statement.values.map(v => v.value),
    sourceFile,
  };
}

/**
 * Parse CREATE SEQUENCE from AST
 */
function parseSequence(statement, sourceFile) {
  const seq = {
    name: cleanIdentifier(statement.name),
    start: 1,
    increment: 1,
    sourceFile,
  };

  if (statement.options) {
    for (const option of statement.options) {
      if (option.type === 'start with') {
        seq.start = option.value;
      } else if (option.type === 'increment by') {
        seq.increment = option.value;
      }
    }
  }

  return seq;
}

/**
 * Parse CREATE TABLE from AST
 */
function parseTable(statement, sourceFile) {
  const table = {
    name: cleanIdentifier(statement.name),
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    uniqueConstraints: [],
    sourceFile,
  };

  // Parse columns
  if (statement.columns) {
    for (const item of statement.columns) {
      if (item.kind === 'column') {
        const column = parseColumn(item);
        table.columns.push(column);

        // Extract inline constraints
        if (item.constraints) {
          for (const constraint of item.constraints) {
            if (constraint.type === 'primary key') {
              table.primaryKey.push(column.name);
            } else if (constraint.type === 'unique') {
              table.uniqueConstraints.push([column.name]);
            } else if (constraint.type === 'reference') {
              table.foreignKeys.push({
                constraintName: null,
                columns: [column.name],
                referencedTable: cleanIdentifier(constraint.foreignTable),
                referencedColumns: constraint.foreignColumns 
                  ? constraint.foreignColumns.map(c => cleanIdentifier(c))
                  : [column.name],
              });
            }
          }
        }
      }
    }
  }

  // Parse table-level constraints (separate from columns array)
  if (statement.constraints) {
    for (const constraint of statement.constraints) {
      if (constraint.type === 'primary key') {
        table.primaryKey.push(...constraint.columns.map(c => cleanIdentifier(c)));
      } else if (constraint.type === 'unique') {
        table.uniqueConstraints.push(constraint.columns.map(c => cleanIdentifier(c)));
      } else if (constraint.type === 'foreign key') {
        table.foreignKeys.push({
          constraintName: constraint.constraintName ? cleanIdentifier(constraint.constraintName) : null,
          columns: constraint.localColumns.map(c => cleanIdentifier(c)),
          referencedTable: cleanIdentifier(constraint.foreignTable),
          referencedColumns: constraint.foreignColumns.map(c => cleanIdentifier(c)),
        });
      }
    }
  }

  return table;
}

/**
 * Parse column definition from AST
 */
function parseColumn(columnDef) {
  const column = {
    name: cleanIdentifier(columnDef.name),
    dataType: formatDataType(columnDef.dataType),
    nullable: true,
    defaultValue: null,
    isUnique: false,
    isPrimaryKey: false,
    references: null,
  };

  if (columnDef.constraints) {
    for (const constraint of columnDef.constraints) {
      if (constraint.type === 'not null') {
        column.nullable = false;
      } else if (constraint.type === 'null') {
        column.nullable = true;
      } else if (constraint.type === 'default') {
        column.defaultValue = formatDefault(constraint.default);
      } else if (constraint.type === 'primary key') {
        column.isPrimaryKey = true;
        column.nullable = false;
      } else if (constraint.type === 'unique') {
        column.isUnique = true;
      } else if (constraint.type === 'reference') {
        column.references = {
          table: cleanIdentifier(constraint.foreignTable),
          columns: constraint.foreignColumns 
            ? constraint.foreignColumns.map(c => cleanIdentifier(c))
            : [column.name],
        };
      }
    }
  }

  return column;
}

/**
 * Parse ALTER TABLE statement
 */
function parseAlterTable(statement) {
  const alterations = [];

  if (statement.changes) {
    for (const change of statement.changes) {
      if (change.type === 'add constraint' && change.constraint.type === 'foreign key') {
        alterations.push({
          tableName: cleanIdentifier(statement.table),
          foreignKey: {
            constraintName: change.constraint.constraintName 
              ? cleanIdentifier(change.constraint.constraintName) 
              : null,
            columns: change.constraint.localColumns.map(c => cleanIdentifier(c)),
            referencedTable: cleanIdentifier(change.constraint.foreignTable),
            referencedColumns: change.constraint.foreignColumns.map(c => cleanIdentifier(c)),
          },
        });
      }
    }
  }

  return alterations;
}

/**
 * Apply ALTER TABLE constraints to tables
 */
function applyAlterTableConstraints(schema) {
  for (const alterList of schema.alterTableConstraints) {
    for (const alter of alterList) {
      const table = schema.tables.find(t => t.name === alter.tableName);
      if (table && alter.foreignKey) {
        table.foreignKeys.push(alter.foreignKey);
      }
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
 * Format data type from AST node
 */
function formatDataType(dataType) {
  if (!dataType) return 'UNKNOWN';

  let typeName = dataType.name.toUpperCase();

  // Handle type with config (e.g., VARCHAR(255), DECIMAL(10,2))
  if (dataType.config && dataType.config.length > 0) {
    typeName += `(${dataType.config.join(',')})`;
  }

  // Handle array types
  if (dataType.arrayOf) {
    return formatDataType(dataType.arrayOf) + '[]';
  }

  return typeName;
}

/**
 * Format default value from AST node
 */
function formatDefault(defaultNode) {
  if (!defaultNode) return null;

  switch (defaultNode.type) {
    case 'string':
    case 'numeric':
    case 'integer':
      return String(defaultNode.value);
    case 'boolean':
      return defaultNode.value ? 'TRUE' : 'FALSE';
    case 'null':
      return 'NULL';
    case 'call':
      // Function call like NOW(), gen_random_uuid()
      return `${defaultNode.function.name}()`;
    case 'constant':
      return defaultNode.value;
    default:
      return 'DEFAULT';
  }
}

/**
 * Clean identifier (extract name from AST node)
 */
function cleanIdentifier(identifier) {
  if (typeof identifier === 'string') {
    return identifier;
  }
  
  if (identifier && identifier.name) {
    return identifier.name;
  }

  return 'unknown';
}

export default { parseAllFiles, parseDDL };
