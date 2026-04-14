import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FolderKanban } from "lucide-react";

export default function StatsRow({ teams, members, workAreas, selectedTeamId }) {
  const filteredMembers = selectedTeamId === "all" ? members : members.filter(m => m.team_id === selectedTeamId);

  const stats = [
    { label: "Teams", value: selectedTeamId === "all" ? teams.length : 1, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Members", value: filteredMembers.length, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "Work Items", value: workAreas.length, icon: FolderKanban, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
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
