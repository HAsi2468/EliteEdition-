/**
 * Safe Math & Percentage Formula Evaluator
 * 
 * Principal Enterprise Architecture arithmetic parser without eval().
 * 
 * Features:
 * - Supports operations: +, -, *, /, %, ^, and parentheses ()
 * - Contextual enterprise percentage calculations:
 *     - "1000 + 18%" -> 1180 (GST addition)
 *     - "500 - 10%"  -> 450  (Discount deduction)
 *     - "200 * 50%"  -> 100  (Multiplier)
 *     - "50%"        -> 0.5
 * - Safe recursive-descent AST evaluator with zero arbitrary code execution risk
 */

/**
 * Tokenize mathematical expression
 * @param {string} expr 
 * @returns {Array<{type: string, value: string|number}>}
 */
export function tokenizeExpression(expr) {
  if (!expr || typeof expr !== 'string') return [];

  // Remove commas, currency symbols, and extra spaces
  const cleanExpr = expr.replace(/[₹$€£,]/g, '').trim();
  const tokens = [];
  let i = 0;

  while (i < cleanExpr.length) {
    const char = cleanExpr[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(cleanExpr[i + 1] || ''))) {
      let numStr = '';
      while (i < cleanExpr.length && (/[0-9]/.test(cleanExpr[i]) || cleanExpr[i] === '.')) {
        numStr += cleanExpr[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // Percentage sign
    if (char === '%') {
      tokens.push({ type: 'PERCENT', value: '%' });
      i++;
      continue;
    }

    // Operators
    if ('+-*/^()'.includes(char)) {
      tokens.push({ type: 'OP', value: char });
      i++;
      continue;
    }

    // Unknown character encountered
    throw new Error(`Unexpected character in formula: "${char}"`);
  }

  return tokens;
}

/**
 * Safe Recursive Descent Parser
 */
class ExpressionParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  // Entry: expr = additiveExpr
  parse() {
    if (this.tokens.length === 0) return 0;
    const result = this.parseAdditive();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}: ${this.tokens[this.pos].value}`);
    }
    return result;
  }

  // additiveExpr = multiplicativeExpr (('+' | '-') multiplicativeExpr)*
  parseAdditive() {
    let left = this.parseMultiplicative();

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || (token.value !== '+' && token.value !== '-')) {
        break;
      }
      this.consume(); // eat '+' or '-'

      // Check if next term is a percentage expression like "left - 10%"
      const nextTerm = this.parseMultiplicative();

      if (token.value === '+') {
        // If next term was parsed with percentage context flag
        if (nextTerm.isPercent) {
          left = left + (left * nextTerm.value / 100);
        } else {
          left = left + nextTerm;
        }
      } else {
        if (nextTerm.isPercent) {
          left = left - (left * nextTerm.value / 100);
        } else {
          left = left - nextTerm;
        }
      }
    }

    return typeof left === 'object' && left?.isPercent ? (left.value / 100) : left;
  }

  // multiplicativeExpr = unaryExpr (('*' | '/') unaryExpr)*
  parseMultiplicative() {
    let left = this.parseUnary();

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || (token.value !== '*' && token.value !== '/')) {
        break;
      }
      this.consume(); // eat '*' or '/'

      const nextTerm = this.parseUnary();
      const rightVal = typeof nextTerm === 'object' && nextTerm?.isPercent ? (nextTerm.value / 100) : nextTerm;
      const leftVal = typeof left === 'object' && left?.isPercent ? (left.value / 100) : left;

      if (token.value === '*') {
        left = leftVal * rightVal;
      } else {
        if (rightVal === 0) throw new Error('Division by zero');
        left = leftVal / rightVal;
      }
    }

    return left;
  }

  // unaryExpr = ('+' | '-')? primaryExpr (PERCENT)?
  parseUnary() {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of formula');

    let sign = 1;
    if (token.type === 'OP' && (token.value === '+' || token.value === '-')) {
      this.consume();
      if (token.value === '-') sign = -1;
    }

    let val = this.parsePrimary() * sign;

    // Check if followed immediately by %
    if (this.pos < this.tokens.length && this.peek()?.type === 'PERCENT') {
      this.consume(); // eat '%'
      // Return percentage object so parent additive can compute relative percentage
      return { isPercent: true, value: val };
    }

    return val;
  }

  // primaryExpr = NUMBER | '(' additiveExpr ')'
  parsePrimary() {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of formula');

    if (token.type === 'NUMBER') {
      this.consume();
      return token.value;
    }

    if (token.type === 'OP' && token.value === '(') {
      this.consume(); // eat '('
      const inner = this.parseAdditive();
      const closing = this.peek();
      if (!closing || closing.type !== 'OP' || closing.value !== ')') {
        throw new Error('Missing closing parenthesis ")"');
      }
      this.consume(); // eat ')'
      return typeof inner === 'object' && inner?.isPercent ? (inner.value / 100) : inner;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }
}

/**
 * Safely evaluate formula string
 * @param {string|number} input 
 * @param {object} options 
 * @returns {{ success: boolean, value: number, error: string|null }}
 */
export function evaluateNumericFormula(input, options = {}) {
  if (input === null || input === undefined || input === '') {
    return { success: true, value: 0, error: null };
  }

  if (typeof input === 'number') {
    return { success: !isNaN(input), value: isNaN(input) ? 0 : input, error: null };
  }

  const str = String(input).trim();
  if (!str) {
    return { success: true, value: 0, error: null };
  }

  // If pure number without operators
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const val = parseFloat(str);
    return { success: !isNaN(val), value: isNaN(val) ? 0 : val, error: null };
  }

  try {
    const tokens = tokenizeExpression(str);
    const parser = new ExpressionParser(tokens);
    const result = parser.parse();

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return { success: false, value: 0, error: 'Calculation resulted in invalid number' };
    }

    const { precision = 2 } = options;
    const rounded = Math.round(result * Math.pow(10, precision)) / Math.pow(10, precision);

    return { success: true, value: rounded, error: null };
  } catch (err) {
    return { success: false, value: 0, error: err.message };
  }
}
