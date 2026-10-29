/**
 * Safe Enterprise Math Expression Evaluator
 * Evaluates inline arithmetic (e.g. "120*5", "500+250", "1500*1.18", "1000-10%")
 * Zero eval(), zero Function() - 100% deterministic, XSS-safe, and crash-resilient.
 */

export function evaluateMathExpression(input: string): number | null {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;

  // If it's already a clean plain number, return it
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const val = parseFloat(raw);
    return isNaN(val) ? null : val;
  }

  // Check if it contains valid arithmetic characters only
  if (!/^[\d\s+\-*/().,%]+$/.test(raw)) {
    return null;
  }

  try {
    const tokens = tokenize(raw);
    if (!tokens.length) return null;
    const parser = new MathParser(tokens);
    const result = parser.parse();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      // Round to 4 decimal places to prevent floating point inaccuracies
      return Math.round((result + Number.EPSILON) * 10000) / 10000;
    }
    return null;
  } catch (err) {
    return null;
  }
}

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN' | 'PERCENT';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const clean = expression.replace(/,/g, ''); // strip thousands separators

  while (i < clean.length) {
    const ch = clean[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d|\./.test(ch)) {
      let numStr = '';
      while (i < clean.length && /[\d.]/.test(clean[i])) {
        numStr += clean[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    if (ch === '%') {
      tokens.push({ type: 'PERCENT', value: '%' });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    if (['+', '-', '*', '/'].includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    // Unknown char
    i++;
  }

  return tokens;
}

interface FactorResult {
  value: number;
  isPercent: boolean;
}

class MathParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  public parse(): number {
    return this.parseExpression();
  }

  // Expression: Term (('+' | '-') Term)*
  private parseExpression(): number {
    const left = this.parseTerm();
    let currentVal = left.isPercent ? left.value / 100 : left.value;

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || !['+', '-'].includes(token.value)) {
        break;
      }
      this.consume();
      const right = this.parseTerm();

      // Percentage addition/subtraction: e.g. 1000 - 10% => 1000 - (1000 * 0.10)
      let rVal: number;
      if (right.isPercent) {
        rVal = currentVal * (right.value / 100);
      } else {
        rVal = right.value;
      }

      if (token.value === '+') {
        currentVal += rVal;
      } else {
        currentVal -= rVal;
      }
    }

    return currentVal;
  }

  // Term: Factor (('*' | '/') Factor)*
  private parseTerm(): FactorResult {
    let left = this.parseFactor();

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || !['*', '/'].includes(token.value)) {
        break;
      }
      this.consume();
      const right = this.parseFactor();

      const rVal = right.isPercent ? right.value / 100 : right.value;
      if (token.value === '*') {
        left = { value: left.value * rVal, isPercent: false };
      } else {
        if (rVal === 0) throw new Error('Division by zero');
        left = { value: left.value / rVal, isPercent: false };
      }
    }

    return left;
  }

  // Factor: ('+' | '-')? (Number | '(' Expression ')')
  private parseFactor(): FactorResult {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of input');

    // Handle unary minus or plus
    if (token.type === 'OP' && (token.value === '-' || token.value === '+')) {
      this.consume();
      const factor = this.parseFactor();
      return {
        value: token.value === '-' ? -factor.value : factor.value,
        isPercent: factor.isPercent,
      };
    }

    if (token.type === 'NUMBER') {
      this.consume();
      const val = parseFloat(token.value);
      if (this.peek()?.type === 'PERCENT') {
        this.consume();
        return { value: val, isPercent: true };
      }
      return { value: val, isPercent: false };
    }

    if (token.type === 'LPAREN') {
      this.consume(); // '('
      const val = this.parseExpression();
      const close = this.peek();
      if (close && close.type === 'RPAREN') {
        this.consume(); // ')'
      }
      if (this.peek()?.type === 'PERCENT') {
        this.consume();
        return { value: val, isPercent: true };
      }
      return { value: val, isPercent: false };
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }
}
