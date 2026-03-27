import React, { useState, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "sonner";
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

function CategorySection({ title, description, items, selectedIds, onToggle, onSelectAll, onDeselectAll, renderItem, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = items.length;
  const selectedCount = selectedIds.size;
  const isClean = count === 0;

  return (
    <Card className={cn(isClean ? "border-border" : "border-amber-300/60")}>
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isClean
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            }
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant={isClean ? "outline" : "secondary"} className="text-xs shrink-0">
              {count}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {!isClean && selectedCount > 0 && (
              <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/30">{selectedCount} selected</Badge>
            )}
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 ml-6">{description}</p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          {isClean ? (
            <div className="flex items-center gap-2 py-3 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" /> All records in this category are healthy.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">{count} orphaned record{count !== 1 ? "s" : ""}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onSelectAll}>Select all</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDeselectAll} disabled={selectedCount === 0}>Deselect all</Button>
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
  members: new Set(),
  sprints: new Set(),
  allocations: new Set(),
  templateAllocations: new Set(),
  quarterlyAllocations: new Set(),
  workAreaSelections: new Set(),
  workAreas: new Set(),
};

export default function CleanupPage() {
  const [selected, setSelected] = useState(EMPTY_SELECTION);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteProgress, setDeleteProgress] = useState(null); // { done, total } | null
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: teamsLoading, refetch: refetchTeams } = useQuery({ queryKey: ["teams"], queryFn: () => bragiQTC.entities.Team.list() });
  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery({ queryKey: ["teamMembers"], queryFn: () => bragiQTC.entities.TeamMember.list() });
  const { data: sprints = [], isLoading: sprintsLoading, refetch: refetchSprints } = useQuery({ queryKey: ["sprints"], queryFn: () => bragiQTC.entities.Sprint.list() });
  const { data: allocations = [], isLoading: allocationsLoading, refetch: refetchAllocations } = useQuery({ queryKey: ["allocations"], queryFn: () => bragiQTC.entities.Allocation.list() });
  const { data: workAreas = [], isLoading: workAreasLoading, refetch: refetchWorkAreas } = useQuery({ queryKey: ["workAreas"], queryFn: () => bragiQTC.entities.WorkArea.list() });
  const { data: quarterlyAllocations = [], isLoading: qaLoading, refetch: refetchQA } = useQuery({ queryKey: ["quarterlyAllocations"], queryFn: () => bragiQTC.entities.QuarterlyAllocation.list() });
  const { data: workAreaSelections = [], isLoading: wasLoading, refetch: refetchWAS } = useQuery({ queryKey: ["workAreaSelections"], queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list() });

  const isLoading = teamsLoading || membersLoading || sprintsLoading || allocationsLoading || workAreasLoading || qaLoading || wasLoading;

  const rescan = () => {
    setSelected(EMPTY_SELECTION);
    refetchTeams(); refetchMembers(); refetchSprints(); refetchAllocations();
    refetchWorkAreas(); refetchQA(); refetchWAS();
  };

  // ── Orphan detection ───────────────────────────────────────────────────────

  const orphans = useMemo(() => {
    const teamIds      = new Set(teams.map(t => t.id));
    const memberIds    = new Set(members.map(m => m.id));
    const sprintIds    = new Set(sprints.map(s => s.id));
    const workAreaIds  = new Set(workAreas.map(wa => wa.id));
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

    // 4. Allocations on template/cross-team sprints (should never exist)
    const orphanTemplateAllocations = allocations.filter(a =>
      templateSprintIds.has(a.sprint_id) &&
      !orphanAllocations.some(o => o.id === a.id) // don't double-count
    );

    // 5. Quarterly allocations: missing member or work area
    const orphanQA = quarterlyAllocations.filter(a =>
      !memberIds.has(a.team_member_id) ||
      (a.work_area_id && !workAreaIds.has(a.work_area_id))
    );

    // 6. Work area selections: missing team OR contains deleted work area IDs
    const orphanWAS = workAreaSelections.filter(s =>
      !teamIds.has(s.team_id) ||
      (s.work_area_ids || []).some(waId => !workAreaIds.has(waId))
    );

    // 7. Work areas: leading_team_id references a deleted team
    const orphanWorkAreas = workAreas.filter(wa =>
      wa.leading_team_id && !teamIds.has(wa.leading_team_id)
    );

    // 8. Work areas: supporting_team_ids contains deleted team IDs
    const staleWorkAreas = workAreas.filter(wa =>
      !orphanWorkAreas.some(o => o.id === wa.id) && // not already flagged
      (wa.supporting_team_ids || []).some(tid => !teamIds.has(tid))
    );

    return {
      members:              orphanMembers,
      sprints:              orphanSprints,
      allocations:          orphanAllocations,
      templateAllocations:  orphanTemplateAllocations,
      quarterlyAllocations: orphanQA,
      workAreaSelections:   orphanWAS,
      workAreas:            orphanWorkAreas,
      staleWorkAreas,       // stale refs only — needs repair, not delete
    };
  }, [teams, members, sprints, allocations, quarterlyAllocations, workAreaSelections, workAreas]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggle = (category, id) => {
    setSelected(prev => {
      const s = new Set(prev[category]);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...prev, [category]: s };
    });
  };

  const selectAll  = (category) => setSelected(prev => ({ ...prev, [category]: new Set(orphans[category].map(i => i.id)) }));
  const deselectAll = (category) => setSelected(prev => ({ ...prev, [category]: new Set() }));

  const selectAllOrphans = () => {
    setSelected({
      members:              new Set(orphans.members.map(i => i.id)),
      sprints:              new Set(orphans.sprints.map(i => i.id)),
      allocations:          new Set(orphans.allocations.map(i => i.id)),
      templateAllocations:  new Set(orphans.templateAllocations.map(i => i.id)),
      quarterlyAllocations: new Set(orphans.quarterlyAllocations.map(i => i.id)),
      workAreaSelections:   new Set(orphans.workAreaSelections.map(i => i.id)),
      workAreas:            new Set(orphans.workAreas.map(i => i.id)),
    });
  };

  const totalSelected =
    selected.members.size + selected.sprints.size + selected.allocations.size +
    selected.templateAllocations.size + selected.quarterlyAllocations.size +
    selected.workAreaSelections.size + selected.workAreas.size;

  const totalOrphans =
    orphans.members.length + orphans.sprints.length + orphans.allocations.length +
    orphans.templateAllocations.length + orphans.quarterlyAllocations.length +
    orphans.workAreaSelections.length + orphans.workAreas.length;

  // ── Deletion ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const ops = [
      ...[...selected.members].map(id              => () => bragiQTC.entities.TeamMember.delete(id)),
      ...[...selected.sprints].map(id              => () => bragiQTC.entities.Sprint.delete(id)),
      ...[...selected.allocations].map(id          => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.templateAllocations].map(id  => () => bragiQTC.entities.Allocation.delete(id)),
      ...[...selected.quarterlyAllocations].map(id => () => bragiQTC.entities.QuarterlyAllocation.delete(id)),
      ...[...selected.workAreaSelections].map(id   => () => bragiQTC.entities.QuarterlyWorkAreaSelection.delete(id)),
      ...[...selected.workAreas].map(id            => () => bragiQTC.entities.WorkArea.delete(id)),
    ];

    setDeleteProgress({ done: 0, total: ops.length });
    let done = 0;
    const errors = [];

    for (const op of ops) {
      try {
        await op();
      } catch (e) {
        errors.push(e.message);
      }
      done++;
      setDeleteProgress({ done, total: ops.length });
    }

    // Invalidate all caches
    ["teamMembers", "sprints", "allocations", "quarterlyAllocations", "workAreaSelections", "workAreas"].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );

    setSelected(EMPTY_SELECTION);
    setConfirmInput("");
    setDeleteProgress(null);
    setConfirmOpen(false);

    if (errors.length > 0) {
      toast.error(`Cleanup completed with ${errors.length} error${errors.length !== 1 ? "s" : ""}. ${ops.length - errors.length} records deleted.`);
    } else {
      toast.success(`${ops.length} record${ops.length !== 1 ? "s" : ""} deleted successfully.`);
    }
  };

  // ── Lookup helpers ─────────────────────────────────────────────────────────

  const teamName   = id => teams.find(t => t.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;
  const memberName = id => members.find(m => m.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;
  const sprintName = id => sprints.find(s => s.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;
  const waName     = id => workAreas.find(w => w.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const memberItem = (m) => (
    <OrphanItem
      key={m.id}
      checked={selected.members.has(m.id)}
      onToggle={() => toggle("members", m.id)}
      title={m.name}
      subtitle={m.discipline}
      reasons={[{ label: `Team deleted: ${m.team_id?.slice(0, 8)}…`, danger: true }]}
    />
  );

  const sprintItem = (s) => (
    <OrphanItem
      key={s.id}
      checked={selected.sprints.has(s.id)}
      onToggle={() => toggle("sprints", s.id)}
      title={s.name}
      subtitle={s.quarter}
      reasons={[{ label: `Team deleted: ${s.team_id?.slice(0, 8)}…`, danger: true }]}
    />
  );

  const allocationItem = (a) => {
    const missingMember = !members.some(m => m.id === a.team_member_id);
    const missingSprint = !sprints.some(s => s.id === a.sprint_id);
    const missingWA     = a.work_area_id && !workAreas.some(w => w.id === a.work_area_id);
    return (
      <OrphanItem
        key={a.id}
        checked={selected.allocations.has(a.id)}
        onToggle={() => toggle("allocations", a.id)}
        title={`${a.percent}% allocation`}
        reasons={[
          missingMember && { label: `Member deleted: ${a.team_member_id?.slice(0, 8)}…`, danger: true },
          !missingMember && { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
          missingSprint && { label: `Sprint deleted: ${a.sprint_id?.slice(0, 8)}…`, danger: true },
          !missingSprint && { label: `Sprint: ${sprintName(a.sprint_id)}`, danger: false },
          missingWA && { label: `Work item deleted: ${a.work_area_id?.slice(0, 8)}…`, danger: true },
          !missingWA && a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)}
      />
    );
  };

  const templateAllocItem = (a) => {
    const sprint = sprints.find(s => s.id === a.sprint_id);
    return (
      <OrphanItem
        key={a.id}
        checked={selected.templateAllocations.has(a.id)}
        onToggle={() => toggle("templateAllocations", a.id)}
        title={`${a.percent}% allocation`}
        subtitle={`Member: ${memberName(a.team_member_id)}`}
        reasons={[
          { label: `On template sprint: ${sprint?.name ?? a.sprint_id?.slice(0, 8)}`, danger: true },
          a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)}
      />
    );
  };

  const qaItem = (a) => {
    const missingMember = !members.some(m => m.id === a.team_member_id);
    const missingWA     = a.work_area_id && !workAreas.some(w => w.id === a.work_area_id);
    return (
      <OrphanItem
        key={a.id}
        checked={selected.quarterlyAllocations.has(a.id)}
        onToggle={() => toggle("quarterlyAllocations", a.id)}
        title={`${a.percent}% — ${a.quarter}`}
        reasons={[
          missingMember && { label: `Member deleted: ${a.team_member_id?.slice(0, 8)}…`, danger: true },
          !missingMember && { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
          missingWA && { label: `Work item deleted: ${a.work_area_id?.slice(0, 8)}…`, danger: true },
          !missingWA && a.work_area_id && { label: `Work item: ${waName(a.work_area_id)}`, danger: false },
        ].filter(Boolean)}
      />
    );
  };

  const wasItem = (s) => {
    const missingTeam = !teams.some(t => t.id === s.team_id);
    const missingWAs  = (s.work_area_ids || []).filter(id => !workAreas.some(w => w.id === id));
    return (
      <OrphanItem
        key={s.id}
        checked={selected.workAreaSelections.has(s.id)}
        onToggle={() => toggle("workAreaSelections", s.id)}
        title={`${s.quarter} selection`}
        reasons={[
          missingTeam && { label: `Team deleted: ${s.team_id?.slice(0, 8)}…`, danger: true },
          !missingTeam && { label: `Team: ${teamName(s.team_id)}`, danger: false },
          missingWAs.length > 0 && { label: `${missingWAs.length} deleted work item ref${missingWAs.length !== 1 ? "s" : ""}`, danger: true },
        ].filter(Boolean)}
      />
    );
  };

  const waItem = (wa) => (
    <OrphanItem
      key={wa.id}
      checked={selected.workAreas.has(wa.id)}
      onToggle={() => toggle("workAreas", wa.id)}
      title={wa.name}
      subtitle={`Type: ${wa.type}`}
      reasons={[{ label: `Leading team deleted: ${wa.leading_team_id?.slice(0, 8)}…`, danger: true }]}
    />
  );

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Data Cleanup" subtitle="Identify and remove orphaned data" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const isDeletable = totalSelected > 0;
  const confirmReady = confirmInput.trim().toUpperCase() === "DELETE";

  return (
    <>
      <div>
        <PageHeader title="Data Cleanup" subtitle="Scan for orphaned records across all datasets">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={rescan}>
              <RefreshCw className="w-4 h-4 mr-2" /> Re-scan
            </Button>
            {isDeletable && (
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({totalSelected})
              </Button>
            )}
          </div>
        </PageHeader>

        {/* ── Health summary ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total records scanned", value: teams.length + members.length + sprints.length + allocations.length + quarterlyAllocations.length + workAreaSelections.length + workAreas.length },
            { label: "Orphaned records found", value: totalOrphans, danger: totalOrphans > 0 },
            { label: "Selected for deletion", value: totalSelected, danger: totalSelected > 0 },
            { label: "Stale references", value: orphans.staleWorkAreas.length, warn: orphans.staleWorkAreas.length > 0 },
          ].map(({ label, value, danger, warn }) => (
            <Card key={label} className={cn(danger && value > 0 ? "border-destructive/40 bg-destructive/5" : warn && value > 0 ? "border-amber-300/60 bg-amber-50/40" : "")}>
              <CardContent className="pt-4 pb-3">
                <div className={cn("text-2xl font-bold tabular-nums", danger && value > 0 ? "text-destructive" : warn && value > 0 ? "text-amber-600" : "text-foreground")}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalOrphans === 0 && orphans.staleWorkAreas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold">Database is Clean</h3>
                <p className="text-sm text-muted-foreground">No orphaned or stale data found across all datasets.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {totalOrphans > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  {totalOrphans} orphaned record{totalOrphans !== 1 ? "s" : ""} found across {
                    [orphans.members, orphans.sprints, orphans.allocations, orphans.templateAllocations,
                      orphans.quarterlyAllocations, orphans.workAreaSelections, orphans.workAreas
                    ].filter(a => a.length > 0).length
                  } categories
                </div>
                <Button variant="outline" size="sm" onClick={selectAllOrphans}>
                  Select all orphans
                </Button>
              </div>
            )}

            {/* ── Category sections ───────────────────────────────────────── */}
            <CategorySection
              title="Team Members"
              description="Members whose team has been deleted"
              items={orphans.members}
              selectedIds={selected.members}
              onToggle={(id) => toggle("members", id)}
              onSelectAll={() => selectAll("members")}
              onDeselectAll={() => deselectAll("members")}
              renderItem={memberItem}
              defaultOpen={orphans.members.length > 0}
            />

            <CategorySection
              title="Sprints"
              description="Sprints whose team has been deleted"
              items={orphans.sprints}
              selectedIds={selected.sprints}
              onToggle={(id) => toggle("sprints", id)}
              onSelectAll={() => selectAll("sprints")}
              onDeselectAll={() => deselectAll("sprints")}
              renderItem={sprintItem}
              defaultOpen={orphans.sprints.length > 0}
            />

            <CategorySection
              title="Sprint Allocations"
              description="Allocations referencing a deleted member, sprint, or work item"
              items={orphans.allocations}
              selectedIds={selected.allocations}
              onToggle={(id) => toggle("allocations", id)}
              onSelectAll={() => selectAll("allocations")}
              onDeselectAll={() => deselectAll("allocations")}
              renderItem={allocationItem}
              defaultOpen={orphans.allocations.length > 0}
            />

            <CategorySection
              title="Template Sprint Allocations"
              description="Allocations attached to cross-team template sprints — these should not exist"
              items={orphans.templateAllocations}
              selectedIds={selected.templateAllocations}
              onToggle={(id) => toggle("templateAllocations", id)}
              onSelectAll={() => selectAll("templateAllocations")}
              onDeselectAll={() => deselectAll("templateAllocations")}
              renderItem={templateAllocItem}
              defaultOpen={orphans.templateAllocations.length > 0}
            />

            <CategorySection
              title="Quarterly Allocations"
              description="Quarterly allocations referencing a deleted member or work item"
              items={orphans.quarterlyAllocations}
              selectedIds={selected.quarterlyAllocations}
              onToggle={(id) => toggle("quarterlyAllocations", id)}
              onSelectAll={() => selectAll("quarterlyAllocations")}
              onDeselectAll={() => deselectAll("quarterlyAllocations")}
              renderItem={qaItem}
              defaultOpen={orphans.quarterlyAllocations.length > 0}
            />

            <CategorySection
              title="Work Item Selections"
              description="Quarterly work item selections with a deleted team or containing deleted work item references"
              items={orphans.workAreaSelections}
              selectedIds={selected.workAreaSelections}
              onToggle={(id) => toggle("workAreaSelections", id)}
              onSelectAll={() => selectAll("workAreaSelections")}
              onDeselectAll={() => deselectAll("workAreaSelections")}
              renderItem={wasItem}
              defaultOpen={orphans.workAreaSelections.length > 0}
            />

            <CategorySection
              title="Work Items"
              description="Work items whose leading team has been deleted"
              items={orphans.workAreas}
              selectedIds={selected.workAreas}
              onToggle={(id) => toggle("workAreas", id)}
              onSelectAll={() => selectAll("workAreas")}
              onDeselectAll={() => deselectAll("workAreas")}
              renderItem={waItem}
              defaultOpen={orphans.workAreas.length > 0}
            />

            {/* ── Stale references (info only, no delete) ─────────────────── */}
            {orphans.staleWorkAreas.length > 0 && (
              <Card className="border-blue-200/60">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-semibold text-sm">Stale References — Work Items</span>
                    <Badge variant="outline" className="text-xs">{orphans.staleWorkAreas.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    These work items have deleted teams in their <em>supporting teams</em> list. The work item itself is valid — edit it to remove the stale references.
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {orphans.staleWorkAreas.map(wa => {
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
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Confirm dialog ─────────────────────────────────────────────── */}
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
                { key: "members",              label: "Team Members",                  entity: members,   nameFn: m => `${m.name} (${m.discipline})` },
                { key: "sprints",              label: "Sprints",                       entity: sprints,   nameFn: s => `${s.name} — ${s.quarter}` },
                { key: "allocations",          label: "Sprint Allocations",            entity: allocations },
                { key: "templateAllocations",  label: "Template Sprint Allocations",   entity: allocations },
                { key: "quarterlyAllocations", label: "Quarterly Allocations",         entity: quarterlyAllocations },
                { key: "workAreaSelections",   label: "Work Item Selections",          entity: workAreaSelections },
                { key: "workAreas",            label: "Work Items",                    entity: workAreas, nameFn: w => w.name },
              ].map(({ key, label, entity, nameFn }) => {
                const ids = selected[key];
                if (!ids || ids.size === 0) return null;
                return (
                  <div key={key} className="p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-sm mb-1">{label} <span className="text-muted-foreground font-normal">({ids.size})</span></div>
                    {nameFn && (
                      <div className="space-y-0.5">
                        {Array.from(ids).slice(0, 4).map(id => {
                          const item = entity.find(i => i.id === id);
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
                <Input
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter" && confirmReady) handleDelete(); }}
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmInput(""); }} disabled={!!deleteProgress}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!confirmReady || !!deleteProgress}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteProgress ? "Deleting…" : `Delete ${totalSelected} Record${totalSelected !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
