import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const colors = [
  { value: "blue", label: "Blau", class: "bg-blue-500" },
  { value: "green", label: "Grün", class: "bg-emerald-500" },
  { value: "purple", label: "Lila", class: "bg-purple-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
];

export default function TeamFormDialog({ open, onOpenChange, team, onSave }) {
  const [form, setForm] = useState({ name: "", description: "", color: "blue" });

  useEffect(() => {
    if (team) {
      setForm({ name: team.name, description: team.description || "", color: team.color || "blue" });
    } else {
      setForm({ name: "", description: "", color: "blue" });
    }
  }, [team, open]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Team bearbeiten" : "Neues Team"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Mobile Team" />
          </div>
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Farbe</Label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`w-8 h-8 rounded-full ${c.class} transition-all ${form.color === c.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
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