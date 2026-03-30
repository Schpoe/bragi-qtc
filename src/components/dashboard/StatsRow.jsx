import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FolderKanban, TrendingUp } from "lucide-react";

export default function StatsRow({ teams, members, workAreas, sprints, allocations, selectedTeamId }) {
  const filteredMembers = selectedTeamId === "all" ? members : members.filter(m => m.team_id === selectedTeamId);
  const sprintIds = new Set(sprints.map(s => s.id));
  const memberIds = new Set(filteredMembers.map(m => m.id));
  const relevantAllocs = allocations.filter(a => sprintIds.has(a.sprint_id) && memberIds.has(a.team_member_id));
  const totalCapacity = filteredMembers.reduce((s, m) => s + (m.sprint_days || 10), 0) * sprints.length;
  const totalAllocated = relevantAllocs.reduce((s, a) => s + (a.days || 0), 0);
  const avgUtil = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  const stats = [
    { label: "Teams", value: selectedTeamId === "all" ? teams.length : 1, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Members", value: filteredMembers.length, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "Work Items", value: workAreas.length, icon: FolderKanban, color: "text-purple-600 bg-purple-50" },
    { label: "Avg. Utilization", value: `${avgUtil}%`, icon: TrendingUp, color: avgUtil > 100 ? "text-red-600 bg-red-50" : avgUtil > 80 ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map(s => (
        <Card key={s.label} className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold tabular-nums">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}