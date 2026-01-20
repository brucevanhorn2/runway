import React from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import { FolderOutlined, FileOutlined, TableOutlined, UnorderedListOutlined, FileMarkdownOutlined } from '@ant-design/icons';
import { useEditor } from '../contexts/EditorContext';
import { useSchema } from '../contexts/SchemaContext';

const styles = {
  container: {
    padding: '4px 12px',
    background: '#252526',
    borderBottom: '1px solid #333',
    fontSize: '12px',
  },
};

function Breadcrumb({ folderPath, sqlFiles }) {
  const { activeFilePath } = useEditor();
  const { schema } = useSchema();

  if (!folderPath) {
    return null;
  }

  const folderName = folderPath.split('/').pop();

  // Build breadcrumb items
  const items = [
    {
      key: 'folder',
      title: (
        <span style={{ color: '#888' }}>
          <FolderOutlined style={{ marginRight: '4px' }} />
          {folderName}
        </span>
      ),
    },
  ];

  if (activeFilePath) {
    // Find the file info
    const file = sqlFiles.find(f => f.path === activeFilePath);
    const fileName = activeFilePath.split('/').pop();

    // Determine icon based on file type
    let icon = <FileOutlined style={{ marginRight: '4px', color: '#6e7681' }} />;
    if (file?.fileType === 'table') {
      icon = <TableOutlined style={{ marginRight: '4px', color: '#58a6ff' }} />;
    } else if (file?.fileType === 'enum') {
      icon = <UnorderedListOutlined style={{ marginRight: '4px', color: '#d2a8ff' }} />;
    } else if (file?.fileType === 'markdown' || fileName.endsWith('.md')) {
      icon = <FileMarkdownOutlined style={{ marginRight: '4px', color: '#e6db74' }} />;
    }

    // Check for subfolder path
    const relativePath = activeFilePath.replace(folderPath, '').replace(/^\//, '');
    const pathParts = relativePath.split('/');

    // Add subfolder parts
    if (pathParts.length > 1) {
      pathParts.slice(0, -1).forEach((part, index) => {
        items.push({
          key: `folder-${index}`,
          title: (
            <span style={{ color: '#888' }}>
              <FolderOutlined style={{ marginRight: '4px' }} />
              {part}
            </span>
          ),
        });
      });
    }

    // Add file
    items.push({
      key: 'file',
      title: (
        <span style={{ color: '#ccc' }}>
          {icon}
          {fileName}
        </span>
      ),
    });

    // If it's a table file, show the table name
    const table = schema.tables.find(t => t.sourceFile === activeFilePath);
    if (table) {
      items.push({
        key: 'table',
        title: (
          <span style={{ color: '#58a6ff' }}>
            <TableOutlined style={{ marginRight: '4px' }} />
            {table.name}
          </span>
        ),
      });
    }

    // If it's an enum file, show the type name
    const enumType = schema.types.find(t => t.sourceFile === activeFilePath);
    if (enumType) {
      items.push({
        key: 'enum',
        title: (
          <span style={{ color: '#d2a8ff' }}>
            <UnorderedListOutlined style={{ marginRight: '4px' }} />
            {enumType.name}
          </span>
        ),
      });
    }
  }

  return (
    <div style={styles.container}>
      <AntBreadcrumb
        items={items}
        separator={<span style={{ color: '#555' }}>/</span>}
      />
    </div>
  );
}

export default Breadcrumb;
