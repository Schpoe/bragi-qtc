import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function WorkAreaTypeDistribution({ teams, workAreas, allocations, members, selectedTeamId }) {
  // Filter work areas based on team selection
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

    // Calculate allocation for this work area
    if (selectedTeamId === "all") {
      const waAllocation = allocations
        .filter(a => a.work_area_id === wa.id)
        .reduce((sum, a) => sum + (a.percent || 0), 0);
      typeStats[wa.type].allocation += waAllocation;
    } else {
      const teamMembers = members.filter(m => m.team_id === selectedTeamId);
      const memberIds = new Set(teamMembers.map(m => m.id));
      const waAllocation = allocations
        .filter(a => a.work_area_id === wa.id && memberIds.has(a.team_member_id))
        .reduce((sum, a) => sum + (a.percent || 0), 0);
      typeStats[wa.type].allocation += waAllocation;
    }
  });

  const typeData = Object.values(typeStats).sort((a, b) => b.count - a.count);

  if (typeData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">No work area types found.</div>
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
                <div className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
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
            <CardTitle className="text-sm font-semibold">Work Areas by Type</CardTitle>
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{type.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {type.count} work area{type.count !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: COLORS[idx % COLORS.length],
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