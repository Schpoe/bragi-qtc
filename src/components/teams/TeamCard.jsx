import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Pencil, Trash2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge";

const teamColors = {
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  zinc: "bg-zinc-500",
  stone: "bg-stone-500",
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
          {(onEdit || onDelete) && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(team); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(team); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {team.description && (
          <p className="text-xs text-muted-foreground mb-3">{team.description}</p>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="w-4 h-4" />
          <span>{members.length} {members.length === 1 ? "Member" : "Members"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {disciplines.map(d => <DisciplineBadge key={d} discipline={d} />)}
        </div>
      </CardContent>
    </Card>
  );
}