import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { exportCSV, exportExcel, exportPDF, type ExportRow } from '@/lib/exports';

export function ExportMenu({ rows, filename, title }: { rows: ExportRow[]; filename: string; title: string }) {
  const disabled = rows.length === 0;
  
  const handlePDFExport = async () => {
    try {
      await exportPDF(rows, filename, title);
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(rows, filename)}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportExcel(rows, filename)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDFExport}>
          <FileType className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
