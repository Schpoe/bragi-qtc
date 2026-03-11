import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function CapacityOverviewTable({ sprints, teams, members, workAreas, allocations, selectedTeamId }) {
  // If all teams selected, show team-level overview
  if (selectedTeamId === "all") {
    const teamsToDisplay = teams;

    const getTeamCapacity = (sprintId, teamId) => {
      const teamMembers = members.filter(m => m.team_id === teamId);
      const memberIds = new Set(teamMembers.map(m => m.id));
      return allocations
        .filter(a => a.sprint_id === sprintId && memberIds.has(a.team_member_id))
        .reduce((sum, a) => sum + (a.percent || 0), 0);
    };

    const getTeamMaxCapacity = (teamId) => {
      const teamMembers = members.filter(m => m.team_id === teamId);
      return teamMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);
    };

    if (sprints.length === 0 || teamsToDisplay.length === 0) {
      return <div className="text-center py-8 text-sm text-muted-foreground">No data available.</div>;
    }

    return (
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[120px]">Sprint</TableHead>
              {teamsToDisplay.map(team => (
                <TableHead key={team.id} className="text-center min-w-[100px]">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color || "#3b82f6" }} />
                    <span className="text-xs font-medium">{team.name}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sprints.map(sprint => (
              <TableRow key={sprint.id}>
                <TableCell className="font-medium text-sm">{sprint.name}</TableCell>
                {teamsToDisplay.map(team => {
                  const capacity = getTeamCapacity(sprint.id, team.id);
                  const maxCapacity = getTeamMaxCapacity(team.id);
                  const utilPct = maxCapacity > 0 ? Math.round((capacity / maxCapacity) * 100) : 0;
                  return (
                    <TableCell key={team.id} className="text-center">
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
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // For specific team selected, show discipline and member breakdown
  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamMembers = members.filter(m => m.team_id === selectedTeamId);
  const disciplines = [...new Set(teamMembers.map(m => m.discipline))].sort();

  const getMemberCapacity = (sprintId, memberId) => {
    return allocations
      .filter(a => a.sprint_id === sprintId && a.team_member_id === memberId)
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const getDisciplineCapacity = (sprintId, discipline) => {
    const disciplineMembers = teamMembers.filter(m => m.discipline === discipline).map(m => m.id);
    return allocations
      .filter(a => a.sprint_id === sprintId && disciplineMembers.includes(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const getDisciplineMaxCapacity = (discipline) => {
    return teamMembers
      .filter(m => m.discipline === discipline)
      .reduce((sum, m) => sum + (m.availability_percent || 100), 0);
  };

  if (sprints.length === 0 || disciplines.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">No data available.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Discipline-level view */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Capacity by Discipline</h3>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-[120px]">Sprint</TableHead>
                {disciplines.map(discipline => (
                  <TableHead key={discipline} className="text-center min-w-[100px]">
                    <span className="text-xs font-medium">{discipline}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sprints.map(sprint => (
                <TableRow key={sprint.id}>
                  <TableCell className="font-medium text-sm">{sprint.name}</TableCell>
                  {disciplines.map(discipline => {
                    const capacity = getDisciplineCapacity(sprint.id, discipline);
                    const maxCapacity = getDisciplineMaxCapacity(discipline);
                    const utilPct = maxCapacity > 0 ? Math.round((capacity / maxCapacity) * 100) : 0;
                    return (
                      <TableCell key={discipline} className="text-center">
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
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Team member-level view */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Capacity by Team Member</h3>
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-[140px]">Member</TableHead>
                {sprints.map(sprint => (
                  <TableHead key={sprint.id} className="text-center min-w-[90px]">
                    <span className="text-xs font-medium">{sprint.name}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map(member => (
                <TableRow key={member.id}>
                  <TableCell className="text-sm">
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-xs text-muted-foreground">{member.discipline}</div>
                    </div>
                  </TableCell>
                  {sprints.map(sprint => {
                    const capacity = getMemberCapacity(sprint.id, member.id);
                    const maxCapacity = member.availability_percent || 100;
                    const utilPct = maxCapacity > 0 ? Math.round((capacity / maxCapacity) * 100) : 0;
                    return (
                      <TableCell key={sprint.id} className="text-center">
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
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}