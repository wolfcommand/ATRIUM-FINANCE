import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ReportExportFormat = 'pdf' | 'csv' | 'xlsx';
export type ReportCell = string | number | null | undefined;

export interface ReportSheet {
  name: string;
  title: string;
  subtitle?: string;
  period?: string;
  property?: string;
  headers: string[];
  rows: ReportCell[][];
  colWidths?: number[];
}

const company = 'PT ATRIUM MANAGEMENT GROUP';
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const amountFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isAmount = (header: string) => /\b(rp|idr|amount|cost|price|revenue|expense|payout|distribution|balance|value|payable|return|deduction|tax|fund|fee|reserve|guarantee|shortfall|excess|installment)\b/i.test(header);

/** A report with no rows at all, e.g. an unfiltered ledger period. */
const isEmptyReport = (rows: ReportCell[][]) => rows.length === 0;
const emptyNotice = 'No records available for the selected filters.';

/**
 * Appends a totals line in place, and only when there are records to total, so an
 * empty dataset never shows a lone zero row. Mutates and returns the array, so it
 * must not be combined with a spread of its own result.
 */
export function withTotal<Row extends ReportCell>(rows: Row[][], total: Row[]): Row[][] {
  if (rows.length) rows.push(total);
  return rows;
}

export function reportFilename(filename: string, extension: string) {
  return `${filename.replace(/\.(xlsx|csv|pdf)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'Report'}.${extension}`;
}

function download(filename: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to finish consuming the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function csvCell(value: ReportCell): string {
  let text = value == null ? '' : String(value);
  // Keep text as text when opened in a spreadsheet (numeric negatives stay numeric).
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** RFC 4180 escaping, UTF-8 BOM, and raw numeric values for spreadsheet import. */
export function reportCsv(sheet: ReportSheet): string {
  const rows = isEmptyReport(sheet.rows) ? [[emptyNotice]] : sheet.rows;
  return '\uFEFF' + [sheet.headers, ...rows].map(row =>
    sheet.headers.map((_, index) => csvCell(row[index])).join(',')
  ).join('\r\n') + '\r\n';
}

export function reportWorkbook(sheets: ReportSheet[], generatedAt = new Date()) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet, index) => {
    const metadata = [sheet.period && `Period: ${sheet.period}`, sheet.subtitle].filter(Boolean).join(' | ');
    const rows = [
      [sheet.property || company], [sheet.title], [metadata],
      [`Generated: ${generatedAt.toLocaleString()}`], [], sheet.headers,
      ...sheet.rows.map(row => sheet.headers.map((_, i) => row[i] ?? null)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = sheet.headers.map((header, i) => ({
      wch: sheet.colWidths?.[i] || Math.min(50, sheet.rows.reduce((width, row) => Math.max(width, String(row[i] ?? '').length + 2), Math.max(12, header.length + 2))),
    }));
    ws['!merges'] = [0, 1, 2, 3].filter(() => sheet.headers.length > 1).map(r => ({ s: { r, c: 0 }, e: { r, c: sheet.headers.length - 1 } }));
    sheet.rows.forEach((row, r) => row.forEach((value, c) => {
      if (typeof value === 'number') {
        const cell = ws[XLSX.utils.encode_cell({ r: r + 6, c })];
        if (cell) cell.z = isAmount(sheet.headers[c] || '') ? '#,##0.00;(#,##0.00);"-"' : '#,##0.####;(#,##0.####);0';
      }
    }));
    let name = sheet.name.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || `Report ${index + 1}`;
    const base = name;
    let suffix = 2;
    while (workbook.SheetNames.some(n => n.toLowerCase() === name.toLowerCase())) name = `${base.slice(0, 27)} ${suffix++}`;
    XLSX.utils.book_append_sheet(workbook, ws, name);
  });
  return workbook;
}

/** Vector text/tables, repeated headers, restrained rules and real page numbering. */
export function reportPdf(sheets: ReportSheet[], generatedAt = new Date()) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: sheets[0]?.title || 'Report', author: sheets[0]?.property || company, creator: 'Atrium Finance' });
  const pageProperties: string[] = [];

  sheets.forEach((sheet, sheetIndex) => {
    // Very wide reports are split into readable panels with identifying columns repeated.
    const panels: number[][] = [];
    const all = sheet.headers.map((_, i) => i);
    if (all.length > 10) {
      for (let i = 2; i < all.length; i += 7) panels.push([0, 1, ...all.slice(i, i + 7)]);
    } else panels.push(all);

    panels.forEach((columns, panelIndex) => {
      const orientation = columns.length > 5 ? 'landscape' : 'portrait';
      if (sheetIndex || panelIndex) doc.addPage('a4', orientation);
      else {
        doc.deletePage(1);
        doc.addPage('a4', orientation);
      }
      const width = doc.internal.pageSize.getWidth();
      const available = width - 30;
      const drawHeader = () => {
        doc.setTextColor(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(sheet.property || company, 15, 13);
        doc.setDrawColor(80);
        doc.setLineWidth(0.25);
        doc.line(15, 16, width - 15, 16);
        doc.setFontSize(13);
        const title = doc.splitTextToSize(sheet.title, available);
        doc.text(title, 15, 24);
        let y = 24 + (title.length - 1) * 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const metadata = [sheet.period && `Period: ${sheet.period}`, sheet.subtitle, panels.length > 1 && `Column group ${panelIndex + 1} of ${panels.length}`].filter(Boolean).join(' | ');
        if (metadata) {
          const lines = doc.splitTextToSize(metadata, available);
          y += 5;
          doc.text(lines, 15, y);
          y += (lines.length - 1) * 3.5;
        }
        return y + 6;
      };
      const headerTop = drawHeader();
      let firstPage = true;
      const weights = columns.map(c => sheet.colWidths?.[c] || 18);
      const weightTotal = weights.reduce((sum, w) => sum + w, 0);
      autoTable(doc, {
        startY: headerTop,
        margin: { top: headerTop, bottom: 18, left: 15, right: 15 },
        head: [columns.map(c => sheet.headers[c])],
        body: sheet.rows.length && !isEmptyReport(sheet.rows)
          ? sheet.rows.map(row => columns.map(c => {
              const value = row[c];
              if (typeof value !== 'number') return String(value ?? '');
              const formatted = (isAmount(sheet.headers[c]) ? amountFormat : numberFormat).format(Math.abs(value));
              return value < 0 ? `(${formatted})` : formatted;
            }))
          : [[{ content: emptyNotice, colSpan: columns.length }]],
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 8, textColor: 25, cellPadding: 2, overflow: 'linebreak', lineColor: 215, lineWidth: { bottom: 0.1 }, valign: 'middle' },
        headStyles: { fillColor: 242, textColor: 20, fontStyle: 'bold', lineColor: 100, lineWidth: { bottom: 0.3 } },
        columnStyles: Object.fromEntries(columns.map((c, i) => [i, {
          cellWidth: available * weights[i] / weightTotal,
          halign: sheet.rows.some(row => typeof row[c] === 'number') ? 'right' : 'left',
        }])),
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        willDrawPage: () => {
          // The letterhead is already on the opening page; later pages repeat it above their table.
          if (firstPage) firstPage = false;
          else drawHeader();
        },
        didParseCell: data => {
          if (data.section !== 'body') return;
          const row = sheet.rows[data.row.index];
          if (!row) return;
          const label = row.find(value => typeof value === 'string' && value.trim());
          const section = row.filter(value => value !== '' && value != null).length === 1;
          if (section || (typeof label === 'string' && /^(total|net |gross |ebitda|income before)/i.test(label.trim()))) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.lineWidth = { top: 0.25, bottom: 0.1 };
            data.cell.styles.lineColor = 100;
          }
        },
        didDrawPage: () => { pageProperties[doc.getNumberOfPages() - 1] = sheet.property || company; },
      });
    });
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const y = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(150);
    doc.setLineWidth(0.15);
    doc.line(15, y - 4, width - 15, y - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.text(`Generated ${generatedAt.toLocaleString()} | ${pageProperties[page - 1] || company}`, 15, y);
    doc.text(`Page ${page} of ${pages}`, width - 15, y, { align: 'right' });
  }
  return doc;
}

export function exportReport(filename: string, sheets: ReportSheet[], format: ReportExportFormat = 'xlsx') {
  if (!sheets.length || sheets.some(sheet => !sheet.headers.length)) throw new Error('No report is available to export.');
  if (format === 'pdf') {
    reportPdf(sheets).save(reportFilename(filename, 'pdf'));
  } else if (format === 'csv') {
    // A single download avoids browsers blocking subsequent files. Multi-section CSVs
    // use named sections and their own headers, retaining every report in the workbook.
    const csv = sheets.length === 1 ? reportCsv(sheets[0]) : '\uFEFF' + sheets.map(sheet =>
      [csvCell(sheet.title), reportCsv(sheet).replace(/^\uFEFF/, '').trimEnd()].join('\r\n')
    ).join('\r\n\r\n') + '\r\n';
    download(reportFilename(filename, 'csv'), new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  } else {
    XLSX.writeFile(reportWorkbook(sheets), reportFilename(filename, 'xlsx'));
  }
}
