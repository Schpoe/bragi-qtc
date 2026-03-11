import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function UtilizationByWorkItemType({ workAreas, allocations, members, selectedTeamId }) {
  const filteredMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const memberIds = new Set(filteredMembers.map(m => m.id));
  const relevantAllocations = allocations.filter(a => memberIds.has(a.team_member_id));

  const typeUtilization = {};

  relevantAllocations.forEach(allocation => {
    const workArea = workAreas.find(wa => wa.id === allocation.work_area_id);
    if (workArea) {
      if (!typeUtilization[workArea.type]) {
        typeUtilization[workArea.type] = 0;
      }
      typeUtilization[workArea.type] += allocation.percent || 0;
    }
  });

  const data = Object.entries(typeUtilization)
    .map(([type, utilization]) => ({
      name: type,
      utilization: Math.round(utilization),
    }))
    .sort((a, b) => b.utilization - a.utilization);

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        No utilization data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => `${value}%`} />
        <Bar dataKey="utilization" fill="hsl(var(--chart-1))" />
      </BarChart>
    </ResponsiveContainer>
  );
}