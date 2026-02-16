import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { CloseOutlined, DiffOutlined } from '@ant-design/icons';

/**
 * Generate a clean, canonical CREATE TABLE DDL from a parsed table object.
 * Used to produce consistent input for the diff editor regardless of how the
 * original file was formatted.
 */
function generateTableDDL(table) {
  const defs = table.columns.map(col => {
    let def = `  ${col.name} ${col.dataType}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.defaultValue != null) def += ` DEFAULT ${col.defaultValue}`;
    return def;
  });

  if (table.primaryKey.length > 0) {
    defs.push(`  PRIMARY KEY (${table.primaryKey.join(', ')})`);
  }

  for (const uc of (table.uniqueConstraints || [])) {
    if (uc.length > 0) defs.push(`  UNIQUE (${uc.join(', ')})`);
  }

  return `CREATE TABLE ${table.name} (\n${defs.join(',\n')}\n);`;
}

function SchemaDiffModal({ problem, onClose }) {
  if (!problem) return null;

  const { refTable, copyTable, refDbName, copyDbName } = problem;
  const originalDDL = generateTableDDL(refTable);
  const modifiedDDL = generateTableDDL(copyTable);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '82%',
          maxWidth: '1120px',
          height: '68%',
          minHeight: '320px',
          background: '#1e1e1e',
          borderRadius: '8px',
          border: '1px solid #3c3c3c',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid #333',
            background: '#252526',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <DiffOutlined style={{ color: '#ff9800', fontSize: '15px' }} />
          <span style={{ color: '#ccc', fontWeight: 'bold', fontSize: '13px', flex: 1 }}>
            Schema diff:{' '}
            <span style={{ color: '#fff' }}>{refTable.name}</span>
          </span>
          <CloseOutlined
            style={{ color: '#888', cursor: 'pointer', fontSize: '14px' }}
            onClick={onClose}
          />
        </div>

        {/* Side labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#252526',
            borderBottom: '1px solid #333',
            fontSize: '11px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '4px 16px',
              color: '#4fc3f7',
              borderRight: '1px solid #333',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                background: '#1a3a4a',
                border: '1px solid #4fc3f7',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '10px',
              }}
            >
              reference
            </span>
            {refDbName}
          </div>
          <div
            style={{
              padding: '4px 16px',
              color: '#00b894',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                background: '#0d2e27',
                border: '1px solid #00b894',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '10px',
              }}
            >
              copy
            </span>
            {copyDbName}
          </div>
        </div>

        {/* Monaco diff editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DiffEditor
            height="100%"
            language="sql"
            theme="vs-dark"
            original={originalDDL}
            modified={modifiedDDL}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: 'on',
              renderOverviewRuler: false,
              ignoreTrimWhitespace: true,
              diffWordWrap: 'on',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default SchemaDiffModal;
