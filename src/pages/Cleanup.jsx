import React, { useState, useMemo } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2, ChevronDown, ChevronRight, Wrench, Download, Upload, DatabaseBackup } from "lucide-react";
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
            {reasons.map((r, i) => <ReasonTag key={i} danger={r.danger}>{r.label}</ReasonTag>)}
          </div>
        )}
      </div>
    </div>
  );
}

function CategorySection({ title, description, items, selectedIds, onSelectAll, onDeselectAll, renderItem, defaultOpen = true, actionSlot }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items || items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
            <span className="font-semibold text-sm">{title}</span>
            <Badge variant={selectedIds && selectedIds.size > 0 ? "default" : "secondary"} className="text-xs">
              {selectedIds ? `${selectedIds.size} / ${items.length}` : items.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            {actionSlot}
            {selectedIds && onSelectAll && onDeselectAll && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSelectAll}>All</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDeselectAll}>None</Button>
              </>
            )}
          </div>
        </div>
        {description && <p className="text-xs text-muted-foreground ml-6 mt-0.5">{description}</p>}
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-4 pt-0 space-y-2">
          {items.map(item => renderItem(item))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_SELECTION = {
  emptyTeams: new Set(),
  members: new Set(),
  quarterlyAllocations: new Set(),
  zeroQA: new Set(),
  workAreaSelections: new Set(),
  unassignedWorkAreas: new Set(),
  workAreas: new Set(),
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
  const { data: workAreas = [], isLoading: workAreasLoading, isFetching: workAreasFetching } = useQuery({ queryKey: ["workAreas"], queryFn: () => bragiQTC.entities.WorkArea.list() });
  const { data: quarterlyAllocations = [], isLoading: qaLoading, isFetching: qaFetching } = useQuery({ queryKey: ["quarterlyAllocations"], queryFn: () => bragiQTC.entities.QuarterlyAllocation.list() });
  const { data: workAreaSelections = [], isLoading: wasLoading, isFetching: wasFetching } = useQuery({ queryKey: ["workAreaSelections"], queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list() });

  const isLoading = teamsLoading || membersLoading || workAreasLoading || qaLoading || wasLoading;
  const isScanning = teamsFetching || membersFetching || workAreasFetching || qaFetching || wasFetching;

  const rescan = () => {
    setSelected(EMPTY_SELECTION);
    ["teams", "teamMembers", "workAreas", "quarterlyAllocations", "workAreaSelections"].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  // ── Orphan detection ───────────────────────────────────────────────────────

  const orphans = useMemo(() => {
    const teamIds     = new Set(teams.map(t => t.id));
    const memberIds   = new Set(members.map(m => m.id));
    const workAreaIds = new Set(workAreas.map(w => w.id));

    // 1. Teams with no members
    const memberTeamIds = new Set(members.map(m => m.team_id));
    const emptyTeams = teams.filter(t => !memberTeamIds.has(t.id));

    // 2. Team members whose team was deleted
    const orphanMembers = members.filter(m => m.team_id && !teamIds.has(m.team_id));

    // 3. Quarterly allocations: missing member or work area
    const orphanQA = quarterlyAllocations.filter(a =>
      !memberIds.has(a.team_member_id) || (a.work_area_id && !workAreaIds.has(a.work_area_id))
    );
    const orphanQAIds = new Set(orphanQA.map(a => a.id));

    // 4. Zero-day quarterly allocations
    const zeroQA = quarterlyAllocations.filter(a => a.days === 0 && !orphanQAIds.has(a.id));

    // 5. Work area selections whose team was deleted
    const orphanWAS = workAreaSelections.filter(s => !teamIds.has(s.team_id));

    // 6. Work area selections with stale work area IDs (repair-worthy)
    const staleWAS = workAreaSelections.filter(s =>
      teamIds.has(s.team_id) && (s.work_area_ids || []).some(id => !workAreaIds.has(id))
    );

    // 7. Work areas whose leading team was deleted
    const orphanWorkAreas = workAreas.filter(w => w.leading_team_id && !teamIds.has(w.leading_team_id));
    const orphanWorkAreaIds = new Set(orphanWorkAreas.map(w => w.id));

    // 8. Work areas with no leading team (unassigned)
    const unassignedWorkAreas = workAreas.filter(w => !w.leading_team_id && !orphanWorkAreaIds.has(w.id));

    // 9. Work areas with stale supporting team refs (repair-worthy)
    const staleWorkAreas = workAreas.filter(w =>
      !orphanWorkAreaIds.has(w.id) && (w.supporting_team_ids || []).some(id => !teamIds.has(id))
    );

    return { emptyTeams, members: orphanMembers, quarterlyAllocations: orphanQA, zeroQA, workAreaSelections: orphanWAS, staleWAS, workAreas: orphanWorkAreas, unassignedWorkAreas, staleWorkAreas };
  }, [teams, members, quarterlyAllocations, workAreaSelections, workAreas]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggle = (category, id) => setSelected(prev => {
    const s = new Set(prev[category]);
    s.has(id) ? s.delete(id) : s.add(id);
    return { ...prev, [category]: s };
  });

  const selectAll   = (cat) => setSelected(prev => ({ ...prev, [cat]: new Set(orphans[cat].map(i => i.id)) }));
  const deselectAll = (cat) => setSelected(prev => ({ ...prev, [cat]: new Set() }));

  const selectAllOrphans = () => setSelected({
    emptyTeams:            new Set(orphans.emptyTeams.map(i => i.id)),
    members:               new Set(orphans.members.map(i => i.id)),
    quarterlyAllocations:  new Set(orphans.quarterlyAllocations.map(i => i.id)),
    zeroQA:                new Set(orphans.zeroQA.map(i => i.id)),
    workAreaSelections:    new Set(orphans.workAreaSelections.map(i => i.id)),
    unassignedWorkAreas:   new Set(orphans.unassignedWorkAreas.map(i => i.id)),
    workAreas:             new Set(orphans.workAreas.map(i => i.id)),
  });

  const totalSelected = Object.values(selected).reduce((sum, s) => sum + s.size, 0);
  const totalOrphans  = orphans.emptyTeams.length + orphans.members.length + orphans.quarterlyAllocations.length + orphans.zeroQA.length + orphans.workAreaSelections.length + orphans.unassignedWorkAreas.length + orphans.workAreas.length;
  const totalRepairable = orphans.staleWAS.length + orphans.staleWorkAreas.length;

  // ── Repair ─────────────────────────────────────────────────────────────────

  const repairAll = async () => {
    setRepairing(true);
    const teamIds     = new Set(teams.map(t => t.id));
    const workAreaIds = new Set(workAreas.map(w => w.id));
    let repaired = 0;
    const errors = [];

    for (const s of orphans.staleWAS) {
      try {
        await bragiQTC.entities.QuarterlyWorkAreaSelection.update(s.id, {
          work_area_ids: (s.work_area_ids || []).filter(id => workAreaIds.has(id)),
        });
        repaired++;
      } catch (e) { errors.push(e.message); }
    }

    for (const wa of orphans.staleWorkAreas) {
      try {
        await bragiQTC.entities.WorkArea.update(wa.id, {
          supporting_team_ids: (wa.supporting_team_ids || []).filter(id => teamIds.has(id)),
        });
        repaired++;
      } catch (e) { errors.push(e.message); }
    }

    queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
    queryClient.invalidateQueries({ queryKey: ["workAreas"] });
    setRepairing(false);

    if (errors.length > 0) toast.error(`Repaired ${repaired} with ${errors.length} error(s)`);
    else toast.success(`Repaired ${repaired} record${repaired !== 1 ? "s" : ""}`);
  };

  // ── Deletion ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const ops = [
      ...[...selected.emptyTeams].map(id            => () => bragiQTC.entities.Team.delete(id)),
      ...[...selected.members].map(id               => () => bragiQTC.entities.TeamMember.delete(id)),
      ...[...selected.quarterlyAllocations].map(id  => () => bragiQTC.entities.QuarterlyAllocation.delete(id)),
      ...[...selected.zeroQA].map(id                => () => bragiQTC.entities.QuarterlyAllocation.delete(id)),
      ...[...selected.workAreaSelections].map(id    => () => bragiQTC.entities.QuarterlyWorkAreaSelection.delete(id)),
      ...[...selected.unassignedWorkAreas].map(id   => () => bragiQTC.entities.WorkArea.delete(id)),
      ...[...selected.workAreas].map(id             => () => bragiQTC.entities.WorkArea.delete(id)),
    ];

    setDeleteProgress({ done: 0, total: ops.length });
    let done = 0;
    const errors = [];

    for (const op of ops) {
      try { await op(); } catch (e) { errors.push(e.message); }
      done++;
      setDeleteProgress({ done, total: ops.length });
    }

    ["teams", "teamMembers", "quarterlyAllocations", "workAreaSelections", "workAreas"]
      .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

    setSelected(EMPTY_SELECTION);
    setConfirmInput("");
    setDeleteProgress(null);
    setConfirmOpen(false);

    if (errors.length > 0) toast.error(`Completed with ${errors.length} error(s). ${ops.length - errors.length} deleted.`);
    else toast.success(`${ops.length} record${ops.length !== 1 ? "s" : ""} deleted.`);
  };

  // ── Lookup helpers ─────────────────────────────────────────────────────────

  const memberName = id => members.find(m => m.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;
  const waName     = id => workAreas.find(w => w.id === id)?.name ?? `[deleted ${id?.slice(0, 6)}…]`;

  // ── Render items ───────────────────────────────────────────────────────────

  const emptyTeamItem = (t) => (
    <OrphanItem key={t.id} checked={selected.emptyTeams.has(t.id)} onToggle={() => toggle("emptyTeams", t.id)}
      title={t.name} reasons={[{ label: "No members", danger: true }]} />
  );

  const memberItem = (m) => (
    <OrphanItem key={m.id} checked={selected.members.has(m.id)} onToggle={() => toggle("members", m.id)}
      title={m.name} subtitle={m.discipline}
      reasons={[{ label: `Team deleted: ${m.team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const qaItem = (a) => {
    const missingMember = !members.some(m => m.id === a.team_member_id);
    const missingWA     = a.work_area_id && !workAreas.some(w => w.id === a.work_area_id);
    return (
      <OrphanItem key={a.id} checked={selected.quarterlyAllocations.has(a.id)} onToggle={() => toggle("quarterlyAllocations", a.id)}
        title={`${a.days}d — ${a.quarter}`}
        reasons={[
          missingMember ? { label: `Member deleted: ${a.team_member_id?.slice(0, 8)}…`, danger: true } : { label: `Member: ${memberName(a.team_member_id)}`, danger: false },
          missingWA ? { label: `Work item deleted: ${a.work_area_id?.slice(0, 8)}…`, danger: true } : a.work_area_id ? { label: `Work item: ${waName(a.work_area_id)}`, danger: false } : null,
        ].filter(Boolean)} />
    );
  };

  const zeroQAItem = (a) => (
    <OrphanItem key={a.id} checked={selected.zeroQA.has(a.id)} onToggle={() => toggle("zeroQA", a.id)}
      title={`0d — ${a.quarter}`}
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

  const waItem = (w) => (
    <OrphanItem key={w.id} checked={selected.workAreas.has(w.id)} onToggle={() => toggle("workAreas", w.id)}
      title={w.name}
      reasons={[{ label: `Leading team deleted: ${w.leading_team_id?.slice(0, 8)}…`, danger: true }]} />
  );

  const unassignedWAItem = (w) => (
    <OrphanItem key={w.id} checked={selected.unassignedWorkAreas.has(w.id)} onToggle={() => toggle("unassignedWorkAreas", w.id)}
      title={w.name} reasons={[{ label: "No leading team assigned", danger: true }]} />
  );

  const staleWASItem = (s) => {
    const stale = (s.work_area_ids || []).filter(id => !workAreas.some(w => w.id === id));
    return (
      <div key={s.id} className="p-3 border rounded-lg bg-background text-xs space-y-1">
        <div className="font-medium text-sm">{s.quarter}</div>
        <ReasonTag danger>{stale.length} deleted work item ref{stale.length !== 1 ? "s" : ""}</ReasonTag>
        <ReasonTag>{(s.work_area_ids || []).length - stale.length} valid refs kept</ReasonTag>
      </div>
    );
  };

  const staleWAItem = (w) => {
    const stale = (w.supporting_team_ids || []).filter(id => !teams.some(t => t.id === id));
    return (
      <div key={w.id} className="p-3 border rounded-lg bg-background text-xs space-y-1">
        <div className="font-medium text-sm">{w.name}</div>
        <ReasonTag danger>{stale.length} deleted team ref{stale.length !== 1 ? "s" : ""} in supporting teams</ReasonTag>
      </div>
    );
  };

  // ── Backup / Restore ───────────────────────────────────────────────────────

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
      ["teams", "teamMembers", "quarterlyAllocations", "workAreaSelections", "workAreas", "users"]
        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    } catch (err) {
      toast.error('Restore failed: ' + err.message);
    } finally {
      setRestoring(false);
      setRestoreConfirmOpen(false);
      setPendingRestoreData(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Data Cleanup" subtitle="Identify and remove orphaned data" />
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  const confirmReady = confirmInput.trim().toUpperCase() === "DELETE";

  return (
    <div>
      <PageHeader title="Data Cleanup" subtitle="Scan for orphaned records">
        <div className="flex items-center gap-2">
          {totalRepairable > 0 && (
            <Button variant="outline" onClick={repairAll} disabled={repairing}>
              <Wrench className="w-4 h-4 mr-2" />
              {repairing ? "Repairing…" : `Repair Stale Refs (${totalRepairable})`}
            </Button>
          )}
          <Button variant="outline" onClick={rescan} disabled={isScanning}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isScanning && "animate-spin")} />
            {isScanning ? "Scanning…" : "Re-scan"}
          </Button>
          {totalSelected > 0 && (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({totalSelected})
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Health summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Records scanned", value: teams.length + members.length + quarterlyAllocations.length + workAreaSelections.length + workAreas.length },
          { label: "Orphaned / useless", value: totalOrphans, danger: totalOrphans > 0 },
          { label: "Selected for deletion", value: totalSelected, danger: totalSelected > 0 },
        ].map(({ label, value, danger }) => (
          <Card key={label} className={cn(danger && value > 0 ? "border-destructive/40 bg-destructive/5" : "")}>
            <CardContent className="pt-4 pb-3">
              <div className={cn("text-2xl font-bold tabular-nums", danger && value > 0 ? "text-destructive" : "")}>{value}</div>
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

          <CategorySection title="Teams Without Members" description="Teams with no members — shown in overview but have no capacity"
            items={orphans.emptyTeams} selectedIds={selected.emptyTeams}
            onSelectAll={() => selectAll("emptyTeams")} onDeselectAll={() => deselectAll("emptyTeams")}
            renderItem={emptyTeamItem} defaultOpen={orphans.emptyTeams.length > 0} />

          <CategorySection title="Team Members (deleted team)" description="Members whose team was deleted"
            items={orphans.members} selectedIds={selected.members}
            onSelectAll={() => selectAll("members")} onDeselectAll={() => deselectAll("members")}
            renderItem={memberItem} defaultOpen={orphans.members.length > 0} />

          <CategorySection title="Quarterly Allocations (orphaned)" description="Quarterly allocations referencing a deleted member or work item"
            items={orphans.quarterlyAllocations} selectedIds={selected.quarterlyAllocations}
            onSelectAll={() => selectAll("quarterlyAllocations")} onDeselectAll={() => deselectAll("quarterlyAllocations")}
            renderItem={qaItem} defaultOpen={orphans.quarterlyAllocations.length > 0} />

          <CategorySection title="Zero-Day Quarterly Allocations" description="Quarterly allocations with 0 days — no effect on planning"
            items={orphans.zeroQA} selectedIds={selected.zeroQA}
            onSelectAll={() => selectAll("zeroQA")} onDeselectAll={() => deselectAll("zeroQA")}
            renderItem={zeroQAItem} defaultOpen={orphans.zeroQA.length > 0} />

          <CategorySection title="Work Item Selections (deleted team)" description="Quarterly selections whose team was deleted"
            items={orphans.workAreaSelections} selectedIds={selected.workAreaSelections}
            onSelectAll={() => selectAll("workAreaSelections")} onDeselectAll={() => deselectAll("workAreaSelections")}
            renderItem={wasItem} defaultOpen={orphans.workAreaSelections.length > 0} />

          <CategorySection title="Work Items (deleted leading team)" description="Work items whose leading team was deleted"
            items={orphans.workAreas} selectedIds={selected.workAreas}
            onSelectAll={() => selectAll("workAreas")} onDeselectAll={() => deselectAll("workAreas")}
            renderItem={waItem} defaultOpen={orphans.workAreas.length > 0} />

          <CategorySection title="Unassigned Work Items" description="Work items with no leading team"
            items={orphans.unassignedWorkAreas} selectedIds={selected.unassignedWorkAreas}
            onSelectAll={() => selectAll("unassignedWorkAreas")} onDeselectAll={() => deselectAll("unassignedWorkAreas")}
            renderItem={unassignedWAItem} defaultOpen={orphans.unassignedWorkAreas.length > 0} />

          <CategorySection title="Work Item Selections — Stale References" description="Team is valid but some selected work items were deleted. 'Repair All' removes stale IDs."
            items={orphans.staleWAS} selectedIds={null} renderItem={staleWASItem}
            defaultOpen={orphans.staleWAS.length > 0}
            actionSlot={orphans.staleWAS.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={repairAll} disabled={repairing}>
                <Wrench className="w-3 h-3" /> Repair All
              </Button>
            )} />

          <CategorySection title="Work Items — Stale Supporting Teams" description="Work items with deleted teams in their supporting list. 'Repair All' removes stale IDs."
            items={orphans.staleWorkAreas} selectedIds={null} renderItem={staleWAItem}
            defaultOpen={orphans.staleWorkAreas.length > 0}
            actionSlot={orphans.staleWorkAreas.length > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={repairAll} disabled={repairing}>
                <Wrench className="w-3 h-3" /> Repair All
              </Button>
            )} />
        </div>
      )}

      {/* Backup / Restore */}
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

      {/* Restore confirm dialog */}
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

      {/* Delete confirm dialog */}
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
              { key: "emptyTeams",           label: "Teams (no members)",                 nameFn: t => t.name,              src: teams },
              { key: "members",              label: "Team Members",                        nameFn: m => m.name,              src: members },
              { key: "quarterlyAllocations", label: "Quarterly Allocations (orphaned)",    nameFn: null,                    src: [] },
              { key: "zeroQA",               label: "Zero-Day Quarterly Allocations",      nameFn: null,                    src: [] },
              { key: "workAreaSelections",   label: "Work Item Selections",                nameFn: null,                    src: [] },
              { key: "workAreas",            label: "Work Items (deleted team)",           nameFn: w => w.name,             src: workAreas },
              { key: "unassignedWorkAreas",  label: "Unassigned Work Items",               nameFn: w => w.name,             src: workAreas },
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
