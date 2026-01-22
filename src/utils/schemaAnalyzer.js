/**
 * Schema Analyzer
 *
 * Analyzes a parsed schema for potential issues, warnings, and best practice violations.
 */

/**
 * Severity levels for analysis results
 */
export const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Categories for analysis results
 */
export const Category = {
  STRUCTURE: 'Structure',
  RELATIONSHIPS: 'Relationships',
  NAMING: 'Naming Conventions',
  BEST_PRACTICES: 'Best Practices',
};

/**
 * Analyze schema and return a list of issues
 * @param {Object} schema - The parsed schema
 * @param {Object} options - Analysis options
 * @returns {Array} List of issues found
 */
export function analyzeSchema(schema, options = {}) {
  const {
    checkOrphanTables = true,
    checkCircularDeps = true,
    checkMissingPK = true,
    checkNamingConventions = true,
    checkFKNaming = true,
    checkMissingIndexes = true,
    fkSuffix = '_id',
  } = options;

  const issues = [];

  if (checkOrphanTables) {
    issues.push(...detectOrphanTables(schema));
  }

  if (checkCircularDeps) {
    issues.push(...detectCircularDependencies(schema));
  }

  if (checkMissingPK) {
    issues.push(...detectMissingPrimaryKeys(schema));
  }

  if (checkNamingConventions) {
    issues.push(...checkTableNamingConventions(schema));
  }

  if (checkFKNaming) {
    issues.push(...checkForeignKeyNaming(schema, fkSuffix));
  }

  if (checkMissingIndexes) {
    issues.push(...detectMissingFKIndexes(schema));
  }

  // Sort by severity (errors first, then warnings, then info)
  const severityOrder = { [Severity.ERROR]: 0, [Severity.WARNING]: 1, [Severity.INFO]: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

/**
 * Detect orphan tables (tables with no relationships)
 */
function detectOrphanTables(schema) {
  const issues = [];
  const tablesWithRelations = new Set();

  // Track tables that have foreign keys (outgoing relationships)
  for (const table of schema.tables) {
    if (table.foreignKeys.length > 0) {
      tablesWithRelations.add(table.name);
      for (const fk of table.foreignKeys) {
        tablesWithRelations.add(fk.referencedTable);
      }
    }
  }

  // Find orphan tables
  for (const table of schema.tables) {
    if (!tablesWithRelations.has(table.name)) {
      issues.push({
        severity: Severity.INFO,
        category: Category.RELATIONSHIPS,
        table: table.name,
        sourceFile: table.sourceFile,
        message: `Table "${table.name}" has no foreign key relationships`,
        suggestion: 'Consider whether this table should be related to other tables, or if it\'s intentionally standalone.',
      });
    }
  }

  return issues;
}

/**
 * Detect circular dependencies in foreign key relationships
 */
function detectCircularDependencies(schema) {
  const issues = [];
  const adjacencyList = new Map();

  // Build adjacency list
  for (const table of schema.tables) {
    if (!adjacencyList.has(table.name)) {
      adjacencyList.set(table.name, []);
    }
    for (const fk of table.foreignKeys) {
      adjacencyList.get(table.name).push(fk.referencedTable);
    }
  }

  // Find all cycles using DFS
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        const cycle = path.slice(cycleStart);
        cycle.push(neighbor); // Complete the cycle
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const table of schema.tables) {
    if (!visited.has(table.name)) {
      dfs(table.name, []);
    }
  }

  // Report unique cycles
  const reportedCycles = new Set();
  for (const cycle of cycles) {
    // Normalize cycle for deduplication (start from smallest name)
    const normalized = normalizeCycle(cycle);
    const cycleKey = normalized.join(' -> ');

    if (!reportedCycles.has(cycleKey)) {
      reportedCycles.add(cycleKey);

      const involvedTables = schema.tables.filter(t => normalized.includes(t.name));
      const sourceFiles = [...new Set(involvedTables.map(t => t.sourceFile))];

      issues.push({
        severity: Severity.WARNING,
        category: Category.RELATIONSHIPS,
        table: normalized[0],
        tables: normalized.slice(0, -1), // Remove duplicate at end
        sourceFile: sourceFiles[0],
        message: `Circular dependency detected: ${cycleKey}`,
        suggestion: 'Circular dependencies can cause issues with data insertion order. Consider using nullable FKs or restructuring the schema.',
      });
    }
  }

  return issues;
}

/**
 * Normalize a cycle for consistent representation
 */
function normalizeCycle(cycle) {
  // Remove the last element (duplicate of first)
  const nodes = cycle.slice(0, -1);
  if (nodes.length === 0) return cycle;

  // Find the lexicographically smallest element
  let minIndex = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIndex]) {
      minIndex = i;
    }
  }

  // Rotate to start from smallest
  const rotated = [...nodes.slice(minIndex), ...nodes.slice(0, minIndex)];
  rotated.push(rotated[0]); // Add cycle back to start

  return rotated;
}

/**
 * Detect tables without primary keys
 */
function detectMissingPrimaryKeys(schema) {
  const issues = [];

  for (const table of schema.tables) {
    if (!table.primaryKey || table.primaryKey.length === 0) {
      issues.push({
        severity: Severity.WARNING,
        category: Category.BEST_PRACTICES,
        table: table.name,
        sourceFile: table.sourceFile,
        message: `Table "${table.name}" has no primary key defined`,
        suggestion: 'Every table should have a primary key for data integrity and efficient querying.',
      });
    }
  }

  return issues;
}

/**
 * Check table naming conventions
 */
function checkTableNamingConventions(schema) {
  const issues = [];

  for (const table of schema.tables) {
    // Check for PascalCase or camelCase (should be snake_case)
    if (/[A-Z]/.test(table.name)) {
      issues.push({
        severity: Severity.INFO,
        category: Category.NAMING,
        table: table.name,
        sourceFile: table.sourceFile,
        message: `Table "${table.name}" uses mixed case naming`,
        suggestion: 'PostgreSQL convention is to use snake_case for table names (e.g., "user_accounts" instead of "UserAccounts").',
      });
    }

    // Check column naming
    for (const column of table.columns) {
      if (/[A-Z]/.test(column.name)) {
        issues.push({
          severity: Severity.INFO,
          category: Category.NAMING,
          table: table.name,
          column: column.name,
          sourceFile: table.sourceFile,
          message: `Column "${table.name}.${column.name}" uses mixed case naming`,
          suggestion: 'PostgreSQL convention is to use snake_case for column names.',
        });
      }
    }
  }

  return issues;
}

/**
 * Check foreign key column naming conventions
 */
function checkForeignKeyNaming(schema, fkSuffix = '_id') {
  const issues = [];

  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      for (const column of fk.columns) {
        // Check if FK column ends with the expected suffix
        if (!column.endsWith(fkSuffix)) {
          issues.push({
            severity: Severity.INFO,
            category: Category.NAMING,
            table: table.name,
            column: column,
            sourceFile: table.sourceFile,
            message: `Foreign key column "${table.name}.${column}" doesn't end with "${fkSuffix}"`,
            suggestion: `Consider renaming to "${column}${fkSuffix}" or similar for clarity (e.g., "user_id" for a reference to "users").`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Detect foreign key columns without indexes
 * FK columns should typically have an index for efficient JOINs and referential integrity checks
 */
function detectMissingFKIndexes(schema) {
  const issues = [];

  // Build a map of indexed columns per table
  const indexedColumns = new Map(); // tableName -> Set of column names

  // Get indexes from schema (if available)
  const indexes = schema.indexes || [];
  for (const index of indexes) {
    if (!indexedColumns.has(index.tableName)) {
      indexedColumns.set(index.tableName, new Set());
    }
    for (const col of index.columns) {
      indexedColumns.get(index.tableName).add(col.toLowerCase());
    }
  }

  // Also consider primary keys as indexed (they implicitly have an index)
  for (const table of schema.tables) {
    if (!indexedColumns.has(table.name)) {
      indexedColumns.set(table.name, new Set());
    }
    for (const pkCol of table.primaryKey || []) {
      indexedColumns.get(table.name).add(pkCol.toLowerCase());
    }

    // Also consider unique constraints as indexed
    for (const uniqueConstraint of table.uniqueConstraints || []) {
      if (uniqueConstraint.length === 1) {
        // Single-column unique constraints typically have an index
        indexedColumns.get(table.name).add(uniqueConstraint[0].toLowerCase());
      }
    }
  }

  // Check each FK column for an index
  for (const table of schema.tables) {
    const tableIndexedCols = indexedColumns.get(table.name) || new Set();

    for (const fk of table.foreignKeys) {
      for (const fkCol of fk.columns) {
        const colLower = fkCol.toLowerCase();

        // Skip if already indexed (PK, unique, or explicit index)
        if (tableIndexedCols.has(colLower)) {
          continue;
        }

        // Check if there's a compound index that starts with this column
        let hasCompoundIndex = false;
        for (const index of indexes) {
          if (index.tableName === table.name &&
              index.columns.length > 0 &&
              index.columns[0].toLowerCase() === colLower) {
            hasCompoundIndex = true;
            break;
          }
        }

        if (!hasCompoundIndex) {
          issues.push({
            severity: Severity.WARNING,
            category: Category.BEST_PRACTICES,
            table: table.name,
            column: fkCol,
            sourceFile: table.sourceFile,
            message: `Foreign key column "${table.name}.${fkCol}" has no index`,
            suggestion: `Consider adding an index: CREATE INDEX idx_${table.name}_${fkCol} ON ${table.name}(${fkCol});`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Get summary statistics of the analysis
 */
export function getAnalysisSummary(issues) {
  const summary = {
    total: issues.length,
    errors: issues.filter(i => i.severity === Severity.ERROR).length,
    warnings: issues.filter(i => i.severity === Severity.WARNING).length,
    info: issues.filter(i => i.severity === Severity.INFO).length,
    byCategory: {},
  };

  for (const issue of issues) {
    if (!summary.byCategory[issue.category]) {
      summary.byCategory[issue.category] = 0;
    }
    summary.byCategory[issue.category]++;
  }

  return summary;
}

export default { analyzeSchema, getAnalysisSummary, Severity, Category };
