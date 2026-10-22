/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowDownLeft,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Settings2,
  ArrowRight,
  Calendar,
  Printer,
  Search,
} from 'lucide-react';;;
import {
  RevenueTransaction,
  Account,
  Department,
  MappingConfig,
} from '../types';
import { api } from '../services/api';
import { AccountsReceivableModule } from './ar/AccountsReceivableModule';
import { createReportExporter, ReportExportFormat } from '../utils/excelExporter';
import { ReportExportButtons } from './reports/ReportExportButtons';
import { printReportElement } from '../utils/printManager';

interface RevenueCycleViewProps {
  transactions: RevenueTransaction[];
  accounts: Account[];
  departments: Department[];
  mappingConfig?: MappingConfig;
  onRefresh: () => void;
  onOpenMappingModal: () => void;
  onViewJournal: (journalId: string) => void;
}

export const RevenueCycleView: React.FC<RevenueCycleViewProps> = ({
  transactions,
  accounts,
  departments,
  mappingConfig,
  onRefresh,
  onOpenMappingModal,
  onViewJournal,
}) => {
  const [activeCycleTab, setActiveCycleTab] = useState<'INGESTION' | 'AR_MODULE'>('AR_MODULE');
  const defaultDebit = mappingConfig?.revenue_default_debit_account || '';

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    source: 'Manual' as 'Manual' | 'PMS',
    department_code: '',
    account_code: '',
    amount: '',
    description: '',
    debit_account_code: defaultDebit,
  });

  // Update default debit if mappingConfig loads or updates later
  React.useEffect(() => {
    if (mappingConfig?.revenue_default_debit_account && !formData.debit_account_code) {
      setFormData((prev) => ({
        ...prev,
        debit_account_code: prev.debit_account_code || mappingConfig.revenue_default_debit_account || '',
      }));
    }
  }, [mappingConfig?.revenue_default_debit_account]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    txId: string;
    journalId: string;
  } | null>(null);

  // Revenue Log Filter & Export States
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logDept, setLogDept] = useState('ALL');

  const filteredTransactions = transactions.filter((tx) => {
    if (logDateFrom && tx.date < logDateFrom) return false;
    if (logDateTo && tx.date > logDateTo) return false;
    if (logDept !== 'ALL' && tx.department_code !== logDept) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      const matchId = tx.transaction_id.toLowerCase().includes(q);
      const matchDesc = (tx.description || '').toLowerCase().includes(q);
      const matchAcc = tx.account_code.toLowerCase().includes(q);
      if (!matchId && !matchDesc && !matchAcc) return false;
    }
    return true;
  });

  const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    createReportExporter(format)(`Revenue_Transactions_${logDateFrom || 'all'}_to_${logDateTo || 'all'}`, [
      {
        name: 'Revenue Log',
        title: 'REVENUE INGESTION & AUDIT LOG',
        subtitle: `PT Atrium Management Group • Period: ${logDateFrom || 'Start'} to ${logDateTo || 'Present'}`,
        period: logDateFrom ? `${logDateFrom} to ${logDateTo || 'Present'}` : 'All Recorded',
        headers: ['Date', 'Transaction ID', 'Department', 'Account Code', 'Amount (Rp)', 'Description', 'Journal ID'],
        rows: filteredTransactions.map((tx) => [
          tx.date,
          tx.transaction_id,
          tx.department_code,
          tx.account_code,
          tx.amount,
          tx.description || '',
          tx.journal_id || '',
        ]),
        colWidths: [14, 18, 12, 14, 18, 32, 18],
      },
    ]);
  };

  const handlePrint = () => {
    printReportElement('revenue-transactions-printable-area', {
      title: 'Revenue Ingestion & Transactions Audit Log',
      subtitle: `PT Atrium Management Group • Total Revenue: Rp ${totalFilteredAmount.toLocaleString('id-ID')}`,
    });
  };

  // Active Revenue accounts
  const revenueAccounts = accounts.filter(
    (a) => a.account_type === 'Revenue' && a.active === 'Y'
  );

  // Active Asset/Counterpart accounts
  const assetAccounts = accounts.filter(
    (a) => a.account_type === 'Asset' && a.active === 'Y'
  );

  const activeDepartments = departments.filter((d) => d.active === 'Y');

  // Submit Revenue Entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const counterpart =
      formData.debit_account_code || mappingConfig?.revenue_default_debit_account || '';

    if (!counterpart) {
      setErrorMessage(
        'Counterpart Debit account (e.g. Guest Ledger / Cash in Transit) is not selected. Please select one or configure default mapping.'
      );
      return;
    }

    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Amount must be a positive number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.recordRevenue({
        date: formData.date,
        source: formData.source,
        department_code: formData.department_code,
        account_code: formData.account_code,
        amount: numericAmount,
        description: formData.description,
        debit_account_code: counterpart,
      });

      setSuccessInfo({
        txId: res.transaction.transaction_id,
        journalId: res.draftJournal.journal_id,
      });

      // Reset form fields
      setFormData({
        ...formData,
        amount: '',
        description: '',
      });

      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record revenue transaction');
    } finally {
      setLoading(false);
    }
  };

  const isMappingConfigured = Boolean(
    formData.debit_account_code || mappingConfig?.revenue_default_debit_account
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-slate-900/20 text-emerald-700 border border-emerald-500/30 font-semibold">
              Revenue Operational Cycle
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
            <span>Revenue Cycle &amp; Accounts Receivable (AR)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor and control Accounts Receivable aging, guest folios, and automatic double-entry revenue ingestion
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab pills */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setActiveCycleTab('AR_MODULE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeCycleTab === 'AR_MODULE'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Accounts Receivable (AR)</span>
            </button>
            <button
              onClick={() => setActiveCycleTab('INGESTION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeCycleTab === 'INGESTION'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Revenue Ingestion &amp; Feed</span>
            </button>
          </div>

          <button
            onClick={onOpenMappingModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Mapping</span>
          </button>
        </div>
      </div>

      {activeCycleTab === 'AR_MODULE' ? (
        <AccountsReceivableModule
          accounts={accounts}
          departments={departments}
          onViewJournal={onViewJournal}
        />
      ) : (
        <>
          {/* Unmapped Exception Banner */}
      {!isMappingConfigured && (
        <div className="bg-slate-900/10/40 border border-amber-800/50 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-amber-200">
                Accounting Exception: Revenue Counterpart Asset Account Missing
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Before revenue journals can be generated, you must confirm which asset account (e.g. Guest Ledger or Cash Clearing) receives the debit.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenMappingModal}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-xs rounded-lg shrink-0 transition-colors"
          >
            Configure Mapping
          </button>
        </div>
      )}

      {/* Notification Messages */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg flex items-center justify-between text-xs text-red-200">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-300">
            Dismiss
          </button>
        </div>
      )}

      {successInfo && (
        <div className="p-4 bg-slate-900/10/40 border border-emerald-800/50 rounded-xl flex items-center justify-between text-xs text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <div>
              <p className="font-semibold">
                Transaction recorded: <span className="font-mono">{successInfo.txId}</span>
              </p>
              <p className="text-emerald-700/80">
                Auto-generated Draft Journal: <span className="font-mono font-medium">{successInfo.journalId}</span> (Pending validation and approval)
              </p>
            </div>
          </div>
          <button
            onClick={() => onViewJournal(successInfo.journalId)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
          >
            <span>Review Journal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Form & Summary Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Record Revenue Transaction</span>
            </h2>
            <span className="text-[11px] font-mono uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Manual Form
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Transaction Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">Transaction Date *</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, date: new Date().toISOString().split('T')[0] })}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-white text-slate-700 hover:text-white"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setFormData({ ...formData, date: d.toISOString().split('T')[0] });
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-white text-slate-700 hover:text-white"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono focus:border-emerald-500 outline-none cursor-pointer"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Source System</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none"
              >
                <option value="Manual">Manual Entry</option>
                <option value="PMS">PMS / Folio Batch</option>
              </select>
              {formData.source === 'PMS' && (
                <p className="text-[11px] text-amber-700/90 mt-1 flex items-center gap-1 font-mono">
                  <AlertTriangle className="w-3 h-3" /> Yanolja integration — not yet connected (manual entry mode)
                </p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Operating Department *</label>
              <select
                required
                value={formData.department_code}
                onChange={(e) => setFormData({ ...formData, department_code: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none"
              >
                <option value="">-- Select Department --</option>
                {activeDepartments.map((dept) => (
                  <option key={dept.department_code} value={dept.department_code}>
                    [{dept.department_code}] {dept.department_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Revenue Account (Credit) */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Revenue Account (Credit) *</label>
              <select
                required
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none font-mono"
              >
                <option value="">-- Select Revenue Account --</option>
                {revenueAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name}
                  </option>
                ))}
              </select>
              {revenueAccounts.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  No Revenue accounts found. Please add or seed accounts in Chart of Accounts first.
                </p>
              )}
            </div>

            {/* Counterpart Asset Account (Debit) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">Counterpart Asset Account (Debit) *</label>
                <span className="text-[10px] text-slate-500">Confirmed by Controller</span>
              </div>
              <select
                required
                value={formData.debit_account_code || mappingConfig?.revenue_default_debit_account || ''}
                onChange={(e) => setFormData({ ...formData, debit_account_code: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none font-mono"
              >
                <option value="">-- Select Settlement / Asset Account --</option>
                {assetAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Transaction Amount (IDR / Rp) *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold text-xs">Rp</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-mono text-sm focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Description / Guest Reference</label>
              <textarea
                rows={2}
                placeholder="e.g. Daily night audit rooms revenue, Banquet hall deposit"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Double-entry preview hint */}
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1 font-mono text-[11px]">
              <div className="text-slate-500 font-sans font-medium">Double-Entry Preview:</div>
              <div className="text-emerald-700">
                DR: [{formData.debit_account_code || mappingConfig?.revenue_default_debit_account || 'Asset Pending'}] Rp{' '}
                {Number(formData.amount || 0).toLocaleString('id-ID')}
              </div>
              <div className="text-slate-500">
                CR: [{formData.account_code || 'Revenue Pending'}] Rp{' '}
                {Number(formData.amount || 0).toLocaleString('id-ID')}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Generating Draft Journal...' : 'Record & Draft Journal'}</span>
            </button>
          </form>
        </div>

        {/* Transactions History Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Revenue Transactions Log ({filteredTransactions.length})</span>
              </h2>
              <span className="text-xs text-slate-500">
                Total Ingested: <span className="font-mono text-emerald-700 font-semibold">Rp {totalFilteredAmount.toLocaleString('id-ID')}</span>
              </span>
            </div>

            {/* Export Toolbar */}
            <div className="flex items-center gap-2">
              <ReportExportButtons onExport={handleExportExcel} />
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                title="Print Log / Save to PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Period & Filter Controls */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search reference, description, account..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-slate-500 text-[11px]">Period:</span>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  title="From Date"
                  className="bg-white border border-slate-200/80 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
                />
                <span className="text-slate-500 text-[11px]">to</span>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  title="To Date"
                  className="bg-white border border-slate-200/80 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
                />
                {(logDateFrom || logDateTo) && (
                  <button
                    onClick={() => {
                      setLogDateFrom('');
                      setLogDateTo('');
                    }}
                    className="text-slate-500 hover:text-slate-700 text-xs px-1 font-bold"
                    title="Clear date filter"
                  >
                    ×
                  </button>
                )}
              </div>

              <select
                value={logDept}
                onChange={(e) => setLogDept(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs outline-none"
              >
                <option value="ALL">All Departments</option>
                {activeDepartments.map((d) => (
                  <option key={d.department_code} value={d.department_code}>
                    {d.department_code} - {d.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div id="revenue-transactions-printable-area" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Dept</th>
                    <th className="py-3 px-3">Account</th>
                    <th className="py-3 px-3 text-right">Amount (Rp)</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3 text-center">Linked Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                        <ArrowDownLeft className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                        <p className="font-medium text-slate-500">No revenue transactions recorded</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Record hotel revenues using the form on the left to generate draft journals.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const acc = (accounts || []).find((a) => a.account_code === tx.account_code);
                      return (
                        <tr key={tx.transaction_id} className="hover:bg-white/40">
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{tx.date}</td>
                          <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {tx.transaction_id}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{tx.department_code}</td>
                          <td className="py-3 px-3">
                            <span className="text-slate-700 font-medium">{tx.account_code}</span>
                            {acc && (
                              <span className="block text-[10px] text-slate-500 font-sans truncate max-w-[140px]">
                                {acc.account_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                            Rp {(tx.amount ?? 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-700 truncate max-w-[180px]">
                            {tx.description || '—'}
                          </td>
                          <td className="py-3 px-3 text-center font-sans">
                            {tx.journal_id ? (
                              <button
                                onClick={() => onViewJournal(tx.journal_id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-emerald-700 border border-slate-200 text-[11px] font-mono transition-colors"
                                title="Click to view journal in Workbench"
                              >
                                <Clock className="w-3 h-3" />
                                <span>{tx.journal_id}</span>
                              </button>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Unlinked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
