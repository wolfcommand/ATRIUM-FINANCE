/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Warehouse,
  ArrowRight,
  MapPin,
  Scan,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStoreroom,
} from '../../types';
import { api } from '../../services/api';

interface StockTransferViewProps {
  onOpenScanner: () => void;
}

export const StockTransferView: React.FC<StockTransferViewProps> = ({ onOpenScanner }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromStoreroom, setFromStoreroom] = useState('CSR-01');
  const [toStoreroom, setToStoreroom] = useState('KIT-01');
  const [toBin, setToBin] = useState('K-DRY-01');
  const [notes, setNotes] = useState('Replenishment transfer from Central Store to Kitchen Dry Store');
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([
    { item_id: '', quantity: 2 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
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
        setLines([{ item_id: itemList[0].item_id, quantity: 2 }]);
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

  const getSourceStock = (itemId: string): number => {
    const it = items.find((i) => i.item_id === itemId);
    if (!it) return 0;
    const loc = it.storeroom_stocks?.find((s) => s.storeroom_id === fromStoreroom);
    return loc ? loc.quantity : 0;
  };

  const handleAddLine = () => {
    setLines([...lines, { item_id: items[0]?.item_id || '', quantity: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotification(null);

    if (fromStoreroom === toStoreroom) {
      setError('Source and destination storerooms must be different.');
      return;
    }

    for (const line of lines) {
      if (!line.item_id) {
        setError('Please select an item for each line.');
        return;
      }
      if (line.quantity <= 0) {
        setError('Quantity must be greater than zero.');
        return;
      }
      const available = getSourceStock(line.item_id);
      if (line.quantity > available) {
        const it = items.find((i) => i.item_id === line.item_id);
        setError(
          `Cannot transfer ${line.quantity} of "${it?.item_name}". Only ${available} available in storeroom ${fromStoreroom}.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.processStockTransfer({
        date,
        from_storeroom_id: fromStoreroom,
        to_storeroom_id: toStoreroom,
        to_bin_location: toBin,
        items: lines,
        notes,
      });

      setNotification(`Stock successfully transferred from ${fromStoreroom} to ${toStoreroom}!`);
      await loadData();
      setLines([{ item_id: items[0]?.item_id || '', quantity: 1 }]);
    } catch (err: any) {
      setError(err.message || 'Failed to transfer stock');
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
            <RefreshCw className="w-5 h-5 text-purple-400" />
            <span>Inter-Storeroom Stock Transfers</span>
          </h3>
          <p className="text-xs text-slate-500">
            Relocate materials across central and satellite storerooms with automatic dual-entry movement tracking.
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <Scan className="w-3.5 h-3.5 text-emerald-700" />
          <span>Scan Item</span>
        </button>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-slate-900/10/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-600/10/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Transfer Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* From Storeroom */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-mono uppercase text-slate-500 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-red-600" />
              <span>Source Storeroom (FROM)</span>
            </span>
            <select
              value={fromStoreroom}
              onChange={(e) => setFromStoreroom(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            >
              {storerooms.map((s) => (
                <option key={s.storeroom_id} value={s.storeroom_id}>
                  {s.storeroom_id} - {s.storeroom_name}
                </option>
              ))}
            </select>
          </div>

          {/* Direction Arrow */}
          <div className="hidden md:flex flex-col items-center justify-center text-purple-400">
            <ArrowRight className="w-6 h-6" />
            <span className="text-[10px] font-mono text-slate-500 mt-1">Inter-Store Transfer</span>
          </div>

          {/* To Storeroom */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-mono uppercase text-slate-500 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-emerald-700" />
              <span>Destination Storeroom (TO)</span>
            </span>
            <select
              value={toStoreroom}
              onChange={(e) => {
                setToStoreroom(e.target.value);
                const sObj = storerooms.find((s) => s.storeroom_id === e.target.value);
                if (sObj) setToBin(`${sObj.default_bin_prefix || 'BIN'}-01`);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            >
              {storerooms.map((s) => (
                <option key={s.storeroom_id} value={s.storeroom_id}>
                  {s.storeroom_id} - {s.storeroom_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Transfer Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Target Bin Location</label>
            <input
              type="text"
              value={toBin}
              onChange={(e) => setToBin(e.target.value)}
              placeholder="e.g. K-DRY-01"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* Items to Transfer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Items to Transfer
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
              const sourceQty = getSourceStock(line.item_id);
              const isOverStock = line.quantity > sourceQty;

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
                    <div className="text-right font-mono text-[11px] text-slate-500 min-w-[140px]">
                      Source Stock ({fromStoreroom}):{' '}
                      <span className={`font-bold ${sourceQty === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {sourceQty} {selectedItem?.uom}
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
          <label className="text-xs font-mono text-slate-500 block mb-1">Transfer Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
          />
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs shadow-purple-950 transition-colors"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>Execute Inter-Store Transfer</span>
          </button>
        </div>
      </form>
    </div>
  );
};
