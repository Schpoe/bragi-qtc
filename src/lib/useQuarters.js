import { useMemo } from 'react';
import { getCurrentQuarter, sortQuarters } from './quarter-utils';

/**
 * Returns a sorted list of quarters for use in filter dropdowns.
 * Generates a range around the current quarter — no sprint data needed.
 *
 * @param {string[]} extraQuarters - Any additional quarters to include (e.g. from existing allocations)
 * @param {object}   options
 * @param {number}   options.pastQuarters   - How many quarters before current to include (default 4)
 * @param {number}   options.futureQuarters - How many quarters after current to include (default 4)
 */
export function useQuarters(extraQuarters = [], { pastQuarters = 4, futureQuarters = 4 } = {}) {
  return useMemo(() => {
    const current = getCurrentQuarter();
    const set = new Set([current]);

    // Add range around current quarter
    const [, q, y] = current.match(/Q(\d) (\d{4})/);
    let qNum = parseInt(q), yNum = parseInt(y);
    for (let i = -pastQuarters; i <= futureQuarters; i++) {
      let qq = qNum + i, yy = yNum;
      while (qq > 4) { qq -= 4; yy++; }
      while (qq < 1) { qq += 4; yy--; }
      set.add(`Q${qq} ${yy}`);
    }

    // Include any extra quarters (e.g. from existing allocations or snapshots)
    extraQuarters.forEach(q => { if (q) set.add(q); });

    return sortQuarters(Array.from(set));
  }, [extraQuarters, pastQuarters, futureQuarters]);
}
