import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentQuarter } from "@/lib/quarter-utils";

const QUARTER_NUMS = [1, 2, 3, 4];

// Two-stage period filter: Year then Quarter. The composed "Q{n} {year}" string stays the
// single source of truth (`quarter` / `onQuarterChange`), so no consumer API changes.
// Years come from existing data (history stays reachable) plus the current and next year
// (so future quarters can be planned). Any quarter of any listed year is selectable.
export default function FilterBar({ quarter, onQuarterChange, team, onTeamChange, teams, quarters = [], showTeamFilter = true }) {
  const current = getCurrentQuarter();
  const [, curQ, curY] = current.match(/Q(\d)\s+(\d{4})/) || [, "1", String(new Date().getFullYear())];
  const [, selQ = curQ, selY = curY] = (quarter || current).match(/Q(\d)\s+(\d{4})/) || [];

  const years = Array.from(new Set([
    ...quarters.map(q => (q.match(/(\d{4})/) || [])[1]).filter(Boolean),
    curY,
    String(Number(curY) + 1),
    selY,
  ])).sort().reverse();

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <Select value={selY} onValueChange={(y) => onQuarterChange(`Q${selQ} ${y}`)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={selQ} onValueChange={(q) => onQuarterChange(`Q${q} ${selY}`)}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUARTER_NUMS.map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
        </SelectContent>
      </Select>
      {showTeamFilter && (
        <Select value={team} onValueChange={onTeamChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.filter(t => t.is_active !== false).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
