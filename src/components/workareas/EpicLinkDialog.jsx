import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Link as LinkIcon } from "lucide-react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { toast } from "sonner";

export default function EpicLinkDialog({ open, onOpenChange, workArea, onLinked }) {
  const [epicKey, setEpicKey] = useState("");
  const [linking, setLinking] = useState(false);

  const handleLink = async () => {
    if (!epicKey.trim()) return;

    setLinking(true);
    try {
      const response = await bragiQTC.functions.invoke('linkJiraEpic', {
        workAreaId: workArea.id,
        epicKey: epicKey.trim().toUpperCase()
      });

      if (response.data.success) {
        toast.success(`Linked epic ${response.data.epicKey}`);
        setEpicKey("");
        onLinked?.();
        onOpenChange(false);
      } else {
        toast.error(response.data.error || 'Failed to link epic');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (key) => {
    const linkedEpics = (workArea.linked_epic_keys || []).filter(k => k !== key);
    
    try {
      await bragiQTC.entities.WorkArea.update(workArea.id, {
        linked_epic_keys: linkedEpics
      });
      toast.success(`Unlinked epic ${key}`);
      onLinked?.();
    } catch (error) {
      toast.error('Failed to unlink: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Jira Epics</DialogTitle>
          <DialogDescription>
            Link Jira epics to {workArea?.name} for sprint allocation tracking
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Currently linked epics */}
          {workArea?.linked_epic_keys?.length > 0 && (
            <div className="space-y-2">
              <Label>Linked Epics</Label>
              <div className="flex flex-wrap gap-2">
                {workArea.linked_epic_keys.map(key => (
                  <Badge key={key} variant="secondary" className="gap-2">
                    {key}
                    <button
                      onClick={() => handleUnlink(key)}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add new epic */}
          <div className="space-y-2">
            <Label>Add Epic Key</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., PROJ-123"
                value={epicKey}
                onChange={(e) => setEpicKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLink()}
              />
              <Button onClick={handleLink} disabled={!epicKey.trim() || linking}>
                <LinkIcon className="w-4 h-4 mr-2" />
                Link
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}