import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const typeColors = {
  Feature: "hsl(var(--chart-1))",
  Bug: "hsl(var(--chart-2))",
  Epic: "hsl(var(--chart-3))",
  Task: "hsl(var(--chart-4))",
  Improvement: "hsl(var(--chart-5))",
};

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
}) {
  const quarterAllocs = useMemo(
    () => quarterlyAllocations.filter((a) => a.quarter === selectedQuarter),
    [quarterlyAllocations, selectedQuarter]
  );

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members]
  );

  // Sum quarterly allocation percents per work area, scoped to relevant members
  const workItemTotals = useMemo(() => {
    const map = {};
    quarterAllocs
      .filter((a) => memberIds.has(a.team_member_id) && a.work_area_id)
      .forEach((a) => {
        map[a.work_area_id] = (map[a.work_area_id] || 0) + a.percent;
      });
    return map;
  }, [quarterAllocs, memberIds]);

  // Top 15 work items
  const top15 = useMemo(() => {
    return Object.entries(workItemTotals)
      .map(([waId, total]) => {
        const wa = workAreas.find((w) => w.id === waId);
        return { name: wa?.name ?? "Unknown", color: wa?.color, type: wa?.type, total };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [workItemTotals, workAreas]);

  // All work item types
  const typeBreakdown = useMemo(() => {
    const map = {};
    Object.entries(workItemTotals).forEach(([waId, total]) => {
      const type = workAreas.find((w) => w.id === waId)?.type ?? "Other";
      map[type] = (map[type] || 0) + total;
    });
    return Object.entries(map)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  }, [workItemTotals, workAreas]);

  if (top15.length === 0 && typeBreakdown.length === 0) return null;

  const maxItem = top15[0]?.total ?? 1;
  const maxType = typeBreakdown[0]?.total ?? 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Top 15 Work Items */}
      {top15.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold">Top 15 Work Items</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {top15.map(({ name, color, total }, idx) => (
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
                      {total}%
                    </span>
                  </div>
                  <HBar value={total} max={maxItem} color={color || "#6b7280"} />
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
              {typeBreakdown.map(({ type, total }) => {
                const color = typeColors[type] || "hsl(var(--chart-1))";
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
                        {total}%
                      </span>
                    </div>
                    <HBar value={total} max={maxType} color={color} />
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
