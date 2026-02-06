/**
 * Report Export Utilities
 * CSV, Excel, and PDF export for reports
 */

// ============================================================================
// CSV Export
// ============================================================================

export function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerRow = headers.map(escape).join(',');
  const dataRows = rows.map((row) => row.map(escape).join(','));
  return [headerRow, ...dataRows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

// ============================================================================
// Excel Export
// ============================================================================

export async function generateExcelWorkbook(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto-size columns
    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map((row) => String(row[i] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadExcel(blob: Blob, filename: string): void {
  downloadFile(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// ============================================================================
// PDF Export
// ============================================================================

export async function generatePDFReport(config: {
  title: string;
  tenantName?: string;
  dateRange: string;
  kpis?: { label: string; value: string }[];
  tables: { title: string; headers: string[]; rows: string[][] }[];
}): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF('landscape', 'mm', 'a4');
  let y = 15;

  // Title
  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text(config.title, 14, y);
  y += 8;

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  if (config.tenantName) {
    doc.text(config.tenantName, 14, y);
    y += 5;
  }
  doc.text(config.dateRange, 14, y);
  y += 10;

  // KPIs
  if (config.kpis && config.kpis.length > 0) {
    doc.setFontSize(9);
    const kpiWidth = (doc.internal.pageSize.width - 28) / config.kpis.length;
    config.kpis.forEach((kpi, i) => {
      const x = 14 + i * kpiWidth;
      doc.setTextColor(107, 114, 128);
      doc.text(kpi.label, x, y);
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.text(kpi.value, x, y + 6);
      doc.setFontSize(9);
    });
    y += 16;
  }

  // Tables
  for (const table of config.tables) {
    if (y > doc.internal.pageSize.height - 30) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(table.title, 14, y);
    y += 2;

    autoTable(doc, {
      head: [table.headers],
      body: table.rows,
      startY: y,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  return doc.output('blob');
}

export function downloadPDF(blob: Blob, filename: string): void {
  downloadFile(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ============================================================================
// Generic Download Helper
// ============================================================================

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
