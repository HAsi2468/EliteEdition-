/**
 * Safe Text Search Utilities (BUG-041, BUG-036, BUG-058)
 * - escapeRegex: Escapes RegExp metacharacters so inputs are matched literally
 * - normaliseSearch: Strips lone surrogates, collapses whitespace, caps length at 100
 * - buildTokenSearch: Generates safe AND-grouped, field-level OR search filters
 */
const { AppError } = require('./errors');

const MAX_SEARCH_LEN = 100;

function escapeRegex(input) {
  return String(input || '').replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
}

function normaliseSearch(raw) {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') {
    throw new AppError(400, 'INVALID_SEARCH', 'Search must be text.');
  }
  const s = raw
    .normalize('NFC')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.length > MAX_SEARCH_LEN) {
    throw new AppError(400, 'SEARCH_TOO_LONG', `Search is limited to ${MAX_SEARCH_LEN} characters.`);
  }
  return s;
}

function buildTokenSearch(raw, fields, maxTokens = 6) {
  const s = normaliseSearch(raw);
  if (!s) return {};
  const tokens = s.split(' ').filter(Boolean).slice(0, maxTokens);
  if (tokens.length === 0) return {};

  return {
    $and: tokens.map((t) => ({
      $or: fields.map((f) => ({
        [f]: { $regex: escapeRegex(t), $options: 'i' }
      }))
    }))
  };
}

module.exports = {
  MAX_SEARCH_LEN,
  escapeRegex,
  normaliseSearch,
  buildTokenSearch
};

