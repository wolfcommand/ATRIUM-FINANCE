/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { Account, Department } from '../types';
import { api } from '../services/api';

interface ManualJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  departments: Department[];
  onCreated: (journalId: string) => void;
}

interface FormLine {
  id: string;
  account_code: string;
  department_code: string;
  debit: string;
  credit: string;
  description: string;
}

export const ManualJournalModal: React.FC<ManualJournalModalProps> = ({
  isOpen,
  onClose,
  accounts,
  departments,
  onCreated,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sourceReference, setSourceReference] = useState('');
  const [createdBy, setCreatedBy] = useState('Zayen (Controller)');
  const [lines, setLines] = useState<FormLine[]>([
    {
      id: '1',
      account_code: '',
      department_code: '',
      debit: '',
      credit: '',
      description: '',
    },
    {
      id: '2',
      account_code: '',
      department_code: '',
      debit: '',
      credit: '',
      description: '',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeAccounts = accounts.filter((a) => a.active === 'Y');
  const activeDepartments = departments.filter((d) => d.active === 'Y');

  // Compute live debits and credits
  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const variance = Math.abs(totalDebit - totalCredit);
  const isBalanced = variance < 0.005 && totalDebit > 0;

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        account_code: '',
        department_code: '',
        debit: '',
        credit: '',
        description: '',
      },
    ]);
  };

  // Auto-Balance feature: automatically append a balancing line for remaining variance
  const handleAutoBalance = () => {
    if (variance < 0.005) return;
    const isDebitNeeded = totalCredit > totalDebit;
    const balancingAmount = variance.toFixed(2);

    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        account_code: '',
        department_code: '',
        debit: isDebitNeeded ? balancingAmount : '',
        credit: isDebitNeeded ? '' : balancingAmount,
        description: 'Penyeimbang Jurnal Otomatis (Balancing Line)',
      },
    ]);
  };

  // Compound template generator
  const applyPresetTemplate = (templateType: 'PETTY_CASH' | 'OWNER_RETURN' | 'PAYROLL') => {
    if (templateType === 'PETTY_CASH') {
      setSourceReference('PCV-BATCH-CLAIM');
      setLines([
        { id: '1', account_code: '5210', department_code: '200', debit: '450000', credit: '', description: 'Bumbu Dapur & Es Kristal Uma Blu' },
        { id: '2', account_code: '6310', department_code: '500', debit: '380000', credit: '', description: 'ATK Kertas HVS & Materai' },
        { id: '3', account_code: '6420', department_code: '600', debit: '220000', credit: '', description: 'Klem Pipa & Sealant Maintenance' },
        { id: '4', account_code: '1010', department_code: '500', debit: '', credit: '1050000', description: 'Pengeluaran Kas Kecil Operasional' },
      ]);
    } else if (templateType === 'OWNER_RETURN') {
      setSourceReference('ODB-COMPOUND-PAYOUT');
      setLines([
        { id: '1', account_code: '5030', department_code: '100', debit: '25000000', credit: '', description: 'Gross Owner Return Allocation' },
        { id: '2', account_code: '2070', department_code: '100', debit: '', credit: '2500000', description: 'Withholding Tax PPh Final 4(2) 10%' },
        { id: '3', account_code: '2080', department_code: '500', debit: '', credit: '8000000', description: 'Cicilan Unit Dialihkan ke PT Keen Eye' },
        { id: '4', account_code: '2060', department_code: '100', debit: '', credit: '14500000', description: 'Net Cash Disbursed to Owner (15th)' },
      ]);
    } else if (templateType === 'PAYROLL') {
      setSourceReference('PAY-MONTHLY-SALARY');
      setLines([
        { id: '1', account_code: '5110', department_code: '100', debit: '18000000', credit: '', description: 'Gaji Pokok Karyawan Rooms' },
        { id: '2', account_code: '5200', department_code: '200', debit: '15000000', credit: '', description: 'Gaji Pokok Karyawan Uma Blu F&B' },
        { id: '3', account_code: '2070', department_code: '500', debit: '', credit: '1650000', description: 'PPh 21 Pajak Karyawan' },
        { id: '4', account_code: '1020', department_code: '500', debit: '', credit: '31350000', description: 'Pembayaran Payroll via Bank Mandiri' },
      ]);
    }
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) {
      setErrorMessage('A double-entry journal voucher requires at least two lines.');
      return;
    }
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof FormLine, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    // If setting debit, clear credit on that line, and vice versa
    if (field === 'debit' && value) {
      updated[idx].credit = '';
    } else if (field === 'credit' && value) {
      updated[idx].debit = '';
    }
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isBalanced) {
      setErrorMessage(
        `Journal is out of balance. Debits (Rp ${totalDebit.toLocaleString('id-ID')}) must strictly equal Credits (Rp ${totalCredit.toLocaleString('id-ID')}).`
      );
      return;
    }

    // Verify accounts
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].account_code) {
        setErrorMessage(`Please select an account for line #${i + 1}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.createJournal({
        header: {
          journal_date: date,
          period: date.substring(0, 7),
          source_type: 'MANUAL',
          source_reference: sourceReference || 'Manual Adjustment Voucher',
          created_by: createdBy,
        },
        lines: lines.map((l) => ({
          account_code: l.account_code,
          department_code: l.department_code,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description,
        })),
      });

      onCreated(res.journal_id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create journal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl overflow-hidden shadow-xs flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white rounded-lg text-emerald-700 border border-slate-200">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                New General Journal Voucher (Manual Entry)
              </h2>
              <p className="text-xs text-slate-500">
                Create adjusting entries, accruals, or reclassifications into the DRAFT workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-950/40 border-b border-red-800/50 px-6 py-2.5 text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Journal Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Source Reference / Voucher #</label>
              <input
                type="text"
                placeholder="e.g. ADJ-2026-09-01, Depreciation Accrual"
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Controller / Auditor Signature</label>
              <input
                type="text"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Lines Table */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Journal Lines ({lines.length})
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  (Compound Split Debit / Split Credit)
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Auto-Balance Button */}
                {!isBalanced && variance > 0.005 && (
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-slate-800/30 font-medium transition-colors"
                    title="Buat baris penyeimbang otomatis sesuai selisih"
                  >
                    <Scale className="w-3 h-3 text-amber-700" />
                    <span>Auto-Balance (+Rp {variance.toLocaleString('id-ID')})</span>
                  </button>
                )}

                {/* Preset Templates */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      applyPresetTemplate(e.target.value as any);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="text-[11px] px-2 py-1 bg-white text-slate-700 border border-slate-200 rounded hover:border-slate-200 focus:outline-hidden"
                >
                  <option value="" disabled>-- Preset Transaksi Majemuk --</option>
                  <option value="PETTY_CASH">Kas Kecil Multi-Beban (3 Dr Biaya / 1 Cr Kas)</option>
                  <option value="OWNER_RETURN">Distribusi Owner (Gross Dr / Pajak & Cicilan Cr / Kas Cr)</option>
                  <option value="PAYROLL">Payroll (Rooms & F&B Dr / PPh 21 & Bank Cr)</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddLine}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-100 text-emerald-700 border border-emerald-500/40 hover:bg-slate-900/10 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Account</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Dept</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Debit (Rp)</th>
                    <th className="py-2.5 px-3 min-w-[120px] text-right">Credit (Rp)</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {lines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <select
                          required
                          value={line.account_code}
                          onChange={(e) => handleLineChange(idx, 'account_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500"
                        >
                          <option value="">-- Select Account --</option>
                          {activeAccounts.map((acc) => (
                            <option key={acc.account_code} value={acc.account_code}>
                              [{acc.account_code}] {acc.account_name} ({acc.account_type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={line.department_code}
                          onChange={(e) => handleLineChange(idx, 'department_code', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500"
                        >
                          <option value="">-- None / General --</option>
                          {activeDepartments.map((dept) => (
                            <option key={dept.department_code} value={dept.department_code}>
                              [{dept.department_code}] {dept.department_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right text-emerald-700 font-semibold outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right text-slate-500 font-semibold outline-none focus:border-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          placeholder="Line note..."
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-500 font-sans"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Balancing Footer */}
                <tfoot className="bg-white/90 border-t border-slate-200 font-semibold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right text-slate-500 font-sans text-xs">
                      Totals &amp; Double-Entry Balance Check:
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700">
                      Rp {totalDebit.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500">
                      Rp {totalCredit.toLocaleString('id-ID')}
                    </td>
                    <td colSpan={2} className="py-3 px-3 font-sans text-xs">
                      {isBalanced ? (
                        <span className="text-emerald-700 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> In Balance
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1 font-medium font-mono text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Diff: Rp {variance.toLocaleString('id-ID')}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Status upon creation: DRAFT (Subject to validation &amp; approval)
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isBalanced}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Creating Voucher...' : 'Save Draft Journal'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
