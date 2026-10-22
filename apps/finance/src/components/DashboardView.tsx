/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileCheck,
  ShieldAlert,
  Database,
  ArrowRight,
  BookOpen,
  Scale,
  DollarSign,
  Package,
  Coins,
  Building2,
} from 'lucide-react';
import { PrimaryNavPillar } from '../types';
import { api } from '../services/api';

interface DashboardViewProps {
  onNavigate?: (tab: any) => void;
  onNavigateToPillar?: (pillar: PrimaryNavPillar, subView?: string) => void;
  onOpenMappingModal: () => void;
  onOpenDbStatusModal: () => void;
  dbStatus: any;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onNavigateToPillar,
  onOpenMappingModal,
  onOpenDbStatusModal,
  dbStatus,
}) => {
  const [period, setPeriod] = useState<string>('');
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const goTo = (pillar: PrimaryNavPillar, subView?: string) => {
    if (onNavigateToPillar) {
      onNavigateToPillar(pillar, subView);
    } else if (onNavigate) {
      if (pillar === 'operations') onNavigate(subView === 'spending' ? 'spending' : 'revenue');
      else if (pillar === 'accounting-core') onNavigate(subView === 'ledger' ? 'ledger' : 'workbench');
      else if (pillar === 'configuration') onNavigate('accounts');
      else if (pillar === 'controls-audit') onNavigate('controls');
      else if (pillar === 'administration') onNavigate('admin');
      else onNavigate(pillar);
    }
  };

  const loadMetrics = (p?: string) => {
    setLoading(true);
    api
      .getDashboard(p || undefined)
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboard:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMetrics(period);
  }, [period]);

  const netPeriodOperating =
    (metrics?.postedRevenuePeriod || 0) - (metrics?.postedSpendingPeriod || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <LayoutDashboard className="w-5 h-5 text-emerald-700" />
            <h1 className="text-xl font-bold text-slate-900">
              1. Command Centre &amp; Control Surface
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-900/10/60 border border-emerald-800/40 text-emerald-700">
              EXECUTIVE OVERVIEW
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Central hotel operational control surface computed strictly from verified double-entry journals
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="month"
              value={period || metrics?.currentPeriod || ''}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-slate-700 font-mono outline-none"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row: Revenue, Spending, Net Operating */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Posted Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Today&apos;s Posted Revenue</span>
            <div className="p-2 bg-slate-900/10/60 rounded-lg text-emerald-700 border border-emerald-900/40">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">
            Rp {(metrics?.postedRevenueToday || 0).toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Date: {metrics?.today || 'Today'} (POSTED only)
          </p>
        </div>

        {/* Period Posted Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Period Posted Revenue</span>
            <div className="p-2 bg-slate-900/10/60 rounded-lg text-emerald-700 border border-emerald-900/40">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            Rp {(metrics?.postedRevenuePeriod || 0).toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Period: {metrics?.currentPeriod || 'Current Month'}
          </p>
        </div>

        {/* Period Posted Spending */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Period Posted Spending</span>
            <div className="p-2 bg-slate-900/10/60 rounded-lg text-amber-700 border border-amber-900/40">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono">
            Rp {(metrics?.postedSpendingPeriod || 0).toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Today: Rp {(metrics?.postedSpendingToday || 0).toLocaleString('id-ID')}
          </p>
        </div>

        {/* Net Operating Surplus */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Net Operating Surplus</span>
            <div
              className={`p-2 rounded-lg border ${
                netPeriodOperating >= 0
                  ? 'bg-slate-900/10/60 text-emerald-700 border-emerald-900/40'
                  : 'bg-red-600/10/60 text-red-600 border-rose-900/40'
              }`}
            >
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              netPeriodOperating >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {netPeriodOperating < 0 ? '-Rp ' : 'Rp '}
            {Math.abs(netPeriodOperating).toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Revenue minus Expense (Period)
          </p>
        </div>
      </div>

      {/* Action Center: Workflow Exceptions & Awaiting Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Accounting Exceptions & Pending Journals */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Controller Action Queue &amp; Exceptions</span>
            </h2>
            <button
              onClick={() => onNavigate('workbench')}
              className="text-xs text-emerald-700 hover:text-emerald-700 font-medium flex items-center gap-1"
            >
              <span>Open Journal Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pending Action Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div
              onClick={() => onNavigate('workbench')}
              className="bg-white hover:bg-white/60 cursor-pointer border border-slate-200 rounded-xl p-4 transition-colors"
            >
              <span className="text-xs text-slate-500 block font-medium">Drafts to Validate</span>
              <div className="text-xl font-bold text-sky-400 font-mono mt-1">
                {metrics?.awaitingValidationCount || 0}
              </div>
              <span className="text-[10px] text-slate-500">Awaiting balance checks</span>
            </div>

            <div
              onClick={() => onNavigate('workbench')}
              className="bg-white hover:bg-white/60 cursor-pointer border border-slate-200 rounded-xl p-4 transition-colors"
            >
              <span className="text-xs text-slate-500 block font-medium">Awaiting Approval</span>
              <div className="text-xl font-bold text-indigo-400 font-mono mt-1">
                {metrics?.awaitingApprovalCount || 0}
              </div>
              <span className="text-[10px] text-slate-500">Controller sign-off</span>
            </div>

            <div
              onClick={() => onNavigate('workbench')}
              className="bg-white hover:bg-white/60 cursor-pointer border border-slate-200 rounded-xl p-4 transition-colors"
            >
              <span className="text-xs text-slate-500 block font-medium">Ready to Post</span>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                {metrics?.awaitingPostingCount || 0}
              </div>
              <span className="text-[10px] text-slate-500">Approved &rarr; Lock to GL</span>
            </div>
          </div>

          {/* Exceptions List */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Audit &amp; System Exceptions
            </h3>

            {!metrics?.exceptions || (metrics.exceptions?.length || 0) === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                <p className="font-medium text-slate-700">No active exceptions</p>
                <p className="text-slate-500 text-[11px]">
                  All journal workflows and account configurations are current.
                </p>
              </div>
            ) : (
              (metrics.exceptions || []).map((exc: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    exc.severity === 'warning'
                      ? 'bg-slate-900/10/20 border-amber-800/40 text-amber-200'
                      : exc.severity === 'error'
                      ? 'bg-red-950/30 border-red-800/50 text-red-200'
                      : 'bg-sky-950/20 border-sky-800/40 text-sky-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">{exc.title}</h4>
                      <p className="opacity-80 mt-0.5 text-[11px] leading-relaxed">{exc.description}</p>
                    </div>
                  </div>
                  {exc.type === 'UNCONFIRMED_MAPPING' && (
                    <button
                      onClick={onOpenMappingModal}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-[11px] rounded shrink-0 transition-colors"
                    >
                      Fix Mapping
                    </button>
                  )}
                  {exc.type === 'APPROVALS_PENDING' && (
                    <button
                      onClick={() => onNavigate('workbench')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] rounded shrink-0 transition-colors"
                    >
                      Review
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Quick Navigation & DB Connection Status */}
        <div className="space-y-4">
          {/* Quick Workflows */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Quick Accounting Workflows
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => goTo('operations', 'revenue')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                  <div>
                    <span className="font-medium text-slate-700 block">2. Operations: Revenue Cycle</span>
                    <span className="text-[11px] text-slate-500">Rooms &amp; F&amp;B Transactions &amp; PMS Ingestion</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => goTo('operations', 'spending')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <ArrowUpRight className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="font-medium text-slate-700 block">2. Operations: Spending Cycle</span>
                    <span className="text-[11px] text-slate-500">Procurement, Vendor AP &amp; Staff Payroll</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => goTo('operations', 'inventory')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="font-medium text-slate-700 block">2. Operations: Hotel Inventory &amp; Storerooms</span>
                    <span className="text-[11px] text-slate-500">Items, Storerooms, Receiving, Issuance &amp; Stocktake</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                id="btn-quick-service-charge"
                onClick={() => goTo('operations', 'service-charge')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Coins className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="font-medium text-slate-700 block">2. Operations: Service Charge &amp; Gratuities Pool</span>
                    <span className="text-[11px] text-slate-500">10% Tranche, Points Matrix &amp; Month-End Payroll Close</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                id="btn-quick-owner-pool"
                onClick={() => goTo('reports', 'owner-pool')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-800/40 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="font-medium text-indigo-200 block">4. Reports: Owner Pool &amp; Return Distribution</span>
                    <span className="text-[11px] text-indigo-400/80">65/35 Allocation, SQM Distribution &amp; 10% Guarantee Audit</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              <button
                onClick={() => goTo('accounting-core', 'workbench')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="font-medium text-slate-700 block">3. Accounting Core: Journal Workbench</span>
                    <span className="text-[11px] text-slate-500">Review Drafts, Approvals &amp; Ledger Postings</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => goTo('reports')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-900/10/30 hover:bg-emerald-900/40 border border-emerald-800/40 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  <div>
                    <span className="font-medium text-emerald-700 block">4. Reports: USALI 12 &amp; Financials</span>
                    <span className="text-[11px] text-emerald-700">Operating Statements, Balance Sheet &amp; 5-Level Drill-Down</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
              </button>

              <button
                onClick={() => goTo('configuration')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="font-medium text-slate-700 block">5. Configuration: Chart of Accounts</span>
                    <span className="text-[11px] text-slate-500">Ledger Accounts, Cost Centers &amp; Clearing Rules</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => goTo('controls-audit')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white hover:bg-white border border-slate-200 text-left transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <div>
                    <span className="font-medium text-slate-700 block">6. Controls &amp; Audit Exceptions</span>
                    <span className="text-[11px] text-slate-500">Continuous Integrity &amp; Cut-Off Scanner</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Google Sheets Database Status Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <Database className="w-4 h-4 text-emerald-700" />
                <span>Google Sheets Datastore</span>
              </div>
              <button
                onClick={onOpenDbStatusModal}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Details
              </button>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status:</span>
                {dbStatus?.connected ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1 font-sans">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold flex items-center gap-1 font-sans">
                    <AlertTriangle className="w-3 h-3" /> Sandbox Mode
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Spreadsheet ID:</span>
                <span className="text-slate-700 truncate max-w-[120px]">
                  {dbStatus?.spreadsheetId || '(Pending secrets)'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
              All records automatically sync across the 6 approved tabs (<code>chart_of_accounts</code>, <code>departments</code>, <code>journal_header</code>, <code>journal_line</code>, <code>revenue_transactions</code>, <code>spending_transactions</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
