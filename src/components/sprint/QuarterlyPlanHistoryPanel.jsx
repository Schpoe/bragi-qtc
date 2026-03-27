import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, ChevronDown, ChevronRight, ArrowRight, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
      <TrendingUp className="w-3 h-3" /> +{delta}%
    </Badge>
  );
  return (
    <Badge className="text-xs gap-1 bg-blue-100 text-blue-800 border border-blue-300">
      <TrendingDown className="w-3 h-3" /> {delta}%
    </Badge>
  );
}

function ActionBadge({ action }) {
  const styles = {
    set:     "bg-green-100 text-green-800 border-green-300",
    updated: "bg-amber-100 text-amber-800 border-amber-300",
    removed: "bg-red-100 text-red-800 border-red-300",
  };
  const labels = { set: "Added", updated: "Updated", removed: "Removed" };
  return (
    <span className={cn("inline-flex items-center text-xs rounded border px-1.5 py-0.5 font-medium", styles[action] ?? "bg-muted text-muted-foreground")}>
      {labels[action] ?? action}
    </span>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportChangesCSV(rows, quarter) {
  const header = ["Member", "Discipline", "Work Item", "Work Item Type", "Initial %", "Current %", "Change %"];
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

// ── Main component ────────────────────────────────────────────────────────────

export default function QuarterlyPlanHistoryPanel({ quarter, teamId, members, workAreas }) {
  const [open, setOpen] = useState(false);

  const { data: allHistory = [], isLoading } = useQuery({
    queryKey: ["quarterlyPlanHistory"],
    queryFn: () => base44.entities.QuarterlyPlanHistory.list(),
    enabled: open,
  });

  // Filter to this quarter + team
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
    // For each (member × work_area), find first + last entry
    const pairMap = {};
    [...history].reverse().forEach(h => { // chronological order
      const key = `${h.team_member_id}::${h.work_area_id}`;
      if (!pairMap[key]) pairMap[key] = { first: h, last: h };
      else pairMap[key].last = h;
    });

    return Object.values(pairMap).map(({ first, last }) => {
      // Initial value: if first action was "set" (added from 0), initial = 0.
      // If "updated" or "removed", the true starting point is old_percent.
      const initial = (first.action === "set") ? 0 : (first.old_percent ?? 0);
      // Current value: last action "removed" means current = 0.
      const current = (last.action === "removed") ? 0 : (last.new_percent ?? 0);
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
        Quarterly Plan Changelog
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
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No changes recorded yet for {quarter}.<br />
                Changes will appear here as the plan is updated.
              </div>
            ) : (
              <Tabs defaultValue="summary">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="summary">
                      Changes Summary
                      {changedRows.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">{changedRows.length}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="log">
                      Audit Log
                      <Badge variant="secondary" className="ml-2 text-xs">{history.length}</Badge>
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

                {/* ── Changes Summary tab ──────────────────────────────────── */}
                <TabsContent value="summary" className="mt-0">
                  {changesSummary.length === 0 ? (
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
                                  <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{r.initial}%</td>
                                  <td className="py-2 px-1 text-center hidden sm:table-cell">
                                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-auto" />
                                  </td>
                                  <td className="py-2 px-3 text-center tabular-nums font-semibold">{r.current}%</td>
                                  <td className="py-2 pl-3 text-right">
                                    <DeltaBadge delta={r.delta} />
                                  </td>
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
                                  <td className="py-2 px-3 text-center tabular-nums text-muted-foreground">{r.initial}%</td>
                                  <td className="py-2 px-1 text-center hidden sm:table-cell">
                                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 mx-auto" />
                                  </td>
                                  <td className="py-2 px-3 text-center tabular-nums">{r.current}%</td>
                                  <td className="py-2 pl-3 text-right">
                                    <DeltaBadge delta={0} />
                                  </td>
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
                                    <span>Set to <strong className="text-foreground">{h.new_percent}%</strong></span>
                                  )}
                                  {h.action === "updated" && (
                                    <span>
                                      <strong className="text-muted-foreground line-through">{h.old_percent}%</strong>
                                      {" → "}
                                      <strong className="text-foreground">{h.new_percent}%</strong>
                                    </span>
                                  )}
                                  {h.action === "removed" && (
                                    <span>Removed <strong className="text-muted-foreground line-through">{h.old_percent}%</strong></span>
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
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
