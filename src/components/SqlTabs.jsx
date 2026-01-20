import React, { useCallback, useRef, useEffect } from 'react';
import { Tabs } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useEditor } from '../contexts/EditorContext';
import { useSchema } from '../contexts/SchemaContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import MarkdownPreview from './MarkdownPreview';

// Track editor instances and their decorations
const editorRefs = new Map();

/**
 * Parse SQL content and find lines with PRIMARY KEY and FOREIGN KEY
 */
function findKeyLines(content) {
  const lines = content.split('\n');
  const primaryKeyLines = [];
  const foreignKeyLines = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const upperLine = line.toUpperCase();

    // Check for PRIMARY KEY (inline or constraint)
    if (upperLine.includes('PRIMARY KEY') || upperLine.includes('SERIAL')) {
      primaryKeyLines.push(lineNumber);
    }
    // Check for FOREIGN KEY or REFERENCES
    else if (upperLine.includes('FOREIGN KEY') || upperLine.includes('REFERENCES')) {
      foreignKeyLines.push(lineNumber);
    }
  });

  return { primaryKeyLines, foreignKeyLines };
}

/**
 * Apply gutter decorations to the editor
 */
function applyDecorations(editor, monaco, content) {
  const { primaryKeyLines, foreignKeyLines } = findKeyLines(content);

  const decorations = [
    ...primaryKeyLines.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        glyphMarginClassName: 'gutter-icon-primary-key',
        glyphMarginHoverMessage: { value: '**Primary Key**' },
      },
    })),
    ...foreignKeyLines.map(line => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        glyphMarginClassName: 'gutter-icon-foreign-key',
        glyphMarginHoverMessage: { value: '**Foreign Key Reference**' },
      },
    })),
  ];

  // Get existing decoration IDs or empty array
  const existingDecorations = editorRefs.get(editor) || [];

  // Apply new decorations and store the IDs
  const newDecorationIds = editor.deltaDecorations(existingDecorations, decorations);
  editorRefs.set(editor, newDecorationIds);
}

// Store provider disposal functions
let providersDisposable = [];

// SQL Keywords for auto-complete and formatting
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
  'CREATE', 'TABLE', 'TYPE', 'SEQUENCE', 'INDEX', 'UNIQUE', 'IF', 'NOT', 'EXISTS',
  'ALTER', 'DROP', 'ADD', 'COLUMN', 'CONSTRAINT',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'ON', 'DELETE', 'UPDATE', 'CASCADE', 'SET', 'NULL',
  'DEFAULT', 'CHECK', 'ENUM', 'AS',
  'INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL',
  'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN', 'BOOL',
  'TIMESTAMP', 'DATE', 'TIME', 'INTERVAL',
  'NUMERIC', 'DECIMAL', 'REAL', 'FLOAT', 'DOUBLE', 'PRECISION',
  'UUID', 'JSON', 'JSONB', 'ARRAY',
  'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
];

/**
 * Format SQL content
 */
function formatSQL(content) {
  let result = content;

  // Uppercase SQL keywords
  SQL_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    result = result.replace(regex, keyword);
  });

  // Normalize whitespace around parentheses
  result = result.replace(/\(\s+/g, '(');
  result = result.replace(/\s+\)/g, ')');

  // Add newline after CREATE TABLE table_name (
  result = result.replace(/(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\w."]+\s*)\(\s*/gi, '$1(\n    ');

  // Add newlines between column definitions (comma followed by content)
  result = result.replace(/,\s*(?=\w)/g, ',\n    ');

  // Format closing parenthesis of CREATE TABLE
  result = result.replace(/\n\s*\);/g, '\n);');

  // Add newline before CONSTRAINT keywords in table body
  result = result.replace(/,\s*(CONSTRAINT\s)/gi, ',\n    $1');
  result = result.replace(/,\s*(PRIMARY\s+KEY\s*\()/gi, ',\n    $1');
  result = result.replace(/,\s*(FOREIGN\s+KEY\s*\()/gi, ',\n    $1');
  result = result.replace(/,\s*(UNIQUE\s*\()/gi, ',\n    $1');
  result = result.replace(/,\s*(CHECK\s*\()/gi, ',\n    $1');

  // Ensure single newline between statements
  result = result.replace(/;\s*\n\s*\n+/g, ';\n\n');

  // Trim trailing whitespace from lines
  result = result.split('\n').map(line => line.trimEnd()).join('\n');

  return result;
}

/**
 * Get SQL snippets for auto-complete
 */
function getSqlSnippets(monaco) {
  return [
    {
      label: 'table',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: [
        'CREATE TABLE ${1:table_name} (',
        '    id SERIAL PRIMARY KEY,',
        '    ${2:column_name} ${3:VARCHAR(255)} ${4:NOT NULL},',
        '    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
        '    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        ');',
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a new table with common columns',
      detail: 'CREATE TABLE snippet',
    },
    {
      label: 'enum',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: [
        "CREATE TYPE ${1:type_name} AS ENUM (",
        "    '${2:value1}',",
        "    '${3:value2}',",
        "    '${4:value3}'",
        ");",
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a new enum type',
      detail: 'CREATE TYPE ENUM snippet',
    },
    {
      label: 'fk',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'CONSTRAINT fk_${1:name} FOREIGN KEY (${2:column}) REFERENCES ${3:table}(${4:id}) ON DELETE ${5:CASCADE}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a foreign key constraint',
      detail: 'FOREIGN KEY constraint snippet',
    },
    {
      label: 'fk-inline',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: '${1:column_name} INTEGER REFERENCES ${2:table}(${3:id})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a column with inline foreign key',
      detail: 'Inline REFERENCES snippet',
    },
    {
      label: 'col',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: '${1:column_name} ${2:VARCHAR(255)} ${3:NOT NULL}',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a column definition',
      detail: 'Column definition snippet',
    },
    {
      label: 'col-ts',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: '${1:column_name} TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a timestamp column with default',
      detail: 'Timestamp column snippet',
    },
    {
      label: 'pk',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'id SERIAL PRIMARY KEY',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a serial primary key column',
      detail: 'Primary key column snippet',
    },
    {
      label: 'unique',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'CONSTRAINT ${1:constraint_name} UNIQUE (${2:column})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a unique constraint',
      detail: 'UNIQUE constraint snippet',
    },
    {
      label: 'index',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'CREATE INDEX idx_${1:name} ON ${2:table}(${3:column});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create an index',
      detail: 'CREATE INDEX snippet',
    },
    {
      label: 'alter-add',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'ALTER TABLE ${1:table} ADD COLUMN ${2:column_name} ${3:VARCHAR(255)};',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a column to existing table',
      detail: 'ALTER TABLE ADD COLUMN snippet',
    },
    {
      label: 'alter-fk',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'ALTER TABLE ${1:table} ADD CONSTRAINT fk_${2:name} FOREIGN KEY (${3:column}) REFERENCES ${4:ref_table}(${5:id});',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Add a foreign key to existing table',
      detail: 'ALTER TABLE ADD FK snippet',
    },
  ];
}

/**
 * Extract table name from a position in the text
 * Returns the table name if cursor is on a table reference
 */
function getTableNameAtPosition(model, position) {
  const line = model.getLineContent(position.lineNumber);
  const upperLine = line.toUpperCase();

  // Check if this line has REFERENCES
  const referencesMatch = upperLine.match(/REFERENCES\s+/i);
  if (!referencesMatch) return null;

  // Find the table name after REFERENCES
  const afterReferences = line.substring(referencesMatch.index + referencesMatch[0].length);
  const tableMatch = afterReferences.match(/^["']?(\w+)["']?/);
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const tableStartCol = referencesMatch.index + referencesMatch[0].length + 1;
  const tableEndCol = tableStartCol + tableName.length;

  // Check if cursor is within the table name
  if (position.column >= tableStartCol && position.column <= tableEndCol) {
    return { tableName, startCol: tableStartCol, endCol: tableEndCol };
  }

  return null;
}

function SqlTabs() {
  const {
    openFiles,
    activeFilePath,
    setActiveFilePath,
    closeFile,
    updateFileContent,
    openFile,
  } = useEditor();

  const { schema } = useSchema();
  const { preferences } = useUserPreferences();
  const monacoRef = useRef(null);
  const schemaRef = useRef(schema);

  // Keep schema ref updated
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);

  // Register all language features once Monaco is loaded
  const registerLanguageFeatures = useCallback((monaco) => {
    // Dispose previous providers
    providersDisposable.forEach(d => d.dispose());
    providersDisposable = [];

    // 1. Definition provider (Ctrl+Click to go to table)
    providersDisposable.push(
      monaco.languages.registerDefinitionProvider('sql', {
        provideDefinition: (model, position) => {
          const tableInfo = getTableNameAtPosition(model, position);
          if (!tableInfo) return null;

          const { tableName } = tableInfo;
          const currentSchema = schemaRef.current;

          const table = currentSchema.tables.find(
            t => t.name.toLowerCase() === tableName.toLowerCase()
          );

          if (!table || !table.sourceFile) return null;

          return {
            uri: monaco.Uri.file(table.sourceFile),
            range: new monaco.Range(1, 1, 1, 1),
          };
        },
      })
    );

    // 2. Link provider (make FK references look like links)
    providersDisposable.push(
      monaco.languages.registerLinkProvider('sql', {
        provideLinks: (model) => {
          const links = [];
          const lineCount = model.getLineCount();

          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const line = model.getLineContent(lineNumber);
            const regex = /REFERENCES\s+["']?(\w+)["']?/gi;
            let match;

            while ((match = regex.exec(line)) !== null) {
              const tableName = match[1];
              const currentSchema = schemaRef.current;

              const table = currentSchema.tables.find(
                t => t.name.toLowerCase() === tableName.toLowerCase()
              );

              if (table && table.sourceFile) {
                const startCol = match.index + match[0].indexOf(tableName) + 1;
                const endCol = startCol + tableName.length;

                links.push({
                  range: new monaco.Range(lineNumber, startCol, lineNumber, endCol),
                  url: table.sourceFile,
                  tooltip: `Go to ${table.name} (${table.sourceFile.split('/').pop()})`,
                });
              }
            }
          }

          return { links };
        },
        resolveLink: (link) => link,
      })
    );

    // 3. Formatting provider (Cmd+Shift+F)
    providersDisposable.push(
      monaco.languages.registerDocumentFormattingEditProvider('sql', {
        provideDocumentFormattingEdits: (model) => {
          const text = model.getValue();
          const formatted = formatSQL(text);
          return [{
            range: model.getFullModelRange(),
            text: formatted,
          }];
        },
      })
    );

    // 4. Completion provider (auto-complete)
    providersDisposable.push(
      monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const currentSchema = schemaRef.current;
          const suggestions = [];

          // Add SQL keywords
          SQL_KEYWORDS.forEach(keyword => {
            suggestions.push({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range,
            });
          });

          // Add table names from schema
          currentSchema.tables.forEach(table => {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              detail: `Table (${table.columns.length} columns)`,
              documentation: `Columns: ${table.columns.map(c => c.name).join(', ')}`,
              range,
            });

            // Add column names with table prefix
            table.columns.forEach(col => {
              suggestions.push({
                label: `${table.name}.${col.name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: col.dataType,
                documentation: `Column from ${table.name}`,
                range,
              });
              // Also add just the column name
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${col.dataType} (${table.name})`,
                range,
              });
            });
          });

          // Add enum types
          currentSchema.types.forEach(type => {
            suggestions.push({
              label: type.name,
              kind: monaco.languages.CompletionItemKind.Enum,
              insertText: type.name,
              detail: 'ENUM type',
              documentation: `Values: ${type.values.join(', ')}`,
              range,
            });
          });

          // Add snippets
          const snippets = getSqlSnippets(monaco);
          snippets.forEach(snippet => {
            suggestions.push({
              ...snippet,
              range,
            });
          });

          return { suggestions };
        },
      })
    );
  }, []);

  const handleTabChange = useCallback((key) => {
    setActiveFilePath(key);
  }, [setActiveFilePath]);

  const handleEditorChange = useCallback((value, filePath, editor) => {
    updateFileContent(filePath, value);
    // Update decorations when content changes
    if (editor && monacoRef.current) {
      applyDecorations(editor, monacoRef.current, value || '');
    }
  }, [updateFileContent]);

  const handleEditorMount = useCallback((editor, monaco, content, filePath) => {
    monacoRef.current = monaco;

    // Register all language features (only once)
    registerLanguageFeatures(monaco);

    // Apply initial decorations
    applyDecorations(editor, monaco, content || '');

    // Handle link clicks - open the referenced file
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT) {
        const position = e.target.position;
        if (position && (e.event.ctrlKey || e.event.metaKey)) {
          const tableInfo = getTableNameAtPosition(editor.getModel(), position);
          if (tableInfo) {
            const { tableName } = tableInfo;
            const table = schemaRef.current.tables.find(
              t => t.name.toLowerCase() === tableName.toLowerCase()
            );
            if (table && table.sourceFile) {
              e.event.preventDefault();
              openFile(table.sourceFile, table.sourceFile.split('/').pop());
            }
          }
        }
      }
    });
  }, [registerLanguageFeatures, openFile]);

  const handleClose = useCallback((e, filePath) => {
    e.stopPropagation();
    closeFile(filePath);
  }, [closeFile]);

  if (openFiles.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="title">No files open</div>
        <div className="subtitle">
          Click on a SQL file in the left panel to view its contents
        </div>
      </div>
    );
  }

  const items = openFiles.map((file) => {
    const isMarkdown = file.name.endsWith('.md');

    return {
      key: file.path,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{file.isDirty ? '● ' : ''}{file.name}</span>
          <CloseOutlined
            style={{ fontSize: '10px', opacity: 0.6 }}
            onClick={(e) => handleClose(e, file.path)}
          />
        </span>
      ),
      children: isMarkdown ? (
        <MarkdownPreview content={file.content} />
      ) : (
        <Editor
          height="100%"
          language="sql"
          theme="vs-dark"
          value={file.content}
          onChange={(value, event) => {
            // Get the editor instance from the event
            const editor = event?.changes?.[0]?.range ? null : null;
            handleEditorChange(value, file.path, null);
          }}
          onMount={(editor, monaco) => {
            handleEditorMount(editor, monaco, file.content, file.path);
            // Re-apply decorations on content change via editor event
            editor.onDidChangeModelContent(() => {
              applyDecorations(editor, monaco, editor.getValue());
            });
          }}
          options={{
            minimap: { enabled: preferences.editor.showMinimap },
            fontSize: preferences.editor.fontSize,
            lineNumbers: 'on',
            glyphMargin: true,
            scrollBeyondLastLine: false,
            wordWrap: preferences.editor.wordWrap,
            automaticLayout: true,
            readOnly: false,
            tabSize: preferences.editor.tabSize,
          }}
        />
      ),
    };
  });

  return (
    <Tabs
      type="card"
      activeKey={activeFilePath}
      onChange={handleTabChange}
      items={items}
      style={{ height: '100%' }}
      tabBarStyle={{
        margin: 0,
        background: '#252526',
        borderBottom: '1px solid #333',
      }}
    />
  );
}

export default SqlTabs;
