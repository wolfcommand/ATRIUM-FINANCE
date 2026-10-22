/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowUpRight,
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
  SpendingTransaction,
  Account,
  Department,
  MappingConfig,
  SpendingType,
} from '../types';
import { api } from '../services/api';
import { AccountsPayableModule } from './ap/AccountsPayableModule';
import { createReportExporter, ReportExportFormat } from '../utils/excelExporter';
import { ReportExportButtons } from './reports/ReportExportButtons';
import { printReportElement } from '../utils/printManager';

interface SpendingCycleViewProps {
  transactions: SpendingTransaction[];
  accounts: Account[];
  departments: Department[];
  mappingConfig?: MappingConfig;
  onRefresh: () => void;
  onOpenMappingModal: () => void;
  onViewJournal: (journalId: string) => void;
}

export const SpendingCycleView: React.FC<SpendingCycleViewProps> = ({
  transactions,
  accounts,
  departments,
  mappingConfig,
  onRefresh,
  onOpenMappingModal,
  onViewJournal,
}) => {
  const [activeCycleTab, setActiveCycleTab] = useState<'AP_MODULE' | 'SPENDING_ENTRY'>('AP_MODULE');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Procurement' as SpendingType,
    vendor_or_employee: '',
    department_code: '',
    account_code: '', // Expense or Asset (Debit)
    amount: '',
    description: '',
    credit_account_code: '', // Counterpart Liability / Cash (Credit)
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    txId: string;
    journalId: string;
  } | null>(null);

  // Expense or Asset accounts
  const expenseAndAssetAccounts = accounts.filter(
    (a) => (a.account_type === 'Expense' || a.account_type === 'Asset') && a.active === 'Y'
  );

  // Liability and Cash accounts (Counterparts)
  const counterpartCreditAccounts = accounts.filter(
    (a) => (a.account_type === 'Liability' || a.account_type === 'Asset') && a.active === 'Y'
  );

  const activeDepartments = departments.filter((d) => d.active === 'Y');

  // Determine current default credit account based on spending type
  const getDefaultCreditAccount = (type: SpendingType) => {
    if (type === 'Procurement') {
      return mappingConfig?.spending_procurement_credit_account || '';
    }
    if (type === 'Payroll') {
      return mappingConfig?.spending_payroll_credit_account || '';
    }
    return mappingConfig?.spending_other_credit_account || '';
  };

  const currentDefaultCredit = getDefaultCreditAccount(formData.type);

  // Spending Log Filter & Export States
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logDept, setLogDept] = useState('ALL');
  const [logType, setLogType] = useState('ALL');

  const filteredTransactions = transactions.filter((tx) => {
    if (logDateFrom && tx.date < logDateFrom) return false;
    if (logDateTo && tx.date > logDateTo) return false;
    if (logDept !== 'ALL' && tx.department_code !== logDept) return false;
    if (logType !== 'ALL' && tx.type !== logType) return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      const matchId = tx.transaction_id.toLowerCase().includes(q);
      const matchPayee = tx.vendor_or_employee.toLowerCase().includes(q);
      const matchDesc = (tx.description || '').toLowerCase().includes(q);
      const matchAcc = tx.account_code.toLowerCase().includes(q);
      if (!matchId && !matchPayee && !matchDesc && !matchAcc) return false;
    }
    return true;
  });

  const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    createReportExporter(format)(`Spending_Transactions_${logDateFrom || 'all'}_to_${logDateTo || 'all'}`, [
      {
        name: 'Spending Log',
        title: 'OPERATIONAL SPENDING & DISBURSEMENT LOG',
        subtitle: `PT Atrium Management Group • Period: ${logDateFrom || 'Start'} to ${logDateTo || 'Present'}`,
        period: logDateFrom ? `${logDateFrom} to ${logDateTo || 'Present'}` : 'All Recorded',
        headers: ['Date', 'Transaction ID', 'Category', 'Payee / Vendor', 'Department', 'Expense Account', 'Amount (Rp)', 'Description', 'Journal ID'],
        rows: filteredTransactions.map((tx) => [
          tx.date,
          tx.transaction_id,
          tx.type,
          tx.vendor_or_employee,
          tx.department_code,
          tx.account_code,
          tx.amount,
          tx.description || '',
          tx.journal_id || '',
        ]),
        colWidths: [14, 18, 14, 24, 12, 14, 18, 30, 18],
      },
    ]);
  };

  const handlePrint = () => {
    printReportElement('spending-transactions-printable-area', {
      title: 'Operational Spending & Disbursement Audit Log',
      subtitle: `PT Atrium Management Group • Total Outflow: Rp ${totalFilteredAmount.toLocaleString('id-ID')}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const counterpart = formData.credit_account_code || currentDefaultCredit;
    if (!counterpart) {
      setErrorMessage(
        `Counterpart Credit account for ${formData.type} is not configured. Please select or confirm default mapping.`
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
      const res = await api.recordSpending({
        date: formData.date,
        type: formData.type,
        vendor_or_employee: formData.vendor_or_employee,
        department_code: formData.department_code,
        account_code: formData.account_code,
        amount: numericAmount,
        description: formData.description,
        credit_account_code: counterpart,
      });

      setSuccessInfo({
        txId: res.transaction.transaction_id,
        journalId: res.draftJournal.journal_id,
      });

      // Reset form fields
      setFormData({
        ...formData,
        vendor_or_employee: '',
        amount: '',
        description: '',
      });

      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record spending transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
              Procurement &amp; Spending Cycle
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <ArrowUpRight className="w-5 h-5 text-amber-700" />
            <span>Procurement Spending &amp; Accounts Payable (AP)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor and control supplier liabilities, aging schedules, and automated double-entry voucher disbursements
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab pills */}
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              onClick={() => setActiveCycleTab('AP_MODULE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeCycleTab === 'AP_MODULE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Accounts Payable (AP)</span>
            </button>
            <button
              onClick={() => setActiveCycleTab('SPENDING_ENTRY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeCycleTab === 'SPENDING_ENTRY'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Spending Voucher</span>
            </button>
          </div>

          <button
            onClick={onOpenMappingModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Payable Mappings</span>
          </button>
        </div>
      </div>

      {activeCycleTab === 'AP_MODULE' ? (
        <AccountsPayableModule
          departments={departments}
          accounts={accounts}
          onViewJournal={onViewJournal}
        />
      ) : (
        <>
          {/* Unmapped Exception Banner */}
      {!currentDefaultCredit && !formData.credit_account_code && (
        <div className="bg-slate-900/10/40 border border-amber-800/50 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-amber-200">
                Accounting Exception: Counterpart Credit Account for {formData.type} Missing
              </h4>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Confirm whether vendor purchases credit Accounts Payable Trade (2010) or Cash clearing before posting.
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

      {/* Notifications */}
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
                Spending transaction recorded: <span className="font-mono">{successInfo.txId}</span>
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

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-700" />
              <span>Record Spending Transaction</span>
            </h2>
            <span className="text-[11px] font-mono uppercase text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Double-Entry
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Date */}
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
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono focus:border-amber-500 outline-none cursor-pointer"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Spending Category *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Procurement', 'Payroll', 'Other'] as SpendingType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t, credit_account_code: '' })}
                    className={`py-1.5 px-2 rounded text-center text-xs font-medium border transition-colors ${
                      formData.type === t
                        ? 'bg-slate-900/10/60 text-amber-300 border-amber-600/60'
                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                {formData.type === 'Procurement' && 'Vendor invoices & goods receipt (AP Trade)'}
                {formData.type === 'Payroll' && 'Payroll batch — API not yet connected (manual entry)'}
                {formData.type === 'Other' && 'Direct cash & miscellaneous disbursement'}
              </p>
            </div>

            {/* Vendor or Employee */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                {formData.type === 'Payroll' ? 'Staff Group / Employee Name *' : 'Vendor / Payee Name *'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  formData.type === 'Payroll'
                    ? 'e.g. Front Office Staff Payroll (Batch #10)'
                    : 'e.g. Sysco Foods, Ecolab, Linen Supplies Co.'
                }
                value={formData.vendor_or_employee}
                onChange={(e) => setFormData({ ...formData, vendor_or_employee: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none font-sans"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Cost Center / Department *</label>
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

            {/* Expense or Asset Account (Debit) */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Expense or Asset Account (Debit) *</label>
              <select
                required
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none font-mono"
              >
                <option value="">-- Select Expense / Asset Account --</option>
                {expenseAndAssetAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Counterpart Credit Account (Liability/Cash) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">Counterpart Credit Account *</label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentDefaultCredit ? `Default: ${currentDefaultCredit}` : 'Not set'}
                </span>
              </div>
              <select
                required
                value={formData.credit_account_code || currentDefaultCredit || ''}
                onChange={(e) => setFormData({ ...formData, credit_account_code: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none font-mono"
              >
                <option value="">-- Select Payable / Settlement Account --</option>
                {counterpartCreditAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Amount (IDR / Rp) *</label>
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
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-mono text-sm focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Description / PO Reference</label>
              <textarea
                rows={2}
                placeholder="e.g. Monthly guest amenities replenishment, Meat & poultry kitchen supplies"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:border-amber-500"
              />
            </div>

            {/* Double-entry preview hint */}
            <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-1 font-mono text-[11px]">
              <div className="text-slate-500 font-sans font-medium">Double-Entry Preview:</div>
              <div className="text-red-600">
                DR: [{formData.account_code || 'Expense Pending'}] Rp{' '}
                {Number(formData.amount || 0).toLocaleString('id-ID')}
              </div>
              <div className="text-amber-700">
                CR: [{formData.credit_account_code || currentDefaultCredit || 'Payable Pending'}] Rp{' '}
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

        {/* Spending Transactions Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Spending Transactions Log ({filteredTransactions.length})</span>
              </h2>
              <span className="text-xs text-slate-500">
                Total Outflow: <span className="font-mono text-red-600 font-semibold">Rp {totalFilteredAmount.toLocaleString('id-ID')}</span>
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
                placeholder="Search vendor, payee, reference, account..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
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
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 text-xs outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="Procurement">Procurement</option>
                <option value="Payroll">Payroll</option>
                <option value="Other">Other</option>
              </select>

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

          <div id="spending-transactions-printable-area" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Payee / Vendor</th>
                    <th className="py-3 px-3">Dept</th>
                    <th className="py-3 px-3">Account</th>
                    <th className="py-3 px-3 text-right">Amount (Rp)</th>
                    <th className="py-3 px-3 text-center">Linked Journal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                        <ArrowUpRight className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-50" />
                        <p className="font-medium text-slate-500">No spending transactions recorded</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Record hotel purchases and payroll above to initiate double-entry journal review.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const acc = (accounts || []).find((a) => a.account_code === tx.account_code);
                      return (
                        <tr key={tx.transaction_id} className="hover:bg-white/40">
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{tx.date}</td>
                          <td className="py-3 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-white text-slate-700 border border-slate-200">
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-700 font-medium truncate max-w-[150px]">
                            {tx.vendor_or_employee}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{tx.department_code}</td>
                          <td className="py-3 px-3">
                            <span className="text-slate-700 font-medium">{tx.account_code}</span>
                            {acc && (
                              <span className="block text-[10px] text-slate-500 font-sans truncate max-w-[130px]">
                                {acc.account_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-red-600">
                            Rp {(tx.amount ?? 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-center font-sans">
                            {tx.journal_id ? (
                              <button
                                onClick={() => onViewJournal(tx.journal_id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-amber-700 border border-slate-200 text-[11px] font-mono transition-colors"
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
