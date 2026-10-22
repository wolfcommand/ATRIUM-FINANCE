/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Sliders,
} from 'lucide-react';;
import { FinancialStatementsReport, ReportLineItem } from '../../types';
import { api } from '../../services/api';
import { UniversalReportToolbar } from './UniversalReportToolbar';
import { UniversalDrilldownModal } from './UniversalDrilldownModal';
import { PrintableReportContainer } from './PrintableReportContainer';
import { formatAmount, getThemeClasses, getDensityClasses } from '../../utils/reportFormatter';
import { createReportExporter, ReportExportFormat } from '../../utils/excelExporter';

interface FinancialStatementsViewProps {
  onOpenJournalInWorkbench?: (journalId: string) => void;
}

export const FinancialStatementsView: React.FC<FinancialStatementsViewProps> = ({
  onOpenJournalInWorkbench,
}) => {
  const [period, setPeriod] = useState<string>('');
  const [property, setProperty] = useState<string>('PT Atrium Management Group');
  const [activeTab, setActiveTab] = useState<'balance-sheet' | 'income-statement'>('balance-sheet');
  const [report, setReport] = useState<FinancialStatementsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Listen for atrium-open-print-preview event to switch into print mode
  useEffect(() => {
    const handleOpenPreview = () => setPreviewMode(true);
    window.addEventListener('atrium-open-print-preview', handleOpenPreview);
    return () => window.removeEventListener('atrium-open-print-preview', handleOpenPreview);
  }, []);

  // Drilldown modal state
  const [drilldownLineId, setDrilldownLineId] = useState<string | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const fetchReport = (selectedPeriod?: string) => {
    setLoading(true);
    api
      .getFinancialStatements(selectedPeriod || undefined)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load financial statements:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const handleDrilldown = (lineId: string) => {
    setDrilldownLineId(lineId);
    setIsDrilldownOpen(true);
  };

  const handleExportCsv = () => {
    if (!report) return;
    const lines: string[] = [];
    if (activeTab === 'balance-sheet') {
      lines.push(`"Statement of Financial Position (Balance Sheet)"`);
      lines.push(`"Property:","${property}"`);
      lines.push(`"Period:","${period || 'All Time'}"`);
      lines.push(`"Generated:","${new Date().toISOString()}"`);
      lines.push('');
      lines.push(`"Category","Line Item","Amount (IDR)","Accounts Mapped"`);

      lines.push(`"Assets"`);
      report.balance_sheet.assets.forEach((r) => {
        lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
      });
      lines.push(`,"Total Assets",${report.balance_sheet.total_assets}`);
      lines.push('');

      lines.push(`"Liabilities"`);
      report.balance_sheet.liabilities.forEach((r) => {
        lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
      });
      lines.push(`,"Total Liabilities",${report.balance_sheet.total_liabilities}`);
      lines.push('');

      lines.push(`"Equity"`);
      report.balance_sheet.equity.forEach((r) => {
        lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
      });
      lines.push(`,"Total Equity",${report.balance_sheet.total_equity}`);
      lines.push(`,"Total Liabilities & Equity",${report.balance_sheet.total_liabilities_and_equity}`);
    } else {
      lines.push(`"Statement of Profit & Loss (Income Statement)"`);
      lines.push(`"Property:","${property}"`);
      lines.push(`"Period:","${period || 'All Time'}"`);
      lines.push(`"Generated:","${new Date().toISOString()}"`);
      lines.push('');
      lines.push(`"Category","Line Item","Amount (IDR)","Accounts Mapped"`);

      lines.push(`"Revenue"`);
      report.income_statement.operating_revenue.forEach((r) => {
        lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
      });
      lines.push(`,"Total Revenue",${report.income_statement.total_revenue}`);
      lines.push('');

      lines.push(`"Expenses"`);
      report.income_statement.operating_expenses.forEach((r) => {
        lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
      });
      lines.push(`,"Total Expenses",${report.income_statement.total_expenses}`);
      lines.push(`,"Net Operating Income",${report.income_statement.net_income}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${activeTab === 'balance-sheet' ? 'Balance_Sheet' : 'Income_Statement'}_${period || 'All_Time'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!report) return;

    // Sheet 1: Balance Sheet
    const bsRows: (string | number)[][] = [
      ['CURRENT & NON-CURRENT ASSETS', ''],
      ...report.balance_sheet.assets.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Assets', report.balance_sheet.total_assets],
      ['', ''],
      ['LIABILITIES', ''],
      ...report.balance_sheet.liabilities.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Liabilities', report.balance_sheet.total_liabilities],
      ['', ''],
      ['EQUITY', ''],
      ...report.balance_sheet.equity.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Equity', report.balance_sheet.total_equity],
      ['', ''],
      ['TOTAL LIABILITIES & EQUITY', report.balance_sheet.total_liabilities_and_equity],
    ];

    // Sheet 2: Income Statement
    const isRows: (string | number)[][] = [
      ['OPERATING REVENUE', ''],
      ...report.income_statement.operating_revenue.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Operating Revenue', report.income_statement.total_operating_revenue ?? 0],
      ['', ''],
      ...(report.income_statement.cost_of_sales && report.income_statement.cost_of_sales.length > 0
        ? [
            ['COST OF SALES', ''],
            ...report.income_statement.cost_of_sales.map((r) => [`   ${r.label}`, r.amount]),
            ['Total Cost of Sales', report.income_statement.total_cost_of_sales ?? 0],
            ['GROSS PROFIT', report.income_statement.gross_profit ?? 0],
            ['', ''],
          ]
        : []),
      ['OPERATING EXPENSES', ''],
      ...report.income_statement.operating_expenses.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Operating Expenses', report.income_statement.total_operating_expenses ?? 0],
      ['', ''],
      ['NET OPERATING INCOME', report.income_statement.net_operating_income ?? 0],
    ];

    createReportExporter(format)(
      `Financial_${activeTab}_${property.replace(/\s+/g, '_')}_${period || 'All_Time'}.xlsx`,
      [
        {
          name: 'Balance Sheet',
          property,
          title: 'STATEMENT OF FINANCIAL POSITION',
          period: period || 'All Time',
          headers: ['Statement Line Item', 'Amount (Rp)'],
          rows: bsRows,
          colWidths: [45, 20],
        },
        {
          name: 'Income Statement',
          property,
          title: 'STATEMENT OF PROFIT AND LOSS',
          period: period || 'All Time',
          headers: ['Statement Line Item', 'Amount (Rp)'],
          rows: isRows,
          colWidths: [45, 20],
        },
      ].filter((_, index) => index === (activeTab === 'balance-sheet' ? 0 : 1))
    );
  };

  return (
    <div className="space-y-6">
      {/* Universal Report Toolbar */}
      <UniversalReportToolbar
        reportTitle="Financial Statements"
        reportSubtitle="Audited Balance Sheet & Income Statement strictly calculated from POSTED General Ledger"
        period={period}
        onPeriodChange={setPeriod}
        property={property}
        onPropertyChange={setProperty}
        onRefresh={() => fetchReport(period)}
        onExportCsv={handleExportCsv}
        onExportExcel={handleExportExcel}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode(!previewMode)}
        loading={loading}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('balance-sheet')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'balance-sheet'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Statement of Financial Position (Balance Sheet)</span>
        </button>
        <button
          onClick={() => setActiveTab('income-statement')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'income-statement'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Statement of Profit & Loss (Income Statement)</span>
        </button>
      </div>

      {/* Main Content */}
      {report && (
        <PrintableReportContainer
          reportTitle={
            activeTab === 'balance-sheet'
              ? 'Statement of Financial Position (Balance Sheet)'
              : 'Statement of Profit and Loss (Income Statement)'
          }
          reportSubtitle={
            activeTab === 'balance-sheet'
              ? 'Audited Assets, Liabilities & Equity • Indonesian Financial Accounting Standards (SAK)'
              : 'Operating Revenues, Expenses & Net Operating Income • USALI 12 Aligned'
          }
          period={period}
          property={property}
          columnHeader={`Period: ${period || 'All Available Posted'} (IDR)`}
          orientation="portrait"
          showSignatures={false}
          previewMode={previewMode}
          onExitPreview={() => setPreviewMode(false)}
          onExportExcel={handleExportExcel}
        >
          <div className="bg-white/90 border border-slate-200 rounded-xl overflow-hidden shadow-xs print:border-none print:shadow-none print:rounded-none">
            {/* Header (Hidden on preview and print) */}
            {!previewMode && (
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between print:hidden">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    {property}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeTab === 'balance-sheet'
                      ? 'Statement of Financial Position'
                      : 'Statement of Profit and Loss'}
                  </h2>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Period: <strong className="text-slate-700">{period || 'All Available Posted Periods'}</strong>
                </div>
              </div>
            )}

            <div className="p-6 overflow-x-auto print:p-0">
            {/* BALANCE SHEET TAB */}
            {activeTab === 'balance-sheet' && (
              <div className="space-y-8">
                {/* Balance verification banner (Hidden on preview and print) */}
                {!previewMode && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 font-mono text-xs print:hidden">
                    <div className="flex items-center gap-2">
                      {report.balance_sheet.is_balanced ? (
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span className="font-semibold">
                            Accounting Equation Balanced: Assets = Liabilities + Equity
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-300">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="font-semibold">
                            Balance Sheet Out of Balance by {formatAmount(report.balance_sheet.variance ?? 0, report.formatting)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-slate-500">Total Assets: </span>
                        <span className="font-bold text-slate-700">
                          {formatAmount(report.balance_sheet.total_assets, report.formatting)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Liabilities + Equity: </span>
                        <span className="font-bold text-slate-700">
                          {formatAmount(report.balance_sheet.total_liabilities_and_equity, report.formatting)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Variance: </span>
                        <span className={report.balance_sheet.is_balanced ? 'text-emerald-700 font-bold' : 'text-red-400 font-bold'}>
                          {formatAmount(report.balance_sheet.variance ?? 0, report.formatting)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <table className="w-full text-xs font-mono print:text-sm print:font-sans">
                  <thead className="bg-white/60 text-slate-500 uppercase tracking-wider border-b border-slate-200 print:hidden">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Line Item</th>
                      <th className="py-2.5 px-4 text-right">Amount ({report.formatting?.currency_symbol || 'IDR'})</th>
                      {!previewMode && <th data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">Accounts</th>}
                      {!previewMode && <th data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">Drill-Down</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-none">
                    {/* ASSETS */}
                    <tr className="bg-white/40 text-emerald-700 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                      <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 print:pt-4 print:pb-1">
                        CURRENT &amp; NON-CURRENT ASSETS
                      </td>
                    </tr>
                    {report.balance_sheet.assets.map((row) => (
                      <tr
                        key={row.line_id}
                        onClick={() => !previewMode && handleDrilldown(row.line_id)}
                        className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                      >
                        <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                          {formatAmount(row.amount, report.formatting)}
                        </td>
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                            {row.account_codes.join(', ')}
                          </td>
                        )}
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-white font-bold border-t-2 border-slate-200 text-slate-900 print:bg-transparent print:text-black print:border-none">
                      <td className="py-3 px-4 pl-4 print:px-0 font-bold uppercase">Total Assets</td>
                      <td className="py-3 px-4 text-right text-emerald-700 print:text-black font-mono font-bold text-sm print:border-t print:border-black print:border-b-4 print:border-double print:border-black">
                        {formatAmount(report.balance_sheet.total_assets, report.formatting)}
                      </td>
                      {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                    </tr>

                    {/* LIABILITIES */}
                    <tr className="bg-white/40 text-amber-700 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                      <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 pt-4 print:pt-6 print:pb-1">
                        LIABILITIES
                      </td>
                    </tr>
                    {report.balance_sheet.liabilities.map((row) => (
                      <tr
                        key={row.line_id}
                        onClick={() => !previewMode && handleDrilldown(row.line_id)}
                        className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                      >
                        <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                          {formatAmount(row.amount, report.formatting)}
                        </td>
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                            {row.account_codes.join(', ')}
                          </td>
                        )}
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-white font-bold border-t border-slate-200 text-slate-700 print:bg-transparent print:text-black print:border-none">
                      <td className="py-2.5 px-4 pl-4 print:px-0 uppercase font-bold">Total Liabilities</td>
                      <td className="py-2.5 px-4 text-right text-amber-300 print:text-black font-mono font-bold print:border-t print:border-black">
                        {formatAmount(report.balance_sheet.total_liabilities, report.formatting)}
                      </td>
                      {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                    </tr>

                    {/* EQUITY */}
                    <tr className="bg-white/40 text-indigo-400 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                      <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 pt-4 print:pt-6 print:pb-1">
                        EQUITY
                      </td>
                    </tr>
                    {report.balance_sheet.equity.map((row) => (
                      <tr
                        key={row.line_id}
                        onClick={() => !previewMode && handleDrilldown(row.line_id)}
                        className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                      >
                        <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                          {formatAmount(row.amount, report.formatting)}
                        </td>
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                            {row.account_codes.join(', ')}
                          </td>
                        )}
                        {!previewMode && (
                          <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                              <span>Inspect</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="bg-white font-bold border-t border-slate-200 text-slate-700 print:bg-transparent print:text-black print:border-none">
                      <td className="py-2.5 px-4 pl-4 print:px-0 uppercase font-bold">Total Equity</td>
                      <td className="py-2.5 px-4 text-right text-indigo-300 print:text-black font-mono font-bold print:border-t print:border-black">
                        {formatAmount(report.balance_sheet.total_equity, report.formatting)}
                      </td>
                      {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                    </tr>

                    {/* TOTAL LIABILITIES & EQUITY */}
                    <tr className="bg-slate-900/10/60 font-bold border-t-2 border-b-2 border-emerald-500/50 text-emerald-200 text-sm print:bg-transparent print:text-black print:border-none">
                      <td className="py-3.5 px-4 pl-4 print:px-0 uppercase font-black">Total Liabilities &amp; Equity</td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 print:text-black font-mono font-black text-base print:border-t print:border-black print:border-b-4 print:border-double print:border-black">
                        {formatAmount(report.balance_sheet.total_liabilities_and_equity, report.formatting)}
                      </td>
                      {!previewMode && (
                        <td colSpan={2} className="py-3.5 px-4 text-center text-xs text-emerald-700 print:hidden">
                          {report.balance_sheet.is_balanced ? 'BALANCED' : 'OUT OF BALANCE'}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* INCOME STATEMENT TAB */}
            {activeTab === 'income-statement' && (
              <table className="w-full text-xs font-mono print:text-sm print:font-sans">
                <thead className="bg-white/60 text-slate-500 uppercase tracking-wider border-b border-slate-200 print:hidden">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Line Item</th>
                    <th className="py-2.5 px-4 text-right">Amount ({report.formatting?.currency_symbol || 'IDR'})</th>
                    {!previewMode && <th data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">Accounts</th>}
                    {!previewMode && <th data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">Drill-Down</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-none">
                  {/* OPERATING REVENUE */}
                  <tr className="bg-white/40 text-emerald-700 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                    <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 print:pt-4 print:pb-1">
                      OPERATING REVENUES
                    </td>
                  </tr>
                  {report.income_statement.operating_revenue.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                    >
                      <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                          {row.account_codes.join(', ')}
                        </td>
                      )}
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t-2 border-slate-200 text-slate-900 print:bg-transparent print:text-black print:border-none">
                    <td className="py-3 px-4 pl-4 print:px-0 uppercase font-bold">Total Operating Revenues</td>
                    <td className="py-3 px-4 text-right text-emerald-700 print:text-black font-mono font-bold text-sm print:border-t print:border-black">
                      {formatAmount(report.income_statement.total_operating_revenue ?? 0, report.formatting)}
                    </td>
                    {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                  </tr>

                  {/* COST OF SALES (if configured) */}
                  {report.income_statement.cost_of_sales && report.income_statement.cost_of_sales.length > 0 && (
                    <>
                      <tr className="bg-white/40 text-amber-700 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                        <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 pt-4 print:pt-6 print:pb-1">
                          COST OF SALES
                        </td>
                      </tr>
                      {report.income_statement.cost_of_sales.map((row) => (
                        <tr
                          key={row.line_id}
                          onClick={() => !previewMode && handleDrilldown(row.line_id)}
                          className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                        >
                          <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                            {row.label}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                            {formatAmount(row.amount, report.formatting)}
                          </td>
                          {!previewMode && (
                            <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                              {row.account_codes.join(', ')}
                            </td>
                          )}
                          {!previewMode && (
                            <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                                <span>Inspect</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-white font-bold border-t border-slate-200 text-slate-700 print:bg-transparent print:text-black print:border-none">
                        <td className="py-2.5 px-4 pl-4 print:px-0 uppercase font-bold">Total Cost of Sales</td>
                        <td className="py-2.5 px-4 text-right text-amber-300 print:text-black font-mono font-bold print:border-t print:border-black">
                          {formatAmount(report.income_statement.total_cost_of_sales ?? 0, report.formatting)}
                        </td>
                        {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                      </tr>

                      {/* GROSS PROFIT */}
                      <tr className="bg-white/80 font-bold border-t border-slate-200 text-emerald-700 print:bg-transparent print:text-black print:border-none">
                        <td className="py-2.5 px-4 pl-4 print:px-0 uppercase font-bold">Gross Profit</td>
                        <td className="py-2.5 px-4 text-right text-emerald-700 print:text-black font-mono font-bold print:border-t print:border-black">
                          {formatAmount(report.income_statement.gross_profit ?? 0, report.formatting)}
                        </td>
                        {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                      </tr>
                    </>
                  )}

                  {/* OPERATING EXPENSES */}
                  <tr className="bg-white/40 text-red-600 font-bold uppercase tracking-wider print:bg-transparent print:text-black print:border-b print:border-black">
                    <td colSpan={previewMode ? 2 : 4} className="py-2.5 px-4 print:px-0 pt-4 print:pt-6 print:pb-1">
                      OPERATING EXPENSES
                    </td>
                  </tr>
                  {report.income_statement.operating_expenses.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors print:hover:bg-transparent`}
                    >
                      <td className="py-2.5 px-4 pl-8 print:px-0 print:pl-4 text-slate-700 print:text-black font-medium print:font-normal">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 print:text-black font-semibold print:font-mono print:font-normal">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center text-slate-500 print:hidden no-print non-printable-col">
                          {row.account_codes.join(', ')}
                        </td>
                      )}
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t border-slate-200 text-slate-700 print:bg-transparent print:text-black print:border-none">
                    <td className="py-2.5 px-4 pl-4 print:px-0 uppercase font-bold">Total Operating Expenses</td>
                    <td className="py-2.5 px-4 text-right text-rose-300 print:text-black font-mono font-bold print:border-t print:border-black">
                      {formatAmount(report.income_statement.total_operating_expenses ?? 0, report.formatting)}
                    </td>
                    {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                  </tr>

                  {/* NET OPERATING INCOME */}
                  <tr className="bg-slate-900/10/60 font-bold border-t-2 border-b-2 border-emerald-500/50 text-emerald-200 text-sm print:bg-transparent print:text-black print:border-none">
                    <td className="py-3.5 px-4 pl-4 print:px-0 uppercase font-black">Net Operating Income</td>
                    <td className="py-3.5 px-4 text-right text-emerald-700 print:text-black font-mono font-black text-base print:border-t print:border-black print:border-b-4 print:border-double print:border-black">
                      {formatAmount(report.income_statement.net_operating_income ?? 0, report.formatting)}
                    </td>
                    {!previewMode && <td colSpan={2} data-non-printable="true" className="print:hidden no-print non-printable-col"></td>}
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
        </PrintableReportContainer>
      )}

      {/* Universal Drilldown Modal */}
      <UniversalDrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        reportType="Financial Statements"
        lineId={drilldownLineId || undefined}
        period={period}
        onOpenJournalInWorkbench={onOpenJournalInWorkbench}
      />
    </div>
  );
};
