/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Warehouse,
  Calendar,
  Save,
  Send,
  Lock,
  ExternalLink,
  RefreshCw,
  Scan,
  X,
} from 'lucide-react';
import {
  StockCountSession,
  InventoryStoreroom,
  InventoryItem,
} from '../../types';
import { api } from '../../services/api';

interface StockCountViewProps {
  onViewJournal?: (journalId: string) => void;
  onOpenScanner: () => void;
}

export const StockCountView: React.FC<StockCountViewProps> = ({
  onViewJournal,
  onOpenScanner,
}) => {
  const [sessions, setSessions] = useState<StockCountSession[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [activeSession, setActiveSession] = useState<StockCountSession | null>(null);
  const [loading, setLoading] = useState(true);

  // New Session Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Month-End F&B Storeroom Physical Audit');
  const [newStoreroom, setNewStoreroom] = useState('CSR-01');
  const [newCountedBy, setNewCountedBy] = useState('Internal Auditor & Cost Controller');

  // Active Count Edits
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [countNotes, setCountNotes] = useState<Record<string, string>>({});
  const [savingSession, setSavingSession] = useState(false);
  const [approverName, setApproverName] = useState('Financial Controller');
  const [isApproveOpen, setIsApproveOpen] = useState(false);

  const [notification, setNotification] = useState<{ text: string; journalId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const [sessList, roomList] = await Promise.all([
        api.getStockCountSessions(),
        api.getInventoryStorerooms(),
      ]);
      setSessions(sessList);
      setStorerooms(roomList);
      if (sessList.length > 0 && !activeSession) {
        selectSession(sessList[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const selectSession = (sess: StockCountSession) => {
    setActiveSession(sess);
    const qtys: Record<string, number> = {};
    const notesMap: Record<string, string> = {};
    sess.items.forEach((it) => {
      qtys[it.item_id] = it.physical_quantity;
      notesMap[it.item_id] = it.notes || '';
    });
    setCountedQuantities(qtys);
    setCountNotes(notesMap);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.startStockCount({
        title: newTitle,
        storeroom_id: newStoreroom,
        counted_by: newCountedBy,
      });
      setIsCreateOpen(false);
      await loadSessions();
      selectSession(created);
      setNotification({ text: `New count session "${created.title}" initiated.` });
    } catch (err: any) {
      setError(err.message || 'Failed to start count session');
    }
  };

  const handleSaveCountSheet = async () => {
    if (!activeSession) return;
    setSavingSession(true);
    try {
      const updates = activeSession.items.map((it) => ({
        item_id: it.item_id,
        physical_quantity: countedQuantities[it.item_id] ?? it.physical_quantity,
        notes: countNotes[it.item_id] ?? it.notes,
      }));

      const updated = await api.updateStockCountItems(activeSession.count_id, updates);
      selectSession(updated);
      setNotification({ text: 'Stock count worksheet saved successfully.' });
      await loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to save worksheet');
    } finally {
      setSavingSession(false);
    }
  };

  const handleSubmitAudit = async () => {
    if (!activeSession) return;
    try {
      // first save
      await handleSaveCountSheet();
      const submitted = await api.submitStockCount(activeSession.count_id);
      selectSession(submitted);
      setNotification({
        text: `Count session #${submitted.count_id} submitted for Controller Approval.`,
      });
      await loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to submit count');
    }
  };

  const handleApproveAndPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    setSavingSession(true);
    try {
      const res = await api.approveStockCount(activeSession.count_id, approverName);
      selectSession(res.session);
      setIsApproveOpen(false);
      setNotification({
        text: `Stock count approved! Perpetual inventory ledger balances synchronized and variance journal posted.`,
        journalId: res.journal_id,
      });
      await loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to approve count');
    } finally {
      setSavingSession(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 p-4 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-red-600" />
            <span>Physical Stock Count & Variance Reconciliation</span>
          </h3>
          <p className="text-xs text-slate-500">
            Audit physical items vs perpetual system records. System stock is protected and updates only
            upon Financial Controller sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <Scan className="w-3.5 h-3.5 text-emerald-700" />
            <span>Scan Barcode</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs shadow-rose-950 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Count Session</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-4 rounded-xl bg-slate-900/10/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.text}</span>
          </div>
          {notification.journalId && onViewJournal && (
            <div className="flex items-center gap-2">
              <span className="text-slate-700">GL Variance Journal:</span>
              <button
                onClick={() => onViewJournal(notification.journalId!)}
                className="px-2 py-0.5 bg-slate-100 text-emerald-700 rounded font-mono font-bold flex items-center gap-1"
              >
                <span>{notification.journalId}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-600/10/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sessions Browser Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sessions.map((sess) => {
          const isCurrent = sess.count_id === activeSession?.count_id;
          return (
            <button
              key={sess.count_id}
              onClick={() => selectSession(sess)}
              className={`p-3 rounded-xl border text-left min-w-[240px] flex-shrink-0 transition-all ${
                isCurrent
                  ? 'bg-red-600/10/30 border-rose-500 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-red-600">
                  {sess.count_id}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                    sess.status === 'APPROVED'
                      ? 'bg-slate-900/20 text-emerald-700'
                      : sess.status === 'SUBMITTED'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {sess.status}
                </span>
              </div>
              <div className="text-xs font-bold text-white mt-1 line-clamp-1">{sess.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {sess.storeroom_id} • {sess.date}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Count Session Sheet */}
      {activeSession && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-5 space-y-5">
          {/* Header row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h4 className="text-base font-bold text-white">{activeSession.title}</h4>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-white text-slate-700">
                  {activeSession.count_id}
                </span>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                    activeSession.status === 'APPROVED'
                      ? 'bg-slate-900/20 text-emerald-700'
                      : activeSession.status === 'SUBMITTED'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {activeSession.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Audited Storeroom: <span className="font-mono text-slate-700">{activeSession.storeroom_id}</span> •
                Counted By: <span className="text-slate-700">{activeSession.counted_by}</span>
                {activeSession.approved_by ? ` • Approved By: ${activeSession.approved_by}` : ''}
              </p>
            </div>

            {/* Session Action Buttons */}
            <div className="flex items-center gap-2">
              {activeSession.status === 'IN_PROGRESS' && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveCountSheet}
                    disabled={savingSession}
                    className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Save Draft Counts</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitAudit}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Review</span>
                  </button>
                </>
              )}

              {activeSession.status === 'SUBMITTED' && (
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(true)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs shadow-emerald-950 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Approve & Post Variance</span>
                </button>
              )}

              {activeSession.adjustment_journal_id && onViewJournal && (
                <button
                  type="button"
                  onClick={() => onViewJournal(activeSession.adjustment_journal_id!)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-200 text-emerald-700 text-xs font-mono font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1.5"
                >
                  <span>Journal {activeSession.adjustment_journal_id}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Worksheet Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Item Code</th>
                  <th className="px-3 py-2.5">Item Name</th>
                  <th className="px-3 py-2.5">Bin</th>
                  <th className="px-3 py-2.5 text-right">System Perpetual Qty</th>
                  <th className="px-3 py-2.5 text-right w-36">Physical Counted</th>
                  <th className="px-3 py-2.5 text-right">Qty Variance</th>
                  <th className="px-3 py-2.5 text-right">Unit Avg Cost (Rp)</th>
                  <th className="px-3 py-2.5 text-right">Variance Valuation (Rp)</th>
                  <th className="px-3 py-2.5 min-w-[150px]">Auditor Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {activeSession.items.map((it) => {
                  const physicalVal = countedQuantities[it.item_id] ?? it.physical_quantity;
                  const varianceQty = physicalVal - it.system_quantity;
                  const varianceVal = varianceQty * it.unit_cost;
                  const isReadOnly = activeSession.status !== 'OPEN';

                  return (
                    <tr key={it.item_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-emerald-700 font-bold">
                        {it.item_code}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-white">{it.item_name}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">
                        {it.bin_location || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">
                        {it.system_quantity} {it.uom}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isReadOnly ? (
                          <span className="font-mono font-bold text-white">
                            {physicalVal} {it.uom}
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={physicalVal}
                              onChange={(e) =>
                                setCountedQuantities({
                                  ...countedQuantities,
                                  [it.item_id]: Number(e.target.value),
                                })
                              }
                              className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-white font-mono text-right"
                            />
                            <span className="text-[11px] font-mono text-slate-500">{it.uom}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">
                        {varianceQty === 0 ? (
                          <span className="text-slate-500">0.00</span>
                        ) : varianceQty > 0 ? (
                          <span className="text-emerald-700">+{varianceQty}</span>
                        ) : (
                          <span className="text-red-600">{varianceQty}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                        Rp {(it.unit_cost ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">
                        {varianceVal === 0 ? (
                          <span className="text-slate-500">Rp 0</span>
                        ) : varianceVal > 0 ? (
                          <span className="text-emerald-700">+Rp {(varianceVal ?? 0).toLocaleString('id-ID')}</span>
                        ) : (
                          <span className="text-red-600">-Rp {Math.abs(varianceVal ?? 0).toLocaleString('id-ID')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isReadOnly ? (
                          <span className="text-slate-500 text-[11px]">{it.notes || '-'}</span>
                        ) : (
                          <input
                            type="text"
                            value={countNotes[it.item_id] ?? it.notes ?? ''}
                            onChange={(e) =>
                              setCountNotes({
                                ...countNotes,
                                [it.item_id]: e.target.value,
                              })
                            }
                            placeholder="Reason for variance..."
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-white"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Start Stock Count */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
                <span>Initiate Physical Count Session</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              <div>
                <label className="font-mono text-slate-500 block mb-1">Session Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="font-mono text-slate-500 block mb-1">Storeroom to Audit</label>
                <select
                  value={newStoreroom}
                  onChange={(e) => setNewStoreroom(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-white font-mono"
                >
                  {storerooms.map((s) => (
                    <option key={s.storeroom_id} value={s.storeroom_id}>
                      {s.storeroom_id} - {s.storeroom_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono text-slate-500 block mb-1">Auditor / Counted By</label>
                <input
                  type="text"
                  required
                  value={newCountedBy}
                  onChange={(e) => setNewCountedBy(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-white"
                />
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded text-slate-500 text-[11px]">
                Creating a session snapshots current perpetual stock in the selected storeroom into a count
                worksheet. Stock remains unadjusted until final Controller authorization.
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold shadow-xs shadow-rose-950"
                >
                  Start Count Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Controller Sign-Off & Variance Posting */}
      {isApproveOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-700" />
                <span>Authorize Stock Count & Post Variances</span>
              </h3>
              <button
                onClick={() => setIsApproveOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveAndPost} className="space-y-4 text-xs">
              <div>
                <label className="font-mono text-slate-500 block mb-1">Financial Controller Approver Name</label>
                <input
                  type="text"
                  required
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-white font-semibold"
                />
              </div>

              <div className="p-3.5 bg-slate-900/10/30 border border-amber-800/40 rounded-lg text-amber-200 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Auditor Variance Authorization</span>
                </div>
                <p className="text-[11px] text-slate-700">
                  By approving this audit, you permanently align system perpetual stock quantities to match
                  the physical count. A General Ledger adjustment journal will be posted to account 5180
                  (Inventory Variance / Shrinkage) and 1080 (Inventory Asset).
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSession}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold shadow-xs shadow-emerald-950"
                >
                  {savingSession ? 'Posting...' : 'Sign-Off & Synchronize Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
