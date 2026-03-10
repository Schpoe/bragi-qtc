import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarRange, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import SprintFormDialog from "../components/sprint/SprintFormDialog";
import SprintAllocationTable from "../components/sprint/SprintAllocationTable";

const currentYear = new Date().getFullYear();
const currentQ = Math.ceil((new Date().getMonth() + 1) / 3);

export default function SprintPlanning() {
  const [sprintDialogOpen, setSprintDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(`Q${currentQ} ${currentYear}`);
  const [selectedTeamId, setSelectedTeamId] = useState("all");
  const queryClient = useQueryClient();

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: teams = [] } = useQuery({
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

  const handleSaveSprint = (data) => {
    if (editingSprint) {
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
      createAllocation.mutate({
        team_member_id: memberId,
        sprint_id: sprintId,
        work_area_id: workAreaId,
        percent: value,
      });
    }
  };

  const quarterSprints = sprints
    .filter(s => s.quarter === selectedQuarter)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const filteredMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const filteredWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.team_id === selectedTeamId);

  const quarters = [...new Set(sprints.map(s => s.quarter))];
  if (!quarters.includes(selectedQuarter)) quarters.push(selectedQuarter);
  quarters.sort();

  return (
    <div>
      <PageHeader title="Sprintplanung" subtitle="Kapazitäten pro Sprint zuweisen">
        <Button onClick={() => { setEditingSprint(null); setSprintDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Sprint
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Team filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Teams</SelectItem>
            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {sprintsLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : quarterSprints.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Keine Sprints in diesem Quartal"
          description="Erstelle Sprints, um die Kapazitätsplanung zu starten."
        >
          <Button onClick={() => setSprintDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Sprint erstellen
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {quarterSprints.map(sprint => (
            <Card key={sprint.id} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{sprint.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    {sprint.start_date && sprint.end_date && (
                      <span className="text-xs text-muted-foreground mr-3">
                        {sprint.start_date} — {sprint.end_date}
                      </span>
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
                  members={filteredMembers}
                  workAreas={filteredWorkAreas}
                  allocations={allocations}
                  onAllocationChange={handleAllocationChange}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SprintFormDialog
        open={sprintDialogOpen}
        onOpenChange={setSprintDialogOpen}
        sprint={editingSprint}
        existingSprints={quarterSprints}
        onSave={handleSaveSprint}
      />
    </div>
  );
}