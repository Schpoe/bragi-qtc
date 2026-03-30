import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, getDisciplineColor } from "@/lib/utils";

export default function QuarterlyDisciplineSummary({
  members,
  quarterlyAllocations,
  selectedQuarter,
}) {
  const quarterAllocs = useMemo(
    () => quarterlyAllocations.filter((a) => a.quarter === selectedQuarter),
    [quarterlyAllocations, selectedQuarter]
  );

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const breakdown = useMemo(() => {
    const disciplines = [
      ...new Set(members.map((m) => m.discipline).filter(Boolean)),
    ];

    return disciplines
      .map((disc) => {
        const discMembers = members.filter((m) => m.discipline === disc);
        const discIds = new Set(discMembers.map((m) => m.id));
        const allocated = quarterAllocs
          .filter((a) => discIds.has(a.team_member_id))
          .reduce((sum, a) => sum + (a.days || 0), 0);
        const util =
          discMembers.length > 0
            ? Math.round(allocated * 100 / (discMembers.length * 60))
            : 0;
        return { discipline: disc, util, count: discMembers.length };
      })
      .sort((a, b) => b.util - a.util);
  }, [members, quarterAllocs]);

  if (breakdown.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base font-bold">Allocation by Discipline</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {breakdown.map(({ discipline, util, count }) => {
            const color = getDisciplineColor(discipline);
            return (
              <div key={discipline}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-medium">{discipline}</span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      util > 100
                        ? "text-destructive"
                        : util > 80
                        ? "text-amber-600"
                        : "text-foreground"
                    )}
                  >
                    {util}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(util, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
