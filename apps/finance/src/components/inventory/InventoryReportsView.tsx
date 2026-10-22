/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  AlertTriangle,
  PieChart,
  Warehouse,
  Coins,
  Clock,
  Layers,
  Printer,
  Eye,
} from 'lucide-react';;
import {
  InventoryItem,
  InventoryCategory,
  InventoryStoreroom,
  StockAdjustmentRecord,
} from '../../types';
import { api } from '../../services/api';
import { createReportExporter, ReportExportFormat , withTotal } from '../../utils/excelExporter';
import { ReportExportButtons } from '../reports/ReportExportButtons';
import { PrintableReportContainer } from '../reports/PrintableReportContainer';

export const InventoryReportsView: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'VALUATION' | 'REORDER' | 'SPOILAGE' | 'SLOW_MOVING'>('VALUATION');
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [itemList, catList, roomList, adjList] = await Promise.all([
          api.getInventoryItems(),
          api.getInventoryCategories(),
          api.getInventoryStorerooms(),
          api.getStockAdjustments(),
        ]);
        setItems(itemList);
        setCategories(catList);
        setStorerooms(roomList);
        setAdjustments(adjList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const totalValuation = items.reduce((sum, i) => sum + i.current_stock * i.average_cost, 0);

  // Valuation by Category
  const categoryValuation = categories.map((cat) => {
    const catItems = items.filter((i) => i.category_id === cat.category_id);
    const val = catItems.reduce((s, i) => s + i.current_stock * i.average_cost, 0);
    const percent = totalValuation > 0 ? (val / totalValuation) * 100 : 0;
    return {
      category: cat,
      itemsCount: catItems.length,
      valuation: val,
      percentage: percent,
    };
  });

  // Reorder Needed Items
  const reorderItems = items
    .filter((i) => i.current_stock <= i.min_stock)
    .map((i) => {
      const orderQty = Math.max(0, i.max_stock - i.current_stock);
      const estCost = orderQty * i.average_cost;
      return {
        item: i,
        orderQty,
        estCost,
      };
    });

  // Spoilage & Write-offs
  const totalSpoilageLoss = adjustments
    .filter((a) => a.type === 'ADJUSTMENT_OUT')
    .reduce((sum, a) => sum + a.total_cost, 0);

  const spoilageByReason = adjustments
    .filter((a) => a.type === 'ADJUSTMENT_OUT')
    .reduce((acc, a) => {
      acc[a.reason_code] = (acc[a.reason_code] || 0) + a.total_cost;
      return acc;
    }, {} as Record<string, number>);

  const handlePrint = () => {
    window.dispatchEvent(new CustomEvent('atrium-open-print-preview'));
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (activeTab === 'SPOILAGE') {
      createReportExporter(format)('Inventory_Spoilage', [{
        name: 'Spoilage', title: 'Inventory Wastage, Spoilage & Write-Off Audit',
        headers: ['Date', 'Item Name', 'Storeroom', 'Reason', 'Written-Off Quantity', 'UOM', 'Financial Loss (Rp)', 'Incident Description'],
        rows: [
          ...adjustments.filter(a => a.type === 'ADJUSTMENT_OUT').map(a => [a.date, a.item_name, a.storeroom_id, a.reason_code, -a.quantity, a.uom, a.total_cost, a.reason_notes]),
          ['TOTAL', '', '', '', '', '', totalSpoilageLoss, ''],
        ],
        colWidths: [14, 26, 14, 18, 14, 8, 20, 32],
      }]);
      return;
    }
    const valRows: (string | number)[][] = items.map((i) => [
      i.item_code,
      i.item_name,
      categories.find((c) => c.category_id === i.category_id)?.name || i.category_id,
      i.uom,
      i.current_stock,
      i.average_cost,
      i.current_stock * i.average_cost,
    ]);
    valRows.push(...withTotal(items.map(i => [i]), [
      'TOTAL',
      'Total Inventory Valuation',
      '',
      '',
      items.reduce((s, i) => s + i.current_stock, 0),
      '',
      items.reduce((s, i) => s + i.current_stock * i.average_cost, 0),
    ]));

    const reorderRows: (string | number)[][] = reorderItems.map((r) => [
      r.item.item_code,
      r.item.item_name,
      r.item.current_stock,
      r.item.min_stock,
      r.item.max_stock,
      r.orderQty,
      r.estCost,
    ]);
    reorderRows.push(...withTotal(reorderItems.map(r => [r]), [
      'TOTAL',
      'Total Estimated Reorder Cost',
      '',
      '',
      '',
      reorderItems.reduce((s, r) => s + r.orderQty, 0),
      reorderItems.reduce((s, r) => s + r.estCost, 0),
    ]));

    createReportExporter(format)(`Inventory_${activeTab}_Report`, [
      {
        name: 'Stock Valuation',
        title: 'HOTEL INVENTORY VALUATION REPORT',
        subtitle: 'PT Atrium Management Group • Store & Cost Center Breakdown',
        headers: [
          'Item Code',
          'Item Name',
          'Category',
          'UOM',
          'Current Stock',
          'Unit Cost (Rp)',
          'Total Value (Rp)',
        ],
        rows: valRows,
        colWidths: [15, 30, 20, 10, 15, 18, 20],
      },
      {
        name: 'Reorder Projections',
        title: 'STOCK REORDER & PAR LEVEL PROJECTIONS',
        headers: [
          'Item Code',
          'Item Name',
          'Current Stock',
          'Min Stock',
          'Max Stock',
          'Suggested Order',
          'Estimated Cost (Rp)',
        ],
        rows: reorderRows,
        colWidths: [15, 30, 15, 12, 12, 16, 20],
      },
    ].filter((_, index) => index === (activeTab === 'VALUATION' ? 0 : 1)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/60 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <span>Hotel Cost Control &amp; Inventory Financial Reports</span>
          </h3>
          <p className="text-xs text-slate-500">
            Valuation audits, reorder projections, and shrinkage write-off breakdowns for the Financial Controller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportExportButtons onExport={handleExportExcel} disabled={loading} />

          {/* Toggle PDF Preview */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
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
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            title="Print Inventory Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print to PDF</span>
          </button>

        </div>
      </div>

      {/* Printable Report Wrapper */}
      <PrintableReportContainer
        reportTitle={
          activeTab === 'VALUATION'
            ? 'Inventory Valuation & Store Asset Register'
            : activeTab === 'REORDER'
            ? 'Stock Replenishment & Par Level Reorder Schedule'
            : activeTab === 'SPOILAGE'
            ? 'Inventory Wastage, Spoilage & Write-Off Audit'
            : 'Slow-Moving & Dead Stock Analysis'
        }
        reportSubtitle="Hotel Material Control & Store Ledger Asset Valuation"
        property="PT Atrium Management Group"
        orientation="landscape"
        previewMode={previewMode}
        onExitPreview={() => setPreviewMode(false)}
        onExportExcel={handleExportExcel}
      >
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 print:hidden">
        <button
          onClick={() => setActiveTab('VALUATION')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'VALUATION'
              ? 'bg-slate-100 text-emerald-700 border border-emerald-500/40'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Category & Store Valuation</span>
        </button>

        <button
          onClick={() => setActiveTab('REORDER')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'REORDER'
              ? 'bg-slate-100 text-amber-300 border border-amber-500/40'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Replenishment & Par Levels ({reorderItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SPOILAGE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'SPOILAGE'
              ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40'
              : 'text-slate-500 hover:text-white'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Shrinkage & Spoilage Analysis</span>
        </button>
      </div>

      {/* Content: Valuation */}
      {activeTab === 'VALUATION' && (
        <div className="space-y-6">
          {/* Summary KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-500 block">Total Inventory Asset</span>
              <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
                Rp {(totalValuation ?? 0).toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                Reconciled with GL 1080
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-500 block">Total Active SKUs</span>
              <span className="text-xl font-bold font-mono text-white mt-1 block">
                {items.length} SKUs
              </span>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                Across {categories.length} item categories
              </span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-mono uppercase text-slate-500 block">Active Storerooms</span>
              <span className="text-xl font-bold font-mono text-slate-500 mt-1 block">
                {storerooms.length} Locations
              </span>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                Central and satellite bars/kitchens
              </span>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Inventory Asset Breakdown by Department Category</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Category Name</th>
                    <th className="px-4 py-2.5">Asset Account</th>
                    <th className="px-4 py-2.5">Expense / Cost Account</th>
                    <th className="px-4 py-2.5 text-right">Items Count</th>
                    <th className="px-4 py-2.5 text-right">Current Valuation (Rp)</th>
                    <th className="px-4 py-2.5 text-right w-44">% of Total Portfolio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-700">
                  {categoryValuation.map((cv) => (
                    <tr key={cv.category.category_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-white">{cv.category.name}</td>
                      <td className="px-4 py-2.5 font-mono text-emerald-700">
                        {cv.category.inventory_asset_account}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">
                        {cv.category.expense_cost_account}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{cv.itemsCount}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                        Rp {(cv.valuation ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-white rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-slate-900 h-full rounded-full"
                              style={{ width: `${cv.percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 w-10 text-right">
                            {cv.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Content: Reorder */}
      {activeTab === 'REORDER' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Replenishment Reorder Recommendations</span>
              </h4>
              <p className="text-xs text-slate-500">
                Items currently at or below safety minimum stock. Calculate quantities required to restore par levels.
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Total Reorder Budget</span>
              <span className="text-base font-bold font-mono text-amber-700">
                Rp {(reorderItems.reduce((s, r) => s + (r.estCost || 0), 0) || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5 text-right">Current On-Hand</th>
                  <th className="px-4 py-2.5 text-right">Min Safety Level</th>
                  <th className="px-4 py-2.5 text-right">Target Par Level</th>
                  <th className="px-4 py-2.5 text-right">Suggested Reorder Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Moving Avg (Rp)</th>
                  <th className="px-4 py-2.5 text-right">Estimated Procurement Cost (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {reorderItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-emerald-700 font-mono">
                      All inventory items are currently above safety stock thresholds.
                    </td>
                  </tr>
                ) : (
                  reorderItems.map((r) => (
                    <tr key={r.item.item_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-amber-700">{r.item.item_code}</td>
                      <td className="px-4 py-2.5 font-medium text-white">{r.item.item_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600">
                        {r.item.current_stock} {r.item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {r.item.min_stock} {r.item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {r.item.max_stock} {r.item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-300">
                        {r.orderQty} {r.item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        Rp {(r.item.average_cost ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700">
                        Rp {(r.estCost ?? 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content: Spoilage & Shrinkage */}
      {activeTab === 'SPOILAGE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Total Spoilage Losses</span>
              <span className="text-xl font-bold font-mono text-red-600 mt-1 block">
                Rp {(totalSpoilageLoss ?? 0).toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                Expensed to GL 5180
              </span>
            </div>

            {Object.entries(spoilageByReason).map(([reason, amount]) => {
              const amtNum = Number(amount) || 0;
              return (
                <div key={reason} className="p-4 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">{reason}</span>
                  <span className="text-base font-bold font-mono text-white mt-1 block">
                    Rp {(amtNum ?? 0).toLocaleString('id-ID')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                    {totalSpoilageLoss > 0 ? ((amtNum / totalSpoilageLoss) * 100).toFixed(1) : 0}% of losses
                  </span>
                </div>
              );
            })}
          </div>

          {/* Adjustments table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-red-600" />
              <span>Recent Waste / Spoilage Incident Log</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-4 py-2.5">Storeroom</th>
                    <th className="px-4 py-2.5">Reason Code</th>
                    <th className="px-4 py-2.5 text-right">Written-Off Qty</th>
                    <th className="px-4 py-2.5 text-right">Financial Loss (Rp)</th>
                    <th className="px-4 py-2.5">Incident Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-700">
                  {adjustments
                    .filter((a) => a.type === 'ADJUSTMENT_OUT')
                    .map((a) => (
                      <tr key={a.adjustment_id} className="hover:bg-white/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-500">{a.date}</td>
                        <td className="px-4 py-2.5 font-semibold text-white">{a.item_name}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-500">{a.storeroom_id}</td>
                        <td className="px-4 py-2.5 font-mono text-red-600 font-bold">{a.reason_code}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600">
                          -{a.quantity} {a.uom}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                          Rp {(a.total_cost ?? 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-[11px]">{a.reason_notes}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </div>
      </PrintableReportContainer>
    </div>
  );
};
