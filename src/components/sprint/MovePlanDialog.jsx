import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Move (relocate) or copy (duplicate) a team's plan from the current quarter to another.
// The actual API call + cache invalidation lives in the parent via onConfirm.
export default function MovePlanDialog({ open, onOpenChange, teamName, fromQuarter, quarters = [], onConfirm, pending = false, error = null }) {
  const [mode, setMode] = useState("move");
  const [toQuarter, setToQuarter] = useState("");

  // Reset when reopened for a different source quarter.
  useEffect(() => {
    if (open) {
      setMode("move");
      setToQuarter("");
    }
  }, [open, fromQuarter]);

  const targetOptions = quarters.filter(q => q !== fromQuarter);
  const canConfirm = !!toQuarter && !pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move / copy plan</DialogTitle>
          <DialogDescription>
            {teamName} — <span className="font-medium">{fromQuarter}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup value={mode} onValueChange={setMode}>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="move" id="mode-move" className="mt-0.5" />
                <Label htmlFor="mode-move" className="font-normal leading-snug">
                  Move — relocate to the target quarter ({fromQuarter} is emptied)
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="copy" id="mode-copy" className="mt-0.5" />
                <Label htmlFor="mode-copy" className="font-normal leading-snug">
                  Copy — duplicate to the target quarter ({fromQuarter} is kept)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-quarter">Target quarter</Label>
            <Select value={toQuarter} onValueChange={setToQuarter}>
              <SelectTrigger id="target-quarter">
                <SelectValue placeholder="Select a quarter…" />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map(q => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={() => onConfirm({ mode, toQuarter })} disabled={!canConfirm}>
            {pending ? "Working…" : mode === "move" ? "Move plan" : "Copy plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
