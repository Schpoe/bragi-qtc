import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentQuarter, sortQuarters } from '@/lib/quarter-utils';

describe('getCurrentQuarter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Q1 for January', () => {
    vi.setSystemTime(new Date('2025-01-15'));
    expect(getCurrentQuarter()).toBe('Q1 2025');
  });

  it('returns Q1 for March', () => {
    vi.setSystemTime(new Date('2025-03-31'));
    expect(getCurrentQuarter()).toBe('Q1 2025');
  });

  it('returns Q2 for April', () => {
    vi.setSystemTime(new Date('2025-04-01'));
    expect(getCurrentQuarter()).toBe('Q2 2025');
  });

  it('returns Q2 for June', () => {
    vi.setSystemTime(new Date('2025-06-30'));
    expect(getCurrentQuarter()).toBe('Q2 2025');
  });

  it('returns Q3 for July', () => {
    vi.setSystemTime(new Date('2025-07-01'));
    expect(getCurrentQuarter()).toBe('Q3 2025');
  });

  it('returns Q4 for October', () => {
    vi.setSystemTime(new Date('2025-10-01'));
    expect(getCurrentQuarter()).toBe('Q4 2025');
  });

  it('returns Q4 for December', () => {
    vi.setSystemTime(new Date('2025-12-31'));
    expect(getCurrentQuarter()).toBe('Q4 2025');
  });

  it('includes the correct year', () => {
    vi.setSystemTime(new Date('2026-02-01'));
    expect(getCurrentQuarter()).toBe('Q1 2026');
  });
});

describe('sortQuarters', () => {
  it('sorts by year ascending', () => {
    const input = ['Q1 2026', 'Q1 2024', 'Q1 2025'];
    expect(sortQuarters(input)).toEqual(['Q1 2024', 'Q1 2025', 'Q1 2026']);
  });

  it('sorts by quarter number within the same year', () => {
    const input = ['Q4 2025', 'Q2 2025', 'Q1 2025', 'Q3 2025'];
    expect(sortQuarters(input)).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025']);
  });

  it('sorts mixed years and quarters correctly', () => {
    const input = ['Q3 2025', 'Q1 2026', 'Q4 2024', 'Q2 2025'];
    expect(sortQuarters(input)).toEqual(['Q4 2024', 'Q2 2025', 'Q3 2025', 'Q1 2026']);
  });

  it('keeps single item unchanged', () => {
    expect(sortQuarters(['Q2 2025'])).toEqual(['Q2 2025']);
  });

  it('keeps already-sorted list in place', () => {
    const input = ['Q1 2025', 'Q2 2025', 'Q3 2025'];
    expect(sortQuarters(input)).toEqual(['Q1 2025', 'Q2 2025', 'Q3 2025']);
  });

  it('handles empty array', () => {
    expect(sortQuarters([])).toEqual([]);
  });

  it('ignores malformed entries without crashing', () => {
    const input = ['Q1 2025', 'invalid', 'Q3 2025'];
    const result = sortQuarters(input);
    // malformed entries are left in place (sort returns 0), valid ones are sorted
    expect(result).toContain('Q1 2025');
    expect(result).toContain('Q3 2025');
    expect(result).toContain('invalid');
  });
});
