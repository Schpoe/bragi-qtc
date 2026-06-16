import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useBambooHrConfig, useBambooHrDirectory } from "@/hooks/useBambooHr";

const norm = (s) => (s || "").trim().toLowerCase();

export default function MemberFormDialog({ open, onOpenChange, member, teamId, onSave }) {
  const [form, setForm] = useState({ name: "", discipline: "", sprint_days: 100, bamboohr_id: "" });
  const [newDiscipline, setNewDiscipline] = useState("");
  const [showNewDiscipline, setShowNewDiscipline] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => bragiQTC.entities.TeamMember.list(),
  });

  const { configured: bambooConfigured } = useBambooHrConfig();
  const { employees: bambooEmployees } = useBambooHrDirectory(open && bambooConfigured);

  const existingDisciplines = [...new Set(members.map(m => m.discipline).filter(Boolean))].sort();

  useEffect(() => {
    if (member) {
      setForm({ name: member.name, discipline: member.discipline, sprint_days: member.sprint_days ?? 10, bamboohr_id: member.bamboohr_id || "" });
    } else {
      setForm({ name: "", discipline: existingDisciplines[0] || "", sprint_days: 10, bamboohr_id: "" });
    }
    setNewDiscipline("");
    setShowNewDiscipline(false);
  }, [member, open]);

  // Suggest a BambooHR match by name when nothing is mapped yet.
  const suggested = (!form.bamboohr_id && form.name)
    ? bambooEmployees.find(e => norm(e.name) === norm(form.name))
    : null;

  const handleSave = () => {
    if (!form.name.trim()) return;
    const disciplineToSave = showNewDiscipline ? newDiscipline.trim() : form.discipline;
    if (!disciplineToSave) return;
    onSave({ ...form, discipline: disciplineToSave, team_id: teamId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Edit Member" : "New Member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First and last name" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Discipline</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowNewDiscipline(!showNewDiscipline)}
              >
                <Plus className="w-3 h-3 mr-1" />
                {showNewDiscipline ? "Select Existing" : "Add New"}
              </Button>
            </div>
            {showNewDiscipline ? (
              <Input
                value={newDiscipline}
                onChange={(e) => setNewDiscipline(e.target.value)}
                placeholder="Enter new discipline"
                autoFocus
              />
            ) : (
              <Select value={form.discipline} onValueChange={(v) => setForm({ ...form, discipline: v })}>
                <SelectTrigger><SelectValue placeholder="Select discipline" /></SelectTrigger>
                <SelectContent>
                  {existingDisciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sprint capacity (days)</Label>
            <Input type="number" min={1} value={form.sprint_days} onChange={(e) => setForm({ ...form, sprint_days: Number(e.target.value) })} />
          </div>
          {bambooConfigured && (
            <div className="space-y-2">
              <Label>BambooHR employee</Label>
              <Select value={form.bamboohr_id || "none"} onValueChange={(v) => setForm({ ...form, bamboohr_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Not mapped" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not mapped</SelectItem>
                  {bambooEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}{e.email ? ` — ${e.email}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suggested && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForm({ ...form, bamboohr_id: suggested.id })}
                >
                  Suggested match: {suggested.name} — use this
                </button>
              )}
              <p className="text-xs text-muted-foreground">Used to pull this member's time off when syncing quarterly availability.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            disabled={!form.name.trim() || (!showNewDiscipline && !form.discipline) || (showNewDiscipline && !newDiscipline.trim())}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}