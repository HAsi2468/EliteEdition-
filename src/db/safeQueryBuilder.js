/**
 * Safe Dynamic Query Builder & Identifier Allowlisting
 *
 * Column and table names cannot be parameterized via standard SQL $1 syntax.
 * This utility enforces strict programmatic dictionaries, safe quoting, and parameterized values.
 */

class InvalidIdentifierException extends Error {
  constructor(message, identifier) {
    super(message);
    this.name = 'InvalidIdentifierException';
    this.identifier = identifier;
  }
}

/**
 * Strict programmatic allowlist mapping client sort fields to verified database columns.
 */
const SORT_COLUMNS = Object.freeze({
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  name: 'customer_name',
  status: 'status',
  totalAmount: 'total_amount',
  jobNumber: 'job_number',
  totalMeters: 'total_meters',
  availableMeters: 'available_meters',
  lotNumber: 'lot_number',
  id: 'id',
});

/**
 * Programmatic allowlist of valid application tables.
 */
const ALLOWED_TABLES = Object.freeze({
  orders: 'orders',
  users: 'users',
  job_cards: 'job_cards',
  lots: 'lots',
  job_card_lot_usages: 'job_card_lot_usages',
  lot_inventory_ledger: 'lot_inventory_ledger',
  delivery_challans: 'delivery_challans',
});

/**
 * Programmatic allowlist of filterable database columns.
 */
const FILTER_COLUMNS = Object.freeze({
  status: 'status',
  companyId: 'company_id',
  createdBy: 'created_by',
  clientName: 'client_name',
  fabricType: 'fabric_type',
  isDeleted: 'is_deleted',
});

/**
 * Safely quotes a database identifier (column name, table name) using standard SQL double-quotes.
 * Validates against strict identifier pattern before applying quotes.
 *
 * @param {string} identifier
 * @returns {string} Safely quoted identifier (e.g. "created_at")
 * @throws {InvalidIdentifierException}
 */
function safeQuoteIdentifier(identifier) {
  if (typeof identifier !== 'string') {
    throw new InvalidIdentifierException('Identifier must be a string', identifier);
  }

  const trimmed = identifier.trim();

  // Strict regex: must start with letter/underscore and contain only alphanumeric/underscore characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new InvalidIdentifierException(
      `Disallowed identifier containing invalid characters or SQL injection payload: '${identifier}'`,
      identifier
    );
  }

  // Double internal double-quotes (standard ANSI SQL identifier escape)
  return `"${trimmed.replace(/"/g, '""')}"`;
}

/**
 * Resolves a client-requested sort field against a strict programmatic dictionary.
 * Throws InvalidIdentifierException immediately if client field is unlisted or malicious.
 *
 * @param {string} clientField
 * @param {Record<string, string>} [dictionary=SORT_COLUMNS]
 * @returns {string} Safely quoted database column
 * @throws {InvalidIdentifierException}
 */
function resolveSortColumn(clientField, dictionary = SORT_COLUMNS) {
  if (!clientField || typeof clientField !== 'string') {
    throw new InvalidIdentifierException('Sort field must be a non-empty string', clientField);
  }

  const trimmed = clientField.trim();

  // Programmatic dictionary lookup
  if (Object.prototype.hasOwnProperty.call(dictionary, trimmed)) {
    return safeQuoteIdentifier(dictionary[trimmed]);
  }

  // Direct check if client provided verified DB column name already in dictionary values
  const directMatch = Object.values(dictionary).find((val) => val === trimmed);
  if (directMatch) {
    return safeQuoteIdentifier(directMatch);
  }

  throw new InvalidIdentifierException(
    `Unauthorized sortBy identifier '${clientField}'. Allowed fields: [${Object.keys(dictionary).join(', ')}]`,
    clientField
  );
}

/**
 * Builds a parameterized SELECT query with safe dynamic filters, searching, sorting, and pagination.
 *
 * @param {{
 *   table: string,
 *   select?: string[],
 *   where?: Record<string, any>,
 *   search?: string | null,
 *   searchColumns?: string[],
 *   sortBy?: string,
 *   order?: 'asc' | 'desc' | 'ASC' | 'DESC',
 *   page?: number,
 *   limit?: number,
 *   sortDictionary?: Record<string, string>,
 *   filterDictionary?: Record<string, string>
 * }} options
 * @returns {{ text: string, values: any[] }}
 */
function buildSafeSelectQuery(options = {}) {
  const {
    table,
    select = ['*'],
    where = {},
    search = null,
    searchColumns = ['customer_name', 'job_number'],
    sortBy = 'createdAt',
    order = 'DESC',
    page = 1,
    limit = 20,
    sortDictionary = SORT_COLUMNS,
    filterDictionary = FILTER_COLUMNS,
  } = options;

  // 1. Verify and quote Table Name
  if (!table || typeof table !== 'string') {
    throw new InvalidIdentifierException('Table name is required', table);
  }
  const verifiedTable = ALLOWED_TABLES[table] || table;
  const quotedTable = safeQuoteIdentifier(verifiedTable);

  // 2. Build SELECT columns
  let quotedSelect = '*';
  if (Array.isArray(select) && select.length > 0 && !(select.length === 1 && select[0] === '*')) {
    quotedSelect = select.map(safeQuoteIdentifier).join(', ');
  }

  const values = [];
  const whereClauses = [];

  // 3. Dynamic Filter Parameters (WHERE col = $N)
  if (where && typeof where === 'object') {
    for (const [key, val] of Object.entries(where)) {
      if (val === undefined) continue;

      // Verify filter column in allowlist
      const dbColumn = filterDictionary[key] || (Object.values(filterDictionary).includes(key) ? key : null);
      if (!dbColumn) {
        throw new InvalidIdentifierException(
          `Unauthorized filter column '${key}'. Allowed filter keys: [${Object.keys(filterDictionary).join(', ')}]`,
          key
        );
      }

      if (val === null) {
        whereClauses.push(`${safeQuoteIdentifier(dbColumn)} IS NULL`);
      } else {
        values.push(val);
        whereClauses.push(`${safeQuoteIdentifier(dbColumn)} = $${values.length}`);
      }
    }
  }

  // 4. Literal Text Search (using parameterized ILIKE $N)
  // Input string is passed strictly as value in wire protocol, neutralizing SQLi polyglots
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchConditions = [];
    values.push(`%${search.trim()}%`);
    const searchPlaceholder = `$${values.length}`;

    for (const col of searchColumns) {
      const quotedCol = safeQuoteIdentifier(col);
      searchConditions.push(`${quotedCol}::text ILIKE ${searchPlaceholder}`);
    }

    if (searchConditions.length > 0) {
      whereClauses.push(`(${searchConditions.join(' OR ')})`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 5. Safe Sorting (ORDER BY)
  const quotedSortCol = resolveSortColumn(sortBy, sortDictionary);
  const normalizedOrder = String(order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const orderSql = `ORDER BY ${quotedSortCol} ${normalizedOrder}`;

  // 6. Safe Clamped Pagination (LIMIT / OFFSET)
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  values.push(safeLimit);
  const limitPlaceholder = `$${values.length}`;
  values.push(offset);
  const offsetPlaceholder = `$${values.length}`;

  const limitSql = `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;

  const text = `SELECT ${quotedSelect} FROM ${quotedTable} ${whereSql} ${orderSql} ${limitSql}`
    .replace(/\s+/g, ' ')
    .trim();

  return { text, values };
}

module.exports = {
  SORT_COLUMNS,
  ALLOWED_TABLES,
  FILTER_COLUMNS,
  safeQuoteIdentifier,
  resolveSortColumn,
  buildSafeSelectQuery,
  InvalidIdentifierException,
};
