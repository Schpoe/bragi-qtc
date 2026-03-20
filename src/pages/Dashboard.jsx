import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import FilterBar from "../components/shared/FilterBar";
import StatsRow from "../components/dashboard/StatsRow";
import CapacityOverviewTable from "../components/dashboard/CapacityOverviewTable";
import DisciplineBreakdown from "../components/dashboard/DisciplineBreakdown";
import UtilizationByWorkItemType from "../components/dashboard/UtilizationByWorkItemType";
import TeamCapacityChart from "../components/dashboard/TeamCapacityChart";
import ExecutiveSummary from "../components/dashboard/ExecutiveSummary";

const currentYear = new Date().getFullYear();
const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

export default function Dashboard() {
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${currentQ} ${currentYear}`);
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

  const quarters = [...new Set(sprints.map(s => s.quarter))];
  if (!quarters.includes(selectedQuarter)) quarters.push(selectedQuarter);
  quarters.sort();

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
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-base font-semibold">
                 Executive Summary — {selectedQuarter}
               </CardTitle>
             </CardHeader>
             <CardContent>
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
           <Card>
             <CardHeader className="pb-3">
               <CardTitle className="text-base font-semibold">
                 Capacity Overview — {selectedQuarter}
               </CardTitle>
             </CardHeader>
             <CardContent>
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
               <CardHeader className="pb-3">
                 <CardTitle className="text-base font-semibold">
                   Utilization by Work Item Types
                 </CardTitle>
               </CardHeader>
               <CardContent>
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