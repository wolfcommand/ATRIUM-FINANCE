/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Coins,
  TrendingUp,
  Users,
  Award,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ServiceChargeKPIs,
  ServiceChargeCollection,
  ServiceChargeDistributionCycle,
} from '../../../types';

interface ServiceChargeDashboardViewProps {
  kpis: ServiceChargeKPIs | null;
  collections: ServiceChargeCollection[];
  cycles: ServiceChargeDistributionCycle[];
  onNavigateTab: (tab: 'engine' | 'employees' | 'collections') => void;
  onViewJournal?: (journalId: string) => void;
}

export const ServiceChargeDashboardView: React.FC<ServiceChargeDashboardViewProps> = ({
  kpis,
  collections,
  cycles,
  onNavigateTab,
  onViewJournal,
}) => {
  const recentCollections = collections.slice(0, 5);
  const recentCycles = cycles.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero / KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              Trust Liability Pool (Acc. 2030)
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-900/10/80 border border-emerald-800/60 flex items-center justify-center text-emerald-700">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono">
            Rp {(kpis?.trust_liability_balance || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Current balance in staff trust holding
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              10% Guest Check Inflow
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-slate-500">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            Rp {(kpis?.current_month_inflow || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Accumulated guest check tranches
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-amber-700 uppercase tracking-wider font-bold">
              Current Rate / Point
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-900/10/80 border border-amber-800/60 flex items-center justify-center text-amber-700">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300 font-mono">
            Rp {(kpis?.estimated_point_value || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Distributable pool ÷ weighted points
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
              Staff Enrolled
            </span>
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {kpis?.eligible_staff_count || 0}
          </div>
          <p className="text-[11px] text-slate-500">
            Operational team members (Non-ExCom)
          </p>
        </div>
      </div>

      {/* Trust Liability Architecture & Flow Overview */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            USALI 12 Fiduciary Trust Liability Architecture
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Under Southeast Asian hospitality conventions (including Indonesia, Thailand, and Singapore) and USALI 12 accounting principles, the 10% service charge collected on room and F&amp;B checks is <strong>NOT hotel revenue</strong>. It is legally held as a <strong>Trust Liability (Account 2030)</strong> for operational staff. At month-end, the pool is fully distributed to eligible staff based on grade points and attendance, clearing to <strong>Accrued Payroll (Account 2020)</strong> with transparent <strong>PPh 21 Withholding Tax (Account 2040)</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
            <span className="text-emerald-700 font-bold block">1. Guest Tranche Inflow</span>
            <p className="text-[11px] text-slate-500 font-sans">
              10% auto-calculated on guest folios &amp; POS checks.
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
              DR 1020 Cash / Clearing<br />
              CR 2030 Trust Liability
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
            <span className="text-amber-700 font-bold block">2. Points &amp; Seniority Engine</span>
            <p className="text-[11px] text-slate-500 font-sans">
              Base points (1.0 - 2.2) × Seniority (+5%/yr) × (Days / 30).
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
              Rate/Point = Distributable Pool ÷ Total Weighted Points
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
            <span className="text-slate-500 font-bold block">3. Month-End Payroll Post</span>
            <p className="text-[11px] text-slate-500 font-sans">
              Balanced journal clears trust liability to staff payroll.
            </p>
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
              DR 2030 Trust Liability<br />
              CR 2020 Accrued Payroll<br />
              CR 2040 Tax Withholding
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Inflows & Recent Cycles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inflows */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-700" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                Recent Guest Inflow Tranches (10%)
              </h4>
            </div>
            <button
              onClick={() => onNavigateTab('collections')}
              className="text-xs text-emerald-700 hover:text-emerald-700 font-semibold"
            >
              View All ({collections.length}) →
            </button>
          </div>

          <div className="divide-y divide-slate-800/60 text-xs font-mono">
            {recentCollections.map((col) => (
              <div key={col.collection_id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 font-sans block">{col.source.replace('_', ' ')}</span>
                  <span className="text-[10px] text-slate-500">{col.date} • {col.reference_no}</span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-700 font-bold block">
                    Rp {col.service_charge_amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Gross: Rp {col.gross_sales_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Cycles */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                Distribution Cycles &amp; Payroll Close
              </h4>
            </div>
            <button
              onClick={() => onNavigateTab('engine')}
              className="text-xs text-emerald-700 hover:text-emerald-700 font-semibold"
            >
              Open Engine →
            </button>
          </div>

          <div className="divide-y divide-slate-800/60 text-xs font-mono">
            {recentCycles.map((cycle) => (
              <div key={cycle.cycle_id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">{cycle.period}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        cycle.status === 'POSTED_TO_PAYROLL'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-slate-900/10 text-emerald-700 border border-emerald-800'
                      }`}
                    >
                      {cycle.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {cycle.total_staff_count} staff • Rp {cycle.point_value_rate.toLocaleString()} / pt
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-700 font-bold block">
                    Rp {cycle.total_gross_payout.toLocaleString()}
                  </span>
                  {cycle.journal_id && onViewJournal ? (
                    <button
                      onClick={() => onViewJournal(cycle.journal_id!)}
                      className="text-[10px] text-emerald-700 hover:underline"
                    >
                      {cycle.journal_id}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500">Unposted</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
