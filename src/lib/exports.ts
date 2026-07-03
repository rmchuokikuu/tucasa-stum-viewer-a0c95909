import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


export type ExportRow = Record<string, string | number | null | undefined>;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV(rows: ExportRow[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export function exportExcel(rows: ExportRow[], filename: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// TUCASA brand colors (from official SVG letterhead)
const BRAND_PURPLE: [number, number, number] = [122, 45, 180];      // #7a2db4 side panel
const BRAND_PURPLE_DARK: [number, number, number] = [107, 53, 165]; // #6b35a5 text
const BRAND_BLUE_GREY: [number, number, number] = [138, 160, 200];  // #8aa0c8 logo border
const BRAND_LINE: [number, number, number] = [122, 61, 184];        // #7a3db8 underline

/**
 * Fetches an image from a URL and converts it to a base64 data URL.
 */
async function imageToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo image:', error);
    return '';
  }
}

/**
 * Draws the official TUCASA letterhead on the current page.
 * Replicates the attached SVG template (848x598 viewBox) and scales to A4 portrait/landscape.
 * Returns the Y coordinate at which body content can start.
 */
function drawTucasaHeader(doc: jsPDF, logoBase64?: string, sdaLogoBase64?: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header band height proportional to SVG (148 / 848 of width), clamped sensibly.
  const headerH = Math.min(38, pageW * (148 / 848) * 1.6);
  const sidePanelW = pageW * (104 / 848);

  // White header band
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Right purple side panel (runs full page height)
  doc.setFillColor(...BRAND_PURPLE);
  doc.rect(pageW - sidePanelW, 0, sidePanelW, pageH, 'F');

  // SDA logo at the top of the right sidebar
  const sidebarLogoW = 18;
  const sidebarLogoH = 18;
  const sidebarLogoX = pageW - sidePanelW + (sidePanelW - sidebarLogoW) / 2;
  const sidebarLogoY = 5;
  if (sdaLogoBase64) {
    try {
      doc.addImage(sdaLogoBase64, 'PNG', sidebarLogoX, sidebarLogoY, sidebarLogoW, sidebarLogoH);
    } catch (error) {
      console.error('Failed to add SDA logo image:', error);
    }
  }

  // Bottom purple underline of header
  doc.setDrawColor(...BRAND_LINE);
  doc.setLineWidth(0.6);
  doc.line(0, headerH, pageW - sidePanelW, headerH);

  // Logo box (left) - replaced with actual logo image
  const logoX = 10;
  const logoY = 5;
  const logoW = 18;
  const logoH = 22;
  
  if (logoBase64) {
    try {
      // Add the PCM logo image
      doc.addImage(logoBase64, 'PNG', logoX, logoY, logoW, logoH);
    } catch (error) {
      console.error('Failed to add logo image:', error);
      // Fallback to text box if image fails
      doc.setDrawColor(...BRAND_BLUE_GREY);
      doc.setLineWidth(0.8);
      doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'S');
      doc.setTextColor(...BRAND_LINE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('PCM', logoX + logoW / 2, logoY + logoH / 2 + 1.5, { align: 'center' });
    }
  } else {
    // Fallback to text box if no logo provided
    doc.setDrawColor(...BRAND_BLUE_GREY);
    doc.setLineWidth(0.8);
    doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, 'S');
    doc.setTextColor(...BRAND_LINE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PCM', logoX + logoW / 2, logoY + logoH / 2 + 1.5, { align: 'center' });
  }

  // Left title block
  doc.setTextColor(...BRAND_PURPLE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const leftX = logoX + logoW + 22;
  let ty = logoY + 3;
  ['Public Campus', 'Ministries', 'Seventh Day', 'Adventist Church'].forEach((line) => {
    doc.text(line, leftX, ty, { align: 'center' });
    ty += 4.2;
  });

  // Vertical divider
  const dividerX = leftX + 40;
  doc.setDrawColor(...BRAND_PURPLE_DARK);
  doc.setLineWidth(0.2);
  doc.line(dividerX, 3, dividerX, headerH - 3);

  // Right contact block
  const rightX = dividerX + 4;
  let ry = logoY + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Tanzania Universities and Colleges Adventist', rightX, ry); ry += 3.5;
  doc.text('Students Association (TUCASA)', rightX, ry); ry += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('P. O. Box 32555', rightX, ry); ry += 3.5;
  doc.text('Dar-es-Salaam - Tanzania.', rightX, ry); ry += 3.5;
  doc.text('E-Mail: tucasastum@gmail.com', rightX, ry);

  return headerH + 6;
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sidePanelW = pageW * (104 / 848);
  const usableW = pageW - sidePanelW;

  doc.setDrawColor(...BRAND_LINE);
  doc.setLineWidth(0.3);
  doc.line(8, pageH - 12, usableW - 4, pageH - 12);

  doc.setTextColor(...BRAND_PURPLE_DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Generated by TUCASA Membership System', 10, pageH - 7);
  doc.text(`Page ${pageNum} of ${totalPages}`, usableW - 6, pageH - 7, { align: 'right' });
}

export async function exportPDF(
  rows: ExportRow[],
  filename: string,
  title: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
) {
  if (rows.length === 0) return;
  
  // Load logo images as base64 from the public assets
  const logoBase64 = await imageToBase64('/PCM-logo.png');
  const sdaLogoBase64 = await imageToBase64('/SDA-logo.png');
  
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const sidePanelW = pageW * (104 / 848);
  const leftMargin = 10;
  const rightMargin = sidePanelW + 4;

  const headers = Object.keys(rows[0]);
  const generatedAt = new Date().toLocaleString();

  // Initial header + title block on first page
  const headerBottom = drawTucasaHeader(doc, logoBase64, sdaLogoBase64);

  // Report title
  doc.setTextColor(...BRAND_PURPLE_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, leftMargin, headerBottom + 4);
  doc.setDrawColor(...BRAND_LINE);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, headerBottom + 6, pageW - rightMargin, headerBottom + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Generated: ${generatedAt}`, leftMargin, headerBottom + 11);
  doc.text(`Records: ${rows.length}`, pageW - rightMargin, headerBottom + 11, { align: 'right' });

  const tableStartY = headerBottom + 15;

  autoTable(doc, {
    head: [headers],
    body: rows.map(r => headers.map(h => (r[h] == null ? '' : String(r[h])))),
    startY: tableStartY,
    margin: { left: leftMargin, right: rightMargin, top: 44, bottom: 18 },
    styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40] },
    headStyles: { fillColor: BRAND_PURPLE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 244, 252] },
    didDrawPage: (data) => {
      // Repeat letterhead on every page
      drawTucasaHeader(doc, logoBase64, sdaLogoBase64);
      if (data.pageNumber > 1) {
        // Compact title on continuation pages
        const hb = (doc.internal.pageSize.getWidth() * (148 / 848) * 1.6);
        doc.setTextColor(...BRAND_PURPLE_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${title} (continued)`, leftMargin, Math.min(38, hb) + 10);
      }
    },
  });

  // Footers with page numbers (after all pages exist)
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages);
  }

  doc.save(`${filename}.pdf`);
}
