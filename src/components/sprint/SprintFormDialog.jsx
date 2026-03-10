import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const currentYear = new Date().getFullYear();
const quarters = [];
for (let y = currentYear; y <= currentYear + 1; y++) {
  for (let q = 1; q <= 4; q++) {
    quarters.push(`Q${q} ${y}`);
  }
}

export default function SprintFormDialog({ open, onOpenChange, sprint, existingSprints, onSave }) {
  const [form, setForm] = useState({ name: "", quarter: quarters[0], start_date: "", end_date: "", order: 1 });

  useEffect(() => {
    if (sprint) {
      setForm({
        name: sprint.name,
        quarter: sprint.quarter,
        start_date: sprint.start_date || "",
        end_date: sprint.end_date || "",
        order: sprint.order || 1,
      });
    } else {
      const nextOrder = existingSprints ? existingSprints.length + 1 : 1;
      setForm({ name: `Sprint ${nextOrder}`, quarter: quarters[0], start_date: "", end_date: "", order: nextOrder });
    }
  }, [sprint, open, existingSprints]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sprint ? "Sprint bearbeiten" : "Neuer Sprint"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Sprint 1" />
          </div>
          <div className="space-y-2">
            <Label>Quartal</Label>
            <Select value={form.quarter} onValueChange={(v) => setForm({ ...form, quarter: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Startdatum</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Enddatum</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reihenfolge</Label>
            <Input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
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