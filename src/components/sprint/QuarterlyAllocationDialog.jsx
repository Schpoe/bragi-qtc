import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export default function QuarterlyAllocationDialog({ open, onOpenChange, quarter, teamId, onConfirm, initialSelectedIds = new Set() }) {
   const [selectedWorkAreaIds, setSelectedWorkAreaIds] = useState(new Set());
   const [searchQuery, setSearchQuery] = useState("");

   const { data: workAreas = [] } = useQuery({
     queryKey: ["workAreas"],
     queryFn: () => base44.entities.WorkArea.list(),
   });

   useEffect(() => {
     if (open) {
       setSelectedWorkAreaIds(new Set(initialSelectedIds));
     } else {
       setSelectedWorkAreaIds(new Set());
       setSearchQuery("");
     }
   }, [open, initialSelectedIds]);

  const handleSave = () => {
    onConfirm(new Set(selectedWorkAreaIds));
    onOpenChange(false);
  };

  const relevantWorkAreas = teamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.leading_team_id === teamId || wa.supporting_team_ids.includes(teamId));

  const leadingWAs = relevantWorkAreas.filter(wa => wa.leading_team_id === teamId);
  const supportingWAs = relevantWorkAreas.filter(wa => wa.supporting_team_ids?.includes(teamId) && wa.leading_team_id !== teamId);
  const otherWAs = workAreas.filter(wa => wa.leading_team_id !== teamId && !wa.supporting_team_ids?.includes(teamId));

  const filterBySearch = (items) => items.filter(wa => wa.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderWAItem = (wa) => (
   <div key={wa.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
     <Checkbox
       checked={selectedWorkAreaIds.has(wa.id)}
       onCheckedChange={(checked) => {
         const newSelection = new Set(selectedWorkAreaIds);
         if (checked) {
           newSelection.add(wa.id);
         } else {
           newSelection.delete(wa.id);
         }
         setSelectedWorkAreaIds(newSelection);
       }}
     />
     <span className="text-sm">{wa.name}</span>
   </div>
  );

  const filteredLeading = filterBySearch(leadingWAs);
  const filteredSupporting = filterBySearch(supportingWAs);
  const filteredOther = filterBySearch(otherWAs);

  let initialTab = "leading";
  if (leadingWAs.length === 0) {
    initialTab = supportingWAs.length > 0 ? "supporting" : "other";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Work Items for {quarter}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input 
              placeholder="Search work items..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {leadingWAs.length === 0 && supportingWAs.length === 0 && otherWAs.length === 0 ? (
            <p className="text-xs text-muted-foreground border rounded-md p-3">No work items available</p>
          ) : (
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="leading" disabled={leadingWAs.length === 0}>
                  Leading ({leadingWAs.length}{filteredLeading.length !== leadingWAs.length ? ` → ${filteredLeading.length}` : ""})
                </TabsTrigger>
                <TabsTrigger value="supporting" disabled={supportingWAs.length === 0}>
                  Supporting ({supportingWAs.length}{filteredSupporting.length !== supportingWAs.length ? ` → ${filteredSupporting.length}` : ""})
                </TabsTrigger>
                <TabsTrigger value="other" disabled={otherWAs.length === 0}>
                  Other ({otherWAs.length}{filteredOther.length !== otherWAs.length ? ` → ${filteredOther.length}` : ""})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="leading" className="border rounded-md p-3 max-h-56 overflow-y-auto">
                {filteredLeading.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No work items</p>
                ) : (
                  <div className="space-y-1">{filteredLeading.map(renderWAItem)}</div>
                )}
              </TabsContent>
              <TabsContent value="supporting" className="border rounded-md p-3 max-h-56 overflow-y-auto">
                {filteredSupporting.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No work items</p>
                ) : (
                  <div className="space-y-1">{filteredSupporting.map(renderWAItem)}</div>
                )}
              </TabsContent>
              <TabsContent value="other" className="border rounded-md p-3 max-h-56 overflow-y-auto">
                {filteredOther.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No work items</p>
                ) : (
                  <div className="space-y-1">{filteredOther.map(renderWAItem)}</div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Apply Selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}