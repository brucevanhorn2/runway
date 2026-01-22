/**
 * Spell Check Service using Typo.js with Hunspell dictionaries
 *
 * Provides spell checking for SQL comments and string literals.
 */

import Typo from 'typo-js';

class SpellCheckService {
  constructor() {
    this.dictionary = null;
    this.isLoaded = false;
    this.loadPromise = null;
    this.customWords = new Set(); // User's custom dictionary
  }

  /**
   * Initialize the spell checker with en_US dictionary
   */
  async initialize() {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadDictionary();
    return this.loadPromise;
  }

  async _loadDictionary() {
    try {
      // In Electron, we need to load dictionary files
      // Typo.js can load asynchronously with affData and dicData
      const [affData, dicData] = await Promise.all([
        this._loadDictionaryFile('en_US.aff'),
        this._loadDictionaryFile('en_US.dic'),
      ]);

      this.dictionary = new Typo('en_US', affData, dicData);
      this.isLoaded = true;
      console.log('[SpellCheck] Dictionary loaded successfully');
      return true;
    } catch (error) {
      console.error('[SpellCheck] Failed to load dictionary:', error);
      this.isLoaded = false;
      return false;
    }
  }

  async _loadDictionaryFile(filename) {
    // Try to load via electron IPC first
    if (window.electron?.loadDictionaryFile) {
      const result = await window.electron.loadDictionaryFile(filename);
      if (result.success) {
        return result.content;
      }
    }

    // Fallback: try to fetch from node_modules path (dev mode)
    try {
      const response = await fetch(`/dictionaries/${filename}`);
      if (response.ok) {
        return await response.text();
      }
    } catch (_e) {
      // Ignore fetch errors
    }

    throw new Error(`Could not load dictionary file: ${filename}`);
  }

  /**
   * Check if a word is spelled correctly
   * @param {string} word - The word to check
   * @returns {boolean} - True if spelled correctly
   */
  check(word) {
    if (!this.isLoaded || !this.dictionary) {
      return true; // Don't flag words if dictionary isn't loaded
    }

    // Skip very short words, numbers, and SQL keywords
    if (word.length < 2 || /^\d+$/.test(word) || this._isSqlKeyword(word)) {
      return true;
    }

    // Check custom dictionary first
    if (this.customWords.has(word.toLowerCase())) {
      return true;
    }

    return this.dictionary.check(word);
  }

  /**
   * Get spelling suggestions for a misspelled word
   * @param {string} word - The misspelled word
   * @returns {string[]} - Array of suggestions
   */
  suggest(word) {
    if (!this.isLoaded || !this.dictionary) {
      return [];
    }

    return this.dictionary.suggest(word).slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Add a word to the custom dictionary
   * @param {string} word - Word to add
   */
  addToCustomDictionary(word) {
    this.customWords.add(word.toLowerCase());
    // Persist custom words
    this._saveCustomDictionary();
  }

  /**
   * Check if word is a SQL keyword (shouldn't be spell-checked)
   */
  _isSqlKeyword(word) {
    const sqlKeywords = new Set([
      // DDL Keywords
      'create', 'table', 'type', 'enum', 'sequence', 'index', 'constraint',
      'primary', 'key', 'foreign', 'references', 'unique', 'check', 'default',
      'not', 'null', 'auto', 'increment', 'serial', 'bigserial', 'smallserial',
      'alter', 'drop', 'add', 'column', 'cascade', 'restrict', 'if', 'exists',
      'schema', 'database', 'grant', 'revoke', 'on', 'to', 'from', 'with',

      // Data types
      'integer', 'int', 'bigint', 'smallint', 'decimal', 'numeric', 'real',
      'double', 'precision', 'float', 'char', 'varchar', 'text', 'boolean',
      'bool', 'date', 'time', 'timestamp', 'timestamptz', 'interval', 'uuid',
      'json', 'jsonb', 'array', 'bytea', 'inet', 'cidr', 'macaddr', 'money',

      // DML Keywords
      'select', 'insert', 'update', 'delete', 'into', 'values', 'set', 'where',
      'and', 'or', 'in', 'between', 'like', 'ilike', 'is', 'as', 'join',
      'inner', 'outer', 'left', 'right', 'full', 'cross', 'natural', 'using',
      'order', 'by', 'asc', 'desc', 'nulls', 'first', 'last', 'limit', 'offset',
      'group', 'having', 'distinct', 'all', 'union', 'intersect', 'except',
      'case', 'when', 'then', 'else', 'end', 'cast', 'coalesce', 'nullif',

      // Functions
      'now', 'current', 'timestamp', 'gen', 'random', 'uuid', 'nextval',
      'currval', 'setval', 'count', 'sum', 'avg', 'min', 'max', 'lower',
      'upper', 'trim', 'substring', 'length', 'concat', 'replace',

      // PostgreSQL specific
      'tablespace', 'owner', 'inherits', 'partition', 'returning', 'conflict',
      'nothing', 'do', 'excluded', 'lateral', 'rows', 'range', 'groups',
      'window', 'over', 'within', 'filter', 'materialized', 'view', 'temporary',
      'temp', 'unlogged', 'logged', 'storage', 'plain', 'external', 'extended',
      'main', 'fillfactor', 'autovacuum', 'toast', 'analyze', 'vacuum',

      // Common abbreviations in SQL contexts
      'id', 'pk', 'fk', 'idx', 'seq', 'tbl', 'col', 'val', 'num', 'str',
      'dt', 'ts', 'tz', 'utc', 'api', 'url', 'uri', 'src', 'dst', 'tmp',
    ]);

    return sqlKeywords.has(word.toLowerCase());
  }

  /**
   * Extract words from SQL comments and string literals
   * @param {string} sql - SQL content
   * @returns {Array<{word: string, line: number, startColumn: number, endColumn: number}>}
   */
  extractCheckableText(sql) {
    const words = [];
    const lines = sql.split('\n');

    lines.forEach((line, lineIndex) => {
      // Extract single-line comments (-- comment)
      const singleLineComment = line.match(/--\s*(.*)$/);
      if (singleLineComment) {
        const commentStart = line.indexOf('--') + 2;
        this._extractWordsFromText(singleLineComment[1], lineIndex, commentStart, words);
      }
    });

    // Extract multi-line comments (/* comment */)
    const multiLineRegex = /\/\*[\s\S]*?\*\//g;
    let match;
    while ((match = multiLineRegex.exec(sql)) !== null) {
      const commentContent = match[0].slice(2, -2); // Remove /* and */
      const startPos = this._getLineAndColumn(sql, match.index + 2);
      this._extractWordsFromMultilineText(commentContent, startPos.line, startPos.column, words);
    }

    // Extract string literals ('string' or "string") - for COMMENT ON statements
    const stringRegex = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g;
    while ((match = stringRegex.exec(sql)) !== null) {
      const stringContent = match[0].slice(1, -1); // Remove quotes
      const startPos = this._getLineAndColumn(sql, match.index + 1);
      this._extractWordsFromText(stringContent, startPos.line, startPos.column, words);
    }

    return words;
  }

  _extractWordsFromText(text, lineNumber, columnOffset, results) {
    // Match words (letters only, including apostrophes for contractions)
    const wordRegex = /[a-zA-Z][a-zA-Z']*[a-zA-Z]|[a-zA-Z]{2,}/g;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      results.push({
        word: match[0],
        line: lineNumber + 1, // Monaco uses 1-based lines
        startColumn: columnOffset + match.index + 1, // Monaco uses 1-based columns
        endColumn: columnOffset + match.index + match[0].length + 1,
      });
    }
  }

  _extractWordsFromMultilineText(text, startLine, startColumn, results) {
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      const lineNum = startLine + idx;
      const colOffset = idx === 0 ? startColumn : 0;
      this._extractWordsFromText(line, lineNum - 1, colOffset, results);
    });
  }

  _getLineAndColumn(text, index) {
    const before = text.slice(0, index);
    const lines = before.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length,
    };
  }

  async _saveCustomDictionary() {
    if (window.electron?.saveCustomDictionary) {
      await window.electron.saveCustomDictionary([...this.customWords]);
    }
  }

  async _loadCustomDictionary() {
    if (window.electron?.loadCustomDictionary) {
      const result = await window.electron.loadCustomDictionary();
      if (result?.words) {
        this.customWords = new Set(result.words);
      }
    }
  }
}

// Singleton instance
const spellCheckService = new SpellCheckService();
export default spellCheckService;
