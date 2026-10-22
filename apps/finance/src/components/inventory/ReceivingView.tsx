/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Warehouse,
  Calendar,
  DollarSign,
  AlertCircle,
  ExternalLink,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStoreroom,
  GoodsReceipt,
  PurchaseOrder,
} from '../../types';
import { api } from '../../services/api';

interface ReceivingViewProps {
  onViewJournal?: (journalId: string) => void;
  onOpenScanner: () => void;
  initialPoReference?: string;
}

interface ReceiptLineInput {
  item_id: string;
  received_quantity: number;
  unit_cost: number;
  bin_location?: string;
  batch_or_lot?: string;
  expiry_date?: string;
}

export const ReceivingView: React.FC<ReceivingViewProps> = ({
  onViewJournal,
  onOpenScanner,
  initialPoReference,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [poReference, setPoReference] = useState(initialPoReference || '');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [vendorName, setVendorName] = useState('PT Sukses Jaya Pangan');
  const [storeroomId, setStoreroomId] = useState('CSR-01');
  const [notes, setNotes] = useState('Delivered via Delivery Order; temperature inspected & verified.');
  const [lines, setLines] = useState<ReceiptLineInput[]>([
    {
      item_id: '',
      received_quantity: 10,
      unit_cost: 0,
      bin_location: 'A-01',
      batch_or_lot: 'LOT-202603',
      expiry_date: '',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    text: string;
    receiptId: string;
    journalId?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, roomList, recList, poList] = await Promise.all([
        api.getInventoryItems(),
        api.getInventoryStorerooms(),
        api.getGoodsReceipts(),
        api.getPurchaseOrders(),
      ]);
      setItems(itemList);
      setStorerooms(roomList);
      setReceipts(recList);
      setPurchaseOrders(poList);

      if (itemList.length > 0 && !lines[0]?.item_id) {
        setLines([
          {
            item_id: itemList[0].item_id,
            received_quantity: 10,
            unit_cost: itemList[0].average_cost || 50000,
            bin_location: 'A-01',
            batch_or_lot: 'LOT-202603',
            expiry_date: '',
          },
        ]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPo = (poIdOrNumber: string) => {
    setSelectedPoId(poIdOrNumber);
    if (!poIdOrNumber) return;

    const po = purchaseOrders.find((p) => p.po_id === poIdOrNumber || p.po_number === poIdOrNumber);
    if (!po) return;

    setPoReference(po.po_number);
    setVendorName(po.supplier_name);
    setStoreroomId(po.storeroom_id);
    setNotes(`Delivery received against PO ${po.po_number} (${po.supplier_name}).`);

    if (po.items && po.items.length > 0) {
      const newLines: ReceiptLineInput[] = po.items.map((it) => {
        const itemObj = items.find((i) => i.item_id === it.item_id);
        const remaining = Math.max(1, it.ordered_quantity - (it.received_quantity || 0));
        return {
          item_id: it.item_id,
          received_quantity: remaining,
          unit_cost: it.unit_cost,
          bin_location: itemObj?.default_bin_location || 'A-01',
          batch_or_lot: `LOT-${new Date().toISOString().replace(/-/g, '').slice(0, 6)}`,
          expiry_date: '',
        };
      });
      setLines(newLines);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialPoReference) {
      setPoReference(initialPoReference);
    }
  }, [initialPoReference]);

  const handleItemSelect = (index: number, itemId: string) => {
    const selected = items.find((i) => i.item_id === itemId);
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      item_id: itemId,
      unit_cost: selected?.average_cost || selected?.last_purchase_price || 0,
      bin_location: selected?.storeroom_stocks?.find((s) => s.storeroom_id === storeroomId)?.bin_location || 'A-01',
    };
    setLines(newLines);
  };

  const handleAddLine = () => {
    const firstItem = items[0];
    setLines([
      ...lines,
      {
        item_id: firstItem ? firstItem.item_id : '',
        received_quantity: 1,
        unit_cost: firstItem?.average_cost || 0,
        bin_location: 'A-01',
        batch_or_lot: '',
        expiry_date: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return lines.reduce((sum, l) => sum + l.received_quantity * l.unit_cost, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (lines.length === 0) {
      setErrorMessage('Please add at least one item to receive.');
      return;
    }

    for (const line of lines) {
      if (!line.item_id) {
        setErrorMessage('Please select a valid item for all receipt rows.');
        return;
      }
      if (line.received_quantity <= 0) {
        setErrorMessage('Received quantity must be greater than 0.');
        return;
      }
      if (line.unit_cost <= 0) {
        setErrorMessage('Unit cost must be greater than 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.processGoodsReceipt({
        date,
        po_reference: poReference,
        vendor_name: vendorName,
        storeroom_id: storeroomId,
        items: lines,
        notes,
      });

      setSuccessMessage({
        text: `Goods Receipt #${res.receipt.receipt_id} processed successfully! Stock quantities & moving average costs updated.`,
        receiptId: res.receipt.receipt_id,
        journalId: res.journal_id,
      });

      // Reload inventory items and receipts
      await loadData();

      // Reset lines
      setLines([
        {
          item_id: items[0]?.item_id || '',
          received_quantity: 1,
          unit_cost: items[0]?.average_cost || 0,
          bin_location: 'A-01',
          batch_or_lot: '',
          expiry_date: '',
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process goods receipt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
            <span>Goods Receiving (PO Ingestion & Stock IN)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Accept physical supplier shipments, recalculate perpetual moving averages, and automatically
            generate Draft AP/Accrual Journals (Dr 1080 Inventory, Cr 2010 AP).
          </p>
        </div>

        <button
          onClick={onOpenScanner}
          className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <span>Scan Shipment Barcode</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-slate-900/10/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage.text}</span>
          </div>
          {successMessage.journalId && onViewJournal && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-slate-700">Created GL Journal:</span>
              <button
                type="button"
                onClick={() => onViewJournal(successMessage.journalId!)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-white text-emerald-700 rounded font-mono font-semibold border border-emerald-500/40 flex items-center gap-1"
              >
                <span>{successMessage.journalId}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-600/10/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Goods Receipt Ingestion Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-xs">
        {/* Approved Purchase Orders Fast Selector */}
        {purchaseOrders.filter((p) => p.status !== 'FULFILLED' && p.status !== 'CANCELLED').length > 0 && (
          <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-blue-300 font-semibold">
              <ShoppingCart className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Select Purchase Order (PO) for Fast Goods Receiving &amp; Auto-Stock:</span>
            </div>
            <select
              value={selectedPoId}
              onChange={(e) => handleSelectPo(e.target.value)}
              className="bg-white border border-blue-500/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-blue-400 outline-none max-w-sm"
            >
              <option value="">-- Select Open / Approved PO --</option>
              {purchaseOrders
                .filter((p) => p.status !== 'FULFILLED' && p.status !== 'CANCELLED')
                .map((p) => (
                  <option key={p.po_id} value={p.po_id}>
                    {p.po_number} - {p.supplier_name} ({p.items.length} items, {p.status})
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Receipt Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">PO / Contract Reference</label>
            <input
              type="text"
              required
              value={poReference}
              onChange={(e) => setPoReference(e.target.value)}
              placeholder="e.g. PO-2026-03-042"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Vendor / Supplier Name</label>
            <input
              type="text"
              required
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. PT Sukses Jaya Pangan"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 block mb-1">Receiving Storeroom</label>
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
        </div>

        {/* Lines Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Shipment Received Line Items
            </span>
            <button
              type="button"
              onClick={handleAddLine}
              className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center gap-1 border border-slate-200"
            >
              <Plus className="w-3 h-3 text-emerald-700" />
              <span>Add Item Row</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-500 font-mono text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 min-w-[220px]">Item Description</th>
                  <th className="px-3 py-2.5 w-28 text-right">Received Qty</th>
                  <th className="px-3 py-2.5 w-36 text-right">Unit Cost (Rp)</th>
                  <th className="px-3 py-2.5 w-36 text-right">Line Total (Rp)</th>
                  <th className="px-3 py-2.5 w-24">Bin</th>
                  <th className="px-3 py-2.5 w-28">Batch / Lot</th>
                  <th className="px-3 py-2.5 w-32">Expiry Date</th>
                  <th className="px-3 py-2.5 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {lines.map((line, idx) => {
                  const selectedItem = items.find((i) => i.item_id === line.item_id);
                  const lineTotal = (line.received_quantity || 0) * (line.unit_cost || 0);

                  return (
                    <tr key={idx} className="bg-white/50">
                      <td className="px-3 py-2">
                        <select
                          value={line.item_id}
                          onChange={(e) => handleItemSelect(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white"
                        >
                          {items.map((it) => (
                            <option key={it.item_id} value={it.item_id}>
                              [{it.item_code}] {it.item_name} ({it.uom})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          value={line.received_quantity}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx].received_quantity = Number(e.target.value);
                            setLines(newLines);
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white font-mono text-right"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="any"
                          min="1"
                          required
                          value={line.unit_cost}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx].unit_cost = Number(e.target.value);
                            setLines(newLines);
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white font-mono text-right"
                        />
                      </td>

                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                        Rp {(lineTotal ?? 0).toLocaleString('id-ID')}
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.bin_location || ''}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx].bin_location = e.target.value;
                            setLines(newLines);
                          }}
                          placeholder="Bin"
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white font-mono"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={line.batch_or_lot || ''}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx].batch_or_lot = e.target.value;
                            setLines(newLines);
                          }}
                          placeholder="LOT"
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white font-mono"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={line.expiry_date || ''}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx].expiry_date = e.target.value;
                            setLines(newLines);
                          }}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-xs text-white font-mono"
                        />
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length === 1}
                          className="p-1 rounded text-slate-500 hover:text-red-600 disabled:opacity-20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer & Total */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-200">
          <div className="flex-1 w-full max-w-md">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Inspection notes or delivery bill reference..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-500 block uppercase">Total Receipt Value</span>
              <div className="text-lg font-bold font-mono text-emerald-700">
                Rp {(calculateTotal() ?? 0).toLocaleString('id-ID')}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs shadow-emerald-950 transition-colors"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4" />
              )}
              <span>Post Goods Receipt &amp; Auto-Update Stock</span>
            </button>
          </div>
        </div>
      </form>

      {/* Historical Goods Receipts Stream */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-700" />
          <span>Goods Receipts History</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">GRN #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">PO Ref</th>
                <th className="px-4 py-2.5">Vendor</th>
                <th className="px-4 py-2.5">Storeroom</th>
                <th className="px-4 py-2.5 text-right">Items</th>
                <th className="px-4 py-2.5 text-right">Total Amount (Rp)</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Received By</th>
                <th className="px-4 py-2.5 text-right">Journal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-700">
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-mono">
                    No goods receipts logged yet.
                  </td>
                </tr>
              ) : (
                receipts.map((rec) => (
                  <tr key={rec.receipt_id} className="hover:bg-white/30 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">
                      {rec.receipt_number || rec.receipt_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{rec.date}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">{rec.po_reference}</td>
                    <td className="px-4 py-2.5 font-medium text-white">{rec.vendor_name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{rec.storeroom_id}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{rec.items.length}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                      Rp {(rec.total_amount ?? 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900/20 text-emerald-700">
                        {rec.status || 'RECEIVED'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">{rec.received_by}</td>
                    <td className="px-4 py-2.5 text-right">
                      {rec.journal_id && onViewJournal ? (
                        <button
                          onClick={() => onViewJournal(rec.journal_id!)}
                          className="text-[11px] font-mono text-emerald-700 hover:underline flex items-center gap-1 justify-end"
                        >
                          <span>{rec.journal_id}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-slate-500 font-mono">-</span>
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
  );
};
