/**
 * Tokenized Filter Query Parser & Evaluator
 * 
 * Enterprise parser for structured query syntax:
 * Example: 'status:pending meters:>100 party:"meera tex" cotton'
 * 
 * Returns:
 * - tokens: [{ key: 'status', operator: '=', value: 'pending' }, { key: 'meters', operator: '>', value: 100 }, ...]
 * - freeText: "cotton"
 */

/**
 * Parse raw text into structured tokens and free text
 * @param {string} queryString 
 * @param {Array<{key: string, label: string, type: string}>} filterFields
 * @returns {{ tokens: Array, freeText: string }}
 */
export function parseFilterQuery(queryString = '', filterFields = []) {
  if (!queryString || typeof queryString !== 'string') {
    return { tokens: [], freeText: '' };
  }

  const tokens = [];
  let freeTextParts = [];

  // Match: key:(operator)?(quotedValue|value) OR free word
  // e.g. status:pending, meters:>100, party:"meera enterprise", silk
  const regex = /(\b[a-zA-Z0-9_-]+):((?:>=|<=|>|<|!=|=)?)(?:"([^"]*)"|'([^']*)'|([^\s]+))|(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;

  let match;
  while ((match = regex.exec(queryString)) !== null) {
    if (match[1]) {
      // Keyed filter token
      const key = match[1].toLowerCase();
      const op = match[2] || '=';
      const val = match[3] ?? match[4] ?? match[5] ?? '';

      // Match against known filterFields if provided
      const fieldDef = filterFields.find(f => f.key.toLowerCase() === key || (f.alias && f.alias.includes(key)));

      tokens.push({
        id: `tok_${Math.random().toString(36).substr(2, 9)}`,
        key: fieldDef ? fieldDef.key : key,
        label: fieldDef ? fieldDef.label : key,
        operator: op,
        value: fieldDef?.type === 'number' || !isNaN(Number(val)) ? (isNaN(Number(val)) ? val : Number(val)) : val,
        raw: `${key}:${op}${val}`
      });
    } else {
      // Free text term
      const freeWord = match[6] ?? match[7] ?? match[8];
      if (freeWord) {
        freeTextParts.push(freeWord);
      }
    }
  }

  return {
    tokens,
    freeText: freeTextParts.join(' ').trim()
  };
}

/**
 * Re-serialize tokens and freeText back into a clean query string
 */
export function serializeFilterQuery(tokens = [], freeText = '') {
  const tokenStrings = tokens.map(tok => {
    const valStr = typeof tok.value === 'string' && tok.value.includes(' ') ? `"${tok.value}"` : tok.value;
    const opStr = tok.operator && tok.operator !== '=' ? tok.operator : '';
    return `${tok.key}:${opStr}${valStr}`;
  });

  if (freeText.trim()) {
    tokenStrings.push(freeText.trim());
  }

  return tokenStrings.join(' ');
}

/**
 * Evaluate record against tokens and free text
 */
export function evaluateRecordAgainstFilter(record, tokens = [], freeText = '') {
  if (!record || typeof record !== 'object') return false;

  // 1. Check all token conditions (AND logic)
  for (const tok of tokens) {
    const recordVal = record[tok.key];
    const targetVal = tok.value;
    const op = tok.operator || '=';

    if (recordVal === undefined || recordVal === null) return false;

    if (typeof targetVal === 'number') {
      const numRec = typeof recordVal === 'number' ? recordVal : parseFloat(String(recordVal).replace(/[^0-9.-]/g, ''));
      if (isNaN(numRec)) return false;

      switch (op) {
        case '>': if (!(numRec > targetVal)) return false; break;
        case '>=': if (!(numRec >= targetVal)) return false; break;
        case '<': if (!(numRec < targetVal)) return false; break;
        case '<=': if (!(numRec <= targetVal)) return false; break;
        case '!=': if (!(numRec !== targetVal)) return false; break;
        case '=':
        default:
          if (!(numRec === targetVal)) return false; break;
      }
    } else {
      const strRec = String(recordVal).toLowerCase();
      const strTarget = String(targetVal).toLowerCase();

      switch (op) {
        case '!=':
          if (strRec === strTarget) return false;
          break;
        case '=':
        default:
          if (!strRec.includes(strTarget)) return false;
          break;
      }
    }
  }

  // 2. Check free text match across all string values
  if (freeText.trim()) {
    const q = freeText.toLowerCase();
    const hasMatch = Object.values(record).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(q)
    );
    if (!hasMatch) return false;
  }

  return true;
}
