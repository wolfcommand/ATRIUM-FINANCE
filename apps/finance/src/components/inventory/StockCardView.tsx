/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Warehouse,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Package,
  Layers,
  Printer,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryStoreroom,
  StockMovement,
} from '../../types';
import { api } from '../../services/api';
import { createReportExporter, ReportExportFormat } from '../../utils/excelExporter';
import { ReportExportButtons } from '../reports/ReportExportButtons';
import { printReportElement } from '../../utils/printManager';

interface StockCardViewProps {
  initialItemId?: string;
}

export const StockCardView: React.FC<StockCardViewProps> = ({ initialItemId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId || '');
  const [selectedStoreroom, setSelectedStoreroom] = useState<string>('ALL');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, roomList] = await Promise.all([
        api.getInventoryItems(),
        api.getInventoryStorerooms(),
      ]);
      setItems(itemList);
      setStorerooms(roomList);
      if (itemList.length > 0 && !selectedItemId) {
        setSelectedItemId(itemList[0].item_id);
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

  useEffect(() => {
    if (initialItemId) {
      setSelectedItemId(initialItemId);
    }
  }, [initialItemId]);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const filters: { item_id?: string; storeroom_id?: string } = {};
        if (selectedItemId) filters.item_id = selectedItemId;
        if (selectedStoreroom && selectedStoreroom !== 'ALL') {
          filters.storeroom_id = selectedStoreroom;
        }
        const data = await api.getStockMovements(filters);
        setMovements(data);
      } catch (err: any) {
        console.error(err);
      }
    };
    fetchMovements();
  }, [selectedItemId, selectedStoreroom]);

  const activeItem = (items || []).find((i) => i.item_id === selectedItemId);

  const handlePrint = () => {
    printReportElement('stock-card-printable-area', {
      title: `Stock_Card_${activeItem?.item_code || 'SKU'}_${activeItem?.item_name || ''}`,
      subtitle: `Perpetual Stock Card & Bin Movement History • Current Stock: ${activeItem?.current_stock || 0} ${activeItem?.uom || ''}`,
      property: 'PT Atrium Management Group',
      orientation: 'landscape',
    });
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!activeItem) return;

    const rows: (string | number)[][] = movements.map((m) => [
      m.date,
      m.type,
      m.storeroom_id,
      m.reference_id || '',
      m.quantity,
      m.balance_after,
      m.unit_cost,
      m.balance_after * m.unit_cost,
      m.notes || '',
    ]);

    createReportExporter(format)(
      `Stock_Card_${activeItem.item_code}_PT_Atrium_Management_Group.xlsx`,
      [
        {
          name: `Card ${activeItem.item_code}`.slice(0, 31),
          title: `PERPETUAL STOCK CARD — [${activeItem.item_code}] ${activeItem.item_name}`,
          subtitle: `PT Atrium Management Group • UOM: ${activeItem.uom} | Current Stock: ${activeItem.current_stock} | Unit Cost: Rp ${activeItem.average_cost.toLocaleString('id-ID')}`,
          headers: [
            'Date & Time',
            'Movement Type',
            'Store',
            'Reference #',
            'Quantity Change',
            'Balance After',
            'Unit Cost (Rp)',
            'Total Value (Rp)',
            'Notes / Origin',
          ],
          rows,
          colWidths: [18, 16, 12, 18, 16, 15, 16, 18, 25],
        },
      ]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-slate-500" />
            <span>Perpetual Stock Card &amp; Bin Movement History</span>
          </h3>
          <p className="text-xs text-slate-500">
            Audit-ready chronological transaction trail for any SKU across receipts, dispatches, transfers, and counts.
          </p>
        </div>

        {/* Filters & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <ReportExportButtons onExport={handleExportExcel} disabled={!activeItem || loading} />

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Print Stock Card"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          {/* Select Item */}
          <div className="min-w-[200px]">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              {items.map((it) => (
                <option key={it.item_id} value={it.item_id}>
                  [{it.item_code}] {it.item_name}
                </option>
              ))}
            </select>
          </div>

          {/* Select Storeroom */}
          <div className="min-w-[140px]">
            <select
              value={selectedStoreroom}
              onChange={(e) => setSelectedStoreroom(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            >
              <option value="ALL">All Storerooms</option>
              {storerooms.map((s) => (
                <option key={s.storeroom_id} value={s.storeroom_id}>
                  {s.storeroom_id} - {s.storeroom_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Item Profile Card */}
      {activeItem && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">SKU Code</span>
            <span className="text-sm font-bold font-mono text-emerald-700">{activeItem.item_code}</span>
          </div>

          <div className="col-span-2">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Description</span>
            <span className="text-sm font-bold text-white line-clamp-1">{activeItem.item_name}</span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Total On-Hand</span>
            <span className="text-sm font-bold font-mono text-white">
              {(activeItem.current_stock ?? 0).toLocaleString()} {activeItem.uom}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Moving Avg Cost</span>
            <span className="text-sm font-bold font-mono text-slate-500">
              Rp {(activeItem.average_cost ?? 0).toLocaleString('id-ID')}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Valuation Total</span>
            <span className="text-sm font-bold font-mono text-emerald-700">
              Rp {(((activeItem.current_stock ?? 0) * (activeItem.average_cost ?? 0)) || 0).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div id="stock-card-printable-area" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Movement Type</th>
                <th className="px-4 py-3">Storeroom</th>
                <th className="px-4 py-3">Document / Ref</th>
                <th className="px-4 py-3 text-right">In (Receipt)</th>
                <th className="px-4 py-3 text-right">Out (Issue)</th>
                <th className="px-4 py-3 text-right">Balance After</th>
                <th className="px-4 py-3 text-right">Unit Cost (Rp)</th>
                <th className="px-4 py-3 text-right">Trans. Value (Rp)</th>
                <th className="px-4 py-3">User / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-700">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                    No recorded movements for this item and storeroom selection.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isIn =
                    m.type === 'RECEIVING' ||
                    m.type === 'TRANSFER_IN' ||
                    m.type === 'ADJUSTMENT_IN' ||
                    (m.type === 'COUNT_VARIANCE' && m.quantity > 0);
                  const isOut =
                    m.type === 'ISSUE_DEPARTMENT' ||
                    m.type === 'TRANSFER_OUT' ||
                    m.type === 'ADJUSTMENT_OUT' ||
                    (m.type === 'COUNT_VARIANCE' && m.quantity < 0);

                  const qtyAbsolute = Math.abs(m.quantity);
                  const transValue = qtyAbsolute * m.unit_cost;

                  return (
                    <tr key={m.movement_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-500">{m.date}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center gap-1 ${
                            isIn
                              ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          <span>{m.type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700">{m.storeroom_id}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 font-semibold">
                        {m.reference_id}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                        {isIn ? `+${qtyAbsolute}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600">
                        {isOut ? `-${qtyAbsolute}` : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-white bg-white/40">
                        {m.balance_after}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        Rp {(m.unit_cost ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-700">
                        Rp {(transValue ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500">
                        <span className="text-slate-700">{m.performed_by}</span>
                        {m.notes ? ` • ${m.notes}` : ''}
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
  );
};
