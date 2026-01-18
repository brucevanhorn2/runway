# Runway

A PostgreSQL DDL visualizer that uses plain SQL as both input and output.


## Features

- **SQL is the source of truth** - No proprietary files. Your DDL files are version-controllable, diffable, and work with existing toolchains.
- **Visual schema diagram** - See your tables and foreign key relationships at a glance
- **Live updates** - File watcher automatically refreshes the diagram when SQL files change
- **Export options** - Export diagrams as SVG or PlantUML for documentation

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
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/runway.git
cd runway

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Usage

1. Launch Runway with `npm run dev`
2. Use **File → Open Folder** (Ctrl+O) to open a folder containing `.sql` files
3. The schema diagram will appear showing all tables and their relationships
4. Click on a table to highlight its source file
5. Use **File → Export as SVG** or **Export as PlantUML** to export the diagram

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Folder | Ctrl+O |
| Export as SVG | Ctrl+Shift+S |
| Export as PlantUML | Ctrl+Shift+P |
| Fit Diagram | Ctrl+0 |
| Reload | Ctrl+R |
| Developer Tools | F12 |

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **Ant Design** - Component library
- **React Flow** - Diagramming library
- **Monaco Editor** - SQL code editing
- **Dagre** - Graph layout algorithm

## Project Structure

```
runway/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC bridge
│   ├── App.jsx              # React root
│   ├── Layout.jsx           # Main layout
│   ├── components/          # React components
│   │   ├── FileTree.jsx     # SQL file browser
│   │   ├── SchemaView.jsx   # React Flow diagram
│   │   ├── SqlTabs.jsx      # Tabbed editor
│   │   └── TableNode.jsx    # Diagram table node
│   ├── contexts/            # React contexts
│   ├── parser/              # DDL parser
│   └── services/            # Export services
├── docs/                    # Documentation
└── package.json
```

## Building for Distribution

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:win
npm run dist:mac
npm run dist:linux
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [Context Kiln](https://github.com/yourusername/context-kiln) - AI-powered code context builder
