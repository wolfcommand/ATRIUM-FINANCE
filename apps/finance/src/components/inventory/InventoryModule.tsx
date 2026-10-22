/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  Warehouse,
  ArrowDownLeft,
  ClipboardList,
  ShoppingCart,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
  Scan,
  CreditCard,
} from 'lucide-react';
import { Department, Account } from '../../types';
import { InventoryDashboard } from './InventoryDashboard';
import { ItemMasterView } from './ItemMasterView';
import { CategoriesView } from './CategoriesView';
import { StoreroomsView } from './StoreroomsView';
import { ReceivingView } from './ReceivingView';
import { RequisitionsView } from './RequisitionsView';
import { PurchaseOrdersView } from './PurchaseOrdersView';
import { AccountsPayableModule } from '../ap/AccountsPayableModule';
import { StockIssueView } from './StockIssueView';
import { StockTransferView } from './StockTransferView';
import { StockCountView } from './StockCountView';
import { StockAdjustmentView } from './StockAdjustmentView';
import { StockCardView } from './StockCardView';
import { InventoryReportsView } from './InventoryReportsView';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export type InventorySubTab =
  | 'DASHBOARD'
  | 'ITEMS'
  | 'CATEGORIES'
  | 'STOREROOMS'
  | 'PURCHASE_ORDERS'
  | 'ACCOUNTS_PAYABLE'
  | 'RECEIVING'
  | 'REQUISITIONS'
  | 'ISSUE'
  | 'TRANSFER'
  | 'STOCK_COUNT'
  | 'ADJUSTMENT'
  | 'STOCK_CARD'
  | 'REPORTS';

interface InventoryModuleProps {
  departments: Department[];
  accounts?: Account[];
  onViewJournal?: (journalId: string) => void;
  initialTab?: InventorySubTab;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  departments,
  accounts = [],
  onViewJournal,
  initialTab = 'DASHBOARD',
}) => {
  const [activeTab, setActiveTab] = useState<InventorySubTab>(initialTab);
  const [stockCardItemId, setStockCardItemId] = useState<string | undefined>();
  const [selectedStoreroomId, setSelectedStoreroomId] = useState<string | undefined>();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [navPoNumberForReceiving, setNavPoNumberForReceiving] = useState<string | undefined>();
  const [navReqIdForPo, setNavReqIdForPo] = useState<string | undefined>();

  const handleOpenStockCard = (itemId: string) => {
    setStockCardItemId(itemId);
    setActiveTab('STOCK_CARD');
  };

  const handleOpenStoreroom = (storeroomId: string) => {
    setSelectedStoreroomId(storeroomId);
    setActiveTab('STOREROOMS');
  };

  const handleNavigateToReceivingFromPo = (poNumber: string) => {
    setNavPoNumberForReceiving(poNumber);
    setActiveTab('RECEIVING');
  };

  const handleCreatePoFromRequisition = (requisitionId: string) => {
    setNavReqIdForPo(requisitionId);
    setActiveTab('PURCHASE_ORDERS');
  };

  const handleBarcodeDetected = (code: string) => {
    // When a barcode is detected, open the item master or stock card
    setScannerOpen(false);
    setActiveTab('ITEMS');
  };

  const subTabs: { id: InventorySubTab; label: string; icon: React.ReactNode; group: string }[] = [
    { id: 'DASHBOARD', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" />, group: 'Main' },
    { id: 'ITEMS', label: 'Item Master', icon: <Package className="w-4 h-4" />, group: 'Master Data' },
    { id: 'CATEGORIES', label: 'Categories & GL', icon: <Layers className="w-4 h-4" />, group: 'Master Data' },
    { id: 'STOREROOMS', label: 'Storerooms', icon: <Warehouse className="w-4 h-4" />, group: 'Master Data' },
    { id: 'REQUISITIONS', label: 'Requisitions', icon: <ClipboardList className="w-4 h-4" />, group: 'Procurement' },
    { id: 'PURCHASE_ORDERS', label: 'Purchase Orders', icon: <ShoppingCart className="w-4 h-4 text-slate-500" />, group: 'Procurement' },
    { id: 'ACCOUNTS_PAYABLE', label: 'Accounts Payable (AP)', icon: <CreditCard className="w-4 h-4 text-amber-700" />, group: 'Procurement' },
    { id: 'RECEIVING', label: 'Goods Receiving', icon: <ArrowDownLeft className="w-4 h-4" />, group: 'Stock In' },
    { id: 'ISSUE', label: 'Direct Issue', icon: <ArrowUpRight className="w-4 h-4" />, group: 'Issuance' },
    { id: 'TRANSFER', label: 'Inter-Store Transfer', icon: <RefreshCw className="w-4 h-4" />, group: 'Operations' },
    { id: 'STOCK_COUNT', label: 'Stock Count', icon: <TrendingUp className="w-4 h-4" />, group: 'Control' },
    { id: 'ADJUSTMENT', label: 'Adjust & Spoilage', icon: <AlertTriangle className="w-4 h-4" />, group: 'Control' },
    { id: 'STOCK_CARD', label: 'Stock Card Ledger', icon: <FileSpreadsheet className="w-4 h-4" />, group: 'Audit' },
    { id: 'REPORTS', label: 'Cost Reports', icon: <BarChart3 className="w-4 h-4" />, group: 'Audit' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Bar */}
      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl p-2 sticky top-16 z-30 shadow-xs">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1.5 min-w-max">
            {subTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-950 font-bold'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 pl-2">
            <button
              onClick={() => setScannerOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 transition-colors"
              title="Open Barcode & QR Code Scanner"
            >
              <Scan className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Scan SKU</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Render */}
      <div>
        {activeTab === 'DASHBOARD' && (
          <InventoryDashboard
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenStockCard={handleOpenStockCard}
            onOpenStoreroom={handleOpenStoreroom}
          />
        )}

        {activeTab === 'ITEMS' && (
          <ItemMasterView
            accounts={accounts}
            departments={departments}
            onOpenStockCard={handleOpenStockCard}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeTab === 'CATEGORIES' && <CategoriesView accounts={accounts} />}

        {activeTab === 'STOREROOMS' && (
          <StoreroomsView
            departments={departments}
            selectedStoreroomId={selectedStoreroomId}
            onOpenStockCard={handleOpenStockCard}
          />
        )}

        {activeTab === 'REQUISITIONS' && (
          <RequisitionsView
            departments={departments}
            onViewJournal={onViewJournal}
            onCreatePo={handleCreatePoFromRequisition}
          />
        )}

        {activeTab === 'PURCHASE_ORDERS' && (
          <PurchaseOrdersView
            departments={departments}
            onViewJournal={onViewJournal}
            onNavigateToReceiving={handleNavigateToReceivingFromPo}
            initialRequisitionIdToOrder={navReqIdForPo}
          />
        )}

        {activeTab === 'ACCOUNTS_PAYABLE' && (
          <AccountsPayableModule
            departments={departments}
            accounts={accounts}
            onViewJournal={onViewJournal}
          />
        )}

        {activeTab === 'RECEIVING' && (
          <ReceivingView
            onViewJournal={onViewJournal}
            onOpenScanner={() => setScannerOpen(true)}
            initialPoReference={navPoNumberForReceiving}
          />
        )}

        {activeTab === 'ISSUE' && (
          <StockIssueView
            departments={departments}
            onViewJournal={onViewJournal}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeTab === 'TRANSFER' && (
          <StockTransferView onOpenScanner={() => setScannerOpen(true)} />
        )}

        {activeTab === 'STOCK_COUNT' && (
          <StockCountView
            onViewJournal={onViewJournal}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeTab === 'ADJUSTMENT' && (
          <StockAdjustmentView
            onViewJournal={onViewJournal}
            onOpenScanner={() => setScannerOpen(true)}
          />
        )}

        {activeTab === 'STOCK_CARD' && (
          <StockCardView initialItemId={stockCardItemId} />
        )}

        {activeTab === 'REPORTS' && <InventoryReportsView />}
      </div>

      {/* Global Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />
    </div>
  );
};
