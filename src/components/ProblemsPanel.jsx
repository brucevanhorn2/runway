import React, { useMemo } from 'react';
import { Empty, Badge } from 'antd';
import {
  CloseOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  DiffOutlined,
} from '@ant-design/icons';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#1e1e1e',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    background: '#252526',
  },
  title: {
    fontWeight: 'bold',
    color: '#ccc',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  closeButton: {
    cursor: 'pointer',
    color: '#888',
    padding: '4px',
  },
  summary: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#888',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  problemItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #2d2d2d',
    fontSize: '12px',
  },
  problemItemHover: {
    background: '#2a2d2e',
  },
  icon: {
    marginTop: '2px',
    flexShrink: 0,
  },
  problemContent: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    color: '#ccc',
    wordBreak: 'break-word',
  },
  location: {
    color: '#6997d5',
    fontSize: '11px',
    marginTop: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#666',
  },
};

const severityIcons = {
  error: <ExclamationCircleOutlined style={{ color: '#f44336', fontSize: '14px' }} />,
  warning: <WarningOutlined style={{ color: '#ff9800', fontSize: '14px' }} />,
  info: <InfoCircleOutlined style={{ color: '#2196f3', fontSize: '14px' }} />,
  hint: <InfoCircleOutlined style={{ color: '#4caf50', fontSize: '14px' }} />,
};

function ProblemsPanel({ problems, onClose, onNavigate, onShowDiff }) {
  // Sort problems: errors first, then warnings, then info/hints
  const sortedProblems = useMemo(() => {
    const severityOrder = { error: 0, warning: 1, info: 2, hint: 3 };
    return [...problems].sort((a, b) => {
      // First by severity
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      // Then by file
      const fileDiff = (a.filePath || '').localeCompare(b.filePath || '');
      if (fileDiff !== 0) return fileDiff;
      // Then by line
      return (a.startLine || 0) - (b.startLine || 0);
    });
  }, [problems]);

  // Count by severity
  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0, hint: 0 };
    for (const p of problems) {
      c[p.severity] = (c[p.severity] || 0) + 1;
    }
    return c;
  }, [problems]);

  const handleClick = (problem) => {
    if (problem.source === 'schema-drift' && onShowDiff) {
      onShowDiff(problem);
    } else if (onNavigate) {
      onNavigate(problem.filePath, problem.startLine, problem.startColumn);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>
          <span>Problems</span>
          <div style={styles.summary}>
            {counts.error > 0 && (
              <div style={styles.summaryItem}>
                <ExclamationCircleOutlined style={{ color: '#f44336' }} />
                <span>{counts.error}</span>
              </div>
            )}
            {counts.warning > 0 && (
              <div style={styles.summaryItem}>
                <WarningOutlined style={{ color: '#ff9800' }} />
                <span>{counts.warning}</span>
              </div>
            )}
            {(counts.info + counts.hint) > 0 && (
              <div style={styles.summaryItem}>
                <InfoCircleOutlined style={{ color: '#4caf50' }} />
                <span>{counts.info + counts.hint}</span>
              </div>
            )}
            {problems.length === 0 && (
              <span style={{ color: '#52c41a' }}>No problems</span>
            )}
          </div>
        </div>
        <CloseOutlined style={styles.closeButton} onClick={onClose} />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {sortedProblems.length === 0 ? (
          <div style={styles.emptyState}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No problems detected"
            />
          </div>
        ) : (
          sortedProblems.map((problem, index) => (
            <div
              key={`${problem.filePath}-${problem.startLine}-${index}`}
              style={styles.problemItem}
              onClick={() => handleClick(problem)}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2a2d2e'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={styles.icon}>
                {severityIcons[problem.severity] || severityIcons.info}
              </div>
              <div style={styles.problemContent}>
                <div style={styles.message}>{problem.message}</div>
                <div style={styles.location}>
                  <FileTextOutlined style={{ fontSize: '11px' }} />
                  <span>
                    {problem.fileName || problem.filePath?.split('/').pop() || 'Unknown'}
                    {problem.startLine && `:${problem.startLine}`}
                    {problem.startColumn && `:${problem.startColumn}`}
                  </span>
                  {problem.source && (
                    <Badge
                      count={problem.source}
                      style={{
                        backgroundColor: '#3c3c3c',
                        color: '#888',
                        fontSize: '10px',
                        marginLeft: '8px',
                      }}
                    />
                  )}
                  {problem.source === 'schema-drift' && (
                    <span
                      style={{
                        marginLeft: '6px',
                        color: '#ff9800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '10px',
                        opacity: 0.8,
                      }}
                    >
                      <DiffOutlined style={{ fontSize: '11px' }} />
                      click to diff
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProblemsPanel;
