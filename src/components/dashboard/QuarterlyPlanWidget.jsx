import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

export default function QuarterlyPlanWidget({ sprints, teams, members, allocations, selectedQuarter, selectedTeamId }) {
  const quarterSprints = sprints.filter(s => 
    s.quarter === selectedQuarter && !s.is_cross_team && (selectedTeamId === "all" || s.team_id === selectedTeamId)
  ).sort((a, b) => (a.order || 0) - (b.order || 0));

  const quarterTeams = selectedTeamId === "all" 
    ? teams 
    : teams.filter(t => t.id === selectedTeamId);

  const sprintStats = useMemo(() => {
    return quarterSprints.map(sprint => {
      const sprintMembers = selectedTeamId === "all"
        ? members.filter(m => m.team_id === sprint.team_id)
        : members.filter(m => m.team_id === selectedTeamId);
      
      const maxCapacity = sprintMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);
      const allocated = allocations
        .filter(a => a.sprint_id === sprint.id && sprintMembers.some(m => m.id === a.team_member_id))
        .reduce((sum, a) => sum + a.percent, 0);
      
      const utilization = maxCapacity > 0 ? Math.round((allocated / maxCapacity) * 100) : 0;
      
      return {
        sprint,
        maxCapacity,
        allocated,
        utilization,
        isOverAllocated: allocated > maxCapacity,
        isUnderutilized: utilization < 70
      };
    });
  }, [quarterSprints, members, allocations, selectedTeamId]);

  const teamStats = useMemo(() => {
    return quarterTeams.map(team => {
      const teamMembers = members.filter(m => m.team_id === team.id);
      const teamSprints = quarterSprints.filter(s => s.team_id === team.id);
      const maxCapacity = teamMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);
      const allocated = allocations
        .filter(a => teamSprints.some(s => s.id === a.sprint_id) && teamMembers.some(m => m.id === a.team_member_id))
        .reduce((sum, a) => sum + a.percent, 0);
      
      const utilization = maxCapacity > 0 ? Math.round((allocated / maxCapacity) * 100) : 0;
      
      return {
        team,
        sprintCount: teamSprints.length,
        memberCount: teamMembers.length,
        utilization,
        isOverAllocated: allocated > maxCapacity
      };
    });
  }, [quarterTeams, quarterSprints, members, allocations]);

  const overAllocatedCount = sprintStats.filter(s => s.isOverAllocated).length;
  const underutilizedCount = sprintStats.filter(s => s.isUnderutilized).length;

  if (quarterSprints.length === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Quarterly Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">No sprints planned for {selectedQuarter}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Quarterly Plan — {selectedQuarter}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground">{quarterTeams.length}</div>
            <div className="text-xs text-muted-foreground">Teams</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground">{quarterSprints.length}</div>
            <div className="text-xs text-muted-foreground">Sprints</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-foreground">{members.filter(m => selectedTeamId === "all" || m.team_id === selectedTeamId).length}</div>
            <div className="text-xs text-muted-foreground">Members</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className={cn("text-lg font-bold", overAllocatedCount > 0 ? "text-destructive" : "text-green-600")}>
              {overAllocatedCount > 0 ? overAllocatedCount : "0"}
            </div>
            <div className="text-xs text-muted-foreground">Over-allocated</div>
          </div>
        </div>

        {/* Sprint Details */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sprint Breakdown</div>
          <div className="space-y-1.5">
            {sprintStats.map(({ sprint, utilization, isOverAllocated, isUnderutilized }) => {
              const team = teams.find(t => t.id === sprint.team_id);
              return (
                <div key={sprint.id} className="flex items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-md">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {team && (
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: team.color ? `hsl(var(--${team.color}-500))` : "#3b82f6" }} 
                      />
                    )}
                    <span className="text-xs font-medium truncate">{sprint.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all",
                          isOverAllocated ? "bg-destructive" : isUnderutilized ? "bg-amber-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-bold tabular-nums w-8 text-right", isOverAllocated ? "text-destructive" : "text-foreground")}>
                      {utilization}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}