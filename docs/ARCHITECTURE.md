# Runway Architecture

## Application Structure

```
runway/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # Context bridge for IPC
│   ├── index.js                # React entry point
│   ├── App.jsx                 # Root component with theme
│   ├── Layout.jsx              # Three-pane layout
│   ├── Layout.css              # Dark theme styles
│   │
│   ├── components/
│   │   ├── FileTree.jsx        # DDL folder browser (left pane)
│   │   ├── SchemaView.jsx      # React Flow diagram (top center)
│   │   ├── SqlTabs.jsx         # Tabbed SQL editor (bottom center)
│   │   ├── TableNode.jsx       # React Flow node for tables
│   │   ├── TypeNode.jsx        # React Flow node for enums
│   │   └── SequenceNode.jsx    # React Flow node for sequences
│   │
│   ├── contexts/
│   │   ├── SchemaContext.jsx   # Parsed schema state
│   │   ├── EditorContext.jsx   # Open files and tabs
│   │   └── SelectionContext.jsx # Selected entities
│   │
│   ├── services/
│   │   ├── DDLParserService.js # Parse SQL → schema model
│   │   ├── DDLGeneratorService.js # Schema model → SQL (future)
│   │   ├── FileService.js      # File I/O operations
│   │   ├── ExportService.js    # SVG and PlantUML export
│   │   └── LayoutService.js    # Auto-layout algorithms
│   │
│   ├── parser/
│   │   ├── index.js            # Parser entry point
│   │   ├── tableParser.js      # CREATE TABLE parsing
│   │   ├── typeParser.js       # CREATE TYPE parsing
│   │   └── sequenceParser.js   # CREATE SEQUENCE parsing
│   │
│   └── utils/
│       ├── constants.js        # App constants
│       └── sqlFormatter.js     # SQL formatting helpers
│
├── docs/                       # Project documentation
├── tests/                      # Test suites
├── webpack.config.js           # Build configuration
├── package.json                # Dependencies
└── README.md                   # Project readme
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         DDL Files (.sql)                         │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DDLParserService                           │
│  - Reads SQL files from folder                                   │
│  - Parses CREATE TABLE, CREATE TYPE, CREATE SEQUENCE             │
│  - Extracts columns, constraints, relationships                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Schema Model                              │
│  {                                                               │
│    tables: [{ name, columns, primaryKey, foreignKeys }],         │
│    types: [{ name, values }],                                    │
│    sequences: [{ name, start, increment }]                       │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │  React   │ │   SVG    │ │ PlantUML │
              │   Flow   │ │  Export  │ │  Export  │
              │ Diagram  │ │          │ │          │
              └──────────┘ └──────────┘ └──────────┘
```

## UI Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Runway                                            [Settings]       │
├────────────┬───────────────────────────────────────────────────────┤
│            │                                                        │
│  File      │              Schema Diagram                            │
│  Browser   │                                                        │
│            │    ┌─────────┐         ┌─────────┐                     │
│  📁 schema │    │  users  │────────▶│ orders  │                     │
│    📄 001  │    └─────────┘         └─────────┘                     │
│    📄 002  │                              │                         │
│    📄 003  │                              ▼                         │
│            │                        ┌─────────┐                     │
│            │                        │ items   │                     │
│            │                        └─────────┘                     │
│            ├────────────────────────────────────────────────────────┤
│            │  [users.sql] [orders.sql] [items.sql]                  │
│            │                                                        │
│            │  CREATE TABLE users (                                  │
│            │      id SERIAL PRIMARY KEY,                            │
│            │      email VARCHAR(255) NOT NULL                       │
│            │  );                                                    │
│            │                                                        │
└────────────┴────────────────────────────────────────────────────────┘
```

## Schema Model Types

```typescript
interface Schema {
  tables: Table[];
  types: EnumType[];
  sequences: Sequence[];
}

interface Table {
  name: string;
  columns: Column[];
  primaryKey: string[];
  foreignKeys: ForeignKey[];
  uniqueConstraints: string[][];
  sourceFile: string;
  sourceLine: number;
}

interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isUnique: boolean;
  references: ForeignKey | null;
}

interface ForeignKey {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  constraintName: string | null;
}

interface EnumType {
  name: string;
  values: string[];
  sourceFile: string;
}

interface Sequence {
  name: string;
  start: number;
  increment: number;
  sourceFile: string;
}
```

## IPC Communication

### Main → Renderer Events
- `folder-opened` - User selected a folder via File menu
- `schema-updated` - Schema was re-parsed after file change

### Renderer → Main Requests
- `read-folder` - Get list of SQL files in folder
- `read-file` - Read contents of a SQL file
- `parse-schema` - Parse all DDL files and return schema
- `export-svg` - Export diagram as SVG
- `export-plantuml` - Export diagram as PlantUML

## Phase 1 Focus (Current)

- DDL parsing (tables, types, sequences)
- Schema visualization with React Flow
- File browser for DDL folders
- Tabbed SQL viewer
- Read-only (no DDL generation)

## Future Phases

- Phase 2: DDL generation from diagram edits
- Phase 3: Schema diff visualization
- Phase 4: Migration script generation
