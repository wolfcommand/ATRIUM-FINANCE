/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Building,
  Warehouse,
  ExternalLink,
  Package,
  RefreshCw,
  Scan,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStoreroom,
  Department,
} from '../../types';
import { api } from '../../services/api';

interface StockIssueViewProps {
  departments: Department[];
  onViewJournal?: (journalId: string) => void;
  onOpenScanner: () => void;
}

export const StockIssueView: React.FC<StockIssueViewProps> = ({
  departments,
  onViewJournal,
  onOpenScanner,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [storeroomId, setStoreroomId] = useState('CSR-01');
  const [deptCode, setDeptCode] = useState('F&B');
  const [issuedTo, setIssuedTo] = useState('Sous Chef Made');
  const [notes, setNotes] = useState('Direct counter issue for lunch banquet prep');
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([
    { item_id: '', quantity: 1 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ text: string; journalId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, roomList] = await Promise.all([
        api.getInventoryItems(),
        api.getInventoryStorerooms(),
      ]);
      setItems(itemList);
      setStorerooms(roomList);
      if (itemList.length > 0 && !lines[0]?.item_id) {
        setLines([{ item_id: itemList[0].item_id, quantity: 1 }]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddLine = () => {
    setLines([...lines, { item_id: items[0]?.item_id || '', quantity: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const getAvailableStock = (itemId: string, roomId: string): number => {
    const it = items.find((i) => i.item_id === itemId);
    if (!it) return 0;
    const loc = it.storeroom_stocks?.find((s) => s.storeroom_id === roomId);
    return loc ? loc.quantity : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotification(null);

    // Validate quantities against available storeroom stock
    for (const line of lines) {
      if (!line.item_id) {
        setError('Please select an item for all lines.');
        return;
      }
      if (line.quantity <= 0) {
        setError('Quantity must be greater than zero.');
        return;
      }
      const available = getAvailableStock(line.item_id, storeroomId);
      if (line.quantity > available) {
        const itemObj = items.find((i) => i.item_id === line.item_id);
        setError(
          `Cannot issue ${line.quantity} of "${itemObj?.item_name}". Only ${available} ${itemObj?.uom} available in storeroom ${storeroomId}.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.directStockIssue({
        date,
        storeroom_id: storeroomId,
        department_code: deptCode,
        items: lines,
        issued_to: issuedTo,
        notes,
      });

      setNotification({
        text: `Stock issued to ${deptCode} successfully! Double-entry cost journal generated.`,
        journalId: res.journal_id,
      });

      await loadData();
      setLines([{ item_id: items[0]?.item_id || '', quantity: 1 }]);
    } catch (err: any) {
      setError(err.message || 'Failed to issue stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-amber-700" />
            <span>Direct Stock Issue (Storekeeper Counter Dispatch)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Immediate over-the-counter stock dispatch with storeroom balance validation and automated cost
            journaling (Dr Department Cost, Cr 1080 Inventory).
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <Scan className="w-3.5 h-3.5 text-emerald-700" />
          <span>Scan Barcode</span>
        </button>
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
              <span className="text-slate-700">Created Journal:</span>
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

      {/* Direct Issue Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Issue Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Source Storeroom</label>
            <select
              value={storeroomId}
              onChange={(e) => setStoreroomId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            >
              {storerooms.map((s) => (
                <option key={s.storeroom_id} value={s.storeroom_id}>
                  {s.storeroom_id} - {s.storeroom_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Receiving Department</label>
            <select
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            >
              {departments.map((d) => (
                <option key={d.department_code} value={d.department_code}>
                  {d.department_code} - {d.department_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Issued To (Recipient)</label>
            <input
              type="text"
              required
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              placeholder="e.g. Sous Chef Made"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        {/* Dispatch Items List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Items to Dispatch
            </span>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1 border border-slate-200"
            >
              <Plus className="w-3 h-3 text-emerald-700" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const selectedItem = items.find((i) => i.item_id === line.item_id);
              const available = getAvailableStock(line.item_id, storeroomId);
              const isOverStock = line.quantity > available;

              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-white/60 rounded-lg border border-slate-200"
                >
                  <div className="flex-1 w-full">
                    <select
                      value={line.item_id}
                      onChange={(e) => {
                        const newLines = [...lines];
                        newLines[idx].item_id = e.target.value;
                        setLines(newLines);
                      }}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-white"
                    >
                      {items.map((i) => (
                        <option key={i.item_id} value={i.item_id}>
                          [{i.item_code}] {i.item_name} ({i.uom})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="text-right font-mono text-[11px] text-slate-500 min-w-[120px]">
                      Available in Store:{' '}
                      <span className={`font-bold ${available === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {available} {selectedItem?.uom}
                      </span>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        required
                        value={line.quantity}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].quantity = Number(e.target.value);
                          setLines(newLines);
                        }}
                        className={`w-full bg-white border rounded px-2.5 py-1.5 text-xs text-white font-mono text-right ${
                          isOverStock ? 'border-rose-500 text-rose-300' : 'border-slate-200'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={lines.length === 1}
                      className="p-1 text-slate-500 hover:text-red-600 disabled:opacity-20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-mono text-slate-500 block mb-1">Issue Reference / Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Enforces strict stock availability check: zero or negative stock dispatches are rejected.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs shadow-amber-950 transition-colors"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
            <span>Issue Stock & Post Cost Journal</span>
          </button>
        </div>
      </form>
    </div>
  );
};
