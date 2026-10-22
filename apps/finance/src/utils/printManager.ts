/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrintOptions {
  title?: string;
  subtitle?: string;
  period?: string;
  property?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Robust DOM Sanitizer: Purges all interactive buttons ("Inspect >"),
 * "Accounts" and "Drill-Down" columns, internal verification banners,
 * and duplicate headers before generating print output or downloadable files.
 */
export function sanitizeReportHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // 1. Remove non-printable elements by explicit selectors
  const selectorsToRemove = [
    '.print-hidden',
    '.no-print',
    '.preview-hidden',
    '.non-printable-col',
    '[data-non-printable="true"]',
    '[class*="print:hidden"]',
    '[class*="no-print"]',
    '[class*="preview-hidden"]',
    'button',
    'input',
    'select',
    'svg',
    '.lucide',
    '.screen-toolbar',
    '.screen-instructions',
    '[class*="ring-"]',
  ];

  doc.querySelectorAll(selectorsToRemove.join(',')).forEach((el) => el.remove());

  // 1b. Remove any elements with class containing 'print:hidden' or 'no-print' directly via attribute check
  doc.querySelectorAll('*').forEach((el) => {
    const cls = el.getAttribute('class') || '';
    if (
      cls.includes('print:hidden') ||
      cls.includes('no-print') ||
      cls.includes('preview-hidden') ||
      cls.includes('non-printable-col') ||
      el.getAttribute('data-non-printable') === 'true'
    ) {
      el.remove();
    }
  });

  // 2. Remove all signature boxes, governance sign-off blocks, and empty file/signature placeholders
  doc.querySelectorAll('div, section, footer, p, span').forEach((el) => {
    const text = (el.textContent || '').trim().toLowerCase();
    const isSignBlock =
      text.includes('statutory & executive governance') ||
      text.includes('executive governance certification') ||
      text.includes('governance certification') ||
      text.includes('governance sign-off') ||
      (text.includes('prepared by') && text.includes('reviewed by')) ||
      (text.includes('chief accountant') && text.includes('financial controller')) ||
      (text.includes('prepared by') && text.includes('approved by')) ||
      (text.includes('supporting document') && text.includes('not attached')) ||
      (text.includes('folio pdf') && text.includes('attached')) ||
      text.includes('no electronic voucher');

    if (isSignBlock) {
      el.remove();
    }
  });

  // Also remove any remaining placeholder/dashed boxes (e.g. dashed borders, h-24 with border)
  doc.querySelectorAll('.grid-cols-4, [class*="h-24"], [class*="border-dashed"], [class*="border-dotted"]').forEach((el) => {
    const text = (el.textContent || '').toLowerCase();
    if (
      text.includes('chief accountant') ||
      text.includes('general manager') ||
      text.includes('prepared by') ||
      text.includes('reviewed by') ||
      text.includes('approved by') ||
      text.includes('director') ||
      text.includes('supporting document') ||
      text.includes('not attached') ||
      text.includes('voucher') ||
      text.includes('file')
    ) {
      el.remove();
    }
  });

  // 3. Remove table columns specifically meant for on-screen inspection or file placeholders:
  // e.g. "Accounts", "Drill-Down", "Inspect", "Actions", "Voucher Slip"
  doc.querySelectorAll('table').forEach((table) => {
    const colsToDelete = new Set<number>();

    // Inspect headers and all cells to identify non-printable column indices
    table.querySelectorAll('tr').forEach((row) => {
      Array.from(row.children).forEach((cell, idx) => {
        const text = (cell.textContent || '').trim().toLowerCase();
        if (
          text === 'accounts' ||
          text === 'drill-down' ||
          text === 'drilldown' ||
          text.includes('inspect') ||
          text === 'actions' ||
          text === 'action' ||
          text === 'voucher slip' ||
          text === 'voucher' ||
          text.includes('attachment') ||
          cell.classList.contains('non-printable-col') ||
          cell.getAttribute('data-non-printable') === 'true'
        ) {
          colsToDelete.add(idx);
        }
      });
    });

    // Delete identified columns from all rows (in reverse index order)
    if (colsToDelete.size > 0) {
      const sortedCols = Array.from(colsToDelete).sort((a, b) => b - a);
      table.querySelectorAll('tr').forEach((row) => {
        const cells = Array.from(row.children);
        for (const colIdx of sortedCols) {
          if (cells[colIdx]) {
            cells[colIdx].remove();
          }
        }
      });
    }

    // Determine the actual remaining table column count
    let actualColCount = 2;
    const firstRowWithCells = table.querySelector('thead tr, tbody tr');
    if (firstRowWithCells) {
      let count = 0;
      Array.from(firstRowWithCells.children).forEach((c) => {
        const span = parseInt(c.getAttribute('colspan') || '1', 10);
        count += isNaN(span) || span < 1 ? 1 : span;
      });
      if (count > 0 && count <= 10) {
        actualColCount = count;
      }
    }

    // Fix colSpan on category and subtotal rows to match actual column count
    table.querySelectorAll('td[colspan], th[colspan]').forEach((cell) => {
      const span = parseInt(cell.getAttribute('colspan') || '1', 10);
      if (span > actualColCount) {
        cell.setAttribute('colspan', String(actualColCount));
      }
    });
  });

  // 4. Remove duplicate on-screen card headers and equation verification banners
  doc.querySelectorAll('div').forEach((div) => {
    const text = (div.textContent || '').trim().toLowerCase();
    if (
      text.includes('accounting equation balanced') ||
      text.includes('balance sheet out of balance') ||
      text.includes('double-entry in balance') ||
      text.includes('trial balance is out of balance') ||
      text.includes('critical audit exception') ||
      text.includes('audit verification') ||
      text.includes('supporting document: not attached')
    ) {
      div.remove();
    }
  });

  // 5. Remove any duplicate inner card title blocks that mimic the formal letterhead
  doc.querySelectorAll('h2, h3').forEach((heading) => {
    const text = (heading.textContent || '').trim().toLowerCase();
    if (
      text === 'statement of financial position' ||
      text === 'statement of profit and loss' ||
      text === 'balance sheet' ||
      text === 'income statement' ||
      text.startsWith('usali 12')
    ) {
      const parent = heading.closest('div.border-b, div.bg-slate-950, div.bg-slate-900') || heading;
      parent.remove();
    }
  });

  // 6. Remove any remaining stray elements with text containing "Inspect" or arrow icons
  doc.querySelectorAll('td, th, span, a, p, div, button').forEach((el) => {
    const text = (el.textContent || '').trim();
    if (
      text.toLowerCase().includes('inspect') ||
      text.toLowerCase() === 'drill-down' ||
      text.toLowerCase() === 'drilldown'
    ) {
      // If it's a td/th, remove the whole cell; otherwise remove the element
      if (el.tagName === 'TD' || el.tagName === 'TH') {
        el.remove();
      } else {
        const parentCell = el.closest('td, th');
        if (parentCell && (parentCell.textContent || '').trim().toLowerCase().includes('inspect')) {
          parentCell.remove();
        } else {
          el.remove();
        }
      }
    }
  });

  // 7. Remove any empty table rows
  doc.querySelectorAll('tr').forEach((row) => {
    if (row.children.length === 0 || (row.textContent || '').trim() === '') {
      row.remove();
    }
  });

  return doc.body.innerHTML;
}

/**
 * Universal Corporate Accounting Print & Standalone Stylesheet
 * Completely self-contained: formats letterhead, typography, borders, and margins
 * without requiring any external CSS framework.
 */
export function getReportPrintStyles(orientation: 'portrait' | 'landscape' = 'portrait'): string {
  return `
    @page {
      size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin: 12mm 15mm 12mm 15mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      background-color: #ffffff !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 9.5pt !important;
      line-height: 1.35 !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }

    /* Core layout helpers for standalone rendering */
    .flex {
      display: flex !important;
    }
    .justify-between {
      justify-content: space-between !important;
    }
    .items-baseline {
      align-items: baseline !important;
    }
    .items-center {
      align-items: center !important;
    }
    .text-center {
      text-align: center !important;
    }
    .text-right {
      text-align: right !important;
    }
    .text-left {
      text-align: left !important;
    }
    .uppercase {
      text-transform: uppercase !important;
    }
    .font-bold {
      font-weight: 700 !important;
    }
    .font-extrabold, .font-black {
      font-weight: 800 !important;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    }
    .border-b {
      border-bottom: 1pt solid #000000 !important;
    }
    .border-t {
      border-top: 1pt solid #000000 !important;
    }
    .border-black {
      border-color: #000000 !important;
    }
    .w-full {
      width: 100% !important;
    }

    /* Universal Hide Rules */
    .print-hidden,
    .no-print,
    .preview-hidden,
    .non-printable-col,
    [data-non-printable="true"],
    .header-col-inspect,
    [class*="inspect"],
    [class*="drilldown"],
    .screen-toolbar,
    .screen-instructions,
    [class*="print:hidden"],
    [class*="no-print"],
    [class*="preview-hidden"],
    button,
    input,
    select,
    [role="button"],
    header.app-header,
    nav,
    aside,
    .sidebar {
      display: none !important;
    }

    /* Printable document wrapper */
    #report-printable-area,
    .printable-report-wrapper,
    #universal-modal-print-content {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      box-shadow: none !important;
      border: none !important;
    }

    /* Formal Accounting Letterhead Rules */
    .header-top-rule {
      display: flex !important;
      justify-content: space-between !important;
      align-items: baseline !important;
      border-bottom: 1.5pt solid #000000 !important;
      padding-bottom: 3pt !important;
      margin-bottom: 14pt !important;
      font-size: 8.5pt !important;
      font-weight: 700 !important;
      letter-spacing: 0.05em !important;
    }

    .header-title-block {
      text-align: center !important;
      margin: 12pt 0 14pt 0 !important;
    }

    .header-title-block h1 {
      font-size: 15pt !important;
      font-weight: 800 !important;
      text-transform: uppercase !important;
      margin: 0 0 3pt 0 !important;
      letter-spacing: 0.04em !important;
      color: #000000 !important;
    }

    .header-title-block p {
      font-size: 8.5pt !important;
      margin: 0 !important;
      color: #000000 !important;
      font-weight: 500 !important;
    }

    .header-col-rule {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-top: 1pt solid #000000 !important;
      border-bottom: 1pt solid #000000 !important;
      padding: 3.5pt 0 !important;
      margin-bottom: 8pt !important;
      font-weight: 700 !important;
      font-size: 8.5pt !important;
      text-transform: uppercase !important;
    }

    /* Strip dark colors and neon styling from all nested elements */
    #report-printable-area *,
    .printable-report-wrapper *,
    #universal-modal-print-content * {
      background-color: transparent !important;
      color: #000000 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    /* High-Fidelity Accounting Table Layout */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 4pt !important;
      margin-bottom: 10pt !important;
      page-break-inside: auto;
    }

    thead {
      display: table-header-group !important;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    th {
      border-bottom: 1.5pt solid #000000 !important;
      padding: 4pt 4pt !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      font-size: 8.5pt !important;
      color: #000000 !important;
    }

    td {
      padding: 3pt 4pt !important;
      font-size: 9pt !important;
      border-bottom: 0.5pt solid #cbd5e1 !important;
      color: #000000 !important;
    }

    /* Double-rule standard accounting lines */
    .accounting-subtotal-line,
    tr.accounting-subtotal-line td {
      border-top: 1pt solid #000000 !important;
      font-weight: 700 !important;
    }

    .accounting-grandtotal-line,
    tr.accounting-grandtotal-line td {
      border-top: 1pt solid #000000 !important;
      border-bottom: 3pt double #000000 !important;
      font-weight: 800 !important;
    }

    .page-break-avoid {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  `;
}

/**
 * Generates a complete standalone HTML document ready for direct browser printing / PDF generation
 */
export function generatePrintableHtml(
  contentHtml: string,
  options?: PrintOptions
): string {
  const orientation = options?.orientation || 'portrait';
  const cleanTitle = options?.title || 'Financial Statement — PT Atrium Management Group';
  const cleanContent = sanitizeReportHtml(contentHtml);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanTitle}</title>
  <style>
    ${getReportPrintStyles(orientation)}

    body {
      padding: 12mm 15mm;
      max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
      margin: 0 auto;
    }

    @media screen {
      body {
        background-color: #f8fafc !important;
        padding: 24px;
      }
      .paper-container {
        background-color: #ffffff !important;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 15mm;
        border-radius: 4px;
        max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
        margin: 0 auto;
      }
      .screen-toolbar {
        max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
        margin: 0 auto 12px auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #0f172a;
        color: #ffffff;
        padding: 10px 18px;
        border-radius: 8px;
        font-family: sans-serif;
      }
      .screen-toolbar button {
        background: #059669;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
      }
      .screen-toolbar button:hover {
        background: #047857;
      }
      .screen-instructions {
        max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
        margin: 0 auto 16px auto;
        padding: 8px 14px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        font-size: 11px;
        color: #1e40af;
        font-family: sans-serif;
      }
    }
  </style>
</head>
<body>
  <div class="screen-toolbar no-print" style="margin-bottom: 20px;">
    <div style="font-size: 13px;">
      <strong>PT ATRIUM MANAGEMENT GROUP</strong> &bull; Official A4 Financial Statement
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()">Print / Save as PDF</button>
      <button style="background: #475569;" onclick="window.close()">Close Window</button>
    </div>
  </div>

  <div class="paper-container printable-report-wrapper">
    ${cleanContent}
  </div>

  <script>
    // Auto-trigger print dialog after loading if user wants immediate print
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.warn('Auto print dialog blocked. Use the button above.', e);
        }
      }, 400);
    });
  </script>
</body>
</html>`;
}

/**
 * Downloads a standalone, pristine HTML document completely purged of interactive elements
 */
export function downloadPrintableHtml(
  rawContentHtml: string,
  options?: PrintOptions
): void {
  const title = options?.title || 'Financial_Report';
  const fullHtml = generatePrintableHtml(rawContentHtml, options);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_A4_Print.html`;
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Executes safe printing with clean sanitized DOM content, isolated iframe execution,
 * and sandbox detection.
 */
export function printReportElement(
  elementId: string,
  options?: PrintOptions
): { success: boolean; fallbackTriggered?: boolean; error?: string } {
  const el = document.getElementById(elementId);
  if (!el) {
    try {
      window.print();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Element not found' };
    }
  }

  // Purge all interactive and non-printable clutter from the DOM before printing
  const cleanContentHtml = sanitizeReportHtml(el.innerHTML);
  const orientation = options?.orientation || 'portrait';
  const docTitle = options?.title || 'Financial Statement — PT Atrium Management Group';

  // Strategy 1: Hidden Print iframe
  try {
    const existingFrame = document.getElementById('atrium-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'atrium-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${docTitle}</title>
          <style>${getReportPrintStyles(orientation)}</style>
        </head>
        <body>
          <div class="printable-report-wrapper">
            ${cleanContentHtml}
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 2500);
        } catch (iframeErr) {
          console.warn('Iframe print failed, falling back to window.print():', iframeErr);
          try {
            window.print();
          } catch (winErr) {
            console.warn('window.print() blocked by iframe sandbox. Downloading clean standalone HTML.');
            downloadPrintableHtml(cleanContentHtml, options);
          }
        }
      }, 350);

      return { success: true };
    }
  } catch (err: any) {
    console.warn('Hidden iframe print creation failed:', err);
  }

  // Strategy 2: Direct window.print()
  try {
    window.print();
    return { success: true };
  } catch (windowErr: any) {
    console.warn('Sandbox blocked window.print(). Providing standalone download.', windowErr);
    downloadPrintableHtml(cleanContentHtml, options);
    return { success: true, fallbackTriggered: true };
  }
}
