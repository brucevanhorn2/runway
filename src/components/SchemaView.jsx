import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import TableNode from './TableNode';
import TypeNode from './TypeNode';
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
 */
function getLayoutedElements(nodes, edges, schema) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph with better spacing for complex schemas
  dagreGraph.setGraph({
    rankdir: 'LR',      // Left to right layout
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

function SchemaViewInner({ onTableSelect }) {
  const { schema, isLoading, error } = useSchema();
  const { selectTable, selectedTable } = useSelection();
  const { fitView, setCenter } = useReactFlow();
  const nodePositionsRef = useRef({});
  const prevSelectedTableRef = useRef(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
        },
      });

      // Add edges for foreign keys
      table.foreignKeys.forEach((fk, fkIndex) => {
        schemaEdges.push({
          id: `${table.name}-${fk.referencedTable}-${fkIndex}`,
          source: table.name,
          target: fk.referencedTable,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#6997d5', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#6997d5',
          },
          label: fk.constraintName || fk.columns.join(', '),
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
          isSelected: false, // TODO: add type selection support
        },
      });
    });

    return { schemaNodes, schemaEdges };
  }, [schema, selectedTable]);

  // Apply layout when schema changes
  useEffect(() => {
    if (schemaNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        schemaNodes,
        schemaEdges,
        schema
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Store positions for export
      const positions = {};
      layoutedNodes.forEach(node => {
        positions[node.id] = node.position;
      });
      nodePositionsRef.current = positions;
    } else {
      setNodes([]);
      setEdges([]);
      nodePositionsRef.current = {};
    }
  }, [schemaNodes, schemaEdges, schema, setNodes, setEdges]);

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

  // Handle node click - select table and notify parent
  const onNodeClick = useCallback((event, node) => {
    selectTable(node.id);

    // Find the table and notify parent to highlight in file tree
    const table = schema.tables.find(t => t.name === node.id);
    if (table && onTableSelect) {
      onTableSelect(table.name, table.sourceFile);
    }
  }, [selectTable, schema, onTableSelect]);

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
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
    >
      <Background color="#333" gap={20} />
      <Controls />
      <MiniMap
        nodeColor={(node) => node.id === selectedTable ? '#f5c518' : '#0e639c'}
        maskColor="rgba(0, 0, 0, 0.8)"
      />
    </ReactFlow>
  );
}

// Wrapper component that provides ReactFlow context
function SchemaView({ onTableSelect }) {
  return (
    <ReactFlowProvider>
      <SchemaViewInner onTableSelect={onTableSelect} />
    </ReactFlowProvider>
  );
}

export default SchemaView;
