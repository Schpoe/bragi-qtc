import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, getTeamColor, getDisciplineColor } from "@/lib/utils";
import QuarterlyTopicBreakdown from "./QuarterlyTopicBreakdown";

function UtilBar({ value, color }) {
  const capped = Math.min(value, 100);
  const isOver = value > 100;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${capped}%`,
          backgroundColor: isOver ? "#ef4444" : color || "#3b82f6",
        }}
      />
    </div>
  );
}

export default function QuarterlyTeamsSummary({
  teams,
  members,
  workAreas,
  quarterlyAllocations,
  workAreaSelections,
  selectedQuarter,
  capacityMap = {},
}) {
  const quarterAllocations = useMemo(
    () => quarterlyAllocations.filter((a) => a.quarter === selectedQuarter),
    [quarterlyAllocations, selectedQuarter]
  );

  // ── Per-team derived data ────────────────────────────────────────────────────
  const teamData = useMemo(() => {
    return teams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      const memberIds = new Set(teamMembers.map((m) => m.id));

      const teamAllocs = quarterAllocations.filter((a) =>
        memberIds.has(a.team_member_id)
      );

      const totalAllocated = teamAllocs.reduce((sum, a) => sum + (a.days || 0), 0);
      const totalCapacity = teamMembers.reduce((sum, m) => sum + (capacityMap[m.id] ?? 60), 0);
      const overallUtil = totalCapacity > 0 ? Math.round(totalAllocated * 100 / totalCapacity) : 0;

      // By discipline
      const disciplines = [...new Set(teamMembers.map((m) => m.discipline).filter(Boolean))];
      const disciplineBreakdown = disciplines.map((disc) => {
        const discMembers = teamMembers.filter((m) => m.discipline === disc);
        const discMemberIds = new Set(discMembers.map((m) => m.id));
        const discAllocated = teamAllocs
          .filter((a) => discMemberIds.has(a.team_member_id))
          .reduce((sum, a) => sum + (a.days || 0), 0);
        const discCapacity = discMembers.reduce((sum, m) => sum + (capacityMap[m.id] ?? 60), 0);
        const util = discCapacity > 0 ? Math.round(discAllocated * 100 / discCapacity) : 0;
        return { discipline: disc, util };
      }).sort((a, b) => b.util - a.util);

      return {
        team,
        teamMembers,
        memberCount: teamMembers.length,
        overallUtil,
        disciplineBreakdown,
      };
    });
  }, [teams, members, workAreas, quarterAllocations, capacityMap]);

  // ── Cross-team discipline summary ────────────────────────────────────────────
  const allDisciplineBreakdown = useMemo(() => {
    const disciplines = [...new Set(members.map((m) => m.discipline).filter(Boolean))];
    return disciplines.map((disc) => {
      const discMembers = members.filter((m) => m.discipline === disc);
      const discMemberIds = new Set(discMembers.map((m) => m.id));
      const discAllocated = quarterAllocations
        .filter((a) => discMemberIds.has(a.team_member_id))
        .reduce((sum, a) => sum + (a.days || 0), 0);
      const discCapacity = discMembers.reduce((sum, m) => sum + (capacityMap[m.id] ?? 60), 0);
      const util = discCapacity > 0 ? Math.round(discAllocated * 100 / discCapacity) : 0;
      const count = discMembers.length;
      return { discipline: disc, util, count };
    }).sort((a, b) => b.util - a.util);
  }, [members, quarterAllocations, capacityMap]);

  if (teams.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* ── All-teams discipline summary ─────────────────────────────────────── */}
      <Card className="border-primary/20">
        <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent pb-4">
          <CardTitle className="text-base font-bold text-foreground">
            Allocation by Discipline — All Teams · {selectedQuarter}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {allDisciplineBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No discipline data</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {allDisciplineBreakdown.map(({ discipline, util, count }) => (
                <div key={discipline}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getDisciplineColor(discipline) }}
                      />
                      <span className="text-sm font-medium">{discipline}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        util > 100 ? "text-destructive" : util > 80 ? "text-amber-600" : "text-foreground"
                      )}
                    >
                      {util}%
                    </span>
                  </div>
                  <UtilBar value={util} color={getDisciplineColor(discipline)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Per-team cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teamData.map(({ team, teamMembers, memberCount, overallUtil, disciplineBreakdown }) => {
          const teamColor = getTeamColor(team);
          const isOver = overallUtil > 100;
          return (
            <Card key={team.id} className="border-l-4" style={{ borderLeftColor: teamColor }}>
              <CardHeader className="pb-3 border-b">
                {/* Team header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
                    <CardTitle className="text-base font-bold">{team.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">{memberCount} member{memberCount !== 1 ? "s" : ""}</span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      isOver ? "text-destructive" : overallUtil > 80 ? "text-amber-600" : "text-green-600"
                    )}
                  >
                    {overallUtil}%
                  </span>
                </div>
                <UtilBar value={overallUtil} color={isOver ? "#ef4444" : teamColor} />
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 gap-4">
                {/* Discipline breakdown */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">By Discipline</p>
                  {disciplineBreakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : (
                    <div className="space-y-2.5">
                      {disciplineBreakdown.map(({ discipline, util }) => (
                        <div key={discipline}>
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getDisciplineColor(discipline) }}
                              />
                              <span className="text-xs font-medium">{discipline}</span>
                            </div>
                            <span className={cn("text-xs font-semibold tabular-nums", util > 100 ? "text-destructive" : "")}>
                              {util}%
                            </span>
                          </div>
                          <UtilBar value={util} color={getDisciplineColor(discipline)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topic breakdown with % */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">By Topic</p>
                  <QuarterlyTopicBreakdown
                    members={teamMembers}
                    quarterlyAllocations={quarterAllocations}
                    workAreas={workAreas}
                    quarter={selectedQuarter}
                    capacityMap={capacityMap}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
