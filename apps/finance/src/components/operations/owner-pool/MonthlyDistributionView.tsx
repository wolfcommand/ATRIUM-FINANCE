/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  OwnerDistributionBatch,
  OwnerPoolAllocationLine,
  OwnerPoolDashboardKPIs,
} from '../../../types';
import { api } from '../../../services/api';
import { CalculationDetailModal } from './CalculationDetailModal';
import {
  Calendar,
  Coins,
  PieChart,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RotateCcw,
  ArrowRight,
  Eye,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Percent,
  Calculator,
  Lock,
  FileText,
  Mail,
  Send,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';;
import { createReportExporter, ReportExportFormat , withTotal } from '../../../utils/excelExporter';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { printReportElement } from '../../../utils/printManager';

interface MonthlyDistributionViewProps {
  onNavigateToStatement?: (unitId: string) => void;
  onNavigateToEmail?: (period?: string) => void;
}

export const MonthlyDistributionView: React.FC<MonthlyDistributionViewProps> = ({
  onNavigateToStatement,
  onNavigateToEmail,
}) => {
  const [period, setPeriod] = useState<string>('2026-09');
  const [kpis, setKpis] = useState<OwnerPoolDashboardKPIs | null>(null);
  const [currentBatch, setCurrentBatch] = useState<OwnerDistributionBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal
  const [inspectLine, setInspectLine] = useState<OwnerPoolAllocationLine | null>(null);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalReason, setReversalReason] = useState('Audit correction / revenue adjustment');

  const loadData = async (selectedPeriod: string = period) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const kpisData = await api.getOwnerPoolKPIs(selectedPeriod);
      setKpis(kpisData);

      // Check if batch exists
      const batches = await api.getOwnerPoolBatches();
      const match = batches.find((b) => b.period === selectedPeriod);
      if (match) {
        const fullBatch = await api.getOwnerPoolBatch(match.batch_id);
        setCurrentBatch(fullBatch);
      } else {
        setCurrentBatch(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load distribution data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(period);
  }, [period]);

  const navigatePeriod = (deltaMonths: number) => {
    try {
      const parts = period.split('-').map(Number);
      const y = parts[0] || 2026;
      const m = parts[1] || 9;
      const date = new Date(y, m - 1 + deltaMonths, 1);
      const nextY = date.getFullYear();
      const nextM = String(date.getMonth() + 1).padStart(2, '0');
      setPeriod(`${nextY}-${nextM}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCalculate = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const batch = await api.calculateOwnerPoolDistribution({ period });
      setCurrentBatch(batch);
      setSuccessMsg(`Distribution calculation completed for ${period}. 8-point reconciliation verified.`);
      await loadData(period);
    } catch (err: any) {
      setErrorMsg(err.message || 'Calculation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    if (!currentBatch) return;
    setActionLoading(true);
    try {
      const updated = await api.markOwnerPoolBatchInReview(currentBatch.batch_id);
      setCurrentBatch(updated);
      setSuccessMsg('Batch status updated to Under Review.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!currentBatch) return;
    setActionLoading(true);
    try {
      const updated = await api.approveOwnerPoolBatch(currentBatch.batch_id, 'Director of Finance');
      setCurrentBatch(updated);
      setSuccessMsg('Distribution batch approved. Ready for General Ledger posting.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!currentBatch) return;
    setActionLoading(true);
    try {
      const updated = await api.postOwnerPoolBatch(currentBatch.batch_id, 'Financial Controller');
      setCurrentBatch(updated);
      setSuccessMsg(`Batch successfully posted to General Ledger! Journal Voucher: ${updated.journal_id}`);
      await loadData(period);
    } catch (err: any) {
      setErrorMsg(err.message || 'Posting failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverse = async () => {
    if (!currentBatch) return;
    setActionLoading(true);
    try {
      const updated = await api.reverseOwnerPoolBatch(
        currentBatch.batch_id,
        reversalReason,
        'Financial Controller'
      );
      setCurrentBatch(updated);
      setShowReversalModal(false);
      setSuccessMsg('Batch reversed. Offsetting journal vouchers generated.');
      await loadData(period);
    } catch (err: any) {
      setErrorMsg(err.message || 'Reversal failed');
    } finally {
      setActionLoading(false);
    }
  };

  const formatIDR = (val?: number) => {
    if (val === undefined || val === null) return 'Rp 0';
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  const filteredLines = (currentBatch?.lines || []).filter((l) => {
    const matchSearch =
      (l.unit_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handlePrint = () => {
    printReportElement('owner-distribution-table-area', {
      title: `Owner_Distribution_Batch_${currentBatch?.batch_id || 'Batch'}_${period}`,
      property: 'PT Atrium Management Group',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!currentBatch) return;

    const rows: (string | number)[][] = currentBatch.lines.map((l) => [
      l.unit_number,
      l.owner_name,
      l.unit_sqm,
      l.contract_year_number,
      `${(l.allocation_pct * 100).toFixed(4)}%`,
      l.gross_return_amount,
      l.stay_deduction_amount,
      l.installment_offset_to_keen_eye,
      l.tax_withheld_amount,
      l.net_distribution_amount,
      l.status,
      l.payout_date || '',
    ]);

    withTotal(rows, [
      'TOTAL',
      'Batch Totals',
      currentBatch.lines.reduce((s, l) => s + l.unit_sqm, 0),
      '',
      '100.00%',
      currentBatch.lines.reduce((s, l) => s + l.gross_return_amount, 0),
      currentBatch.lines.reduce((s, l) => s + l.stay_deduction_amount, 0),
      currentBatch.lines.reduce((s, l) => s + l.installment_offset_to_keen_eye, 0),
      currentBatch.lines.reduce((s, l) => s + l.tax_withheld_amount, 0),
      currentBatch.lines.reduce((s, l) => s + l.net_distribution_amount, 0),
      currentBatch.status,
      '',
    ]);

    createReportExporter(format)(
      `Owner_Pool_Distribution_Batch_${period}_PT_Atrium_Management_Group.xlsx`,
      [
        {
          name: `Batch ${period}`,
          title: `OWNER POOL MONTHLY DISTRIBUTION RUN — ${period}`,
          subtitle: `PT Atrium Management Group • Atrium Suites & Residences Lombok • Status: ${currentBatch.status}`,
          headers: [
            'Unit #',
            'Owner / Investor',
            'Area (sqm)',
            'Year',
            'Weight %',
            'Gross Distribution (Rp)',
            'Stay Deduction (Rp)',
            'Installment Offset (Rp)',
            'Tax Withheld (Rp)',
            'Net Disbursed (Rp)',
            'Status',
            'Payout Date',
          ],
          rows,
          colWidths: [10, 28, 12, 8, 12, 22, 18, 18, 18, 22, 14, 20],
        },
      ]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Period Selection & Action Flow */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Accounting Period:
            </span>
          </div>
          <div className="flex items-center bg-slate-50 border border-slate-300 rounded-lg p-0.5 shadow-xs">
            <button
              onClick={() => navigatePeriod(-1)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <input
                type="month"
                value={period}
                onChange={(e) => e.target.value && setPeriod(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer font-mono"
              />
            </div>
            <button
              onClick={() => navigatePeriod(1)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentBatch && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                currentBatch.status === 'POSTED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentBatch.status === 'APPROVED'
                  ? 'bg-blue-100 text-blue-800'
                  : currentBatch.status === 'REVIEW'
                  ? 'bg-amber-100 text-amber-800'
                  : currentBatch.status === 'REVERSED'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Status: {currentBatch.status}
            </span>
          )}

          {/* Export to Excel and Print PDF buttons */}
          {currentBatch && (
            <div className="flex items-center gap-1.5 ml-2">
              <ReportExportButtons onExport={handleExportExcel} disabled={!currentBatch} />

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                title="Print Distribution Run"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          )}
        </div>

        {/* Workflow Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!currentBatch ? (
            <button
              onClick={handleCalculate}
              disabled={actionLoading || (!kpis?.has_posted_data && kpis?.room_revenue === 0)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              <Calculator className="w-4 h-4" />
              {actionLoading ? 'Calculating...' : `Calculate Distribution for ${period}`}
            </button>
          ) : currentBatch.status === 'CALCULATED' ? (
            <>
              <button
                onClick={handleCalculate}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recalculate
              </button>
              <button
                onClick={handleReview}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Mark Under Review
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Approve Batch
              </button>
            </>
          ) : currentBatch.status === 'REVIEW' ? (
            <>
              <button
                onClick={handleCalculate}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Recalculate
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Approve Batch
              </button>
            </>
          ) : currentBatch.status === 'APPROVED' ? (
            <button
              onClick={handlePost}
              disabled={actionLoading || !currentBatch.reconciliation.is_reconciled}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              {actionLoading ? 'Posting to GL...' : 'Post to General Ledger'}
            </button>
          ) : currentBatch.status === 'POSTED' ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Immutable GL Journal: {currentBatch.journal_id}
              </span>
              <button
                onClick={() => setShowReversalModal(true)}
                className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-medium"
              >
                Reverse Batch
              </button>
            </div>
          ) : null}

          {currentBatch && onNavigateToEmail && (
            <button
              onClick={() => onNavigateToEmail(period)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              title="See/edit email drafts and email all investors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email All Investors</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top 10 Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Room Revenue */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Room Revenue (Audited)</span>
            <Coins className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900 truncate">
            {kpis?.has_posted_data ? formatIDR(kpis.room_revenue) : 'No Data'}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {kpis?.has_posted_data ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> PMS Audited
              </span>
            ) : (
              <span className="text-amber-600">No posted data available</span>
            )}
          </div>
        </div>

        {/* Card 2: Owner Pool 65% */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Owner Pool (65%)</span>
            <PieChart className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-black text-blue-900 truncate">
            {formatIDR(kpis?.owner_pool_amount)}
          </div>
          <div className="text-[10px] text-slate-500">65.0% Distributable Fund</div>
        </div>

        {/* Card 3: AMG 35% */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>AMG Allocation (35%)</span>
            <Percent className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-bold text-slate-700 truncate">
            {formatIDR(kpis?.amg_allocation_amount)}
          </div>
          <div className="text-[10px] text-slate-500">Hotel Operator Share</div>
        </div>

        {/* Card 4: Total Eligible SQM */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Total Eligible Area</span>
            <Building className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-lg font-black text-purple-900 truncate">
            {kpis?.total_eligible_sqm?.toLocaleString()} <span className="text-xs font-normal text-slate-500">m²</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {kpis?.eligible_units_count} Active Participating Units
          </div>
        </div>

        {/* Card 5: Gross Return */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Gross Owner Return</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-900 truncate">
            {formatIDR(kpis?.gross_owner_return)}
          </div>
          <div className="text-[10px] text-slate-500">Pool & Guaranteed Returns</div>
        </div>

        {/* Card 6: Tax Withholding */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Tax Withholding</span>
            <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-black text-rose-700 truncate">
            {formatIDR(kpis?.tax_withholding)}
          </div>
          <div className="text-[10px] text-slate-500">PPh Final 4(2) & PPh 23</div>
        </div>

        {/* Card 7: Net Distribution */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Net Distribution</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700 truncate">
            {formatIDR(kpis?.net_distribution)}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold">Cleared for Disbursement</div>
        </div>

        {/* Card 8: Reconciliation Status */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Reconciliation</span>
            <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-sm font-black truncate mt-1">
            {kpis?.reconciliation_status === 'RECONCILED' ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> 100% Balanced
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Requires Review
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500">8 Auditing Checks</div>
        </div>

        {/* Card 9: Guarantee Discrepancy / Shortfall */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Guarantee Variance</span>
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base font-bold text-amber-900 truncate">
            {currentBatch ? formatIDR(currentBatch.total_guarantee_shortfall) : 'Rp 0'}
          </div>
          <div className="text-[10px] text-slate-500">
            {currentBatch ? `${currentBatch.units_with_shortfall_count} units below 10%` : 'No Batch'}
          </div>
        </div>

        {/* Card 10: General Ledger Posting */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>GL Integration</span>
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-sm font-bold text-slate-800 truncate mt-1">
            {currentBatch?.journal_id || 'Not Yet Posted'}
          </div>
          <div className="text-[10px] text-slate-500">Debit 5030 / Credit 2060, 2070</div>
        </div>
      </div>

      {/* 8-Point Reconciliation Banner */}
      {currentBatch && currentBatch.reconciliation && (
        <div className={`p-4 rounded-xl border text-xs space-y-3 ${
          currentBatch.reconciliation.is_reconciled
            ? 'bg-emerald-50/70 border-emerald-200'
            : 'bg-amber-50/70 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentBatch.reconciliation.is_reconciled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              )}
              <span className="font-bold text-slate-900 text-sm">
                8-Point Distribution Financial Integrity & Audit Verification
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              currentBatch.reconciliation.is_reconciled
                ? 'bg-emerald-200 text-emerald-900'
                : 'bg-amber-200 text-amber-900'
            }`}>
              {currentBatch.reconciliation.is_reconciled ? 'ALL CHECKS PASSED' : 'DISCREPANCIES FLAGGED'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check1_pool_plus_amg_equals_revenue ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>1. 65% Pool + 35% AMG = Revenue</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check2_allocations_sum_equals_pool ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>2. Allocations Sum = Pool</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check3_sqm_sum_equals_total_sqm ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>3. SQM Sum = Total SQM</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check4_gross_minus_tax_equals_net ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>4. Gross - Tax = Net Distribution</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check5_all_recipients_valid ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>5. All Recipients Valid</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check6_no_duplicate_units ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>6. No Duplicate Units</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check7_no_inactive_contracts ? 'text-emerald-600' : 'text-rose-600'}`} />
              <span>7. Active Contracts Only</span>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-white/80 rounded border border-slate-200/60">
              <CheckCircle2 className={`w-3.5 h-3.5 ${currentBatch.reconciliation.check8_source_revenue_posted ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span>8. Source Revenue Posted</span>
            </div>
          </div>

          {currentBatch.reconciliation.discrepancy_messages && currentBatch.reconciliation.discrepancy_messages.length > 0 && (
            <div className="p-2.5 bg-amber-100/70 border border-amber-300 rounded text-amber-900 space-y-1">
              {currentBatch.reconciliation.discrepancy_messages.map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Distribution Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3">
        {/* Table Filter Bar */}
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs text-slate-800">
              Unit Allocations & Owner Returns ({filteredLines.length} Units)
            </span>
            <input
              type="text"
              placeholder="Search unit # or owner name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg max-w-xs"
            />
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
            >
              <option value="ALL">All Lines</option>
              <option value="CALCULATED">CALCULATED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="POSTED">POSTED</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div id="owner-distribution-table-area" className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3 text-right">SQM</th>
                <th className="py-2.5 px-3 text-right">Allocation %</th>
                <th className="py-2.5 px-3 text-right">Pool Allocation</th>
                <th className="py-2.5 px-3 text-right">Guaranteed Return</th>
                <th className="py-2.5 px-3 text-right">Tax Withheld</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Distribution</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Loading distribution batch data...
                  </td>
                </tr>
              ) : !currentBatch ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 space-y-2">
                    <p className="font-semibold text-sm">No distribution calculated for {period}</p>
                    <p className="text-xs text-slate-500">
                      Click "Calculate Distribution for {period}" above to run the 14-step dynamic allocation.
                    </p>
                  </td>
                </tr>
              ) : filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No unit records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredLines.map((line) => (
                  <tr key={line.line_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {line.unit_number}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{line.owner_name}</div>
                      <div className="text-[10px] text-slate-500">
                        {line.is_within_guarantee_period ? `Year ${line.contract_year_number} of 3 (Guarantee)` : `Year ${line.contract_year_number} (Post-Guarantee)`}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-900">
                      {line.unit_sqm.toFixed(2)} m²
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">
                      {(line.allocation_pct * 100).toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatIDR(line.pool_allocation_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <div className="font-semibold text-slate-800">
                        {formatIDR(line.monthly_guaranteed_return)}
                      </div>
                      <div className="text-[10px]">
                        {line.difference_flag === 'SHORTFALL' ? (
                          <span className="text-amber-600 font-medium">Shortfall: -{formatIDR(line.guarantee_pool_difference)}</span>
                        ) : line.difference_flag === 'SURPLUS' ? (
                          <span className="text-emerald-600 font-medium">Surplus: +{formatIDR(Math.abs(line.guarantee_pool_difference))}</span>
                        ) : (
                          <span className="text-slate-500">Exact match</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                      - {formatIDR(line.tax_withheld_amount)}
                      <span className="block text-[10px] text-slate-500">{line.tax_rate_pct}%</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 text-sm">
                      {formatIDR(line.net_distribution_amount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          line.status === 'POSTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : line.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {line.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setInspectLine(line)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded text-[11px] transition-colors flex items-center gap-1"
                          title="View step-by-step arithmetic calculation"
                        >
                          <Calculator className="w-3 h-3" />
                          View Calculation
                        </button>
                        {onNavigateToStatement && (
                          <button
                            onClick={() => onNavigateToStatement(line.unit_id)}
                            className="p-1 text-slate-500 hover:text-slate-700 rounded transition-colors"
                            title="Open Printable Statement"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onNavigateToEmail && (
                          <button
                            onClick={() => onNavigateToEmail(period)}
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                            title="See / Edit Email Draft for this Investor"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculation Detail Modal */}
      {inspectLine && currentBatch && (
        <CalculationDetailModal
          line={inspectLine}
          batch={currentBatch}
          onClose={() => setInspectLine(null)}
        />
      )}

      {/* Reversal Confirmation Modal */}
      {showReversalModal && currentBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base">Reverse Posted Distribution</h3>
            </div>
            <p className="text-xs text-slate-500">
              Reversing batch <strong>{currentBatch.batch_id}</strong> will create an offsetting journal voucher to balance General Ledger accounts 5030, 2060, and 2070. Historical records will be marked as REVERSED.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Reversal *
              </label>
              <textarea
                rows={2}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReversalModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReverse}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                {actionLoading ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
