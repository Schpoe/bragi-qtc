import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

export default function MemberFormDialog({ open, onOpenChange, member, teamId, onSave }) {
  const [form, setForm] = useState({ name: "", discipline: "", availability_percent: 100 });
  const [newDiscipline, setNewDiscipline] = useState("");
  const [showNewDiscipline, setShowNewDiscipline] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => bragiQTC.entities.TeamMember.list(),
  });

  const existingDisciplines = [...new Set(members.map(m => m.discipline).filter(Boolean))].sort();

  useEffect(() => {
    if (member) {
      setForm({ name: member.name, discipline: member.discipline, availability_percent: member.availability_percent || 100 });
    } else {
      setForm({ name: "", discipline: existingDisciplines[0] || "", availability_percent: 100 });
    }
    setNewDiscipline("");
    setShowNewDiscipline(false);
  }, [member, open]);

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
            <Label>Availability (%)</Label>
            <Input type="number" min={0} max={100} value={form.availability_percent} onChange={(e) => setForm({ ...form, availability_percent: Number(e.target.value) })} />
          </div>
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