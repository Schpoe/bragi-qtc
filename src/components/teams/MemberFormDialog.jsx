import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const disciplines = ["iOS", "Android", "Cloud", "QA", "Embedded"];

export default function MemberFormDialog({ open, onOpenChange, member, teamId, onSave }) {
  const [form, setForm] = useState({ name: "", discipline: "iOS", availability_percent: 100 });

  useEffect(() => {
    if (member) {
      setForm({ name: member.name, discipline: member.discipline, availability_percent: member.availability_percent || 100 });
    } else {
      setForm({ name: "", discipline: "iOS", availability_percent: 100 });
    }
  }, [member, open]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, team_id: teamId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Mitglied bearbeiten" : "Neues Mitglied"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vor- und Nachname" />
          </div>
          <div className="space-y-2">
            <Label>Bereich</Label>
            <Select value={form.discipline} onValueChange={(v) => setForm({ ...form, discipline: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Verfügbarkeit (%)</Label>
            <Input type="number" min={0} max={100} value={form.availability_percent} onChange={(e) => setForm({ ...form, availability_percent: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}