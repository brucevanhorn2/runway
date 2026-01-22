import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Tabs, Dropdown } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useEditor } from '../contexts/EditorContext';
import { useSchema } from '../contexts/SchemaContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import MarkdownPreview from './MarkdownPreview';
import spellCheckService from '../services/SpellCheckService';
import sqlLintService from '../services/SqlLintService';

// Track editor instances and their decorations
const editorRefs = new Map();
// Track spell check decorations separately
const spellCheckDecorations = new Map();
// Track misspelled words for context menu
const misspelledWordsMap = new Map();

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

/**
 * Apply spell check decorations to the editor
 */
function applySpellCheckDecorations(editor, monaco, content) {
  if (!spellCheckService.isLoaded) return;

  const words = spellCheckService.extractCheckableText(content);
  const misspelled = [];

  for (const wordInfo of words) {
    if (!spellCheckService.check(wordInfo.word)) {
      misspelled.push(wordInfo);
    }
  }

  // Store misspelled words for context menu
  misspelledWordsMap.set(editor, misspelled);

  const decorations = misspelled.map(wordInfo => ({
    range: new monaco.Range(
      wordInfo.line,
      wordInfo.startColumn,
      wordInfo.line,
      wordInfo.endColumn
    ),
    options: {
      inlineClassName: 'spelling-error',
      hoverMessage: {
        value: `**Spelling:** "${wordInfo.word}" may be misspelled. Right-click for suggestions.`,
      },
    },
  }));

  // Get existing decoration IDs or empty array
  const existingDecorations = spellCheckDecorations.get(editor) || [];

  // Apply new decorations and store the IDs
  const newDecorationIds = editor.deltaDecorations(existingDecorations, decorations);
  spellCheckDecorations.set(editor, newDecorationIds);
}

/**
 * Get misspelled word at a position (for context menu)
 */
function getMisspelledWordAtPosition(editor, position) {
  const misspelled = misspelledWordsMap.get(editor) || [];
  return misspelled.find(w =>
    w.line === position.lineNumber &&
    position.column >= w.startColumn &&
    position.column <= w.endColumn
  );
}

// Debounce helper for spell checking and linting
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Apply SQL lint markers to the editor
 */
function applySqlLintMarkers(editor, monaco, content) {
  const model = editor.getModel();
  if (!model) return;

  const issues = sqlLintService.validate(content);

  const markers = issues.map(issue => ({
    severity: issue.severity === 'error'
      ? monaco.MarkerSeverity.Error
      : monaco.MarkerSeverity.Warning,
    message: issue.message,
    startLineNumber: issue.startLine,
    startColumn: issue.startColumn,
    endLineNumber: issue.endLine,
    endColumn: issue.endColumn,
    source: 'sql-lint',
  }));

  monaco.editor.setModelMarkers(model, 'sql-lint', markers);
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
    saveFile,
    openFile,
  } = useEditor();

  const { schema } = useSchema();
  const { preferences } = useUserPreferences();
  const monacoRef = useRef(null);
  const schemaRef = useRef(schema);
  const [spellCheckReady, setSpellCheckReady] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, items: [] });
  const activeEditorRef = useRef(null);

  // Initialize spell checker
  useEffect(() => {
    spellCheckService.initialize().then((success) => {
      if (success) {
        setSpellCheckReady(true);
        console.log('[SqlTabs] Spell checker initialized');
      }
    });
  }, []);

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

  // Debounced validation function (spell check + SQL lint) - use ref to keep stable reference
  const debouncedValidationRef = useRef(null);
  if (!debouncedValidationRef.current) {
    debouncedValidationRef.current = debounce((editor, monaco, content, isSpellCheckReady) => {
      // Run spell check
      if (isSpellCheckReady) {
        applySpellCheckDecorations(editor, monaco, content);
      }
      // Run SQL lint
      applySqlLintMarkers(editor, monaco, content);
    }, 500);
  }
  const debouncedValidation = useCallback((editor, monaco, content) => {
    debouncedValidationRef.current(editor, monaco, content, spellCheckReady);
  }, [spellCheckReady]);

  const handleEditorMount = useCallback((editor, monaco, content, filePath) => {
    monacoRef.current = monaco;
    activeEditorRef.current = editor;

    // Register all language features (only once)
    registerLanguageFeatures(monaco);

    // Apply initial decorations
    applyDecorations(editor, monaco, content || '');

    // Apply initial spell check and SQL lint
    if (spellCheckReady) {
      applySpellCheckDecorations(editor, monaco, content || '');
    }
    applySqlLintMarkers(editor, monaco, content || '');

    // Add save action (Cmd+S / Ctrl+S)
    editor.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      ],
      run: async () => {
        // Format on save if preference is enabled
        if (preferences.editor.formatOnSave) {
          await editor.getAction('editor.action.formatDocument')?.run();
        }
        await saveFile(filePath);
      },
    });

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

    // Add context menu for spelling suggestions
    editor.onContextMenu((e) => {
      const position = e.target.position;
      if (!position) return;

      const misspelledWord = getMisspelledWordAtPosition(editor, position);
      if (misspelledWord) {
        e.event.preventDefault();
        e.event.stopPropagation();

        const suggestions = spellCheckService.suggest(misspelledWord.word);
        const menuItems = [];

        // Add suggestions
        if (suggestions.length > 0) {
          suggestions.forEach((suggestion, index) => {
            menuItems.push({
              key: `suggestion-${index}`,
              label: suggestion,
              onClick: () => {
                // Replace the misspelled word
                const range = new monaco.Range(
                  misspelledWord.line,
                  misspelledWord.startColumn,
                  misspelledWord.line,
                  misspelledWord.endColumn
                );
                editor.executeEdits('spell-correction', [{
                  range,
                  text: suggestion,
                }]);
                setContextMenu({ visible: false, x: 0, y: 0, items: [] });
              },
            });
          });
          menuItems.push({ type: 'divider' });
        }

        // Add "Add to Dictionary" option
        menuItems.push({
          key: 'add-to-dictionary',
          label: `Add "${misspelledWord.word}" to dictionary`,
          onClick: () => {
            spellCheckService.addToCustomDictionary(misspelledWord.word);
            // Re-run spell check to remove the decoration
            applySpellCheckDecorations(editor, monaco, editor.getValue());
            setContextMenu({ visible: false, x: 0, y: 0, items: [] });
          },
        });

        setContextMenu({
          visible: true,
          x: e.event.posx,
          y: e.event.posy,
          items: menuItems,
        });
      }
    });
  }, [registerLanguageFeatures, openFile, saveFile, preferences.editor.formatOnSave, spellCheckReady]);

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
          onChange={(value) => {
            handleEditorChange(value, file.path, null);
          }}
          onMount={(editor, monaco) => {
            handleEditorMount(editor, monaco, file.content, file.path);
            // Re-apply decorations on content change via editor event
            editor.onDidChangeModelContent(() => {
              const content = editor.getValue();
              applyDecorations(editor, monaco, content);
              // Debounced spell check
              debouncedValidation(editor, monaco, content);
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
    <>
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

      {/* Spelling suggestions context menu */}
      {contextMenu.visible && (
        <Dropdown
          menu={{ items: contextMenu.items }}
          open={true}
          onOpenChange={(open) => {
            if (!open) setContextMenu({ visible: false, x: 0, y: 0, items: [] });
          }}
          trigger={['contextMenu']}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              width: 1,
              height: 1,
              zIndex: 10000,
            }}
          />
        </Dropdown>
      )}
    </>
  );
}

export default SqlTabs;
