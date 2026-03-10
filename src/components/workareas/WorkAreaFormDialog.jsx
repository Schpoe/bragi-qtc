import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const types = ["Produkt", "Feature", "Projekt", "Support/Maintenance"];
const areaColors = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#6366f1"
];

export default function WorkAreaFormDialog({ open, onOpenChange, workArea, teams, onSave }) {
  const [form, setForm] = useState({
    name: "", type: "Produkt", team_id: "", is_cross_team: true, color: areaColors[0]
  });

  useEffect(() => {
    if (workArea) {
      setForm({
        name: workArea.name,
        type: workArea.type,
        team_id: workArea.team_id || "",
        is_cross_team: workArea.is_cross_team ?? true,
        color: workArea.color || areaColors[0],
      });
    } else {
      setForm({ name: "", type: "Produkt", team_id: "", is_cross_team: true, color: areaColors[Math.floor(Math.random() * areaColors.length)] });
    }
  }, [workArea, open]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    const data = { ...form };
    if (data.is_cross_team) data.team_id = "";
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workArea ? "Bereich bearbeiten" : "Neuer Bereich"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Payment Feature" />
          </div>
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Teamübergreifend</Label>
            <Switch checked={form.is_cross_team} onCheckedChange={(v) => setForm({ ...form, is_cross_team: v })} />
          </div>
          {!form.is_cross_team && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                <SelectTrigger><SelectValue placeholder="Team wählen" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Farbe</Label>
            <div className="flex gap-2">
              {areaColors.map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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