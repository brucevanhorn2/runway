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
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import { useSchema } from '../contexts/SchemaContext';
import { useSelection } from '../contexts/SelectionContext';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import TableNode from './TableNode';
import TypeNode from './TypeNode';
import DiagramToolbar from './DiagramToolbar';
import NodeContextMenu from './NodeContextMenu';
import { generatePlantUML, generateSVGFromSchema } from '../services/ExportService';

// Custom node types
const nodeTypes = {
  table: TableNode,
  type: TypeNode,
};

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
 * Apply dagre layout with dynamic node heights
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} schema - Parsed schema
 * @param {string} direction - Layout direction: 'LR', 'TB', 'RL', 'BT'
 * @param {Object} collapsedNodes - Map of collapsed node IDs
 */
function getLayoutedElements(nodes, edges, schema, direction = 'LR', collapsedNodes = {}) {
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

function SchemaViewInner({ onTableSelect, onGoToDefinition, onFindUsages }) {
  const { schema, isLoading, error } = useSchema();
  const { selectTable, selectedTable } = useSelection();
  const { settings, updateNodePositions, isLoaded: settingsLoaded } = useProjectSettings();
  const { preferences } = useUserPreferences();
  const { fitView, setCenter, getNodes } = useReactFlow();
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
  const [contextMenu, setContextMenu] = useState(null); // { x, y, node }

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
  }, [schema, selectedTable, collapsedNodes, matchesFilter, handleToggleCollapse, preferences]);

  // Apply layout when schema changes
  useEffect(() => {
    if (schemaNodes.length > 0 && settingsLoaded) {
      // Check if we have saved positions for all nodes
      const savedPositions = settings.nodePositions || {};
      const allNodesHavePositions = schemaNodes.every(node => savedPositions[node.id]);

      let layoutedNodes;
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

      setNodes(layoutedNodes);
      setEdges(schemaEdges);

      // Store positions for export
      const positions = {};
      layoutedNodes.forEach(node => {
        positions[node.id] = node.position;
      });
      nodePositionsRef.current = positions;
      isInitialLayoutRef.current = false;
    } else if (schemaNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      nodePositionsRef.current = {};
      isInitialLayoutRef.current = true;
    }
  }, [schemaNodes, schemaEdges, schema, setNodes, setEdges, settings.nodePositions, settingsLoaded, layoutDirection, collapsedNodes]);

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
        currentLayout={layoutDirection}
        showMinimap={showMinimap}
        allCollapsed={allNodesCollapsed}
        tableCount={schema.tables.length}
        typeCount={schema.types.length}
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
function SchemaView({ onTableSelect, onGoToDefinition, onFindUsages }) {
  return (
    <ReactFlowProvider>
      <SchemaViewInner
        onTableSelect={onTableSelect}
        onGoToDefinition={onGoToDefinition}
        onFindUsages={onFindUsages}
      />
    </ReactFlowProvider>
  );
}

export default SchemaView;
