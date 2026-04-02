import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkAreaColor, getWorkAreaTypeColor } from "@/lib/utils";

function HBar({ value, max, color }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${width}%`, backgroundColor: color || "#3b82f6" }}
      />
    </div>
  );
}

export default function QuarterlyWorkItemSummary({
  members,
  workAreas,
  quarterlyAllocations,
  selectedQuarter,
  capacityMap = {},
}) {
  const quarterAllocs = useMemo(
    () => quarterlyAllocations.filter((a) => a.quarter === selectedQuarter),
    [quarterlyAllocations, selectedQuarter]
  );

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members]
  );

  const memberCount = members.length;
  const totalCapacityDays = members.reduce((sum, m) => sum + (capacityMap[m.id] ?? 60), 0);

  // Raw sums per work area, scoped to relevant members + quarter.
  const rawSums = useMemo(() => {
    if (memberCount === 0) return {};
    const map = {};
    quarterAllocs
      .filter((a) => memberIds.has(a.team_member_id) && a.work_area_id)
      .forEach((a) => {
        map[a.work_area_id] = (map[a.work_area_id] || 0) + (a.days || 0);
      });
    return map;
  }, [quarterAllocs, memberIds, memberCount]);

  // Top 15 by total days allocated. Bar width = share of total team capacity.
  const top15 = useMemo(() => {
    return Object.entries(rawSums)
      .map(([waId, days]) => {
        const wa = workAreas.find((w) => w.id === waId);
        return {
          name: wa?.name ?? "Unknown",
          color: getWorkAreaColor(wa),
          days,
          pct: totalCapacityDays > 0 ? Math.round(days * 100 / totalCapacityDays) : 0,
        };
      })
      .sort((a, b) => b.days - a.days)
      .slice(0, 15);
  }, [rawSums, workAreas, totalCapacityDays]);

  // Type breakdown: aggregate raw days per type, show as % of total capacity.
  const typeBreakdown = useMemo(() => {
    const rawByType = {};
    Object.entries(rawSums).forEach(([waId, days]) => {
      const type = workAreas.find((w) => w.id === waId)?.type ?? "Other";
      rawByType[type] = (rawByType[type] || 0) + days;
    });
    return Object.entries(rawByType)
      .map(([type, days]) => ({
        type,
        days,
        pct: totalCapacityDays > 0 ? Math.round(days * 100 / totalCapacityDays) : 0,
      }))
      .sort((a, b) => b.days - a.days);
  }, [rawSums, workAreas, totalCapacityDays]);

  if (top15.length === 0 && typeBreakdown.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top 15 Work Items */}
      {top15.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">Top 15 Work Items</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {top15.map(({ name, color, days, pct }, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color || "#6b7280" }}
                      />
                      <span className="text-sm truncate" title={name}>{name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground ml-3 flex-shrink-0">
                      {pct}% · {days}d
                    </span>
                  </div>
                  <HBar value={pct} max={100} color={color || "#6b7280"} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Work Item Types */}
      {typeBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">Allocation by Work Item Type</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {typeBreakdown.map(({ type, days, pct }) => {
                const color = getWorkAreaTypeColor(type);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium">{type}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground ml-3">
                        {pct}% · {days}d
                      </span>
                    </div>
                    <HBar value={pct} max={100} color={color} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
