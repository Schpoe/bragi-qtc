import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { canManageSprints, canManageAllocations, getManageableTeams, canCreateSprint, isViewer } from "@/lib/permissions";
import { Plus, CalendarRange, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { getCurrentQuarter, sortQuarters } from "@/lib/quarter-utils";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import FilterBar from "../components/shared/FilterBar";
import SprintFormDialog from "../components/sprint/SprintFormDialog";
import SprintAllocationTable from "../components/sprint/SprintAllocationTable";
import QuarterlyAllocationTable from "../components/sprint/QuarterlyAllocationTable";
import ConfirmDeleteDialog from "../components/shared/ConfirmDeleteDialog";

export default function SprintPlanning() {
  const { user } = useAuth();
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter());
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const [teamSelectDialogOpen, setTeamSelectDialogOpen] = useState(false);
  const [teamSelectValue, setTeamSelectValue] = useState("");
  const [sprintToCopy, setSprintToCopy] = useState(null);
   const [isCopyOperation, setIsCopyOperation] = useState(false);
   const [copiedToTeamName, setCopiedToTeamName] = useState("");
   const [deleteSprintId, setDeleteSprintId] = useState(null);
   const [deleteAllocationId, setDeleteAllocationId] = useState(null);
   const queryClient = useQueryClient();

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

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

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
  });

  const { data: quarterlyAllocations = [] } = useQuery({
     queryKey: ["quarterlyAllocations"],
     queryFn: () => base44.entities.QuarterlyAllocation.list(),
   });

   const { data: workAreaSelections = [] } = useQuery({
     queryKey: ["workAreaSelections"],
     queryFn: () => base44.entities.QuarterlyWorkAreaSelection.list(),
   });

  // Only auto-select first team when actually viewing a specific team (not "all")
  const effectiveTeamId = selectedTeamId && selectedTeamId !== "all" ? selectedTeamId : (teams.length > 0 && (!selectedTeamId || selectedTeamId === "all") ? teams[0].id : "");
  const isViewingAllTeams = !selectedTeamId || selectedTeamId === "all";

  const createSprint = useMutation({
    mutationFn: (data) => base44.entities.Sprint.create(data),
    onSuccess: (newSprint) => {
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      // If this was a copied sprint, show success and navigate to that team
      if (isCopyOperation && newSprint.team_id) {
         toast.success(`Sprint copied to ${copiedToTeamName} and switched to this team`);
         setSelectedTeamId(newSprint.team_id);
         setIsCopyOperation(false);
         setCopiedToTeamName("");
       }
      setSprintToCopy(null);
      setTeamSelectDialogOpen(false);
      setTeamSelectValue("");
    },
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

  const createQuarterlyAllocation = useMutation({
    mutationFn: (data) => base44.entities.QuarterlyAllocation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const updateQuarterlyAllocation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuarterlyAllocation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const deleteQuarterlyAllocation = useMutation({
    mutationFn: (id) => base44.entities.QuarterlyAllocation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const updateWorkAreaSelection = useMutation({
    mutationFn: async ({ teamId, quarter, workAreaIds }) => {
      const existing = workAreaSelections.find(s => s.team_id === teamId && s.quarter === quarter);
      const oldIds = new Set(existing?.work_area_ids || []);
      const newIds = new Set(workAreaIds);
      
      // Find removed work areas
      const removedIds = Array.from(oldIds).filter(id => !newIds.has(id));
      
      // Delete allocations for removed work areas
      if (removedIds.length > 0) {
        const allocationsToDelete = quarterlyAllocations.filter(a => 
          a.quarter === quarter && 
          removedIds.includes(a.work_area_id) &&
          members.some(m => m.id === a.team_member_id && m.team_id === teamId)
        );
        
        for (const alloc of allocationsToDelete) {
          await base44.entities.QuarterlyAllocation.delete(alloc.id);
        }
      }
      
      // Update selection
      if (existing) {
        return base44.entities.QuarterlyWorkAreaSelection.update(existing.id, { work_area_ids: workAreaIds });
      } else {
        return base44.entities.QuarterlyWorkAreaSelection.create({ team_id: teamId, quarter, work_area_ids: workAreaIds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
      queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] });
    },
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
    const sprint = sprints.find(s => s.id === sprintId);
    if (!sprint || !canManageAllocations(user, sprint.team_id)) {
      return;
    }
    
    const existing = allocations.find(
      a => a.team_member_id === memberId && a.sprint_id === sprintId && a.work_area_id === workAreaId
    );
    if (existing) {
      if (value === 0) {
        setDeleteAllocationId(existing.id);
      } else {
        updateAllocation.mutate({ id: existing.id, data: { percent: value } });
      }
    } else if (value > 0) {
      createAllocation.mutate({ team_member_id: memberId, sprint_id: sprintId, work_area_id: workAreaId, percent: value });
    }
  };

  const handleQuarterlyAllocationChange = (data) => {
    const member = members.find(m => m.id === data.team_member_id);
    if (!member || !canManageAllocations(user, member.team_id)) {
      return;
    }

    // Use the provided allocationId if available, otherwise search for it
    const existing = data.allocationId 
      ? quarterlyAllocations.find(a => a.id === data.allocationId)
      : quarterlyAllocations.find(
          a => a.team_member_id === data.team_member_id && a.quarter === data.quarter && a.work_area_id === data.work_area_id
        );

    if (existing) {
      if (data.percent === 0) {
        deleteQuarterlyAllocation.mutate(existing.id);
      } else {
        updateQuarterlyAllocation.mutate({ id: existing.id, data: { percent: data.percent } });
      }
    } else if (data.percent > 0) {
      createQuarterlyAllocation.mutate({
        team_member_id: data.team_member_id,
        quarter: data.quarter,
        work_area_id: data.work_area_id,
        percent: data.percent
      });
    }
  };

  const handleCopyCrossTeamSprint = (crossTeamSprint) => {
    // If viewing "All Teams", prompt for team selection
    if (isViewingAllTeams) {
      setSprintToCopy(crossTeamSprint);
      setTeamSelectValue("");
      setIsCopyOperation(true);
      setTeamSelectDialogOpen(true);
      return;
    }

    // Copy to currently selected team
    const teamSpecificSprints = sprints.filter(s => s.quarter === selectedQuarter && s.team_id === selectedTeamId);
    const team = teams.find(t => t.id === selectedTeamId);
    const teamName = team ? team.name : "";
    const newSprint = {
      name: teamName ? `${teamName} - ${crossTeamSprint.name}` : crossTeamSprint.name,
      quarter: crossTeamSprint.quarter,
      team_id: selectedTeamId,
      is_cross_team: false,
      start_date: crossTeamSprint.start_date || "",
      end_date: crossTeamSprint.end_date || "",
      order: teamSpecificSprints.length + 1,
      relevant_work_area_ids: crossTeamSprint.relevant_work_area_ids || [],
    };
    setIsCopyOperation(true);
    createSprint.mutate(newSprint);
  };

  const handleConfirmTeamSelect = () => {
    if (!teamSelectValue || !sprintToCopy) return;

    const teamSpecificSprints = sprints.filter(s => s.quarter === selectedQuarter && s.team_id === teamSelectValue);
    const team = teams.find(t => t.id === teamSelectValue);
    const teamName = team ? team.name : "";
    setCopiedToTeamName(teamName);
    const newSprint = {
      name: teamName ? `${teamName} - ${sprintToCopy.name}` : sprintToCopy.name,
      quarter: sprintToCopy.quarter,
      team_id: teamSelectValue,
      is_cross_team: false,
      start_date: sprintToCopy.start_date || "",
      end_date: sprintToCopy.end_date || "",
      order: teamSpecificSprints.length + 1,
      relevant_work_area_ids: sprintToCopy.relevant_work_area_ids || [],
    };
    createSprint.mutate(newSprint);
    setTeamSelectDialogOpen(false);
    setSprintToCopy(null);
    setTeamSelectValue("");
  };

  // Filter sprints: only show team-specific sprints for the selected team
    const quarterSprints = sprints
      .filter(s => s.quarter === selectedQuarter && !s.is_cross_team && s.team_id === effectiveTeamId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Get cross-team sprints for current quarter
    const crossTeamSprints = sprints.filter(s => s.quarter === selectedQuarter && s.is_cross_team);

   const teamMembers = members.filter(m => m.team_id === effectiveTeamId);

   // Get work areas relevant to this team (leading/supporting) plus any with allocations or manually selected
   const teamMemberIds = new Set(teamMembers.map(m => m.id));
   const workAreasWithAllocations = new Set(
     quarterlyAllocations
       .filter(a => teamMemberIds.has(a.team_member_id) && a.quarter === selectedQuarter)
       .map(a => a.work_area_id)
   );

   const currentSelection = workAreaSelections.find(s => s.team_id === effectiveTeamId && s.quarter === selectedQuarter);
   const manuallySelectedIds = new Set(currentSelection?.work_area_ids || []);

   const filteredWorkAreas = workAreas.filter(wa => 
     wa.is_cross_team || 
     wa.leading_team_id === effectiveTeamId || 
     wa.supporting_team_ids.includes(effectiveTeamId) ||
     workAreasWithAllocations.has(wa.id) ||
     manuallySelectedIds.has(wa.id)
   );

  const quarters = [...new Set(sprints.map(s => s.quarter))];
  if (!quarters.includes(selectedQuarter)) quarters.push(selectedQuarter);
  sortQuarters(quarters);

  return (
    <>
    <div>
      <PageHeader title="Capacity Planning" subtitle="Manage team capacity allocations">
        {effectiveTeamId && canCreateSprint(user) && canManageSprints(user, effectiveTeamId) && (
          <Button onClick={() => { setEditingSprint(null); setSprintDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Sprint
          </Button>
        )}
      </PageHeader>

      <FilterBar
         quarter={selectedQuarter}
         onQuarterChange={setSelectedQuarter}
         team={selectedTeamId}
         onTeamChange={setSelectedTeamId}
         teams={teams}
         quarters={quarters}
         showTeamFilter={true}
       />

      <Tabs defaultValue="quarterly" className="mb-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="quarterly">Quarterly Plan</TabsTrigger>
          <TabsTrigger value="sprints">Sprint Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly">
          {teamsLoading || sprintsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : teams.length === 0 ? (
            <EmptyState icon={CalendarRange} title="No teams yet" description="First create a team under 'Teams'." />
          ) : !effectiveTeamId ? (
            <EmptyState icon={CalendarRange} title="Select a team" description="Choose a team from the filter to view the quarterly plan." />
          ) : (
            <Card className="border-primary/20">
              <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent pb-4">
                <CardTitle className="text-base font-bold text-foreground">Quarterly Plan — {selectedQuarter}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <QuarterlyAllocationTable
                  members={teamMembers}
                  workAreas={filteredWorkAreas}
                  allocations={quarterlyAllocations}
                  quarter={selectedQuarter}
                  onAllocationChange={handleQuarterlyAllocationChange}
                  selectedTeamId={effectiveTeamId}
                  onSelectionChange={(workAreaIds) => updateWorkAreaSelection.mutate({ teamId: effectiveTeamId, quarter: selectedQuarter, workAreaIds })}
                  initialSelectedWorkAreaIds={manuallySelectedIds}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sprints">
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
          {canCreateSprint(user) && (
            <Button onClick={() => setSprintDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Sprint
            </Button>
          )}
        </EmptyState>
      ) : quarterSprints.length === 0 && crossTeamSprints.length > 0 && !effectiveTeamId ? (
        <div className="space-y-6">
          <EmptyState
            icon={CalendarRange}
            title="No team-specific sprints yet"
            description="Copy a sprint template or create a new sprint for this team."
          >
            {canCreateSprint(user) && (
              <Button onClick={() => setSprintDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Sprint
              </Button>
            )}
          </EmptyState>

          {/* Show available sprint templates to copy */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Available Sprint Templates</h3>
            <div className="space-y-3">
              {crossTeamSprints.map(sprint => (
                <Card key={sprint.id} className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {sprint.name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">(Template)</span>
                      </CardTitle>
                      {canCreateSprint(user) && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleCopyCrossTeamSprint(sprint)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy to Team
                        </Button>
                      )}
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
            <Card key={sprint.id} className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-bold text-foreground">
                    {sprint.name}
                    {sprint.is_cross_team && <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">(Template)</span>}
                  </CardTitle>
                  <div className="flex items-center gap-1 flex-wrap">
                    {sprint.start_date && sprint.end_date && (
                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded mr-3">
                        {sprint.start_date} — {sprint.end_date}
                      </span>
                    )}
                    {sprint.is_cross_team && canCreateSprint(user) && canManageSprints(user, effectiveTeamId) && (
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
                    {canManageSprints(user, sprint.team_id || effectiveTeamId) && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingSprint(sprint); setSprintDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteSprintId(sprint.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sprint.is_cross_team ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <p className="mb-3">This is a sprint template. Copy it to a team to create a team-specific sprint.</p>
                    {canCreateSprint(user) && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCopyCrossTeamSprint(sprint)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy to Team
                      </Button>
                    )}
                  </div>
                ) : (
                  <SprintAllocationTable
                    sprint={sprint}
                    members={teamMembers}
                    workAreas={sprintWorkAreas}
                    allocations={allocations}
                    onAllocationChange={handleAllocationChange}
                  />
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
       </TabsContent>
      </Tabs>

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

      <Dialog open={teamSelectDialogOpen} onOpenChange={setTeamSelectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Team to Copy Sprint</DialogTitle>
            <DialogDescription>Choose which team to copy this sprint to.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamSelectValue} onValueChange={setTeamSelectValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamSelectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTeamSelect} disabled={!teamSelectValue}>
              Copy Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteSprintId !== null}
        title="Delete Sprint?"
        description="Are you sure you want to delete this sprint? This action cannot be undone."
        onConfirm={() => {
          deleteSprint.mutate(deleteSprintId);
          setDeleteSprintId(null);
        }}
        onCancel={() => setDeleteSprintId(null)}
        isLoading={deleteSprint.isPending}
      />

      <ConfirmDeleteDialog
        open={deleteAllocationId !== null}
        title="Delete Allocation?"
        description="Are you sure you want to delete this allocation? This action cannot be undone."
        onConfirm={() => {
          deleteAllocation.mutate(deleteAllocationId);
          setDeleteAllocationId(null);
        }}
        onCancel={() => setDeleteAllocationId(null)}
        isLoading={deleteAllocation.isPending}
      />

      <Toaster 
         position="top-center"
         richColors
         closeButton
         toastOptions={{
           style: {
             fontSize: '16px',
             padding: '16px',
             minWidth: '400px',
           },
         }}
       />
      </div>
      </>
      );
      }