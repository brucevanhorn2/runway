/**
 * Documentation Generator
 *
 * Generates markdown documentation and data dictionary reports from schema.
 */

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
  } = options;

  const lines = [];

  // Title
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');

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

  lines.push('---');
  lines.push('');

  // Tables
  if (schema.tables.length > 0) {
    lines.push('## Tables');
    lines.push('');

    for (const table of schema.tables) {
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
  }

  // Enums
  if (includeEnums && schema.types.length > 0) {
    lines.push('## Enum Types');
    lines.push('');

    for (const type of schema.types) {
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
 * Generate Data Dictionary report
 * @param {Object} schema - The parsed schema object
 * @returns {string} Markdown content
 */
export function generateDataDictionary(schema) {
  const lines = [];

  lines.push('# Data Dictionary');
  lines.push('');
  lines.push(`*Generated on ${new Date().toLocaleDateString()}*`);
  lines.push('');

  // Summary statistics
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Tables:** ${schema.tables.length}`);
  lines.push(`- **Enum Types:** ${schema.types.length}`);
  lines.push(`- **Sequences:** ${schema.sequences.length}`);

  const totalColumns = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);
  const totalFKs = schema.tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
  lines.push(`- **Total Columns:** ${totalColumns}`);
  lines.push(`- **Total Foreign Keys:** ${totalFKs}`);
  lines.push('');

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

  // Detailed Table Definitions
  lines.push('## Detailed Table Definitions');
  lines.push('');

  for (const table of schema.tables) {
    lines.push(`### ${table.name}`);
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

  // Enum Types Detail
  if (schema.types.length > 0) {
    lines.push('## Enum Types Detail');
    lines.push('');

    for (const type of schema.types) {
      lines.push(`### ${type.name}`);
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
  }

  return lines.join('\n');
}

/**
 * Convert table name to markdown anchor
 */
function toAnchor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export default { generateMarkdownDocs, generateDataDictionary };
