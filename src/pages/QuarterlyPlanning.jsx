import React, { useRef, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { canManageAllocations, isTeamManager } from "@/lib/permissions";
import { CalendarRange, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useSelectedQuarter, useSelectedTeam } from "@/lib/useSelectedQuarter";
import { useQuarters } from "@/lib/useQuarters";
import { useBambooHrConfig } from "@/hooks/useBambooHr";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import FilterBar from "../components/shared/FilterBar";
import QuarterlyAllocationTable from "../components/sprint/QuarterlyAllocationTable";
import QuarterlyPlanHistoryPanel from "../components/sprint/QuarterlyPlanHistoryPanel";
import QuarterlyTopicBreakdown from "../components/dashboard/QuarterlyTopicBreakdown";

export default function QuarterlyPlanning() {
  const { user } = useAuth();
  const [selectedQuarter, setSelectedQuarter] = useSelectedQuarter();
  const defaultTeamId = isTeamManager(user) && user?.managed_team_ids?.length > 0
    ? user.managed_team_ids[0]
    : "all";
  const [selectedTeamId, setSelectedTeamId] = useSelectedTeam(defaultTeamId);
  const queryClient = useQueryClient();
  const { configured: bambooConfigured } = useBambooHrConfig();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => bragiQTC.entities.Team.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => bragiQTC.entities.TeamMember.list(),
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => bragiQTC.entities.WorkArea.list(),
  });

  const { data: quarterlyAllocations = [] } = useQuery({
    queryKey: ["quarterlyAllocations"],
    queryFn: () => bragiQTC.entities.QuarterlyAllocation.list(),
  });

  const { data: workAreaSelections = [] } = useQuery({
    queryKey: ["workAreaSelections"],
    queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list(),
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

  const isViewingAllTeams = !selectedTeamId || selectedTeamId === "all";
  const effectiveTeamId = selectedTeamId && selectedTeamId !== "all" ? selectedTeamId : "";

  const createQuarterlyAllocation = useMutation({
    mutationFn: (data) => bragiQTC.entities.QuarterlyAllocation.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const updateQuarterlyAllocation = useMutation({
    mutationFn: ({ id, data }) => bragiQTC.entities.QuarterlyAllocation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const deleteQuarterlyAllocation = useMutation({
    mutationFn: (id) => bragiQTC.entities.QuarterlyAllocation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] }),
  });

  const syncBambooAvailability = useMutation({
    mutationFn: (teamId) => bragiQTC.functions.invoke("syncBambooHrAvailability", { teamId, quarter: selectedQuarter }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["teamMemberCapacities"] });
      const d = res?.data || {};
      toast.success(`Availability synced from BambooHR — ${d.updated ?? 0} member${d.updated === 1 ? "" : "s"} updated${d.unmapped ? `, ${d.unmapped} unmapped` : ""} (${d.weekdays ?? 0} weekdays in quarter).`);
    },
    onError: (err) => toast.error(err.message || "BambooHR sync failed"),
  });

  const logQuarterlyHistory = (entry) => {
    try {
      bragiQTC.entities.QuarterlyPlanHistory?.create(entry)?.catch(() => {});
    } catch {}
  };

  const updateWorkAreaSelection = useMutation({
    mutationFn: async ({ teamId, quarter, workAreaIds }) => {
      const existing = workAreaSelections.find(s => s.team_id === teamId && s.quarter === quarter);
      const oldIds = new Set(existing?.work_area_ids || []);
      const newIds = new Set(workAreaIds);

      // Delete allocations for removed work items
      const removedIds = Array.from(oldIds).filter(id => !newIds.has(id));
      if (removedIds.length > 0) {
        const allocationsToDelete = quarterlyAllocations.filter(a =>
          a.quarter === quarter &&
          removedIds.includes(a.work_area_id) &&
          members.some(m => m.id === a.team_member_id && m.team_id === teamId)
        );
        const team = teams.find(t => t.id === teamId);
        for (const alloc of allocationsToDelete) {
          await bragiQTC.entities.QuarterlyAllocation.delete(alloc.id);
          const m  = members.find(x => x.id === alloc.team_member_id);
          const wa = workAreas.find(x => x.id === alloc.work_area_id);
          logQuarterlyHistory({
            quarter, team_id: teamId, team_name: team?.name,
            team_member_id: alloc.team_member_id, member_name: m?.name,
            member_discipline: m?.discipline, work_area_id: alloc.work_area_id,
            work_area_name: wa?.name, work_area_type: wa?.type,
            action: "removed", old_days: alloc.days, new_days: null,
            changed_at: new Date().toISOString(),
          });
        }
      }

      if (existing) {
        return bragiQTC.entities.QuarterlyWorkAreaSelection.update(existing.id, { work_area_ids: workAreaIds });
      } else {
        return bragiQTC.entities.QuarterlyWorkAreaSelection.create({ team_id: teamId, quarter, work_area_ids: workAreaIds });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
      queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] });
    },
  });

  const quarterlyAllocationTimeoutRef = useRef({});

  const handleQuarterlyAllocationChange = (data) => {
    const member = members.find(m => m.id === data.team_member_id);
    if (!member || !canManageAllocations(user, member.team_id)) return;

    const key = `${data.team_member_id}-${data.quarter}-${data.work_area_id}`;
    if (quarterlyAllocationTimeoutRef.current[key]) {
      clearTimeout(quarterlyAllocationTimeoutRef.current[key]);
    }

    quarterlyAllocationTimeoutRef.current[key] = setTimeout(() => {
      const existing = data.allocationId
        ? quarterlyAllocations.find(a => a.id === data.allocationId)
        : quarterlyAllocations.find(
            a => a.team_member_id === data.team_member_id && a.quarter === data.quarter && a.work_area_id === data.work_area_id
          );

      const histMember = members.find(m => m.id === data.team_member_id);
      const histWA     = workAreas.find(w => w.id === data.work_area_id);
      const histTeam   = teams.find(t => t.id === histMember?.team_id);
      const histBase   = {
        quarter: data.quarter, team_id: histMember?.team_id, team_name: histTeam?.name,
        team_member_id: data.team_member_id, member_name: histMember?.name,
        member_discipline: histMember?.discipline, work_area_id: data.work_area_id,
        work_area_name: histWA?.name, work_area_type: histWA?.type,
        changed_at: new Date().toISOString(),
      };

      if (existing) {
        if (data.days === 0) {
          deleteQuarterlyAllocation.mutate(existing.id);
          logQuarterlyHistory({ ...histBase, action: "removed", old_days: existing.days, new_days: null });
        } else if (existing.days !== data.days) {
          updateQuarterlyAllocation.mutate({ id: existing.id, data: { days: data.days } });
          logQuarterlyHistory({ ...histBase, action: "updated", old_days: existing.days, new_days: data.days });
        }
      } else if (data.days > 0) {
        createQuarterlyAllocation.mutate({
          team_member_id: data.team_member_id, quarter: data.quarter,
          work_area_id: data.work_area_id, days: data.days,
        });
        logQuarterlyHistory({ ...histBase, action: "set", old_days: null, new_days: data.days });
      }
      delete quarterlyAllocationTimeoutRef.current[key];
    }, 300);
  };

  const teamMembers = members.filter(m => m.team_id === effectiveTeamId);

  const teamMemberIds = useMemo(() => new Set(teamMembers.map(m => m.id)), [teamMembers]);
  const workAreasWithAllocations = useMemo(() => new Set(
    quarterlyAllocations
      .filter(a => teamMemberIds.has(a.team_member_id) && a.quarter === selectedQuarter)
      .map(a => a.work_area_id)
  ), [quarterlyAllocations, teamMemberIds, selectedQuarter]);

  const currentSelection = workAreaSelections.find(s => s.team_id === effectiveTeamId && s.quarter === selectedQuarter);
  const manuallySelectedIds = useMemo(() => new Set(currentSelection?.work_area_ids || []), [currentSelection]);

  const quarterlyWorkAreas = effectiveTeamId ? workAreas.filter(wa =>
    wa.leading_team_id === effectiveTeamId ||
    (wa.supporting_team_ids || []).includes(effectiveTeamId) ||
    workAreasWithAllocations.has(wa.id) ||
    manuallySelectedIds.has(wa.id)
  ) : [];

  // Derive extra quarters from existing allocations so past quarters are always selectable
  const extraQuarters = useMemo(
    () => [...new Set(quarterlyAllocations.map(a => a.quarter).filter(Boolean))],
    [quarterlyAllocations]
  );
  const quarters = useQuarters(extraQuarters);

  return (
    <div>
      <PageHeader title="Quarterly Planning" subtitle="Manage team capacity allocations per quarter" />

      <FilterBar
        quarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        team={selectedTeamId}
        onTeamChange={setSelectedTeamId}
        teams={teams}
        quarters={quarters}
        showTeamFilter={true}
      />

      <div className="mb-6">
        {teamsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : teams.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No teams yet" description="First create a team under 'Teams'." />
        ) : isViewingAllTeams ? (
          <div className="space-y-6">
            {teams.filter(t => t.is_active !== false).map(team => {
              const tMembers = members.filter(m => m.team_id === team.id);
              if (tMembers.length === 0) return null;
              const tMemberIds = new Set(tMembers.map(m => m.id));
              const tAllocatedWaIds = new Set(
                quarterlyAllocations
                  .filter(a => tMemberIds.has(a.team_member_id) && a.quarter === selectedQuarter)
                  .map(a => a.work_area_id)
              );
              const tSelection = workAreaSelections.find(s => s.team_id === team.id && s.quarter === selectedQuarter);
              const tManualIds = new Set(tSelection?.work_area_ids || []);
              const tWorkAreas = workAreas.filter(wa =>
                wa.leading_team_id === team.id ||
                (wa.supporting_team_ids || []).includes(team.id) ||
                tAllocatedWaIds.has(wa.id) ||
                tManualIds.has(wa.id)
              );
              return (
                <Card key={team.id} className="border-primary/20">
                  <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent pb-4">
                    <CardTitle className="text-base font-bold text-foreground">{team.name} — {selectedQuarter}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <QuarterlyAllocationTable
                      members={tMembers}
                      workAreas={tWorkAreas}
                      allocations={quarterlyAllocations}
                      quarter={selectedQuarter}
                      onAllocationChange={handleQuarterlyAllocationChange}
                      selectedTeamId={team.id}
                      onSelectionChange={(workAreaIds) => updateWorkAreaSelection.mutate({ teamId: team.id, quarter: selectedQuarter, workAreaIds })}
                      initialSelectedWorkAreaIds={tManualIds.size > 0 ? tManualIds : tAllocatedWaIds}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <>
            <Card className="border-primary/20">
              <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent pb-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold text-foreground">Quarterly Plan — {selectedQuarter}</CardTitle>
                  {bambooConfigured && canManageAllocations(user, effectiveTeamId) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => syncBambooAvailability.mutate(effectiveTeamId)}
                      disabled={syncBambooAvailability.isPending}
                      title="Set each mapped member's capacity for this quarter to working days minus approved BambooHR time off"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncBambooAvailability.isPending ? "animate-spin" : ""}`} />
                      {syncBambooAvailability.isPending ? "Syncing…" : "Sync availability from BambooHR"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <QuarterlyAllocationTable
                  members={teamMembers}
                  workAreas={quarterlyWorkAreas}
                  allocations={quarterlyAllocations}
                  quarter={selectedQuarter}
                  onAllocationChange={handleQuarterlyAllocationChange}
                  selectedTeamId={effectiveTeamId}
                  onSelectionChange={(workAreaIds) => updateWorkAreaSelection.mutate({ teamId: effectiveTeamId, quarter: selectedQuarter, workAreaIds })}
                  initialSelectedWorkAreaIds={manuallySelectedIds.size > 0 ? manuallySelectedIds : workAreasWithAllocations}
                />
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold text-foreground">Capacity by Topic — {selectedQuarter}</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <QuarterlyTopicBreakdown
                  members={teamMembers}
                  quarterlyAllocations={quarterlyAllocations}
                  workAreas={workAreas}
                  quarter={selectedQuarter}
                  capacityMap={capacityMap}
                />
              </CardContent>
            </Card>
            <QuarterlyPlanHistoryPanel
              quarter={selectedQuarter}
              teamId={effectiveTeamId}
              teamName={teams.find(t => t.id === effectiveTeamId)?.name ?? ""}
              jiraProjectKey={teams.find(t => t.id === effectiveTeamId)?.jira_project_key ?? null}
              daysPerSp={teams.find(t => t.id === effectiveTeamId)?.days_per_sp ?? 1}
              user={user}
              members={teamMembers}
              workAreas={quarterlyWorkAreas}
              quarterlyAllocations={quarterlyAllocations}
              workAreaSelections={workAreaSelections}
            />
          </>
        )}
      </div>
    </div>
  );
}
