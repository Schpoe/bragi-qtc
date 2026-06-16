import { useQuery } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";

/**
 * Fetches the Jira base URL (for building clickable issue links) once and caches it.
 * Returns { jiraBaseUrl, configured } — jiraBaseUrl is null when Jira isn't configured.
 */
export function useJiraConfig() {
  const { data } = useQuery({
    queryKey: ["jiraConfig"],
    queryFn: () => bragiQTC.functions.invoke("getJiraConfig"),
    staleTime: 1000 * 60 * 60, // 1h — the base URL rarely changes
  });
  return {
    jiraBaseUrl: data?.data?.jiraBaseUrl ?? null,
    configured: data?.data?.configured ?? false,
  };
}
