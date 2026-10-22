/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Database,
  X,
  FileSpreadsheet,
  Building2,
  Scale,
  Receipt,
  Users,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';

interface ResetMockDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const ResetMockDataModal: React.FC<ResetMockDataModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState<{
    journalHeadersCount: number;
    journalLinesCount: number;
    revenueTxCount: number;
    spendingTxCount: number;
    purchaseOrdersCount: number;
    requisitionsCount: number;
    receiptsCount: number;
    inventoryMovementsCount: number;
    ownerBatchesCount: number;
    serviceChargeCyclesCount: number;
    serviceChargeCollectionsCount: number;
    taxObligationsCount: number;
    dispatchesCount: number;
    isCleanSlate: boolean;
    isMockDataCleared: boolean;
  } | null>(null);

  const [clearMaster, setClearMaster] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getMockDataStatus();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to get mock data status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setConfirmClear(false);
      setNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResetData = async () => {
    try {
      setActionLoading(true);
      setNotice(null);
      const res = await api.resetMockData({ clearMaster });
      setNotice({
        type: 'success',
        message: 'All transaction mock data cleared! The system is now in a clean slate state ready for your dummy data entry.',
      });
      await fetchStatus();
      setConfirmClear(false);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to reset mock data',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreDemoData = async () => {
    try {
      setActionLoading(true);
      setNotice(null);
      await api.seedDemoData();
      setNotice({
        type: 'success',
        message: 'Hotel demo sample data (Night Audit, PO, Owner Pool, Service Charge) successfully restored.',
      });
      await fetchStatus();
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to reload demo data',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const totalTransactions = stats
    ? stats.journalHeadersCount +
      stats.revenueTxCount +
      stats.spendingTxCount +
      stats.purchaseOrdersCount +
      stats.ownerBatchesCount +
      stats.serviceChargeCyclesCount
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xs flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900/10/70 border border-amber-800/60 flex items-center justify-center text-amber-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Reset &amp; Manage Mock Data</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-700 font-normal">
                  Testing Mode
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Clear sample data so you can test and verify the system using your own transactions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Notification Alert */}
          {notice && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                notice.type === 'success'
                  ? 'bg-slate-900/10/60 border-emerald-800/60 text-emerald-700'
                  : 'bg-red-600/10/60 border-rose-800/60 text-rose-300'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <div className="leading-relaxed">{notice.message}</div>
            </div>
          )}

          {/* Clean Slate vs Active Data Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${
              stats?.isCleanSlate
                ? 'bg-slate-900/10/30 border-emerald-800/40 text-emerald-700'
                : 'bg-slate-900/10/30 border-amber-800/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {stats?.isCleanSlate ? (
                <div className="p-2 rounded-lg bg-emerald-900/50 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-900/50 text-amber-700">
                  <Scale className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="font-bold text-sm">
                  {stats?.isCleanSlate
                    ? 'Status: Clean Slate'
                    : `Status: ${totalTransactions} Active Sample Transactions`}
                </div>
                <div className="text-xs opacity-80 mt-0.5">
                  {stats?.isCleanSlate
                    ? 'No active journals or transactions. System is 100% ready for your own dummy data.'
                    : 'Sample records currently present. You can purge them below.'}
                </div>
              </div>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-white hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
              title="Refresh status data"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh Status'}
            </button>
          </div>

          {/* Current Dataset Metrics */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3 font-semibold">
              Currently Stored Data Breakdown:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">General Ledger (GL)</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {stats?.journalHeadersCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {stats?.journalLinesCount ?? 0} journal lines
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Operational Transactions</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {(stats?.revenueTxCount ?? 0) + (stats?.spendingTxCount ?? 0)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {stats?.revenueTxCount ?? 0} rev &bull; {stats?.spendingTxCount ?? 0} spend
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Procurement (PO &amp; PR)</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {stats?.purchaseOrdersCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {stats?.requisitionsCount ?? 0} PR &bull; {stats?.receiptsCount ?? 0} receipt
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Owner Pool Distribution</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {stats?.ownerBatchesCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Monthly distribution batches
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Staff Service Charge</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {stats?.serviceChargeCyclesCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {stats?.serviceChargeCollectionsCount ?? 0} collection tranches
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                <span className="text-[11px] text-slate-500 block">Statutory Taxes</span>
                <span className="text-lg font-bold font-mono text-slate-900">
                  {stats?.taxObligationsCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Tax returns &amp; filings
                </span>
              </div>
            </div>
          </div>

          {/* Reset Action Section */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Option 1: Clear All Mock Data (Clean Slate)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Purges all journal entries, revenue records, spending transactions, POs, owner batches, and ledger balances. The Chart of Accounts is preserved so accounts remain ready for your transactions.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clearMaster}
                onChange={(e) => setClearMaster(e.target.checked)}
                className="rounded bg-white border-slate-200 text-rose-600 focus:ring-0"
              />
              <span>
                Also clear inventory item catalog, apartment units, and staff master (total purge)
              </span>
            </label>

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={actionLoading}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs hover:shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Transactions Now</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-red-600/10/80 border border-rose-800 space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5 text-xs text-rose-200">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <strong>Confirm Action:</strong> Are you sure you want to permanently delete all sample transactions? All account balances will reset to Rp 0 and be ready for your testing.
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetData}
                    disabled={actionLoading}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Yes, Purge Data</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Option 2: Restore Sample Hotel Scenario */}
          <div className="p-4 rounded-xl bg-white/60 border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                <span>Option 2: Reload Default Sample Data</span>
              </h5>
              <p className="text-[11px] text-slate-500 mt-0.5">
                To reload the complete hotel operational demo dataset (Night Audit, POs, Owner Pool, and SC), click here.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestoreDemoData}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-200 text-emerald-700 text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5"
            >
              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Restore Demo Data</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white/80 flex justify-between items-center text-xs text-slate-500">
          <div>
            PT Atrium Management Group &bull; Testing Sandbox
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
