import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CleanupPage() {
  const [selectedOrphans, setSelectedOrphans] = useState({
    members: new Set(),
    sprints: new Set(),
    allocations: new Set(),
    workAreas: new Set(),
  });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
  });

  const { data: workAreas = [], isLoading: workAreasLoading } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const promises = [];
      
      for (const id of selectedOrphans.members) {
        promises.push(base44.entities.TeamMember.delete(id));
      }
      for (const id of selectedOrphans.sprints) {
        promises.push(base44.entities.Sprint.delete(id));
      }
      for (const id of selectedOrphans.allocations) {
        promises.push(base44.entities.Allocation.delete(id));
      }
      for (const id of selectedOrphans.workAreas) {
        promises.push(base44.entities.WorkArea.delete(id));
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teamMembers"] });
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["workAreas"] });
      setSelectedOrphans({ members: new Set(), sprints: new Set(), allocations: new Set(), workAreas: new Set() });
      setConfirmDialogOpen(false);
      toast.success("Cleanup completed successfully");
    },
    onError: (error) => {
      toast.error(`Cleanup failed: ${error.message}`);
    },
  });

  const orphanedData = useMemo(() => {
    if (!teams.length) return { members: [], sprints: [], allocations: [], workAreas: [] };

    const teamIds = new Set(teams.map(t => t.id));
    const memberIds = new Set(members.map(m => m.id));
    const sprintIds = new Set(sprints.map(s => s.id));
    const workAreaIds = new Set(workAreas.map(wa => wa.id));

    const orphanedMembers = members.filter(m => m.team_id && !teamIds.has(m.team_id));
    const orphanedSprints = sprints.filter(s => !s.is_cross_team && s.team_id && !teamIds.has(s.team_id));
    const orphanedAllocations = allocations.filter(a =>
      !memberIds.has(a.team_member_id) ||
      !sprintIds.has(a.sprint_id) ||
      !workAreaIds.has(a.work_area_id)
    );
    const orphanedWorkAreas = workAreas.filter(wa => wa.leading_team_id && !teamIds.has(wa.leading_team_id));

    return {
      members: orphanedMembers,
      sprints: orphanedSprints,
      allocations: orphanedAllocations,
      workAreas: orphanedWorkAreas,
    };
  }, [teams, members, sprints, allocations, workAreas]);

  const totalSelected = 
    selectedOrphans.members.size + 
    selectedOrphans.sprints.size + 
    selectedOrphans.allocations.size + 
    selectedOrphans.workAreas.size;

  const totalOrphans = 
    orphanedData.members.length + 
    orphanedData.sprints.length + 
    orphanedData.allocations.length + 
    orphanedData.workAreas.length;

  const toggleSelection = (category, id) => {
    setSelectedOrphans(prev => {
      const newSet = new Set(prev[category]);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, [category]: newSet };
    });
  };

  const selectAll = (category) => {
    setSelectedOrphans(prev => ({
      ...prev,
      [category]: new Set(orphanedData[category].map(item => item.id)),
    }));
  };

  const deselectAll = (category) => {
    setSelectedOrphans(prev => ({
      ...prev,
      [category]: new Set(),
    }));
  };

  const getTeamName = (teamId) => teams.find(t => t.id === teamId)?.name || "Unknown Team";
  const getMemberName = (memberId) => members.find(m => m.id === memberId)?.name || "Unknown Member";
  const getSprintName = (sprintId) => sprints.find(s => s.id === sprintId)?.name || "Unknown Sprint";
  const getWorkAreaName = (waId) => workAreas.find(wa => wa.id === waId)?.name || "Unknown Work Area";

  const isLoading = teamsLoading || membersLoading || sprintsLoading || allocationsLoading || workAreasLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Data Cleanup" subtitle="Identify and remove orphaned data" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <PageHeader title="Data Cleanup" subtitle="Identify and remove orphaned data">
          <Button
            variant="destructive"
            disabled={totalSelected === 0 || deleteMutation.isPending}
            onClick={() => setConfirmDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({totalSelected})
          </Button>
        </PageHeader>

        {totalOrphans === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold">No Orphaned Data Found</h3>
                <p className="text-sm text-muted-foreground">All data is properly linked. Your database is clean!</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-base">Found {totalOrphans} Orphaned Record{totalOrphans !== 1 ? "s" : ""}</CardTitle>
              </div>
              <CardDescription>
                Review and select records to delete. Orphaned data refers to records that reference deleted entities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="members" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="members">
                    Members <Badge variant="secondary" className="ml-2">{orphanedData.members.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="sprints">
                    Sprints <Badge variant="secondary" className="ml-2">{orphanedData.sprints.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="allocations">
                    Allocations <Badge variant="secondary" className="ml-2">{orphanedData.allocations.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="workAreas">
                    Work Areas <Badge variant="secondary" className="ml-2">{orphanedData.workAreas.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="space-y-3 mt-4">
                  {orphanedData.members.length > 0 && (
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm text-muted-foreground">Team members belonging to deleted teams</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => selectAll('members')}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => deselectAll('members')}>Deselect All</Button>
                      </div>
                    </div>
                  )}
                  {orphanedData.members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                      <Checkbox
                        checked={selectedOrphans.members.has(member.id)}
                        onCheckedChange={() => toggleSelection('members', member.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Discipline: {member.discipline} • References deleted team ID: {member.team_id?.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                  {orphanedData.members.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">No orphaned team members</div>
                  )}
                </TabsContent>

                <TabsContent value="sprints" className="space-y-3 mt-4">
                  {orphanedData.sprints.length > 0 && (
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm text-muted-foreground">Sprints belonging to deleted teams</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => selectAll('sprints')}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => deselectAll('sprints')}>Deselect All</Button>
                      </div>
                    </div>
                  )}
                  {orphanedData.sprints.map(sprint => (
                    <div key={sprint.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                      <Checkbox
                        checked={selectedOrphans.sprints.has(sprint.id)}
                        onCheckedChange={() => toggleSelection('sprints', sprint.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{sprint.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Quarter: {sprint.quarter} • References deleted team ID: {sprint.team_id?.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                  {orphanedData.sprints.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">No orphaned sprints</div>
                  )}
                </TabsContent>

                <TabsContent value="allocations" className="space-y-3 mt-4">
                  {orphanedData.allocations.length > 0 && (
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm text-muted-foreground">Allocations referencing deleted members, sprints, or work areas</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => selectAll('allocations')}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => deselectAll('allocations')}>Deselect All</Button>
                      </div>
                    </div>
                  )}
                  {orphanedData.allocations.map(alloc => {
                    const memberExists = members.some(m => m.id === alloc.team_member_id);
                    const sprintExists = sprints.some(s => s.id === alloc.sprint_id);
                    const workAreaExists = workAreas.some(wa => wa.id === alloc.work_area_id);
                    
                    return (
                      <div key={alloc.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                        <Checkbox
                          checked={selectedOrphans.allocations.has(alloc.id)}
                          onCheckedChange={() => toggleSelection('allocations', alloc.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{alloc.percent}% allocation</div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            {!memberExists && <div className="text-destructive">• Member deleted: {alloc.team_member_id.slice(0, 8)}...</div>}
                            {!sprintExists && <div className="text-destructive">• Sprint deleted: {alloc.sprint_id.slice(0, 8)}...</div>}
                            {!workAreaExists && <div className="text-destructive">• Work area deleted: {alloc.work_area_id.slice(0, 8)}...</div>}
                            {memberExists && <div>• Member: {getMemberName(alloc.team_member_id)}</div>}
                            {sprintExists && <div>• Sprint: {getSprintName(alloc.sprint_id)}</div>}
                            {workAreaExists && <div>• Work Area: {getWorkAreaName(alloc.work_area_id)}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {orphanedData.allocations.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">No orphaned allocations</div>
                  )}
                </TabsContent>

                <TabsContent value="workAreas" className="space-y-3 mt-4">
                  {orphanedData.workAreas.length > 0 && (
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm text-muted-foreground">Work areas with deleted leading teams</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => selectAll('workAreas')}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => deselectAll('workAreas')}>Deselect All</Button>
                      </div>
                    </div>
                  )}
                  {orphanedData.workAreas.map(wa => (
                    <div key={wa.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                      <Checkbox
                        checked={selectedOrphans.workAreas.has(wa.id)}
                        onCheckedChange={() => toggleSelection('workAreas', wa.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{wa.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Type: {wa.type} • References deleted leading team ID: {wa.leading_team_id?.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                  {orphanedData.workAreas.length === 0 && (
                    <div className="text-center py-8 text-sm text-muted-foreground">No orphaned work areas</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                You are about to permanently delete {totalSelected} record{totalSelected !== 1 ? "s" : ""}. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {selectedOrphans.members.size > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-semibold text-sm mb-2">Team Members ({selectedOrphans.members.size})</div>
                  <div className="space-y-1">
                    {Array.from(selectedOrphans.members).slice(0, 5).map(id => {
                      const member = members.find(m => m.id === id);
                      return member ? (
                        <div key={id} className="text-xs text-muted-foreground">• {member.name} ({member.discipline})</div>
                      ) : null;
                    })}
                    {selectedOrphans.members.size > 5 && (
                      <div className="text-xs text-muted-foreground">... and {selectedOrphans.members.size - 5} more</div>
                    )}
                  </div>
                </div>
              )}
              {selectedOrphans.sprints.size > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-semibold text-sm mb-2">Sprints ({selectedOrphans.sprints.size})</div>
                  <div className="space-y-1">
                    {Array.from(selectedOrphans.sprints).slice(0, 5).map(id => {
                      const sprint = sprints.find(s => s.id === id);
                      return sprint ? (
                        <div key={id} className="text-xs text-muted-foreground">• {sprint.name} ({sprint.quarter})</div>
                      ) : null;
                    })}
                    {selectedOrphans.sprints.size > 5 && (
                      <div className="text-xs text-muted-foreground">... and {selectedOrphans.sprints.size - 5} more</div>
                    )}
                  </div>
                </div>
              )}
              {selectedOrphans.allocations.size > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-semibold text-sm mb-2">Allocations ({selectedOrphans.allocations.size})</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedOrphans.allocations.size} allocation record{selectedOrphans.allocations.size !== 1 ? "s" : ""} will be deleted
                  </div>
                </div>
              )}
              {selectedOrphans.workAreas.size > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-semibold text-sm mb-2">Work Areas ({selectedOrphans.workAreas.size})</div>
                  <div className="space-y-1">
                    {Array.from(selectedOrphans.workAreas).slice(0, 5).map(id => {
                      const wa = workAreas.find(w => w.id === id);
                      return wa ? (
                        <div key={id} className="text-xs text-muted-foreground">• {wa.name}</div>
                      ) : null;
                    })}
                    {selectedOrphans.workAreas.size > 5 && (
                      <div className="text-xs text-muted-foreground">... and {selectedOrphans.workAreas.size - 5} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : `Delete ${totalSelected} Record${totalSelected !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}