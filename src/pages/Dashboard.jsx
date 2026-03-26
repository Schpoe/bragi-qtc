import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarRange } from "lucide-react";
import { getCurrentQuarter } from "@/lib/quarter-utils";
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

export default function Dashboard() {
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter());
  const [selectedTeamId, setSelectedTeamId] = useState("all");

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list()
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list()
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list()
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list()
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list()
  });

  const { data: quarterlyAllocations = [] } = useQuery({
    queryKey: ["quarterlyAllocations"],
    queryFn: () => base44.entities.QuarterlyAllocation.list()
  });

  const { data: workAreaSelections = [] } = useQuery({
    queryKey: ["workAreaSelections"],
    queryFn: () => base44.entities.QuarterlyWorkAreaSelection.list()
  });

  // Cleanup template sprint allocations on mount
  React.useEffect(() => {
    const cleanupTemplateAllocations = async () => {
      const templateSprintIds = new Set(sprints.filter((s) => s.is_cross_team).map((s) => s.id));
      const orphanedAllocations = allocations.filter((a) => templateSprintIds.has(a.sprint_id));

      if (orphanedAllocations.length > 0) {
        console.log(`Cleaning up ${orphanedAllocations.length} template sprint allocations...`);
        for (const alloc of orphanedAllocations) {
          await base44.entities.Allocation.delete(alloc.id);
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

  const quarters = useQuarters(sprints);

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter((wa) => wa.is_cross_team || wa.leading_team_id === selectedTeamId || wa.supporting_team_ids.includes(selectedTeamId));

  // ── Quarterly tab data ───────────────────────────────────────────────────────

  // Members scoped to the selected team
  const quarterlyTabMembers = useMemo(() =>
    selectedTeamId === "all" ? members : members.filter(m => m.team_id === selectedTeamId),
    [members, selectedTeamId]
  );

  // Work areas restricted to what was actually selected in the quarterly plan
  const quarterlyTabWorkAreas = useMemo(() => {
    if (selectedTeamId === "all") return filteredWorkAreas;
    const selection = workAreaSelections.find(
      s => s.team_id === selectedTeamId && s.quarter === selectedQuarter
    );
    if (!selection?.work_area_ids?.length) return filteredWorkAreas;
    const selectedIds = new Set(selection.work_area_ids);
    return workAreas.filter(wa => selectedIds.has(wa.id));
  }, [workAreas, filteredWorkAreas, workAreaSelections, selectedTeamId, selectedQuarter]);

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
            teams={teams}
            members={members}
            workAreas={filteredWorkAreas}
            sprints={quarterSprints}
            allocations={allocations}
            selectedTeamId={selectedTeamId}
          />

          <Tabs defaultValue="quarterly" className="mb-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
              <TabsTrigger value="quarterly">Quarterly Plan</TabsTrigger>
              <TabsTrigger value="sprint">Sprint Planning</TabsTrigger>
            </TabsList>

            {/* ── Quarterly Plan tab ──────────────────────────────────────── */}
            <TabsContent value="quarterly">
              <div className="flex justify-end mb-4">
                <QuarterlyExportButtons
                  teams={teams}
                  members={members}
                  workAreas={workAreas}
                  quarterlyAllocations={quarterlyAllocations}
                  selectedQuarter={selectedQuarter}
                  selectedTeamId={selectedTeamId}
                />
              </div>
              <div id="quarterly-plan-content">
                {selectedTeamId === "all" ? (
                  <QuarterlyTeamsSummary
                    teams={teams}
                    members={members}
                    workAreas={workAreas}
                    quarterlyAllocations={quarterlyAllocations}
                    workAreaSelections={workAreaSelections}
                    selectedQuarter={selectedQuarter}
                  />
                ) : (
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
                )}
                <QuarterlyWorkItemSummary
                  members={selectedTeamId === "all" ? members : quarterlyTabMembers}
                  workAreas={workAreas}
                  quarterlyAllocations={quarterlyAllocations}
                  selectedQuarter={selectedQuarter}
                />
              </div>
            </TabsContent>

            {/* ── Sprint Planning tab ─────────────────────────────────────── */}
            <TabsContent value="sprint">
              {quarterSprints.length === 0 ? (
                <EmptyState
                  icon={CalendarRange}
                  title="No sprints found"
                  description="No sprints exist for the selected team and quarter. Create sprints in Capacity Planning."
                />
              ) : (
                <div className="space-y-6">
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardHeader className="pb-3 border-b border-primary/10">
                      <CardTitle className="text-base font-bold text-primary">
                        Executive Summary — {selectedQuarter}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ExecutiveSummary
                        teams={teams}
                        sprints={sprints}
                        members={members}
                        allocations={allocations}
                        workAreas={workAreas}
                        selectedQuarter={selectedQuarter}
                        selectedTeamId={selectedTeamId}
                      />
                    </CardContent>
                  </Card>

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
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
