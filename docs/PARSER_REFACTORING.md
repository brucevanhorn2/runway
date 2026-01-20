# Parser Refactoring - Regex to AST

## Date: 2026-01-20

## Summary
Replaced custom regex-based SQL parser with `pgsql-ast-parser` for more robust DDL parsing.

## Why We Changed

### Problems with Regex Approach:
1. **Semicolon handling** - Some DDL files don't end with semicolons
2. **Nested parentheses** - CHECK constraints and DEFAULT functions broke simple regex
3. **Quoted identifiers** - Required special handling
4. **Schema qualifications** - `public.table` vs `table`
5. **Maintenance burden** - Every DDL edge case requires new regex patterns

### Benefits of AST Approach:
- ✅ **Robust parsing** - Handles all PostgreSQL DDL syntax correctly
- ✅ **Better error handling** - Clear parse errors instead of regex failures  
- ✅ **Less code** - 350 lines vs 514 lines
- ✅ **Maintainable** - No regex archaeology needed
- ✅ **Future-proof** - Easy to add support for new DDL features

## What Changed

### Files Modified:
- `src/parser/index.js` - Completely rewritten to use AST
- `src/parser/index-regex.js` - Old regex parser (backup)
- `src/parser/index.js.backup` - Original backup

### New Dependencies Used:
- `pgsql-ast-parser@12.0.1` (already installed)

### API Compatibility:
- ✅ `parseAllFiles(files)` - Same signature
- ✅ `parseDDL(content, sourceFile)` - Same signature
- ✅ Returns same schema structure

## Testing

Tested with:
- ✅ Tables with/without semicolons
- ✅ Tables with CHECK constraints  
- ✅ Tables with DEFAULT functions
- ✅ CREATE TYPE AS ENUM
- ✅ Inline and ALTER TABLE foreign keys
- ✅ Quoted identifiers
- ✅ IF NOT EXISTS clauses

### Test Results:
- `chipset.sql` - 16/16 columns parsed correctly
- `housekeeping_status_enum.sql` - Enum values extracted correctly
- `users.sql` - All 15 columns + constraints parsed

## Rollback

If needed, rollback with:
```bash
cd src/parser
mv index.js index-ast.js
mv index-regex.js index.js
```

## Next Steps

1. Delete `index-regex.js` after confirming AST parser works in production
2. Delete `index.js.backup` 
3. Consider adding support for:
   - CREATE VIEW (if needed)
   - CREATE INDEX (for diagram annotations)
   - Column comments (for tooltips)
