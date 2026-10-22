/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Percent,
  Layers,
  Scale,
  Sparkles,
} from 'lucide-react';
import { UsaliStatementReport, ReportLineItem } from '../../types';
import { api } from '../../services/api';
import { UniversalReportToolbar } from './UniversalReportToolbar';
import { UniversalDrilldownModal } from './UniversalDrilldownModal';
import { PrintableReportContainer } from './PrintableReportContainer';
import { formatAmount } from '../../utils/reportFormatter';
import { createReportExporter, ReportExportFormat } from '../../utils/excelExporter';

interface UsaliStatementsViewProps {
  onOpenJournalInWorkbench?: (journalId: string) => void;
}

type UsaliTab =
  | 'summary-operator'
  | 'summary-owner'
  | 'schedule-rooms'
  | 'schedule-fb'
  | 'undistributed'
  | 'kpis';

export const UsaliStatementsView: React.FC<UsaliStatementsViewProps> = ({
  onOpenJournalInWorkbench,
}) => {
  const [period, setPeriod] = useState<string>('');
  const [property, setProperty] = useState<string>('PT Atrium Management Group');
  const [activeTab, setActiveTab] = useState<UsaliTab>('summary-operator');
  const [report, setReport] = useState<UsaliStatementReport | null>(null);
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

  const getStatementTitle = () => {
    switch (activeTab) {
      case 'summary-operator':
        return 'USALI 12 Summary Operating Statement — Operator';
      case 'summary-owner':
        return 'USALI 12 Summary Operating Statement — Owner Perspective';
      case 'schedule-rooms':
        return 'Schedule 1 — Rooms Departmental Statement';
      case 'schedule-fb':
        return 'Schedule 2 — Food & Beverage Departmental Statement';
      case 'undistributed':
        return 'Undistributed Operating Expenses Schedules (A&G, POM, S&M, Energy)';
      case 'kpis':
        return 'USALI Operating Metrics & Performance KPIs';
      default:
        return 'USALI 12 Financial Statement';
    }
  };

  const fetchReport = (selectedPeriod?: string) => {
    setLoading(true);
    api
      .getUsaliStatement(selectedPeriod || undefined)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load USALI statement:', err);
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
    lines.push(`"USALI 12th Revised Edition - Summary Operating Statement"`);
    lines.push(`"Property:","${property}"`);
    lines.push(`"Period:","${period || 'All Time'}"`);
    lines.push(`"Generated:","${new Date().toISOString()}"`);
    lines.push('');
    lines.push(`"Category","Line Item","Amount (IDR)","Accounts Mapped"`);

    lines.push(`"Operating Revenue"`);
    report.operating_revenue.forEach((r) => {
      lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
    });
    lines.push(`,"Total Operating Revenue",${report.total_operating_revenue}`);
    lines.push('');

    lines.push(`"Departmental Expenses"`);
    report.departmental_expenses.forEach((r) => {
      lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
    });
    lines.push(`,"Total Departmental Expenses",${report.total_departmental_expenses}`);
    lines.push(`,"Total Departmental Profit",${report.total_departmental_profit}`);
    lines.push('');

    lines.push(`"Undistributed Operating Expenses"`);
    report.undistributed_operating_expenses.forEach((r) => {
      lines.push(`,"${r.label}",${r.amount},"${r.account_codes.join('; ')}"`);
    });
    lines.push(`,"Total Undistributed Expenses",${report.total_undistributed_expenses}`);
    lines.push(`,"Gross Operating Profit (GOP)",${report.gross_operating_profit}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `USALI_Operating_Statement_${period || 'All_Time'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Excel (.xlsx) export with auto-sized columns and PT Atrium Management Group format
  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!report) return;

    const ratio = (amount: number) => report.total_operating_revenue > 0
      ? `${(amount / report.total_operating_revenue * 100).toFixed(1)}%` : '0.0%';
    const schedule = report.schedules_summary;
    const otherRows: Record<string, (string | number)[][]> = {
      'summary-owner': [
        ['Total Operating Revenue', report.total_operating_revenue, ratio(report.total_operating_revenue)],
        ['Total Operating Expenses (Dept + Undistributed)', report.total_departmental_expenses + report.total_undistributed_expenses, ratio(report.total_departmental_expenses + report.total_undistributed_expenses)],
        ['Gross Operating Profit (GOP)', report.gross_operating_profit, `${gopMargin}%`],
        ['Less: Operator Management Fees', report.total_management_fees, ''],
        ['Less: Non-Operating Income & Expenses', report.total_non_operating_expenses, ''],
        ['Net Operating Profit for Owner (EBITDA)', report.ebitda, ratio(report.ebitda)],
      ],
      'schedule-rooms': [
        ['Rooms Revenue', schedule.rooms_revenue], ['Rooms Expenses', schedule.rooms_expense],
        ['Rooms Departmental Profit', schedule.rooms_profit], ['Rooms Profit Margin', `${roomsMargin}%`],
      ],
      'schedule-fb': [
        ['F&B Revenue', schedule.fb_revenue], ['F&B Expenses', schedule.fb_expense],
        ['F&B Departmental Profit', schedule.fb_profit], ['F&B Profit Margin', `${fbMargin}%`],
      ],
      undistributed: report.undistributed_operating_expenses.map(row => [row.label, row.amount]),
      kpis: [
        ['GOP Margin', `${gopMargin}%`], ['Rooms Margin', `${roomsMargin}%`],
        ['F&B Margin', `${fbMargin}%`],
        ['Operating Ratio', ratio(report.total_departmental_expenses + report.total_undistributed_expenses)],
      ],
    };
    if (activeTab !== 'summary-operator') {
      createReportExporter(format)(`USALI_${activeTab}_${period || 'All_Time'}`, [{
        name: activeTab, title: getStatementTitle(), property, period: period || 'All Time',
        headers: activeTab === 'summary-owner' ? ['Statement Line Item', 'Amount (Rp)', '% Total Revenue'] : ['Statement Line Item', 'Amount (Rp) / Metric'],
        rows: otherRows[activeTab], colWidths: activeTab === 'summary-owner' ? [50, 22, 16] : [50, 22],
      }]);
      return;
    }

    const opRows: (string | number)[][] = [
      ['OPERATING REVENUES', ''],
      ...report.operating_revenue.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Operating Revenue', report.total_operating_revenue],
      ['', ''],
      ['DEPARTMENTAL EXPENSES', ''],
      ...report.departmental_expenses.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Departmental Expenses', report.total_departmental_expenses],
      ['TOTAL DEPARTMENTAL PROFIT', report.total_departmental_profit],
      ['', ''],
      ['UNDISTRIBUTED OPERATING EXPENSES', ''],
      ...report.undistributed_operating_expenses.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Undistributed Expenses', report.total_undistributed_expenses],
      ['', ''],
      ['GROSS OPERATING PROFIT (GOP)', report.gross_operating_profit],
      ['GOP Margin %', `${gopMargin}%`],
      ['', ''],
      ['MANAGEMENT FEES & NON-OPERATING', ''],
      ...report.management_fees.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Management Fees', report.total_management_fees],
      ['INCOME BEFORE NON-OPERATING EXPENSES', report.income_before_non_operating],
      ['', ''],
      ['NON-OPERATING INCOME & EXPENSES', ''],
      ...report.non_operating_expenses.map((r) => [`   ${r.label}`, r.amount]),
      ['Total Non-Operating Expenses', report.total_non_operating_expenses],
      ['', ''],
      ['NET OPERATING INCOME (EBITDA)', report.ebitda],
    ];

    const schedRows: (string | number)[][] = [
      ['ROOMS DEPARTMENT (SCHEDULE 1)', ''],
      ['Rooms Revenue', report.schedules_summary.rooms_revenue],
      ['Rooms Expenses', report.schedules_summary.rooms_expense],
      ['Rooms Departmental Profit', report.schedules_summary.rooms_profit],
      ['Rooms Profit Margin', `${roomsMargin}%`],
      ['', ''],
      ['FOOD & BEVERAGE DEPARTMENT (SCHEDULE 2)', ''],
      ['F&B Revenue', report.schedules_summary.fb_revenue],
      ['F&B Expenses', report.schedules_summary.fb_expense],
      ['F&B Departmental Profit', report.schedules_summary.fb_profit],
      ['F&B Profit Margin', `${fbMargin}%`],
    ];

    createReportExporter(format)(
      `USALI_12_Operating_Statement_${property.replace(/\s+/g, '_')}_${period || 'All_Time'}.xlsx`,
      [
        {
          name: 'Operating Statement',
          property,
          title: 'USALI 12th Revised Edition — Operating Statement',
          period: period || 'All Time',
          headers: ['Statement Line Item', 'Amount (Rp)', '% Total Revenue'],
          rows: opRows.map(row => [...row, typeof row[1] === 'number' ? ratio(row[1]) : '']),
          colWidths: [45, 20, 16],
        },
        {
          name: 'Department Schedules',
          property,
          title: 'USALI 12 — Departmental Schedules Summary',
          period: period || 'All Time',
          headers: ['Department Schedule Line', 'Amount (Rp)'],
          rows: schedRows,
          colWidths: [45, 20],
        },
      ].slice(0, 1)
    );
  };

  // KPI Calculations (using posted data)
  const gopMargin =
    report && report.total_operating_revenue > 0
      ? ((report.gross_operating_profit / report.total_operating_revenue) * 100).toFixed(1)
      : '0.0';
  const roomsMargin =
    report && report.schedules_summary.rooms_revenue > 0
      ? ((report.schedules_summary.rooms_profit / report.schedules_summary.rooms_revenue) * 100).toFixed(1)
      : '0.0';
  const fbMargin =
    report && report.schedules_summary.fb_revenue > 0
      ? ((report.schedules_summary.fb_profit / report.schedules_summary.fb_revenue) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {/* Universal Report Toolbar */}
      <UniversalReportToolbar
        reportTitle="USALI 12th Revised Edition — Operating Statements"
        reportSubtitle="Uniform System of Accounts for the Lodging Industry (USALI 12) strictly calculated from POSTED Ledger"
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

      {/* Sub-Navigation: USALI Schedules & Perspectives */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveTab('summary-operator')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'summary-operator'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          Summary Operating Statement — Operator
        </button>
        <button
          onClick={() => setActiveTab('summary-owner')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'summary-owner'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          Summary Operating Statement — Owner
        </button>
        <button
          onClick={() => setActiveTab('schedule-rooms')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'schedule-rooms'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          Schedule 1 — Rooms
        </button>
        <button
          onClick={() => setActiveTab('schedule-fb')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'schedule-fb'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          Schedule 2 — Food & Beverage
        </button>
        <button
          onClick={() => setActiveTab('undistributed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'undistributed'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          Undistributed Schedules (A&G / POM / S&M / Energy)
        </button>
        <button
          onClick={() => setActiveTab('kpis')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === 'kpis'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white'
          }`}
        >
          USALI 12 Metrics & KPIs
        </button>
      </div>

      {/* KPI Cards Row */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <div className="p-4 rounded-xl bg-white/60 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Gross Operating Profit (GOP)</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {formatAmount(report.gross_operating_profit ?? 0, report.formatting)}
            </div>
            <div className="text-[11px] font-mono text-emerald-700 mt-1">
              GOP Margin: {gopMargin}%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/60 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Operating Revenue</span>
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {formatAmount(report.total_operating_revenue ?? 0, report.formatting)}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Rooms: {formatAmount(report.schedules_summary?.rooms_revenue ?? 0, report.formatting)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/60 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Rooms Dept Profit</span>
              <Percent className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {formatAmount(report.schedules_summary?.rooms_profit ?? 0, report.formatting)}
            </div>
            <div className="text-[11px] font-mono text-indigo-400 mt-1">
              Rooms Margin: {roomsMargin}%
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/60 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Food & Beverage Profit</span>
              <Percent className="w-3.5 h-3.5 text-amber-700" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {formatAmount(report.schedules_summary?.fb_profit ?? 0, report.formatting)}
            </div>
            <div className="text-[11px] font-mono text-amber-700 mt-1">
              F&B Margin: {fbMargin}%
            </div>
          </div>
        </div>
      )}

      {/* Main Statement Table View */}
      {report && (
        <PrintableReportContainer
          reportTitle={getStatementTitle()}
          reportSubtitle="Hospitality Standard Operating Statement • USALI 12th Revised Edition"
          period={period}
          property={property}
          previewMode={previewMode}
          onExitPreview={() => setPreviewMode(false)}
          onExportExcel={handleExportExcel}
        >
          <div className="bg-white/90 border border-slate-200 rounded-xl overflow-hidden shadow-xs print:border-none print:shadow-none print:rounded-none">
            {!previewMode && (
              <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between print:hidden no-print preview-hidden">
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    {property}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    {getStatementTitle()}
                  </h2>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Period: <strong className="text-slate-700">{period || 'All Available Posted Periods'}</strong>
                </span>
              </div>
            )}

            <div className="p-6 overflow-x-auto print:p-0">
              {activeTab === 'summary-operator' && (
                <table className="w-full text-xs">
                  <thead className="bg-white/60 text-slate-500 font-mono uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left">USALI 12 Line Description</th>
                      <th className="py-2.5 px-4 text-right">Amount (Rp)</th>
                      <th className="py-2.5 px-4 text-right">% Revenue</th>
                      {!previewMode && (
                        <th data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">
                          Drill-Down
                        </th>
                      )}
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {/* OPERATING REVENUE */}
                  <tr className="bg-white/40 text-emerald-700 font-bold uppercase tracking-wider">
                    <td colSpan={previewMode ? 3 : 4} className="py-2 px-4">
                      Operating Revenue
                    </td>
                  </tr>
                  {report.operating_revenue.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors`}
                    >
                      <td className="py-2.5 px-4 pl-8 text-slate-700 font-medium">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 font-semibold">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${(((row.amount ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t-2 border-slate-200 text-slate-900">
                    <td className="py-3 px-4 pl-4 uppercase">Total Operating Revenue</td>
                    <td className="py-3 px-4 text-right text-emerald-700 text-sm">
                      {formatAmount(report.total_operating_revenue ?? 0, report.formatting)}
                    </td>
                    <td className="py-3 px-4 text-right">100.0%</td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-3 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>

                  {/* DEPARTMENTAL EXPENSES */}
                  <tr className="bg-white/40 text-red-600 font-bold uppercase tracking-wider">
                    <td colSpan={previewMode ? 3 : 4} className="py-2 px-4 pt-4">
                      Departmental Expenses
                    </td>
                  </tr>
                  {report.departmental_expenses.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors`}
                    >
                      <td className="py-2.5 px-4 pl-8 text-slate-700 font-medium">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 font-semibold">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${(((row.amount ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t border-slate-200 text-slate-700">
                    <td className="py-2.5 px-4 pl-4 uppercase">Total Departmental Expenses</td>
                    <td className="py-2.5 px-4 text-right text-rose-300">
                      {formatAmount(report.total_departmental_expenses ?? 0, report.formatting)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {(report.total_operating_revenue ?? 0) > 0
                        ? `${(((report.total_departmental_expenses ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>
                  <tr className="bg-slate-900/10/30 font-bold border-t border-b border-emerald-800/50 text-emerald-700">
                    <td className="py-3 px-4 pl-4 uppercase">Total Departmental Profit</td>
                    <td className="py-3 px-4 text-right text-sm font-bold text-emerald-700">
                      {formatAmount(report.total_departmental_profit ?? 0, report.formatting)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(report.total_operating_revenue ?? 0) > 0
                        ? `${(((report.total_departmental_profit ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-3 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>

                  {/* UNDISTRIBUTED OPERATING EXPENSES */}
                  <tr className="bg-white/40 text-amber-700 font-bold uppercase tracking-wider">
                    <td colSpan={previewMode ? 3 : 4} className="py-2 px-4 pt-4">
                      Undistributed Operating Expenses
                    </td>
                  </tr>
                  {report.undistributed_operating_expenses.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors`}
                    >
                      <td className="py-2.5 px-4 pl-8 text-slate-700 font-medium">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-900 font-semibold">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${(((row.amount ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t border-slate-200 text-slate-700">
                    <td className="py-2.5 px-4 pl-4 uppercase">Total Undistributed Expenses</td>
                    <td className="py-2.5 px-4 text-right text-amber-300">
                      {formatAmount(report.total_undistributed_expenses ?? 0, report.formatting)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {(report.total_operating_revenue ?? 0) > 0
                        ? `${(((report.total_undistributed_expenses ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>

                  {/* GROSS OPERATING PROFIT (GOP) */}
                  <tr className="bg-slate-900/10/60 font-bold border-t-2 border-b-2 border-emerald-500/50 text-emerald-200 text-sm">
                    <td className="py-3.5 px-4 pl-4 uppercase">Gross Operating Profit (GOP)</td>
                    <td className="py-3.5 px-4 text-right text-emerald-700 font-mono text-base">
                      {formatAmount(report.gross_operating_profit ?? 0, report.formatting)}
                    </td>
                    <td className="py-3.5 px-4 text-right">{gopMargin}%</td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-3.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>

                  {/* MANAGEMENT FEES & EBITDA */}
                  {report.management_fees.map((row) => (
                    <tr
                      key={row.line_id}
                      onClick={() => !previewMode && handleDrilldown(row.line_id)}
                      className={`${!previewMode ? 'hover:bg-white/60 cursor-pointer' : ''} transition-colors`}
                    >
                      <td className="py-2.5 px-4 pl-8 text-slate-700 font-medium">
                        {row.label}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700">
                        {formatAmount(row.amount, report.formatting)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">—</td>
                      {!previewMode && (
                        <td data-non-printable="true" className="py-2.5 px-4 text-center print:hidden no-print preview-hidden non-printable-col">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-white font-bold border-t border-b border-slate-200 text-slate-700">
                    <td className="py-3 px-4 pl-4 uppercase">EBITDA</td>
                    <td className="py-3 px-4 text-right text-sm font-bold text-slate-900">
                      {formatAmount(report.ebitda ?? 0, report.formatting)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(report.total_operating_revenue ?? 0) > 0
                        ? `${(((report.ebitda ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                        : '0.0%'}
                    </td>
                    {!previewMode && (
                      <td data-non-printable="true" className="py-3 px-4 text-center print:hidden no-print preview-hidden non-printable-col">—</td>
                    )}
                  </tr>
                </tbody>
              </table>
            )}

            {activeTab === 'summary-owner' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900 mb-1">
                    USALI 12 Summary Operating Statement — Owner Perspective
                  </p>
                  <p className="text-slate-500">
                    Distinguishes hotel operating activity from operator fees, capital reserves, and owner economics.
                  </p>
                </div>

                <table className="w-full text-xs font-mono">
                  <thead className="bg-white text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Line Item</th>
                      <th className="py-2.5 px-4 text-right">Amount ({report.formatting?.currency_symbol || 'IDR'})</th>
                      <th className="py-2.5 px-4 text-right">% Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Total Operating Revenue</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatAmount(report.total_operating_revenue ?? 0, report.formatting)}
                      </td>
                      <td className="py-3 px-4 text-right">100.0%</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-700">Total Operating Expenses (Dept + Undistributed)</td>
                      <td className="py-3 px-4 text-right text-rose-300">
                        {formatAmount(((report.total_departmental_expenses ?? 0) + (report.total_undistributed_expenses ?? 0)), report.formatting)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${((((report.total_departmental_expenses ?? 0) + (report.total_undistributed_expenses ?? 0)) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                    </tr>
                    <tr className="bg-slate-900/10/40 font-bold text-emerald-700">
                      <td className="py-3 px-4 uppercase">Gross Operating Profit (GOP)</td>
                      <td className="py-3 px-4 text-right text-sm">
                        {formatAmount(report.gross_operating_profit ?? 0, report.formatting)}
                      </td>
                      <td className="py-3 px-4 text-right">{gopMargin}%</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 pl-8">Less: Operator Management Fees</td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        {formatAmount(report.total_management_fees ?? 0, report.formatting)}
                      </td>
                      <td className="py-3 px-4 text-right">—</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-slate-500 pl-8">Less: Non-Operating Income & Expenses</td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        {formatAmount(report.total_non_operating_expenses ?? 0, report.formatting)}
                      </td>
                      <td className="py-3 px-4 text-right">—</td>
                    </tr>
                    <tr className="bg-white font-bold text-base text-slate-900 border-t-2 border-slate-200">
                      <td className="py-3.5 px-4 uppercase">Net Operating Profit for Owner (EBITDA)</td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-mono">
                        {formatAmount(report.ebitda ?? 0, report.formatting)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${(((report.ebitda ?? 0) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'schedule-rooms' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="font-bold text-slate-700">Schedule 1 — Rooms Department Performance</h3>
                  <button
                    onClick={() => handleDrilldown('USALI-REV-ROOMS')}
                    className="text-emerald-700 hover:underline"
                  >
                    Drill-Down Rooms Revenue
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Total Rooms Revenue</div>
                    <div className="text-lg font-bold text-emerald-700 mt-1">
                      {formatAmount(report.schedules_summary?.rooms_revenue ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Total Rooms Expenses</div>
                    <div className="text-lg font-bold text-red-600 mt-1">
                      {formatAmount(report.schedules_summary?.rooms_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Rooms Departmental Profit</div>
                    <div className="text-lg font-bold text-indigo-400 mt-1">
                      {formatAmount(report.schedules_summary?.rooms_profit ?? 0, report.formatting)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Margin: {roomsMargin}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule-fb' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="font-bold text-slate-700">Schedule 2 — Food & Beverage Department</h3>
                  <button
                    onClick={() => handleDrilldown('USALI-REV-FB')}
                    className="text-emerald-700 hover:underline"
                  >
                    Drill-Down F&B Revenue
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">F&B Total Revenue</div>
                    <div className="text-lg font-bold text-emerald-700 mt-1">
                      {formatAmount(report.schedules_summary?.fb_revenue ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">F&B Departmental Expenses</div>
                    <div className="text-lg font-bold text-red-600 mt-1">
                      {formatAmount(report.schedules_summary?.fb_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">F&B Departmental Profit</div>
                    <div className="text-lg font-bold text-amber-700 mt-1">
                      {formatAmount(report.schedules_summary?.fb_profit ?? 0, report.formatting)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Margin: {fbMargin}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'undistributed' && (
              <div className="space-y-4 font-mono text-xs">
                <h3 className="font-bold text-slate-700 pb-2 border-b border-slate-200">
                  Undistributed Operating Expenses Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Administrative & General (A&G)</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatAmount(report.schedules_summary?.ag_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Property Maintenance (POM)</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatAmount(report.schedules_summary?.pom_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Sales & Marketing</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatAmount(report.schedules_summary?.sm_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-slate-500">Energy, Water & Waste</div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatAmount(report.schedules_summary?.energy_expense ?? 0, report.formatting)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'kpis' && (
              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-2">USALI 12 Operating Performance Metrics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">GOP Margin:</span>
                      <span className="text-emerald-700 font-bold text-sm">{gopMargin}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Rooms Margin:</span>
                      <span className="text-indigo-400 font-bold text-sm">{roomsMargin}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">F&B Margin:</span>
                      <span className="text-amber-700 font-bold text-sm">{fbMargin}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Operating Ratio:</span>
                      <span className="text-slate-700 font-bold text-sm">
                        {(report.total_operating_revenue ?? 0) > 0
                          ? `${((((report.total_departmental_expenses ?? 0) + (report.total_undistributed_expenses ?? 0)) / report.total_operating_revenue) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 32: Drill-Down Reconciliation Banner */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              {report.reconciliation?.is_reconciled ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Report 100% Reconciled with Posted Ledger Entries</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Reconciliation Exception: Variance of {formatAmount(report.reconciliation?.variance ?? 0, report.formatting)} detected</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 text-slate-500">
              <div>
                <span>Posted Revenue: </span>
                <strong className="text-slate-700">
                  {formatAmount(report.reconciliation?.posted_revenue_total ?? 0, report.formatting)}
                </strong>
              </div>
              <div>
                <span>Posted Expense: </span>
                <strong className="text-slate-700">
                  {formatAmount(report.reconciliation?.posted_expense_total ?? 0, report.formatting)}
                </strong>
              </div>
              <div>
                <span>Variance: </span>
                <strong className={report.reconciliation?.is_reconciled ? 'text-emerald-700' : 'text-red-400'}>
                  {formatAmount(report.reconciliation?.variance ?? 0, report.formatting)}
                </strong>
              </div>
            </div>
          </div>
        </div>
        </PrintableReportContainer>
      )}

      {/* Universal Drilldown Modal */}
      <UniversalDrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        reportType="USALI 12"
        lineId={drilldownLineId || undefined}
        period={period}
        onOpenJournalInWorkbench={onOpenJournalInWorkbench}
      />
    </div>
  );
};
