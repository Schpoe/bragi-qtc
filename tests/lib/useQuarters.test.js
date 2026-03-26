import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useQuarters } from '@/lib/useQuarters';

// We control getCurrentQuarter by mocking the module
vi.mock('@/lib/quarter-utils', () => ({
  getCurrentQuarter: vi.fn(() => 'Q2 2025'),
  sortQuarters: (arr) =>
    [...arr].sort((a, b) => {
      const [, qa, ya] = a.match(/Q(\d) (\d{4})/);
      const [, qb, yb] = b.match(/Q(\d) (\d{4})/);
      return ya !== yb ? Number(ya) - Number(yb) : Number(qa) - Number(qb);
    }),
}));

describe('useQuarters', () => {
  it('always includes the current quarter', () => {
    const { result } = renderHook(() => useQuarters([]));
    expect(result.current).toContain('Q2 2025');
  });

  it('returns only current quarter when sprints is empty and includeRange is false', () => {
    const { result } = renderHook(() => useQuarters([]));
    expect(result.current).toEqual(['Q2 2025']);
  });

  it('includes quarters from sprints', () => {
    const sprints = [
      { quarter: 'Q1 2025' },
      { quarter: 'Q3 2025' },
    ];
    const { result } = renderHook(() => useQuarters(sprints));
    expect(result.current).toContain('Q1 2025');
    expect(result.current).toContain('Q3 2025');
    expect(result.current).toContain('Q2 2025'); // current
  });

  it('deduplicates quarters from sprints and current', () => {
    const sprints = [{ quarter: 'Q2 2025' }, { quarter: 'Q2 2025' }];
    const { result } = renderHook(() => useQuarters(sprints));
    const count = result.current.filter((q) => q === 'Q2 2025').length;
    expect(count).toBe(1);
  });

  it('ignores sprints without a quarter field', () => {
    const sprints = [{ quarter: null }, { quarter: undefined }, { quarter: '' }];
    const { result } = renderHook(() => useQuarters(sprints));
    // only current quarter — no empty strings or nulls in the list
    expect(result.current.every((q) => q && q.match(/Q\d \d{4}/))).toBe(true);
  });

  it('with includeRange adds quarters before and after current', () => {
    const { result } = renderHook(() => useQuarters([], { includeRange: true }));
    // should contain 4 before and 8 after current (Q2 2025), plus current = 13 total
    expect(result.current.length).toBe(13);
    expect(result.current).toContain('Q2 2024'); // 4 before: Q2→Q1→Q4→Q3 2024
    expect(result.current).toContain('Q2 2026'); // 4 after
  });

  it('with includeRange wraps quarters correctly across year boundaries', () => {
    const { result } = renderHook(() => useQuarters([], { includeRange: true }));
    // Q2 2025 - 4 = Q2 2024, and Q2 2025 + 8 = Q2 2027
    expect(result.current).toContain('Q4 2024');
    expect(result.current).toContain('Q1 2026');
  });

  it('result is sorted chronologically', () => {
    const sprints = [{ quarter: 'Q4 2024' }, { quarter: 'Q1 2026' }];
    const { result } = renderHook(() => useQuarters(sprints));
    const quarters = result.current;
    for (let i = 1; i < quarters.length; i++) {
      const [, qPrev, yPrev] = quarters[i - 1].match(/Q(\d) (\d{4})/);
      const [, qCurr, yCurr] = quarters[i].match(/Q(\d) (\d{4})/);
      const prev = Number(yPrev) * 4 + Number(qPrev);
      const curr = Number(yCurr) * 4 + Number(qCurr);
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });
});
