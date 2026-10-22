/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet,
  Plus,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Upload,
  Image as ImageIcon,
  Eye,
  X,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  Building2,
  Calendar,
  User,
  Tag,
  DollarSign,
  HelpCircle,
  ExternalLink,
  Download,
  Printer,
  Search,
  Sparkles,
} from 'lucide-react';;
import {
  PettyCashTransaction,
  PettyCashBalanceSummary,
  PettyCashExpenseCategory,
  Account,
  Department,
} from '../types';
import { api } from '../services/api';
import { createReportExporter, ReportExportFormat } from '../utils/excelExporter';
import { ReportExportButtons } from './reports/ReportExportButtons';
import { printReportElement } from '../utils/printManager';

interface PettyCashViewProps {
  onRefresh?: () => void;
  onViewJournal?: (journalId: string) => void;
}

// Generate an authentic mock receipt SVG data URL for fast testing of photo attachments
function generateMockReceiptSvg(title: string, store: string, amount: number, date: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="490" viewBox="0 0 360 490">
    <rect width="360" height="490" fill="#fdfbf7" stroke="#e2e8f0" stroke-width="2"/>
    <path d="M0,0 L360,0 L360,12 L350,6 L340,12 L330,6 L320,12 L310,6 L300,12 L290,6 L280,12 L270,6 L260,12 L250,6 L240,12 L230,6 L220,12 L210,6 L200,12 L190,6 L180,12 L170,6 L160,12 L150,6 L140,12 L130,6 L120,12 L110,6 L100,12 L90,6 L80,12 L70,6 L60,12 L50,6 L40,12 L30,6 L20,12 L10,6 L0,12 Z" fill="#ffffff"/>
    <text x="180" y="50" font-family="monospace" font-size="15" font-weight="bold" text-anchor="middle" fill="#1e293b">OFFICIAL STORE RECEIPT</text>
    <text x="180" y="74" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle" fill="#334155">${store}</text>
    <text x="180" y="94" font-family="monospace" font-size="10" text-anchor="middle" fill="#64748b">Jl. Danau Tamblingan No. 88, Sanur, Bali</text>
    <line x1="25" y1="110" x2="335" y2="110" stroke="#cbd5e1" stroke-dasharray="4"/>
    <text x="30" y="130" font-family="monospace" font-size="10" fill="#475569">DATE: ${date}</text>
    <text x="30" y="148" font-family="monospace" font-size="10" fill="#475569">RECEIPT #: RC-${Date.now().toString().slice(-6)}</text>
    <text x="30" y="166" font-family="monospace" font-size="10" fill="#475569">PAYMENT: CASH (PETTY CASH FLOAT)</text>
    <line x1="25" y1="180" x2="335" y2="180" stroke="#cbd5e1" stroke-dasharray="4"/>
    <text x="30" y="208" font-family="monospace" font-size="11" font-weight="bold" fill="#1e293b">ITEM / SERVICE DESCRIPTION</text>
    <text x="330" y="208" font-family="monospace" font-size="11" font-weight="bold" text-anchor="end" fill="#1e293b">AMOUNT</text>
    <text x="30" y="235" font-family="monospace" font-size="11" fill="#334155">${title}</text>
    <text x="330" y="235" font-family="monospace" font-size="11" text-anchor="end" fill="#334155">Rp ${amount.toLocaleString('id-ID')}</text>
    <line x1="25" y1="270" x2="335" y2="270" stroke="#cbd5e1"/>
    <text x="30" y="300" font-family="monospace" font-size="13" font-weight="bold" fill="#0f172a">TOTAL PAID</text>
    <text x="330" y="300" font-family="monospace" font-size="14" font-weight="bold" text-anchor="end" fill="#059669">Rp ${amount.toLocaleString('id-ID')}</text>
    <text x="30" y="325" font-family="monospace" font-size="11" fill="#475569">CASH TENDERED</text>
    <text x="330" y="325" font-family="monospace" font-size="11" text-anchor="end" fill="#475569">Rp ${amount.toLocaleString('id-ID')}</text>
    <text x="30" y="345" font-family="monospace" font-size="11" fill="#475569">CHANGE</text>
    <text x="330" y="345" font-family="monospace" font-size="11" text-anchor="end" fill="#475569">Rp 0</text>
    <line x1="25" y1="365" x2="335" y2="365" stroke="#cbd5e1" stroke-dasharray="4"/>
    <text x="180" y="395" font-family="monospace" font-size="11" text-anchor="middle" fill="#64748b">Verified &amp; Received in Good Order</text>
    <text x="180" y="415" font-family="monospace" font-size="10" text-anchor="middle" fill="#94a3b8">THANK YOU FOR YOUR VISIT</text>
    <rect x="125" y="432" width="110" height="26" fill="#e2e8f0" rx="3"/>
    <text x="180" y="449" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle" fill="#475569">AUDIT ATTACHED</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PettyCashView: React.FC<PettyCashViewProps> = ({
  onRefresh,
  onViewJournal,
}) => {
  const [balance, setBalance] = useState<PettyCashBalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'REIMBURSED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReplenishModalOpen, setIsReplenishModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<{ url: string; title: string } | null>(null);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().substring(0, 10));
  const [formCategory, setFormCategory] = useState<PettyCashExpenseCategory>('KITCHEN_EMERGENCY');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaidTo, setFormPaidTo] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formReceiptUrl, setFormReceiptUrl] = useState<string>('');
  const [formReceiptName, setFormReceiptName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Replenish State
  const [replenishNotes, setReplenishNotes] = useState('');
  const [isReplenishing, setIsReplenishing] = useState(false);
  const [replenishSuccessMsg, setReplenishSuccessMsg] = useState<{ claimId: string; journalId: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [balRes, txsRes] = await Promise.all([
        api.getPettyCashBalance(),
        api.getPettyCashTransactions(),
      ]);
      setBalance(balRes);
      setTransactions(txsRes);
    } catch (err: any) {
      console.error('Failed to load petty cash data:', err);
      setError(err.message || 'Failed to load petty cash data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    }
  };

  // Handle Image Upload / Drag and Drop
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPG, PNG, WebP, SVG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormReceiptUrl(reader.result as string);
      setFormReceiptName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Quick Preset Mock Receipt Selector
  const handleApplyMockReceipt = (type: 'KITCHEN' | 'MAINTENANCE' | 'OFFICE') => {
    const today = new Date().toISOString().substring(0, 10);
    setFormDate(today);

    if (type === 'KITCHEN') {
      setFormCategory('KITCHEN_EMERGENCY');
      setFormAmount('320.000');
      setFormPaidTo('Pasar Sanur Fresh Produce');
      setFormDescription('Emergency fresh basil, lemongrass & kaffir lime leaves for dinner service');
      const url = generateMockReceiptSvg('Fresh Produce & Kitchen Herbs', 'Pasar Tradisional Sanur', 320000, today);
      setFormReceiptUrl(url);
      setFormReceiptName('Receipt_Pasar_Sanur_320k.png');
    } else if (type === 'MAINTENANCE') {
      setFormCategory('ENGINEERING_MAINTENANCE');
      setFormAmount('450.000');
      setFormPaidTo('Mitra10 Bypass Sanur');
      setFormDescription('Emergency brass plumbing ball valve & Teflon tape for villa pool pump repair');
      const url = generateMockReceiptSvg('Plumbing Brass Valve 1-inch', 'Mitra10 Supermarket Bahan Bangunan', 450000, today);
      setFormReceiptUrl(url);
      setFormReceiptName('Receipt_Mitra10_Plumbing_450k.png');
    } else if (type === 'OFFICE') {
      setFormCategory('OFFICE_STATIONERY_ADMIN');
      setFormAmount('180.000');
      setFormPaidTo('Kantor Pos Indonesia & JNE');
      setFormDescription('Official duty stamps (Materai Rp 10.000 x 10) & legal document courier');
      const url = generateMockReceiptSvg('Official Materai Stamps & Courier', 'Kantor Pos Sanur & JNE', 180000, today);
      setFormReceiptUrl(url);
      setFormReceiptName('Receipt_DutyStamps_180k.png');
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount.replace(/[^0-9]/g, ''));
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid expense amount in IDR');
      return;
    }
    if (!formPaidTo.trim()) {
      alert('Please enter recipient / store name');
      return;
    }
    if (!formDescription.trim()) {
      alert('Please enter expense description');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createPettyCashTransaction({
        date: formDate,
        category: formCategory,
        amount: amountNum,
        paid_to: formPaidTo.trim(),
        description: formDescription.trim(),
        receipt_image_url: formReceiptUrl || undefined,
        receipt_filename: formReceiptName || undefined,
      });

      setIsAddModalOpen(false);
      // Reset form
      setFormAmount('');
      setFormPaidTo('');
      setFormDescription('');
      setFormReceiptUrl('');
      setFormReceiptName('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save petty cash voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this petty cash voucher?')) {
      return;
    }
    try {
      await api.deletePettyCashTransaction(id);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete voucher');
    }
  };

  const handleReplenish = async () => {
    try {
      setIsReplenishing(true);
      const res = await api.replenishPettyCash({
        notes: replenishNotes.trim() || undefined,
      });
      setReplenishSuccessMsg({
        claimId: res.claim.claim_id,
        journalId: res.journalId,
      });
      setIsReplenishModalOpen(false);
      setReplenishNotes('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to process petty cash replenishment');
    } finally {
      setIsReplenishing(false);
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter === 'PENDING' && tx.status !== 'PENDING_REIMBURSEMENT') return false;
    if (statusFilter === 'REIMBURSED' && tx.status !== 'REIMBURSED') return false;
    if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        tx.voucher_number.toLowerCase().includes(q) ||
        tx.paid_to.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.department_name.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalFilteredDisbursed = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    createReportExporter(format)(`Petty_Cash_Register_${dateFrom || 'all'}_to_${dateTo || 'all'}`, [
      {
        name: 'Petty Cash',
        title: 'OPERATIONAL PETTY CASH REGISTER & VOUCHERS',
        subtitle: `PT Atrium Management Group • Imprest Float System${dateFrom ? ` (Period: ${dateFrom} to ${dateTo || 'Present'})` : ''}`,
        period: dateFrom ? `${dateFrom} to ${dateTo || 'Present'}` : 'All Vouchers',
        headers: [
          'Voucher Number',
          'Date',
          'Category',
          'Department',
          'Paid To / Payee',
          'Description',
          'Amount (Rp)',
          'Status',
          'Receipt',
          'GL Batch',
        ],
        rows: filteredTransactions.map((tx) => [
          tx.voucher_number,
          tx.date,
          tx.category_label,
          tx.department_name,
          tx.paid_to,
          tx.description || '',
          tx.amount,
          tx.status === 'PENDING_REIMBURSEMENT' ? 'Pending Claim' : 'Reimbursed',
          tx.receipt_image_url ? 'Attached' : 'No Receipt',
          tx.reimbursement_id || '-',
        ]),
        colWidths: [16, 12, 22, 16, 22, 32, 16, 14, 12, 14],
      },
    ]);
  };

  const handlePrint = () => {
    printReportElement('petty-cash-printable-area', {
      title: 'Operational Petty Cash Voucher Register',
      subtitle: `PT Atrium Management Group • Total Outflow: Rp ${totalFilteredDisbursed.toLocaleString('id-ID')}`,
    });
  };

  const floatLimit = balance?.float_limit || 10000000;
  const currentBal = balance?.current_balance ?? floatLimit;
  const pendingTotal = balance?.pending_expenses_total || 0;
  const balancePct = Math.round((currentBal / floatLimit) * 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Operational Petty Cash Management
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Fixed Imprest System (Rp 10,000,000)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Daily operational emergency cash disbursements (Uma Blu kitchen spices, guest housekeeping supplies, office duty stamps, urgent repairs) with physical receipt photo attachments and automated reimbursement posting to the General Ledger.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <ReportExportButtons onExport={handleExportExcel} />

          {/* Print PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-200 text-white text-xs font-semibold transition-colors shadow-xs"
            title="Print Voucher Register"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Cash Voucher</span>
          </button>

          <button
            onClick={() => setIsReplenishModalOpen(true)}
            disabled={pendingTotal === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors shadow-xs ${
              pendingTotal > 0
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
                : 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Replenish Float (GL Post)</span>
          </button>
        </div>
      </div>

      {/* Success Notification if Claim was processed */}
      {replenishSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">
                Petty Cash Replenishment Successfully Posted ({replenishSuccessMsg.claimId})
              </p>
              <p className="text-emerald-700 mt-0.5">
                All pending vouchers have been reimbursed and a double-entry cash disbursement voucher has been automatically posted to the General Ledger.
              </p>
            </div>
          </div>
          {onViewJournal && (
            <button
              onClick={() => onViewJournal(replenishSuccessMsg.journalId)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100/50"
            >
              <span>View Journal #{replenishSuccessMsg.journalId}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fixed Float Ceiling */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Imprest Float Ceiling
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              Rp {floatLimit.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-500 font-medium">BCA Account</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Petty Cash GL: 1010</span>
            <span className="text-emerald-600 font-semibold">Active Float</span>
          </div>
        </div>

        {/* Physical Cash on Hand */}
        <div className={`bg-white border rounded-xl p-4 shadow-xs ${balance?.is_low_balance ? 'border-rose-300 ring-2 ring-rose-500/20' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
              Physical Cash in Safe
            </span>
            {balance?.is_low_balance && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Low Float Warning
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-2xl font-bold font-mono ${balance?.is_low_balance ? 'text-rose-600' : 'text-emerald-600'}`}>
              Rp {currentBal.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              {balancePct}% Available
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${balance?.is_low_balance ? 'bg-rose-500' : 'bg-slate-900'}`}
              style={{ width: `${Math.max(0, Math.min(100, balancePct))}%` }}
            />
          </div>
        </div>

        {/* Pending Expenses */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Unclaimed Expenses (Pending)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-amber-600">
              Rp {pendingTotal.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {balance?.pending_vouchers_count || 0} Vouchers
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Ready for GL Reimbursement</span>
            <span className="text-indigo-600 font-semibold cursor-pointer hover:underline" onClick={() => setIsReplenishModalOpen(true)}>
              Claim Now →
            </span>
          </div>
        </div>

        {/* Reimbursed YTD */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Total Reimbursed YTD
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              Rp {(balance?.total_reimbursed_ytd || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-500">Posted in GL</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
            <span>Total Vouchers: {transactions.length}</span>
            <span className="text-emerald-600 font-semibold">100% Reconciled</span>
          </div>
        </div>
      </div>

      {/* Filter and Table Section */}
      <div id="petty-cash-printable-area" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({transactions.length})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'PENDING' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Pending Reimbursement ({transactions.filter((t) => t.status === 'PENDING_REIMBURSEMENT').length})
              </button>
              <button
                onClick={() => setStatusFilter('REIMBURSED')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  statusFilter === 'REIMBURSED' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Reimbursed ({transactions.filter((t) => t.status === 'REIMBURSED').length})
              </button>
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">All Expense Categories</option>
              <option value="KITCHEN_EMERGENCY">Kitchen &amp; Bar Emergency (Uma Blu)</option>
              <option value="HOUSEKEEPING_GUEST_SUPPLIES">Housekeeping &amp; Amenities</option>
              <option value="ENGINEERING_MAINTENANCE">Maintenance &amp; Engineering</option>
              <option value="FRONT_DESK_GUEST_RELATIONS">Front Desk &amp; Guest Care</option>
              <option value="OFFICE_STATIONERY_ADMIN">Office Stationery &amp; Admin</option>
              <option value="TRANSPORT_COURIER">Transport &amp; Courier</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Date Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer pr-1"
              >
                <option value="ALL">All Dates</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
              <span className="text-slate-700">|</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                title="From Date"
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
              />
              <span className="text-slate-500 text-[11px]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset('CUSTOM');
                }}
                title="To Date"
                className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 font-mono outline-none cursor-pointer"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => handleDatePresetChange('ALL')}
                  className="text-slate-500 hover:text-slate-500 text-xs px-1 font-bold"
                  title="Clear dates"
                >
                  ×
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                placeholder="Search voucher, payee, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder-slate-400 text-slate-800 w-full sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={loadData}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-500"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-500 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Voucher &amp; Date</th>
                <th className="py-3 px-4">Category &amp; Department</th>
                <th className="py-3 px-4">Paid To / Payee</th>
                <th className="py-3 px-4">Expense Description</th>
                <th className="py-3 px-4 text-center">Receipt Photo</th>
                <th className="py-3 px-4 text-right">Amount (IDR)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                    <p className="font-medium">No petty cash vouchers matching filter criteria.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Click "Record Cash Voucher" to record an emergency disbursement.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900">{tx.voucher_number}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{tx.date}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        {tx.category_label}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tx.department_name} ({tx.account_code})
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {tx.paid_to}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.receipt_image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewImageUrl({ url: tx.receipt_image_url!, title: `${tx.voucher_number} - ${tx.paid_to}` })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition-colors"
                          title="View attached receipt / evidence photo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Photo</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">No File</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      Rp {tx.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.status === 'PENDING_REIMBURSEMENT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Pending Claim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Reimbursed ({tx.reimbursement_id})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.status === 'PENDING_REIMBURSEMENT' ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete / cancel voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-700 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD EXPENSE VOUCHER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xs border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Record New Petty Cash Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-500 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Mock Sample Data Bar for Testing */}
            <div className="p-3 bg-amber-50/70 border-b border-amber-200/80 px-6">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-900 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Quick Mock Data Presets (Auto-attaches Sample Receipt Photo):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyMockReceipt('KITCHEN')}
                  className="px-2 py-1 rounded bg-white hover:bg-amber-100 text-[11px] text-amber-900 border border-amber-300 font-medium transition-colors"
                >
                  🥗 Kitchen Fresh Herbs (Rp 320k)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyMockReceipt('MAINTENANCE')}
                  className="px-2 py-1 rounded bg-white hover:bg-amber-100 text-[11px] text-amber-900 border border-amber-300 font-medium transition-colors"
                >
                  🔧 Plumbing Valve (Rp 450k)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyMockReceipt('OFFICE')}
                  className="px-2 py-1 rounded bg-white hover:bg-amber-100 text-[11px] text-amber-900 border border-amber-300 font-medium transition-colors"
                >
                  📦 Courier &amp; Stamps (Rp 180k)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Voucher Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Expense Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as PettyCashExpenseCategory)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="KITCHEN_EMERGENCY">Kitchen Emergency (Uma Blu)</option>
                    <option value="HOUSEKEEPING_GUEST_SUPPLIES">Housekeeping Supplies</option>
                    <option value="ENGINEERING_MAINTENANCE">Maintenance &amp; Engineering</option>
                    <option value="FRONT_DESK_GUEST_RELATIONS">Front Desk &amp; Guest Care</option>
                    <option value="OFFICE_STATIONERY_ADMIN">Office Stationery &amp; Admin</option>
                    <option value="TRANSPORT_COURIER">Transport &amp; Courier</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Disbursement Amount (IDR / Rp) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 font-semibold font-mono">
                    Rp
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 250,000"
                    value={formAmount}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setFormAmount(clean ? parseInt(clean, 10).toLocaleString('id-ID') : '');
                    }}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Paid To / Vendor / Payee Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanur Local Market, Mitra10 Bali, Kimia Farma"
                  value={formPaidTo}
                  onChange={(e) => setFormPaidTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Detailed Purpose / Description *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain operational emergency requirement and item details..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* File / Picture Attachment */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Attach Receipt Photo / Evidence Document
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {formReceiptUrl ? (
                  <div className="p-3 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <ImageIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="font-medium text-slate-800 text-xs truncate">
                        {formReceiptName || 'Attached Receipt Document'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl({ url: formReceiptUrl, title: formReceiptName || 'Receipt Preview' })}
                        className="p-1 text-indigo-600 hover:text-indigo-800"
                        title="Preview attached image"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormReceiptUrl('');
                          setFormReceiptName('');
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700"
                        title="Remove attached photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/20"
                  >
                    <Upload className="w-6 h-6 mx-auto text-slate-500 mb-1" />
                    <p className="font-semibold text-slate-700">
                      Click to Upload Receipt Photo / Physical Bill
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports JPG, PNG, WebP or use mock sample buttons above
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-900 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Cash Voucher</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPLENISH / CLAIM TO GL */}
      {isReplenishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xs border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Petty Cash Replenishment &amp; GL Journal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReplenishModalOpen(false)}
                className="text-slate-500 hover:text-slate-500 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[11px] font-mono text-indigo-700 uppercase tracking-wider block">
                  Total Replenishment Reimbursement Amount:
                </span>
                <span className="text-2xl font-bold font-mono text-indigo-900 block mt-1">
                  Rp {pendingTotal.toLocaleString('id-ID')}
                </span>
                <p className="text-[11px] text-indigo-700 mt-1">
                  Summarizes {balance?.pending_vouchers_count || 0} pending operational vouchers. Funds are debited across operational department expenses and credited from Cash in Bank (1010) to restore the physical float to Rp {floatLimit.toLocaleString('id-ID')}.
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Replenishment Audit Notes / Batch Memo
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Mid-period petty cash replenishment batch approved by Controller..."
                  value={replenishNotes}
                  onChange={(e) => setReplenishNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReplenishModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReplenish}
                  disabled={isReplenishing}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  {isReplenishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing GL Journal...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Disburse &amp; Post to GL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: IMAGE PREVIEW */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xs border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs truncate">
                {previewImageUrl.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="text-slate-500 hover:text-slate-500 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewImageUrl.url}
                alt={previewImageUrl.title}
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-xs border border-slate-300 bg-white"
              />
            </div>
            <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
