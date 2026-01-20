import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, List, Typography, Tag, Empty } from 'antd';
import { SearchOutlined, FileOutlined, TableOutlined, UnorderedListOutlined } from '@ant-design/icons';
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
  searchBox: {
    padding: '8px',
    borderBottom: '1px solid #333',
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
};

function SearchPanel({ files, folderPath, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const inputRef = useRef(null);

  const { openFile } = useEditor();
  const { schema } = useSchema();
  const { selectTable } = useSelection();

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Perform search
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || !window.electron || !folderPath) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await window.electron.searchFiles(folderPath, searchQuery);
      if (result.success) {
        setResults(result.matches);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [folderPath]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Handle result click
  const handleResultClick = useCallback((result) => {
    openFile(result.filePath, result.fileName);

    // If it's a table file, also select in diagram
    const table = schema.tables.find(t => t.sourceFile === result.filePath);
    if (table) {
      selectTable(table.name);
    }

    // TODO: Navigate to specific line in editor
  }, [openFile, schema, selectTable]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && hoveredIndex >= 0 && results[hoveredIndex]) {
      handleResultClick(results[hoveredIndex]);
    }
  }, [onClose, results, hoveredIndex, handleResultClick]);

  // Get icon based on file type
  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.md')) {
      return <FileOutlined style={{ color: '#e6db74' }} />;
    }
    // Check if it's a table or enum file
    const file = files?.find(f => f.name === fileName);
    if (file?.fileType === 'table') {
      return <TableOutlined style={{ color: '#58a6ff' }} />;
    }
    if (file?.fileType === 'enum') {
      return <UnorderedListOutlined style={{ color: '#d2a8ff' }} />;
    }
    return <FileOutlined style={{ color: '#6e7681' }} />;
  };

  // Highlight matches in text
  const highlightMatch = (text, searchQuery) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        return <span key={index} style={styles.matchHighlight}>{part}</span>;
      }
      return part;
    });
  };

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div style={styles.container} onKeyDown={handleKeyDown}>
      <div style={styles.searchBox}>
        <Input
          ref={inputRef}
          prefix={<SearchOutlined style={{ color: '#888' }} />}
          placeholder="Search in files... (Esc to close)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: '#3c3c3c',
            border: '1px solid #555',
            color: '#fff',
          }}
          allowClear
        />
      </div>

      {query && (
        <div style={styles.stats}>
          {isSearching ? 'Searching...' : (
            results.length > 0
              ? `${totalMatches} matches in ${results.length} files`
              : 'No results found'
          )}
        </div>
      )}

      <div style={styles.results}>
        {results.length === 0 && query && !isSearching ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No matches found"
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
                      {getFileIcon(fileResult.fileName)}
                      <Text style={{ color: '#ccc' }}>{fileResult.fileName}</Text>
                      <Tag style={{ fontSize: '10px' }}>:{match.lineNumber}</Tag>
                    </div>
                    <div style={styles.linePreview}>
                      {highlightMatch(match.lineContent.trim(), query)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SearchPanel;
