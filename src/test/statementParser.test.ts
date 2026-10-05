import { describe, it, expect } from 'vitest';
import { parseTurkishNumber, parseTurkishDate } from '../utils/statementParser';

describe('Turkish Statement & Currency Parser', () => {
  it('correctly parses Turkish decimal formats', () => {
    const res1 = parseTurkishNumber('1.250,50 TL');
    expect(res1.amount).toBe(1250.50);
    expect(res1.isNegative).toBe(false);

    const res2 = parseTurkishNumber('- 450,25 ₺');
    expect(res2.amount).toBe(450.25);
    expect(res2.isNegative).toBe(true);

    const res3 = parseTurkishNumber('(120,00)');
    expect(res3.amount).toBe(120.00);
    expect(res3.isNegative).toBe(true);
  });

  it('correctly parses various Turkish date formats', () => {
    const d1 = parseTurkishDate('15.01.2026');
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(0); // January
    expect(d1.getDate()).toBe(15);

    const d2 = parseTurkishDate('2026-03-20');
    expect(d2.getFullYear()).toBe(2026);
    expect(d2.getMonth()).toBe(2); // March
    expect(d2.getDate()).toBe(20);
  });
});
