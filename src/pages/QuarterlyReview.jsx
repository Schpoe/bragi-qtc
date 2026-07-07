import React, { useMemo, useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, isTeamManager } from "@/lib/permissions";
import { useSelectedQuarter } from "@/lib/useSelectedQuarter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Trash2, Download, FileDown, Crown, Users } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import JiraLink from "@/components/shared/JiraLink";
import { ComparisonDonut } from "../components/sprint/QuarterlyPlanHistoryPanel";
import { summarizeComparison, rowDaysFor, COMPARISON_BUCKETS } from "@/lib/quarterly-comparison";

const round1 = (n) => Math.round((n || 0) * 10) / 10;

// Sort "Q2 2025" descending (newest first).
function quarterRank(q) {
  const m = (q || "").match(/Q(\d)\s+(\d{4})/i);
  return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] opacity-80 mt-0.5">{sub}</p>}
    </div>
  );
}

function RoleChip({ role }) {
  if (role === "leading") return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Crown className="w-2.5 h-2.5" /> Leading</span>
  );
  if (role === "supporting") return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Users className="w-2.5 h-2.5" /> Supporting</span>
  );
  return null;
}

function TopicTable({ title, items, jiraBaseUrl, withPlan }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left py-1.5 px-2 font-semibold">Topic</th>
                {withPlan && <th className="text-center py-1.5 px-2 font-semibold text-amber-700">Planned</th>}
                <th className="text-center py-1.5 px-2 font-semibold text-green-700">Delivered</th>
                <th className="text-center py-1.5 px-2 font-semibold text-blue-700">In progress</th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="py-1.5 px-2">
                    <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                      {r.prodKey && <JiraLink issueKey={r.prodKey} baseUrl={jiraBaseUrl} showIcon className="font-mono text-[10px] shrink-0" />}
                      <span className="font-medium truncate max-w-[240px]">{r.prodName}</span>
                      <RoleChip role={r.role} />
                    </div>
                  </td>
                  {withPlan && <td className="text-center py-1.5 px-2 tabular-nums text-amber-700">{r.plannedDays > 0 ? `${round1(r.plannedDays)}d` : "—"}</td>}
                  <td className="text-center py-1.5 px-2 tabular-nums text-green-700">
                    {round1(r.deliveredDays)}d
                    {r.completedSP > 0 && <span className="block text-[10px] text-green-600/70 font-normal">{r.completedSP} SP · {r.completedCount}</span>}
                  </td>
                  <td className="text-center py-1.5 px-2 tabular-nums text-blue-700">
                    {round1(r.inProgressDays)}d
                    {r.inProgressSP > 0 && <span className="block text-[10px] text-blue-600/70 font-normal">{r.inProgressSP} SP · {r.inProgressCount}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Merge topics across the scope's snapshots into day-based rows. Story points are
// converted to days with each source team's factor BEFORE summing, so teams with
// different factors aggregate correctly.
function mergeRows(scope) {
  const map = new Map();
  scope.forEach(({ snap }) => {
    const factor = snap.days_per_sp ?? 1;
    const qaFactor = snap.qa_days_per_sp ?? 1;
    (Array.isArray(snap.rows) ? snap.rows : []).forEach(r => {
      const mk = `${r.category}::${r.prodKey || r.key}`;
      if (!map.has(mk)) {
        map.set(mk, {
          key: mk, prodKey: r.prodKey || null, prodName: r.prodName, category: r.category,
          role: r.role ?? null, _roleSet: false, _roleConsistent: true,
          plannedDays: 0, deliveredDays: 0, inProgressDays: 0,
          completedSP: 0, inProgressSP: 0, completedCount: 0, inProgressCount: 0,
        });
      }
      const m = map.get(mk);
      m.plannedDays    += r.initialDays || 0;
      m.deliveredDays  += rowDaysFor(r, "completed", factor, qaFactor);
      m.inProgressDays += rowDaysFor(r, "inProgress", factor, qaFactor);
      m.completedSP    += r.completedSP || 0;
      m.inProgressSP   += r.inProgressSP || 0;
      m.completedCount += r.completedCount || 0;
      m.inProgressCount += r.inProgressCount || 0;
      const role = r.role ?? null;
      if (!m._roleSet) { m.role = role; m._roleSet = true; }
      else if (m.role !== role) { m._roleConsistent = false; }
    });
  });
  return [...map.values()].map(m => ({ ...m, role: m._roleConsistent ? m.role : null }));
}

const effortOf = (r) => (r.plannedDays || 0) + (r.deliveredDays || 0) + (r.inProgressDays || 0);

export default function QuarterlyReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedQuarter, setSelectedQuarter] = useSelectedQuarter();
  const exportRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const managedTeamId = (!isAdmin(user) && isTeamManager(user) && user?.managed_team_ids?.length) ? user.managed_team_ids[0] : null;
  const [teamFilter, setTeamFilter] = useState(managedTeamId || "all");
  const showTeamFilter = isAdmin(user) || isTeamManager(user);

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["comparisonSnapshots"],
    queryFn: () => bragiQTC.entities.QuarterlyComparisonSnapshot.list(),
  });

  const quarters = useMemo(
    () => [...new Set(snapshots.map(s => s.quarter))].sort((a, b) => quarterRank(b) - quarterRank(a)),
    [snapshots],
  );
  const teamOptions = useMemo(() => {
    const map = new Map();
    snapshots.forEach(s => { if (!map.has(s.team_id)) map.set(s.team_id, s.team_name || s.team_id); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshots]);

  useEffect(() => {
    if (!isLoading && quarters.length && !quarters.includes(selectedQuarter)) setSelectedQuarter(quarters[0]);
  }, [isLoading, quarters, selectedQuarter, setSelectedQuarter]);
  useEffect(() => {
    if (teamFilter !== "all" && teamOptions.length && !teamOptions.some(t => t.id === teamFilter)) setTeamFilter("all");
  }, [teamOptions, teamFilter]);

  const forQuarter = useMemo(
    () => snapshots
      .filter(s => s.quarter === selectedQuarter)
      .filter(s => teamFilter === "all" || s.team_id === teamFilter)
      .sort((a, b) => (a.team_name || "").localeCompare(b.team_name || "")),
    [snapshots, selectedQuarter, teamFilter],
  );

  const summaries = useMemo(
    () => forQuarter.map(s => ({ snap: s, sm: summarizeComparison(Array.isArray(s.rows) ? s.rows : [], s.days_per_sp ?? 1, s.excluded, s.qa_days_per_sp ?? 1) })),
    [forQuarter],
  );

  const totals = useMemo(() => {
    const acc = { plannedInitial: 0, delivered: 0, inProgress: 0, unplanned: 0, plannedNotDelivered: 0, excludedCount: 0 };
    summaries.forEach(({ sm }) => {
      acc.plannedInitial += sm.plannedInitial || 0;
      acc.delivered += sm.totalDelivered || 0;
      acc.inProgress += sm.totalInProgress || 0;
      acc.unplanned += sm.totalUnplanned || 0;
      acc.plannedNotDelivered += sm.plannedNotDelivered || 0;
      acc.excludedCount += sm.excludedCount || 0;
    });
    return {
      plannedInitial: round1(acc.plannedInitial), delivered: round1(acc.delivered), inProgress: round1(acc.inProgress),
      unplanned: round1(acc.unplanned), plannedNotDelivered: round1(acc.plannedNotDelivered), excludedCount: acc.excludedCount,
      deliveryPct: acc.plannedInitial > 0 ? Math.round((acc.delivered / acc.plannedInitial) * 100) : null,
    };
  }, [summaries]);

  const barData = useMemo(
    () => summaries.map(({ snap, sm }) => {
      const row = { name: snap.team_name || "Team" };
      COMPARISON_BUCKETS.forEach(b => { row[b.key] = round1(sm.buckets?.[b.key]); });
      return row;
    }),
    [summaries],
  );
  const aggBuckets = useMemo(() => {
    const acc = {};
    COMPARISON_BUCKETS.forEach(b => { acc[b.key] = 0; });
    summaries.forEach(({ sm }) => COMPARISON_BUCKETS.forEach(b => { acc[b.key] += sm.buckets?.[b.key] || 0; }));
    return acc;
  }, [summaries]);

  const merged = useMemo(() => mergeRows(summaries), [summaries]);
  const plannedTopics    = useMemo(() => merged.filter(r => r.category === "planned" || r.category === "planned-no-prod").sort((a, b) => effortOf(b) - effortOf(a)), [merged]);
  const unplannedProd    = useMemo(() => merged.filter(r => r.category === "unplanned").sort((a, b) => effortOf(b) - effortOf(a)), [merged]);
  const unplannedNonProd = useMemo(() => merged.filter(r => r.category === "epic-only" || r.category === "unassigned").sort((a, b) => effortOf(b) - effortOf(a)), [merged]);

  const jiraBaseUrl = forQuarter.find(s => s.jira_base_url)?.jira_base_url || null;
  const isAllTeams = teamFilter === "all";
  const scopeName = isAllTeams ? "All teams" : (teamOptions.find(t => t.id === teamFilter)?.name || "Team");
  const singleSnap = !isAllTeams && forQuarter.length === 1 ? forQuarter[0] : null;

  const deleteSnapshot = useMutation({
    mutationFn: (id) => bragiQTC.entities.QuarterlyComparisonSnapshot.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["comparisonSnapshots"] }); toast.success("Removed"); },
    onError: (err) => toast.error(err.message || "Failed to remove"),
  });

  const baseName = `quarterly-review_${selectedQuarter}_${scopeName}`.replace(/[^a-z0-9_-]+/gi, "-");

  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Quarterly Review", selectedQuarter, scopeName].map(esc).join(","),
      [], ["Metric", "Days"].map(esc).join(","),
      ["Planned (initial)", totals.plannedInitial].map(esc).join(","),
      ["Delivered", totals.delivered].map(esc).join(","),
      ["In progress", totals.inProgress].map(esc).join(","),
      ["Planned not delivered", totals.plannedNotDelivered].map(esc).join(","),
      ["Unplanned", totals.unplanned].map(esc).join(","),
      ["Cancelled (tickets)", totals.excludedCount].map(esc).join(","),
      [], ["Section", "Topic", "Key", "Role", "Planned (d)", "Delivered (d)", "In progress (d)", "Done SP", "In progress SP"].map(esc).join(","),
    ];
    const add = (label, arr, withPlan) => arr.forEach(r => lines.push(
      [label, r.prodName, r.prodKey ?? "", r.role ?? "", withPlan ? round1(r.plannedDays) : "", round1(r.deliveredDays), round1(r.inProgressDays), r.completedSP, r.inProgressSP].map(esc).join(",")));
    add("Planned", plannedTopics, true);
    add("Unplanned PROD", unplannedProd, false);
    add("Unplanned non-PROD", unplannedNonProd, false);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = baseName + ".csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 1.5, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/jpeg", 0.7);
      const pdf = new jsPDF("p", "mm", "a4", true);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const w = pageW - margin * 2;
      const imgH = (canvas.height * w) / canvas.width;
      pdf.setFontSize(13);
      pdf.text(`Quarterly Review — ${scopeName} — ${selectedQuarter}`, margin, margin + 2);
      const top = margin + 6;
      pdf.addImage(img, "JPEG", margin, top, w, imgH, undefined, "FAST");
      let shown = pageH - top - margin;
      while (shown < imgH) {
        pdf.addPage();
        pdf.addImage(img, "JPEG", margin, margin - shown, w, imgH, undefined, "FAST");
        shown += pageH - margin * 2;
      }
      pdf.save(baseName + ".pdf");
    } catch (err) {
      console.error("Quarterly Review PDF export failed:", err);
      toast.error("PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Quarterly Review" subtitle="Finalized plan-vs-delivered comparisons, frozen at quarter close">
        {showTeamFilter && teamOptions.length > 0 && (
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teamOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {quarters.length > 0 && (
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : snapshots.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No finalized quarters yet"
          description="Finalize a quarter from Quarterly Planning → a team's Plan History → Actuals tab → 'Finalize quarter'." />
      ) : forQuarter.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={`No finalized comparisons for ${scopeName} in ${selectedQuarter}`}
          description="Pick another quarter or team, or finalize this one from the Actuals tab in Quarterly Planning." />
      ) : (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold">{scopeName} — {selectedQuarter}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {teamFilter === "all" ? `${forQuarter.length} team${forQuarter.length === 1 ? "" : "s"} finalized` : (singleSnap ? `Finalized ${new Date(singleSnap.captured_at).toLocaleDateString()}${singleSnap.captured_by_email ? ` by ${singleSnap.captured_by_email}` : ""}` : "")} · all figures in days
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={exportCSV}><Download className="w-3 h-3" /> CSV</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={exportPDF} disabled={exporting}><FileDown className="w-3 h-3" /> {exporting ? "…" : "PDF"}</Button>
                {isAdmin(user) && singleSnap && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSnapshot.mutate(singleSnap.id)} title="Remove this finalized snapshot"><Trash2 className="w-3.5 h-3.5" /></Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div ref={exportRef} className="space-y-6 bg-background">
              {/* 1 — Overview statistics */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Plan vs Delivered — Summary</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard label="Planned (initial)" value={`${totals.plannedInitial}d`} tone="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200" />
                  <StatCard label="Delivered" value={`${totals.delivered}d`} sub={totals.deliveryPct != null ? `${totals.deliveryPct}% of plan` : undefined} tone="border-green-200 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-200" />
                  <StatCard label="In progress" value={`${totals.inProgress}d`} tone="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200" />
                  <StatCard label="Planned not delivered" value={`${totals.plannedNotDelivered}d`} tone="border-slate-200 bg-slate-50/60 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300" />
                  <StatCard label="Unplanned" value={`${totals.unplanned}d`} tone="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200" />
                  <StatCard label="Cancelled" value={totals.excludedCount} sub="tickets" tone="border-border bg-muted/30" />
                </div>
              </div>

              {/* 2 — Diagrams. The by-team bar is cross-team, so only for "All teams". */}
              <div className={`grid grid-cols-1 gap-6 ${isAllTeams ? "lg:grid-cols-2" : ""}`}>
                {isAllTeams && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold mb-3">Effort by team & category</p>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 48 }} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" interval={0} height={56} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}d`} width={40} />
                        <Tooltip formatter={(v) => `${v}d`} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                        {COMPARISON_BUCKETS.map(b => <Bar key={b.key} dataKey={b.key} name={b.label} stackId="a" fill={b.color} maxBarSize={44} />)}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold mb-3">Effort breakdown</p>
                  <ComparisonDonut buckets={aggBuckets} height={320} />
                </div>
              </div>

              {/* 3 — Topic lists */}
              <div className="space-y-4">
                <TopicTable title="Planned topics" items={plannedTopics} jiraBaseUrl={jiraBaseUrl} withPlan />
                <TopicTable title="Unplanned PROD topics (delivered but not planned)" items={unplannedProd} jiraBaseUrl={jiraBaseUrl} withPlan={false} />
                <TopicTable title="Unplanned non-PROD topics (Jira work with no PROD link)" items={unplannedNonProd} jiraBaseUrl={jiraBaseUrl} withPlan={false} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
