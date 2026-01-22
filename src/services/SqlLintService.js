/**
 * SQL Linting Service using dt-sql-parser
 *
 * Provides syntax validation for PostgreSQL with line/column positions.
 */

import { PostgreSQL } from 'dt-sql-parser';

class SqlLintService {
  constructor() {
    this.parser = new PostgreSQL();
  }

  /**
   * Validate SQL content and return errors/warnings
   * @param {string} content - SQL content to validate
   * @returns {Array<{severity: 'error'|'warning', message: string, startLine: number, startColumn: number, endLine: number, endColumn: number}>}
   */
  validate(content) {
    const issues = [];

    try {
      // Parse and get syntax errors
      const errors = this.parser.validate(content);

      for (const error of errors) {
        issues.push({
          severity: 'error',
          message: error.message || 'Syntax error',
          startLine: error.startLine || 1,
          startColumn: error.startCol || 1,
          endLine: error.endLine || error.startLine || 1,
          endColumn: error.endCol || (error.startCol ? error.startCol + 1 : 2),
        });
      }
    } catch (e) {
      // If parser completely fails, report a general error
      console.error('[SqlLint] Parser error:', e);
    }

    // Add custom PostgreSQL-specific warnings
    const warnings = this.checkBestPractices(content);
    issues.push(...warnings);

    return issues;
  }

  /**
   * Check for best practices and common issues
   * @param {string} content - SQL content
   * @returns {Array<{severity: 'warning', message: string, startLine: number, startColumn: number, endLine: number, endColumn: number}>}
   */
  checkBestPractices(content) {
    const warnings = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const upperLine = line.toUpperCase();
      const trimmedLine = line.trim();

      // Skip comments
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Warning: Using TEXT without explicit length constraint
      // (not always an issue, but worth noting)
      // Skipping this one - TEXT is perfectly valid in PostgreSQL

      // Warning: Using SERIAL instead of IDENTITY (PostgreSQL 10+)
      if (/\bSERIAL\b/i.test(line) && !/BIGSERIAL/i.test(line)) {
        const match = line.match(/\bSERIAL\b/i);
        if (match) {
          warnings.push({
            severity: 'warning',
            message: 'Consider using GENERATED ALWAYS AS IDENTITY instead of SERIAL for PostgreSQL 10+',
            startLine: lineNumber,
            startColumn: match.index + 1,
            endLine: lineNumber,
            endColumn: match.index + 7,
          });
        }
      }

      // Warning: Missing ON DELETE clause for foreign key
      if (/REFERENCES\s+\w+/i.test(line) && !/ON\s+DELETE/i.test(upperLine)) {
        const match = line.match(/REFERENCES/i);
        if (match) {
          warnings.push({
            severity: 'warning',
            message: 'Consider specifying ON DELETE behavior (CASCADE, SET NULL, RESTRICT, etc.)',
            startLine: lineNumber,
            startColumn: match.index + 1,
            endLine: lineNumber,
            endColumn: match.index + 11,
          });
        }
      }

      // Warning: VARCHAR without length
      if (/VARCHAR\s*(?!\()/i.test(line)) {
        const match = line.match(/VARCHAR(?!\s*\()/i);
        if (match) {
          warnings.push({
            severity: 'warning',
            message: 'VARCHAR without length is equivalent to TEXT; consider specifying a length or using TEXT explicitly',
            startLine: lineNumber,
            startColumn: match.index + 1,
            endLine: lineNumber,
            endColumn: match.index + 8,
          });
        }
      }

      // Warning: TIMESTAMP without timezone
      if (/\bTIMESTAMP\b/i.test(line) && !/TIMESTAMP\s*WITH\s*TIME\s*ZONE/i.test(upperLine) && !/TIMESTAMPTZ/i.test(upperLine)) {
        const match = line.match(/\bTIMESTAMP\b/i);
        if (match) {
          // Check it's not followed by "WITH TIME ZONE"
          const afterMatch = line.substring(match.index + 9).trim().toUpperCase();
          if (!afterMatch.startsWith('WITH') && !afterMatch.startsWith('TZ')) {
            warnings.push({
              severity: 'warning',
              message: 'Consider using TIMESTAMPTZ (TIMESTAMP WITH TIME ZONE) for timezone-aware timestamps',
              startLine: lineNumber,
              startColumn: match.index + 1,
              endLine: lineNumber,
              endColumn: match.index + 10,
            });
          }
        }
      }

      // Warning: Using FLOAT instead of NUMERIC for financial data (heuristic: column name contains price/amount/money/cost)
      if (/\b(FLOAT|REAL|DOUBLE\s+PRECISION)\b/i.test(line)) {
        const columnNameMatch = line.match(/(\w+)\s+(FLOAT|REAL|DOUBLE\s+PRECISION)/i);
        if (columnNameMatch) {
          const colName = columnNameMatch[1].toLowerCase();
          if (/price|amount|money|cost|balance|total|fee|rate/.test(colName)) {
            const typeMatch = line.match(/\b(FLOAT|REAL|DOUBLE\s+PRECISION)\b/i);
            if (typeMatch) {
              warnings.push({
                severity: 'warning',
                message: 'Consider using NUMERIC/DECIMAL for financial data to avoid floating-point precision issues',
                startLine: lineNumber,
                startColumn: typeMatch.index + 1,
                endLine: lineNumber,
                endColumn: typeMatch.index + typeMatch[0].length + 1,
              });
            }
          }
        }
      }
    });

    return warnings;
  }
}

// Singleton instance
const sqlLintService = new SqlLintService();
export default sqlLintService;
