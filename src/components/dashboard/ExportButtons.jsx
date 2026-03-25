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
    const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });

    // Sheet 1: Team Summary
    const teamSummaryData = [
      [`Executive Summary - ${selectedQuarter}`],
      [`Exported: ${timestamp}`],
      [],
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
    const sprintData = [
      [`Sprint Breakdown - ${selectedQuarter}`],
      [`Exported: ${timestamp}`],
      [],
      ["Team", "Sprint", "Utilization %", "Over-allocated Members"]
    ];
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
    const disciplineData = [
      [`Discipline Breakdown - ${selectedQuarter}`],
      [`Exported: ${timestamp}`],
      [],
      ["Team", "Discipline", "Members", "Q Utilization %"]
    ];
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
    const workAreaData = [
      [`Top Work Areas - ${selectedQuarter}`],
      [`Exported: ${timestamp}`],
      [],
      ["Team", "Work Area", "Avg % per Sprint"]
    ];
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
    const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const rows = [
      ["Executive Summary", selectedQuarter, "Exported", timestamp],
      [],
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
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });
    const jsonData = {
      quarter: selectedQuarter,
      exportedAt: timestamp,
      exportDateISO: new Date().toISOString(),
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
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Executive_Summary_${selectedQuarter.replace(/ /g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
      const margin = 10;
      const contentWidth = pdfWidth - (2 * margin);
      const headerHeight = 18;
      const footerHeight = 10;
      const availableHeight = pdfHeight - headerHeight - footerHeight - (2 * margin);

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate how much content fits per page
      const imgWidth = contentWidth;
      const imgHeight = (canvasHeight * contentWidth) / canvasWidth;
      
      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 1;

      // Add first page with header
      const timestamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' });
      pdf.setFontSize(16);
      pdf.text(`Executive Summary - ${selectedQuarter}`, pdfWidth / 2, margin + 5, { align: "center" });
      pdf.setFontSize(9);
      pdf.text(`Exported: ${timestamp}`, pdfWidth / 2, margin + 11, { align: "center" });
      
      // Add first page content
      pdf.addImage(imgData, "PNG", margin, headerHeight + margin, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= availableHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pageNumber++;
        pdf.addImage(imgData, "PNG", margin, position + margin, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= availableHeight;
      }

      // Add footer to all pages
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.text(
          `Page ${i} of ${totalPages}`,
          pdfWidth / 2,
          pdfHeight - 5,
          { align: "center" }
        );
      }

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
          PDF (Multi-page)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}