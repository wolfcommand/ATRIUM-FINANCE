/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ReportExportButtons } from './ReportExportButtons';
import type { ReportExportFormat } from '../../utils/reportExport';
import {
  Printer,
  Download,
  X,
  FileText,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';;
import {
  printReportElement,
  downloadPrintableHtml,
  PrintOptions,
} from '../../utils/printManager';

interface UniversalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  category?: string;
  period?: string;
  property?: string;
  columnHeader?: string;
  children: React.ReactNode;
  onExportExcel?: (format?: ReportExportFormat) => void;
  defaultOrientation?: 'portrait' | 'landscape';
}

export const UniversalPrintModal: React.FC<UniversalPrintModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  category = 'Internal Financial Statements',
  period = '',
  property = 'PT ATRIUM MANAGEMENT GROUP',
  columnHeader,
  children,
  onExportExcel,
  defaultOrientation = 'portrait',
}) => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(defaultOrientation);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  useEffect(() => {
    setOrientation(defaultOrientation);
  }, [defaultOrientation, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const yearMatch = period?.match(/\d{4}/);
  const displayYear = yearMatch ? yearMatch[0] : String(currentYear);
  const finalColHeader = columnHeader || `${displayYear} (Rp)`;

  const periodText = period
    ? `For the period ${period} | (Presented in Rupiah)`
    : subtitle || `For the year ended 31 December ${displayYear} | (Presented in Rupiah)`;

  const handlePrint = () => {
    const options: PrintOptions = {
      title,
      subtitle,
      period,
      property,
      orientation,
    };

    const res = printReportElement('universal-modal-print-content', options);
    if (res.fallbackTriggered) {
      setFeedbackNotice('Downloaded print-ready file! Open it to print or save directly to PDF.');
      setTimeout(() => setFeedbackNotice(null), 6000);
    } else if (res.success) {
      setFeedbackNotice('Print dialog triggered. You can also print straight to PDF, or use the PDF export above.');
      setTimeout(() => setFeedbackNotice(null), 5000);
    } else {
      setFeedbackNotice('Could not open system dialog. Downloading standalone print-ready file.');
      downloadPrintableHtml(
        document.getElementById('universal-modal-print-content')?.innerHTML || '',
        options
      );
      setTimeout(() => setFeedbackNotice(null), 6000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      {/* Top Universal Print Action Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Document Title info */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-8 h-8 rounded-lg bg-slate-900/10/80 border border-emerald-800/60 flex items-center justify-center text-emerald-700 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide truncate max-w-sm sm:max-w-md">
                  {title}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/10/80 border border-emerald-800/50 text-emerald-700 uppercase">
                  A4 Print Preview
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {property} &bull; {period ? `Period: ${period}` : 'Full Ledger Year'}
              </p>
            </div>
          </div>

          {/* Quick Settings & Actions */}
          <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto">
            {/* Orientation Switcher */}
            <div className="flex items-center rounded-lg bg-white border border-slate-200 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  orientation === 'portrait'
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  orientation === 'landscape'
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Landscape
              </button>
            </div>

            {/* Report exports: PDF, CSV and Excel */}
            {onExportExcel && <ReportExportButtons onExport={onExportExcel} />}

            {/* Primary Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-xs transition-all"
              title="Open print dialog — select 'Save as PDF' to generate clean PDF directly"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white transition-colors ml-1"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback / Notification Bar */}
        {feedbackNotice && (
          <div className="mt-2 text-xs py-1.5 px-3 rounded-lg bg-slate-900/10/80 border border-emerald-800/60 text-emerald-700 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{feedbackNotice}</span>
            </div>
            <button onClick={() => setFeedbackNotice(null)} className="text-emerald-700 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Preview Viewport: Simulating authentic A4 paper sheet */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-white flex justify-center">
        <div
          className={`w-full bg-white text-black shadow-xs transition-all font-sans ${
            orientation === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'
          } min-h-[297mm] p-8 sm:p-14 border border-slate-300 rounded-sm relative`}
          id="universal-modal-print-content"
          style={{
            color: '#000000',
            backgroundColor: '#ffffff',
          }}
        >
          {/* Strict Modal Screen Scoped Stylesheet */}
          <style>{`
            #universal-modal-print-content {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              color: #000000 !important;
              background-color: #ffffff !important;
            }

            #universal-modal-print-content .header-top-rule {
              display: flex !important;
              justify-content: space-between !important;
              align-items: baseline !important;
              border-bottom: 1.5pt solid #000000 !important;
              padding-bottom: 4px !important;
              margin-bottom: 16px !important;
            }

            #universal-modal-print-content .header-col-rule {
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              border-top: 1pt solid #000000 !important;
              border-bottom: 1pt solid #000000 !important;
              padding: 4px 0 !important;
              margin-bottom: 10px !important;
              font-weight: 700 !important;
              font-size: 8.5pt !important;
            }

            /* Purge interactive clutter and non-printable elements from the on-screen modal preview */
            #universal-modal-print-content .print\:hidden,
            #universal-modal-print-content [class*="print:hidden"],
            #universal-modal-print-content .no-print,
            #universal-modal-print-content [class*="no-print"],
            #universal-modal-print-content .preview-hidden,
            #universal-modal-print-content [class*="preview-hidden"],
            #universal-modal-print-content .non-printable-col,
            #universal-modal-print-content [data-non-printable="true"],
            #universal-modal-print-content .header-col-inspect,
            #universal-modal-print-content [class*="inspect"],
            #universal-modal-print-content button,
            #universal-modal-print-content input,
            #universal-modal-print-content select,
            #universal-modal-print-content svg,
            #universal-modal-print-content .lucide {
              display: none !important;
            }

            /* Strip dark theme colors */
            #universal-modal-print-content * {
              background-color: transparent !important;
              color: #000000 !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }

            #universal-modal-print-content table {
              width: 100% !important;
              border-collapse: collapse !important;
            }

            #universal-modal-print-content th {
              border-bottom: 1.5pt solid #000000 !important;
              color: #000000 !important;
              padding: 4px !important;
              text-transform: uppercase !important;
            }

            #universal-modal-print-content td {
              border-bottom: 0.5pt solid #cbd5e1 !important;
              color: #000000 !important;
              padding: 3px 4px !important;
            }
          `}</style>

          {/* Top Rule Header: Company Name Left, Category Right */}
          <div className="mb-6">
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
                {category}
              </span>
            </div>

            {/* Centered Report Title */}
            <div className="text-center my-5 header-title-block" style={{ textAlign: 'center', margin: '14px 0' }}>
              <h1 className="text-base sm:text-lg font-black tracking-wide text-black uppercase mb-1" style={{ fontSize: '15pt', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>
                {title}
              </h1>
              <p className="text-xs text-black font-normal" style={{ fontSize: '8.5pt', color: '#000000', margin: 0 }}>
                {periodText}
              </p>
            </div>

            {/* Secondary Header Rule with Column Period */}
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

          {/* Clean Printable Content Body */}
          <div className="print-content-clean-body text-black">
            {children}
          </div>

          {/* Running Footer Rule */}
          <div className="mt-8 pt-2 border-t border-black flex justify-between items-center text-[10px] text-black font-sans">
            <div>
              <span className="font-bold">{property}</span>
              {period && <span> | For the period {period}</span>}
              <span className="ml-2 font-mono text-[9px] text-slate-500">
                (Generated: {new Date().toLocaleDateString('id-ID')})
              </span>
            </div>
            <div>Page 1 of 1</div>
          </div>
        </div>
      </div>
    </div>
  );
};
