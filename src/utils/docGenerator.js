/**
 * Documentation Generator
 *
 * Generates markdown documentation and data dictionary reports from schema.
 * Supports organizing by folder (UML packages) for better documentation structure.
 */

/**
 * Extract folder path from source file (relative path)
 * Returns the folder name or '(root)' for files in the root
 */
function getFolderFromSourceFile(sourceFile, projectRoot) {
  if (!sourceFile) return '(root)';

  // Get relative path from project root
  let relativePath = sourceFile;
  if (projectRoot && sourceFile.startsWith(projectRoot)) {
    relativePath = sourceFile.substring(projectRoot.length + 1);
  }

  // Extract folder (everything before the last /)
  const lastSlash = relativePath.lastIndexOf('/');
  if (lastSlash === -1) return '(root)';

  return relativePath.substring(0, lastSlash);
}

/**
 * Group tables and types by folder
 */
function groupSchemaByFolder(schema, projectRoot) {
  const groups = new Map();

  // Group tables
  schema.tables.forEach(table => {
    const folder = getFolderFromSourceFile(table.sourceFile, projectRoot);
    if (!groups.has(folder)) {
      groups.set(folder, { tables: [], types: [] });
    }
    groups.get(folder).tables.push(table);
  });

  // Group types
  schema.types.forEach(type => {
    const folder = getFolderFromSourceFile(type.sourceFile, projectRoot);
    if (!groups.has(folder)) {
      groups.set(folder, { tables: [], types: [] });
    }
    groups.get(folder).types.push(type);
  });

  return groups;
}

/**
 * Format folder name for display (UML package style)
 */
function formatPackageName(folder) {
  if (folder === '(root)') return 'Root Package';
  // Convert path separators to dots for UML package notation
  return folder.replace(/\//g, '.');
}

/**
 * Generate Markdown documentation for the schema
 * @param {Object} schema - The parsed schema object
 * @param {Object} options - Export options
 * @returns {string} Markdown content
 */
export function generateMarkdownDocs(schema, options = {}) {
  const {
    title = 'Database Schema Documentation',
    includeRelationships = true,
    includeEnums = true,
    includeSequences = false,
    projectRoot = null,
    groupByFolder = true,
  } = options;

  const lines = [];

  // Title
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  // Group schema by folder for package-based organization
  const groups = groupSchemaByFolder(schema, projectRoot);
  const sortedFolders = Array.from(groups.keys()).sort();

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');

  if (groupByFolder && sortedFolders.length > 1) {
    // TOC organized by package
    lines.push('### Packages');
    lines.push('');
    for (const folder of sortedFolders) {
      const packageName = formatPackageName(folder);
      lines.push(`- [${packageName}](#${toAnchor(packageName)})`);
    }
    lines.push('');

    lines.push('### All Tables');
    lines.push('');
    for (const folder of sortedFolders) {
      const group = groups.get(folder);
      for (const table of group.tables) {
        const packageName = formatPackageName(folder);
        lines.push(`- [${table.name}](#${toAnchor(table.name)}) *(${packageName})*`);
      }
    }
    lines.push('');

    if (includeEnums) {
      const allTypes = sortedFolders.flatMap(f => groups.get(f).types);
      if (allTypes.length > 0) {
        lines.push('### All Enum Types');
        lines.push('');
        for (const folder of sortedFolders) {
          const group = groups.get(folder);
          for (const type of group.types) {
            const packageName = formatPackageName(folder);
            lines.push(`- [${type.name}](#${toAnchor(type.name)}) *(${packageName})*`);
          }
        }
        lines.push('');
      }
    }
  } else {
    // Flat TOC
    if (schema.tables.length > 0) {
      lines.push('### Tables');
      for (const table of schema.tables) {
        lines.push(`- [${table.name}](#${toAnchor(table.name)})`);
      }
      lines.push('');
    }

    if (includeEnums && schema.types.length > 0) {
      lines.push('### Enum Types');
      for (const type of schema.types) {
        lines.push(`- [${type.name}](#${toAnchor(type.name)})`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  // Content organized by package/folder
  if (groupByFolder && sortedFolders.length > 1) {
    for (const folder of sortedFolders) {
      const group = groups.get(folder);
      const packageName = formatPackageName(folder);

      lines.push(`## ${packageName}`);
      lines.push('');
      lines.push(`*Package: \`${folder}\`*`);
      lines.push('');

      // Package summary
      lines.push(`This package contains **${group.tables.length}** tables and **${group.types.length}** enum types.`);
      lines.push('');

      // Tables in this package
      if (group.tables.length > 0) {
        for (const table of group.tables) {
          renderTable(lines, table, includeRelationships);
        }
      }

      // Enums in this package
      if (includeEnums && group.types.length > 0) {
        for (const type of group.types) {
          renderEnumType(lines, type);
        }
      }
    }
  } else {
    // Flat organization
    if (schema.tables.length > 0) {
      lines.push('## Tables');
      lines.push('');

      for (const table of schema.tables) {
        renderTable(lines, table, includeRelationships);
      }
    }

    if (includeEnums && schema.types.length > 0) {
      lines.push('## Enum Types');
      lines.push('');

      for (const type of schema.types) {
        renderEnumType(lines, type);
      }
    }
  }

  // Sequences
  if (includeSequences && schema.sequences.length > 0) {
    lines.push('## Sequences');
    lines.push('');

    for (const seq of schema.sequences) {
      lines.push(`- **${seq.name}** - Start: ${seq.start}, Increment: ${seq.increment}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Render a table definition to markdown lines
 */
function renderTable(lines, table, includeRelationships) {
  lines.push(`### ${table.name}`);
  lines.push('');

  // Table description
  if (table.comment) {
    lines.push(`> ${table.comment}`);
    lines.push('');
  }

  // Source file
  if (table.sourceFile) {
    const fileName = table.sourceFile.split('/').pop();
    lines.push(`*Source: \`${fileName}\`*`);
    lines.push('');
  }

  // Columns table
  lines.push('#### Columns');
  lines.push('');
  lines.push('| Column | Type | Nullable | Default | Description |');
  lines.push('|--------|------|----------|---------|-------------|');

  for (const col of table.columns) {
    const pkMark = table.primaryKey.includes(col.name) ? ' **PK**' : '';
    const fkMark = table.foreignKeys.some(fk => fk.columns.includes(col.name)) ? ' *FK*' : '';
    const uniqueMark = col.isUnique ? ' (unique)' : '';
    const nullable = col.nullable ? 'Yes' : 'No';
    const defaultVal = col.defaultValue || '-';
    const description = col.comment || '-';

    lines.push(`| ${col.name}${pkMark}${fkMark}${uniqueMark} | ${col.dataType} | ${nullable} | ${defaultVal} | ${description} |`);
  }
  lines.push('');

  // Foreign Keys
  if (includeRelationships && table.foreignKeys.length > 0) {
    lines.push('#### Relationships');
    lines.push('');
    for (const fk of table.foreignKeys) {
      const constraintName = fk.constraintName ? ` (${fk.constraintName})` : '';
      lines.push(`- **${fk.columns.join(', ')}** → \`${fk.referencedTable}\` (${fk.referencedColumns.join(', ')})${constraintName}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
}

/**
 * Render an enum type definition to markdown lines
 */
function renderEnumType(lines, type) {
  lines.push(`### ${type.name}`);
  lines.push('');

  if (type.comment) {
    lines.push(`> ${type.comment}`);
    lines.push('');
  }

  lines.push('**Values:**');
  lines.push('');
  for (const value of type.values) {
    lines.push(`- \`${value}\``);
  }
  lines.push('');
}

/**
 * Generate Data Dictionary report
 * @param {Object} schema - The parsed schema object
 * @param {Object} options - Export options
 * @returns {string} Markdown content
 */
export function generateDataDictionary(schema, options = {}) {
  const { projectRoot = null } = options;
  const lines = [];

  lines.push('# Data Dictionary');
  lines.push('');
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  // Group schema by folder for package summary
  const groups = groupSchemaByFolder(schema, projectRoot);
  const sortedFolders = Array.from(groups.keys()).sort();

  // Summary statistics
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Packages (Folders):** ${sortedFolders.length}`);
  lines.push(`- **Tables:** ${schema.tables.length}`);
  lines.push(`- **Enum Types:** ${schema.types.length}`);
  lines.push(`- **Sequences:** ${schema.sequences.length}`);

  const totalColumns = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalFKs = schema.tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
  lines.push(`- **Total Columns:** ${totalColumns}`);
  lines.push(`- **Total Foreign Keys:** ${totalFKs}`);
  lines.push('');

  // Package breakdown
  if (sortedFolders.length > 1) {
    lines.push('## Package Overview');
    lines.push('');
    lines.push('| Package | Tables | Enum Types | Columns |');
    lines.push('|---------|--------|------------|---------|');

    for (const folder of sortedFolders) {
      const group = groups.get(folder);
      const packageName = formatPackageName(folder);
      const colCount = group.tables.reduce((sum, t) => sum + t.columns.length, 0);
      lines.push(`| ${packageName} | ${group.tables.length} | ${group.types.length} | ${colCount} |`);
    }
    lines.push('');
  }

  // Data Types Usage
  lines.push('## Data Types Usage');
  lines.push('');

  const typeUsage = {};
  for (const table of schema.tables) {
    for (const col of table.columns) {
      const baseType = col.dataType.split('(')[0].trim().toUpperCase();
      typeUsage[baseType] = (typeUsage[baseType] || 0) + 1;
    }
  }

  const sortedTypes = Object.entries(typeUsage).sort((a, b) => b[1] - a[1]);
  lines.push('| Data Type | Count |');
  lines.push('|-----------|-------|');
  for (const [type, count] of sortedTypes) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');

  // Relationship Matrix
  if (schema.tables.length > 0) {
    lines.push('## Relationship Summary');
    lines.push('');
    lines.push('| From Table | To Table | Columns |');
    lines.push('|------------|----------|---------|');

    for (const table of schema.tables) {
      for (const fk of table.foreignKeys) {
        lines.push(`| ${table.name} | ${fk.referencedTable} | ${fk.columns.join(', ')} → ${fk.referencedColumns.join(', ')} |`);
      }
    }
    lines.push('');
  }

  // Tables without relationships (orphans)
  const tablesWithRelations = new Set();
  for (const table of schema.tables) {
    if (table.foreignKeys.length > 0) {
      tablesWithRelations.add(table.name);
      for (const fk of table.foreignKeys) {
        tablesWithRelations.add(fk.referencedTable);
      }
    }
  }

  const orphanTables = schema.tables.filter(t => !tablesWithRelations.has(t.name));
  if (orphanTables.length > 0) {
    lines.push('## Orphan Tables');
    lines.push('');
    lines.push('*Tables with no foreign key relationships:*');
    lines.push('');
    for (const table of orphanTables) {
      lines.push(`- ${table.name}`);
    }
    lines.push('');
  }

  // Detailed Table Definitions - organized by package
  lines.push('## Detailed Table Definitions');
  lines.push('');

  if (sortedFolders.length > 1) {
    // Organized by package
    for (const folder of sortedFolders) {
      const group = groups.get(folder);
      if (group.tables.length === 0) continue;

      const packageName = formatPackageName(folder);
      lines.push(`### Package: ${packageName}`);
      lines.push('');
      lines.push(`*Path: \`${folder}\`*`);
      lines.push('');

      for (const table of group.tables) {
        renderDetailedTable(lines, table);
      }
    }
  } else {
    // Flat organization
    for (const table of schema.tables) {
      renderDetailedTable(lines, table);
    }
  }

  // Enum Types Detail - organized by package
  if (schema.types.length > 0) {
    lines.push('## Enum Types Detail');
    lines.push('');

    if (sortedFolders.length > 1) {
      for (const folder of sortedFolders) {
        const group = groups.get(folder);
        if (group.types.length === 0) continue;

        const packageName = formatPackageName(folder);
        lines.push(`### Package: ${packageName}`);
        lines.push('');

        for (const type of group.types) {
          renderDetailedEnumType(lines, type);
        }
      }
    } else {
      for (const type of schema.types) {
        renderDetailedEnumType(lines, type);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Render detailed table definition for data dictionary
 */
function renderDetailedTable(lines, table) {
  lines.push(`#### ${table.name}`);
  lines.push('');

  if (table.comment) {
    lines.push(`**Description:** ${table.comment}`);
    lines.push('');
  }

  lines.push('| # | Column | Data Type | PK | FK | Nullable | Default | Description |');
  lines.push('|---|--------|-----------|----|----|----------|---------|-------------|');

  let colNum = 1;
  for (const col of table.columns) {
    const isPK = table.primaryKey.includes(col.name) ? 'Yes' : '';
    const isFK = table.foreignKeys.some(fk => fk.columns.includes(col.name)) ? 'Yes' : '';
    const nullable = col.nullable ? 'Yes' : 'No';
    const defaultVal = col.defaultValue || '';
    const description = col.comment || '';

    lines.push(`| ${colNum} | ${col.name} | ${col.dataType} | ${isPK} | ${isFK} | ${nullable} | ${defaultVal} | ${description} |`);
    colNum++;
  }
  lines.push('');
}

/**
 * Render detailed enum type definition for data dictionary
 */
function renderDetailedEnumType(lines, type) {
  lines.push(`#### ${type.name}`);
  lines.push('');

  if (type.comment) {
    lines.push(`**Description:** ${type.comment}`);
    lines.push('');
  }

  lines.push('| # | Value |');
  lines.push('|---|-------|');
  type.values.forEach((value, index) => {
    lines.push(`| ${index + 1} | ${value} |`);
  });
  lines.push('');
}

/**
 * Convert table name to markdown anchor
 */
function toAnchor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export default { generateMarkdownDocs, generateDataDictionary };
