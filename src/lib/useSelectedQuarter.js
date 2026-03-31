import { useState } from 'react';
import { getCurrentQuarter } from './quarter-utils';

export function useSelectedQuarter() {
  const [quarter, setQuarterState] = useState(
    () => localStorage.getItem('selected-quarter') || getCurrentQuarter()
  );

  const setQuarter = (q) => {
    localStorage.setItem('selected-quarter', q);
    setQuarterState(q);
  };

  return [quarter, setQuarter];
}

export function useSelectedTeam(defaultValue = "all") {
  const [teamId, setTeamIdState] = useState(
    () => localStorage.getItem('selected-team') || defaultValue
  );

  const setTeamId = (t) => {
    localStorage.setItem('selected-team', t);
    setTeamIdState(t);
  };

  return [teamId, setTeamId];
}
