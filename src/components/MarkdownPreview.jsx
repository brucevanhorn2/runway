import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true,
  headerIds: true,
  mangle: false,
});

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
    padding: '24px 32px',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    lineHeight: '1.6',
  },
};

// Custom CSS for markdown content
const markdownStyles = `
  .markdown-body {
    color: #d4d4d4;
  }

  .markdown-body h1 {
    font-size: 2em;
    border-bottom: 1px solid #333;
    padding-bottom: 0.3em;
    margin-top: 24px;
    margin-bottom: 16px;
    color: #e6db74;
  }

  .markdown-body h2 {
    font-size: 1.5em;
    border-bottom: 1px solid #333;
    padding-bottom: 0.3em;
    margin-top: 24px;
    margin-bottom: 16px;
    color: #66d9ef;
  }

  .markdown-body h3 {
    font-size: 1.25em;
    margin-top: 24px;
    margin-bottom: 16px;
    color: #a6e22e;
  }

  .markdown-body h4, .markdown-body h5, .markdown-body h6 {
    margin-top: 24px;
    margin-bottom: 16px;
    color: #fd971f;
  }

  .markdown-body p {
    margin-top: 0;
    margin-bottom: 16px;
  }

  .markdown-body a {
    color: #58a6ff;
    text-decoration: none;
  }

  .markdown-body a:hover {
    text-decoration: underline;
  }

  .markdown-body code {
    background: #2d2d2d;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: 'Fira Code', 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
    color: #f92672;
  }

  .markdown-body pre {
    background: #2d2d2d;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 16px 0;
  }

  .markdown-body pre code {
    background: none;
    padding: 0;
    color: #d4d4d4;
  }

  .markdown-body blockquote {
    border-left: 4px solid #58a6ff;
    margin: 0;
    padding: 0 16px;
    color: #8b949e;
  }

  .markdown-body ul, .markdown-body ol {
    padding-left: 2em;
    margin-bottom: 16px;
  }

  .markdown-body li {
    margin: 4px 0;
  }

  .markdown-body table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
  }

  .markdown-body th, .markdown-body td {
    border: 1px solid #333;
    padding: 8px 12px;
    text-align: left;
  }

  .markdown-body th {
    background: #252526;
    color: #e6db74;
    font-weight: 600;
  }

  .markdown-body tr:nth-child(even) {
    background: #252526;
  }

  .markdown-body hr {
    border: none;
    border-top: 1px solid #333;
    margin: 24px 0;
  }

  .markdown-body img {
    max-width: 100%;
    height: auto;
  }

  .markdown-body strong {
    color: #f8f8f2;
  }

  .markdown-body em {
    color: #fd971f;
  }
`;

function MarkdownPreview({ content }) {
  const html = useMemo(() => {
    try {
      return marked.parse(content || '');
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return '<p>Error rendering markdown</p>';
    }
  }, [content]);

  return (
    <>
      <style>{markdownStyles}</style>
      <div style={styles.container}>
        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </>
  );
}

export default MarkdownPreview;
