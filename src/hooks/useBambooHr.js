import { useQuery } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";

// Whether BambooHR is configured on the backend (controls visibility of BambooHR UI).
export function useBambooHrConfig() {
  const { data } = useQuery({
    queryKey: ["bambooHrConfig"],
    queryFn: () => bragiQTC.functions.invoke("getBambooHrConfig"),
    staleTime: 1000 * 60 * 60,
  });
  return { configured: data?.data?.configured ?? false };
}

// BambooHR employee directory for the member-mapping picker. Only fetched when enabled.
export function useBambooHrDirectory(enabled = true) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bambooHrDirectory"],
    queryFn: () => bragiQTC.functions.invoke("getBambooHrDirectory"),
    enabled,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  return { employees: data?.data?.employees ?? [], isLoading, error };
}

export function useVacationRisk(teamId, enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ['vacationRisk', teamId],
    queryFn: () => bragiQTC.functions.invoke('getVacationRisk', { teamId }),
    enabled: enabled && !!teamId,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
  return { members: data?.data?.members ?? [], isLoading };
}
