# Runway Development Plan

## Phase 1: Foundation - COMPLETE

### Milestone 1.1: Project Scaffolding
- [x] Create project structure
- [x] Document project overview and architecture
- [x] Initialize npm project with dependencies
- [x] Configure Webpack for Electron + React
- [x] Set up Babel for JSX transpilation
- [x] Create Electron main process with basic window
- [x] Create preload script with IPC bridge
- [x] Create React entry point with Ant Design dark theme

### Milestone 1.2: Layout and Navigation
- [x] Implement three-pane layout (file browser, diagram, SQL tabs)
- [x] Create collapsible pane headers
- [x] Add File menu with "Open Folder" option
- [x] Style with VS Code dark theme colors

### Milestone 1.3: File Browser
- [x] Display folder tree of SQL files
- [x] File icons for .sql files
- [x] Click to open in SQL tab
- [x] Watch folder for changes
- [x] Highlight file when table selected in diagram

### Milestone 1.4: SQL Tab Viewer
- [x] Tabbed interface for open files
- [x] Monaco editor integration
- [x] SQL syntax highlighting
- [x] Dirty file indicator

### Milestone 1.5: DDL Parser
- [x] Parse CREATE TYPE (enums)
- [x] Parse CREATE SEQUENCE
- [x] Parse CREATE TABLE with columns
- [x] Parse PRIMARY KEY constraints
- [x] Parse FOREIGN KEY constraints (inline and ALTER TABLE)
- [x] Parse NOT NULL, DEFAULT, UNIQUE constraints
- [x] Build schema model from multiple files

### Milestone 1.6: Schema Diagram
- [x] React Flow integration
- [x] Table nodes showing columns with PK/FK indicators
- [x] Edge connections for foreign keys with labels
- [x] Dynamic auto-layout algorithm (dagre)
- [x] Pan and zoom controls
- [x] MiniMap navigation
- [x] Click table to highlight source file

### Milestone 1.7: Export
- [x] SVG export of diagram (File menu → Export as SVG)
- [x] PlantUML export of schema (File menu → Export as PlantUML)

## Phase 2: Editing (Future)

- Visual table creation
- Drag-drop foreign key creation
- DDL generation from schema changes
- Round-trip editing (preserve formatting)

## Phase 3: Advanced Features (Future)

- Schema comparison/diff
- Migration script generation
- Multiple schema support
- Database connection for live introspection
- Support for enum type nodes in diagram
- Support for sequence nodes in diagram

## Technical Decisions

### DDL Parsing Approach
**Updated 2026-01-20:** Using `pgsql-ast-parser` for robust AST-based parsing. Handles all PostgreSQL DDL syntax including nested parentheses, CHECK constraints, DEFAULT functions, and quoted identifiers. Previously used regex-based parsing but encountered multiple edge cases with complex DDL.

### Diagramming Library
React Flow - MIT licensed, well-maintained, good for interactive node graphs. Custom TableNode component for displaying columns with PK/FK indicators.

### Layout Algorithm
Using dagre with dynamic node heights based on column count. Configured for left-to-right layout with network-simplex ranking for better edge routing.

### State Management
React Context for schema state, editor state, and selection state. Three contexts: SchemaContext, EditorContext, SelectionContext.

### File Watching
Using chokidar via Electron main process. Re-parse schema on .sql file changes, additions, or removals.
