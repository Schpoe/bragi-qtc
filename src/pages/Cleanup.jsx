import React, { useState, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert, Wrench, Download, Upload, DatabaseBackup } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ReasonTag({ children, danger }) {
  return (
    <span className={cn(
      "inline-flex items-center text-xs rounded px-1.5 py-0.5 font-medium",
      danger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
    )}>
      {children}
    </span>
  );
}

function OrphanItem({ checked, onToggle, title, subtitle, reasons }) {
  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        {reasons && reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {reasons.map((r, i) => (
              <ReasonTag key={i} danger={r.danger}>{r.label}</ReasonTag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({ title, description, items, selectedIds, onSelectAll, onDeselectAll, renderItem, defaultOpen = true, actionSlot }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = items.length;
  const selectedCount = selectedIds ? selectedIds.size : 0;
  const isClean = count === 0;

  return (
    <Card className={cn(isClean ? "border-border" : "border-amber-300/60")}>
      <CardHeader className="py-3 px-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isClean
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant={isClean ? "outline" : "secondary"} className="text-xs shrink-0">{count}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {!isClean && selectedCount > 0 && (
              <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/30">{selectedCount} selected</Badge>
            )}
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{description}</p>}
      </CardHeader>

      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          {isClean ? (
            <div className="flex items-center gap-2 py-3 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" /> All records in this category are healthy.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-muted-foreground">{count} record{count !== 1 ? "s" : ""}</span>
                <div className="flex gap-2">
                  {actionSlot}
                  {selectedIds && (
                    <>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSelectAll}>Select all</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDeselectAll} disabled={selectedCount === 0}>Deselect all</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.map(item => renderItem(item))}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_SELECTION = {
  emptyTeams: new Set(),
  sprintsForMemberlessTeams: new Set(),
  members: new Set(),
  sprints: new Set(),
  allocations: new Set(),
  templateAllocations: new Set(),
  quarterlyAllocations: new Set(),
  zeroAllocations: new Set(),
  zeroQA: new Set(),
  workAreaSelections: new Set(),
  unassignedWorkAreas: new Set(),
  workAreas: new Set(),
  unassignedAllocations: new Set(),
  detachedAllocations: new Set(),
};

export default function CleanupPage() {
  const [selected, setSelected] = useState(EMPTY_SELECTION);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteProgress, setDeleteProgress] = useState(null);
  const [repairing, setRepairing] = useState(false);
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: teamsLoading, isFetching: teamsFetching } = useQuery({ queryKey: ["teams"], queryFn: () => bragiQTC.entities.Team.list() });
  const { data: members = [], isLoading: membersLoading, isFetching: membersFetching } = useQuery({ queryKey: ["teamMembers"], queryFn: () => bragiQTC.entities.TeamMember.list() });
  const { data: sprints = [], isLoading: sprintsLoading, isFetching: sprintsFetching } = useQuery({ queryKey: ["sprints"], queryFn: () => bragiQTC.entities.Sprint.list() });
  const { data: allocations = [], isLoading: allocationsLoading, isFetching: allocationsFetching } = useQuery({ queryKey: ["allocations"], queryFn: () => bragiQTC.entities.Allocation.list() });
  const { data: workAreas = [], isLoading: workAreasLoading, isFetching: workAreasFetching } = useQuery({ queryKey: ["workAreas"], queryFn: () => bragiQTC.entities.WorkArea.list() });
  const { data: quarterlyAllocations = [], isLoading: qaLoading, isFetching: qaFetching } = useQuery({ queryKey: ["quarterlyAllocations"], queryFn: () => bragiQTC.entities.QuarterlyAllocation.list() });
  const { data: workAreaSelections = [], isLoading: wasLoading, isFetching: wasFetching } = useQuery({ queryKey: ["workAreaSelections"], queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list() });

  const isLoading = teamsLoading || membersLoading || sprintsLoading || allocationsLoading || workAreasLoading || qaLoading || wasLoading;
  const isScanning = teamsFetching || membersFetching || sprintsFetching || allocationsFetching || workAreasFetching || qaFetching || wasFetching;

  const SCAN_KEYS = ["teams", "teamMembers", "sprints", "allocations", "workAreas", "quarterlyAllocations", "workAreaSelections"];

  const rescan = () => {
    setSelected(EMPTY_SELECTION);
    SCAN_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  // ── Orphan detection ───────────────────────────────────────────────────────

  const orphans = useMemo(() => {
    const teamIds     = new Set(teams.map(t => t.id));
    const memberIds   = new Set(members.map(m => m.id));
    const sprintIds   = new Set(sprints.map(s => s.id));
    const workAreaIds = new Set(workAreas.map(wa => wa.id));
    const templateSprintIds = new Set(sprints.filter(s => s.is_cross_team).map(s => s.id));

    // 1. Team members referencing a deleted team
    const orphanMembers = members.filter(m => m.team_id && !teamIds.has(m.team_id));

    // 2. Sprints referencing a deleted team (non-template)
    const orphanSprints = sprints.filter(s => !s.is_cross_team && s.team_id && !teamIds.has(s.team_id));

    // 3. Sprint allocations: missing member, sprint, or work area
    const orphanAllocations = allocations.filter(a =>
      !memberIds.has(a.team_member_id) ||
      !sprintIds.has(a.sprint_id) ||
      (a.work_area_id && !workAreaIds.has(a.work_area_id))
    );
    const orphanAllocationIds = new Set(orphanAllocations.map(a => a.id));

    // 4. Allocations on template/cross-team sprints
    const orphanTemplateAllocations = allocations.filter(a =>
      templateSprintIds.has(a.sprint_id) && !orphanAllocationIds.has(a.id)
    );

    // 5. Zero-day sprint allocations (useless records)
    const zeroAllocations = allocations.filter(a =>
      a.days === 0 && !orphanAllocationIds.has(a.id) && !templateSprintIds.has(a.sprint_id)
    );

    // 6. Quarterly allocations: missing member or work area
    const orphanQA = quarterlyAllocations.filter(a =>
      !memberIds.has(a.team_member_id) ||
      (a.work_area_id && !workAreaIds.has(a.work_area_id))
    );
    const orphanQAIds = new Set(orphanQA.map(a => a.id));

    // 7. Zero-day quarterly allocations
    const zeroQA = quarterlyAllocations.filter(a =>
      a.days === 0 && !orphanQAIds.has(a.id)
    );

    // 8. Work area selections: missing team (delete-worthy)
    const orphanWAS = workAreaSelections.filter(s => !teamIds.has(s.team_id));

    // 9. Work area selections with stale work area IDs (repair-worthy — team still valid)
    const staleWAS = workAreaSelections.filter(s =>
      teamIds.has(s.team_id) &&
      (s.work_area_ids || []).some(waId => !workAreaIds.has(waId))
    );

    // 10. Work areas with deleted leading team
    const orphanWorkAreas = workAreas.filter(wa => wa.leading_team_id && !teamIds.has(wa.leading_team_id));
    const orphanWorkAreaIds = new Set(orphanWorkAreas.map(w => w.id));

    // 11. Work areas with no leading team at all (unassigned)
    const unassignedWorkAreas = workAreas.filter(wa => !wa.leading_team_id && !orphanWorkAreaIds.has(wa.id));

    // 12. Work areas with stale supporting team refs (repair-worthy)
    const staleWorkAreas = workAreas.filter(wa =>
      !orphanWorkAreaIds.has(wa.id) &&
      (wa.supporting_team_ids || []).some(tid => !teamIds.has(tid))
    );

    // 13. Sprint allocations with no work_area_id (unassigned) — member and sprint
    //     exist but no work item is referenced; invisible in Sprint Plan UI
    const unassignedAllocations = allocations.filter(a =>
      !orphanAllocationIds.has(a.id) &&
      !a.work_area_id &&
      !templateSprintIds.has(a.sprint_id)
    );

    // 14. Detached sprint allocations — sprint + member + work area all exist,
    //     but the work area is not in the sprint's relevant_work_area_ids list.
    //     These are invisible in Sprint Plan UI but still show up in the Overview.
    const sprintMap = Object.fromEntries(sprints.map(s => [s.id, s]));
    const detachedAllocations = allocations.filter(a => {
      if (orphanAllocationIds.has(a.id)) return false;
      if (!a.work_area_id) return false;
      const sprint = sprintMap[a.sprint_id];
      if (!sprint || sprint.is_cross_team) return false;
      // If sprint has no work items assigned, ALL its allocations are detached.
      // If it has work items, only those not in the list are detached.
      const relevantIds = sprint.relevant_work_area_ids || [];
      return !relevantIds.includes(a.work_area_id);
    });

    // 14. Sprints with stale relevant_work_area_ids (repair-worthy — remove deleted IDs)
    const staleSprints = sprints.filter(s =>
      !s.is_cross_team &&
      (s.relevant_work_area_ids || []).some(waId => !workAreaIds.has(waId))
    );

    // 15. Teams with no members — appear in Team Overview but have no capacity
    const memberTeamIds = new Set(members.map(m => m.team_id));
    const emptyTeams = teams.filter(t => !memberTeamIds.has(t.id));
    const emptyTeamIds = new Set(emptyTeams.map(t => t.id));

    // 16. Sprints belonging to memberless teams — directly deletable so the user
    //     doesn't need to delete the team first (which would leave sprint orphans anyway)
    const sprintsForMemberlessTeams = sprints.filter(s =>
      !s.is_cross_team && emptyTeamIds.has(s.team_id)
    );

    return {
      emptyTeams,
      sprintsForMemberlessTeams,
      members: orphanMembers,
      sprints: orphanSprints,
      allocations: orphanAllocations,
      templateAllocations: orphanTemplateAllocations,
      zeroAllocations,
      quarterlyAllocations: orphanQA,
      zeroQA,
      workAreaSelections: orphanWAS,
      staleWAS,           // repair only
      workAreas: orphanWorkAreas,
      unassignedWorkAreas,
      staleWorkAreas,     // repair only
      unassignedAllocations,
      detachedAllocations,
      staleSprints,       // repair only
    };
  }, [teams, members, sprints, allocations, quarterlyAllocations, workAreaSelections, workAreas]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggle = (category, id) => setSelected(prev => {
    const s = new Set(prev[category]);
    s.has(id) ? s.delete(id) : s.add(id);
    return { ...prev, [category]: s };
  });

  const selectAll   = (category) => setSelected(prev => ({ ...prev, [category]: new Set(orphans[category].map(i => i.id)) }));
  const deselectAll = (category) => setSelected(prev => ({ ...prev, [category]: new Set() }));

  const selectAllOrphans = () => setSelected({
    emptyTeams:                   new Set(orphans.emptyTeams.map(i => i.id)),
    sprintsForMemberlessTeams:    new Set(orphans.sprintsForMemberlessTeams.map(i => i.id)),
    members:                      new Set(orphans.members.map(i => i.id)),
    sprints:              new Set(orphans.sprints.map(i => i.id)),
    allocations:          new Set(orphans.allocations.map(i => i.id)),
    templateAllocations:  new Set(orphans.templateAllocations.map(i => i.id)),
    zeroAllocations:      new Set(orphans.zeroAllocations.map(i => i.id)),
    quarterlyAllocations: new Set(orphans.quarterlyAllocations.map(i => i.id)),
    zeroQA:               new Set(orphans.zeroQA.map(i => i.id)),
    workAreaSelections:   new Set(orphans.workAreaSelections.map(i => i.id)),
    unassignedWorkAreas:    new Set(orphans.unassignedWorkAreas.map(i => i.id)),
    workAreas:              new Set(orphans.workAreas.map(i => i.id)),
    unassignedAllocations:  new Set(orphans.unassignedAllocations.map(i => i.id)),
    detachedAllocations:    new Set(orphans.detachedAllocations.map(i => i.id)),
  });

  const totalSelected =
    selected.emptyTeams.size + selected.sprintsForMemberlessTeams.size +
    selected.members.size + selected.sprints.size + selected.allocations.size +
    selected.templateAllocations.size + selected.zeroAllocations.size +
    selected.quarterlyAllocations.size + selected.zeroQA.size +
    selected.workAreaSelections.size + selected.unassignedWorkAreas.size +
    selected.workAreas.size + selected.unassignedAllocations.size + selected.detachedAllocations.size;

  const totalOrphans =
    orphans.emptyTeams.length + orphans.sprintsForMemberlessTeams.length +
    orphans.members.length + orphans.sprints.length + orphans.allocations.length +
    orphans.templateAllocations.length + orphans.zeroAllocations.length +
    orphans.quarterlyAllocations.length + orphans.zeroQA.length +
    orphans.workAreaSelections.length + orphans.unassignedWorkAreas.length +
    orphans.workAreas.length + orphans.unassignedAllocations.length + orphans.detachedAllocations.length;

  const totalRepairable = orphans.staleWAS.length + orphans.staleWorkAreas.length + orphans.staleSprints.length;

  // ── Repair operations ──────────────────────────────────────────────────────

  const repairAll = async () => {
    setRepairing(true);
    const teamIds = new Set(teams.map(t => t.id));
    const workAreaIds = new Set(workAreas.map(w => w.id));
    let repaired = 0;
    const errors = [];

    for (const s of orphans.staleWAS) {
      try {
        const cleanIds = (s.work_area_ids || []).filter(id => workAreaIds.has(id));
        await bragiQTC.entities.QuarterlyWorkAreaSelection.update(s.id, { work_area_ids: cleanIds });
        repaired++;
      } catch (e) { errors.push(e.message); }
    }

    for (const wa of orphans.staleWorkAreas) {
      try {
        const cleanIds = (wa.supporting_team_ids || []).filter(id => teamIds.has(id));
        await bragiQTC.entities.WorkArea.update(wa.id, { supporting_team_ids: cleanIds });
        repaired++;
      } catch (e) { errors.push(e.message); }
    }

    for (const s of orphans.staleSprints) {
      try {
        const cleanIds = (s.relevant_work_area_ids || []).filter(id => workAreaIds.has(id));
        await bragiQTC.entities.Sprint.update(s.id, { relevant_work_area_ids: cleanIds });
        repaired++;
      } catch (e) { errors.push(e.message); }
    }

    queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
    queryClient.invalidateQueries({ queryKey: ["workAreas"] });
    queryClient.invalidateQueries({ queryKey: ["sprints"] });
    setRepairing(false);

    if (errors.length > 0) {
      toast.error(`Repaired ${repaired} with ${errors.length} error(s)`);
    } else {
      toast.success(`Repaired ${repaired} record${repaired !== 1 ? "s" : ""} — stale references removed`);
    }
  };

  // ── Deletion ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const ops = [
      ...[...selected.emptyTeams].map(id                    => () => bragiQTC.entities.Team.delete(id)),
      ...[...selected.sprintsForMemberlessTeams].map(id     => () => bragiQTC.entities.Sprint.delete(id)),
      ...[...selected.members].map(id                       => () => bragiQTC.entities.TeamMember.delete(id)),
      ...[...selected.sprints].map(id              => () => bragiQTC.entities.Sprint.delete(id)),
      ...[...selected.allocations].map(id          => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.templateAllocations].map(id  => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.zeroAllocations].map(id      => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.quarterlyAllocations].map(id => () => bragiQTC.entities.QuarterlyAllocation.delete(id)),
      ...[...selected.zeroQA].map(id               => () => bragiQTC.entities.QuarterlyAllocation.delete(id)),
      ...[...selected.workAreaSelections].map(id   => () => bragiQTC.entities.QuarterlyWorkAreaSelection.delete(id)),
      ...[...selected.unassignedWorkAreas].map(id  => () => bragiQTC.entities.WorkArea.delete(id)),
      ...[...selected.workAreas].map(id               => () => bragiQTC.entities.WorkArea.delete(id)),
      ...[...selected.unassignedAllocations].map(id   => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.detachedAllocations].map(id     => () => bragiQTC.entities.Allocation.delete(id)),
    ];

    setDeleteProgress({ done: 0, total: ops.length });
    let done = 0;
    const errors = [];

    for (const op of ops) {
      try { await op(); } catch (e) { errors.push(e.message); }
      done++;
      setDeleteProgress({ done, total: ops.length });
    }

    ["teams", "teamMembers", "sprints", "allocations", "quarterlyAllocations", "workAreaSelections", "workAreas"]
      .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

    setSelected(EMPTY_SELECTION);
    setConfirmInput("");
    setDeleteProgress(null);
    setConfirmOpen(false);

    if (errors.length > 0) {
      toast.error(`Completed with ${errors.length} error${errors.length !== 1 ? "s" : ""}. ${ops.length - errors.length} records deleted.`);
    } else {
      toast.success(`${ops.length} record${ops.length !== 1 ? "s" : ""} deleted.`);
    }
  };

  // ── Lookup helpers ─────────────────────────────────────────────────────────

  const teamName   = id => teams.find(t => t.id === id)?.name    ?? `[deleted ${id?.slice(0, 6)}…]`;
  const memberName = id => members.find(m => m.id === id)?.name  ?? `[deleted ${id?.slice(0, 6)}…]`;
  const sprintName = id => sprints.find(s => s.id === id)?.name  ?? `[deleted ${id?.slice(0, 6)}…]`;
  const waName     = id => workAreas.find(w => w.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const emptyTeamItem = (t) => {
    const sprintCount = sprints.filter(s => !s.is_cross_team && s.team_id === t.id).length;
    return (
      <OrphanItem key={t.id} checked={selected.emptyTeams.has(t.id)} onToggle={() => toggle("emptyTeams", t.id)}
        title={t.name}
        reasons={[
          { label: "No members", danger: true },
          sprintCount > 0 && { label: `${sprintCount} sprint${sprintCount !== 1 ? "s" : ""} will become orphaned on next scan`, danger: false },
        ].filter(Boolean)} />
    );
  };

  const sprintForMemberlessTeamItem = (s) => (
    <OrphanItem key={s.id} checked={selected.sprintsForMemberlessTeams.has(s.id)} onToggle={() => toggle("sprintsForMemberlessTeams", s.id)}
      title={s.name} subtitle={s.quarter}
      reasons={[
        { label: `Team: ${teamName(s.team_id)}`, danger: false },
        { label: "Team has no members", danger: true },
      ]} />
  );

  const memberItem = (m) => (
    <OrphanItem key={m.id} checked={selected.members.has(m.id)} onToggle={() => toggle("members", m.id)}
      title={m.name} subtitle={m.discipline}
      reasons={[{ label: `Team deleted: ${m.team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const sprintItem = (s) => (
    <OrphanItem key={s.id} checked={selected.sprints.has(s.id)} onToggle={() => toggle("sprints", s.id)}
      title={s.name} subtitle={s.quarter}
      reasons={[{ label: `Team deleted: ${s.team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const allocationItem = (a) => {
    const missingMember = !members.some(m => m.id === a.team_member_id);
    const missingSprint = !sprints.some(s => s.id === a.sprint_id);
    const missingWA     = a.work_area_id && !workAreas.some(w => w.id === a.work_area_id);
    return (
      <OrphanItem key={a.id} checked={selected.allocations.has(a.id)} onToggle={() => toggle("allocations", a.id)}
        title={`${a.days}d allocation`}
        reasons={[
          missingMember && { label: `Member deleted: ${a.team_member_id?.slice(0, 8)}…`, danger: true },
          !missingMember && { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
          missingSprint && { label: `Sprint deleted: ${a.sprint_id?.slice(0, 8)}…`, danger: true },
          !missingSprint && { label: `Sprint: ${sprintName(a.sprint_id)}`, danger: false },
          missingWA && { label: `Work item deleted: ${a.work_area_id?.slice(0, 8)}…`, danger: true },
          !missingWA && a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)} />
    );
  };

  const templateAllocItem = (a) => {
    const sprint = sprints.find(s => s.id === a.sprint_id);
    return (
      <OrphanItem key={a.id} checked={selected.templateAllocations.has(a.id)} onToggle={() => toggle("templateAllocations", a.id)}
        title={`${a.days}d allocation`} subtitle={`Member: ${memberName(a.team_member_id)}`}
        reasons={[
          { label: `On template sprint: ${sprint?.name ?? a.sprint_id?.slice(0, 8)}`, danger: true },
          a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)} />
    );
  };

  const zeroAllocItem = (a) => (
    <OrphanItem key={a.id} checked={selected.zeroAllocations.has(a.id)} onToggle={() => toggle("zeroAllocations", a.id)}
      title="0d sprint allocation"
      reasons={[
        { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
        { label: `Sprint: ${sprintName(a.sprint_id)}`, danger: false },
        a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
      ].filter(Boolean)} />
  );

  const qaItem = (a) => {
    const missingMember = !members.some(m => m.id === a.team_member_id);
    const missingWA     = a.work_area_id && !workAreas.some(w => w.id === a.work_area_id);
    return (
      <OrphanItem key={a.id} checked={selected.quarterlyAllocations.has(a.id)} onToggle={() => toggle("quarterlyAllocations", a.id)}
        title={`${a.days}d — ${a.quarter}`}
        reasons={[
          missingMember && { label: `Member deleted: ${a.team_member_id?.slice(0, 8)}…`, danger: true },
          !missingMember && { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
          missingWA && { label: `Work item deleted: ${a.work_area_id?.slice(0, 8)}…`, danger: true },
          !missingWA && a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)} />
    );
  };

  const zeroQAItem = (a) => (
    <OrphanItem key={a.id} checked={selected.zeroQA.has(a.id)} onToggle={() => toggle("zeroQA", a.id)}
      title={`0d quarterly — ${a.quarter}`}
      reasons={[
        { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
        a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
      ].filter(Boolean)} />
  );

  const wasItem = (s) => (
    <OrphanItem key={s.id} checked={selected.workAreaSelections.has(s.id)} onToggle={() => toggle("workAreaSelections", s.id)}
      title={`${s.quarter} selection`}
      reasons={[{ label: `Team deleted: ${s.team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const staleWASItem = (s) => {
    const staleIds = (s.work_area_ids || []).filter(id => !workAreas.some(w => w.id === id));
    return (
      <div key={s.id} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{s.quarter} — {teamName(s.team_id)}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <ReasonTag danger>{staleIds.length} deleted work item ref{staleIds.length !== 1 ? "s" : ""}</ReasonTag>
            <ReasonTag>{(s.work_area_ids || []).length - staleIds.length} valid refs kept</ReasonTag>
          </div>
        </div>
      </div>
    );
  };

  const unassignedWAItem = (wa) => (
    <OrphanItem key={wa.id} checked={selected.unassignedWorkAreas.has(wa.id)} onToggle={() => toggle("unassignedWorkAreas", wa.id)}
      title={wa.name} subtitle={wa.type || '—'}
      reasons={[{ label: "No leading team assigned", danger: true }]} />
  );

  const waItem = (wa) => (
    <OrphanItem key={wa.id} checked={selected.workAreas.has(wa.id)} onToggle={() => toggle("workAreas", wa.id)}
      title={wa.name} subtitle={`Type: ${wa.type}`}
      reasons={[{ label: `Leading team deleted: ${wa.leading_team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const staleWAItem = (wa) => {
    const staleIds = (wa.supporting_team_ids || []).filter(tid => !teams.some(t => t.id === tid));
    return (
      <div key={wa.id} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{wa.name}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <ReasonTag danger>{staleIds.length} deleted supporting team ref{staleIds.length !== 1 ? "s" : ""}</ReasonTag>
          </div>
        </div>
      </div>
    );
  };

  const unassignedAllocItem = (a) => {
    const sprint = sprints.find(s => s.id === a.sprint_id);
    return (
      <OrphanItem key={a.id} checked={selected.unassignedAllocations.has(a.id)} onToggle={() => toggle("unassignedAllocations", a.id)}
        title={`${a.days}d allocation`}
        subtitle={`Member: ${memberName(a.team_member_id)}`}
        reasons={[
          { label: `Sprint: ${sprint?.name ?? sprintName(a.sprint_id)}`, danger: false },
          { label: "No work item assigned", danger: true },
        ]} />
    );
  };

  const detachedAllocItem = (a) => {
    const sprint = sprints.find(s => s.id === a.sprint_id);
    return (
      <OrphanItem key={a.id} checked={selected.detachedAllocations.has(a.id)} onToggle={() => toggle("detachedAllocations", a.id)}
        title={`${a.days}d allocation`}
        subtitle={`Member: ${memberName(a.team_member_id)}`}
        reasons={[
          { label: `Sprint: ${sprint?.name ?? sprintName(a.sprint_id)}`, danger: false },
          { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
          { label: "Not in sprint's work items", danger: true },
        ]} />
    );
  };

  const staleSprintItem = (s) => {
    const staleIds = (s.relevant_work_area_ids || []).filter(id => !workAreas.some(w => w.id === id));
    return (
      <div key={s.id} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{s.name} — {s.quarter}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <ReasonTag danger>{staleIds.length} deleted work item ref{staleIds.length !== 1 ? "s" : ""} in sprint list</ReasonTag>
            <ReasonTag>{(s.relevant_work_area_ids || []).length - staleIds.length} valid refs kept</ReasonTag>
          </div>
        </div>
      </div>
    );
  };

  // ── Backup / Restore ──────────────────────────────────────────────────────

  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState(null);
  const fileInputRef = React.useRef(null);

  const handleBackup = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bragi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error('Backup failed: ' + err.message);
    }
  };

  const handleRestoreFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.version || !parsed.data) throw new Error('Invalid backup file');
        setPendingRestoreData(parsed);
        setRestoreConfirmOpen(true);
      } catch (err) {
        toast.error('Invalid backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestoreData) return;
    setRestoring(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pendingRestoreData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success('Restore complete — all data replaced');
      ["teams", "teamMembers", "sprints", "allocations", "quarterlyAllocations", "workAreaSelections", "workAreas", "users"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
    } catch (err) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setRestoring(false);
      setRestoreConfirmOpen(false);
      setPendingRestoreData(null);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Data Cleanup" subtitle="Identify and remove orphaned data" />
        <div className="space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  const isDeletable  = totalSelected > 0;
  const confirmReady = confirmInput.trim().toUpperCase() === "DELETE";

  return (
    <div>
      <PageHeader title="Data Cleanup" subtitle="Scan for orphaned records across all datasets">
        <div className="flex items-center gap-2">
          {totalRepairable > 0 && (
            <Button variant="outline" onClick={repairAll} disabled={repairing}>
              <Wrench className="w-4 h-4 mr-2" />
              {repairing ? "Repairing…" : `Repair Stale Refs (${totalRepairable})`}
            </Button>
          )}
          <Button variant="outline" onClick={rescan} disabled={isScanning}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isScanning && "animate-spin")} /> {isScanning ? "Scanning…" : "Re-scan"}
          </Button>
          {isDeletable && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({totalSelected})
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ── Health summary ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Records scanned", value: teams.length + members.length + sprints.length + allocations.length + quarterlyAllocations.length + workAreaSelections.length + workAreas.length },
          { label: "Orphaned / useless", value: totalOrphans, danger: totalOrphans > 0 },
          { label: "Stale references", value: totalRepairable, warn: totalRepairable > 0 },
          { label: "Selected for deletion", value: totalSelected, danger: totalSelected > 0 },
        ].map(({ label, value, danger, warn }) => (
          <Card key={label} className={cn(danger && value > 0 ? "border-destructive/40 bg-destructive/5" : warn && value > 0 ? "border-amber-300/60 bg-amber-50/40" : "")}>
            <CardContent className="pt-4 pb-3">
              <div className={cn("text-2xl font-bold tabular-nums", danger && value > 0 ? "text-destructive" : warn && value > 0 ? "text-amber-600" : "text-foreground")}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalOrphans === 0 && totalRepairable === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">Database is Clean</h3>
              <p className="text-sm text-muted-foreground">No orphaned or stale data found.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {totalOrphans > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                {totalOrphans} record{totalOrphans !== 1 ? "s" : ""} to clean up
              </div>
              <Button variant="outline" size="sm" onClick={selectAllOrphans}>Select all</Button>
            </div>
          )}

          {/* ── Deletable categories ──────────────────────────────────────── */}
          <CategorySection title="Teams Without Members"
            description="Teams with no members — shown in Team Overview but have no capacity; their sprints will surface as orphans after deletion"
            items={orphans.emptyTeams} selectedIds={selected.emptyTeams}
            onSelectAll={() => selectAll("emptyTeams")} onDeselectAll={() => deselectAll("emptyTeams")}
            renderItem={emptyTeamItem} defaultOpen={orphans.emptyTeams.length > 0} />

          <CategorySection title="Sprints for Memberless Teams"
            description="Sprints whose team has no members — invisible in Team Overview after this fix, safe to delete"
            items={orphans.sprintsForMemberlessTeams} selectedIds={selected.sprintsForMemberlessTeams}
            onSelectAll={() => selectAll("sprintsForMemberlessTeams")} onDeselectAll={() => deselectAll("sprintsForMemberlessTeams")}
            renderItem={sprintForMemberlessTeamItem} defaultOpen={orphans.sprintsForMemberlessTeams.length > 0} />

          <CategorySection title="Team Members" description="Members whose team has been deleted"
            items={orphans.members} selectedIds={selected.members}
            onSelectAll={() => selectAll("members")} onDeselectAll={() => deselectAll("members")}
            renderItem={memberItem} defaultOpen={orphans.members.length > 0} />

          <CategorySection title="Sprints" description="Sprints whose team has been deleted"
            items={orphans.sprints} selectedIds={selected.sprints}
            onSelectAll={() => selectAll("sprints")} onDeselectAll={() => deselectAll("sprints")}
            renderItem={sprintItem} defaultOpen={orphans.sprints.length > 0} />

          <CategorySection title="Sprint Allocations" description="Allocations referencing a deleted member, sprint, or work item"
            items={orphans.allocations} selectedIds={selected.allocations}
            onSelectAll={() => selectAll("allocations")} onDeselectAll={() => deselectAll("allocations")}
            renderItem={allocationItem} defaultOpen={orphans.allocations.length > 0} />

          <CategorySection title="Template Sprint Allocations" description="Allocations attached to cross-team template sprints — should not exist"
            items={orphans.templateAllocations} selectedIds={selected.templateAllocations}
            onSelectAll={() => selectAll("templateAllocations")} onDeselectAll={() => deselectAll("templateAllocations")}
            renderItem={templateAllocItem} defaultOpen={orphans.templateAllocations.length > 0} />

          <CategorySection title="Zero-Percent Sprint Allocations" description="Sprint allocations with 0% — no capacity contribution, safe to remove"
            items={orphans.zeroAllocations} selectedIds={selected.zeroAllocations}
            onSelectAll={() => selectAll("zeroAllocations")} onDeselectAll={() => deselectAll("zeroAllocations")}
            renderItem={zeroAllocItem} defaultOpen={orphans.zeroAllocations.length > 0} />

          <CategorySection title="Quarterly Allocations" description="Quarterly allocations referencing a deleted member or work item"
            items={orphans.quarterlyAllocations} selectedIds={selected.quarterlyAllocations}
            onSelectAll={() => selectAll("quarterlyAllocations")} onDeselectAll={() => deselectAll("quarterlyAllocations")}
            renderItem={qaItem} defaultOpen={orphans.quarterlyAllocations.length > 0} />

          <CategorySection title="Zero-Percent Quarterly Allocations" description="Quarterly allocations with 0% — no effect on planning, safe to remove"
            items={orphans.zeroQA} selectedIds={selected.zeroQA}
            onSelectAll={() => selectAll("zeroQA")} onDeselectAll={() => deselectAll("zeroQA")}
            renderItem={zeroQAItem} defaultOpen={orphans.zeroQA.length > 0} />

          <CategorySection title="Work Item Selections (deleted team)" description="Quarterly selections whose team has been deleted — safe to delete"
            items={orphans.workAreaSelections} selectedIds={selected.workAreaSelections}
            onSelectAll={() => selectAll("workAreaSelections")} onDeselectAll={() => deselectAll("workAreaSelections")}
            renderItem={wasItem} defaultOpen={orphans.workAreaSelections.length > 0} />

          <CategorySection title="Unassigned Work Items" description="Work items with no leading team — incomplete records"
            items={orphans.unassignedWorkAreas} selectedIds={selected.unassignedWorkAreas}
            onSelectAll={() => selectAll("unassignedWorkAreas")} onDeselectAll={() => deselectAll("unassignedWorkAreas")}
            renderItem={unassignedWAItem} defaultOpen={orphans.unassignedWorkAreas.length > 0} />

          <CategorySection title="Work Items (deleted leading team)" description="Work items whose leading team has been deleted"
            items={orphans.workAreas} selectedIds={selected.workAreas}
            onSelectAll={() => selectAll("workAreas")} onDeselectAll={() => deselectAll("workAreas")}
            renderItem={waItem} defaultOpen={orphans.workAreas.length > 0} />

          <CategorySection title="Sprint Allocations Without Work Item"
            description="Allocations with no work item assigned — invisible in the Sprint Plan table and excluded from utilization totals"
            items={orphans.unassignedAllocations} selectedIds={selected.unassignedAllocations}
            onSelectAll={() => selectAll("unassignedAllocations")} onDeselectAll={() => deselectAll("unassignedAllocations")}
            renderItem={unassignedAllocItem} defaultOpen={orphans.unassignedAllocations.length > 0} />

          <CategorySection title="Detached Sprint Allocations"
            description="Allocations whose work item is no longer in the sprint's work item list — invisible in Sprint Plan UI but counted in the Overview"
            items={orphans.detachedAllocations} selectedIds={selected.detachedAllocations}
            onSelectAll={() => selectAll("detachedAllocations")} onDeselectAll={() => deselectAll("detachedAllocations")}
            renderItem={detachedAllocItem} defaultOpen={orphans.detachedAllocations.length > 0} />

          {/* ── Repair-only categories ────────────────────────────────────── */}
          <CategorySection
            title="Sprints — Stale Work Item References"
            description="Sprints whose relevant work item list contains deleted work item IDs. 'Repair All' removes only the stale IDs."
            items={orphans.staleSprints}
            selectedIds={null}
            renderItem={staleSprintItem}
            defaultOpen={orphans.staleSprints.length > 0}
            actionSlot={orphans.staleSprints.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={repairAll} disabled={repairing}>
                <Wrench className="w-3 h-3" /> Repair All
              </Button>
            )}
          />

          <CategorySection
            title="Work Item Selections — Stale References"
            description="Team is still valid, but some selected work items were deleted. 'Repair All' removes only the stale IDs."
            items={orphans.staleWAS}
            selectedIds={null}
            renderItem={staleWASItem}
            defaultOpen={orphans.staleWAS.length > 0}
            actionSlot={orphans.staleWAS.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={repairAll} disabled={repairing}>
                <Wrench className="w-3 h-3" /> Repair All
              </Button>
            )}
          />

          <CategorySection
            title="Work Items — Stale Supporting Teams"
            description="Work items with deleted teams in their supporting list. 'Repair All' removes only the stale IDs."
            items={orphans.staleWorkAreas}
            selectedIds={null}
            renderItem={staleWAItem}
            defaultOpen={orphans.staleWorkAreas.length > 0}
            actionSlot={orphans.staleWorkAreas.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={repairAll} disabled={repairing}>
                <Wrench className="w-3 h-3" /> Repair All
              </Button>
            )}
          />
        </div>
      )}

      {/* ── Backup / Restore ────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Backup & Restore</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">Download a full JSON backup of all data, or restore from a previous backup. Restoring replaces all existing data.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleBackup} className="gap-2">
            <Download className="w-4 h-4" /> Download Backup
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" /> Restore from Backup
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFileChange} />
        </CardContent>
      </Card>

      {/* ── Restore confirm dialog ──────────────────────────────────────────── */}
      <Dialog open={restoreConfirmOpen} onOpenChange={(o) => { if (!restoring) { setRestoreConfirmOpen(o); if (!o) setPendingRestoreData(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Restore Backup?
            </DialogTitle>
            <DialogDescription>
              This will <strong>permanently replace all data</strong> with the contents of the backup from <strong>{pendingRestoreData?.exported_at ? new Date(pendingRestoreData.exported_at).toLocaleString() : "unknown date"}</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRestoreConfirmOpen(false); setPendingRestoreData(null); }} disabled={restoring}>Cancel</Button>
            <Button variant="destructive" onClick={handleRestoreConfirm} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Yes, Replace All Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ──────────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!deleteProgress) { setConfirmOpen(o); if (!o) setConfirmInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Confirm Permanent Deletion
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete <strong>{totalSelected} record{totalSelected !== 1 ? "s" : ""}</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-52 overflow-y-auto">
            {[
              { key: "emptyTeams",                label: "Teams (no members)",               nameFn: t => t.name,                        src: teams },
              { key: "sprintsForMemberlessTeams", label: "Sprints (memberless team)",        nameFn: s => `${s.name} — ${s.quarter}`,    src: sprints },
              { key: "members",                   label: "Team Members",                     nameFn: m => `${m.name} (${m.discipline})`, src: members },
              { key: "sprints",              label: "Sprints",                        nameFn: s => `${s.name} — ${s.quarter}`,         src: sprints },
              { key: "allocations",          label: "Sprint Allocations",             nameFn: null,                                    src: allocations },
              { key: "templateAllocations",  label: "Template Sprint Allocations",    nameFn: null,                                    src: allocations },
              { key: "zeroAllocations",      label: "Zero-% Sprint Allocations",      nameFn: null,                                    src: allocations },
              { key: "quarterlyAllocations", label: "Quarterly Allocations",          nameFn: null,                                    src: quarterlyAllocations },
              { key: "zeroQA",               label: "Zero-% Quarterly Allocations",   nameFn: null,                                    src: quarterlyAllocations },
              { key: "workAreaSelections",   label: "Work Item Selections",           nameFn: null,                                    src: workAreaSelections },
              { key: "unassignedWorkAreas",  label: "Unassigned Work Items",          nameFn: w => w.name,                             src: workAreas },
              { key: "workAreas",            label: "Work Items (deleted team)",      nameFn: w => w.name,                             src: workAreas },
              { key: "unassignedAllocations", label: "Allocations Without Work Item",  nameFn: null,                                    src: allocations },
              { key: "detachedAllocations",  label: "Detached Sprint Allocations",    nameFn: null,                                    src: allocations },
            ].map(({ key, label, nameFn, src }) => {
              const ids = selected[key];
              if (!ids || ids.size === 0) return null;
              return (
                <div key={key} className="p-3 bg-muted rounded-lg">
                  <div className="font-semibold text-sm mb-1">{label} <span className="text-muted-foreground font-normal">({ids.size})</span></div>
                  {nameFn && (
                    <div className="space-y-0.5">
                      {Array.from(ids).slice(0, 4).map(id => {
                        const item = src.find(i => i.id === id);
                        return item ? <div key={id} className="text-xs text-muted-foreground">• {nameFn(item)}</div> : null;
                      })}
                      {ids.size > 4 && <div className="text-xs text-muted-foreground">… and {ids.size - 4} more</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {deleteProgress ? (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Deleting records…</span>
                <span>{deleteProgress.done} / {deleteProgress.total}</span>
              </div>
              <Progress value={(deleteProgress.done / deleteProgress.total) * 100} />
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Type <strong>DELETE</strong> to confirm</label>
              <Input value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
                placeholder="DELETE" autoFocus
                onKeyDown={e => { if (e.key === "Enter" && confirmReady) handleDelete(); }} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmInput(""); }} disabled={!!deleteProgress}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!confirmReady || !!deleteProgress}>
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteProgress ? "Deleting…" : `Delete ${totalSelected} Record${totalSelected !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
