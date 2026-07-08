import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import {
  exportCSV,
  exportExcel,
  exportPDF,
  exportLeaderReportPDF,
  exportLeaderReportExcel,
  exportLeaderExportCSV,
  exportLeaderExportExcel,
  exportLeaderExportPDF,
  type ExportRow,
  type LeaderReportData,
  type LeaderExportData,
} from '@/lib/exports';

interface ExportMenuProps {
  rows: ExportRow[];
  filename: string;
  title: string;
  triggerLabel?: string;
  /**
   * If provided, PDF and Excel exports produce the richer leader report
   * (summary counts + members grouped by sub-level). CSV still uses `rows`.
   */
  leaderReport?: LeaderReportData | null;
  leaderExport?: LeaderExportData | null;
}

export function ExportMenu({ rows, filename, title, triggerLabel = 'Export', leaderReport, leaderExport }: ExportMenuProps) {
  const disabled = rows.length === 0 && !leaderReport && !leaderExport;

  const handlePDFExport = async () => {
    try {
      if (leaderExport) {
        await exportLeaderExportPDF(leaderExport, filename);
      } else if (leaderReport) {
        await exportLeaderReportPDF(leaderReport, filename);
      } else {
        await exportPDF(rows, filename, title);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };

  const handleExcelExport = () => {
    try {
      if (leaderExport) {
        exportLeaderExportExcel(leaderExport, filename);
      } else if (leaderReport) {
        exportLeaderReportExcel(leaderReport, filename);
      } else {
        exportExcel(rows, filename);
      }
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => leaderExport ? exportLeaderExportCSV(leaderExport, filename) : exportCSV(rows, filename)} disabled={rows.length === 0 && !leaderExport}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcelExport}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDFExport}>
          <FileType className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
