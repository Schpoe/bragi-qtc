import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const disciplineStyles = {
  iOS: "bg-blue-100 text-blue-700 border-blue-200",
  Android: "bg-green-100 text-green-700 border-green-200",
  Cloud: "bg-purple-100 text-purple-700 border-purple-200",
  QA: "bg-amber-100 text-amber-700 border-amber-200",
  Embedded: "bg-rose-100 text-rose-700 border-rose-200",
  Algo: "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Test Automation": "bg-teal-100 text-teal-700 border-teal-200",
  UX: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  Frontend: "bg-orange-100 text-orange-700 border-orange-200",
  Backend: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export default function DisciplineBadge({ discipline }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", disciplineStyles[discipline] || "")}>
      {discipline}
    </Badge>
  );
}