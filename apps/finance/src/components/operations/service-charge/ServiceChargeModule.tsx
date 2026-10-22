/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins,
  LayoutDashboard,
  Calculator,
  Users,
  Receipt,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  Department,
  Account,
  StaffEmployee,
  ServiceChargeCollection,
  ServiceChargeDistributionCycle,
  ServiceChargeKPIs,
} from '../../../types';
import { api } from '../../../services/api';
import { ServiceChargeDashboardView } from './ServiceChargeDashboardView';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { exportReport } from '../../../utils/reportExport';
import { DistributionEngineView } from './DistributionEngineView';
import { EmployeeRegistryView } from './EmployeeRegistryView';
import { CollectionsLogView } from './CollectionsLogView';

interface ServiceChargeModuleProps {
  departments: Department[];
  accounts: Account[];
  onViewJournal?: (journalId: string) => void;
  onRefreshStore?: () => void;
}

export const ServiceChargeModule: React.FC<ServiceChargeModuleProps> = ({
  departments,
  accounts,
  onViewJournal,
  onRefreshStore,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'engine' | 'employees' | 'collections'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [kpis, setKpis] = useState<ServiceChargeKPIs | null>(null);
  const [employees, setEmployees] = useState<StaffEmployee[]>([]);
  const [collections, setCollections] = useState<ServiceChargeCollection[]>([]);
  const [cycles, setCycles] = useState<ServiceChargeDistributionCycle[]>([]);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [kpiRes, empRes, colRes, cycRes] = await Promise.all([
        api.getServiceChargeKPIs(),
        api.getServiceChargeEmployees(),
        api.getServiceChargeCollections(),
        api.getServiceChargeCycles(),
      ]);
      setKpis(kpiRes);
      setEmployees(empRes || []);
      setCollections(colRes || []);
      setCycles(cycRes || []);
    } catch (err) {
      console.error('Failed to load service charge module data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetDefaults = async () => {
    if (
      window.confirm(
        'Reset Service Charge module to standard Southeast Asian luxury hotel defaults (pre-seeded with 10 employees across all grades, 5 collections, and an August 2026 distribution cycle)?'
      )
    ) {
      try {
        await api.resetServiceChargeDefaults();
        await loadData();
        if (onRefreshStore) onRefreshStore();
      } catch (err: any) {
        alert(err.message || 'Failed to reset defaults');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-500">Loading Staff Service Charge &amp; Gratuities Pool...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Title Header Bar */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900/10/80 border border-amber-600/50 flex items-center justify-center text-amber-700 shrink-0 shadow-inner">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                Staff Service Charge &amp; Gratuities Distribution Pool
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/10 text-emerald-700 border border-emerald-800/80 font-bold">
                10% TRANCHE &amp; POINTS
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Autonomous fiduciary trust accounting for Southeast Asian and global hospitality. Pools 10% guest folio charges into Trust Liability (Account 2030), calculates employee grade points, attendance, and seniority multipliers, and executes month-end payroll reconciliation.
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <ReportExportButtons
            onExport={format => exportReport('Service_Charge_Pool_Summary', [
              {
                name: 'Pool Position',
                title: 'STAFF SERVICE CHARGE & GRATUITIES POOL POSITION',
                subtitle: 'Fiduciary trust accounting summary — Account 2030',
                headers: ['Metric', 'Amount / Value'],
                rows: [
                  ['Trust Liability Pool Balance (Acc. 2030)', kpis?.trust_liability_balance ?? 0],
                  ['Current Period Guest Inflow (10%)', kpis?.current_period_collections ?? 0],
                  ['Eligible Operational Staff', kpis?.active_eligible_staff ?? 0],
                  ['Estimated Point Value (Rp / point)', kpis?.estimated_point_value ?? 0],
                  ['Last Distributed Amount', kpis?.last_distributed_amount ?? 0],
                  ['Last Distributed Point Value', kpis?.last_distributed_point_value ?? 0],
                  ['Total All-Time Distributed', kpis?.total_all_time_distributed ?? 0],
                ],
                colWidths: [55, 28],
              },
              {
                name: 'Department Breakdown',
                title: 'ALLOCATION BY OPERATING DEPARTMENT',
                headers: ['Department Code', 'Department', 'Staff Count', 'Allocated Amount (Rp)'],
                rows: (kpis?.department_breakdown || []).map(d => [d.department_code, d.department_name, d.staff_count, d.allocated_amount]),
                colWidths: [18, 34, 14, 24],
              },
              {
                name: 'Distribution Cycles',
                title: 'MONTH-END DISTRIBUTION CYCLE HISTORY',
                headers: ['Cycle', 'Period', 'Status', 'Pool (Rp)', 'Points', 'Point Value (Rp)', 'Gross Payout (Rp)', 'Tax Withheld (Rp)', 'Net Payout (Rp)', 'Journal'],
                rows: cycles.map(c => [c.cycle_id, c.period, c.status, c.distributable_pool_amount, c.total_weighted_points, c.point_value_rate, c.total_gross_payout, c.total_tax_withheld, c.total_net_payout, c.journal_id]),
                colWidths: [16, 12, 16, 20, 12, 18, 20, 18, 20, 18],
              },
            ], format)}
          />

          <button
            onClick={() => {
              loadData();
              if (onRefreshStore) onRefreshStore();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors border border-slate-200"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors border border-slate-200"
            title="Reset to Southeast Asian Standard Seed Data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Primary Sub-Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto pb-px">
        <div className="flex items-center gap-1">
          <button
            id="tab-sc-overview"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-emerald-500 bg-white text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Pool Dashboard &amp; Trust Ledger</span>
          </button>

          <button
            id="tab-sc-engine"
            onClick={() => setActiveTab('engine')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'engine'
                ? 'border-emerald-500 bg-white text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Distribution Engine &amp; Close</span>
            {cycles.some((c) => c.status === 'CALCULATED') && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            id="tab-sc-employees"
            onClick={() => setActiveTab('employees')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'employees'
                ? 'border-emerald-500 bg-white text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Registry &amp; Grade Points ({employees.filter((e) => e.active === 'Y').length})</span>
          </button>

          <button
            id="tab-sc-collections"
            onClick={() => setActiveTab('collections')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'collections'
                ? 'border-emerald-500 bg-white text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Guest Inflow Tranches (10%)</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-500 hidden md:block">
          Account 2030 Fiduciary Trust Liability
        </span>
      </div>

      {/* Render Active Tab View */}
      {activeTab === 'overview' && (
        <ServiceChargeDashboardView
          kpis={kpis}
          collections={collections}
          cycles={cycles}
          onNavigateTab={setActiveTab}
          onViewJournal={onViewJournal}
        />
      )}

      {activeTab === 'engine' && (
        <DistributionEngineView
          cycles={cycles}
          departments={departments}
          onRefresh={loadData}
          onViewJournal={onViewJournal}
        />
      )}

      {activeTab === 'employees' && (
        <EmployeeRegistryView
          employees={employees}
          departments={departments}
          onRefresh={loadData}
        />
      )}

      {activeTab === 'collections' && (
        <CollectionsLogView
          collections={collections}
          departments={departments}
          onRefresh={loadData}
          onViewJournal={onViewJournal}
        />
      )}
    </div>
  );
};
