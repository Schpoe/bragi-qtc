import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileJson, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function QuarterlyExportButtons({
  teams,
  members,
  workAreas,
  quarterlyAllocations,
  selectedQuarter,
  selectedTeamId,
}) {
  const [exporting, setExporting] = useState(false);

  const quarterAllocs = useMemo(
    () => quarterlyAllocations.filter((a) => a.quarter === selectedQuarter),
    [quarterlyAllocations, selectedQuarter]
  );

  // Build the export data set for all relevant teams
  const exportData = useMemo(() => {
    const relevantTeams =
      selectedTeamId === "all" ? teams : teams.filter((t) => t.id === selectedTeamId);

    return relevantTeams.map((team) => {
      const teamMembers = members.filter((m) => m.team_id === team.id);
      const memberIds = new Set(teamMembers.map((m) => m.id));
      const teamAllocs = quarterAllocs.filter((a) => memberIds.has(a.team_member_id));

      // Member-level: total allocation and per-work-area breakdown
      const memberRows = teamMembers.map((m) => {
        const mAllocs = teamAllocs.filter((a) => a.team_member_id === m.id);
        const total = mAllocs.reduce((s, a) => s + a.percent, 0);
        const byWorkArea = mAllocs.map((a) => ({
          workArea: workAreas.find((wa) => wa.id === a.work_area_id)?.name ?? "Unknown",
          percent: a.percent,
        }));
        return { member: m, total, byWorkArea };
      });

      // Overall util: average total per member
      const overallUtil =
        teamMembers.length > 0
          ? Math.round(
              teamAllocs.reduce((s, a) => s + a.percent, 0) / teamMembers.length
            )
          : 0;

      // Discipline breakdown
      const disciplines = [...new Set(teamMembers.map((m) => m.discipline).filter(Boolean))];
      const disciplineBreakdown = disciplines.map((disc) => {
        const discMembers = teamMembers.filter((m) => m.discipline === disc);
        const discIds = new Set(discMembers.map((m) => m.id));
        const discAlloc = teamAllocs
          .filter((a) => discIds.has(a.team_member_id))
          .reduce((s, a) => s + a.percent, 0);
        const util =
          discMembers.length > 0 ? Math.round(discAlloc / discMembers.length) : 0;
        return { discipline: disc, util, memberCount: discMembers.length };
      });

      // Top work items
      const waMap = {};
      teamAllocs.forEach((a) => {
        waMap[a.work_area_id] = (waMap[a.work_area_id] || 0) + a.percent;
      });
      const topWorkItems = Object.entries(waMap)
        .map(([waId, total]) => ({
          name: workAreas.find((w) => w.id === waId)?.name ?? "Unknown",
          total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return { team, memberRows, overallUtil, disciplineBreakdown, topWorkItems };
    });
  }, [teams, members, workAreas, quarterAllocs, selectedTeamId]);

  const timestamp = () =>
    new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

  const filename = (ext) =>
    `Quarterly_Plan_${selectedQuarter.replace(/ /g, "_")}.${ext}`;

  // ── Excel ─────────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const ts = timestamp();

    // Sheet 1: Team Summary
    const teamRows = [
      [`Quarterly Plan — ${selectedQuarter}`],
      [`Exported: ${ts}`],
      [],
      ["Team", "Members", "Avg Allocation %"],
      ...exportData.map((d) => [d.team.name, d.memberRows.length, d.overallUtil]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teamRows), "Team Summary");

    // Sheet 2: Discipline Breakdown
    const discRows = [
      [`Discipline Breakdown — ${selectedQuarter}`],
      [`Exported: ${ts}`],
      [],
      ["Team", "Discipline", "Members", "Avg Allocation %"],
    ];
    exportData.forEach((d) =>
      d.disciplineBreakdown.forEach((db) =>
        discRows.push([d.team.name, db.discipline, db.memberCount, db.util])
      )
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(discRows), "Discipline Breakdown");

    // Sheet 3: Member Allocations
    const memberRows = [
      [`Member Allocations — ${selectedQuarter}`],
      [`Exported: ${ts}`],
      [],
      ["Team", "Member", "Discipline", "Work Area", "Allocation %"],
    ];
    exportData.forEach((d) =>
      d.memberRows.forEach(({ member, byWorkArea }) => {
        if (byWorkArea.length === 0) {
          memberRows.push([d.team.name, member.name, member.discipline ?? "", "—", 0]);
        } else {
          byWorkArea.forEach(({ workArea, percent }) =>
            memberRows.push([d.team.name, member.name, member.discipline ?? "", workArea, percent])
          );
        }
      })
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(memberRows), "Member Allocations");

    // Sheet 4: Top Work Items
    const waRows = [
      [`Top Work Items — ${selectedQuarter}`],
      [`Exported: ${ts}`],
      [],
      ["Team", "Work Item", "Total Allocation %"],
    ];
    exportData.forEach((d) =>
      d.topWorkItems.forEach((wi) => waRows.push([d.team.name, wi.name, wi.total]))
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(waRows), "Top Work Items");

    XLSX.writeFile(wb, filename("xlsx"));
  };

  // ── CSV ───────────────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    const ts = timestamp();
    const rows = [
      ["Quarterly Plan", selectedQuarter, "Exported", ts],
      [],
      ["Section", "Team", "Member", "Discipline", "Work Area", "Value"],
      ...exportData.flatMap((d) => [
        ["Team Summary", d.team.name, "", "", "", d.overallUtil],
        ...d.disciplineBreakdown.map((db) => [
          "Discipline",
          d.team.name,
          "",
          db.discipline,
          "",
          db.util,
        ]),
        ...d.memberRows.flatMap(({ member, byWorkArea }) =>
          byWorkArea.length > 0
            ? byWorkArea.map(({ workArea, percent }) => [
                "Member Allocation",
                d.team.name,
                member.name,
                member.discipline ?? "",
                workArea,
                percent,
              ])
            : [["Member Allocation", d.team.name, member.name, member.discipline ?? "", "—", 0]]
        ),
        ...d.topWorkItems.map((wi) => ["Top Work Item", d.team.name, "", "", wi.name, wi.total]),
      ]),
    ];

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename("csv");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── JSON ──────────────────────────────────────────────────────────────────────
  const exportToJSON = () => {
    const json = {
      quarter: selectedQuarter,
      exportedAt: timestamp(),
      exportDateISO: new Date().toISOString(),
      teams: exportData.map((d) => ({
        name: d.team.name,
        memberCount: d.memberRows.length,
        avgAllocationPercent: d.overallUtil,
        disciplines: d.disciplineBreakdown.map((db) => ({
          name: db.discipline,
          memberCount: db.memberCount,
          avgAllocationPercent: db.util,
        })),
        members: d.memberRows.map(({ member, total, byWorkArea }) => ({
          name: member.name,
          discipline: member.discipline,
          totalAllocationPercent: total,
          workAreas: byWorkArea,
        })),
        topWorkItems: d.topWorkItems,
      })),
    };

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename("json");
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("quarterly-plan-content");
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pdfWidth - 2 * margin;
      const headerHeight = 18;
      const footerHeight = 10;
      const availableHeight = pdfHeight - headerHeight - footerHeight - 2 * margin;

      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;

      const ts = timestamp();
      pdf.setFontSize(16);
      pdf.text(`Quarterly Plan — ${selectedQuarter}`, pdfWidth / 2, margin + 5, { align: "center" });
      pdf.setFontSize(9);
      pdf.text(`Exported: ${ts}`, pdfWidth / 2, margin + 11, { align: "center" });

      pdf.addImage(imgData, "PNG", margin, headerHeight + margin, contentWidth, imgHeight, undefined, "FAST");
      heightLeft -= availableHeight;

      let pageNumber = 1;
      while (heightLeft > 0) {
        const position = heightLeft - imgHeight;
        pdf.addPage();
        pageNumber++;
        pdf.addImage(imgData, "PNG", margin, position + margin, contentWidth, imgHeight, undefined, "FAST");
        heightLeft -= availableHeight;
      }

      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.text(`Page ${i} of ${totalPages}`, pdfWidth / 2, pdfHeight - 5, { align: "center" });
      }

      pdf.save(filename("pdf"));
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileText className="w-4 h-4 mr-2 text-blue-600" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileJson className="w-4 h-4 mr-2 text-orange-600" />
          JSON (.json)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2 text-red-600" />
          PDF (Multi-page)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
