import React, { useMemo } from "react";
import { cn, getWorkAreaColor } from "@/lib/utils";

const DEFAULT_CAPACITY = 60;

/**
 * Shows all work items allocated for a team in a quarter,
 * sorted by allocation descending, with % of total team capacity.
 */
export default function QuarterlyTopicBreakdown({ members, quarterlyAllocations, workAreas, quarter, capacityMap = {} }) {
  const data = useMemo(() => {
    const memberIds = new Set(members.map(m => m.id));
    const totalCapacity = members.reduce((sum, m) => sum + (capacityMap[m.id] ?? DEFAULT_CAPACITY), 0);
    if (totalCapacity === 0) return { totalCapacity: 0, items: [] };

    const quarterAllocs = quarterlyAllocations.filter(a => a.quarter === quarter && memberIds.has(a.team_member_id));

    const byWorkArea = {};
    quarterAllocs.forEach(a => {
      if (!a.work_area_id) return;
      byWorkArea[a.work_area_id] = (byWorkArea[a.work_area_id] || 0) + (a.days || 0);
    });

    const items = Object.entries(byWorkArea)
      .map(([waId, days]) => {
        const wa = workAreas.find(w => w.id === waId);
        const pct = Math.round(days / totalCapacity * 100);
        return { id: waId, name: wa?.name ?? "Unknown", color: getWorkAreaColor(wa), days, pct };
      })
      .sort((a, b) => b.days - a.days);

    return { totalCapacity, items };
  }, [members, quarterlyAllocations, workAreas, quarter, capacityMap]);

  if (data.items.length === 0) {
    return <p className="text-xs text-muted-foreground">No allocations yet for {quarter}.</p>;
  }

  return (
    <div className="space-y-2">
      {data.items.map(({ id, name, color, days, pct }) => (
        <div key={id}>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs truncate" title={name}>{name}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums ml-2 shrink-0">
              {pct}% <span className="text-muted-foreground font-normal">({days}d)</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-1">
        Total capacity: {data.totalCapacity}d
      </p>
    </div>
  );
}
