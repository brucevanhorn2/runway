import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, List, Typography, Tag, Empty, Spin } from 'antd';
import { LinkOutlined, TableOutlined, CloseOutlined } from '@ant-design/icons';
import { useEditor } from '../contexts/EditorContext';
import { useSchema } from '../contexts/SchemaContext';
import { useSelection } from '../contexts/SelectionContext';

const { Text } = Typography;

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#252526',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#ccc',
    fontSize: '13px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  results: {
    flex: 1,
    overflow: 'auto',
  },
  resultItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  resultItemHover: {
    background: '#37373d',
  },
  fileName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  linePreview: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matchHighlight: {
    background: '#613214',
    color: '#fff',
  },
  stats: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    color: '#888',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px',
  },
};

function FindUsagesPanel({ tableName, folderPath, onClose }) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(-1);

  const { openFile } = useEditor();
  const { schema } = useSchema();
  const { selectTable } = useSelection();

  // Perform find usages search
  useEffect(() => {
    async function findUsages() {
      if (!tableName || !folderPath || !window.electron) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const result = await window.electron.findUsages(folderPath, tableName);
        if (result.success) {
          setResults(result.usages);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Find usages failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    findUsages();
  }, [tableName, folderPath]);

  // Handle result click
  const handleResultClick = useCallback((result) => {
    openFile(result.filePath, result.fileName);

    // Find and select the table in the diagram
    const table = schema.tables.find(t => t.sourceFile === result.filePath);
    if (table) {
      selectTable(table.name);
    }
  }, [openFile, schema, selectTable]);

  // Handle keyboard
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  }, [onClose]);

  // Highlight the table name in text
  const highlightMatch = (text) => {
    if (!tableName) return text;

    const regex = new RegExp(`(${tableName})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === tableName.toLowerCase()) {
        return <span key={index} style={styles.matchHighlight}>{part}</span>;
      }
      return part;
    });
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div style={styles.container} onKeyDown={handleKeyDown} tabIndex={0}>
      <div style={styles.header}>
        <div style={styles.title}>
          <LinkOutlined />
          <span>Usages of</span>
          <Tag color="blue" icon={<TableOutlined />}>{tableName}</Tag>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          <CloseOutlined />
        </button>
      </div>

      {isLoading ? (
        <div style={styles.loading}>
          <Spin tip="Searching..." />
        </div>
      ) : (
        <>
          <div style={styles.stats}>
            {totalMatches > 0
              ? `${totalMatches} references in ${results.length} files`
              : `No references to ${tableName} found`
            }
          </div>

          <div style={styles.results}>
            {results.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={`No tables reference ${tableName}`}
                style={{ marginTop: '40px' }}
              />
            ) : (
              results.map((fileResult, fileIndex) => (
                <div key={fileResult.filePath}>
                  {fileResult.matches.map((match, matchIndex) => {
                    const globalIndex = results
                      .slice(0, fileIndex)
                      .reduce((sum, r) => sum + r.matches.length, 0) + matchIndex;

                    return (
                      <div
                        key={`${fileResult.filePath}-${match.lineNumber}`}
                        style={{
                          ...styles.resultItem,
                          ...(hoveredIndex === globalIndex ? styles.resultItemHover : {}),
                        }}
                        onClick={() => handleResultClick({
                          ...fileResult,
                          lineNumber: match.lineNumber,
                        })}
                        onMouseEnter={() => setHoveredIndex(globalIndex)}
                      >
                        <div style={styles.fileName}>
                          <TableOutlined style={{ color: '#58a6ff' }} />
                          <Text style={{ color: '#ccc' }}>{fileResult.fileName}</Text>
                          <Tag style={{ fontSize: '10px' }}>:{match.lineNumber}</Tag>
                        </div>
                        <div style={styles.linePreview}>
                          {highlightMatch(match.lineContent)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FindUsagesPanel;
