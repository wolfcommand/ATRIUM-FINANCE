/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Send,
  Eye,
  Building2,
  DollarSign,
  TrendingUp,
  Award,
  Users,
  Percent,
  Sliders,
  Calendar,
  Layers,
  ArrowRight,
  Printer,
} from 'lucide-react';;
import {
  ServiceChargeDistributionCycle,
  ServiceChargeStaffAllocationLine,
  Department,
} from '../../../types';
import { api } from '../../../services/api';
import { createReportExporter, ReportExportFormat , withTotal } from '../../../utils/excelExporter';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { printReportElement } from '../../../utils/printManager';
import { StaffPaySlipModal } from './StaffPaySlipModal';

interface DistributionEngineViewProps {
  cycles: ServiceChargeDistributionCycle[];
  departments: Department[];
  onRefresh: () => void;
  onViewJournal?: (journalId: string) => void;
}

export const DistributionEngineView: React.FC<DistributionEngineViewProps> = ({
  cycles,
  departments,
  onRefresh,
  onViewJournal,
}) => {
  const [selectedCycleId, setSelectedCycleId] = useState<string>(() => {
    return cycles[0]?.cycle_id || 'SC-2026-08';
  });

  const [activeCycle, setActiveCycle] = useState<ServiceChargeDistributionCycle | null>(() => {
    return cycles.find((c) => c.cycle_id === selectedCycleId) || cycles[0] || null;
  });

  // Pay Slip Modal State
  const [selectedStaffLine, setSelectedStaffLine] = useState<ServiceChargeStaffAllocationLine | null>(null);

  // Recalculation / Wizard State
  const [isCalculating, setIsCalculating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [calcPeriod, setCalcPeriod] = useState('2026-08');
  const [retentionPct, setRetentionPct] = useState(0);
  const [customPoolAmount, setCustomPoolAmount] = useState<number | undefined>(undefined);
  const [overrideDays, setOverrideDays] = useState<Record<string, number>>({});
  const [filterDept, setFilterDept] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Keep activeCycle in sync when selectedCycleId or cycles changes
  React.useEffect(() => {
    const found = cycles.find((c) => c.cycle_id === selectedCycleId);
    if (found) {
      setActiveCycle(found);
    } else if (cycles.length > 0) {
      setActiveCycle(cycles[0]);
      setSelectedCycleId(cycles[0].cycle_id);
    }
  }, [selectedCycleId, cycles]);

  const handleRunCalculation = async () => {
    try {
      setIsCalculating(true);
      setNotice(null);
      const updated = await api.calculateServiceChargeDistribution({
        period: calcPeriod,
        company_retention_pct: retentionPct,
        custom_pool_amount: customPoolAmount,
        staff_days_override: Object.keys(overrideDays).length > 0 ? overrideDays : undefined,
      });
      setActiveCycle(updated);
      setSelectedCycleId(updated.cycle_id);
      onRefresh();
      setNotice({
        type: 'success',
        message: `Successfully calculated distribution for ${calcPeriod}: ${updated.total_staff_count} staff @ Rp ${updated.point_value_rate.toLocaleString()}/point.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Calculation failed' });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApproveAndPost = async () => {
    if (!activeCycle) return;
    if (activeCycle.status === 'POSTED_TO_PAYROLL') {
      alert('This distribution cycle is already posted to the General Ledger and Payroll.');
      return;
    }

    if (
      !window.confirm(
        `Confirm controller approval for ${activeCycle.title}?\n\nThis will generate and post a balanced double-entry journal (Debit Account 2030 Trust Liability, Credit Account 2020 Accrued Payroll & 2040 Tax Withholding) for Rp ${activeCycle.total_gross_payout.toLocaleString()}.`
      )
    ) {
      return;
    }

    try {
      setIsApproving(true);
      setNotice(null);
      const res = await api.approveServiceChargeDistribution(activeCycle.cycle_id, 'Financial Controller');
      setActiveCycle(res.cycle);
      onRefresh();
      setNotice({
        type: 'success',
        message: `Approved & Posted to General Ledger under journal voucher ${res.cycle.journal_id}!`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Approval failed' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDaysChange = (empId: string, days: number) => {
    setOverrideDays((prev) => ({
      ...prev,
      [empId]: days,
    }));
  };

  const getDeptName = (code: string) => {
    const d = departments.find((dept) => dept.department_code === code);
    return d ? d.department_name : `Dept ${code}`;
  };

  // Staff lines filter
  const displayedLines = activeCycle?.lines.filter((line) => {
    const matchesSearch =
      line.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      line.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      line.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'ALL' || line.department_code === filterDept;
    return matchesSearch && matchesDept;
  }) || [];

  const handlePrint = () => {
    printReportElement('service-charge-distribution-table', {
      title: `Service_Charge_Distribution_${activeCycle?.cycle_id || 'Roster'}_${activeCycle?.period || ''}`,
      property: 'PT Atrium Management Group',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!activeCycle) return;

    const rows: (string | number)[][] = displayedLines.map((l) => [
      l.employee_id,
      l.employee_name,
      l.job_title,
      getDeptName(l.department_code),
      l.base_points,
      1 + l.seniority_bonus_pct / 100,
      `${(l.attendance_ratio * 100).toFixed(0)}%`,
      l.effective_points,
      l.gross_payout,
      l.tax_withheld_amount,
      l.net_payout,
    ]);

    withTotal(rows, [
      'TOTAL',
      'Batch Totals',
      '',
      '',
      '',
      '',
      '',
      displayedLines.reduce((s, l) => s + l.effective_points, 0),
      displayedLines.reduce((s, l) => s + l.gross_payout, 0),
      displayedLines.reduce((s, l) => s + l.tax_withheld_amount, 0),
      displayedLines.reduce((s, l) => s + l.net_payout, 0),
    ]);

    const summaryRows: (string | number)[][] = [
      ['Gross Service Charge Collected', activeCycle.total_collected_amount],
      ['Retention / Breakage Reserve', -activeCycle.company_retention_amount],
      ['Net Distributable Pool', activeCycle.distributable_pool_amount],
      ['Total Eligible Staff Points', activeCycle.total_weighted_points],
      ['Point Value (Rate / Point)', activeCycle.point_value_rate],
      ['Total Payout Gross', activeCycle.total_gross_payout],
      ['Total PPh 21 Tax Withheld', activeCycle.total_tax_withheld],
      ['Total Net Disbursed to Staff', activeCycle.total_net_payout],
      ['Status', activeCycle.status],
    ];

    createReportExporter(format)(
      `Service_Charge_Distribution_${activeCycle.period}_PT_Atrium_Management_Group.xlsx`,
      [
        {
          name: 'Staff Allocation',
          title: `STAFF SERVICE CHARGE ALLOCATION ROSTER — ${activeCycle.period}`,
          subtitle: `PT Atrium Management Group • Atrium Suites & Residences Lombok • Status: ${activeCycle.status}`,
          headers: [
            'Emp ID',
            'Employee Name',
            'Job Title',
            'Department',
            'Base Pts',
            'Seniority',
            'Attendance',
            'Effective Pts',
            'Gross Amount (Rp)',
            'PPh 21 Tax (Rp)',
            'Net Payout (Rp)',
          ],
          rows,
          colWidths: [12, 28, 22, 22, 10, 10, 12, 14, 18, 16, 18],
        },
        {
          name: 'Pool Summary',
          title: `SERVICE CHARGE POOL SUMMARY & POINT VALUE — ${activeCycle.period}`,
          headers: ['Metric Parameter', 'Value / Amount (Rp)'],
          rows: summaryRows,
          colWidths: [35, 25],
        },
      ]
    );
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-sans ${
            notice.type === 'success'
              ? 'bg-slate-900/10/70 border-emerald-800 text-emerald-700'
              : 'bg-red-600/10/70 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Cycle Selector & Engine Configuration Controls */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-700" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide font-sans">
                Month-End Service Charge Pool Distribution Engine
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Aggregates guest check tranches into Trust Liability (Account 2030), factors attendance &amp; seniority points, and calculates exact rate per point.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ReportExportButtons onExport={handleExportExcel} disabled={!activeCycle} />

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title="Print Service Charge Distribution"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <label className="text-xs text-slate-500 font-mono ml-2">Select Cycle:</label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              {cycles.map((c) => (
                <option key={c.cycle_id} value={c.cycle_id}>
                  {c.cycle_id} ({c.period}) - {c.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculation Parameters / Simulator Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-mono mb-1">Target Period (YYYY-MM)</label>
            <input
              type="month"
              value={calcPeriod}
              onChange={(e) => setCalcPeriod(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-mono mb-1">
              Breakage / Reserve Retention (%): {retentionPct}%
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={retentionPct}
              onChange={(e) => setRetentionPct(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 mt-2"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-mono mb-1">
              Manual Pool Override (Optional)
            </label>
            <input
              type="number"
              placeholder="Auto from Collections"
              value={customPoolAmount || ''}
              onChange={(e) =>
                setCustomPoolAmount(e.target.value ? parseFloat(e.target.value) : undefined)
              }
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunCalculation}
              disabled={isCalculating}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
            >
              <Calculator className="w-4 h-4" />
              <span>{isCalculating ? 'Computing...' : 'Calculate Distribution Pool'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Cycle Status & Financial Proof Card */}
      {activeCycle && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500">{activeCycle.cycle_id}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                    activeCycle.status === 'POSTED_TO_PAYROLL'
                      ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                      : 'bg-slate-900/10 text-emerald-700 border border-emerald-800/60'
                  }`}
                >
                  {activeCycle.status}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1 font-sans">{activeCycle.title}</h2>
            </div>

            {/* Approval & Ledger Action Button */}
            <div className="flex items-center gap-2">
              {activeCycle.status === 'POSTED_TO_PAYROLL' ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                    <span>Disbursed &amp; Posted to Payroll</span>
                  </span>
                  {activeCycle.journal_id && onViewJournal && (
                    <button
                      onClick={() => onViewJournal(activeCycle.journal_id!)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-emerald-700 text-xs font-mono font-bold transition-colors border border-slate-200"
                    >
                      View Journal {activeCycle.journal_id}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleApproveAndPost}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>{isApproving ? 'Posting...' : 'Approve & Post to USALI General Ledger'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Pool Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
            <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Total Trust Inflow
              </span>
              <span className="text-sm font-bold text-slate-700">
                Rp {activeCycle.total_collected_amount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Retention: {activeCycle.company_retention_pct}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Net Distributable Pool
              </span>
              <span className="text-sm font-bold text-emerald-700">
                Rp {activeCycle.distributable_pool_amount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">Account 2030 (Debit)</span>
            </div>

            <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Total Weighted Points
              </span>
              <span className="text-sm font-bold text-slate-700">
                {activeCycle.total_weighted_points.toFixed(2)} pts
              </span>
              <span className="text-[10px] text-slate-500 block">
                {activeCycle.total_staff_count} Operational Staff
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/60 border border-slate-200 ring-1 ring-amber-500/30">
              <span className="text-[10px] text-amber-700 uppercase tracking-wider block font-bold">
                Rate Per Point (Value)
              </span>
              <span className="text-base font-extrabold text-amber-300">
                Rp {activeCycle.point_value_rate.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">Pool ÷ Weighted Pts</span>
            </div>

            <div className="p-3 rounded-lg bg-white/60 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                Net Staff Disbursement
              </span>
              <span className="text-sm font-bold text-slate-700">
                Rp {activeCycle.total_net_payout.toLocaleString()}
              </span>
              <span className="text-[10px] text-red-600 block">
                Tax: Rp {activeCycle.total_tax_withheld.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Double-Entry Ledger Posting Preview */}
          <div className="p-3 rounded-lg bg-white/80 border border-slate-200 text-xs font-mono space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span className="font-bold text-slate-700">USALI Double-Entry General Ledger Reconciliation Proof:</span>
              <span>Balanced Verification: Debits == Credits</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded bg-white border border-slate-200 space-y-1">
                <span className="text-emerald-700 font-bold block">DEBIT (Clearing Liability Pool):</span>
                <div className="flex justify-between">
                  <span>2030 - Staff Service Charge Fund:</span>
                  <span className="font-bold">Rp {activeCycle.total_gross_payout.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-2 rounded bg-white border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold block">CREDIT (Accrued Payroll &amp; Tax):</span>
                <div className="flex justify-between">
                  <span>2020 - Accrued Staff Payroll (Net):</span>
                  <span>Rp {activeCycle.total_net_payout.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>2040 - PPh 21 Tax Withholding:</span>
                  <span>Rp {activeCycle.total_tax_withheld.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Allocation Sheet Table */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="text-xs font-bold text-slate-700 font-sans">
          Staff Points &amp; Payout Allocation Sheet ({displayedLines.length} employees)
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search staff or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          />

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.department_code} value={d.department_code}>
                {d.department_code} - {d.department_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div id="service-charge-distribution-table" className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Dept &amp; Title</th>
                <th className="py-3 px-4">Grade &amp; Base</th>
                <th className="py-3 px-4">Seniority</th>
                <th className="py-3 px-4">Days Worked</th>
                <th className="py-3 px-4">Effective Pts</th>
                <th className="py-3 px-4 text-right">Gross Payout</th>
                <th className="py-3 px-4 text-right">PPh 21 Tax</th>
                <th className="py-3 px-4 text-right">Net Payout</th>
                <th className="py-3 px-4 text-center">Voucher Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {displayedLines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No staff allocation lines to display.
                  </td>
                </tr>
              ) : (
                displayedLines.map((line) => (
                  <tr key={line.employee_id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-sans font-bold text-slate-900">{line.employee_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{line.employee_id}</div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="text-slate-700">{line.job_title}</div>
                      <div className="text-[11px] text-slate-500">
                        {line.department_code} - {getDeptName(line.department_code)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-700">{line.grade_level}</span>
                      <div className="text-[10px] text-emerald-700">{line.base_points.toFixed(1)} pts</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700">{line.years_of_service} yrs</span>
                      <div className="text-[10px] text-emerald-700">+{line.seniority_bonus_pct}%</div>
                    </td>
                    <td className="py-3 px-4">
                      {activeCycle?.status !== 'POSTED_TO_PAYROLL' ? (
                        <input
                          type="number"
                          min="1"
                          max={line.standard_calendar_days}
                          value={overrideDays[line.employee_id] !== undefined ? overrideDays[line.employee_id] : line.days_worked}
                          onChange={(e) => handleDaysChange(line.employee_id, parseInt(e.target.value, 10) || 1)}
                          className="w-16 px-1.5 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      ) : (
                        <span>
                          {line.days_worked} / {line.standard_calendar_days}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      {line.effective_points.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      Rp {line.gross_payout.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 text-[11px]">
                      - Rp {line.tax_withheld_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                      Rp {line.net_payout.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => setSelectedStaffLine(line)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-200 text-slate-700 text-xs transition-colors border border-slate-200"
                        title="View Individual Pay Slip"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-700" />
                        <span>Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Slip Modal */}
      {selectedStaffLine && activeCycle && (
        <StaffPaySlipModal
          line={selectedStaffLine}
          cycle={activeCycle}
          onClose={() => setSelectedStaffLine(null)}
        />
      )}
    </div>
  );
};
