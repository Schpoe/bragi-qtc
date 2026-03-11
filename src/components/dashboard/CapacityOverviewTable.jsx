import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function CapacityOverviewTable({ sprints, teams, members, allocations, selectedTeamId }) {
  const [sortTeamsBy, setSortTeamsBy] = useState("name");
  const [sortMembersBy, setSortMembersBy] = useState("name");
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

    const getDisciplineCapacityForTeam = (sprintId, teamId, discipline) => {
      const teamMembers = members.filter(m => m.team_id === teamId && m.discipline === discipline);
      const memberIds = new Set(teamMembers.map(m => m.id));
      return allocations
        .filter(a => a.sprint_id === sprintId && memberIds.has(a.team_member_id))
        .reduce((sum, a) => sum + (a.percent || 0), 0);
    };

    const getDisciplineMaxCapacityForTeam = (teamId, discipline) => {
      return members
        .filter(m => m.team_id === teamId && m.discipline === discipline)
        .reduce((sum, m) => sum + (m.availability_percent || 100), 0);
    };

    if (sprints.length === 0 || teamsToDisplay.length === 0) {
       return <div className="text-center py-8 text-sm text-muted-foreground">No data available.</div>;
     }

     // Get all disciplines across all teams
     const allDisciplines = [...new Set(members.map(m => m.discipline))].sort();

     const getSortedTeams = () => {
       const getAvgUtil = (teamId) => {
         const teamMembers = members.filter(m => m.team_id === teamId);
         const memberIds = new Set(teamMembers.map(m => m.id));
         const totalAlloc = allocations
           .filter(a => memberIds.has(a.team_member_id))
           .reduce((sum, a) => sum + (a.percent || 0), 0);
         const maxCapacity = teamMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);
         return maxCapacity > 0 ? Math.round((totalAlloc / maxCapacity) * 100) : 0;
       };

       return [...teamsToDisplay].sort((a, b) => {
         if (sortTeamsBy === "name") return a.name.localeCompare(b.name);
         if (sortTeamsBy === "utilization-asc") return getAvgUtil(a.id) - getAvgUtil(b.id);
         if (sortTeamsBy === "utilization-desc") return getAvgUtil(b.id) - getAvgUtil(a.id);
         return 0;
       });
     };

     return (
       <div className="space-y-6">
         {/* Team-level overview */}
         <div>
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-sm font-semibold">Team Capacity</h3>
             <Select value={sortTeamsBy} onValueChange={setSortTeamsBy}>
               <SelectTrigger className="w-28">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="name">Name</SelectItem>
                 <SelectItem value="utilization-asc">Low to High</SelectItem>
                 <SelectItem value="utilization-desc">High to Low</SelectItem>
               </SelectContent>
             </Select>
           </div>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[120px]">Sprint</TableHead>
                  {getSortedTeams().map(team => (
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
                      {getSortedTeams().map(team => {
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
        </div>

        {/* Discipline breakdown per team */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Discipline Breakdown by Team</h3>
            <Select value={sortTeamsBy} onValueChange={setSortTeamsBy}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="utilization-asc">Low to High</SelectItem>
                <SelectItem value="utilization-desc">High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            {getSortedTeams().map(team => {
              const teamDisciplines = [...new Set(members.filter(m => m.team_id === team.id).map(m => m.discipline))].sort();
              if (teamDisciplines.length === 0) return null;
              
              return (
                <div key={team.id}>
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color || "#3b82f6" }} />
                    {team.name}
                  </div>
                  <div className="overflow-x-auto border rounded-lg bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="min-w-[100px] text-xs">Discipline</TableHead>
                          {sprints.map(sprint => (
                            <TableHead key={sprint.id} className="text-center min-w-[80px]">
                              <span className="text-xs font-medium">{sprint.name}</span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamDisciplines.map(discipline => (
                          <TableRow key={`${team.id}-${discipline}`}>
                            <TableCell className="text-xs font-medium">{discipline}</TableCell>
                            {sprints.map(sprint => {
                              const capacity = getDisciplineCapacityForTeam(sprint.id, team.id, discipline);
                              const maxCapacity = getDisciplineMaxCapacityForTeam(team.id, discipline);
                              const utilPct = maxCapacity > 0 ? Math.round((capacity / maxCapacity) * 100) : 0;
                              return (
                                <TableCell key={sprint.id} className="text-center">
                                  <span className={cn(
                                    "text-xs font-semibold tabular-nums",
                                    utilPct > 100 ? "text-destructive" : utilPct > 80 ? "text-amber-600" : "text-foreground"
                                  )}>
                                    {utilPct}%
                                  </span>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // For specific team selected, show discipline and member breakdown
   const selectedTeam = teams.find(t => t.id === selectedTeamId);
   const teamMembers = members.filter(m => m.team_id === selectedTeamId);
   const disciplines = [...new Set(teamMembers.map(m => m.discipline))].sort();

   const getSortedMembers = () => {
     const getMemberAvgUtil = (memberId) => {
       const totalAlloc = allocations
         .filter(a => a.team_member_id === memberId)
         .reduce((sum, a) => sum + (a.percent || 0), 0);
       const maxCapacity = teamMembers.find(m => m.id === memberId)?.availability_percent || 100;
       return maxCapacity > 0 ? Math.round((totalAlloc / maxCapacity) * 100) : 0;
     };

     return [...teamMembers].sort((a, b) => {
       if (sortMembersBy === "name") return a.name.localeCompare(b.name);
       if (sortMembersBy === "utilization-asc") return getMemberAvgUtil(a.id) - getMemberAvgUtil(b.id);
       if (sortMembersBy === "utilization-desc") return getMemberAvgUtil(b.id) - getMemberAvgUtil(a.id);
       return 0;
     });
   };

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