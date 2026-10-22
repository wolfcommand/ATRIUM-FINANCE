/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ArrowRight,
  Scale,
  Users,
  DollarSign,
  Briefcase,
  HelpCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';;;
import { ScottExecutiveMatrixSummary, ScottMatrixUnitItem } from '../../../types';
import { api } from '../../../services/api';
import { createReportExporter, ReportExportFormat } from '../../../utils/excelExporter';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { printReportElement } from '../../../utils/printManager';

interface ScottExecutiveMatrixViewProps {
  initialPeriod?: string;
}

export const ScottExecutiveMatrixView: React.FC<ScottExecutiveMatrixViewProps> = ({
  initialPeriod = '2026-09',
}) => {
  const [period, setPeriod] = useState(initialPeriod);
  const [matrix, setMatrix] = useState<ScottExecutiveMatrixSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GROUP_1' | 'GROUP_2' | 'GROUP_3' | 'GROUP_4'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadMatrix = useCallback(async (p: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getScottExecutiveMatrix(p);
      setMatrix(res);
    } catch (err: any) {
      console.error('Failed to load Scott Executive Matrix:', err);
      setError(err.message || 'Failed to load Executive Matrix');
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    loadMatrix(period);
  }, [loadMatrix, period]);

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!matrix || !matrix.units) return;

    createReportExporter(format)(`Scott_Executive_Owner_Matrix_${period}`, [
      {
        name: 'Executive Matrix',
        title: `EXECUTIVE OWNER RETURN & CASHFLOW MATRIX — ${period}`,
        subtitle: `Developer: PT Keen Eye (Scott, MD) | Operator: PT Atrium Management Group (35%)`,
        period,
        headers: [
          'Unit Number',
          'Owner Name',
          'Contract Category',
          'Unit SQM',
          'Purchase Price (IDR)',
          'VAT (IDR)',
          'Return Basis (Price - VAT)',
          'Monthly 10% Guarantee',
          'SQM Pool Share',
          'Shortfall from PT Keen Eye',
          'Excess to PT Atrium',
          'Stay Days',
          'Stay Deduction',
          'Tax Withheld (10%)',
          'Net Return After Tax',
          'Installment to Keen Eye',
          'Remaining Payable to Keen Eye',
          'Cash Payout to Owner (15th)',
          'Bank Name',
          'Bank Account',
        ],
        rows: matrix.units.map((u) => [
          u.unit_number,
          u.owner_name,
          u.category_label,
          u.unit_sqm,
          u.purchase_price,
          u.vat_amount,
          u.return_basis,
          u.monthly_guaranteed_return,
          u.sqm_pool_share_amount,
          u.shortfall_covered_by_keen_eye,
          u.excess_to_atrium_management,
          u.stay_days_month,
          u.stay_deduction_amount,
          u.tax_withheld,
          u.net_return_after_tax,
          u.installment_offset_to_keen_eye,
          u.remaining_payable_to_keen_eye,
          u.cash_payout_amount,
          u.bank_name,
          u.bank_account_number,
        ]),
        colWidths: [12, 28, 28, 10, 18, 14, 18, 18, 16, 18, 16, 10, 14, 14, 18, 18, 20, 18, 14, 18],
      },
    ]);
  };

  const handlePrint = () => {
    printReportElement('scott-matrix-printable-area', {
      title: `Executive Owner Return & Cashflow Matrix — ${period}`,
      subtitle: `PT Keen Eye (Developer Guaranteed Returns) & PT Atrium Management Group (Operator 35%)`,
      orientation: 'landscape',
    });
  };

  const filteredUnits = (matrix?.units || []).filter((u) => {
    if (categoryFilter === 'GROUP_1' && u.category !== '10_PCT_GUARANTEED_FULLY_PAID') return false;
    if (categoryFilter === 'GROUP_2' && u.category !== '10_PCT_GUARANTEED_PARTIALLY_PAID_KEEN_EYE') return false;
    if (categoryFilter === 'GROUP_3' && u.category !== 'POOLED_OWNERS_REVENUE_SHARE') return false;
    if (categoryFilter === 'GROUP_4' && u.category !== 'WHO_GETS_NOTHING_ZERO_RETURN') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        u.unit_number.toLowerCase().includes(q) ||
        u.owner_name.toLowerCase().includes(q) ||
        u.bank_name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-700 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Executive Owner Return &amp; Cashflow Matrix
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Scott's Executive Overview (PT Keen Eye MD)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Comprehensive apartment unit ownership matrix: Detailed breakdown of 10% Guaranteed Return (Fully Paid), PT Keen Eye Installment Deductions, 65% Revenue Share Pool, and Zero-Return Units.
            </p>
          </div>
        </div>

        {/* Period Selector & Action */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs shadow-inner">
            <button
              onClick={() => navigatePeriod(-1)}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <input
                type="month"
                value={period}
                onChange={(e) => e.target.value && setPeriod(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="bg-transparent font-mono font-bold text-slate-900 outline-none cursor-pointer text-xs"
              />
            </div>
            <button
              onClick={() => navigatePeriod(1)}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => loadMatrix(period)}
            className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export Options: CSV, Excel, PDF */}

          <ReportExportButtons onExport={handleExportExcel} disabled={loading || !matrix} />

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            title="Print / Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div id="scott-matrix-printable-area" className="space-y-6">
        {/* 4 Executive Category Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Group 1: 10% Guaranteed - Fully Paid */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'GROUP_1' ? 'ALL' : 'GROUP_1')}
            className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
              categoryFilter === 'GROUP_1'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-emerald-800 uppercase tracking-wider font-semibold">
                Group 1: 10% Guaranteed (Fully Paid)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {matrix?.group1_fully_paid_count || 0}
              </span>
              <span className="text-xs text-slate-500">Fully Paid Units</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Cash Payout to Owners:</span>
              <span className="font-mono font-bold text-emerald-700">
                Rp {((matrix?.units.filter((u) => u.category === '10_PCT_GUARANTEED_FULLY_PAID').reduce((s, u) => s + u.cash_payout_amount, 0)) || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Payout Schedule: 15th of Each Month
            </div>
          </div>

          {/* Group 2: 10% Guaranteed - Cicilan ke Keen Eye */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'GROUP_2' ? 'ALL' : 'GROUP_2')}
            className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
              categoryFilter === 'GROUP_2'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
                : 'border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-amber-800 uppercase tracking-wider font-semibold">
                Group 2: PT Keen Eye Installments
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {matrix?.group2_keen_eye_installment_count || 0}
              </span>
              <span className="text-xs text-amber-700 font-medium">Return Applied to Payable</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Collected by PT Keen Eye:</span>
              <span className="font-mono font-bold text-amber-700">
                Rp {(matrix?.total_installments_collected_by_keen_eye || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Reduces principal payable to Keen Eye
            </div>
          </div>

          {/* Group 3: Pure Pool Owners */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'GROUP_3' ? 'ALL' : 'GROUP_3')}
            className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
              categoryFilter === 'GROUP_3'
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                : 'border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-blue-800 uppercase tracking-wider font-semibold">
                Group 3: Pooled Revenue Share
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {matrix?.group3_pool_owners_count || 0}
              </span>
              <span className="text-xs text-blue-600 font-medium">65% Owner Revenue Pool</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Distribution Basis:</span>
              <span className="font-semibold text-slate-700">Pro-Rata Unit SQM</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Standard pool post-guarantee period
            </div>
          </div>

          {/* Group 4: Who Gets Nothing */}
          <div
            onClick={() => setCategoryFilter(categoryFilter === 'GROUP_4' ? 'ALL' : 'GROUP_4')}
            className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${
              categoryFilter === 'GROUP_4'
                ? 'border-slate-200 ring-2 ring-slate-500/20 bg-slate-50'
                : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                Group 4: Non-Eligible / Zero Return
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-slate-500">
                {matrix?.group4_zero_return_count || 0}
              </span>
              <span className="text-xs text-slate-500">Return = Rp 0</span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Contractual Clause:</span>
              <span className="text-slate-700 font-semibold">No Return Till Fully Paid</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Returns commence upon 100% final settlement
            </div>
          </div>
        </div>

        {/* Financial Settlement Reconciliation Box for Scott & Management */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>Entity Cashflow Settlement: PT Keen Eye &amp; PT Atrium Management</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Card A: PT Keen Eye (Developer) */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 text-sm">PT Keen Eye (Developer)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 font-mono">
                  Scott (MD)
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Guarantor of 10% annual return and beneficiary of unit installment offsets.
              </p>
              <div className="pt-2 border-t border-amber-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Guaranteed Shortfall Subsidized:</span>
                  <span className="font-bold text-rose-600">
                    -Rp {(matrix?.total_shortfall_covered_by_keen_eye || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Installments Received from Return:</span>
                  <span className="font-bold text-emerald-700">
                    +Rp {(matrix?.total_installments_collected_by_keen_eye || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-300 font-bold">
                  <span className="text-slate-800">Net Keen Eye Cashflow:</span>
                  <span className={((matrix?.total_installments_collected_by_keen_eye || 0) - (matrix?.total_shortfall_covered_by_keen_eye || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                    Rp {(((matrix?.total_installments_collected_by_keen_eye || 0) - (matrix?.total_shortfall_covered_by_keen_eye || 0))).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Card B: PT Atrium Management Group (Operator) */}
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 text-sm">PT Atrium Management</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900 font-mono">
                  Operator (35% + Excess)
                </span>
              </div>
              <p className="text-[11px] text-indigo-800">
                Hotel operator and fiduciary distributor of the 65% owner return pool.
              </p>
              <div className="pt-2 border-t border-indigo-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Operator Share (35% Room Rev):</span>
                  <span className="font-bold text-indigo-900">
                    Rp {(matrix?.total_atrium_base_35_pct || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Excess Absorb (Surplus &gt; 10%):</span>
                  <span className="font-bold text-emerald-700">
                    +Rp {(matrix?.total_atrium_excess_absorbed || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-indigo-300 font-bold">
                  <span className="text-slate-800">Total Operator Revenue:</span>
                  <span className="text-indigo-950 font-bold">
                    Rp {(matrix?.total_atrium_gross_revenue || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Card C: Apartment Unit Owners (Pool 65%) */}
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-sm">Owner Return Payout</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 font-mono">
                  Payout 15th
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Net earnings remitted directly to unit owner bank accounts on the 15th.
              </p>
              <div className="pt-2 border-t border-emerald-200 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Return Accrued:</span>
                  <span className="font-bold text-slate-800">
                    Rp {(matrix?.total_gross_return_accrued || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deductions (Tax, Stays &amp; Installments):</span>
                  <span className="font-bold text-slate-700">
                    -Rp {(((matrix?.total_tax_withheld || 0) + (matrix?.total_installments_collected_by_keen_eye || 0) + (matrix?.total_stay_deductions_applied || 0))).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-emerald-300 font-bold">
                  <span className="text-slate-800">Net Bank Transfer Remittance:</span>
                  <span className="text-emerald-700 font-bold">
                    Rp {(matrix?.total_cash_payout_to_owners || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Units Detail Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === 'ALL'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                All Units ({matrix?.units.length || 0})
              </button>
              <button
                onClick={() => setCategoryFilter('GROUP_1')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === 'GROUP_1'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                10% Guaranteed ({matrix?.group1_fully_paid_count || 0})
              </button>
              <button
                onClick={() => setCategoryFilter('GROUP_2')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === 'GROUP_2'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Keen Eye Installments ({matrix?.group2_keen_eye_installment_count || 0})
              </button>
              <button
                onClick={() => setCategoryFilter('GROUP_3')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === 'GROUP_3'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Pure Pool ({matrix?.group3_pool_owners_count || 0})
              </button>
              <button
                onClick={() => setCategoryFilter('GROUP_4')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  categoryFilter === 'GROUP_4'
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Who Gets Nothing ({matrix?.group4_zero_return_count || 0})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search unit or owner name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 w-60 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">Unit &amp; Owner</th>
                  <th className="py-3 px-3">Contract Category</th>
                  <th className="py-3 px-3 text-right">Return Basis (Ex-VAT)</th>
                  <th className="py-3 px-3 text-right">10% Guarantee / Mo</th>
                  <th className="py-3 px-3 text-right">Pool SQM Share</th>
                  <th className="py-3 px-3 text-right">Shortfall (Keen Eye)</th>
                  <th className="py-3 px-3 text-right">Excess (PT Atrium)</th>
                  <th className="py-3 px-3 text-right">Keen Eye Installment</th>
                  <th className="py-3 px-3 text-right">Cash Payout (15th)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-500 font-sans">
                      No units found matching the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((u) => (
                    <tr key={u.unit_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 font-mono">Unit {u.unit_number}</div>
                        <div className="text-[11px] text-slate-500 font-sans truncate max-w-[160px]">{u.owner_name}</div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${u.category_badge}`}>
                          {u.category_label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        Rp {u.return_basis.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {u.category === 'WHO_GETS_NOTHING_ZERO_RETURN'
                          ? 'Rp 0'
                          : `Rp ${u.monthly_guaranteed_return.toLocaleString('id-ID')}`}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        Rp {u.sqm_pool_share_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.shortfall_covered_by_keen_eye > 0 ? (
                          <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            +Rp {u.shortfall_covered_by_keen_eye.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-700">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.excess_to_atrium_management > 0 ? (
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            +Rp {u.excess_to_atrium_management.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-700">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {u.installment_offset_to_keen_eye > 0 ? (
                          <div>
                            <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
                              -Rp {u.installment_offset_to_keen_eye.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                              Rem: Rp {u.remaining_payable_to_keen_eye.toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-700">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {u.cash_payout_amount > 0 ? (
                          <span className="text-emerald-700 font-bold">
                            Rp {u.cash_payout_amount.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">Rp 0 (Offset)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {u.category === 'WHO_GETS_NOTHING_ZERO_RETURN' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Ineligible
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Ready 15th
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  </div>
);
};
