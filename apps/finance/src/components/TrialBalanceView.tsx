/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Download,
  Printer,
} from 'lucide-react';;
import { TrialBalanceReport } from '../types';
import { api } from '../services/api';
import { PrintableReportContainer } from './reports/PrintableReportContainer';
import { createReportExporter, ReportExportFormat , withTotal } from '../utils/excelExporter';
import { ReportExportButtons } from './reports/ReportExportButtons';

export const TrialBalanceView: React.FC = () => {
  const [period, setPeriod] = useState<string>('');
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const fetchTrialBalance = (selectedPeriod?: string) => {
    setLoading(true);
    api
      .getTrialBalance(selectedPeriod || undefined)
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load trial balance:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrialBalance(period);
  }, [period]);

  const handlePrint = () => {
    window.dispatchEvent(new CustomEvent('atrium-open-print-preview'));
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!report) return;

    const rows: (string | number)[][] = report.items.map((item) => [
      item.account_code,
      item.account_name,
      item.account_type,
      item.normal_balance,
      item.debit_sum ?? 0,
      item.credit_sum ?? 0,
      item.net_debit ?? 0,
      item.net_credit ?? 0,
    ]);

    // Grand Totals row
    withTotal(rows, [
      'TOTAL',
      'Grand Totals',
      '',
      '',
      report.items.reduce((s, i) => s + (i.debit_sum || 0), 0),
      report.items.reduce((s, i) => s + (i.credit_sum || 0), 0),
      report.total_debits ?? 0,
      report.total_credits ?? 0,
    ]);

    createReportExporter(format)(
      `Trial_Balance_PT_Atrium_Management_Group_${period || 'All_Time'}.xlsx`,
      [
        {
          name: 'Trial Balance',
          title: 'OFFICIAL TRIAL BALANCE STATEMENT',
          subtitle: 'Double-Entry Posted Ledger Verification & Imbalance Audit',
          period: period || 'All Time',
          headers: [
            'Account Code',
            'Account Name',
            'Account Type',
            'Normal',
            'Debit Total (Rp)',
            'Credit Total (Rp)',
            'Net Debit (Rp)',
            'Net Credit (Rp)',
          ],
          rows,
          colWidths: [15, 35, 18, 10, 18, 18, 18, 18],
        },
      ]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-emerald-700" />
            <span>Trial Balance Report</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive verification of debit and credit ledger balances for POSTED transactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-slate-700 font-mono outline-none"
            />
            {period && (
              <button
                onClick={() => setPeriod('')}
                className="text-[11px] text-slate-500 hover:text-slate-700 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          <ReportExportButtons onExport={handleExportExcel} disabled={loading || !report} />

          {/* Toggle PDF Preview */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              previewMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <span>{previewMode ? 'Screen View' : 'PDF Preview'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print to PDF</span>
          </button>
        </div>
      </div>

      <PrintableReportContainer
        reportTitle="Official Trial Balance Statement"
        reportSubtitle="Double-Entry Posted Ledger Verification & Imbalance Audit"
        period={period}
        property="PT Atrium Management Group"
        previewMode={previewMode}
        onExitPreview={() => setPreviewMode(false)}
        onExportExcel={handleExportExcel}
      >
        <div className="space-y-6">
          {/* Balance Verification Banner */}
          {report && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
                report.is_balanced
                  ? 'bg-slate-900/10/30 border-emerald-800/50 text-emerald-700 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-900'
                  : 'bg-red-950/40 border-red-800/60 text-red-200 print:bg-red-50 print:border-red-300 print:text-red-900'
              }`}
            >
              <div className="flex items-center gap-3">
                {report.is_balanced ? (
                  <div className="p-2 bg-emerald-900/40 rounded-lg text-emerald-700 print:bg-emerald-100 print:text-emerald-800">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 bg-red-900/40 rounded-lg text-red-400 print:bg-red-100 print:text-red-800">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold font-sans">
                    {report.is_balanced
                      ? 'Double-Entry In Balance: Total Debits strictly equal Total Credits'
                      : 'CRITICAL AUDIT EXCEPTION: Trial Balance is Out of Balance!'}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    Period: <span className="font-mono">{report.period}</span> &bull; Variance:{' '}
                    <span className="font-mono font-semibold">Rp {report.variance.toLocaleString('id-ID')}</span>
                  </p>
                </div>
              </div>

              <div className="text-right font-mono hidden sm:block">
                <div className="text-xs opacity-75">Net Sum:</div>
                <div className="text-sm font-bold">
                  Rp {(report.total_debits ?? 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-white/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Account Code</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Normal</th>
                <th className="py-3 px-4 text-right">Debit Total (Rp)</th>
                <th className="py-3 px-4 text-right">Credit Total (Rp)</th>
                <th className="py-3 px-4 text-right">Net Debit (Rp)</th>
                <th className="py-3 px-4 text-right">Net Credit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    Calculating Trial Balance from POSTED journal lines...
                  </td>
                </tr>
              ) : !report || report.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500 font-sans">
                    <Scale className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                    <p className="font-medium text-slate-500">No posted transactions recorded</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Trial Balance is computed exclusively from POSTED journals. Pending drafts are excluded.
                    </p>
                  </td>
                </tr>
              ) : (
                report.items.map((item) => {
                  const hasActivity = item.debit_sum > 0 || item.credit_sum > 0;
                  return (
                    <tr
                      key={item.account_code}
                      className={`hover:bg-white/40 ${!hasActivity ? 'opacity-40' : ''}`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{item.account_code}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-900 font-medium">{item.account_name}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-500">{item.account_type}</td>
                      <td className="py-2.5 px-4 text-slate-500">{item.normal_balance}</td>
                      <td className="py-2.5 px-4 text-right text-slate-700">
                        {(item.debit_sum ?? 0) > 0
                          ? (item.debit_sum ?? 0).toLocaleString('id-ID')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700">
                        {(item.credit_sum ?? 0) > 0
                          ? (item.credit_sum ?? 0).toLocaleString('id-ID')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700 bg-white/30">
                        {(item.net_debit ?? 0) > 0
                          ? (item.net_debit ?? 0).toLocaleString('id-ID')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-500 bg-white/30">
                        {(item.net_credit ?? 0) > 0
                          ? (item.net_credit ?? 0).toLocaleString('id-ID')
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Grand Totals */}
            {report && (
              <tfoot className="bg-white border-t-2 border-slate-200 font-bold text-xs">
                <tr>
                  <td colSpan={6} className="py-3 px-4 text-right text-slate-700 font-sans uppercase">
                    Grand Totals:
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 text-sm">
                    Rp {(report.total_debits ?? 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 text-sm">
                    Rp {(report.total_credits ?? 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </div>
      </PrintableReportContainer>
    </div>
  );
};
