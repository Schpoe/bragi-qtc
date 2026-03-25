import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Maps Tailwind color names (as stored on team.color) to hex values.
// Used for inline styles where CSS class names can't be applied dynamically.
export const teamColorHex = {
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#a855f7",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  slate: "#64748b",
  gray: "#6b7280",
  zinc: "#71717a",
  stone: "#78716c",
};

export const isIframe = window.self !== window.top;
