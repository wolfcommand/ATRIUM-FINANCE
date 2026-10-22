/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Printer, Eye, X } from 'lucide-react';;
import { UniversalPrintModal } from './UniversalPrintModal';
import { ReportExportButtons } from './ReportExportButtons';
import type { ReportExportFormat } from '../../utils/reportExport';
import { printReportElement, downloadPrintableHtml } from '../../utils/printManager';

interface PrintableReportContainerProps {
  children: React.ReactNode;
  reportTitle: string;
  reportSubtitle?: string;
  reportCategory?: string;
  columnHeader?: string;
  period?: string;
  property?: string;
  documentRef?: string;
  orientation?: 'portrait' | 'landscape';
  showSignatures?: boolean;
  previewMode?: boolean;
  onExitPreview?: () => void;
  isPrintModalOpen?: boolean;
  onClosePrintModal?: () => void;
  onExportExcel?: (format?: ReportExportFormat) => void;
}

export const PrintableReportContainer: React.FC<PrintableReportContainerProps> = ({
  children,
  reportTitle,
  reportSubtitle,
  reportCategory = 'Internal Financial Statements',
  columnHeader,
  period = '',
  property = 'PT ATRIUM MANAGEMENT GROUP',
  documentRef,
  orientation = 'portrait',
  showSignatures = false,
  previewMode = false,
  onExitPreview,
  isPrintModalOpen,
  onClosePrintModal,
  onExportExcel,
}) => {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalActive = isPrintModalOpen !== undefined ? isPrintModalOpen : internalModalOpen;

  const handleCloseModal = () => {
    if (onClosePrintModal) {
      onClosePrintModal();
    }
    setInternalModalOpen(false);
  };

  // Listen to global print event triggered from toolbars or shortcut
  useEffect(() => {
    const handleGlobalPrint = () => {
      setInternalModalOpen(true);
    };
    window.addEventListener('atrium-open-print-preview', handleGlobalPrint);
    return () => window.removeEventListener('atrium-open-print-preview', handleGlobalPrint);
  }, []);

  const currentYear = new Date().getFullYear();
  const yearMatch = period?.match(/\d{4}/);
  const displayYear = yearMatch ? yearMatch[0] : String(currentYear);
  const finalColHeader = columnHeader || `${displayYear} (Rp)`;

  // Clean period subtitle
  const periodText = period
    ? `For the period ${period} | (Presented in Rupiah)`
    : reportSubtitle || `For the year ended 31 December ${displayYear} | (Presented in Rupiah)`;

  const handleDirectPrint = () => {
    printReportElement('report-printable-area', {
      title: reportTitle,
      subtitle: reportSubtitle,
      period,
      property,
      orientation: orientation as 'portrait' | 'landscape',
    });
  };

  const handleDirectDownload = () => {
    const el = document.getElementById('report-printable-area');
    if (el) {
      downloadPrintableHtml(el.innerHTML, {
        title: reportTitle,
        subtitle: reportSubtitle,
        period,
        property,
        orientation: orientation as 'portrait' | 'landscape',
      });
    }
  };

  return (
    <div className={`w-full ${previewMode ? 'bg-white p-3 sm:p-6 rounded-xl border border-slate-200' : ''}`}>
      {/* Strict Corporate Accounting Print & Screen Preview Stylesheet */}
      <style>{`
        @page {
          size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
          margin: 15mm 15mm 15mm 15mm;
        }

        /* SCREEN PREVIEW ACTIVE STYLES */
        .report-preview-active {
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }

        .report-preview-active *,
        .report-preview-active .bg-white,
        .report-preview-active .bg-white,
        .report-preview-active .bg-white\\/90,
        .report-preview-active .bg-white\\/60,
        .report-preview-active .bg-white\\/50,
        .report-preview-active .bg-white\\/40,
        .report-preview-active .bg-slate-900/10\\/40,
        .report-preview-active .bg-slate-900/10\\/50,
        .report-preview-active .bg-slate-900/10\\/60,
        .report-preview-active .bg-blue-950\\/40,
        .report-preview-active .bg-blue-950\\/50 {
          background-color: transparent !important;
          color: #0f172a !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .report-preview-active thead,
        .report-preview-active th {
          background-color: #f8fafc !important;
          color: #0f172a !important;
          border-bottom: 1.5pt solid #0f172a !important;
        }

        .report-preview-active td {
          border-bottom: 0.5pt solid #e2e8f0 !important;
          color: #0f172a !important;
        }

        .report-preview-active .text-emerald-700,
        .report-preview-active .text-emerald-700,
        .report-preview-active .text-emerald-700,
        .report-preview-active .text-slate-900,
        .report-preview-active .text-slate-700,
        .report-preview-active .text-slate-700,
        .report-preview-active .text-slate-500,
        .report-preview-active .text-slate-500,
        .report-preview-active .text-slate-500,
        .report-preview-active .text-red-600 {
          color: #0f172a !important;
        }

        .report-preview-active .border-slate-200,
        .report-preview-active .border-slate-200 {
          border-color: #e2e8f0 !important;
        }

        .report-preview-active .print\\:hidden,
        .report-preview-active [class*="print:hidden"],
        .report-preview-active .no-print,
        .report-preview-active [class*="no-print"],
        .report-preview-active .preview-hidden,
        .report-preview-active [class*="preview-hidden"],
        .report-preview-active .non-printable-col,
        .report-preview-active [data-non-printable="true"],
        .report-preview-active button,
        .report-preview-active input,
        .report-preview-active select,
        .report-preview-active svg.lucide,
        .report-preview-active .lucide,
        .report-preview-active .header-col-inspect,
        .report-preview-active [data-non-printable="true"] {
          display: none !important;
        }

        .report-preview-active .accounting-subtotal-line,
        .report-preview-active tr.accounting-subtotal-line td {
          border-top: 1pt solid #0f172a !important;
          font-weight: 700 !important;
        }

        .report-preview-active .accounting-grandtotal-line,
        .report-preview-active tr.accounting-grandtotal-line td {
          border-top: 1pt solid #0f172a !important;
          border-bottom: 3pt double #0f172a !important;
          font-weight: 800 !important;
        }

        @media print {
          /* 1. Global Reset: Hide browser navigation, sidebars, buttons, inspect columns */
          header, nav, aside, footer,
          .print\\:hidden,
          [class*="print:hidden"],
          .no-print,
          [class*="no-print"],
          .print-hidden,
          .preview-hidden,
          [class*="preview-hidden"],
          button,
          input,
          select,
          svg.lucide,
          .lucide,
          [role="navigation"],
          [role="banner"],
          .sidebar,
          #root > header,
          .non-printable-col,
          [data-non-printable="true"],
          .header-col-inspect {
            display: none !important;
          }

          /* 2. Paper Canvas: Pure white, standard sharp accounting font */
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            font-size: 10pt !important;
            line-height: 1.4 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #root, #root > div {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            min-height: auto !important;
          }

          /* 3. Document Flow */
          #report-printable-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* 4. Strip ALL theme colors, backgrounds, pills, and neon styles */
          #report-printable-area * {
            background-color: transparent !important;
            color: #000000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          /* High-fidelity accounting table layout */
          #report-printable-area table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          #report-printable-area thead {
            display: table-header-group !important;
          }

          #report-printable-area tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          #report-printable-area td,
          #report-printable-area th {
            padding-top: 2.5pt !important;
            padding-bottom: 2.5pt !important;
            border: none !important;
          }

          /* Hairlines and Double Underlines for Accounting Standard */
          #report-printable-area .accounting-subtotal-line {
            border-top: 1pt solid #000000 !important;
          }

          #report-printable-area .accounting-grandtotal-line {
            border-top: 1pt solid #000000 !important;
            border-bottom: 3pt double #000000 !important;
          }

          #report-printable-area .border-b,
          #report-printable-area .border-b-2,
          #report-printable-area .border-t,
          #report-printable-area .border-t-2 {
            border-color: #000000 !important;
          }

          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* When in preview mode, show an in-page quick action ribbon */}
      {previewMode && (
        <div className="mb-4 p-3 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-700">
              A4 Document Preview Active
            </span>
            <span className="text-slate-500 hidden sm:inline">
              &bull; Monochrome Formal Presentation
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInternalModalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Full Print Preview</span>
            </button>

            {onExportExcel && <ReportExportButtons onExport={onExportExcel} />}

            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-md font-medium transition-colors"
              >
                Exit Preview
              </button>
            )}
          </div>
        </div>
      )}

      {/* Target Container for Print and PDF Export */}
      <div
        id="report-printable-area"
        className={`w-full transition-all ${
          previewMode
            ? 'report-preview-active bg-white text-slate-900 p-8 sm:p-12 rounded-lg shadow-xs max-w-4xl mx-auto border border-slate-300 font-sans'
            : ''
        }`}
      >
        {/* ======================================================== */}
        {/* TOP HEADER RULE: Company Name Left, Category Right */}
        {/* ======================================================== */}
        <div className={`${previewMode ? 'block' : 'hidden print:block'} mb-6`}>
          <div
            className="flex items-baseline justify-between text-xs pb-1 border-b border-black header-top-rule"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderBottom: '1.5pt solid #000000',
              paddingBottom: '4px',
              marginBottom: '16px',
            }}
          >
            <span className="font-extrabold tracking-wide text-black text-sm uppercase">
              {property}
            </span>
            <span className="text-black font-medium text-xs">
              {reportCategory}
            </span>
          </div>

          {/* Centered Report Title Block */}
          <div className="text-center my-5 header-title-block" style={{ textAlign: 'center', margin: '14px 0' }}>
            <h1 className="text-base sm:text-lg font-black tracking-wide text-black uppercase mb-1" style={{ fontSize: '15pt', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>
              {reportTitle}
            </h1>
            <p className="text-xs text-black font-normal" style={{ fontSize: '8.5pt', color: '#000000', margin: 0 }}>
              {periodText}
            </p>
          </div>

          {/* Secondary Header Rule with Right-Aligned Column Period */}
          <div
            className="border-t border-black pt-1 pb-1 border-b border-black flex justify-between items-center text-xs font-bold text-black header-col-rule"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1pt solid #000000',
              borderBottom: '1pt solid #000000',
              paddingTop: '3.5px',
              paddingBottom: '3.5px',
              marginBottom: '10px',
              fontSize: '8.5pt',
              fontWeight: 700,
            }}
          >
            <span className="uppercase text-[11px] font-semibold tracking-wider">Line Item Description</span>
            <span className="text-right font-mono pr-2">{finalColHeader}</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* REPORT CONTENT BODY */}
        {/* ======================================================== */}
        <div className="report-body-content text-inherit">{children}</div>

        {/* ======================================================== */}
        {/* RUNNING FOOTER RULE: Company Name Left, Page Number Right */}
        {/* ======================================================== */}
        <div className={`${previewMode ? 'block' : 'hidden print:block'} mt-8 pt-2 border-t border-black flex justify-between items-center text-[10px] text-black font-sans`}>
          <div>
            <span className="font-bold">{property}</span>
            {period && <span> | For the period {period}</span>}
          </div>
          <div>Internal report</div>
        </div>
      </div>

      {/* Universal Print & PDF Preview Modal Attached to Every Container */}
      <UniversalPrintModal
        isOpen={isModalActive}
        onClose={handleCloseModal}
        title={reportTitle}
        subtitle={reportSubtitle}
        category={reportCategory}
        period={period}
        property={property}
        columnHeader={columnHeader}
        onExportExcel={onExportExcel}
        defaultOrientation={orientation}
      >
        <div className="report-preview-active">
          {children}
        </div>
      </UniversalPrintModal>
    </div>
  );
};
