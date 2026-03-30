import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, getDisciplineColor } from "@/lib/utils";

export default function DisciplineBreakdown({ sprints, members, allocations, selectedTeamId }) {
  const [sortBy, setSortBy] = useState("name");
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
      .reduce((sum, a) => sum + (a.days || 0), 0);
    const maxCapacity = discMembers.reduce((sum, m) => sum + (m.sprint_days || 10), 0) * sprints.length;
    return maxCapacity > 0 ? Math.round((totalAlloc / maxCapacity) * 100) : 0;
  };

  const sortedDisciplines = [...disciplines].sort((a, b) => {
    const utilA = getAvgUtilization(a);
    const utilB = getAvgUtilization(b);
    if (sortBy === "name") return a.localeCompare(b);
    if (sortBy === "utilization-asc") return utilA - utilB;
    if (sortBy === "utilization-desc") return utilB - utilA;
    return 0;
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Utilization by Discipline</CardTitle>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="utilization-asc">Low to High</SelectItem>
            <SelectItem value="utilization-desc">High to Low</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedDisciplines.map(disc => {
            const util = getAvgUtilization(disc);
            const count = filteredMembers.filter(m => m.discipline === disc).length;
            return (
              <div key={disc}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getDisciplineColor(disc) }} />
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
                      backgroundColor: getDisciplineColor(disc),
                    }}
                  />
                </div>
              </div>
            );
          })}
          {disciplines.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No data</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}