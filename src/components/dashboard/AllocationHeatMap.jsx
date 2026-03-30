import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, teamColorHex } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function AllocationHeatMap({ teams, members, sprints, allocations, workAreas, selectedQuarter, selectedTeamId }) {
  const heatMapData = useMemo(() => {
    const quarterSprints = sprints.filter(s => 
      s.quarter === selectedQuarter && 
      !s.is_cross_team &&
      (selectedTeamId === "all" || s.team_id === selectedTeamId)
    );

    if (quarterSprints.length === 0) return [];

    const filteredMembers = selectedTeamId === "all" 
      ? members 
      : members.filter(m => m.team_id === selectedTeamId);

    return filteredMembers.map(member => {
      const team = teams.find(t => t.id === member.team_id);
      const memberSprints = quarterSprints.filter(s => s.team_id === member.team_id);
      
      // Calculate allocation per work item across all sprints
      const workAreaAllocations = {};
      let totalAllocation = 0;

      memberSprints.forEach(sprint => {
        const sprintAllocs = allocations.filter(a => 
          a.sprint_id === sprint.id && 
          a.team_member_id === member.id
        );
        
        sprintAllocs.forEach(alloc => {
          const waId = alloc.work_area_id;
          workAreaAllocations[waId] = (workAreaAllocations[waId] || 0) + alloc.days;
          totalAllocation += alloc.days;
        });
      });

      // Average allocation per work item
      const sprintCount = memberSprints.length || 1;
      Object.keys(workAreaAllocations).forEach(waId => {
        workAreaAllocations[waId] = Math.round(workAreaAllocations[waId] / sprintCount);
      });

      const avgTotalAllocation = Math.round(totalAllocation / sprintCount);
      const maxCapacity = member.sprint_days || 10;
      const utilizationPct = maxCapacity > 0 ? Math.round((avgTotalAllocation / maxCapacity) * 100) : 0;

      return {
        member,
        team,
        workAreaAllocations,
        avgTotalAllocation,
        utilizationPct,
        maxCapacity,
      };
    }).filter(d => d.avgTotalAllocation > 0);
  }, [teams, members, sprints, allocations, workAreas, selectedQuarter, selectedTeamId]);

  const relevantWorkAreas = useMemo(() => {
    const waIds = new Set();
    heatMapData.forEach(d => {
      Object.keys(d.workAreaAllocations).forEach(waId => waIds.add(waId));
    });
    return workAreas.filter(wa => waIds.has(wa.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [heatMapData, workAreas]);

  const getHeatColor = (percent, maxCapacity) => {
    if (!percent || percent === 0) return "bg-muted/30";
    
    const utilPct = (percent / maxCapacity) * 100;
    
    if (utilPct > 100) return "bg-destructive/90 text-destructive-foreground";
    if (utilPct > 80) return "bg-amber-500/80 text-white";
    if (utilPct > 60) return "bg-amber-400/70 text-white";
    if (utilPct > 40) return "bg-primary/70 text-primary-foreground";
    if (utilPct > 20) return "bg-primary/50 text-foreground";
    return "bg-primary/30 text-foreground";
  };

  const getUtilizationBadge = (utilPct) => {
    if (utilPct > 100) return { variant: "destructive", label: "Over-allocated" };
    if (utilPct > 80) return { className: "bg-amber-500 text-white", label: "High Load" };
    if (utilPct > 50) return { variant: "secondary", label: "Active" };
    return { variant: "outline", label: "Under-utilized" };
  };

  if (heatMapData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Allocation Heat Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            No allocation data available for {selectedQuarter}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Allocation Heat Map — {selectedQuarter}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Average allocation per team member across work items
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 pb-3 border-b text-xs">
              <span className="font-medium text-muted-foreground">Legend:</span>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-primary/30" />
                <span className="text-muted-foreground">Low (0-20%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-primary/70" />
                <span className="text-muted-foreground">Medium (20-60%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-400/70" />
                <span className="text-muted-foreground">High (60-80%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-amber-500/80" />
                <span className="text-muted-foreground">Very High (80-100%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-destructive/90" />
                <span className="text-muted-foreground">Over (&gt;100%)</span>
              </div>
            </div>

            {/* Heat map table */}
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `200px 100px repeat(${relevantWorkAreas.length}, 80px)` }}>
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Team Member</div>
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1 text-center">Status</div>
                {relevantWorkAreas.map(wa => (
                  <div key={wa.id} className="text-xs font-semibold text-muted-foreground px-2 py-1 text-center">
                    <div className="truncate" title={wa.name}>{wa.name}</div>
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {heatMapData.map(({ member, team, workAreaAllocations, avgTotalAllocation, utilizationPct, maxCapacity }) => {
                const badge = getUtilizationBadge(utilizationPct);
                return (
                  <div 
                    key={member.id} 
                    className="grid gap-2 items-center hover:bg-muted/30 transition-colors rounded-lg p-1"
                    style={{ gridTemplateColumns: `200px 100px repeat(${relevantWorkAreas.length}, 80px)` }}
                  >
                    <div className="px-2">
                      <div className="flex items-center gap-2">
                        {team && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColorHex[team.color] || "#3b82f6" }} />}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" title={member.name}>{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.discipline}</div>
                        </div>
                      </div>
                    </div>
                    <div className="px-2 text-center">
                      <Badge 
                        variant={badge.variant} 
                        className={cn("text-xs whitespace-nowrap", badge.className)}
                      >
                        {utilizationPct}%
                      </Badge>
                    </div>
                    {relevantWorkAreas.map(wa => {
                      const allocation = workAreaAllocations[wa.id] || 0;
                      return (
                        <div key={wa.id} className="px-1">
                          <div 
                            className={cn(
                              "h-12 rounded flex items-center justify-center text-xs font-semibold transition-all",
                              getHeatColor(allocation, maxCapacity)
                            )}
                            title={`${allocation}% avg allocation to ${wa.name}`}
                          >
                            {allocation > 0 ? `${allocation}%` : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Summary statistics */}
            <div className="mt-6 pt-4 border-t space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Quick Stats</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Over-allocated</div>
                  <div className="text-lg font-bold text-destructive">
                    {heatMapData.filter(d => d.utilizationPct > 100).length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">High Load (80-100%)</div>
                  <div className="text-lg font-bold text-amber-600">
                    {heatMapData.filter(d => d.utilizationPct > 80 && d.utilizationPct <= 100).length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Active (50-80%)</div>
                  <div className="text-lg font-bold">
                    {heatMapData.filter(d => d.utilizationPct > 50 && d.utilizationPct <= 80).length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Under-utilized (&lt;50%)</div>
                  <div className="text-lg font-bold text-muted-foreground">
                    {heatMapData.filter(d => d.utilizationPct <= 50).length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}