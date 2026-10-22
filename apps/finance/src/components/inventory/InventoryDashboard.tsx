/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Scan,
  Warehouse,
  ClipboardList,
  ShoppingCart,
  Layers,
  ArrowRight,
  Plus,
  Building,
} from 'lucide-react';
import {
  InventoryDashboardKPIs,
  InventoryItem,
  StockMovement,
  InventoryStoreroom,
} from '../../types';
import { api } from '../../services/api';

interface InventoryDashboardProps {
  onNavigate?: (tab: any, contextId?: string) => void;
  onNavigateTab?: (tab: string, contextId?: string) => void;
  onOpenScanner?: () => void;
  onOpenStockCard?: (itemId: string) => void;
  onOpenStoreroom?: (storeroomId: string) => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  onNavigate,
  onNavigateTab,
  onOpenScanner,
  onOpenStockCard,
  onOpenStoreroom,
}) => {
  const [kpis, setKpis] = useState<InventoryDashboardKPIs | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = (tabKey: string, contextId?: string) => {
    if (tabKey === 'stock-card' && contextId && onOpenStockCard) {
      onOpenStockCard(contextId);
      return;
    }
    if (tabKey === 'storerooms' && contextId && onOpenStoreroom) {
      onOpenStoreroom(contextId);
      return;
    }

    const tabMap: Record<string, string> = {
      dashboard: 'DASHBOARD',
      items: 'ITEMS',
      categories: 'CATEGORIES',
      storerooms: 'STOREROOMS',
      receiving: 'RECEIVING',
      requisitions: 'REQUISITIONS',
      'purchase-orders': 'PURCHASE_ORDERS',
      'purchase_orders': 'PURCHASE_ORDERS',
      orders: 'PURCHASE_ORDERS',
      issues: 'ISSUE',
      issue: 'ISSUE',
      transfers: 'TRANSFER',
      transfer: 'TRANSFER',
      'stock-count': 'STOCK_COUNT',
      adjustments: 'ADJUSTMENT',
      adjustment: 'ADJUSTMENT',
      'stock-card': 'STOCK_CARD',
      reports: 'REPORTS',
    };

    const target = tabMap[tabKey.toLowerCase()] || tabKey.toUpperCase();
    if (onNavigate) {
      onNavigate(target, contextId);
    } else if (onNavigateTab) {
      onNavigateTab(tabKey, contextId);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, moves, itemList, rooms] = await Promise.all([
        api.getInventoryDashboard(),
        api.getStockMovements(),
        api.getInventoryItems(),
        api.getInventoryStorerooms(),
      ]);
      setKpis(dash);
      setRecentMovements(moves.slice(0, 8));
      setItems(itemList);
      setStorerooms(rooms);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span className="font-mono text-sm">Loading inventory intelligence...</span>
      </div>
    );
  }

  const lowStockItems = items.filter((i) => i.current_stock <= i.reorder_point);

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Hotel Inventory Real-Time Operations</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/10 text-emerald-700 border border-emerald-500/30 font-mono">
              Live Synced
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Perpetual inventory tracking across Central, Kitchen, F&B, Housekeeping, and Engineering storerooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenScanner ? onOpenScanner : () => navigate('items')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs shadow-emerald-950 transition-colors"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan Barcode</span>
          </button>

          <button
            onClick={() => navigate('receiving')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
            <span>Receive Goods</span>
          </button>

          <button
            onClick={() => navigate('requisitions')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
            <span>Requisition</span>
          </button>

          <button
            onClick={() => navigate('purchase-orders')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-xs font-medium border border-blue-500/40 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
            <span>Purchase Orders</span>
          </button>

          <button
            onClick={() => navigate('issues')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
            <span>Direct Issue</span>
          </button>

          <button
            onClick={() => navigate('transfers')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Transfer</span>
          </button>

          <button
            onClick={() => navigate('stock-count')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-red-600" />
            <span>Stock Count</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Valuation */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Total Valuation</span>
            <div className="p-2 rounded-lg bg-slate-900/10 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              Rp {(kpis?.total_inventory_value_idr ?? kpis?.total_valuation ?? 0).toLocaleString('id-ID')}
            </div>
            <div className="text-xs font-mono text-emerald-700 mt-0.5">
              Nilai Total Persediaan Fisik (Perpetual Moving Avg)
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Perpetual Moving Avg</span>
            <button
              onClick={() => navigate('reports')}
              className="text-emerald-700 hover:text-emerald-700 flex items-center gap-0.5 font-medium"
            >
              GL Match <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active SKUs */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Active Inventory SKUs</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-slate-500">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {(kpis?.total_items_count ?? kpis?.total_skus ?? items.length ?? 0)} Items
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              Across {storerooms.length} Active Storerooms
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Catalog coverage</span>
            <button
              onClick={() => navigate('items')}
              className="text-slate-500 hover:text-blue-300 flex items-center gap-0.5 font-medium"
            >
              View Items <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Low Stock Warnings</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-700">
              {(kpis?.low_stock_items_count ?? kpis?.low_stock_count ?? lowStockItems.length ?? 0)} SKUs
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              At or below minimum reorder point
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="text-amber-300/80 font-medium">Action recommended</span>
            <button
              onClick={() => navigate('receiving')}
              className="text-amber-700 hover:text-amber-300 flex items-center gap-0.5 font-medium"
            >
              Order/Receive <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Pending Requisitions & Audits */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Requisitions & Audits</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {(kpis?.pending_requisitions_count ?? 0)} Pending
            </div>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              {(kpis?.open_stock_counts_count ?? 0)} Active Stock Counts
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Department workflows</span>
            <button
              onClick={() => navigate('requisitions')}
              className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 font-medium"
            >
              Review <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Mid Section: Valuation by Category + Storerooms Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Valuation by Category</span>
            </h3>
            <button
              onClick={() => navigate('categories')}
              className="text-xs text-slate-500 hover:text-white"
            >
              Manage Categories
            </button>
          </div>

          <div className="space-y-3">
            {(kpis?.category_breakdown || []).map((cat) => {
              const totalVal = kpis?.total_inventory_value_idr || kpis?.total_valuation || 1;
              const pct = totalVal > 0
                ? (((cat.total_value_idr || 0) / totalVal) * 100).toFixed(1)
                : '0';

              return (
                <div key={cat.category_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{cat.category_name}</span>
                    <span className="font-mono text-slate-500">
                      Rp {(cat.total_value_idr ?? 0).toLocaleString('id-ID')} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(4, Number(pct)))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Storerooms Stock Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-slate-500" />
              <span>Storerooms Status</span>
            </h3>
            <button
              onClick={() => navigate('storerooms')}
              className="text-xs text-slate-500 hover:text-white"
            >
              View All Storerooms
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(kpis?.storeroom_breakdown || []).map((st) => (
              <div
                key={st.storeroom_id}
                onClick={() => navigate('storerooms', st.storeroom_id)}
                className="p-3 bg-white/70 border border-slate-200 rounded-lg hover:border-slate-200 cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{st.storeroom_name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-500">
                    {st.items_count} SKUs
                  </span>
                </div>
                <div className="text-sm font-bold font-mono text-emerald-700">
                  Rp {(st.total_value_idr ?? 0).toLocaleString('id-ID')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Reorder & Low Stock Alerts Table */}
      {lowStockItems.length > 0 && (
        <div className="bg-white border border-amber-900/40 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-900/10/20 border-b border-amber-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                Priority Stock Replenishment Needed ({lowStockItems.length} SKUs)
              </h3>
            </div>
            <button
              onClick={() => navigate('receiving')}
              className="text-xs text-amber-300 hover:text-amber-200 font-medium underline"
            >
              Create Receiving Order
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/60 text-slate-500 font-mono text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Item Name</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5 text-right">Current Stock</th>
                  <th className="px-4 py-2.5 text-right">Min Reorder</th>
                  <th className="px-4 py-2.5 text-right">Deficit</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {lowStockItems.slice(0, 6).map((item) => {
                  const deficit = Math.max(0, item.reorder_point - item.current_stock);
                  return (
                    <tr key={item.item_id} className="hover:bg-white/40 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-emerald-700 font-medium">
                        {item.item_code}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-white">{item.item_name}</td>
                      <td className="px-4 py-2.5 text-slate-500">{item.subcategory}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-red-600">
                        {(item.current_stock ?? 0).toLocaleString()} {item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {(item.reorder_point ?? 0).toLocaleString()} {item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-amber-700">
                        +{deficit.toLocaleString()} {item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => navigate('receiving')}
                          className="px-2.5 py-1 rounded bg-slate-100 text-amber-300 hover:bg-slate-100 border border-amber-600/40 text-[11px] font-semibold"
                        >
                          Receive
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Inventory Movements Stream */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-700" />
            <span>Recent Perpetual Movements (Audit Trail)</span>
          </h3>
          <button
            onClick={() => navigate('stock-card')}
            className="text-xs text-emerald-700 hover:text-emerald-700 font-medium"
          >
            Open Stock Card Ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/60 text-slate-500 font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2">Date / Time</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Storeroom</th>
                <th className="px-4 py-2 text-right">Quantity</th>
                <th className="px-4 py-2 text-right">Unit Cost</th>
                <th className="px-4 py-2 text-right">Total Amount</th>
                <th className="px-4 py-2">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-700">
              {recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 font-mono">
                    No movements recorded yet
                  </td>
                </tr>
              ) : (
                recentMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.movement_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-500">{m.date}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            m.movement_type === 'RECEIVING'
                              ? 'bg-slate-900/20 text-emerald-700'
                              : m.movement_type.includes('ISSUE')
                              ? 'bg-rose-500/20 text-rose-300'
                              : m.movement_type.includes('TRANSFER')
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-white">{m.item_name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{m.storeroom_id}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-bold ${
                          isPositive ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? `+${m.quantity}` : m.quantity} {m.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        Rp {(m.unit_cost ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-white">
                        Rp {(m.total_cost ?? 0).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">
                        {m.reference_number || '-'}
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
