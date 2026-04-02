import React, { useState, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, AlertTriangle } from "lucide-react";
import { useSelectedQuarter, useSelectedTeam } from "@/lib/useSelectedQuarter";
import { useQuarters } from "@/lib/useQuarters";
import PageHeader from "../components/shared/PageHeader";
import FilterBar from "../components/shared/FilterBar";
import EmptyState from "../components/shared/EmptyState";
import StatsRow from "../components/dashboard/StatsRow";
import CapacityOverviewTable from "../components/dashboard/CapacityOverviewTable";
import DisciplineBreakdown from "../components/dashboard/DisciplineBreakdown";
import UtilizationByWorkItemType from "../components/dashboard/UtilizationByWorkItemType";
import TeamCapacityChart from "../components/dashboard/TeamCapacityChart";
import ExecutiveSummary from "../components/dashboard/ExecutiveSummary";
import AllocationHeatMap from "../components/dashboard/AllocationHeatMap";
import QuarterlyAllocationReport from "../components/dashboard/QuarterlyAllocationReport";
import QuarterlyTeamsSummary from "../components/dashboard/QuarterlyTeamsSummary";
import QuarterlyExportButtons from "../components/dashboard/QuarterlyExportButtons";
import QuarterlyWorkItemSummary from "../components/dashboard/QuarterlyWorkItemSummary";
import QuarterlyDisciplineSummary from "../components/dashboard/QuarterlyDisciplineSummary";

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

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => bragiQTC.entities.Sprint.list()
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => bragiQTC.entities.Allocation.list()
  });

  const { data: quarterlyAllocations = [] } = useQuery({
    queryKey: ["quarterlyAllocations"],
    queryFn: () => bragiQTC.entities.QuarterlyAllocation.list()
  });

  const { data: workAreaSelections = [] } = useQuery({
    queryKey: ["workAreaSelections"],
    queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list()
  });

  // Cleanup template sprint allocations on mount
  React.useEffect(() => {
    const cleanupTemplateAllocations = async () => {
      const templateSprintIds = new Set(sprints.filter((s) => s.is_cross_team).map((s) => s.id));
      const orphanedAllocations = allocations.filter((a) => templateSprintIds.has(a.sprint_id));

      if (orphanedAllocations.length > 0) {
        console.log(`Cleaning up ${orphanedAllocations.length} template sprint allocations...`);
        for (const alloc of orphanedAllocations) {
          await bragiQTC.entities.Allocation.delete(alloc.id);
        }
      }
    };

    if (sprints.length > 0 && allocations.length > 0) {
      cleanupTemplateAllocations();
    }
  }, [sprints.length, allocations.length]);

  // ── Sprint tab data ──────────────────────────────────────────────────────────

  const quarterSprints = sprints
    .filter((s) => {
      if (s.quarter !== selectedQuarter) return false;
      if (s.is_cross_team) return false;
      if (selectedTeamId === "all") return true;
      return s.team_id === selectedTeamId;
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const quarters = useQuarters(sprints).filter(q => !q.includes('2025'));

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter((wa) => wa.is_cross_team || wa.leading_team_id === selectedTeamId || wa.supporting_team_ids.includes(selectedTeamId));

  const activeTeams = useMemo(() => teams.filter(t => t.is_active !== false), [teams]);
  const activeMembers = useMemo(() => members.filter(m => activeTeams.some(t => t.id === m.team_id)), [members, activeTeams]);

  // ── Quarterly tab data ───────────────────────────────────────────────────────

  // Members scoped to the selected team
  const quarterlyTabMembers = useMemo(() =>
    selectedTeamId === "all" ? activeMembers : activeMembers.filter(m => m.team_id === selectedTeamId),
    [activeMembers, selectedTeamId]
  );

  // Work areas restricted to what was actually selected in the quarterly plan,
  // plus any work areas that have actual allocations for the team's members.
  const quarterlyTabWorkAreas = useMemo(() => {
    if (selectedTeamId === "all") return filteredWorkAreas;

    // Work areas that have existing allocations for this team's members this quarter
    const memberIds = new Set(quarterlyTabMembers.map(m => m.id));
    const allocatedWaIds = new Set(
      quarterlyAllocations
        .filter(a => memberIds.has(a.team_member_id) && a.quarter === selectedQuarter)
        .map(a => a.work_area_id)
    );

    const selection = workAreaSelections.find(
      s => s.team_id === selectedTeamId && s.quarter === selectedQuarter
    );
    const baseIds = new Set([
      ...(selection?.work_area_ids?.length ? selection.work_area_ids : filteredWorkAreas.map(wa => wa.id)),
      ...allocatedWaIds,
    ]);
    return workAreas.filter(wa => baseIds.has(wa.id));
  }, [workAreas, filteredWorkAreas, workAreaSelections, selectedTeamId, selectedQuarter, quarterlyAllocations, quarterlyTabMembers]);

  // Over-allocated members in the quarterly plan for the selected quarter + team
  const quarterlyAlerts = useMemo(() => {
    const relevantMembers = selectedTeamId === "all" ? activeMembers : quarterlyTabMembers;
    const quarterAllocs = quarterlyAllocations.filter(a => a.quarter === selectedQuarter);
    const teamMap = Object.fromEntries(activeTeams.map(t => [t.id, t.name]));

    return relevantMembers
      .map(member => {
        const total = quarterAllocs
          .filter(a => a.team_member_id === member.id)
          .reduce((sum, a) => sum + (a.days || 0), 0);
        return { member, total, teamName: teamMap[member.team_id] ?? "" };
      })
      .filter(({ total }) => total > 60) // default quarterly capacity is 60 days
      .sort((a, b) => b.total - a.total);
  }, [members, quarterlyTabMembers, quarterlyAllocations, selectedQuarter, selectedTeamId, teams]);

  // Group quarterly alerts by team → discipline for display
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

  const isLoading = teamsLoading;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Capacity Overview" />

      <FilterBar
        quarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        team={selectedTeamId}
        onTeamChange={setSelectedTeamId}
        teams={teams}
        quarters={quarters}
        showTeamFilter={true}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          <StatsRow
            teams={activeTeams}
            members={activeMembers}
            workAreas={filteredWorkAreas}
            sprints={quarterSprints}
            allocations={allocations}
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
              {/* Over-allocation alerts — one card per team */}
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
                {/* Top 15 Work Items + Allocation by Type — always at the top */}
                <QuarterlyWorkItemSummary
                  members={selectedTeamId === "all" ? activeMembers : quarterlyTabMembers}
                  workAreas={workAreas}
                  quarterlyAllocations={quarterlyAllocations}
                  selectedQuarter={selectedQuarter}
                />

                {selectedTeamId === "all" ? (
                  <QuarterlyTeamsSummary
                    teams={activeTeams}
                    members={activeMembers}
                    workAreas={workAreas}
                    quarterlyAllocations={quarterlyAllocations}
                    workAreaSelections={workAreaSelections}
                    selectedQuarter={selectedQuarter}
                  />
                ) : (
                  <>
                    {/* Discipline allocation for the selected team */}
                    <QuarterlyDisciplineSummary
                      members={quarterlyTabMembers}
                      quarterlyAllocations={quarterlyAllocations}
                      selectedQuarter={selectedQuarter}
                    />

                    {/* Member × work area allocation table */}
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
                        />
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>

            {/* Sprint Plan tab hidden — kept for future use */}
            {false && <div>
              {quarterSprints.length === 0 ? (
                <EmptyState
                  icon={CalendarRange}
                  title="No sprints found"
                  description="No sprints exist for the selected team and quarter. Create sprints in Capacity Planning."
                />
              ) : (
                <div className="space-y-6">
                  <ExecutiveSummary
                    teams={teams}
                    sprints={sprints}
                    members={members}
                    allocations={allocations}
                    workAreas={workAreas}
                    selectedQuarter={selectedQuarter}
                    selectedTeamId={selectedTeamId}
                  />

                  <TeamCapacityChart
                    teams={teams}
                    sprints={quarterSprints}
                    members={members}
                    allocations={allocations}
                    selectedTeamId={selectedTeamId}
                    selectedQuarter={selectedQuarter}
                  />

                  <AllocationHeatMap
                    teams={teams}
                    members={members}
                    sprints={quarterSprints}
                    allocations={allocations}
                    workAreas={workAreas}
                    selectedQuarter={selectedQuarter}
                    selectedTeamId={selectedTeamId}
                  />

                  <Card>
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-base font-bold">
                        Capacity Overview — {selectedQuarter}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <CapacityOverviewTable
                        sprints={quarterSprints}
                        teams={teams}
                        members={members}
                        allocations={allocations}
                        selectedTeamId={selectedTeamId}
                        workAreas={filteredWorkAreas}
                      />
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <DisciplineBreakdown
                      sprints={quarterSprints}
                      members={members}
                      allocations={allocations}
                      selectedTeamId={selectedTeamId}
                    />
                    <Card>
                      <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-base font-bold">
                          Utilization by Work Item Types
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <UtilizationByWorkItemType
                          workAreas={filteredWorkAreas}
                          allocations={allocations}
                          members={members}
                          sprints={quarterSprints}
                          selectedTeamId={selectedTeamId}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>}
        </>
      )}
    </div>
  );
}
