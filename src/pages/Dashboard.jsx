import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentQuarter, sortQuarters } from "@/lib/quarter-utils";
import PageHeader from "../components/shared/PageHeader";
import FilterBar from "../components/shared/FilterBar";
import StatsRow from "../components/dashboard/StatsRow";
import CapacityOverviewTable from "../components/dashboard/CapacityOverviewTable";
import DisciplineBreakdown from "../components/dashboard/DisciplineBreakdown";
import UtilizationByWorkItemType from "../components/dashboard/UtilizationByWorkItemType";
import TeamCapacityChart from "../components/dashboard/TeamCapacityChart";
import ExecutiveSummary from "../components/dashboard/ExecutiveSummary";
import AllocationHeatMap from "../components/dashboard/AllocationHeatMap";

export default function Dashboard() {
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter());
  const [selectedTeamId, setSelectedTeamId] = useState("all");

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
  });

  // Cleanup template sprint allocations on mount
  React.useEffect(() => {
    const cleanupTemplateAllocations = async () => {
      const templateSprintIds = new Set(sprints.filter(s => s.is_cross_team).map(s => s.id));
      const orphanedAllocations = allocations.filter(a => templateSprintIds.has(a.sprint_id));
      
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

  const quarterSprints = sprints
    .filter(s => {
      if (s.quarter !== selectedQuarter) return false;
      if (s.is_cross_team) return false; // Exclude templates
      if (selectedTeamId === "all") return true;
      return s.team_id === selectedTeamId;
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const generateQuarters = () => {
    const currentQuarter = getCurrentQuarter();
    const quarters = new Set([currentQuarter]);
    
    // Add quarters from existing sprints
    sprints.forEach(s => quarters.add(s.quarter));
    
    // Add next 8 quarters and previous 4 quarters
    const [currQ, currYear] = currentQuarter.match(/Q(\d) (\d{4})/).slice(1);
    const currYearNum = parseInt(currYear);
    const currQNum = parseInt(currQ);
    
    for (let i = -4; i <= 8; i++) {
      let q = currQNum + i;
      let y = currYearNum;
      while (q > 4) {
        q -= 4;
        y += 1;
      }
      while (q < 1) {
        q += 4;
        y -= 1;
      }
      quarters.add(`Q${q} ${y}`);
    }
    
    return Array.from(quarters).filter(quarter => !quarter.includes('2025'));
  };
  
  const quarters = generateQuarters();
  sortQuarters(quarters);

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.team_id === selectedTeamId);

  const isLoading = teamsLoading;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Capacity Overview" />

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
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
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
                />
              </CardContent>
            </Card>
            <TeamCapacityChart
              teams={teams}
              sprints={sprints}
              members={members}
              allocations={allocations}
              selectedTeamId={selectedTeamId}
              selectedQuarter={selectedQuarter}
            />
            <AllocationHeatMap
              teams={teams}
              members={members}
              sprints={sprints}
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
        </>
      )}
    </div>
  );
}