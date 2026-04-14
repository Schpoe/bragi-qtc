import React, { useState, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useSelectedQuarter, useSelectedTeam } from "@/lib/useSelectedQuarter";
import { useQuarters } from "@/lib/useQuarters";
import PageHeader from "../components/shared/PageHeader";
import FilterBar from "../components/shared/FilterBar";
import StatsRow from "../components/dashboard/StatsRow";
import QuarterlyAllocationReport from "../components/dashboard/QuarterlyAllocationReport";
import QuarterlyTeamsSummary from "../components/dashboard/QuarterlyTeamsSummary";
import QuarterlyExportButtons from "../components/dashboard/QuarterlyExportButtons";
import QuarterlyWorkItemSummary from "../components/dashboard/QuarterlyWorkItemSummary";
import QuarterlyDisciplineSummary from "../components/dashboard/QuarterlyDisciplineSummary";
import QuarterlyTopicBreakdown from "../components/dashboard/QuarterlyTopicBreakdown";

export default function Dashboard() {
  const [selectedQuarter, setSelectedQuarter] = useSelectedQuarter();
  const [selectedTeamId, setSelectedTeamId] = useSelectedTeam();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => bragiQTC.entities.Team.list()
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => bragiQTC.entities.TeamMember.list()
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => bragiQTC.entities.WorkArea.list()
  });

  const { data: quarterlyAllocations = [] } = useQuery({
    queryKey: ["quarterlyAllocations"],
    queryFn: () => bragiQTC.entities.QuarterlyAllocation.list()
  });

  const { data: workAreaSelections = [] } = useQuery({
    queryKey: ["workAreaSelections"],
    queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list()
  });

  const { data: memberCapacities = [] } = useQuery({
    queryKey: ["teamMemberCapacities", selectedQuarter],
    queryFn: () => bragiQTC.entities.TeamMemberCapacity.filter({ quarter: selectedQuarter }),
    enabled: !!selectedQuarter,
  });

  const capacityMap = useMemo(() => {
    const map = {};
    memberCapacities.forEach(c => { map[c.team_member_id] = c.working_days; });
    return map;
  }, [memberCapacities]);

  const activeTeams = useMemo(() => teams.filter(t => t.is_active !== false), [teams]);
  const activeMembers = useMemo(() => members.filter(m => activeTeams.some(t => t.id === m.team_id)), [members, activeTeams]);

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.leading_team_id === selectedTeamId || (wa.supporting_team_ids || []).includes(selectedTeamId));

  // Members scoped to selected team
  const quarterlyTabMembers = useMemo(() =>
    selectedTeamId === "all" ? activeMembers : activeMembers.filter(m => m.team_id === selectedTeamId),
    [activeMembers, selectedTeamId]
  );

  // Work areas for selected team+quarter
  const quarterlyTabWorkAreas = useMemo(() => {
    if (selectedTeamId === "all") return filteredWorkAreas;
    const memberIds = new Set(quarterlyTabMembers.map(m => m.id));
    const allocatedWaIds = new Set(
      quarterlyAllocations
        .filter(a => memberIds.has(a.team_member_id) && a.quarter === selectedQuarter)
        .map(a => a.work_area_id)
    );
    const selection = workAreaSelections.find(s => s.team_id === selectedTeamId && s.quarter === selectedQuarter);
    const baseIds = new Set([...(selection?.work_area_ids || []), ...allocatedWaIds]);
    if (baseIds.size === 0) filteredWorkAreas.forEach(wa => baseIds.add(wa.id));
    return workAreas.filter(wa => baseIds.has(wa.id));
  }, [workAreas, filteredWorkAreas, workAreaSelections, selectedTeamId, selectedQuarter, quarterlyAllocations, quarterlyTabMembers]);

  // Over-allocated members
  const quarterlyAlerts = useMemo(() => {
    const relevantMembers = selectedTeamId === "all" ? activeMembers : quarterlyTabMembers;
    const quarterAllocs = quarterlyAllocations.filter(a => a.quarter === selectedQuarter);
    const teamMap = Object.fromEntries(activeTeams.map(t => [t.id, t.name]));
    return relevantMembers
      .map(member => {
        const total = quarterAllocs.filter(a => a.team_member_id === member.id).reduce((sum, a) => sum + (a.days || 0), 0);
        const capacity = capacityMap[member.id] ?? 60;
        return { member, total, capacity, teamName: teamMap[member.team_id] ?? "" };
      })
      .filter(({ total, capacity }) => total > capacity)
      .sort((a, b) => b.total - a.total);
  }, [activeMembers, quarterlyTabMembers, quarterlyAllocations, selectedQuarter, selectedTeamId, activeTeams, capacityMap]);

  const quarterlyAlertsByTeam = useMemo(() => {
    const byTeam = {};
    quarterlyAlerts.forEach(({ member, total, teamName }) => {
      if (!byTeam[teamName]) byTeam[teamName] = {};
      const disc = member.discipline || "Other";
      if (!byTeam[teamName][disc]) byTeam[teamName][disc] = [];
      byTeam[teamName][disc].push({ name: member.name, total });
    });
    return byTeam;
  }, [quarterlyAlerts]);

  // Derive available quarters from existing allocations + date range
  const extraQuarters = useMemo(
    () => [...new Set(quarterlyAllocations.map(a => a.quarter).filter(Boolean))],
    [quarterlyAllocations]
  );
  const quarters = useQuarters(extraQuarters);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Quarterly Capacity Overview" />

      <FilterBar
        quarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        team={selectedTeamId}
        onTeamChange={setSelectedTeamId}
        teams={teams}
        quarters={quarters}
        showTeamFilter={true}
      />

      {teamsLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <StatsRow
            teams={activeTeams}
            members={activeMembers}
            workAreas={filteredWorkAreas}
            selectedTeamId={selectedTeamId}
          />

          <div className="mb-6">
            <div className="flex justify-end mb-4">
              <QuarterlyExportButtons
                teams={activeTeams}
                members={activeMembers}
                workAreas={workAreas}
                quarterlyAllocations={quarterlyAllocations}
                selectedQuarter={selectedQuarter}
                selectedTeamId={selectedTeamId}
              />
            </div>

            {/* Over-allocation alerts */}
            {quarterlyAlerts.length > 0 && (
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  Over-allocation Alerts — {quarterlyAlerts.length} member{quarterlyAlerts.length !== 1 ? "s" : ""} exceed quarterly capacity
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(quarterlyAlertsByTeam).map(([teamName, byDisc]) => (
                    <Card key={teamName} className="border-destructive/40 bg-destructive/5">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-xs font-bold text-destructive">{teamName}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        {Object.entries(byDisc).map(([disc, members]) => (
                          <div key={disc}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{disc}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {members.map(({ name, total }) => (
                                <div key={name} className="flex items-center gap-1 bg-background border border-destructive/30 rounded px-1.5 py-0.5 text-xs">
                                  <span className="font-semibold text-destructive">{total}d</span>
                                  <span className="text-muted-foreground">·</span>
                                  <span>{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div id="quarterly-plan-content" className="space-y-6">
              <QuarterlyWorkItemSummary
                members={selectedTeamId === "all" ? activeMembers : quarterlyTabMembers}
                workAreas={workAreas}
                quarterlyAllocations={quarterlyAllocations}
                selectedQuarter={selectedQuarter}
                capacityMap={capacityMap}
              />

              {selectedTeamId === "all" ? (
                <QuarterlyTeamsSummary
                  teams={activeTeams}
                  members={activeMembers}
                  workAreas={workAreas}
                  quarterlyAllocations={quarterlyAllocations}
                  workAreaSelections={workAreaSelections}
                  selectedQuarter={selectedQuarter}
                  capacityMap={capacityMap}
                />
              ) : (
                <>
                  <QuarterlyDisciplineSummary
                    members={quarterlyTabMembers}
                    quarterlyAllocations={quarterlyAllocations}
                    selectedQuarter={selectedQuarter}
                    capacityMap={capacityMap}
                  />
                  <Card className="border-primary/20">
                    <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent pb-4">
                      <CardTitle className="text-base font-bold text-foreground">
                        Quarterly Plan — {selectedQuarter}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <QuarterlyAllocationReport
                        members={quarterlyTabMembers}
                        workAreas={quarterlyTabWorkAreas}
                        quarterlyAllocations={quarterlyAllocations}
                        selectedQuarter={selectedQuarter}
                        selectedTeamId={selectedTeamId}
                        capacityMap={capacityMap}
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/60">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-base font-bold text-foreground">Capacity by Topic — {selectedQuarter}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <QuarterlyTopicBreakdown
                        members={quarterlyTabMembers}
                        quarterlyAllocations={quarterlyAllocations}
                        workAreas={workAreas}
                        quarter={selectedQuarter}
                        capacityMap={capacityMap}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
