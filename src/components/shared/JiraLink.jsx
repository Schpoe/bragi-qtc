import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { jiraIssueUrl } from "@/lib/jira-links";

/**
 * Renders a Jira issue key as a link that opens the issue in a new tab.
 * Falls back to plain text (the key, or children) when no base URL is available
 * or the key isn't a valid Jira key.
 *
 * @param {object} props
 * @param {string} props.issueKey - e.g. "PROD-123"
 * @param {string|null} [props.baseUrl] - Jira base URL
 * @param {boolean} [props.showIcon] - show a small external-link icon
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.children] - custom label (defaults to the key)
 */
export default function JiraLink({ issueKey, baseUrl, showIcon = false, className, children }) {
  const url = jiraIssueUrl(baseUrl, issueKey);
  const label = children ?? issueKey;

  if (!url) {
    return <span className={className}>{label}</span>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open ${issueKey} in Jira`}
      className={cn(
        "inline-flex items-center gap-0.5 text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {label}
      {showIcon && <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />}
    </a>
  );
}
