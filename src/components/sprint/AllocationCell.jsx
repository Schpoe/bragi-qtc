import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AllocationCell({ value, onChange, disabled }) {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleBlur = () => {
    const num = Number(localValue);
    if (localValue === "") {
      onChange(0);
      return;
    }
    if (isNaN(num)) {
      setLocalValue(value || "");
      return;
    }
    const clamped = Math.max(0, Math.min(100, num));
    onChange(clamped);
  };

  const numVal = Number(localValue) || 0;
  const bgColor = numVal === 0 ? "" : numVal <= 30 ? "bg-green-50" : numVal <= 70 ? "bg-amber-50" : "bg-red-50";

  return (
    <Input
      type="number"
      min={0}
      max={100}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn("w-16 h-8 text-center text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", bgColor)}
      placeholder="—"
    />
  );
}