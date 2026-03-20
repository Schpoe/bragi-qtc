import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import ExportButtons from "./ExportButtons";

function UtilBar({ pct }) {
  const capped = Math.min(pct, 100);
  const color =
  pct > 110 ? "bg-destructive" :
  pct > 100 ? "bg-orange-500" :
  pct >= 80 ? "bg-amber-500" :
  pct >= 50 ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${capped}%` }} />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums w-10 text-right",
      pct > 100 ? "text-destructive" : pct >= 80 ? "text-amber-600" : "text-muted-foreground"
      )}>
        {pct}%
      </span>
    </div>);

}

function StatusBadge({ pct }) {
  if (pct > 110) return <Badge variant="destructive" className="text-xs">Over-booked</Badge>;
  if (pct > 100) return <Badge className="text-xs bg-orange-500 text-white">At limit</Badge>;
  if (pct >= 80) return <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300">High load</Badge>;
  if (pct >= 50) return <Badge variant="secondary" className="text-xs">Healthy</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">Under-utilized</Badge>;
}

export default function ExecutiveSummary({ teams, sprints, members, allocations, workAreas, selectedQuarter }) {
  const data = useMemo(() => {
    const quarterSprints = sprints.
    filter((s) => s.quarter === selectedQuarter && !s.is_cross_team && s.team_id).
    sort((a, b) => (a.order || 0) - (b.order || 0));

    return teams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      const teamMemberIds = new Set(teamMembers.map((m) => m.id));
      const teamSprints = quarterSprints.filter((s) => s.team_id === team.id);
      const teamCapacity = teamMembers.reduce((s, m) => s + (m.availability_percent || 100), 0);

      // Per-sprint utilization
      const sprintStats = teamSprints.map((sprint) => {
        const sprintAllocs = allocations.filter(
          (a) => a.sprint_id === sprint.id && teamMemberIds.has(a.team_member_id)
        );
        const totalAlloc = sprintAllocs.reduce((s, a) => s + (a.percent || 0), 0);
        const utilPct = teamCapacity > 0 ? Math.round(totalAlloc / teamCapacity * 100) : 0;

        // Top work areas by allocation
        const workAreaTotals = {};
        sprintAllocs.forEach((a) => {
          workAreaTotals[a.work_area_id] = (workAreaTotals[a.work_area_id] || 0) + (a.percent || 0);
        });
        const topWorkAreas = Object.entries(workAreaTotals).
        sort(([, a], [, b]) => b - a).
        slice(0, 3).
        map(([waId, pct]) => ({
          name: workAreas.find((wa) => wa.id === waId)?.name || "Unknown",
          pct
        }));

        // Over-allocated members
        const overAllocated = teamMembers.filter((m) => {
          const memberAlloc = sprintAllocs.
          filter((a) => a.team_member_id === m.id).
          reduce((s, a) => s + (a.percent || 0), 0);
          return memberAlloc > (m.availability_percent || 100);
        });

        return { sprint, utilPct, totalAlloc, topWorkAreas, overAllocated };
      });

      // Quarterly aggregate
      const totalAllocAcrossSprints = sprintStats.reduce((s, ss) => s + ss.totalAlloc, 0);
      const maxAcrossSprints = teamCapacity * Math.max(teamSprints.length, 1);
      const quarterlyUtil = maxAcrossSprints > 0 ?
      Math.round(totalAllocAcrossSprints / maxAcrossSprints * 100) :
      0;

      // Discipline breakdown (quarterly aggregate)
      const disciplines = [...new Set(teamMembers.map((m) => m.discipline))].sort();
      const disciplineStats = disciplines.map((discipline) => {
        const discMembers = teamMembers.filter((m) => m.discipline === discipline);
        const discMemberIds = new Set(discMembers.map((m) => m.id));
        const discCapacity = discMembers.reduce((s, m) => s + (m.availability_percent || 100), 0) * Math.max(teamSprints.length, 1);
        const discAlloc = allocations.
        filter((a) => discMemberIds.has(a.team_member_id) && teamSprints.some((s) => s.id === a.sprint_id)).
        reduce((s, a) => s + (a.percent || 0), 0);
        const utilPct = discCapacity > 0 ? Math.round(discAlloc / discCapacity * 100) : 0;
        return { discipline, utilPct, memberCount: discMembers.length };
      });

      // Work area demand (top across all sprints)
      const workAreaTotals = {};
      sprintStats.forEach((ss) =>
      ss.topWorkAreas.forEach((wa) => {
        workAreaTotals[wa.name] = (workAreaTotals[wa.name] || 0) + wa.pct;
      })
      );
      // Re-aggregate directly from allocations for accuracy
      const workAreaAllocMap = {};
      teamSprints.forEach((sprint) => {
        allocations.
        filter((a) => a.sprint_id === sprint.id && teamMemberIds.has(a.team_member_id)).
        forEach((a) => {
          const waName = workAreas.find((wa) => wa.id === a.work_area_id)?.name || "Unknown";
          workAreaAllocMap[waName] = (workAreaAllocMap[waName] || 0) + (a.percent || 0);
        });
      });
      const topWorkAreasQuarterly = Object.entries(workAreaAllocMap).
      sort(([, a], [, b]) => b - a).
      slice(0, 5).
      map(([name, totalPct]) => ({
        name,
        avgPct: teamSprints.length > 0 ? Math.round(totalPct / teamSprints.length) : 0
      }));

      return {
        team,
        teamCapacity,
        teamMemberCount: teamMembers.length,
        quarterlyUtil,
        sprintStats,
        disciplineStats,
        topWorkAreasQuarterly
      };
    }).filter((t) => t.teamMemberCount > 0);
  }, [teams, sprints, members, allocations, workAreas, selectedQuarter]);

  // Alert items: over-allocated sprints
  const alerts = useMemo(() => {
    const items = [];
    data.forEach(({ team, sprintStats }) => {
      sprintStats.forEach(({ sprint, utilPct, overAllocated }) => {
        if (utilPct > 100) {
          items.push({ team: team.name, sprint: sprint.name, utilPct, overAllocated: overAllocated.length });
        }
      });
    });
    return items.sort((a, b) => b.utilPct - a.utilPct);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No team data available for {selectedQuarter}.
      </div>);

  }

  return (
    <div id="executive-summary-content" className="space-y-6">
      {/* Export button */}
      

      
      {/* Alert banner */}
      {alerts.length > 0 &&
      <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Over-allocation Alerts ({alerts.length} sprint{alerts.length !== 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) =>
            <div key={i} className="flex items-center gap-1.5 bg-background border border-destructive/30 rounded-md px-2 py-1 text-xs">
                  <span className="font-semibold text-destructive">{a.utilPct}%</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="font-medium">{a.team}</span>
                  <span className="text-muted-foreground">/</span>
                  <span>{a.sprint}</span>
                  {a.overAllocated > 0 &&
              <span className="ml-1 text-destructive/70">({a.overAllocated} member{a.overAllocated !== 1 ? "s" : ""})</span>
              }
                </div>
            )}
            </div>
          </CardContent>
        </Card>
      }

      {/* Cross-team summary tables - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map(columnIdx => {
          const itemsPerColumn = Math.ceil(data.length / 2);
          const columnData = data.slice(columnIdx * itemsPerColumn, (columnIdx + 1) * itemsPerColumn);
          return columnData.length > 0 ? (
            <Card key={columnIdx}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quarterly Capacity Summary — All Teams × Disciplines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-3 font-semibold text-muted-foreground whitespace-nowrap">Team</th>
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap">Discipline</th>
                        <th className="text-center py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap"># Mbr</th>
                        <th className="text-right py-2 pl-3 font-semibold text-muted-foreground whitespace-nowrap">Q Util</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columnData.map(({ team, disciplineStats }) =>
                      disciplineStats.map(({ discipline, utilPct, memberCount }, di) =>
                      <tr key={`${team.id}-${discipline}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            {di === 0 &&
                        <td className="py-2 pr-3 font-medium align-top whitespace-nowrap" rowSpan={disciplineStats.length}>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color || "#3b82f6" }} />
                                  <span className="truncate max-w-[70px]">{team.name}</span>
                                </div>
                              </td>
                        }
                            <td className="py-2 px-3 text-muted-foreground whitespace-nowrap text-xs">{discipline}</td>
                            <td className="py-2 px-3 text-center text-muted-foreground whitespace-nowrap">{memberCount}</td>
                            <td className="py-2 pl-3 text-right whitespace-nowrap">
                              <span className={cn(
                            "font-semibold tabular-nums",
                            utilPct > 100 ? "text-destructive" : utilPct >= 80 ? "text-amber-600" : "text-foreground"
                          )}>
                                {utilPct}%
                              </span>
                            </td>
                          </tr>
                      )
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })}
      </div>

      {/* Per-team cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {data.map(({ team, teamCapacity, teamMemberCount, quarterlyUtil, sprintStats, disciplineStats, topWorkAreasQuarterly }) =>
        <Card key={team.id} className={cn("border", quarterlyUtil > 100 ? "border-destructive/40" : "border-border")}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color || "#3b82f6" }} />
                  <CardTitle className="text-base truncate">{team.name}</CardTitle>
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Users className="w-3 h-3" />{teamMemberCount}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge pct={quarterlyUtil} />
                  <span className="text-xs text-muted-foreground">Q avg</span>
                </div>
              </div>
              <UtilBar pct={quarterlyUtil} />
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Sprint breakdown */}
              {sprintStats.length > 0 &&
            <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Per Sprint</p>
                  <div className="space-y-1.5">
                    {sprintStats.map(({ sprint, utilPct }) =>
                <div key={sprint.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{sprint.name}</span>
                        <UtilBar pct={utilPct} />
                      </div>
                )}
                  </div>
                </div>
            }

              {/* Discipline breakdown */}
              {disciplineStats.length > 0 &&
            <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">By Discipline</p>
                  <div className="space-y-1.5">
                    {disciplineStats.map(({ discipline, utilPct, memberCount }) =>
                <div key={discipline} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-24 truncate shrink-0">
                          {discipline}
                          <span className="text-muted-foreground/50 ml-1">({memberCount})</span>
                        </span>
                        <UtilBar pct={utilPct} />
                      </div>
                )}
                  </div>
                </div>
            }

              {/* Top work areas */}
              {topWorkAreasQuarterly.length > 0 &&
            <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top Work Items (avg/sprint)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {topWorkAreasQuarterly.map(({ name, avgPct }) =>
                <div key={name} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5 text-xs">
                        <span className="font-medium truncate max-w-[140px]">{name}</span>
                        <span className="text-muted-foreground shrink-0">{avgPct}%</span>
                      </div>
                )}
                  </div>
                </div>
            }
            </CardContent>
          </Card>
        )}
      </div>
    </div>);

}