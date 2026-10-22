/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins,
  TrendingDown,
  AlertCircle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  ArrowDownLeft,
  FileText,
  Calendar,
  Building,
  User,
  CreditCard,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Percent,
  Printer,
  Eye,
  Download,
} from 'lucide-react';;
import { ARAgingItem, AgingSummary, Account, Department } from '../../types';
import { api } from '../../services/api';
import { createReportExporter, ReportExportFormat , withTotal } from '../../utils/excelExporter';
import { ReportExportButtons } from '../reports/ReportExportButtons';
import { PrintableReportContainer } from '../reports/PrintableReportContainer';

interface AccountsReceivableModuleProps {
  accounts: Account[];
  departments: Department[];
  onViewJournal?: (journalId: string) => void;
}

export const AccountsReceivableModule: React.FC<AccountsReceivableModuleProps> = ({
  accounts,
  departments,
  onViewJournal,
}) => {
  const [items, setItems] = useState<ARAgingItem[]>([]);
  const [summary, setSummary] = useState<AgingSummary>({
    total_outstanding: 0,
    current: 0,
    bucket_1_30: 0,
    bucket_31_60: 0,
    bucket_61_90: 0,
    bucket_over_90: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(start.toISOString().split('T')[0]);
      setDateTo(end.toISOString().split('T')[0]);
    } else if (preset === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(start.toISOString().split('T')[0]);
      setDateTo(end.toISOString().split('T')[0]);
    } else if (preset === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setDateFrom(start.toISOString().split('T')[0]);
      setDateTo(end.toISOString().split('T')[0]);
    }
  };

  // Settlement Modal State
  const [settlementModalItem, setSettlementModalItem] = useState<ARAgingItem | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settleMethod, setSettleMethod] = useState<string>('Bank Transfer (BCA / Mandiri)');
  const [settleBankAcc, setSettleBankAcc] = useState<string>('1010');
  const [settleRef, setSettleRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.account_type === 'Asset' && a.active === 'Y');
  }, [accounts]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getARItems();
      setItems(res.items || []);
      setSummary(
        res.summary || {
          total_outstanding: 0,
          current: 0,
          bucket_1_30: 0,
          bucket_31_60: 0,
          bucket_61_90: 0,
          bucket_over_90: 0,
          count: 0,
        }
      );
    } catch (err: any) {
      console.error('Failed to load AR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (bucketFilter !== 'ALL' && item.aging_bucket !== bucketFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (customerTypeFilter !== 'ALL' && item.customer_type !== customerTypeFilter) return false;
      if (dateFrom && item.invoice_date < dateFrom) return false;
      if (dateTo && item.invoice_date > dateTo) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = item.customer_name.toLowerCase().includes(q);
        const matchTx = item.transaction_id.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        const matchDept = item.department_name.toLowerCase().includes(q);
        if (!matchCust && !matchTx && !matchNotes && !matchDept) return false;
      }
      return true;
    });
  }, [items, bucketFilter, statusFilter, customerTypeFilter, dateFrom, dateTo, searchQuery]);

  const dynamicSummary = useMemo(() => {
    return {
      total_outstanding: filteredItems.reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      current: filteredItems.filter((i) => i.aging_bucket === 'CURRENT').reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      bucket_1_30: filteredItems.filter((i) => i.aging_bucket === '1_30').reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      bucket_31_60: filteredItems.filter((i) => i.aging_bucket === '31_60').reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      bucket_61_90: filteredItems.filter((i) => i.aging_bucket === '61_90').reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      bucket_over_90: filteredItems.filter((i) => i.aging_bucket === 'OVER_90').reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      count: filteredItems.length,
    };
  }, [filteredItems]);

  const handleOpenSettleModal = (item: ARAgingItem) => {
    setSettlementModalItem(item);
    setSettleAmount(item.outstanding_balance.toString());
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleRef(`Ref-${item.transaction_id.substring(4)}`);
    setFeedback(null);
  };

  const handleProcessSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementModalItem) return;

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive payment amount.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);
      const res = await api.recordARSettlement({
        ar_id: settlementModalItem.id,
        amount: amt,
        payment_date: settleDate,
        payment_method: settleMethod,
        bank_account_code: settleBankAcc,
        reference: settleRef,
      });

      setFeedback({
        type: 'success',
        message: `Settlement of Rp ${amt.toLocaleString()} recorded! Journal ${res.journal_id} posted to GL.`,
      });

      await loadData();
      setTimeout(() => {
        setSettlementModalItem(null);
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record settlement.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBucketBadge = (bucket: ARAgingItem['aging_bucket'], days: number) => {
    switch (bucket) {
      case 'CURRENT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/10/80 text-emerald-700 border border-emerald-800/60">
            Current (0d)
          </span>
        );
      case '1_30':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
            1-30 Days ({days}d)
          </span>
        );
      case '31_60':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/10/80 text-amber-300 border border-amber-800/60">
            31-60 Days ({days}d)
          </span>
        );
      case '61_90':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-950/80 text-orange-300 border border-orange-800/60">
            61-90 Days ({days}d)
          </span>
        );
      case 'OVER_90':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-600/10/80 text-rose-300 border border-rose-800/60 animate-pulse">
            &gt;90 Days Overdue ({days}d)
          </span>
        );
    }
  };

  const handlePrint = () => {
    window.dispatchEvent(new CustomEvent('atrium-open-print-preview'));
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    const rows: (string | number)[][] = filteredItems.map((item) => [
      item.invoice_id,
      item.customer_name,
      item.customer_type,
      item.invoice_date,
      item.due_date,
      item.original_amount,
      item.outstanding_amount,
      item.days_overdue,
      item.aging_bucket,
      item.status,
      item.origin_journal_id || '',
    ]);

    // Totals row
    withTotal(rows, [
      'TOTAL',
      '',
      '',
      '',
      '',
      filteredItems.reduce((s, i) => s + (i.original_amount || 0), 0),
      filteredItems.reduce((s, i) => s + (i.outstanding_amount || 0), 0),
      '',
      '',
      '',
      '',
    ]);

    const summaryRows: (string | number)[][] = [
      ['Total AR Ledger', dynamicSummary.total_outstanding],
      ['Current (Not Due)', dynamicSummary.current],
      ['1 - 30 Days Overdue', dynamicSummary.bucket_1_30],
      ['31 - 60 Days Overdue', dynamicSummary.bucket_31_60],
      ['61 - 90 Days Overdue', dynamicSummary.bucket_61_90],
      ['Over 90 Days (Delinquent)', dynamicSummary.bucket_over_90],
    ];

    createReportExporter(format)('AR_Aging_Schedule_PT_Atrium_Management_Group.xlsx', [
      {
        name: 'AR Invoices',
        title: 'ACCOUNTS RECEIVABLE AGING & INVOICE SCHEDULE',
        subtitle: `PT Atrium Management Group • City Ledger & Guest Folios Subledger${dateFrom ? ` (From: ${dateFrom} To: ${dateTo || 'Present'})` : ''}`,
        headers: [
          'Invoice ID',
          'Customer / Client',
          'Type',
          'Invoice Date',
          'Due Date',
          'Original (Rp)',
          'Outstanding (Rp)',
          'Days Overdue',
          'Aging Bucket',
          'Status',
          'Journal Ref',
        ],
        rows,
        colWidths: [16, 28, 14, 14, 14, 18, 18, 14, 15, 12, 18],
      },
      {
        name: 'Aging Summary',
        title: 'ACCOUNTS RECEIVABLE AGING ANALYSIS SUMMARY',
        headers: ['Aging Bucket Category', 'Total Outstanding (Rp)'],
        rows: summaryRows,
        colWidths: [30, 25],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Module Banner & Quick Controls */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded bg-slate-900/20 text-emerald-700 border border-emerald-500/30 font-semibold">
              Automatic Operational Subledger
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs text-slate-500 font-mono">Synced from Revenue &amp; PMS Folios</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
            Accounts Receivable (AR) Monitor &amp; Control
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-1">
            Real-time aging analysis, City Ledger credit control, guest folio collection tracking, and automatic double-entry GL receipt posting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct CSV Download Button */}

          <ReportExportButtons onExport={handleExportExcel} disabled={loading} />

          {/* Toggle PDF Preview */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
              previewMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Toggle Paper Print/PDF Preview"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{previewMode ? 'Screen View' : 'PDF Preview'}</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Print AR Aging Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print to PDF</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync AR Data</span>
          </button>
        </div>
      </div>

      {/* Printable Report Wrapper */}
      <PrintableReportContainer
        reportTitle="Accounts Receivable Aging & City Ledger Schedule"
        reportSubtitle="Sub-Ledger Customer Receivables, Folio Aging & Payment Collection Tracking"
        property="PT Atrium Management Group"
        orientation="landscape"
        previewMode={previewMode}
        onExitPreview={() => setPreviewMode(false)}
        onExportExcel={handleExportExcel}
      >
        <div className="space-y-6">
          {/* AR Aging Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Outstanding */}
        <div className="p-4 rounded-xl bg-white/90 border border-slate-200 shadow-xs">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total AR Ledger</span>
            <Coins className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-lg font-bold font-mono text-white">
            Rp {(dynamicSummary.total_outstanding / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            {dynamicSummary.count} Total Receivables
          </div>
        </div>

        {/* Current (Not Due) */}
        <div className="p-4 rounded-xl bg-white/90 border border-emerald-900/30 shadow-xs">
          <div className="text-[11px] font-mono text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Current (Not Due)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-700">
            Rp {(dynamicSummary.current / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-emerald-700/70 mt-1 font-mono">
            {dynamicSummary.total_outstanding > 0
              ? `${Math.round((dynamicSummary.current / dynamicSummary.total_outstanding) * 100)}% of total`
              : '0%'}
          </div>
        </div>

        {/* 1 - 30 Days */}
        <div className="p-4 rounded-xl bg-white/90 border border-blue-900/30 shadow-xs">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>1 - 30 Days</span>
            <Clock className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-lg font-bold font-mono text-blue-300">
            Rp {(dynamicSummary.bucket_1_30 / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-blue-500/70 mt-1 font-mono">Within standard grace</div>
        </div>

        {/* 31 - 60 Days */}
        <div className="p-4 rounded-xl bg-white/90 border border-amber-900/30 shadow-xs">
          <div className="text-[11px] font-mono text-amber-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>31 - 60 Days</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            Rp {(dynamicSummary.bucket_31_60 / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-amber-700/70 mt-1 font-mono">Follow-up required</div>
        </div>

        {/* 61 - 90 Days */}
        <div className="p-4 rounded-xl bg-white/90 border border-orange-900/30 shadow-xs">
          <div className="text-[11px] font-mono text-orange-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>61 - 90 Days</span>
            <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-lg font-bold font-mono text-orange-300">
            Rp {(dynamicSummary.bucket_61_90 / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-orange-500/70 mt-1 font-mono">Critical collections</div>
        </div>

        {/* Over 90 Days */}
        <div className="p-4 rounded-xl bg-white/90 border border-rose-900/40 shadow-xs">
          <div className="text-[11px] font-mono text-red-600 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>&gt;90 Days Overdue</span>
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
          </div>
          <div className="text-lg font-bold font-mono text-rose-300">
            Rp {(dynamicSummary.bucket_over_90 / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[10px] text-rose-500/70 mt-1 font-mono">Doubtful debt review</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 ml-1" />
          <input
            type="text"
            placeholder="Search guest folio, corporate account, voucher #, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs text-slate-700 placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date / Period Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL">All Periods</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_YEAR">This Year</option>
              <option value="CUSTOM">Custom Range</option>
            </select>

            <span className="text-slate-500">|</span>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset('CUSTOM');
              }}
              style={{ colorScheme: 'dark' }}
              title="From Date"
              placeholder="From"
              className="bg-white border border-slate-200/80 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
            />
            <span className="text-slate-500 text-[11px]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset('CUSTOM');
              }}
              style={{ colorScheme: 'dark' }}
              title="To Date"
              placeholder="To"
              className="bg-white border border-slate-200/80 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => handleDatePresetChange('ALL')}
                className="text-slate-500 hover:text-slate-700 text-xs px-1 font-bold"
                title="Clear date filter"
              >
                ×
              </button>
            )}
          </div>

          {/* Bucket Filter */}
          <select
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Aging Buckets</option>
            <option value="CURRENT">Current (Not Overdue)</option>
            <option value="1_30">1 - 30 Days</option>
            <option value="31_60">31 - 60 Days</option>
            <option value="61_90">61 - 90 Days</option>
            <option value="OVER_90">&gt; 90 Days Overdue</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending (Unpaid)</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="SETTLED">Settled (Full)</option>
          </select>

          {/* Customer Type Filter */}
          <select
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Debtor Channels</option>
            <option value="CITY_LEDGER_CORPORATE">Corporate City Ledger</option>
            <option value="OTA_COLLECT">OTA Channel Collect</option>
            <option value="GUEST_FOLIO">Guest Folio Ledger</option>
            <option value="BANQUET_CLIENT">Banquet / Catering</option>
          </select>
        </div>
      </div>

      {/* AR Aging Table */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-700" />
              Accounts Receivable Aging Schedule
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Showing {filteredItems.length} active receivable items
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-slate-900/10/60 border border-emerald-800/50 px-2.5 py-1 rounded-lg">
            Auto-Linked to Chart of Accounts (1020)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200 uppercase tracking-wider">
                <th className="p-3.5 font-semibold">Debtor / Account</th>
                <th className="p-3.5 font-semibold">Channel Type</th>
                <th className="p-3.5 font-semibold">Invoice / Due Date</th>
                <th className="p-3.5 font-semibold">Department</th>
                <th className="p-3.5 font-semibold text-right">Original Amount</th>
                <th className="p-3.5 font-semibold text-right">Paid Amount</th>
                <th className="p-3.5 font-semibold text-right">Balance Due</th>
                <th className="p-3.5 font-semibold">Aging Bucket</th>
                <th className="p-3.5 font-semibold">Status</th>
                <th className="p-3.5 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">
                    No Accounts Receivable items match your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-850/60 transition-colors group"
                  >
                    <td className="p-3.5 font-medium text-slate-900">
                      <div className="font-semibold text-slate-700">{item.customer_name}</div>
                      <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{item.transaction_id}</span>
                        {item.journal_id && onViewJournal && (
                          <button
                            onClick={() => onViewJournal(item.journal_id)}
                            className="text-emerald-700 hover:text-emerald-700 inline-flex items-center gap-0.5 ml-1"
                            title="Inspect GL Journal"
                          >
                            <span>GL</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700 border border-slate-200">
                        {item.customer_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <div>{item.date}</div>
                      <div className="text-slate-500 text-[10px]">Due: {item.due_date}</div>
                    </td>
                    <td className="p-3.5 text-slate-700">{item.department_name}</td>
                    <td className="p-3.5 font-mono text-right text-slate-700">
                      Rp {item.original_amount.toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-right text-emerald-700">
                      Rp {item.paid_amount.toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-right font-bold text-white">
                      Rp {item.outstanding_balance.toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      {getBucketBadge(item.aging_bucket, item.days_overdue)}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                          item.status === 'SETTLED'
                            ? 'bg-slate-900/10/70 text-emerald-700 border border-emerald-800/60'
                            : item.status === 'PARTIALLY_PAID'
                            ? 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                            : 'bg-slate-900/10/70 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      {item.outstanding_balance > 0 ? (
                        <button
                          onClick={() => handleOpenSettleModal(item)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 mx-auto shadow-xs"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Receive</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Settled</span>
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
      </PrintableReportContainer>

      {/* Collect / Receive Payment Modal */}
      {settlementModalItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-700" />
                  Record Accounts Receivable Settlement
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Debtor: {settlementModalItem.customer_name} ({settlementModalItem.transaction_id})
                </p>
              </div>
              <button
                onClick={() => setSettlementModalItem(null)}
                className="text-slate-500 hover:text-white text-lg font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-slate-900/10/70 border border-emerald-800 text-emerald-700'
                    : 'bg-red-600/10/70 border border-rose-800 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleProcessSettlement} className="space-y-4 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Outstanding AR Due</span>
                  <span className="text-base font-bold text-emerald-700">
                    Rp {settlementModalItem.outstanding_balance.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase">Aging Bucket</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {settlementModalItem.aging_bucket} ({settlementModalItem.days_overdue} days)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Settlement Amount (IDR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={settlementModalItem.outstanding_balance}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-emerald-700 font-mono text-xs font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Receiving Bank / Cash Account (Debit) *
                </label>
                <select
                  value={settleBankAcc}
                  onChange={(e) => setSettleBankAcc(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.account_code} value={acc.account_code}>
                      {acc.account_code} - {acc.account_name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Automatically posts: Debit Bank ({settleBankAcc}) | Credit AR Guest/City Ledger (1020)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Method
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-700 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Bank Transfer (BCA / Mandiri)">Bank Transfer (BCA / Mandiri)</option>
                    <option value="Corporate Virtual Account (VA)">Corporate Virtual Account (VA)</option>
                    <option value="Credit Card Settlement">Credit Card Settlement (EDC)</option>
                    <option value="Direct Cash Folio Settlement">Front Office Cash Deposit</option>
                    <option value="OTA Virtual Card Clearing">OTA Virtual Card Clearing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Payment Reference / Bank Slip #
                  </label>
                  <input
                    type="text"
                    value={settleRef}
                    onChange={(e) => setSettleRef(e.target.value)}
                    placeholder="e.g. TRF-BCA-9812938"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSettlementModalItem(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-xs shadow-emerald-950 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Post AR Receipt &amp; Journal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
