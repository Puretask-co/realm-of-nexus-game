import { EventBus } from '../core/EventBus.js';
import { DataManager } from './DataManager.js';

/**
 * CSVDataLoader - Import/export game data as CSV for non-programmer contributions.
 * Supports parsing CSV files into JSON data and exporting JSON data back to CSV.
 * Enables designers and content creators to use spreadsheets for game balancing.
 */
export class CSVDataLoader {
  static instance = null;

  constructor() {
    if (CSVDataLoader.instance) return CSVDataLoader.instance;
    this.eventBus = EventBus.getInstance();
    this.dataManager = DataManager.getInstance();

    // Type coercion rules per data category
    this.typeCoercions = {
      spells: {
        sapCost: 'number',
        damage: 'number',
        cooldown: 'number',
        range: 'number',
        areaOfEffect: 'number',
        castTime: 'number',
        tier: 'number',
        unlockLevel: 'number'
      },
      enemies: {
        health: 'number',
        damage: 'number',
        defense: 'number',
        speed: 'number',
        attackRange: 'number',
        attackSpeed: 'number',
        experienceReward: 'number',
        tier: 'number'
      },
      items: {
        value: 'number',
        maxStack: 'number',
        stackable: 'boolean'
      }
    };

    CSVDataLoader.instance = this;
  }

  static getInstance() {
    if (!CSVDataLoader.instance) new CSVDataLoader();
    return CSVDataLoader.instance;
  }

  // ─── CSV Parsing ──────────────────────────────────────────────────

  parseCSV(csvText, options = {}) {
    const {
      delimiter = ',',
      hasHeaders = true,
      trimWhitespace = true,
      skipEmptyRows = true
    } = options;

    const rows = this.splitCSVRows(csvText);
    if (rows.length === 0) return [];

    let headers = [];
    let dataStartIndex = 0;

    if (hasHeaders) {
      headers = this.parseCSVRow(rows[0], delimiter);
      if (trimWhitespace) headers = headers.map(h => h.trim());
      dataStartIndex = 1;
    }

    const results = [];

    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (skipEmptyRows && row.trim() === '') continue;

      const values = this.parseCSVRow(row, delimiter);
      if (trimWhitespace) {
        for (let j = 0; j < values.length; j++) {
          if (typeof values[j] === 'string') values[j] = values[j].trim();
        }
      }

      if (hasHeaders) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = j < values.length ? values[j] : '';
        }
        results.push(obj);
      } else {
        results.push(values);
      }
    }

    return results;
  }

  splitCSVRows(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\n' || (char === '\r' && text[i + 1] === '\n')) && !inQuotes) {
        rows.push(current);
        current = '';
        if (char === '\r') i++; // Skip \n in \r\n
      } else {
        current += char;
      }
    }

    if (current.length > 0) rows.push(current);
    return rows;
  }

  parseCSVRow(row, delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  // ─── Type Coercion ────────────────────────────────────────────────

  applyTypeCoercions(entries, dataKey) {
    const coercions = this.typeCoercions[dataKey];
    if (!coercions) return entries;

    return entries.map(entry => {
      const coerced = { ...entry };
      for (const [field, type] of Object.entries(coercions)) {
        if (coerced[field] !== undefined && coerced[field] !== '') {
          switch (type) {
            case 'number':
              coerced[field] = Number(coerced[field]);
              if (isNaN(coerced[field])) coerced[field] = 0;
              break;
            case 'boolean':
              coerced[field] = coerced[field] === 'true' || coerced[field] === '1' || coerced[field] === true;
              break;
            case 'json':
              try { coerced[field] = JSON.parse(coerced[field]); }
              catch { /* keep as string */ }
              break;
          }
        }
      }
      return coerced;
    });
  }

  // ─── Nested Field Handling ────────────────────────────────────────

  unflattenEntry(flatEntry) {
    const nested = {};

    for (const [key, value] of Object.entries(flatEntry)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = nested;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
      } else if (key.includes('[]')) {
        // Array notation: "tags[]" -> parse comma-separated value
        const cleanKey = key.replace('[]', '');
        nested[cleanKey] = typeof value === 'string' ? value.split('|').map(v => v.trim()).filter(v => v) : value;
      } else {
        nested[key] = value;
      }
    }

    return nested;
  }

  flattenEntry(entry, prefix = '') {
    const flat = {};

    for (const [key, value] of Object.entries(entry)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          flat[fullKey] = JSON.stringify(value);
        } else {
          flat[`${key}[]`] = value.join('|');
        }
      } else if (typeof value === 'object' && value !== null) {
        const subFlat = this.flattenEntry(value, fullKey);
        Object.assign(flat, subFlat);
      } else {
        flat[fullKey] = value;
      }
    }

    return flat;
  }

  // ─── Import ───────────────────────────────────────────────────────

  importCSV(csvText, dataKey, options = {}) {
    const { merge = false, validate = true } = options;

    // Parse CSV
    let entries = this.parseCSV(csvText);

    // Unflatten nested fields
    entries = entries.map(e => this.unflattenEntry(e));

    // Apply type coercions
    entries = this.applyTypeCoercions(entries, dataKey);

    // Merge or replace
    if (merge) {
      const existing = this.dataManager.data[dataKey] || [];
      const existingMap = new Map(existing.map(e => [e.id, e]));

      for (const entry of entries) {
        if (entry.id && existingMap.has(entry.id)) {
          Object.assign(existingMap.get(entry.id), entry);
        } else {
          existing.push(entry);
        }
      }
      this.dataManager.data[dataKey] = existing;
    } else {
      this.dataManager.data[dataKey] = entries;
    }

    // Validate and rebuild
    if (validate) {
      this.dataManager.validateAllData();
    }
    this.dataManager.buildCaches();

    this.eventBus.emit('csv:imported', {
      dataKey,
      count: entries.length,
      merged: merge
    });

    return entries;
  }

  async importCSVFromFile(file, dataKey, options = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const entries = this.importCSV(e.target.result, dataKey, options);
          resolve(entries);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  }

  // ─── Export ───────────────────────────────────────────────────────

  exportToCSV(dataKey, options = {}) {
    const { delimiter = ',', includeHeaders = true, fields = null } = options;

    const data = this.dataManager.data[dataKey];
    if (!Array.isArray(data) || data.length === 0) return '';

    // Flatten all entries
    const flatEntries = data.map(entry => this.flattenEntry(entry));

    // Determine headers
    const headerSet = new Set();
    for (const flat of flatEntries) {
      for (const key of Object.keys(flat)) {
        headerSet.add(key);
      }
    }
    const headers = fields || Array.from(headerSet);

    // Build CSV
    const rows = [];
    if (includeHeaders) {
      rows.push(headers.map(h => this.escapeCSVValue(h, delimiter)).join(delimiter));
    }

    for (const flat of flatEntries) {
      const row = headers.map(header => {
        const value = flat[header];
        return this.escapeCSVValue(value !== undefined ? String(value) : '', delimiter);
      });
      rows.push(row.join(delimiter));
    }

    return rows.join('\n');
  }

  escapeCSVValue(value, delimiter = ',') {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  downloadCSV(dataKey, filename = null) {
    const csv = this.exportToCSV(dataKey);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || `${dataKey}_export.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    this.eventBus.emit('csv:exported', { dataKey, filename: link.download });
  }

  // ─── Templates ────────────────────────────────────────────────────

  generateTemplate(dataKey) {
    const schema = this.dataManager.schemas[dataKey];
    if (!schema) return '';

    const headers = [];
    const exampleRow = [];

    if (schema.properties) {
      for (const [field, rules] of Object.entries(schema.properties)) {
        if (rules.type === 'object' || rules.type === 'array') continue;
        headers.push(field);
        exampleRow.push(this.getExampleValue(rules));
      }
    }

    return headers.join(',') + '\n' + exampleRow.join(',');
  }

  getExampleValue(rules) {
    if (rules.enum) return rules.enum[0];
    switch (rules.type) {
      case 'string': return 'example';
      case 'number': return rules.min || 0;
      case 'boolean': return 'false';
      default: return '';
    }
  }
}

export default CSVDataLoader;
