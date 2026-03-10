import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Pencil, Trash2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge";

const teamColors = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

export default function TeamCard({ team, members, onEdit, onDelete, onClick }) {
  const disciplines = [...new Set(members.map(m => m.discipline))];

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/60 hover:border-primary/30"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${teamColors[team.color] || "bg-primary"}`} />
            <h3 className="font-semibold text-foreground">{team.name}</h3>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(team); }}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(team); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {team.description && (
          <p className="text-xs text-muted-foreground mb-3">{team.description}</p>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="w-4 h-4" />
          <span>{members.length} Mitglieder</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {disciplines.map(d => <DisciplineBadge key={d} discipline={d} />)}
        </div>
      </CardContent>
    </Card>
  );
}