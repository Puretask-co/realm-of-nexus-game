/**
 * CSVDataLoader - Import/Export game data as CSV.
 *
 * Enables non-programmers to work with game data in spreadsheet tools
 * (Google Sheets, Excel) and import the results back into the game.
 *
 * Capabilities:
 *   - Parse CSV text (handles quoted values with embedded commas)
 *   - Automatically convert string values to numbers, booleans, arrays, objects
 *   - Export any data array to CSV format with proper escaping
 *   - Download CSV files from the browser
 *   - Load remote CSV (e.g. from a published Google Sheet)
 */

class CSVDataLoader {
  /**
   * @param {import('./DataManager.js').default} dataManager
   */
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  // ------------------------------------------------------------------
  // Parsing
  // ------------------------------------------------------------------

  /**
   * Parse CSV text into an array of objects.
   * The first line is treated as headers.
   * @param {string} csvText
   * @returns {Object[]}
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this._parseLine(lines[0]).map((h) => h.trim());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this._parseLine(lines[i]);
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = this._convertValue(values[idx] || '');
      });
      results.push(obj);
    }

    return results;
  }

  /**
   * Parse a single CSV line, respecting quoted fields.
   * @param {string} line
   * @returns {string[]}
   */
  _parseLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values;
  }

  /**
   * Heuristically convert a string to the most appropriate JS type.
   * @param {string} str
   * @returns {*}
   */
  _convertValue(str) {
    str = str.trim();
    if (str === '') return '';
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (!isNaN(str) && str !== '') {
      return str.includes('.') ? parseFloat(str) : parseInt(str, 10);
    }
    if (str.startsWith('[') && str.endsWith(']')) {
      try { return JSON.parse(str); } catch (_) { /* fall through */ }
    }
    if (str.startsWith('{') && str.endsWith('}')) {
      try { return JSON.parse(str); } catch (_) { /* fall through */ }
    }
    return str;
  }

  // ------------------------------------------------------------------
  // Remote loading
  // ------------------------------------------------------------------

  /**
   * Fetch a CSV file from a URL and parse it.
   * Useful for loading from a published Google Sheet.
   * @param {string} url
   * @returns {Promise<Object[]>}
   */
  async loadFromURL(url) {
    const res = await fetch(url);
    const text = await res.text();
    const data = this.parseCSV(text);
    console.log(`[CSVDataLoader] Loaded ${data.length} rows from URL`);
    return data;
  }

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------

  /**
   * Convert an array of objects to CSV text.
   * @param {Object[]} data
   * @returns {string}
   */
  toCSV(data) {
    if (!data.length) return '';

    // Collect all unique keys across every object
    const keySet = new Set();
    data.forEach((obj) => Object.keys(obj).forEach((k) => keySet.add(k)));
    const headers = Array.from(keySet);

    let csv = headers.join(',') + '\n';

    data.forEach((obj) => {
      const row = headers.map((h) => {
        const val = obj[h];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        const s = String(val);
        return s.includes(',') ? `"${s}"` : s;
      });
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Export current spells to CSV.
   */
  exportSpellsCSV() {
    return this.toCSV(this.dataManager.getAllSpells());
  }

  /**
   * Export current enemies to CSV.
   */
  exportEnemiesCSV() {
    return this.toCSV(this.dataManager.getAllEnemies());
  }

  /**
   * Trigger a CSV file download in the browser.
   * @param {string} filename
   * @param {string} csvContent
   */
  downloadCSV(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export default CSVDataLoader;
