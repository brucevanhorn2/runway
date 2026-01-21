# Runway

A PostgreSQL DDL visualizer that uses plain SQL as both input and output. Open a folder of `.sql` files and instantly see your schema as an interactive diagram.

**Primary Platform: macOS** - Pre-built releases are available for macOS. The app also builds and runs on Windows and Linux, but official releases are Mac-only.

## Download

Download the latest release from the [Releases page](../../releases). macOS users should download the `.dmg` file.

> **Note:** On first launch, right-click the app and select "Open" (required for unsigned apps).

## Features

### Core
- **SQL is the source of truth** - No proprietary files. Your DDL files are version-controllable, diffable, and work with existing toolchains
- **AST-based parsing** - Robust SQL parsing using `pgsql-ast-parser` (not regex)
- **Visual schema diagram** - See tables, enums, and foreign key relationships at a glance
- **Live updates** - File watcher automatically refreshes the diagram when SQL files change
- **Monaco Editor** - Full-featured SQL editor with syntax highlighting

### Editor Features
- **Gutter icons** - Visual indicators for PRIMARY KEY and FOREIGN KEY lines
- **Ctrl+Click navigation** - Jump to referenced tables in REFERENCES clauses
- **Auto-complete** - Table names, column names, SQL keywords, and enum types from your schema
- **Snippet templates** - Quick templates for tables, columns, foreign keys, enums, and more
- **SQL formatting** - Format SQL with Cmd+Shift+F (uppercase keywords, proper indentation)
- **Format on save** - Optional automatic formatting when saving
- **Save files** - Cmd+S to save (diagram updates automatically)

### Diagram Features
- **Multiple layout directions** - Left-to-right, top-to-bottom, right-to-left, bottom-to-top
- **Collapse/expand nodes** - Click table headers or use context menu
- **Search/filter** - Find tables by name with visual dimming of non-matches
- **Minimap** - Toggle minimap for large schemas
- **Context menu** - Right-click for Go to Definition, Find Usages, Collapse, Center, Copy Name
- **Drag to reposition** - Node positions are saved per-project
- **Marquee selection** - Draw a box to select multiple nodes
- **Alignment tools** - Align selected nodes (left, right, top, bottom, center, distribute)
- **Group by folder** - UML package-style grouping based on folder structure

### Navigation & Search
- **Global search** - Search across all SQL files (Cmd+Shift+F)
- **Find usages** - Which tables reference this table? (Alt+F7)
- **Go to Definition** - Jump from diagram to source file (Cmd+G)
- **Breadcrumb navigation** - Quick file path navigation

### Schema Analysis (Cmd+Shift+A)
- Detect orphan tables (no relationships)
- Detect circular dependencies
- Warning for tables without primary key
- Naming convention checker (snake_case, FK columns ending with `_id`)

### Export & Documentation
- **SVG export** - High-quality vector diagrams for documentation
- **PlantUML export** - For teams using PlantUML-based workflows
- **Markdown documentation** - Auto-generated schema docs (Cmd+Shift+D)
- **Data dictionary** - Comprehensive CSV export (Cmd+Shift+R)

### Project Settings
- **Per-project settings** - Stored in `.runway` file
- **Remember positions** - Node positions, splitter sizes, layout direction
- **User preferences** - Editor font size, tab size, word wrap, theme settings

## Supported DDL

Runway parses a focused subset of PostgreSQL DDL:

```sql
-- Enum types
CREATE TYPE status AS ENUM ('active', 'inactive', 'pending');

-- Sequences
CREATE SEQUENCE user_id_seq START 1;

-- Tables with constraints
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    status status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys (inline or via ALTER TABLE)
ALTER TABLE orders ADD CONSTRAINT fk_user
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Comments for documentation
COMMENT ON TABLE users IS 'Application users';
COMMENT ON COLUMN users.email IS 'Primary email address';
```

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open Folder | Cmd+O | Ctrl+O |
| Save File | Cmd+S | Ctrl+S |
| New SQL File | Cmd+N | Ctrl+N |
| Search in Files | Cmd+Shift+F | Ctrl+Shift+F |
| Find Usages | Alt+F7 | Alt+F7 |
| Go to Definition | Cmd+G | Ctrl+G |
| Format SQL | Cmd+Shift+F | Ctrl+Shift+F |
| Analyze Schema | Cmd+Shift+A | Ctrl+Shift+A |
| Export Documentation | Cmd+Shift+D | Ctrl+Shift+D |
| Export Data Dictionary | Cmd+Shift+R | Ctrl+Shift+R |
| Export as SVG | Cmd+Shift+S | Ctrl+Shift+S |
| Export as PlantUML | Cmd+Shift+P | Ctrl+Shift+P |
| Fit Diagram | Cmd+0 | Ctrl+0 |
| Preferences | Cmd+, | Ctrl+, |
| Reload | Cmd+R | Ctrl+R |
| Developer Tools | F12 | F12 |

## Development

```bash
# Clone the repository
git clone https://github.com/brucevanhorn2/runway.git
cd runway

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Building from Source

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:mac    # macOS (DMG + ZIP)
npm run dist:win    # Windows (NSIS + Portable)
npm run dist:linux  # Linux (AppImage + DEB)
```

## Tech Stack

- **Electron** - Desktop application framework
- **React 19** - UI framework
- **Ant Design 6** - Component library (dark theme)
- **React Flow** - Diagramming library
- **Monaco Editor** - SQL code editing
- **Dagre** - Graph layout algorithm
- **pgsql-ast-parser** - PostgreSQL SQL parsing

## Project Structure

```
runway/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── App.jsx              # React root
│   ├── Layout.jsx           # Main layout with panels
│   ├── components/          # React components
│   │   ├── FileTree.jsx     # SQL file browser
│   │   ├── SchemaView.jsx   # React Flow diagram
│   │   ├── SqlTabs.jsx      # Tabbed Monaco editor
│   │   ├── TableNode.jsx    # Diagram table node
│   │   ├── DiagramToolbar.jsx
│   │   ├── SearchPanel.jsx
│   │   ├── SchemaAnalysisPanel.jsx
│   │   └── ...
│   ├── contexts/            # React contexts (Schema, Editor, Selection)
│   ├── parser/              # AST-based DDL parser
│   ├── utils/               # Utilities (schemaAnalyzer, docGenerator)
│   └── services/            # Export services
├── docs/                    # Documentation & roadmap
├── .github/workflows/       # CI/CD (Mac builds on push to main)
└── package.json
```

## CI/CD

The project uses GitHub Actions to automatically build and release macOS binaries when changes are pushed to the `main` branch. Releases include:
- `.dmg` installer
- `.zip` archive

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Context Kiln](https://github.com/brucevanhorn2/context-kiln) - AI-powered code context builder
