import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarRange, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import FilterBar from "../components/shared/FilterBar";
import SprintFormDialog from "../components/sprint/SprintFormDialog";
import SprintAllocationTable from "../components/sprint/SprintAllocationTable";

const currentYear = new Date().getFullYear();
const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

export default function SprintPlanning() {
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${currentQ} ${currentYear}`);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamSelectDialogOpen, setTeamSelectDialogOpen] = useState(false);
  const [teamSelectValue, setTeamSelectValue] = useState("");
  const [sprintToCopy, setSprintToCopy] = useState(null);
  const queryClient = useQueryClient();

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    onSuccess: (data) => {
      if (data.length > 0 && !selectedTeamId) setSelectedTeamId(data[0].id);
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list(),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
  });

  // Auto-select first team if none selected
  const effectiveTeamId = selectedTeamId || (teams.length > 0 ? teams[0].id : "");

  const createSprint = useMutation({
    mutationFn: (data) => base44.entities.Sprint.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints"] }),
  });

  const updateSprint = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sprint.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints"] }),
  });

  const deleteSprint = useMutation({
    mutationFn: (id) => base44.entities.Sprint.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints"] }),
  });

  const createAllocation = useMutation({
    mutationFn: (data) => base44.entities.Allocation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allocations"] }),
  });

  const updateAllocation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Allocation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allocations"] }),
  });

  const deleteAllocation = useMutation({
    mutationFn: (id) => base44.entities.Allocation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allocations"] }),
  });

  const handleSaveSprint = async (data) => {
    if (editingSprint) {
      // When updating a sprint, clean up allocations for removed work areas
      const oldWorkAreaIds = new Set(editingSprint.relevant_work_area_ids || []);
      const newWorkAreaIds = new Set(data.relevant_work_area_ids || []);
      
      // Find work areas that were removed
      for (const waId of oldWorkAreaIds) {
        if (!newWorkAreaIds.has(waId)) {
          // Delete allocations for this work area in this sprint
          const allocationsToDelete = allocations.filter(
            a => a.sprint_id === editingSprint.id && a.work_area_id === waId
          );
          for (const alloc of allocationsToDelete) {
            await base44.entities.Allocation.delete(alloc.id);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      updateSprint.mutate({ id: editingSprint.id, data });
    } else {
      createSprint.mutate(data);
    }
    setEditingSprint(null);
  };

  const handleAllocationChange = (memberId, sprintId, workAreaId, value) => {
    const existing = allocations.find(
      a => a.team_member_id === memberId && a.sprint_id === sprintId && a.work_area_id === workAreaId
    );
    if (existing) {
      if (value === 0) {
        deleteAllocation.mutate(existing.id);
      } else {
        updateAllocation.mutate({ id: existing.id, data: { percent: value } });
      }
    } else if (value > 0) {
      createAllocation.mutate({ team_member_id: memberId, sprint_id: sprintId, work_area_id: workAreaId, percent: value });
    }
  };

  const handleCopyCrossTeamSprint = (crossTeamSprint) => {
    const teamSpecificSprints = sprints.filter(s => s.quarter === selectedQuarter && s.team_id === effectiveTeamId);
    const team = teams.find(t => t.id === effectiveTeamId);
    const teamName = team ? team.name : "";
    const newSprint = {
      name: teamName ? `${teamName} - ${crossTeamSprint.name}` : crossTeamSprint.name,
      quarter: crossTeamSprint.quarter,
      team_id: effectiveTeamId,
      is_cross_team: false,
      start_date: crossTeamSprint.start_date || "",
      end_date: crossTeamSprint.end_date || "",
      order: teamSpecificSprints.length + 1,
      relevant_work_area_ids: crossTeamSprint.relevant_work_area_ids || [],
    };
    createSprint.mutate(newSprint);
  };

  // Filter sprints: must belong to selected team OR be cross-team, AND match quarter
    const quarterSprints = sprints
      .filter(s => s.quarter === selectedQuarter && (s.is_cross_team || s.team_id === effectiveTeamId))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Get cross-team sprints for current quarter
    const crossTeamSprints = sprints.filter(s => s.quarter === selectedQuarter && s.is_cross_team);

   const teamMembers = members.filter(m => m.team_id === effectiveTeamId);

   const filteredWorkAreas = workAreas.filter(wa => wa.is_cross_team || wa.leading_team_id === effectiveTeamId || wa.supporting_team_ids.includes(effectiveTeamId));

  const quarters = [...new Set(sprints.map(s => s.quarter))];
  if (!quarters.includes(selectedQuarter)) quarters.push(selectedQuarter);
  quarters.sort();

  return (
    <div>
      <PageHeader title="Sprint Planning" subtitle="Record capacities per team and sprint">
        <Button
          onClick={() => { setEditingSprint(null); setSprintDialogOpen(true); }}
          disabled={!effectiveTeamId}
        >
          <Plus className="w-4 h-4 mr-2" /> New Sprint
        </Button>
      </PageHeader>

      <FilterBar
        quarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        team={effectiveTeamId}
        onTeamChange={setSelectedTeamId}
        teams={teams}
        quarters={quarters}
        showTeamFilter={true}
      />

      {teamsLoading || sprintsLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No teams yet" description="First create a team under 'Teams'." />
      ) : quarterSprints.length === 0 && crossTeamSprints.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No sprints for this team & quarter"
          description="Create sprints for this team to start capacity planning."
        >
          <Button onClick={() => setSprintDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Sprint
          </Button>
        </EmptyState>
      ) : quarterSprints.length === 0 && crossTeamSprints.length > 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={CalendarRange}
            title="No team-specific sprints yet"
            description="Copy a cross-team sprint or create a new sprint for this team."
          >
            <Button onClick={() => setSprintDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Sprint
            </Button>
          </EmptyState>
          
          {/* Show available cross-team sprints to copy */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Available Cross-team Sprints</h3>
            <div className="space-y-3">
              {crossTeamSprints.map(sprint => (
                <Card key={sprint.id} className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {sprint.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(Cross-team)</span>
                      </CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleCopyCrossTeamSprint(sprint)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy to Team
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {quarterSprints.map(sprint => {
            const sprintRelevantIds = new Set(sprint.relevant_work_area_ids || []);
            const sprintWorkAreas = filteredWorkAreas.filter(wa => sprintRelevantIds.has(wa.id));

            return (
            <Card key={sprint.id} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {sprint.name}
                    {sprint.is_cross_team && <span className="ml-2 text-xs font-normal text-muted-foreground">(Cross-team)</span>}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {sprint.start_date && sprint.end_date && (
                      <span className="text-xs text-muted-foreground mr-3">
                        {sprint.start_date} — {sprint.end_date}
                      </span>
                    )}
                    {sprint.is_cross_team && (
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-7 w-7" 
                         title="Copy this sprint to team"
                         onClick={() => handleCopyCrossTeamSprint(sprint)}
                       >
                         <Copy className="w-3.5 h-3.5" />
                       </Button>
                     )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSprint(sprint); setSprintDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSprint.mutate(sprint.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <SprintAllocationTable
                  sprint={sprint}
                  members={teamMembers}
                  workAreas={sprintWorkAreas}
                  allocations={allocations}
                  onAllocationChange={handleAllocationChange}
                />
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <SprintFormDialog
        open={sprintDialogOpen}
        onOpenChange={setSprintDialogOpen}
        sprint={editingSprint}
        existingSprints={quarterSprints}
        teams={teams}
        defaultTeamId={effectiveTeamId}
        defaultQuarter={selectedQuarter}
        onSave={handleSaveSprint}
      />
    </div>
  );
}