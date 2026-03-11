import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const currentYear = new Date().getFullYear();
const quarters = [];
for (let y = currentYear; y <= currentYear + 1; y++) {
  for (let q = 1; q <= 4; q++) {
    quarters.push(`Q${q} ${y}`);
  }
}

export default function SprintFormDialog({ open, onOpenChange, sprint, existingSprints, teams, defaultTeamId, defaultQuarter, onSave }) {
  const [form, setForm] = useState({ name: "", quarter: quarters[0], team_id: "", is_cross_team: false, start_date: "", end_date: "", order: 1 });

  useEffect(() => {
    if (sprint) {
      setForm({
        name: sprint.name,
        quarter: sprint.quarter,
        team_id: sprint.team_id || "",
        is_cross_team: sprint.is_cross_team || false,
        start_date: sprint.start_date || "",
        end_date: sprint.end_date || "",
        order: sprint.order || 1,
      });
    } else {
      const nextOrder = existingSprints ? existingSprints.length + 1 : 1;
      setForm({
        name: `Sprint ${nextOrder}`,
        quarter: defaultQuarter || quarters[0],
        team_id: defaultTeamId || (teams && teams.length > 0 ? teams[0].id : ""),
        is_cross_team: false,
        start_date: "",
        end_date: "",
        order: nextOrder,
      });
    }
  }, [sprint, open, existingSprints, defaultTeamId, defaultQuarter]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (!form.is_cross_team && !form.team_id) return;
    const data = { ...form };
    if (data.is_cross_team) data.team_id = "";
    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sprint ? "Edit Sprint" : "New Sprint"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Cross-team Sprint</Label>
            <Switch checked={form.is_cross_team} onCheckedChange={(v) => setForm({ ...form, is_cross_team: v })} />
          </div>
          {!form.is_cross_team && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {(teams || []).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sprint 1" />
          </div>
          <div className="space-y-2">
            <Label>Quarter</Label>
            <Select value={form.quarter} onValueChange={(v) => setForm({ ...form, quarter: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Order</Label>
            <Input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || (!form.is_cross_team && !form.team_id)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}