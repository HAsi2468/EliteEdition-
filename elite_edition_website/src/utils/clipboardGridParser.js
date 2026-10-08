/**
 * Excel / TSV / CSV Clipboard Grid Parser & Validator
 * 
 * Principal Enterprise Architecture utility for bulk pasting data from:
 * - Microsoft Excel
 * - Google Sheets
 * - LibreOffice Calc / TSV / CSV text
 * 
 * Supports:
 * - Tab-separated (\t) and newline-separated (\r?\n) cell grid parsing
 * - Excel quoting & escaped double quotes ("") handling
 * - Automatic schema column matching & header detection
 * - Type coercion (number, currency, meterage, date, select, text)
 * - Immediate validation status & error tracking per row/cell
 */

/**
 * Parse raw clipboard text into a 2D array of strings
 * @param {string} rawText 
 * @returns {string[][]}
 */
export function parseClipboardTextToGrid(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const nextChar = rawText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote inside quoted cell
        currentCell += '"';
        i++; // skip next quote
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === '\t' && !insideQuotes) {
      // Cell boundary (Tab)
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // Row boundary
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Push final cell and row if pending
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Clean & coerce financial / numeric strings into numbers
 * Handles: "₹ 1,250.50", "$120.00", "1,500 mtr", " -250 "
 */
export function parseNumericCell(val, defaultValue = 0) {
  if (val === null || val === undefined || val === '') return defaultValue;
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val;

  // Strip currency symbols, commas, meterage text, whitespace
  const cleaned = String(val)
    .replace(/[₹$€£\s,]/g, '')
    .replace(/(mtr|m|kg|pcs|units|rolls)/gi, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Validate a single cell value against column schema
 */
export function validateCell(val, columnDef) {
  if (!columnDef) return { valid: true, value: val };

  const { type = 'string', required = false, min, max, options = [] } = columnDef;
  const isBlank = val === undefined || val === null || String(val).trim() === '';

  if (required && isBlank) {
    return { valid: false, error: `${columnDef.header || columnDef.key} is required`, value: val };
  }

  if (isBlank) {
    return { valid: true, value: type === 'number' ? 0 : '' };
  }

  switch (type) {
    case 'number':
    case 'currency':
    case 'meterage': {
      const num = parseNumericCell(val, NaN);
      if (isNaN(num)) {
        return { valid: false, error: `Invalid number: "${val}"`, value: val };
      }
      if (min !== undefined && num < min) {
        return { valid: false, error: `Minimum value is ${min}`, value: num };
      }
      if (max !== undefined && num > max) {
        return { valid: false, error: `Maximum value is ${max}`, value: num };
      }
      return { valid: true, value: num };
    }

    case 'date': {
      const parsedDate = new Date(val);
      if (isNaN(parsedDate.getTime())) {
        return { valid: false, error: `Invalid date format: "${val}"`, value: val };
      }
      return { valid: true, value: parsedDate.toISOString().split('T')[0] };
    }

    case 'select': {
      if (options.length > 0) {
        const match = options.find(opt => 
          String(opt).toLowerCase() === String(val).toLowerCase()
        );
        if (!match) {
          return { valid: false, error: `Invalid option: "${val}"`, value: val };
        }
        return { valid: true, value: match };
      }
      return { valid: true, value: String(val).trim() };
    }

    case 'string':
    default:
      return { valid: true, value: String(val).trim() };
  }
}

/**
 * Attempt to auto-map columns by matching header text against schema
 */
export function detectColumnMapping(firstRow, schemaColumns) {
  const mapping = {};

  if (!Array.isArray(firstRow) || !Array.isArray(schemaColumns)) {
    return mapping;
  }

  firstRow.forEach((cell, colIndex) => {
    const cleanHeader = String(cell || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedCol = schemaColumns.find(col => {
      const colKeyClean = col.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const colHeaderClean = (col.header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return colKeyClean === cleanHeader || colHeaderClean === cleanHeader;
    });

    if (matchedCol) {
      mapping[colIndex] = matchedCol.key;
    } else if (schemaColumns[colIndex]) {
      // Fallback by sequential index
      mapping[colIndex] = schemaColumns[colIndex].key;
    }
  });

  return mapping;
}

/**
 * Parse and validate clipboard raw text into structured schema records
 */
export function parseAndValidateClipboardData(rawText, schemaColumns, options = {}) {
  const { hasHeaderRow = true, columnMapping = null } = options;
  const grid = parseClipboardTextToGrid(rawText);

  if (grid.length === 0) {
    return { rows: [], totalCount: 0, validCount: 0, errorCount: 0, detectedHeader: false };
  }

  let dataRows = grid;
  let activeMapping = columnMapping;

  // Header detection
  const firstRow = grid[0];
  const looksLikeHeader = firstRow.some(cell => 
    schemaColumns.some(col => 
      col.header?.toLowerCase() === String(cell).toLowerCase() ||
      col.key?.toLowerCase() === String(cell).toLowerCase()
    )
  );

  if (hasHeaderRow || looksLikeHeader) {
    if (!activeMapping) {
      activeMapping = detectColumnMapping(firstRow, schemaColumns);
    }
    dataRows = grid.slice(1);
  } else if (!activeMapping) {
    // Sequential fallback mapping
    activeMapping = {};
    schemaColumns.forEach((col, idx) => {
      activeMapping[idx] = col.key;
    });
  }

  const columnMapByKey = {};
  schemaColumns.forEach(col => {
    columnMapByKey[col.key] = col;
  });

  const parsedRows = dataRows.map((rawRow, rowIndex) => {
    const rowData = {};
    const rowErrors = {};
    let isRowValid = true;

    // Map each cell to schema key
    Object.entries(activeMapping).forEach(([colIdxStr, schemaKey]) => {
      const colIdx = parseInt(colIdxStr, 10);
      const rawCellVal = rawRow[colIdx] ?? '';
      const columnDef = columnMapByKey[schemaKey];

      if (columnDef) {
        const validation = validateCell(rawCellVal, columnDef);
        rowData[schemaKey] = validation.value;
        if (!validation.valid) {
          rowErrors[schemaKey] = validation.error;
          isRowValid = false;
        }
      }
    });

    // Populate missing schema keys with default values
    schemaColumns.forEach(col => {
      if (rowData[col.key] === undefined) {
        if (col.required) {
          rowErrors[col.key] = `${col.header || col.key} is missing`;
          isRowValid = false;
        }
        rowData[col.key] = col.defaultValue ?? (col.type === 'number' ? 0 : '');
      }
    });

    return {
      rowIndex: rowIndex + 1,
      isValid: isRowValid,
      errors: rowErrors,
      data: rowData,
      rawCells: rawRow
    };
  });

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

  return {
    rows: parsedRows,
    totalCount: parsedRows.length,
    validCount,
    errorCount,
    mapping: activeMapping,
    detectedHeader: looksLikeHeader
  };
}
