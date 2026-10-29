import { describe, it, expect } from 'vitest';
import { evaluateMathExpression } from './mathEvaluator';

describe('Enterprise Math Evaluator', () => {
  it('evaluates simple operations', () => {
    expect(evaluateMathExpression('120*5')).toBe(600);
    expect(evaluateMathExpression('500+250')).toBe(750);
    expect(evaluateMathExpression('1000-350')).toBe(650);
    expect(evaluateMathExpression('100/4')).toBe(25);
  });

  it('evaluates decimals and operator precedence', () => {
    expect(evaluateMathExpression('1500*1.18')).toBe(1770);
    expect(evaluateMathExpression('10+20*3')).toBe(70);
    expect(evaluateMathExpression('(10+20)*3')).toBe(90);
    expect(evaluateMathExpression('1000/4-50')).toBe(200);
  });

  it('handles percentage arithmetic', () => {
    // 1000 - 10% = 900
    expect(evaluateMathExpression('1000-10%')).toBe(900);
    // 5000 + 18% = 5900
    expect(evaluateMathExpression('5000+18%')).toBe(5900);
  });

  it('handles plain numbers gracefully', () => {
    expect(evaluateMathExpression('500')).toBe(500);
    expect(evaluateMathExpression('42.50')).toBe(42.5);
    expect(evaluateMathExpression('1,500.00')).toBe(1500);
  });

  it('safely rejects division by zero or invalid input', () => {
    expect(evaluateMathExpression('100/0')).toBeNull();
    expect(evaluateMathExpression('abc')).toBeNull();
    expect(evaluateMathExpression('<script>')).toBeNull();
    expect(evaluateMathExpression('')).toBeNull();
  });
});
