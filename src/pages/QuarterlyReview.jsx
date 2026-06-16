import React, { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin, isTeamManager } from "@/lib/permissions";
import { useSelectedQuarter } from "@/lib/useSelectedQuarter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import { PlanDeliverySummary } from "../components/sprint/QuarterlyPlanHistoryPanel";

// Sort "Q2 2025" descending (newest first).
function quarterRank(q) {
  const m = (q || "").match(/Q(\d)\s+(\d{4})/i);
  return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
}

const round1 = (n) => Math.round((n || 0) * 10) / 10;

function StatCard({ label, value, sub, tone }) {
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] opacity-80 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function QuarterlyReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedQuarter, setSelectedQuarter] = useSelectedQuarter();

  // Team managers default to their own team; admins/viewers default to all.
  const managedTeamId = (!isAdmin(user) && isTeamManager(user) && user?.managed_team_ids?.length)
    ? user.managed_team_ids[0]
    : null;
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

  // Teams that have ever been finalized — the filter options.
  const teamOptions = useMemo(() => {
    const map = new Map();
    snapshots.forEach(s => { if (!map.has(s.team_id)) map.set(s.team_id, s.team_name || s.team_id); });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshots]);

  // If the sticky quarter has no finalized data, jump to the most recent one that does.
  useEffect(() => {
    if (!isLoading && quarters.length && !quarters.includes(selectedQuarter)) {
      setSelectedQuarter(quarters[0]);
    }
  }, [isLoading, quarters, selectedQuarter, setSelectedQuarter]);

  // If a manager's preselected team has never been finalized, fall back to all teams.
  useEffect(() => {
    if (teamFilter !== "all" && teamOptions.length && !teamOptions.some(t => t.id === teamFilter)) {
      setTeamFilter("all");
    }
  }, [teamOptions, teamFilter]);

  const forQuarter = useMemo(
    () => snapshots
      .filter(s => s.quarter === selectedQuarter)
      .filter(s => teamFilter === "all" || s.team_id === teamFilter)
      .sort((a, b) => (a.team_name || "").localeCompare(b.team_name || "")),
    [snapshots, selectedQuarter, teamFilter],
  );

  const totals = useMemo(() => {
    const acc = { plannedInitial: 0, delivered: 0, inProgress: 0, unplanned: 0, excludedCount: 0, deliveredPlanned: 0, deliveredUnplanned: 0 };
    forQuarter.forEach(s => {
      const sm = s.summary || {};
      acc.plannedInitial    += sm.plannedInitial || 0;
      acc.delivered         += sm.totalDelivered || 0;
      acc.inProgress        += sm.totalInProgress || 0;
      acc.unplanned         += sm.totalUnplanned || 0;
      acc.excludedCount     += sm.excludedCount || 0;
      acc.deliveredPlanned  += sm.deliveredPlanned || 0;
      acc.deliveredUnplanned += (sm.deliveredUnplProd || 0) + (sm.deliveredUnplNon || 0);
    });
    return {
      plannedInitial: round1(acc.plannedInitial),
      delivered: round1(acc.delivered),
      inProgress: round1(acc.inProgress),
      unplanned: round1(acc.unplanned),
      excludedCount: acc.excludedCount,
      deliveredPlanned: round1(acc.deliveredPlanned),
      deliveredUnplanned: round1(acc.deliveredUnplanned),
      deliveryPct: acc.plannedInitial > 0 ? Math.round((acc.delivered / acc.plannedInitial) * 100) : null,
    };
  }, [forQuarter]);

  // Per-team grouped bars: planned vs delivered vs in-progress (days).
  const barData = useMemo(
    () => forQuarter.map(s => ({
      name: s.team_name || "Team",
      planned: round1(s.summary?.plannedInitial),
      delivered: round1(s.summary?.totalDelivered),
      inProgress: round1(s.summary?.totalInProgress),
    })),
    [forQuarter],
  );

  // Where the effort went (composition of the filtered scope).
  const pieData = useMemo(() => ([
    { name: "Delivered on plan", value: totals.deliveredPlanned, color: "#10b981" },
    { name: "Unplanned delivered", value: totals.deliveredUnplanned, color: "#a78bfa" },
    { name: "In progress", value: totals.inProgress, color: "#3b82f6" },
  ].filter(d => d.value > 0)), [totals]);

  const deleteSnapshot = useMutation({
    mutationFn: (id) => bragiQTC.entities.QuarterlyComparisonSnapshot.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["comparisonSnapshots"] }); toast.success("Removed"); },
    onError: (err) => toast.error(err.message || "Failed to remove"),
  });

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");
  const scopeName = teamFilter === "all" ? "All teams" : (teamOptions.find(t => t.id === teamFilter)?.name || "Team");

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
        <EmptyState
          icon={ClipboardCheck}
          title="No finalized quarters yet"
          description="Finalize a quarter from Quarterly Planning → a team's Plan History → Actuals tab → 'Finalize quarter'."
        />
      ) : forQuarter.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={`No finalized comparisons for ${scopeName} in ${selectedQuarter}`}
          description="Pick another quarter or team, or finalize this one from the Actuals tab in Quarterly Planning."
        />
      ) : (
        <div className="space-y-6">
          {/* Roll-up: stats + charts */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold">{scopeName} — {selectedQuarter}</CardTitle>
              <p className="text-xs text-muted-foreground">{forQuarter.length} team{forQuarter.length === 1 ? "" : "s"} finalized · days</p>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Planned (initial)" value={`${totals.plannedInitial}d`} tone="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200" />
                <StatCard label="Delivered" value={`${totals.delivered}d`} sub={totals.deliveryPct != null ? `${totals.deliveryPct}% of plan` : undefined} tone="border-green-200 bg-green-50/50 dark:bg-green-950/20 text-green-900 dark:text-green-200" />
                <StatCard label="In progress" value={`${totals.inProgress}d`} tone="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200" />
                <StatCard label="Unplanned" value={`${totals.unplanned}d`} tone="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200" />
                <StatCard label="Cancelled" value={totals.excludedCount} sub="tickets" tone="border-border bg-muted/30" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Planned vs delivered by team */}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold mb-3">Planned vs delivered by team</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 48 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-30} textAnchor="end" interval={0} height={56} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}d`} width={40} />
                      <Tooltip formatter={(v) => `${v}d`} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Bar dataKey="planned" name="Planned" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="inProgress" name="In progress" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Effort composition */}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold mb-3">Where the effort went</p>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" label={({ percent }) => `${Math.round(percent * 100)}%`} labelLine={false}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${v}d`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground py-8 text-center">No delivered or in-progress effort recorded.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-team frozen comparisons */}
          {forQuarter.map(snap => (
            <Card key={snap.id} className="border-primary/20">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base font-bold">{snap.team_name || "Team"} — {snap.quarter}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Finalized {fmtDate(snap.captured_at)}{snap.captured_by_email ? ` by ${snap.captured_by_email}` : ""}
                    </span>
                    {isAdmin(user) && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteSnapshot.mutate(snap.id)} title="Remove this finalized snapshot">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <PlanDeliverySummary
                  rows={Array.isArray(snap.rows) ? snap.rows : []}
                  daysPerSp={snap.days_per_sp ?? 1}
                  jiraBaseUrl={snap.jira_base_url}
                  actuals={{ excluded: snap.excluded || { count: 0, storyPoints: 0 }, dateRange: { start: snap.date_start, end: snap.date_end } }}
                  hasInitial={snap.has_initial}
                  quarter={snap.quarter}
                  teamName={snap.team_name || ""}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
