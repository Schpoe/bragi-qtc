import React, { useMemo, useState } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { canManageAllocations, isAdmin } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { History, ChevronDown, ChevronRight, ArrowRight, TrendingUp, TrendingDown, Minus, Download, Save, RotateCcw, Trash2, BookMarked, Star, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DeltaBadge({ delta }) {
  if (delta === 0) return <Badge variant="outline" className="text-xs gap-1"><Minus className="w-3 h-3" /> No change</Badge>;
  if (delta > 0) return (
    <Badge className="text-xs gap-1 bg-amber-100 text-amber-800 border border-amber-300">
      <TrendingUp className="w-3 h-3" /> +{delta}d
    </Badge>
  );
  return (
    <Badge className="text-xs gap-1 bg-blue-100 text-blue-800 border border-blue-300">
      <TrendingDown className="w-3 h-3" /> {delta}d
    </Badge>
  );
}

function ActionBadge({ action }) {
  const styles = {
    set:      "bg-green-100 text-green-800 border-green-300",
    updated:  "bg-amber-100 text-amber-800 border-amber-300",
    removed:  "bg-red-100 text-red-800 border-red-300",
    reverted: "bg-purple-100 text-purple-800 border-purple-300",
  };
  const labels = { set: "Added", updated: "Updated", removed: "Removed", reverted: "Reverted" };
  return (
    <span className={cn("inline-flex items-center text-xs rounded border px-1.5 py-0.5 font-medium", styles[action] ?? "bg-muted text-muted-foreground")}>
      {labels[action] ?? action}
    </span>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportChangesCSV(rows, quarter) {
  const header = ["Member", "Discipline", "Work Item", "Work Item Type", "Initial (d)", "Current (d)", "Change (d)"];
  const lines = [
    header.join(","),
    ...rows.map(r => [
      `"${r.memberName}"`,
      `"${r.discipline ?? ""}"`,
      `"${r.workAreaName}"`,
      `"${r.workAreaType ?? ""}"`,
      r.initial ?? 0,
      r.current ?? 0,
      (r.current ?? 0) - (r.initial ?? 0),
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quarterly-changes-${quarter}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Versions tab ─────────────────────────────────────────────────────────────

function VersionsTab({ quarter, teamId, teamName, user, members, workAreas, quarterlyAllocations, workAreaSelections, onRevert }) {
  const queryClient = useQueryClient();
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [revertTarget, setRevertTarget] = useState(null);

  const canManage = canManageAllocations(user, teamId);

  const setInitialPlan = useMutation({
    mutationFn: (id) => bragiQTC.entities.QuarterlyPlanSnapshot.setInitialPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterlyPlanSnapshots", quarter, teamId] });
      toast.success("Initial plan set");
    },
    onError: (err) => toast.error(err.message || "Failed to set initial plan"),
  });

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["quarterlyPlanSnapshots", quarter, teamId],
    queryFn: () => bragiQTC.entities.QuarterlyPlanSnapshot.filter({ quarter, team_id: teamId }),
    enabled: !!(quarter && teamId),
  });

  const createSnapshot = useMutation({
    mutationFn: (data) => bragiQTC.entities.QuarterlyPlanSnapshot.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterlyPlanSnapshots", quarter, teamId] });
      setShowSaveForm(false);
      setLabelInput("");
      setNoteInput("");
      toast.success("Version saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save version"),
  });

  const deleteSnapshot = useMutation({
    mutationFn: (id) => bragiQTC.entities.QuarterlyPlanSnapshot.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarterlyPlanSnapshots", quarter, teamId] });
      toast.success("Version deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete version"),
  });

  const revertSnapshot = useMutation({
    mutationFn: (snapshotId) => bragiQTC.functions.invoke("revertQuarterlyPlanSnapshot", { snapshotId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["quarterlyAllocations"] });
      queryClient.invalidateQueries({ queryKey: ["quarterlyPlanHistory"] });
      queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
      setRevertTarget(null);
      const skippedMsg = res.data.skipped > 0 ? ` (${res.data.skipped} skipped — members no longer exist)` : "";
      toast.success(`Reverted to "${res.data.label}" — ${res.data.restored} allocation(s) restored${skippedMsg}`);
      onRevert?.();
    },
    onError: (err) => {
      setRevertTarget(null);
      toast.error(err.message || "Revert failed");
    },
  });

  const handleSave = () => {
    if (!labelInput.trim()) return;

    // Capture current allocations enriched with names
    const teamMemberIdSet = new Set(members.map(m => m.id));
    const allocations = quarterlyAllocations
      .filter(a => a.quarter === quarter && teamMemberIdSet.has(a.team_member_id))
      .map(a => {
        const member = members.find(m => m.id === a.team_member_id);
        const wa = workAreas.find(w => w.id === a.work_area_id);
        return {
          team_member_id: a.team_member_id,
          member_name: member?.name ?? null,
          member_discipline: member?.discipline ?? null,
          work_area_id: a.work_area_id,
          work_area_name: wa?.name ?? null,
          work_area_type: wa?.type ?? null,
          days: a.days,
        };
      });

    // Capture current work area selection
    const currentSelection = workAreaSelections?.find(s => s.team_id === teamId && s.quarter === quarter);
    const selected_work_area_ids = currentSelection?.work_area_ids ?? [];

    createSnapshot.mutate({
      quarter,
      team_id: teamId,
      team_name: teamName,
      label: labelInput.trim(),
      note: noteInput.trim() || null,
      allocations,
      selected_work_area_ids,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save version form */}
      {canManage && (
        <div>
          {!showSaveForm ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowSaveForm(true)}>
              <Save className="w-3.5 h-3.5" /> Save Current Version
            </Button>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Save Version</p>
              <div className="space-y-1.5">
                <Label htmlFor="snap-label" className="text-xs">Label <span className="text-destructive">*</span></Label>
                <Input
                  id="snap-label"
                  placeholder="e.g. Before planning review"
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snap-note" className="text-xs">Note (optional)</Label>
                <Textarea
                  id="snap-note"
                  placeholder="Any context about this snapshot…"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!labelInput.trim() || createSnapshot.isPending}
                >
                  {createSnapshot.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowSaveForm(false); setLabelInput(""); setNoteInput(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Snapshot list */}
      {snapshots.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <BookMarked className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No saved versions yet for {quarter}.<br />
          {canManage && "Use \u201cSave Current Version\u201d to capture the current state."}
        </div>
      ) : (
        <div className="space-y-2">
          {[...snapshots].sort((a, b) => (b.is_initial_plan ? 1 : 0) - (a.is_initial_plan ? 1 : 0)).map(snap => {
            const allocs = Array.isArray(snap.allocations) ? snap.allocations : [];
            const nonZero = allocs.filter(a => (a.days ?? a.percent ?? 0) > 0).length;
            return (
              <div key={snap.id} className={cn("rounded-lg border bg-background p-3 flex items-start gap-3", snap.is_initial_plan ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20" : "border-border")}>
                {snap.is_initial_plan
                  ? <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  : <BookMarked className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{snap.label}</span>
                    {snap.is_initial_plan && (
                      <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300 gap-1">
                        <Star className="w-2.5 h-2.5" /> Initial Plan
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{nonZero} allocation{nonZero !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{formatDate(snap.created_at)}</span>
                    {snap.created_by_email && <span>· {snap.created_by_email}</span>}
                  </div>
                  {snap.note && (
                    <p className="text-xs text-muted-foreground/80 mt-1 italic">{snap.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canManage && !snap.is_initial_plan && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setInitialPlan.mutate(snap.id)}
                      disabled={setInitialPlan.isPending}
                      title="Mark as initial plan"
                    >
                      <Star className="w-3 h-3" /> Set Initial
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setRevertTarget(snap)}
                    >
                      <RotateCcw className="w-3 h-3" /> Revert
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSnapshot.mutate(snap.id)}
                      disabled={deleteSnapshot.isPending}
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revert confirmation dialog */}
      <Dialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to "{revertTarget?.label}"?</DialogTitle>
            <DialogDescription>
              This will replace all current allocations for <strong>{teamName}</strong> in <strong>{quarter}</strong> with
              those from this snapshot ({Array.isArray(revertTarget?.allocations) ? revertTarget.allocations.filter(a => (a.days ?? a.percent ?? 0) > 0).length : 0} allocations).
              The current state will be lost unless you save it as a version first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => revertSnapshot.mutate(revertTarget.id)}
              disabled={revertSnapshot.isPending}
            >
              {revertSnapshot.isPending ? "Reverting…" : "Revert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuarterlyPlanHistoryPanel({ quarter, teamId, teamName, user, members, workAreas, quarterlyAllocations, workAreaSelections, jiraProjectKey }) {
  const [open, setOpen] = useState(false);

  const { data: allHistory = [], isLoading } = useQuery({
    queryKey: ["quarterlyPlanHistory"],
    queryFn: () => bragiQTC.entities.QuarterlyPlanHistory.list(),
    enabled: open,
  });

  // Filter to this quarter + team, newest first
  const history = useMemo(() =>
    allHistory.filter(h => h.quarter === quarter && h.team_id === teamId)
      .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at)),
    [allHistory, quarter, teamId]
  );

  // ── Audit Log: group by date ──────────────────────────────────────────────

  const byDate = useMemo(() => {
    const groups = {};
    history.forEach(h => {
      const day = formatDateShort(h.changed_at);
      if (!groups[day]) groups[day] = [];
      groups[day].push(h);
    });
    return Object.entries(groups);
  }, [history]);

  // ── Changes Summary: first recorded vs current ────────────────────────────

  const changesSummary = useMemo(() => {
    const pairMap = {};
    [...history].reverse().forEach(h => {
      const key = `${h.team_member_id}::${h.work_area_id}`;
      if (!pairMap[key]) pairMap[key] = { first: h, last: h };
      else pairMap[key].last = h;
    });

    return Object.values(pairMap).map(({ first, last }) => {
      const initial = (first.action === "set") ? 0 : (first.old_days ?? 0);
      const current = (last.action === "removed") ? 0 : (last.new_days ?? 0);
      const delta = current - initial;
      return {
        key: `${first.team_member_id}::${first.work_area_id}`,
        memberName: first.member_name,
        discipline: first.member_discipline,
        workAreaName: first.work_area_name,
        workAreaType: first.work_area_type,
        initial,
        current,
        delta,
        firstDate: first.changed_at,
        lastDate: last.changed_at,
        changeCount: history.filter(h => h.team_member_id === first.team_member_id && h.work_area_id === first.work_area_id).length,
      };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [history]);

  const changedRows   = changesSummary.filter(r => r.delta !== 0);
  const unchangedRows = changesSummary.filter(r => r.delta === 0);

  return (
    <div className="mt-4">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left px-1 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="w-4 h-4" />
        Quarterly Plan History
        {history.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-1">{history.length}</Badge>
        )}
        <span className="ml-auto">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <Card className="mt-2 border-border/60">
          <CardContent className="pt-4 pb-4">
            <Tabs defaultValue="versions">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <TabsList>
                  <TabsTrigger value="versions">
                    <BookMarked className="w-3.5 h-3.5 mr-1.5" />
                    Versions
                  </TabsTrigger>
                  <TabsTrigger value="summary">
                    Changes
                    {changedRows.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{changedRows.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="log">
                    Audit Log
                    <Badge variant="secondary" className="ml-2 text-xs">{history.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="actuals">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Actuals
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => exportChangesCSV(changesSummary, quarter)}
                >
                  <Download className="w-3 h-3" /> Export CSV
                </Button>
              </div>

              {/* ── Versions tab ─────────────────────────────────────────── */}
              <TabsContent value="versions" className="mt-0">
                <VersionsTab
                  quarter={quarter}
                  teamId={teamId}
                  teamName={teamName}
                  user={user}
                  members={members}
                  workAreas={workAreas}
                  quarterlyAllocations={quarterlyAllocations}
                  workAreaSelections={workAreaSelections}
                />
              </TabsContent>

              {/* ── Changes Summary tab ──────────────────────────────────── */}
              <TabsContent value="summary" className="mt-0">
                {isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
                ) : changesSummary.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">No data to compare yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Member</th>
                          <th className="text-left py-2 px-3 font-semibold text-muted-foreground hidden sm:table-cell">Discipline</th>
                          <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Work Item</th>
                          <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Initial</th>
                          <th className="text-center py-2 px-3 font-semibold text-muted-foreground hidden sm:table-cell"></th>
                          <th className="text-center py-2 px-3 font-semibold text-muted-foreground">Current</th>
                          <th className="text-right py-2 pl-3 font-semibold text-muted-foreground">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changedRows.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={7} className="py-1.5 pt-3">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Changed</span>
                              </td>
                            </tr>
                            {changedRows.map(r => (
                              <tr key={r.key} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.memberName}</td>
                                <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{r.discipline}</td>
                                <td className="py-2 px-3">
                                  <span className="truncate max-w-[160px] block" title={r.workAreaName}>{r.workAreaName}</span>
                                  {r.workAreaType && <span className="text-muted-foreground/60">{r.workAreaType}</span>}
                                </td>
                                <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{r.initial}d</td>
                                <td className="py-2 px-1 text-center hidden sm:table-cell">
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-auto" />
                                </td>
                                <td className="py-2 px-3 text-center tabular-nums font-semibold">{r.current}d</td>
                                <td className="py-2 pl-3 text-right"><DeltaBadge delta={r.delta} /></td>
                              </tr>
                            ))}
                          </>
                        )}
                        {unchangedRows.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={7} className="py-1.5 pt-4">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unchanged</span>
                              </td>
                            </tr>
                            {unchangedRows.map(r => (
                              <tr key={r.key} className="border-b border-border/40 opacity-60">
                                <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.memberName}</td>
                                <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{r.discipline}</td>
                                <td className="py-2 px-3">{r.workAreaName}</td>
                                <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{r.initial}d</td>
                                <td className="py-2 px-1 text-center hidden sm:table-cell">
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-auto" />
                                </td>
                                <td className="py-2 px-3 text-center tabular-nums">{r.current}d</td>
                                <td className="py-2 pl-3 text-right"><DeltaBadge delta={0} /></td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Audit Log tab ────────────────────────────────────────── */}
              <TabsContent value="log" className="mt-0">
                {isLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No changes recorded yet for {quarter}.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                    {byDate.map(([day, entries]) => (
                      <div key={day}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 sticky top-0 bg-card py-1">{day}</div>
                        <div className="space-y-1.5">
                          {entries.map((h, i) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-background text-xs">
                              <ActionBadge action={h.action} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium">{h.member_name}</span>
                                  {h.member_discipline && (
                                    <span className="text-muted-foreground/60">({h.member_discipline})</span>
                                  )}
                                  <span className="text-muted-foreground">·</span>
                                  <span className="truncate max-w-[160px]" title={h.work_area_name}>{h.work_area_name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                                  {h.action === "set" && (
                                    <span>Set to <strong className="text-foreground">{h.new_days}d</strong></span>
                                  )}
                                  {h.action === "updated" && (
                                    <span>
                                      <strong className="text-muted-foreground line-through">{h.old_days}d</strong>
                                      {" → "}
                                      <strong className="text-foreground">{h.new_days}d</strong>
                                    </span>
                                  )}
                                  {h.action === "removed" && (
                                    <span>Removed <strong className="text-muted-foreground line-through">{h.old_days}d</strong></span>
                                  )}
                                  {h.action === "reverted" && (
                                    <span>Restored to <strong className="text-foreground">{h.new_days}d</strong></span>
                                  )}
                                </div>
                              </div>
                              <span className="text-muted-foreground/60 whitespace-nowrap shrink-0">
                                {new Date(h.changed_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              {/* ── Actuals tab ─────────────────────────────────────────── */}
              <ActualsTab
                quarter={quarter}
                teamId={teamId}
                teamName={teamName}
                jiraProjectKey={jiraProjectKey}
                members={members}
                quarterlyAllocations={quarterlyAllocations}
              />
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Actuals tab ───────────────────────────────────────────────────────────────

function ActualsTab({ quarter, teamId, teamName, jiraProjectKey, members, quarterlyAllocations }) {
  const [actuals, setActuals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["quarterlyPlanSnapshots", quarter, teamId],
    queryFn: () => bragiQTC.entities.QuarterlyPlanSnapshot.filter({ quarter, team_id: teamId }),
    enabled: !!(quarter && teamId),
  });
  const initialPlan = snapshots.find(s => s.is_initial_plan);

  const plannedDays = useMemo(() => {
    if (!initialPlan) return null;
    const allocs = Array.isArray(initialPlan.allocations) ? initialPlan.allocations : [];
    const teamMemberIds = new Set(members.map(m => m.id));
    return allocs.filter(a => teamMemberIds.has(a.team_member_id)).reduce((sum, a) => sum + (a.days || 0), 0);
  }, [initialPlan, members]);

  const currentDays = useMemo(() => {
    const teamMemberIds = new Set(members.map(m => m.id));
    return quarterlyAllocations
      .filter(a => a.quarter === quarter && teamMemberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.days || 0), 0);
  }, [quarterlyAllocations, quarter, members]);

  const fetchActuals = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bragiQTC.functions.invoke("fetchQuarterlyJiraActuals", { teamId, quarter });
      setActuals(result.data);
    } catch (err) {
      setError(err.message || "Failed to fetch Jira actuals");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TabsContent value="actuals" className="mt-0 space-y-4">
      {/* Initial plan summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Planned Capacity</p>
        {initialPlan ? (
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-sm font-semibold">{plannedDays}d</span>
              <span className="text-xs text-muted-foreground ml-1">initial plan ({initialPlan.label})</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <span className="text-sm font-semibold">{currentDays}d</span>
              <span className="text-xs text-muted-foreground ml-1">current plan</span>
              {plannedDays !== null && currentDays !== plannedDays && (
                <span className={cn("ml-1.5 text-xs font-medium", currentDays > plannedDays ? "text-amber-600" : "text-blue-600")}>
                  ({currentDays > plannedDays ? "+" : ""}{currentDays - plannedDays}d vs initial)
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            No initial plan set. Mark a version as "Initial Plan" in the Versions tab first.
          </p>
        )}
      </div>

      {/* Jira actuals fetch */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jira Actuals</p>
          {jiraProjectKey ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={fetchActuals} disabled={loading}>
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              {loading ? "Fetching…" : actuals ? "Refresh" : `Fetch from ${jiraProjectKey}`}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Set a Jira project key for {teamName} on the Teams page</span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {actuals && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">{actuals.dateRange.start} → {actuals.dateRange.end} · SP field: <code>{actuals.storyPointsField}</code></div>
            {actuals.jql && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-0.5">Show JQL queries</summary>
                <div className="mt-1.5 space-y-1.5">
                  <div className="font-mono bg-muted rounded p-2 break-all">{actuals.jql.completed}</div>
                  <div className="font-mono bg-muted rounded p-2 break-all">{actuals.jql.inProgress}</div>
                </div>
              </details>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-semibold text-green-800 dark:text-green-300">Completed</span>
                </div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{actuals.completed.count}</div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  {actuals.completed.storyPoints > 0 ? `${actuals.completed.storyPoints} story points` : "no story points recorded"}
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">In Progress</span>
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{actuals.inProgress.count}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  {actuals.inProgress.storyPoints > 0 ? `${actuals.inProgress.storyPoints} story points` : "no story points recorded"}
                </div>
              </div>
            </div>

            {/* Comparison row */}
            {plannedDays !== null && (actuals.completed.storyPoints > 0 || actuals.inProgress.storyPoints > 0) && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide">Plan vs Actuals</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span><span className="font-semibold">{plannedDays}d</span> planned (initial)</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span><span className="font-semibold text-green-700">{actuals.completed.storyPoints} SP</span> completed</span>
                  <span className="text-muted-foreground">+</span>
                  <span><span className="font-semibold text-blue-700">{actuals.inProgress.storyPoints} SP</span> in progress</span>
                </div>
              </div>
            )}

            {/* Issue lists */}
            {actuals.completed.issues.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground py-1">
                  {actuals.completed.count} completed issues
                </summary>
                <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                  {actuals.completed.issues.map(issue => (
                    <div key={issue.key} className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground shrink-0">{issue.key}</span>
                      <span className="truncate flex-1">{issue.summary}</span>
                      {issue.storyPoints > 0 && <span className="shrink-0 text-muted-foreground">{issue.storyPoints} SP</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {actuals.inProgress.issues.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground py-1">
                  {actuals.inProgress.count} in-progress issues
                </summary>
                <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                  {actuals.inProgress.issues.map(issue => (
                    <div key={issue.key} className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground shrink-0">{issue.key}</span>
                      <span className="truncate flex-1">{issue.summary}</span>
                      <span className="shrink-0 text-muted-foreground/60">{issue.status}</span>
                      {issue.storyPoints > 0 && <span className="shrink-0 text-muted-foreground">{issue.storyPoints} SP</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {!actuals && !loading && !error && jiraProjectKey && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Click "Fetch" to pull completed and in-progress issues from Jira project <strong>{jiraProjectKey}</strong> for {quarter}.
          </p>
        )}
      </div>
    </TabsContent>
  );
}
