/**
 * Export Service
 * Handles exporting schema diagrams to SVG and PlantUML formats
 */

/**
 * Generate PlantUML representation of the schema
 * @param {Object} schema - The parsed schema object
 * @returns {string} PlantUML content
 */
export function generatePlantUML(schema) {
  const lines = [
    '@startuml',
    '!theme plain',
    'skinparam linetype ortho',
    'skinparam backgroundColor #1e1e1e',
    'skinparam ClassBackgroundColor #252526',
    'skinparam ClassBorderColor #444444',
    'skinparam ClassFontColor #d4d4d4',
    'skinparam ClassAttributeFontColor #d4d4d4',
    'skinparam ArrowColor #6997d5',
    '',
    "' Tables",
  ];

  // Generate entity for each table
  for (const table of schema.tables) {
    lines.push(`entity "${table.name}" {`);

    // Primary key columns first
    for (const col of table.columns) {
      if (table.primaryKey.includes(col.name)) {
        const nullable = col.nullable ? '' : ' <<not null>>';
        lines.push(`  * ${col.name} : ${col.dataType}${nullable} <<PK>>`);
      }
    }

    // Separator if we have PK columns
    if (table.primaryKey.length > 0) {
      lines.push('  --');
    }

    // Other columns
    for (const col of table.columns) {
      if (!table.primaryKey.includes(col.name)) {
        const nullable = col.nullable ? '' : ' <<not null>>';
        const fkMarker = table.foreignKeys.some(fk => fk.columns.includes(col.name)) ? ' <<FK>>' : '';
        lines.push(`  ${col.name} : ${col.dataType}${nullable}${fkMarker}`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  // Generate enum types
  if (schema.types.length > 0) {
    lines.push("' Enum Types");
    for (const type of schema.types) {
      lines.push(`enum "${type.name}" {`);
      for (const value of type.values) {
        lines.push(`  ${value}`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Generate relationships
  lines.push("' Relationships");
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      // Use ||--o{ for one-to-many (most common FK relationship)
      const label = fk.constraintName || fk.columns.join(', ');
      lines.push(`"${fk.referencedTable}" ||--o{ "${table.name}" : "${label}"`);
    }
  }

  lines.push('');
  lines.push('@enduml');

  return lines.join('\n');
}

/**
 * Generate SVG from React Flow viewport
 * This captures the current diagram as SVG
 * @param {HTMLElement} flowElement - The React Flow container element
 * @returns {string} SVG content
 */
export function generateSVG(flowElement) {
  if (!flowElement) {
    throw new Error('No diagram element provided');
  }

  // Find the React Flow viewport
  const viewport = flowElement.querySelector('.react-flow__viewport');
  if (!viewport) {
    throw new Error('Could not find React Flow viewport');
  }

  // Get the bounding box of all nodes
  const nodes = flowElement.querySelectorAll('.react-flow__node');
  const edges = flowElement.querySelectorAll('.react-flow__edge');

  if (nodes.length === 0) {
    throw new Error('No nodes to export');
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    const flowRect = flowElement.getBoundingClientRect();

    const x = rect.left - flowRect.left;
    const y = rect.top - flowRect.top;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + rect.width);
    maxY = Math.max(maxY, y + rect.height);
  });

  // Add padding
  const padding = 40;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const width = maxX - minX;
  const height = maxY - minY;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // Add background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#1e1e1e');
  svg.appendChild(bg);

  // Add styles
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    .table-node { fill: #252526; stroke: #444; stroke-width: 1; }
    .table-header { fill: #0e639c; }
    .table-name { fill: #ffffff; font-family: sans-serif; font-size: 12px; font-weight: bold; }
    .column-name { fill: #d4d4d4; font-family: sans-serif; font-size: 11px; }
    .column-type { fill: #888888; font-family: sans-serif; font-size: 10px; }
    .pk-icon { fill: #f5c518; }
    .fk-icon { fill: #6997d5; }
    .edge { stroke: #6997d5; stroke-width: 2; fill: none; }
    .edge-arrow { fill: #6997d5; }
  `;
  svg.appendChild(style);

  // Clone and transform the viewport content
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('transform', `translate(${-minX}, ${-minY})`);

  // Convert nodes to SVG
  nodes.forEach(node => {
    const nodeRect = node.getBoundingClientRect();
    const flowRect = flowElement.getBoundingClientRect();
    const x = nodeRect.left - flowRect.left;
    const y = nodeRect.top - flowRect.top;

    const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeG.setAttribute('transform', `translate(${x}, ${y})`);

    // Node background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'table-node');
    rect.setAttribute('width', nodeRect.width);
    rect.setAttribute('height', nodeRect.height);
    rect.setAttribute('rx', '4');
    nodeG.appendChild(rect);

    // Extract text content from the node
    const header = node.querySelector('[style*="background: rgb(14, 99, 156)"]') ||
                   node.querySelector('[style*="background:#0e639c"]');
    if (header) {
      const headerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      headerRect.setAttribute('class', 'table-header');
      headerRect.setAttribute('width', nodeRect.width);
      headerRect.setAttribute('height', '30');
      headerRect.setAttribute('rx', '4');
      nodeG.appendChild(headerRect);

      const tableName = header.textContent.trim();
      const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameText.setAttribute('class', 'table-name');
      nameText.setAttribute('x', '30');
      nameText.setAttribute('y', '20');
      nameText.textContent = tableName;
      nodeG.appendChild(nameText);
    }

    g.appendChild(nodeG);
  });

  // Convert edges to SVG paths
  edges.forEach(edge => {
    const path = edge.querySelector('path');
    if (path) {
      const clonedPath = path.cloneNode(true);
      clonedPath.setAttribute('class', 'edge');
      g.appendChild(clonedPath);
    }
  });

  svg.appendChild(g);

  // Serialize to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

/**
 * Alternative: Generate SVG directly from schema data (more reliable)
 * @param {Object} schema - The parsed schema
 * @param {Object} layout - Node positions { tableName: { x, y } }
 * @returns {string} SVG content
 */
export function generateSVGFromSchema(schema, layout) {
  const nodeWidth = 220;
  const headerHeight = 30;
  const rowHeight = 22;
  const padding = 40;

  // Calculate node heights
  const nodeHeights = {};
  schema.tables.forEach(table => {
    nodeHeights[table.name] = headerHeight + (table.columns.length * rowHeight) + 8;
  });

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  Object.entries(layout).forEach(([name, pos]) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + (nodeHeights[name] || 100));
  });

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .table-bg { fill: #252526; stroke: #444; stroke-width: 1; }
    .table-header { fill: #0e639c; }
    .table-name { fill: #ffffff; font-family: -apple-system, sans-serif; font-size: 12px; font-weight: bold; }
    .column-row { fill: none; }
    .column-name { fill: #d4d4d4; font-family: -apple-system, sans-serif; font-size: 11px; }
    .column-type { fill: #888888; font-family: -apple-system, sans-serif; font-size: 10px; }
    .column-required { fill: #f44336; font-size: 10px; }
    .pk-marker { fill: #f5c518; font-size: 9px; }
    .fk-marker { fill: #6997d5; font-size: 9px; }
    .edge { stroke: #6997d5; stroke-width: 2; fill: none; }
    .edge-marker { fill: #6997d5; }
  </style>
  <rect width="100%" height="100%" fill="#1e1e1e"/>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" class="edge-marker"/>
    </marker>
  </defs>
  <g transform="translate(${offsetX}, ${offsetY})">`;

  // Draw edges first (so they're behind nodes)
  schema.tables.forEach(table => {
    const sourcePos = layout[table.name];
    if (!sourcePos) return;

    table.foreignKeys.forEach(fk => {
      const targetPos = layout[fk.referencedTable];
      if (!targetPos) return;

      const sourceX = sourcePos.x + nodeWidth;
      const sourceY = sourcePos.y + headerHeight + 10;
      const targetX = targetPos.x;
      const targetY = targetPos.y + headerHeight + 10;

      // Draw curved edge
      const midX = (sourceX + targetX) / 2;
      svg += `
    <path class="edge" d="M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}" marker-end="url(#arrowhead)"/>`;
    });
  });

  // Draw nodes
  schema.tables.forEach(table => {
    const pos = layout[table.name];
    if (!pos) return;

    const nodeHeight = nodeHeights[table.name];

    svg += `
    <g transform="translate(${pos.x}, ${pos.y})">
      <rect class="table-bg" width="${nodeWidth}" height="${nodeHeight}" rx="4"/>
      <rect class="table-header" width="${nodeWidth}" height="${headerHeight}" rx="4"/>
      <rect class="table-header" y="4" width="${nodeWidth}" height="${headerHeight - 4}"/>
      <text class="table-name" x="12" y="20">${escapeXml(table.name)}</text>`;

    table.columns.forEach((col, i) => {
      const y = headerHeight + (i * rowHeight) + 16;
      const isPK = table.primaryKey.includes(col.name);
      const isFK = table.foreignKeys.some(fk => fk.columns.includes(col.name));

      svg += `
      <text class="column-name" x="12" y="${y}">${isPK ? '🔑 ' : isFK ? '🔗 ' : ''}${escapeXml(col.name)}</text>
      <text class="column-type" x="${nodeWidth - 8}" y="${y}" text-anchor="end">${escapeXml(col.dataType)}${!col.nullable ? '*' : ''}</text>`;
    });

    svg += `
    </g>`;
  });

  svg += `
  </g>
</svg>`;

  return svg;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default { generatePlantUML, generateSVG, generateSVGFromSchema };
