import React, { useMemo } from 'react';
import { List, Tag, Empty, Tooltip, Badge, Collapse } from 'antd';
import {
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  TableOutlined,
  LinkOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { analyzeSchema, getAnalysisSummary, Severity, Category } from '../utils/schemaAnalyzer';

const { Panel } = Collapse;

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
  },
  closeButton: {
    cursor: 'pointer',
    color: '#888',
    padding: '4px',
  },
  summary: {
    display: 'flex',
    gap: '12px',
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    background: '#252526',
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  issueItem: {
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '8px',
    background: '#2d2d2d',
    border: '1px solid #3c3c3c',
  },
  issueHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  issueMessage: {
    color: '#ccc',
    fontSize: '12px',
  },
  issueSuggestion: {
    color: '#888',
    fontSize: '11px',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  issueLocation: {
    color: '#6997d5',
    fontSize: '11px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  categoryBadge: {
    fontSize: '10px',
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
  },
};

const severityConfig = {
  [Severity.ERROR]: {
    icon: <ExclamationCircleOutlined style={{ color: '#f44' }} />,
    color: '#f44',
    tagColor: 'error',
  },
  [Severity.WARNING]: {
    icon: <WarningOutlined style={{ color: '#faad14' }} />,
    color: '#faad14',
    tagColor: 'warning',
  },
  [Severity.INFO]: {
    icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
    color: '#1890ff',
    tagColor: 'processing',
  },
};

const categoryConfig = {
  [Category.STRUCTURE]: { icon: <TableOutlined />, color: '#722ed1' },
  [Category.RELATIONSHIPS]: { icon: <LinkOutlined />, color: '#13c2c2' },
  [Category.NAMING]: { icon: <EditOutlined />, color: '#eb2f96' },
  [Category.BEST_PRACTICES]: { icon: <CheckCircleOutlined />, color: '#52c41a' },
};

function SchemaAnalysisPanel({ schema, onClose, onNavigateToTable }) {
  // Analyze schema
  const issues = useMemo(() => {
    if (!schema || schema.tables.length === 0) return [];
    return analyzeSchema(schema);
  }, [schema]);

  const summary = useMemo(() => getAnalysisSummary(issues), [issues]);

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const grouped = {};
    for (const issue of issues) {
      if (!grouped[issue.category]) {
        grouped[issue.category] = [];
      }
      grouped[issue.category].push(issue);
    }
    return grouped;
  }, [issues]);

  const handleClickLocation = (issue) => {
    if (onNavigateToTable && issue.table) {
      onNavigateToTable(issue.table, issue.sourceFile);
    }
  };

  if (!schema || schema.tables.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>Schema Analysis</span>
          <CloseOutlined style={styles.closeButton} onClick={onClose} />
        </div>
        <div style={styles.emptyState}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No schema loaded"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Schema Analysis</span>
        <CloseOutlined style={styles.closeButton} onClick={onClose} />
      </div>

      {/* Summary */}
      <div style={styles.summary}>
        <Tooltip title="Errors">
          <Badge count={summary.errors} showZero color="#f44" style={{ marginRight: 4 }}>
            <ExclamationCircleOutlined style={{ color: summary.errors > 0 ? '#f44' : '#666', fontSize: 16 }} />
          </Badge>
        </Tooltip>
        <Tooltip title="Warnings">
          <Badge count={summary.warnings} showZero color="#faad14" style={{ marginRight: 4 }}>
            <WarningOutlined style={{ color: summary.warnings > 0 ? '#faad14' : '#666', fontSize: 16 }} />
          </Badge>
        </Tooltip>
        <Tooltip title="Info">
          <Badge count={summary.info} showZero color="#1890ff" style={{ marginRight: 4 }}>
            <InfoCircleOutlined style={{ color: summary.info > 0 ? '#1890ff' : '#666', fontSize: 16 }} />
          </Badge>
        </Tooltip>
        <span style={{ marginLeft: 'auto', color: '#888' }}>
          {summary.total === 0 ? 'No issues found' : `${summary.total} issue${summary.total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {issues.length === 0 ? (
          <div style={styles.emptyState}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <div style={{ color: '#52c41a', fontSize: 16, fontWeight: 'bold' }}>
              Schema looks good!
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
              No issues detected in {schema.tables.length} tables.
            </div>
          </div>
        ) : (
          <Collapse
            defaultActiveKey={Object.keys(issuesByCategory)}
            ghost
            style={{ background: 'transparent' }}
          >
            {Object.entries(issuesByCategory).map(([category, categoryIssues]) => (
              <Panel
                key={category}
                header={
                  <span style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {categoryConfig[category]?.icon}
                    {category}
                    <Tag color={categoryConfig[category]?.color} style={{ marginLeft: 8 }}>
                      {categoryIssues.length}
                    </Tag>
                  </span>
                }
                style={{ borderBottom: '1px solid #333' }}
              >
                {categoryIssues.map((issue, index) => (
                  <div key={index} style={styles.issueItem}>
                    <div style={styles.issueHeader}>
                      {severityConfig[issue.severity].icon}
                      <Tag color={severityConfig[issue.severity].tagColor} style={styles.categoryBadge}>
                        {issue.severity.toUpperCase()}
                      </Tag>
                      {issue.table && (
                        <Tag color="blue" style={styles.categoryBadge}>
                          {issue.table}
                        </Tag>
                      )}
                    </div>
                    <div style={styles.issueMessage}>{issue.message}</div>
                    {issue.suggestion && (
                      <div style={styles.issueSuggestion}>
                        💡 {issue.suggestion}
                      </div>
                    )}
                    {issue.sourceFile && (
                      <div
                        style={styles.issueLocation}
                        onClick={() => handleClickLocation(issue)}
                      >
                        📄 {issue.sourceFile.split('/').pop()}
                      </div>
                    )}
                  </div>
                ))}
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    </div>
  );
}

export default SchemaAnalysisPanel;
