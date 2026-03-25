import { useMemo } from 'react';
import { getCurrentQuarter, sortQuarters } from './quarter-utils';

/**
 * Returns a sorted list of quarters for use in filter dropdowns.
 *
 * @param {Array}   sprints       - Sprint records; their quarters are always included.
 * @param {object}  options
 * @param {boolean} options.includeRange - When true, adds 4 quarters before and 8 after
 *                                        the current quarter (useful for planning pages).
 */
export function useQuarters(sprints = [], { includeRange = false } = {}) {
  return useMemo(() => {
    const current = getCurrentQuarter();
    const set = new Set([current]);

    sprints.forEach(s => { if (s.quarter) set.add(s.quarter); });

    if (includeRange) {
      const [, q, y] = current.match(/Q(\d) (\d{4})/);
      let qNum = parseInt(q), yNum = parseInt(y);
      for (let i = -4; i <= 8; i++) {
        let qq = qNum + i, yy = yNum;
        while (qq > 4) { qq -= 4; yy++; }
        while (qq < 1) { qq += 4; yy--; }
        set.add(`Q${qq} ${yy}`);
      }
    }

    return sortQuarters(Array.from(set));
  }, [sprints, includeRange]);
}
