# Runway Roadmap

## Completed Features

### Core Functionality
- [x] DDL parsing (CREATE TABLE, CREATE TYPE ENUM, CREATE SEQUENCE)
- [x] Schema visualization with React Flow
- [x] File browser with recursive folder scanning
- [x] Tabbed SQL editor with Monaco
- [x] Foreign key relationship visualization
- [x] SVG and PlantUML export

### File Management
- [x] New SQL Project (create folder)
- [x] New SQL File
- [x] File type detection (table, enum, other)
- [x] File type icons and colors in tree
- [x] Filter non-DDL files from diagram

### Editor Enhancements
- [x] Gutter icons for PRIMARY KEY and FOREIGN KEY
- [x] Ctrl+Click navigation to referenced tables
- [x] Hover tooltips on gutter icons
- [x] SQL formatting/beautify (Cmd+Shift+F)
- [x] Auto-complete table/column names from schema
- [x] Snippet templates for common DDL patterns

### Persistence
- [x] Remember last opened folder
- [x] Recent folders menu
- [x] Remember splitter positions (per-project .runway file)
- [x] Remember diagram node positions (per-project .runway file)

### Navigation & Search
- [x] Global search across all files (Cmd+Shift+F)
- [x] "Find usages" - which tables reference this table? (Alt+F7)
- [x] Go to Definition - jump from diagram to file (Cmd+G)
- [x] Breadcrumb navigation

### Documentation Generation
- [x] Export to Markdown documentation (Cmd+Shift+D)
- [x] Generate data dictionary report (Cmd+Shift+R)
- [x] Parse `COMMENT ON TABLE/COLUMN` statements
- [x] Markdown file support in file tree (prominent yellow icon)
- [x] Markdown preview in editor tabs

### Diagram Enhancements
- [x] Search/filter to highlight specific tables (toolbar filter with dimming)
- [x] Collapse/expand table nodes (click header or context menu)
- [x] Right-click context menu on nodes (Go to Definition, Find Usages, Collapse, Center, Copy Name)
- [x] Minimap toggle (toolbar button)
- [x] Different layout directions (LR, TB, RL, BT via toolbar dropdown)
- [x] Reset layout button (re-run auto-layout)

### User Preferences (Cmd+,)
- [x] User preferences dialog with tabbed UI (Editor, Diagram, General)
- [x] Editor settings: font size, tab size, word wrap, minimap, format on save
- [x] Diagram settings: default layout direction, show minimap, show edge labels, animate edges
- [x] General settings: auto-open last folder, confirm before close
- [x] Preferences stored in user data directory (applies to all projects)

### Folder/Package Grouping
- [x] Group tables by folder in diagram (UML package style)
- [x] Visual group nodes with colored borders and folder icons
- [x] Toggle button in toolbar to enable/disable grouping
- [x] Cross-group relationships shown with edges
- [x] Documentation generation organized by package/folder
- [x] Data dictionary includes package overview and breakdown

### Schema Analysis & Validation (Cmd+Shift+A)
- [x] Detect orphan tables (no relationships)
- [x] Detect circular dependencies
- [x] Naming convention checker (e.g., FK columns should end with `_id`, snake_case for tables/columns)
- [x] Warning for tables without primary key
- [x] Analysis panel with issues grouped by category (Structure, Relationships, Naming, Best Practices)
- [x] Click-to-navigate from issues to source tables

---

## Planned Features

### Schema Analysis & Validation (Remaining)
- [ ] Missing indexes on FK columns warning (requires CREATE INDEX parsing)

### Schema Diffing (Future)
- [ ] Compare current schema to a git revision
- [ ] Highlight added/removed/changed tables
- [ ] Side-by-side diff view

---

## Ideas Under Consideration

### Live Database Features
> *Currently out of scope - keeping focus on DDL-as-source-of-truth*

- Connect to PostgreSQL and visualize live schema
- Execute SQL files against database
- Reverse engineer existing database to DDL files

### Collaboration
- Export/import diagram annotations
- Shareable schema documentation links
- Team comments on tables/columns

---

## Non-Goals

These are explicitly out of scope to keep the tool focused:

- Multi-database support (PostgreSQL only)
- Views, functions, triggers, stored procedures
- Query building or data browsing
- Migration generation (use dedicated tools)
- Proprietary file formats
