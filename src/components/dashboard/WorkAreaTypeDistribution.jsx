import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { resolveTypeColor } from "@/lib/utils";

export default function WorkAreaTypeDistribution({ teams, workAreas, workAreaTypes = [], allocations, members, selectedTeamId }) {
  // Filter work items based on team selection
  const relevantWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.leading_team_id === selectedTeamId || wa.supporting_team_ids?.includes(selectedTeamId));

  // Group by type and calculate stats
  const typeStats = {};
  
  relevantWorkAreas.forEach(wa => {
    if (!typeStats[wa.type]) {
      typeStats[wa.type] = {
        name: wa.type,
        count: 0,
        allocation: 0,
        workAreas: [],
      };
    }
    typeStats[wa.type].count += 1;
    typeStats[wa.type].workAreas.push(wa);

    // Calculate allocation for this work item
    if (selectedTeamId === "all") {
      const waAllocation = allocations
        .filter(a => a.work_area_id === wa.id)
        .reduce((sum, a) => sum + (a.days || 0), 0);
      typeStats[wa.type].allocation += waAllocation;
    } else {
      const teamMembers = members.filter(m => m.team_id === selectedTeamId);
      const memberIds = new Set(teamMembers.map(m => m.id));
      const waAllocation = allocations
        .filter(a => a.work_area_id === wa.id && memberIds.has(a.team_member_id))
        .reduce((sum, a) => sum + (a.days || 0), 0);
      typeStats[wa.type].allocation += waAllocation;
    }
  });

  const typeData = Object.values(typeStats).sort((a, b) => b.count - a.count);

  if (typeData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">No work item types found.</div>
        </CardContent>
      </Card>
    );
  }

  // Pie chart data
  const pieData = typeData.map(d => ({
    name: d.name,
    value: d.count,
  }));

  // Bar chart data for allocation
  const barData = typeData.map(d => ({
    name: d.name,
    allocation: Math.round(d.allocation),
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {typeData.map((type, idx) => (
          <Card key={idx}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: resolveTypeColor(type.name, workAreaTypes) }}>
                  {type.count}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">{type.name}</div>
                <div className="text-sm font-semibold mt-2">{Math.round(type.allocation)}%</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Work Items by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={resolveTypeColor(entry.name, workAreaTypes)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Allocation by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="allocation" fill="#3b82f6" name="Allocation %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {typeData.map((type, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: resolveTypeColor(type.name, workAreaTypes) }}
                    />
                    <span className="text-sm font-medium">{type.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {type.count} work item{type.count !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: resolveTypeColor(type.name, workAreaTypes),
                      width: `${Math.min(type.allocation, 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{Math.round(type.allocation)}% allocation</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}