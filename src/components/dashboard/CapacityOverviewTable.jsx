import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function CapacityOverviewTable({ sprints, teams, members, workAreas, allocations, selectedTeamId }) {
  const filteredMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.team_id === selectedTeamId);

  const getSprintWorkAreaTotal = (sprintId, workAreaId) => {
    const memberIds = new Set(filteredMembers.map(m => m.id));
    return allocations
      .filter(a => a.sprint_id === sprintId && a.work_area_id === workAreaId && memberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const getSprintTotal = (sprintId) => {
    const memberIds = new Set(filteredMembers.map(m => m.id));
    return allocations
      .filter(a => a.sprint_id === sprintId && memberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const maxCapacity = (sprintId) => {
    return filteredMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);
  };

  if (sprints.length === 0 || filteredWorkAreas.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Keine Daten vorhanden.</div>;
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[120px]">Sprint</TableHead>
            {filteredWorkAreas.map(wa => (
              <TableHead key={wa.id} className="text-center min-w-[90px]">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                  <span className="text-xs">{wa.name}</span>
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[100px]">Auslastung</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sprints.map(sprint => {
            const total = getSprintTotal(sprint.id);
            const max = maxCapacity(sprint.id);
            const utilPct = max > 0 ? Math.round((total / max) * 100) : 0;
            return (
              <TableRow key={sprint.id}>
                <TableCell className="font-medium text-sm">{sprint.name}</TableCell>
                {filteredWorkAreas.map(wa => {
                  const val = getSprintWorkAreaTotal(sprint.id, wa.id);
                  return (
                    <TableCell key={wa.id} className="text-center">
                      <span className={cn("text-sm tabular-nums", val > 0 ? "font-medium" : "text-muted-foreground")}>
                        {val > 0 ? `${val}%` : "—"}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cn(
                      "text-sm font-semibold tabular-nums",
                      utilPct > 100 ? "text-destructive" : utilPct > 80 ? "text-amber-600" : "text-foreground"
                    )}>
                      {utilPct}%
                    </span>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          utilPct > 100 ? "bg-destructive" : utilPct > 80 ? "bg-amber-500" : "bg-primary"
                        )}
                        style={{ width: `${Math.min(utilPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}