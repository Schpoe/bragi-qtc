import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const disciplineColors = {
  iOS: "#3b82f6",
  Android: "#10b981",
  Cloud: "#8b5cf6",
  QA: "#f59e0b",
  Embedded: "#ef4444",
};

export default function DisciplineBreakdown({ sprints, members, allocations, selectedTeamId }) {
  const filteredMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const disciplines = [...new Set(filteredMembers.map(m => m.discipline))];

  const getAvgUtilization = (discipline) => {
    const discMembers = filteredMembers.filter(m => m.discipline === discipline);
    if (discMembers.length === 0 || sprints.length === 0) return 0;
    const memberIds = new Set(discMembers.map(m => m.id));
    const sprintIds = new Set(sprints.map(s => s.id));
    const totalAlloc = allocations
      .filter(a => memberIds.has(a.team_member_id) && sprintIds.has(a.sprint_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
    const maxCapacity = discMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0) * sprints.length;
    return maxCapacity > 0 ? Math.round((totalAlloc / maxCapacity) * 100) : 0;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Auslastung nach Bereich</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {disciplines.map(disc => {
            const util = getAvgUtilization(disc);
            const count = filteredMembers.filter(m => m.discipline === disc).length;
            return (
              <div key={disc}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: disciplineColors[disc] }} />
                    <span className="text-sm font-medium">{disc}</span>
                    <span className="text-xs text-muted-foreground">({count})</span>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    util > 100 ? "text-destructive" : util > 80 ? "text-amber-600" : "text-foreground"
                  )}>
                    {util}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(util, 100)}%`,
                      backgroundColor: disciplineColors[disc],
                    }}
                  />
                </div>
              </div>
            );
          })}
          {disciplines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Daten</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}