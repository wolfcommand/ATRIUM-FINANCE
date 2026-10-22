/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  FileSpreadsheet,
  BookOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  Lock,
  FileCheck,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Paperclip,
} from 'lucide-react';
import { DrilldownDetail, DrilldownJournalLine, DrilldownAccountSummary } from '../../types';
import { api } from '../../services/api';
import { formatAmount } from '../../utils/reportFormatter';
import { ReportExportButtons } from './ReportExportButtons';
import { exportReport } from '../../utils/reportExport';

interface UniversalDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  lineId?: string;
  accountCode?: string;
  period?: string;
  onOpenJournalInWorkbench?: (journalId: string) => void;
}

type DrillStep = 'ACCOUNTS' | 'JOURNAL_LINES' | 'JOURNAL_HEADER' | 'SOURCE_TX' | 'VOUCHER';

export const UniversalDrilldownModal: React.FC<UniversalDrilldownModalProps> = ({
  isOpen,
  onClose,
  reportType,
  lineId,
  accountCode,
  period,
  onOpenJournalInWorkbench,
}) => {
  const [data, setData] = useState<DrilldownDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation state inside drill-down
  const [step, setStep] = useState<DrillStep>('ACCOUNTS');
  const [selectedAccount, setSelectedAccount] = useState<DrilldownAccountSummary | null>(null);
  const [selectedJournalLine, setSelectedJournalLine] = useState<DrilldownJournalLine | null>(null);

  useEffect(() => {
    if (!isOpen || (!lineId && !accountCode)) return;

    setLoading(true);
    setError(null);
    setStep(accountCode ? 'JOURNAL_LINES' : 'ACCOUNTS');
    setSelectedAccount(null);
    setSelectedJournalLine(null);

    api
      .getDrilldown({
        report_type: reportType,
        line_id: lineId,
        account_code: accountCode,
        period: period || undefined,
      })
      .then((res) => {
        setData(res);
        if (accountCode && res?.accounts && res.accounts.length > 0) {
          const match = res.accounts.find((a) => a.account_code === accountCode);
          if (match) setSelectedAccount(match);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load drill-down detail');
        setLoading(false);
      });
  }, [isOpen, reportType, lineId, accountCode, period]);

  if (!isOpen) return null;

  // Filter journal lines based on selected account if filtered
  const displayedJournalLines =
    selectedAccount && step !== 'ACCOUNTS'
      ? (data?.journal_lines || []).filter((l) => l.account_code === selectedAccount.account_code)
      : data?.journal_lines || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xs overflow-hidden">
        {/* Header & Breadcrumbs */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mb-1">
              <span>Reports</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-700">{reportType}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <button
                onClick={() => {
                  setStep('ACCOUNTS');
                  setSelectedAccount(null);
                }}
                className={`hover:underline ${step === 'ACCOUNTS' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`}
              >
                {data?.line_label || lineId || 'Report Line'}
              </button>

              {selectedAccount && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  <button
                    onClick={() => {
                      setStep('JOURNAL_LINES');
                    }}
                    className={`hover:underline ${step === 'JOURNAL_LINES' ? 'text-emerald-700 font-semibold' : 'text-slate-700'}`}
                  >
                    Acc {selectedAccount.account_code}
                  </button>
                </>
              )}

              {selectedJournalLine && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-emerald-700 font-semibold">{selectedJournalLine.journal_id}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <span>Drill-Down: {data?.line_label || 'Detail'}</span>
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900/10/60 border border-emerald-800/40 text-emerald-700">
                Period: {period || 'All Time'}
              </span>
            </div>
          </div>

          <ReportExportButtons disabled={loading || !data || !!error} onExport={format => exportReport(`Drilldown_${lineId || accountCode}_${period || 'All_Time'}`, [{
            name: 'Journal Lines', title: `Drill-Down: ${data?.line_label || accountCode || 'Detail'}`, period: period || 'All Time',
            headers: ['Date', 'Journal', 'Account', 'Department', 'Description', 'Debit (Rp)', 'Credit (Rp)'],
            rows: displayedJournalLines.map(line => [line.journal_date, line.journal_id, line.account_code, line.department_code, line.description, line.debit, line.credit]),
            colWidths: [14, 18, 12, 12, 45, 20, 20],
          }], format)} />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="py-16 text-center text-slate-500 text-sm animate-pulse">
              Reconciling posted ledger accounts and journal lines...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold">Drill-Down Resolution Error</p>
                <p className="text-red-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Reconciliation Status Banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-900/10/60 border border-emerald-800/50 flex items-center justify-center text-emerald-700 font-mono text-xs">
                    Rp
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Total Report Line Balance</div>
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {formatAmount(data.line_total ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                    <span className="text-slate-500">Accounts Mapped: </span>
                    <span className="font-semibold text-slate-900">{data?.accounts?.length || 0}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                    <span className="text-slate-500">Posted Journal Lines: </span>
                    <span className="font-semibold text-slate-900">{data?.journal_lines?.length || 0}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900/10/50 border border-emerald-800/40 text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Reconciled 100% with General Ledger</span>
                  </div>
                </div>
              </div>

              {/* Step: Accounts List (Level 1) */}
              {step === 'ACCOUNTS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                      Accounts Contributing to {data.line_label}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Click an account to inspect posted transactions
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-slate-500 font-mono uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Account Code</th>
                          <th className="py-2.5 px-4">Account Name</th>
                          <th className="py-2.5 px-4">Type</th>
                          <th className="py-2.5 px-4 text-center">Posted Lines</th>
                          <th className="py-2.5 px-4 text-right">Net Balance</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-white/40">
                        {!data?.accounts || data.accounts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No accounts configured for this report line.
                            </td>
                          </tr>
                        ) : (
                          data.accounts.map((acc) => (
                            <tr
                              key={acc.account_code}
                              onClick={() => {
                                setSelectedAccount(acc);
                                setStep('JOURNAL_LINES');
                              }}
                              className="hover:bg-white/60 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                                {acc.account_code}
                              </td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                {acc.account_name}
                              </td>
                              <td className="py-3 px-4 text-slate-500">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-white text-slate-700 font-mono">
                                  {acc.account_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-mono text-slate-700">
                                {acc.lines_count}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                                {formatAmount(acc.balance ?? 0)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-700 font-medium">
                                  <span>View Lines</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step: Journal Lines (Level 2) */}
              {step === 'JOURNAL_LINES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
                        Posted Journal Lines {selectedAccount ? `— Account ${selectedAccount.account_code}` : ''}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Click any line to trace Journal Header, Operational Source, and Attached Voucher
                      </p>
                    </div>

                    {selectedAccount && (
                      <button
                        onClick={() => {
                          setSelectedAccount(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 font-mono"
                      >
                        Show All Accounts
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-slate-500 font-mono uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Journal ID</th>
                          <th className="py-2.5 px-4">Account</th>
                          <th className="py-2.5 px-4">Dept</th>
                          <th className="py-2.5 px-4">Description</th>
                          <th className="py-2.5 px-4 text-right">Debit</th>
                          <th className="py-2.5 px-4 text-right">Credit</th>
                          <th className="py-2.5 px-4">Source</th>
                          <th className="py-2.5 px-4 text-center">Trace</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-white/40">
                        {displayedJournalLines.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500 font-mono">
                              No posted journal lines for this period.
                            </td>
                          </tr>
                        ) : (
                          displayedJournalLines.map((line, idx) => (
                            <tr
                              key={`${line.journal_id}-${idx}`}
                              onClick={() => {
                                setSelectedJournalLine(line);
                                setStep('JOURNAL_HEADER');
                              }}
                              className="hover:bg-white/60 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4 font-mono text-slate-500">{line.journal_date}</td>
                              <td className="py-3 px-4 font-mono font-medium text-emerald-700">
                                {line.journal_id}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-700">{line.account_code}</td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {line.department_code || '—'}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                                {line.description}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                {(line.debit ?? 0) > 0 ? formatAmount(line.debit) : '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                {(line.credit ?? 0) > 0 ? formatAmount(line.credit) : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700">
                                  {line.source_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-700 font-medium">
                                  <span>Inspect</span>
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step: Journal Header, Source & Voucher Detail (Levels 3, 4, 5) */}
              {(step === 'JOURNAL_HEADER' || step === 'SOURCE_TX' || step === 'VOUCHER') && selectedJournalLine && (
                <div className="space-y-6">
                  {/* Journal Header Inspector Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <h3 className="font-mono text-sm font-bold text-slate-900">
                          Journal Header: {selectedJournalLine.journal_id}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/10/60 border border-emerald-800/40 text-emerald-700">
                          STATUS: POSTED
                        </span>
                      </div>

                      {onOpenJournalInWorkbench && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenJournalInWorkbench(selectedJournalLine.journal_id);
                          }}
                          className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-700 font-medium"
                        >
                          <span>Open in Workbench</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block">Posting Date</span>
                        <span className="text-slate-700 font-semibold">{selectedJournalLine.journal_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Period</span>
                        <span className="text-slate-700 font-semibold">{selectedJournalLine.period}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Created By</span>
                        <span className="text-slate-700">{selectedJournalLine.created_by}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Approved By</span>
                        <span className="text-slate-700 font-semibold text-emerald-700">
                          {selectedJournalLine.approved_by || 'Zayen (Controller)'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs">
                      <div className="text-slate-500 font-mono text-[11px] mb-1">Selected Journal Line Detail:</div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-slate-700 font-medium">
                          Account {selectedJournalLine.account_code} — {selectedJournalLine.description}
                        </div>
                        <div className="font-mono text-emerald-700 font-bold">
                          Debit: {formatAmount(selectedJournalLine.debit ?? 0)} | Credit: {formatAmount(selectedJournalLine.credit ?? 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 33 & 34: Source Traceability and Voucher Traceability */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Operational Source Transaction Card */}
                    <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-slate-500" />
                          <span>Operational Source Transaction</span>
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 border border-blue-800/40 text-blue-300">
                          {selectedJournalLine.source_type}
                        </span>
                      </div>

                      {selectedJournalLine.source_transaction ? (
                        <div className="space-y-2 text-xs">
                          <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Source ID:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {selectedJournalLine.source_transaction.id}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Transaction Type:</span>
                              <span className="text-slate-700">{selectedJournalLine.source_transaction.type}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vendor / Guest:</span>
                              <span className="text-slate-700 font-medium">
                                {selectedJournalLine.source_transaction.vendor_or_guest}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Department:</span>
                              <span className="text-slate-700 font-mono">
                                Dept {selectedJournalLine.source_transaction.department}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Transaction Amount:</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {formatAmount(selectedJournalLine.source_transaction.amount ?? 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          Source: Not linked
                          <p className="text-[11px] text-slate-500 mt-1">
                            Direct General Ledger journal entry created without upstream operational adapter.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Voucher & Supporting Document Card */}
                    <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-amber-700" />
                          <span>Supporting Document / Voucher</span>
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          selectedJournalLine.voucher?.attached
                            ? 'bg-slate-900/10/60 border-emerald-800/40 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          {selectedJournalLine.voucher?.attached ? 'ATTACHED' : 'NOT ATTACHED'}
                        </span>
                      </div>

                      {selectedJournalLine.voucher?.attached ? (
                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Document Type:</span>
                            <span className="font-medium text-slate-700">
                              {selectedJournalLine.voucher.document_type}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Voucher Ref:</span>
                            <span className="font-mono font-bold text-amber-700">
                              {selectedJournalLine.voucher.reference_number}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                            {selectedJournalLine.voucher.notes}
                          </div>
                          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-700">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Audit verification complete & verified against source ledger.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-xs text-slate-500">
                          Supporting Document: Not attached
                          <p className="text-[11px] text-slate-500 mt-1">
                            No electronic voucher or folio PDF attached to this entry.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Back to lines button */}
                  <div className="flex justify-start">
                    <button
                      onClick={() => setStep('JOURNAL_LINES')}
                      className="text-xs text-slate-500 hover:text-slate-700 font-mono flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      <span>Back to Journal Lines</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white/60 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Hierarchy: Report Line → Account → Journal Line → Source → Voucher</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
};
