# Runway - PostgreSQL DDL Visualizer

## Vision

Runway is a data modeling tool that uses plain SQL DDL as both input and output. Unlike traditional tools that use proprietary XML or JSON formats, Runway treats your PostgreSQL DDL files as the source of truth.

## Core Principles

1. **SQL is the format** - No proprietary files. Your DDL files are version-controllable, diffable, and work with existing toolchains.
2. **PostgreSQL-focused** - We don't try to support every database. Deep PostgreSQL support beats shallow multi-database support.
3. **Constrained scope** - We support tables, types (enums), and sequences. No views, functions, or triggers.
4. **Visual-first** - The diagram is the primary interface for understanding schema relationships.

## Supported DDL Constructs

```sql
-- Types (enums)
CREATE TYPE status AS ENUM ('active', 'inactive', 'pending');

-- Sequences
CREATE SEQUENCE user_id_seq START 1;

-- Tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    status status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Foreign Keys
ALTER TABLE orders ADD CONSTRAINT fk_user
    FOREIGN KEY (user_id) REFERENCES users(id);
```

## Target Users

- DBAs who want to visualize existing schemas
- Developers who need to understand table relationships
- Teams that document schemas using PlantUML

## Export Formats

- **SVG** - For embedding in documentation, wikis, presentations
- **PlantUML** - For teams using PlantUML-based documentation systems

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **Ant Design** - Component library (dark theme)
- **React Flow** - Diagramming library
- **Monaco Editor** - SQL code editing
- **pgsql-ast-parser** - PostgreSQL DDL parsing

## Related Projects

This tool is part of a tooling family that includes Context Kiln.
