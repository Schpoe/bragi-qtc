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

// Returns the hex color for a team object. Use this everywhere instead of
// local color maps so all pages stay in sync.
export function getTeamColor(team) {
  if (!team?.color) return "#6b7280";
  return teamColorHex[team.color] ?? "#6b7280";
}

// Discipline colors — complete map covering all known disciplines.
export const disciplineColorHex = {
  iOS: "#3b82f6",
  Android: "#10b981",
  Cloud: "#8b5cf6",
  QA: "#f59e0b",
  Embedded: "#ef4444",
  Algo: "#06b6d4",
  "Test Automation": "#14b8a6",
  UX: "#d946ef",
  Frontend: "#f97316",
  Backend: "#6366f1",
};

export function getDisciplineColor(discipline) {
  return disciplineColorHex[discipline] ?? "#6b7280";
}

// Work Area Type colors — hash-based so any type name always gets the
// same color consistently across every component.
const TYPE_COLOR_PALETTE = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#6366f1", "#84cc16", "#f97316",
  "#14b8a6", "#a855f7",
];

export function getWorkAreaTypeColor(typeName) {
  if (!typeName) return "#6b7280";
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = (hash * 31 + typeName.charCodeAt(i)) & 0xffff;
  }
  return TYPE_COLOR_PALETTE[hash % TYPE_COLOR_PALETTE.length];
}

// Returns the color for a type name: prefers the stored color on the type record,
// falls back to hash-based assignment. Pass the workAreaTypes array when available.
export function resolveTypeColor(typeName, types = []) {
  const found = types.find(t => t.name === typeName);
  if (found?.color) return found.color;
  return getWorkAreaTypeColor(typeName);
}

// Returns the display color for a work area: uses its stored color if set,
// otherwise falls back to its type color.
export function getWorkAreaColor(wa, types = []) {
  if (wa?.color) return wa.color;
  return resolveTypeColor(wa?.type, types);
}

export const isIframe = window.self !== window.top;
