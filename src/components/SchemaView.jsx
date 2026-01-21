import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  SelectionMode,
  useOnSelectionChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import { useSchema } from '../contexts/SchemaContext';
import { useSelection } from '../contexts/SelectionContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import TableNode from './TableNode';
import TypeNode from './TypeNode';
import GroupNode from './GroupNode';
import DiagramToolbar from './DiagramToolbar';
import NodeContextMenu from './NodeContextMenu';
import { generatePlantUML, generateSVGFromSchema } from '../services/ExportService';

// Custom node types
const nodeTypes = {
  table: TableNode,
  type: TypeNode,
  group: GroupNode,
};

// Group layout constants
const GROUP_PADDING = 40;
const GROUP_HEADER_HEIGHT = 24;

// Layout constants
const NODE_WIDTH = 220;
const TYPE_NODE_WIDTH = 180;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 24;
const NODE_PADDING = 12;

/**
 * Calculate dynamic node height based on column count
 */
function calculateNodeHeight(table) {
  return HEADER_HEIGHT + (table.columns.length * ROW_HEIGHT) + NODE_PADDING;
}

/**
 * Calculate dynamic node height for enum types
 */
function calculateTypeHeight(type) {
  return HEADER_HEIGHT + (type.values.length * ROW_HEIGHT) + NODE_PADDING;
}

/**
 * Extract folder path from source file (relative to project root)
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
 * Group schema items by folder
 */
function groupByFolder(tables, types, projectRoot) {
  const groups = new Map();

  // Group tables
  tables.forEach(table => {
    const folder = getFolderFromSourceFile(table.sourceFile, projectRoot);
    if (!groups.has(folder)) {
      groups.set(folder, { tables: [], types: [] });
    }
    groups.get(folder).tables.push(table);
  });

  // Group types
  types.forEach(type => {
    const folder = getFolderFromSourceFile(type.sourceFile, projectRoot);
    if (!groups.has(folder)) {
      groups.set(folder, { tables: [], types: [] });
    }
    groups.get(folder).types.push(type);
  });

  return groups;
}

/**
 * Layout nodes within a group using dagre
 */
function layoutGroupContents(tables, types, schema, direction, collapsedNodes) {
  const nodes = [];
  const edges = [];

  // Create nodes for tables
  tables.forEach(table => {
    nodes.push({
      id: table.name,
      type: 'table',
      position: { x: 0, y: 0 },
    });
  });

  // Create nodes for types
  types.forEach(type => {
    nodes.push({
      id: type.name,
      type: 'type',
      position: { x: 0, y: 0 },
    });
  });

  // Create edges only for relationships within this group
  const nodeIds = new Set(nodes.map(n => n.id));
  tables.forEach(table => {
    table.foreignKeys.forEach((fk, fkIndex) => {
      if (nodeIds.has(fk.referencedTable)) {
        edges.push({
          id: `${table.name}-${fk.referencedTable}-${fkIndex}`,
          source: table.name,
          target: fk.referencedTable,
        });
      }
    });
  });

  if (nodes.length === 0) {
    return { nodes: [], width: 0, height: 0 };
  }

  // Create dagre graph for this group
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
    marginx: 10,
    marginy: 10,
  });

  // Set node dimensions
  nodes.forEach(node => {
    if (node.type === 'type') {
      const type = schema.types.find(t => t.name === node.id);
      const height = collapsedNodes[node.id] ? HEADER_HEIGHT : (type ? calculateTypeHeight(type) : 100);
      dagreGraph.setNode(node.id, { width: TYPE_NODE_WIDTH, height });
    } else {
      const table = schema.tables.find(t => t.name === node.id);
      const height = collapsedNodes[node.id] ? HEADER_HEIGHT : (table ? calculateNodeHeight(table) : 150);
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
    }
  });

  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Get positions and calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const layoutedNodes = nodes.map(node => {
    const pos = dagreGraph.node(node.id);
    let width, height;

    if (node.type === 'type') {
      const type = schema.types.find(t => t.name === node.id);
      height = collapsedNodes[node.id] ? HEADER_HEIGHT : (type ? calculateTypeHeight(type) : 100);
      width = TYPE_NODE_WIDTH;
    } else {
      const table = schema.tables.find(t => t.name === node.id);
      height = collapsedNodes[node.id] ? HEADER_HEIGHT : (table ? calculateNodeHeight(table) : 150);
      width = NODE_WIDTH;
    }

    const x = pos.x - width / 2;
    const y = pos.y - height / 2;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);

    return {
      ...node,
      position: { x, y },
      width,
      height,
    };
  });

  // Normalize positions to start from 0,0
  const normalizedNodes = layoutedNodes.map(node => ({
    ...node,
    position: {
      x: node.position.x - minX,
      y: node.position.y - minY,
    },
  }));

  return {
    nodes: normalizedNodes,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Apply dagre layout with dynamic node heights
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} schema - Parsed schema
 * @param {string} direction - Layout direction: 'LR', 'TB', 'RL', 'BT'
 * @param {Object} collapsedNodes - Map of collapsed node IDs
 */
function getLayoutedElements(nodes, edges, schema, direction = 'LR', _collapsedNodes = {}) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph with better spacing for complex schemas
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,        // Vertical spacing between nodes
    ranksep: 120,       // Horizontal spacing between ranks
    marginx: 20,
    marginy: 20,
    acyclicer: 'greedy', // Handle cycles better
    ranker: 'network-simplex', // Better ranking algorithm
  });

  // Set node dimensions based on actual content
  nodes.forEach((node) => {
    if (node.type === 'type') {
      const type = schema.types.find(t => t.name === node.id);
      const height = type ? calculateTypeHeight(type) : 100;
      dagreGraph.setNode(node.id, { width: TYPE_NODE_WIDTH, height });
    } else {
      const table = schema.tables.find(t => t.name === node.id);
      const height = table ? calculateNodeHeight(table) : 150;
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    let height, width;
    
    if (node.type === 'type') {
      const type = schema.types.find(t => t.name === node.id);
      height = type ? calculateTypeHeight(type) : 100;
      width = TYPE_NODE_WIDTH;
    } else {
      const table = schema.tables.find(t => t.name === node.id);
      height = table ? calculateNodeHeight(table) : 150;
      width = NODE_WIDTH;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Create grouped layout with folder-based grouping
 * @param {Object} schema - Parsed schema
 * @param {string} projectRoot - Project root path for relative paths
 * @param {string} direction - Layout direction
 * @param {Object} collapsedNodes - Map of collapsed node IDs
 * @param {Object} nodeData - Additional data to add to each node
 * @param {Object} edgeConfig - Edge configuration (animated, showLabels)
 */
function getGroupedLayoutElements(schema, projectRoot, direction, collapsedNodes, nodeData, edgeConfig) {
  const groups = groupByFolder(schema.tables, schema.types, projectRoot);
  const allNodes = [];
  const allEdges = [];

  // First, layout each group's contents
  const groupLayouts = new Map();
  let colorIndex = 0;

  groups.forEach((group, folderPath) => {
    const layout = layoutGroupContents(group.tables, group.types, schema, direction, collapsedNodes);
    groupLayouts.set(folderPath, {
      ...layout,
      colorIndex: colorIndex++,
      tableCount: group.tables.length,
      typeCount: group.types.length,
    });
  });

  // Now layout the groups themselves using dagre
  const groupGraph = new dagre.graphlib.Graph();
  groupGraph.setDefaultEdgeLabel(() => ({}));
  groupGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  });

  // Set group node dimensions
  groupLayouts.forEach((layout, folderPath) => {
    const width = layout.width + GROUP_PADDING * 2;
    const height = layout.height + GROUP_PADDING + GROUP_HEADER_HEIGHT;
    groupGraph.setNode(folderPath, { width, height });
  });

  // Add edges between groups based on cross-group foreign keys
  schema.tables.forEach(table => {
    const sourceFolder = getFolderFromSourceFile(table.sourceFile, projectRoot);
    table.foreignKeys.forEach(fk => {
      const targetTable = schema.tables.find(t => t.name === fk.referencedTable);
      if (targetTable) {
        const targetFolder = getFolderFromSourceFile(targetTable.sourceFile, projectRoot);
        if (sourceFolder !== targetFolder) {
          // Add edge between groups (dagre handles duplicates)
          groupGraph.setEdge(sourceFolder, targetFolder);
        }
      }
    });
  });

  dagre.layout(groupGraph);

  // Create final nodes with absolute positions
  groupLayouts.forEach((layout, folderPath) => {
    const groupPos = groupGraph.node(folderPath);
    const groupWidth = layout.width + GROUP_PADDING * 2;
    const groupHeight = layout.height + GROUP_PADDING + GROUP_HEADER_HEIGHT;

    // Calculate group's top-left position
    const groupX = groupPos.x - groupWidth / 2;
    const groupY = groupPos.y - groupHeight / 2;

    // Add group node
    allNodes.push({
      id: `group-${folderPath}`,
      type: 'group',
      position: { x: groupX, y: groupY },
      style: {
        width: groupWidth,
        height: groupHeight,
      },
      data: {
        label: folderPath,
        tableCount: layout.tableCount,
        typeCount: layout.typeCount,
        colorIndex: layout.colorIndex,
      },
      // Groups should be behind other nodes
      zIndex: -1,
    });

    // Add child nodes with offset positions
    layout.nodes.forEach(node => {
      const table = schema.tables.find(t => t.name === node.id);
      const type = schema.types.find(t => t.name === node.id);

      allNodes.push({
        id: node.id,
        type: node.type,
        position: {
          x: groupX + GROUP_PADDING + node.position.x,
          y: groupY + GROUP_HEADER_HEIGHT + node.position.y,
        },
        data: {
          ...(table ? { table } : {}),
          ...(type ? { type } : {}),
          ...nodeData,
          isCollapsed: collapsedNodes[node.id] || false,
          folder: folderPath,
        },
      });
    });
  });

  // Create all edges
  schema.tables.forEach(table => {
    table.foreignKeys.forEach((fk, fkIndex) => {
      const edgeLabel = edgeConfig.showLabels
        ? (fk.constraintName || fk.columns.join(', '))
        : undefined;

      allEdges.push({
        id: `${table.name}-${fk.referencedTable}-${fkIndex}`,
        source: table.name,
        target: fk.referencedTable,
        type: 'smoothstep',
        animated: edgeConfig.animated,
        style: { stroke: '#6997d5', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#6997d5',
        },
        label: edgeLabel,
        labelStyle: { fill: '#888', fontSize: 10 },
        labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.8 },
      });
    });
  });

  return { nodes: allNodes, edges: allEdges };
}

function SchemaViewInner({ onTableSelect, onGoToDefinition, onFindUsages, projectRoot }) {
  const { schema, isLoading, error } = useSchema();
  const { selectTable, selectedTable } = useSelection();
  const { settings, updateNodePositions, isLoaded: settingsLoaded } = useProjectSettings();
  const { preferences } = useUserPreferences();
  const { fitView, setCenter } = useReactFlow();
  const nodePositionsRef = useRef({});
  const prevSelectedTableRef = useRef(null);
  const isInitialLayoutRef = useRef(true);
  const prefsInitializedRef = useRef(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Diagram enhancement state - initialize from preferences
  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [filterQuery, setFilterQuery] = useState('');
  const [layoutDirection, setLayoutDirection] = useState(preferences.diagram.defaultLayout);
  const [showMinimap, setShowMinimap] = useState(preferences.diagram.showMinimap);
  const [groupByFolder, setGroupByFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, node }
  const [selectedNodes, setSelectedNodes] = useState([]); // Track selected nodes for alignment

  // Track selection changes for alignment tools
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      // Filter out group nodes from selection (can't align groups)
      const selectableNodes = nodes.filter(n => n.type !== 'group');
      setSelectedNodes(selectableNodes);
    },
  });

  // Update state when preferences change (only on initial load)
  useEffect(() => {
    if (!prefsInitializedRef.current && preferences) {
      setLayoutDirection(preferences.diagram.defaultLayout);
      setShowMinimap(preferences.diagram.showMinimap);
      prefsInitializedRef.current = true;
    }
  }, [preferences]);

  // Toggle collapse for a specific node
  const handleToggleCollapse = useCallback((nodeId) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  // Check if a node matches the filter
  const matchesFilter = useCallback((name) => {
    if (!filterQuery) return null; // null means no filtering active
    return name.toLowerCase().includes(filterQuery.toLowerCase());
  }, [filterQuery]);

  // Convert schema to React Flow nodes and edges
  const { schemaNodes, schemaEdges } = useMemo(() => {
    // When grouping by folder, use the grouped layout function
    if (groupByFolder && schema.tables.length > 0) {
      const nodeData = {
        isSelected: false,
        onToggleCollapse: handleToggleCollapse,
      };
      const edgeConfig = {
        animated: preferences.diagram.animateEdges,
        showLabels: preferences.diagram.showEdgeLabels,
      };

      const result = getGroupedLayoutElements(
        schema,
        projectRoot,
        layoutDirection,
        collapsedNodes,
        nodeData,
        edgeConfig
      );

      // Add selection state and filter state to nodes
      const nodesWithState = result.nodes.map(node => {
        if (node.type === 'group') return node;
        return {
          ...node,
          data: {
            ...node.data,
            isSelected: selectedTable === node.id,
            isFiltered: matchesFilter(node.id),
          },
        };
      });

      return { schemaNodes: nodesWithState, schemaEdges: result.edges };
    }

    // Standard non-grouped layout
    const schemaNodes = [];
    const schemaEdges = [];

    // Add table nodes
    schema.tables.forEach((table) => {
      schemaNodes.push({
        id: table.name,
        type: 'table',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          table,
          isSelected: selectedTable === table.name,
          isCollapsed: collapsedNodes[table.name] || false,
          isFiltered: matchesFilter(table.name),
          onToggleCollapse: handleToggleCollapse,
        },
      });

      // Add edges for foreign keys
      table.foreignKeys.forEach((fk, fkIndex) => {
        const edgeLabel = preferences.diagram.showEdgeLabels
          ? (fk.constraintName || fk.columns.join(', '))
          : undefined;

        schemaEdges.push({
          id: `${table.name}-${fk.referencedTable}-${fkIndex}`,
          source: table.name,
          target: fk.referencedTable,
          type: 'smoothstep',
          animated: preferences.diagram.animateEdges,
          style: { stroke: '#6997d5', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6997d5',
          },
          label: edgeLabel,
          labelStyle: { fill: '#888', fontSize: 10 },
          labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.8 },
        });
      });
    });

    // Add type (enum) nodes
    schema.types.forEach((type) => {
      schemaNodes.push({
        id: type.name,
        type: 'type',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          type,
          isSelected: false,
          isCollapsed: collapsedNodes[type.name] || false,
          isFiltered: matchesFilter(type.name),
          onToggleCollapse: handleToggleCollapse,
        },
      });
    });

    return { schemaNodes, schemaEdges };
  }, [schema, selectedTable, collapsedNodes, matchesFilter, handleToggleCollapse, preferences, groupByFolder, projectRoot, layoutDirection]);

  // Apply layout when schema changes
  useEffect(() => {
    if (schemaNodes.length > 0 && settingsLoaded) {
      let layoutedNodes;

      // When grouping by folder, nodes already have positions from getGroupedLayoutElements
      if (groupByFolder) {
        layoutedNodes = schemaNodes;
        console.log('[SchemaView] Applied grouped layout');
      } else {
        // Check if we have saved positions for all nodes
        const savedPositions = settings.nodePositions || {};
        const allNodesHavePositions = schemaNodes.every(node => savedPositions[node.id]);

        if (allNodesHavePositions && Object.keys(savedPositions).length > 0) {
          // Apply saved positions
          layoutedNodes = schemaNodes.map(node => ({
            ...node,
            position: savedPositions[node.id],
          }));
          console.log('[SchemaView] Applied saved positions');
        } else {
          // Use dagre layout for new/changed schema
          const result = getLayoutedElements(schemaNodes, schemaEdges, schema, layoutDirection, collapsedNodes);
          layoutedNodes = result.nodes;
          console.log('[SchemaView] Applied dagre layout');
        }
      }

      setNodes(layoutedNodes);
      setEdges(schemaEdges);

      // Store positions for export (skip group nodes)
      const positions = {};
      layoutedNodes.forEach(node => {
        if (node.type !== 'group') {
          positions[node.id] = node.position;
        }
      });
      nodePositionsRef.current = positions;
      isInitialLayoutRef.current = false;
    } else if (schemaNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      nodePositionsRef.current = {};
      isInitialLayoutRef.current = true;
    }
  }, [schemaNodes, schemaEdges, schema, setNodes, setEdges, settings.nodePositions, settingsLoaded, layoutDirection, collapsedNodes, groupByFolder]);

  // Focus on selected table when selection changes
  useEffect(() => {
    if (selectedTable && selectedTable !== prevSelectedTableRef.current) {
      const node = nodes.find(n => n.id === selectedTable);
      if (node && node.position) {
        // Calculate the center of the node
        let height, width;
        if (node.type === 'type') {
          const type = schema.types.find(t => t.name === selectedTable);
          height = type ? calculateTypeHeight(type) : 100;
          width = TYPE_NODE_WIDTH;
        } else {
          const table = schema.tables.find(t => t.name === selectedTable);
          height = table ? calculateNodeHeight(table) : 150;
          width = NODE_WIDTH;
        }
        
        const centerX = node.position.x + width / 2;
        const centerY = node.position.y + height / 2;
        
        // Center the view on this node with animation
        setCenter(centerX, centerY, { zoom: 1, duration: 400 });
      }
      prevSelectedTableRef.current = selectedTable;
    }
  }, [selectedTable, nodes, schema, setCenter]);

  // Handle export commands from menu
  useEffect(() => {
    if (!window.electron) return;

    const handleExportSvg = async () => {
      if (schema.tables.length === 0) return;

      try {
        const svg = generateSVGFromSchema(schema, nodePositionsRef.current);
        await window.electron.saveSvg(svg);
      } catch (err) {
        console.error('SVG export failed:', err);
      }
    };

    const handleExportPlantuml = async () => {
      if (schema.tables.length === 0) return;

      try {
        const plantuml = generatePlantUML(schema);
        await window.electron.savePlantuml(plantuml);
      } catch (err) {
        console.error('PlantUML export failed:', err);
      }
    };

    const handleFitDiagram = () => {
      fitView({ padding: 0.2, duration: 200 });
    };

    window.electron.onExportSvg(handleExportSvg);
    window.electron.onExportPlantuml(handleExportPlantuml);
    window.electron.onFitDiagram(handleFitDiagram);
  }, [schema, fitView]);

  // Handle node position changes - save when drag ends
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);

    // Check if any node positions changed (drag end)
    const positionChanges = changes.filter(
      change => change.type === 'position' && change.dragging === false
    );

    if (positionChanges.length > 0) {
      // Collect all current positions
      setNodes(currentNodes => {
        const positions = {};
        currentNodes.forEach(node => {
          positions[node.id] = node.position;
        });
        nodePositionsRef.current = positions;
        // Save to project settings
        updateNodePositions(positions);
        return currentNodes;
      });
    }
  }, [onNodesChange, updateNodePositions, setNodes]);

  // Handle node click - select table and notify parent
  const onNodeClick = useCallback((event, node) => {
    // Close context menu if open
    setContextMenu(null);

    selectTable(node.id);

    // Find the table and notify parent to highlight in file tree
    const table = schema.tables.find(t => t.name === node.id);
    if (table && onTableSelect) {
      onTableSelect(table.name, table.sourceFile);
    }
  }, [selectTable, schema, onTableSelect]);

  // Handle right-click context menu
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu: Go to Definition
  const handleGoToDefinition = useCallback(() => {
    if (!contextMenu?.node) return;
    const nodeId = contextMenu.node.id;
    const table = schema.tables.find(t => t.name === nodeId);
    const type = schema.types.find(t => t.name === nodeId);

    if (table && onGoToDefinition) {
      onGoToDefinition(table.name, table.sourceFile);
    } else if (type && onGoToDefinition) {
      onGoToDefinition(type.name, type.sourceFile);
    }
  }, [contextMenu, schema, onGoToDefinition]);

  // Context menu: Find Usages
  const handleFindUsages = useCallback(() => {
    if (!contextMenu?.node) return;
    const nodeId = contextMenu.node.id;
    if (onFindUsages) {
      onFindUsages(nodeId);
    }
  }, [contextMenu, onFindUsages]);

  // Context menu: Toggle Collapse
  const handleContextToggleCollapse = useCallback(() => {
    if (!contextMenu?.node) return;
    handleToggleCollapse(contextMenu.node.id);
  }, [contextMenu, handleToggleCollapse]);

  // Context menu: Center on Node
  const handleCenterOnNode = useCallback(() => {
    if (!contextMenu?.node) return;
    const node = nodes.find(n => n.id === contextMenu.node.id);
    if (node && node.position) {
      let height, width;
      if (node.type === 'type') {
        const type = schema.types.find(t => t.name === node.id);
        height = type ? calculateTypeHeight(type) : 100;
        width = TYPE_NODE_WIDTH;
      } else {
        const table = schema.tables.find(t => t.name === node.id);
        height = table ? calculateNodeHeight(table) : 150;
        width = NODE_WIDTH;
      }
      const centerX = node.position.x + width / 2;
      const centerY = node.position.y + height / 2;
      setCenter(centerX, centerY, { zoom: 1.2, duration: 400 });
    }
  }, [contextMenu, nodes, schema, setCenter]);

  // Context menu: Copy Name
  const handleCopyName = useCallback(() => {
    if (!contextMenu?.node) return;
    navigator.clipboard.writeText(contextMenu.node.id);
  }, [contextMenu]);

  // Toolbar: Search/filter
  const handleSearch = useCallback((query) => {
    setFilterQuery(query);
  }, []);

  // Toolbar: Layout change
  const handleLayoutChange = useCallback((direction) => {
    setLayoutDirection(direction);
    // Force re-layout by clearing saved positions temporarily
    const result = getLayoutedElements(schemaNodes, schemaEdges, schema, direction, collapsedNodes);
    setNodes(result.nodes);

    // Update positions ref and save
    const positions = {};
    result.nodes.forEach(node => {
      positions[node.id] = node.position;
    });
    nodePositionsRef.current = positions;
    updateNodePositions(positions);
  }, [schemaNodes, schemaEdges, schema, collapsedNodes, setNodes, updateNodePositions]);

  // Toolbar: Reset layout
  const handleResetLayout = useCallback(() => {
    const result = getLayoutedElements(schemaNodes, schemaEdges, schema, layoutDirection, collapsedNodes);
    setNodes(result.nodes);

    // Update positions ref and save
    const positions = {};
    result.nodes.forEach(node => {
      positions[node.id] = node.position;
    });
    nodePositionsRef.current = positions;
    updateNodePositions(positions);

    // Fit view after layout
    setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
  }, [schemaNodes, schemaEdges, schema, layoutDirection, collapsedNodes, setNodes, updateNodePositions, fitView]);

  // Toolbar: Toggle minimap
  const handleToggleMinimap = useCallback(() => {
    setShowMinimap(prev => !prev);
  }, []);

  // Toolbar: Toggle group by folder
  const handleToggleGroupByFolder = useCallback(() => {
    setGroupByFolder(prev => !prev);
  }, []);

  // Toolbar: Collapse/expand all
  const handleToggleAllCollapsed = useCallback(() => {
    const allIds = [...schema.tables.map(t => t.name), ...schema.types.map(t => t.name)];
    const allCollapsed = allIds.every(id => collapsedNodes[id]);

    if (allCollapsed) {
      // Expand all
      setCollapsedNodes({});
    } else {
      // Collapse all
      const newCollapsed = {};
      allIds.forEach(id => { newCollapsed[id] = true; });
      setCollapsedNodes(newCollapsed);
    }
  }, [schema, collapsedNodes]);

  // Check if all nodes are collapsed
  const allNodesCollapsed = useMemo(() => {
    const allIds = [...schema.tables.map(t => t.name), ...schema.types.map(t => t.name)];
    return allIds.length > 0 && allIds.every(id => collapsedNodes[id]);
  }, [schema, collapsedNodes]);

  // Helper to get node dimensions
  const getNodeDimensions = useCallback((nodeId) => {
    const table = schema.tables.find(t => t.name === nodeId);
    const type = schema.types.find(t => t.name === nodeId);
    if (type) {
      return { width: TYPE_NODE_WIDTH, height: calculateTypeHeight(type) };
    }
    if (table) {
      return { width: NODE_WIDTH, height: calculateNodeHeight(table) };
    }
    return { width: NODE_WIDTH, height: 150 };
  }, [schema]);

  // Alignment functions
  const handleAlign = useCallback((alignment) => {
    if (selectedNodes.length < 2) return;

    // Get current node positions and dimensions
    const nodeData = selectedNodes.map(node => {
      const currentNode = nodes.find(n => n.id === node.id);
      const dims = getNodeDimensions(node.id);
      return {
        id: node.id,
        x: currentNode?.position?.x || 0,
        y: currentNode?.position?.y || 0,
        width: dims.width,
        height: dims.height,
      };
    });

    // Calculate new positions based on alignment
    const newPositions = {};

    switch (alignment) {
      case 'left': {
        const minX = Math.min(...nodeData.map(n => n.x));
        nodeData.forEach(n => { newPositions[n.id] = { x: minX, y: n.y }; });
        break;
      }
      case 'right': {
        const maxRight = Math.max(...nodeData.map(n => n.x + n.width));
        nodeData.forEach(n => { newPositions[n.id] = { x: maxRight - n.width, y: n.y }; });
        break;
      }
      case 'top': {
        const minY = Math.min(...nodeData.map(n => n.y));
        nodeData.forEach(n => { newPositions[n.id] = { x: n.x, y: minY }; });
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...nodeData.map(n => n.y + n.height));
        nodeData.forEach(n => { newPositions[n.id] = { x: n.x, y: maxBottom - n.height }; });
        break;
      }
      case 'centerH': {
        // Align centers horizontally (same X center)
        const avgCenterX = nodeData.reduce((sum, n) => sum + n.x + n.width / 2, 0) / nodeData.length;
        nodeData.forEach(n => { newPositions[n.id] = { x: avgCenterX - n.width / 2, y: n.y }; });
        break;
      }
      case 'centerV': {
        // Align centers vertically (same Y center)
        const avgCenterY = nodeData.reduce((sum, n) => sum + n.y + n.height / 2, 0) / nodeData.length;
        nodeData.forEach(n => { newPositions[n.id] = { x: n.x, y: avgCenterY - n.height / 2 }; });
        break;
      }
      case 'distributeH': {
        // Distribute horizontally with equal spacing
        if (nodeData.length < 3) return;
        const sorted = [...nodeData].sort((a, b) => a.x - b.x);
        const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
        const leftmost = sorted[0].x;
        const rightmost = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
        const totalSpace = rightmost - leftmost - totalWidth;
        const gap = totalSpace / (sorted.length - 1);

        let currentX = leftmost;
        sorted.forEach((n) => {
          newPositions[n.id] = { x: currentX, y: n.y };
          currentX += n.width + gap;
        });
        break;
      }
      case 'distributeV': {
        // Distribute vertically with equal spacing
        if (nodeData.length < 3) return;
        const sorted = [...nodeData].sort((a, b) => a.y - b.y);
        const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
        const topmost = sorted[0].y;
        const bottommost = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
        const totalSpace = bottommost - topmost - totalHeight;
        const gap = totalSpace / (sorted.length - 1);

        let currentY = topmost;
        sorted.forEach((n) => {
          newPositions[n.id] = { x: n.x, y: currentY };
          currentY += n.height + gap;
        });
        break;
      }
    }

    // Apply new positions to nodes
    setNodes(currentNodes =>
      currentNodes.map(node => {
        if (newPositions[node.id]) {
          return { ...node, position: newPositions[node.id] };
        }
        return node;
      })
    );

    // Save positions
    setTimeout(() => {
      setNodes(currentNodes => {
        const positions = {};
        currentNodes.forEach(node => {
          if (node.type !== 'group') {
            positions[node.id] = node.position;
          }
        });
        nodePositionsRef.current = positions;
        updateNodePositions(positions);
        return currentNodes;
      });
    }, 0);
  }, [selectedNodes, nodes, getNodeDimensions, setNodes, updateNodePositions]);

  // Handle pane click to close context menu
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (isLoading) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="title">Parsing DDL files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="title" style={{ color: '#f44' }}>Parse Error</div>
        <div className="subtitle">{error}</div>
      </div>
    );
  }

  if (schema.tables.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="title">No tables found</div>
        <div className="subtitle">
          Open a folder containing PostgreSQL DDL files to visualize the schema
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DiagramToolbar
        onSearch={handleSearch}
        onLayoutChange={handleLayoutChange}
        onResetLayout={handleResetLayout}
        onToggleMinimap={handleToggleMinimap}
        onToggleCollapsed={handleToggleAllCollapsed}
        onToggleGroupByFolder={handleToggleGroupByFolder}
        onAlign={handleAlign}
        currentLayout={layoutDirection}
        showMinimap={showMinimap}
        allCollapsed={allNodesCollapsed}
        groupByFolder={groupByFolder}
        tableCount={schema.tables.length}
        typeCount={schema.types.length}
        selectedCount={selectedNodes.length}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          selectionOnDrag={true}
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1, 2]}
          selectNodesOnDrag={true}
        >
          <Background color="#333" gap={20} />
          <Controls />
          {showMinimap && (
            <MiniMap
              nodeColor={(node) => node.id === selectedTable ? '#f5c518' : '#0e639c'}
              maskColor="rgba(0, 0, 0, 0.8)"
            />
          )}
        </ReactFlow>

        {/* Context Menu */}
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            isCollapsed={collapsedNodes[contextMenu.node?.id]}
            onClose={handleCloseContextMenu}
            onGoToDefinition={handleGoToDefinition}
            onFindUsages={handleFindUsages}
            onToggleCollapse={handleContextToggleCollapse}
            onCenterOnNode={handleCenterOnNode}
            onCopyName={handleCopyName}
          />
        )}
      </div>
    </div>
  );
}

// Wrapper component that provides ReactFlow context
function SchemaView({ onTableSelect, onGoToDefinition, onFindUsages, projectRoot }) {
  return (
    <ReactFlowProvider>
      <SchemaViewInner
        onTableSelect={onTableSelect}
        onGoToDefinition={onGoToDefinition}
        onFindUsages={onFindUsages}
        projectRoot={projectRoot}
      />
    </ReactFlowProvider>
  );
}

export default SchemaView;
