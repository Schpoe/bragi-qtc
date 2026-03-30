import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AllocationCell({ value, onChange, disabled }) {
  const [localValue, setLocalValue] = useState(value || "");
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const triggerSaved = () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  };

  const handleBlur = () => {
    const num = Number(localValue);
    if (localValue === "") {
      onChange(0);
      triggerSaved();
      return;
    }
    if (isNaN(num)) {
      setLocalValue(value || "");
      return;
    }
    const clamped = Math.max(0, num);
    onChange(clamped);
    triggerSaved();
  };

  return (
    <Input
      type="number"
      min={0}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(
        "w-16 h-8 text-center text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all",
        saved && "ring-1 ring-green-400 border-green-400"
      )}
      placeholder="—"
    />
  );
}
