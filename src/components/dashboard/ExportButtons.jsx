import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileJson, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export default function ExportButtons({ data, selectedQuarter }) {
  const [exporting, setExporting] = useState(false);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Team Summary
    const teamSummaryData = [
      ["Team", "Members", "Q Utilization %", "Status"],
      ...data.map(d => [
        d.team.name,
        d.teamMemberCount,
        d.quarterlyUtil,
        d.quarterlyUtil > 110 ? "Over-booked" : d.quarterlyUtil > 100 ? "At limit" : d.quarterlyUtil >= 80 ? "High load" : d.quarterlyUtil >= 50 ? "Healthy" : "Under-utilized"
      ])
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(teamSummaryData);
    XLSX.utils.book_append_sheet(workbook, ws1, "Team Summary");

    // Sheet 2: Sprint Breakdown
    const sprintData = [["Team", "Sprint", "Utilization %", "Over-allocated Members"]];
    data.forEach(d => {
      d.sprintStats.forEach(ss => {
        sprintData.push([
          d.team.name,
          ss.sprint.name,
          ss.utilPct,
          ss.overAllocated.length
        ]);
      });
    });
    const ws2 = XLSX.utils.aoa_to_sheet(sprintData);
    XLSX.utils.book_append_sheet(workbook, ws2, "Sprint Breakdown");

    // Sheet 3: Discipline Breakdown
    const disciplineData = [["Team", "Discipline", "Members", "Q Utilization %"]];
    data.forEach(d => {
      d.disciplineStats.forEach(ds => {
        disciplineData.push([
          d.team.name,
          ds.discipline,
          ds.memberCount,
          ds.utilPct
        ]);
      });
    });
    const ws3 = XLSX.utils.aoa_to_sheet(disciplineData);
    XLSX.utils.book_append_sheet(workbook, ws3, "Discipline Breakdown");

    // Sheet 4: Top Work Areas
    const workAreaData = [["Team", "Work Area", "Avg % per Sprint"]];
    data.forEach(d => {
      d.topWorkAreasQuarterly.forEach(wa => {
        workAreaData.push([
          d.team.name,
          wa.name,
          wa.avgPct
        ]);
      });
    });
    const ws4 = XLSX.utils.aoa_to_sheet(workAreaData);
    XLSX.utils.book_append_sheet(workbook, ws4, "Top Work Areas");

    XLSX.writeFile(workbook, `Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.xlsx`);
  };

  const exportToCSV = () => {
    const rows = [
      ["Section", "Team", "Metric", "Value"],
      ...data.flatMap(d => [
        ["Summary", d.team.name, "Members", d.teamMemberCount],
        ["Summary", d.team.name, "Q Utilization %", d.quarterlyUtil],
        ...d.sprintStats.map(ss => ["Sprint", d.team.name, ss.sprint.name, ss.utilPct]),
        ...d.disciplineStats.map(ds => ["Discipline", d.team.name, ds.discipline, ds.utilPct]),
        ...d.topWorkAreasQuarterly.map(wa => ["Work Area", d.team.name, wa.name, wa.avgPct])
      ])
    ];

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.csv`;
    link.click();
  };

  const exportToJSON = () => {
    const jsonData = {
      quarter: selectedQuarter,
      exportDate: new Date().toISOString(),
      teams: data.map(d => ({
        name: d.team.name,
        memberCount: d.teamMemberCount,
        quarterlyUtilization: d.quarterlyUtil,
        sprints: d.sprintStats.map(ss => ({
          name: ss.sprint.name,
          utilization: ss.utilPct,
          overAllocatedMembers: ss.overAllocated.length
        })),
        disciplines: d.disciplineStats.map(ds => ({
          name: ds.discipline,
          memberCount: ds.memberCount,
          utilization: ds.utilPct
        })),
        topWorkAreas: d.topWorkAreasQuarterly
      }))
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.json`;
    link.click();
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("executive-summary-content");
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;
      
      let width = pdfWidth - 20;
      let height = width / ratio;
      
      if (height > pdfHeight - 20) {
        height = pdfHeight - 20;
        width = height * ratio;
      }

      const xOffset = (pdfWidth - width) / 2;
      const yOffset = 10;

      // Add header
      pdf.setFontSize(16);
      pdf.text(`Executive Summary - ${selectedQuarter}`, pdfWidth / 2, yOffset, { align: "center" });
      
      // Add content
      pdf.addImage(imgData, "PNG", xOffset, yOffset + 10, width, height);
      
      // Add footer
      pdf.setFontSize(8);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pdfWidth / 2, pdfHeight - 5, { align: "center" });

      pdf.save(`Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
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
          PDF (A4)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}