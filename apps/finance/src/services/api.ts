/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Account,
  Department,
  JournalWithLines,
  RevenueTransaction,
  SpendingTransaction,
  MappingConfig,
  GeneralLedgerEntry,
  TrialBalanceReport,
  FinancialStatementsReport,
  UsaliStatementReport,
  DrilldownDetail,
  ControlException,
  MasterReportConfig,
  AccessControlState,
  SystemUser,
  UserRoleDefinition,
  InventoryCategory,
  InventoryStoreroom,
  InventoryItem,
  StockMovement,
  DepartmentRequisition,
  PurchaseOrder,
  GoodsReceipt,
  StockCountSession,
  StockAdjustmentRecord,
  InventoryDashboardKPIs,
  StaffEmployee,
  ServiceChargeCollection,
  ServiceChargeDistributionCycle,
  ServiceChargeKPIs,
  OwnerUnit,
  OwnerDistributionRuleConfig,
  OwnerDistributionBatch,
  OwnerPoolAllocationLine,
  OwnerPoolDashboardKPIs,
  OwnerDistributionEmailConfig,
  OwnerDistributionEmailDraft,
  OwnerEmailDispatchLog,
  OwnerEmailBatchResult,
  TaxTypeCode,
  TaxRuleConfig,
  TaxObligationItem,
  TaxPeriodSummaryKPIs,
  TaxReconciliationLine,
  TaxPeriodCloseValidation,
  TaxDocumentAttachment,
  ARAgingItem,
  APAgingItem,
  AgingSummary,
  ScottExecutiveMatrixSummary,
  OwnerStayRecord,
  PettyCashTransaction,
  PettyCashBalanceSummary,
  PettyCashReplenishmentClaim,
  PettyCashFloatConfig,
} from '../types';

export const api = {
  async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  },

  async reinitSheets() {
    const res = await fetch('/api/sheets/init', { method: 'POST' });
    return res.json();
  },

  async getAccounts(): Promise<Account[]> {
    const res = await fetch('/api/accounts');
    return res.json();
  },

  async saveAccount(account: Account): Promise<Account> {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save account');
    }
    return res.json();
  },

  async deactivateAccount(code: string): Promise<Account> {
    const res = await fetch('/api/accounts/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_code: code }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to deactivate account');
    }
    return res.json();
  },

  async deleteAccount(code: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/accounts/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete account');
    }
    return res.json();
  },

  async seedUsaliAccounts(): Promise<any> {
    const res = await fetch('/api/accounts/seed-usali', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to seed USALI accounts');
    }
    return res.json();
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetch('/api/departments');
    return res.json();
  },

  async saveDepartment(department: Department): Promise<Department> {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(department),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save department');
    }
    return res.json();
  },

  async getMapping(): Promise<MappingConfig> {
    const res = await fetch('/api/mapping');
    return res.json();
  },

  async updateMapping(config: Partial<MappingConfig>): Promise<MappingConfig> {
    const res = await fetch('/api/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  async getRevenue(): Promise<RevenueTransaction[]> {
    const res = await fetch('/api/revenue');
    return res.json();
  },

  async recordRevenue(data: {
    date: string;
    source: 'Manual' | 'PMS';
    department_code: string;
    account_code: string;
    amount: number;
    description: string;
    debit_account_code?: string;
  }): Promise<{ transaction: RevenueTransaction; draftJournal: JournalWithLines }> {
    const res = await fetch('/api/revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record revenue');
    }
    return res.json();
  },

  async getSpending(): Promise<SpendingTransaction[]> {
    const res = await fetch('/api/spending');
    return res.json();
  },

  async recordSpending(data: {
    date: string;
    type: 'Procurement' | 'Payroll' | 'Other';
    vendor_or_employee: string;
    department_code: string;
    account_code: string;
    amount: number;
    description: string;
    credit_account_code?: string;
  }): Promise<{ transaction: SpendingTransaction; draftJournal: JournalWithLines }> {
    const res = await fetch('/api/spending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record spending');
    }
    return res.json();
  },

  async getJournals(): Promise<JournalWithLines[]> {
    const res = await fetch('/api/journals');
    return res.json();
  },

  async getJournal(id: string): Promise<JournalWithLines> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Journal not found');
    return res.json();
  },

  async createJournal(data: {
    header: any;
    lines: any[];
  }): Promise<JournalWithLines> {
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create journal');
    }
    return res.json();
  },

  async validateJournal(id: string): Promise<JournalWithLines> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to validate journal');
    }
    return res.json();
  },

  async approveJournal(id: string, approver?: string): Promise<JournalWithLines> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve journal');
    }
    return res.json();
  },

  async postJournal(id: string, options?: { autoApprove?: boolean; approver?: string }): Promise<JournalWithLines> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoApprove: true, ...options }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post journal');
    }
    return res.json();
  },

  async reverseJournal(id: string, reversalDate?: string): Promise<any> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reversalDate }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reverse journal');
    }
    return res.json();
  },

  async deleteJournal(id: string): Promise<void> {
    const res = await fetch(`/api/journals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete draft journal');
    }
  },

  async getLedger(params?: {
    account_code?: string;
    period?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    account: Account | null;
    entries: GeneralLedgerEntry[];
    total_debit: number;
    total_credit: number;
    ending_balance: number;
  }> {
    const query = new URLSearchParams();
    if (params?.account_code) query.set('account_code', params.account_code);
    if (params?.period) query.set('period', params.period);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);

    const res = await fetch(`/api/ledger?${query.toString()}`);
    return res.json();
  },

  async getTrialBalance(period?: string): Promise<TrialBalanceReport> {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const res = await fetch(`/api/trial-balance?${query.toString()}`);
    return res.json();
  },

  async getDashboard(period?: string): Promise<any> {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const res = await fetch(`/api/dashboard?${query.toString()}`);
    return res.json();
  },

  async getFinancialStatements(period?: string): Promise<FinancialStatementsReport> {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const res = await fetch(`/api/reports/financial-statements?${query.toString()}`);
    return res.json();
  },

  async getUsaliStatement(period?: string): Promise<UsaliStatementReport> {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const res = await fetch(`/api/reports/usali?${query.toString()}`);
    return res.json();
  },

  async getDrilldown(params: {
    report_type: string;
    line_id?: string;
    account_code?: string;
    period?: string;
  }): Promise<DrilldownDetail> {
    const query = new URLSearchParams();
    query.set('report_type', params.report_type);
    if (params.line_id) query.set('line_id', params.line_id);
    if (params.account_code) query.set('account_code', params.account_code);
    if (params.period) query.set('period', params.period);
    const res = await fetch(`/api/reports/drilldown?${query.toString()}`);
    return res.json();
  },

  async getExceptions(period?: string): Promise<ControlException[]> {
    const query = new URLSearchParams();
    if (period) query.set('period', period);
    const res = await fetch(`/api/controls/exceptions?${query.toString()}`);
    return res.json();
  },

  async getAdminSettings(): Promise<any> {
    const res = await fetch('/api/admin/settings');
    return res.json();
  },

  async getMockDataStatus(): Promise<{
    journalHeadersCount: number;
    journalLinesCount: number;
    revenueTxCount: number;
    spendingTxCount: number;
    purchaseOrdersCount: number;
    requisitionsCount: number;
    receiptsCount: number;
    inventoryMovementsCount: number;
    ownerBatchesCount: number;
    serviceChargeCyclesCount: number;
    serviceChargeCollectionsCount: number;
    taxObligationsCount: number;
    dispatchesCount: number;
    isCleanSlate: boolean;
    isMockDataCleared: boolean;
  }> {
    const res = await fetch('/api/admin/mock-data/status');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch mock data status');
    }
    return res.json();
  },

  async resetMockData(options?: { clearMaster?: boolean }): Promise<{
    success: boolean;
    message: string;
    cleared: Record<string, number>;
  }> {
    const res = await fetch('/api/admin/mock-data/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reset mock data');
    }
    return res.json();
  },

  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/mock-data/seed-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to seed demo data');
    }
    return res.json();
  },

  async updateAdminSettings(settings: any): Promise<any> {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update admin settings');
    }
    return res.json();
  },

  async getSheetsDiagnostics(): Promise<any> {
    const res = await fetch('/api/sheets/diagnostics');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch diagnostics');
    }
    return res.json();
  },

  async ingestPmsAudit(data: {
    date: string;
    room_revenue: number;
    fb_revenue: number;
    other_revenue?: number;
    description?: string;
  }): Promise<any> {
    const res = await fetch('/api/integrations/pms-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to ingest PMS night audit');
    }
    return res.json();
  },

  async getReportConfig(): Promise<MasterReportConfig> {
    const res = await fetch('/api/config/reports');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load report configuration');
    }
    return res.json();
  },

  async updateReportConfig(config: Partial<MasterReportConfig>): Promise<MasterReportConfig> {
    const res = await fetch('/api/config/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update report configuration');
    }
    return res.json();
  },

  async resetReportConfig(): Promise<MasterReportConfig> {
    const res = await fetch('/api/config/reports/reset', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reset report configuration');
    }
    return res.json();
  },

  // --- ACCESS CONTROL & USER ROLE APIS ---
  async verifyUser(params: { email: string; password?: string; isGoogleOAuth?: boolean } | string): Promise<{ authorized: boolean; user: SystemUser; role: UserRoleDefinition; state: AccessControlState }> {
    const payload = typeof params === 'string' ? { email: params } : params;
    const res = await fetch('/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to authenticate user');
    }
    return res.json();
  },

  async getAccessControl(): Promise<AccessControlState> {
    const res = await fetch('/api/admin/access-control');
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch access control state');
    }
    return res.json();
  },

  async switchActiveUser(userId: string): Promise<AccessControlState> {
    const res = await fetch('/api/admin/access-control/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to switch active user');
    }
    return res.json();
  },

  async saveUser(user: Partial<SystemUser> & { name: string; email: string; roleId: string }): Promise<{ user: SystemUser; state: AccessControlState }> {
    const res = await fetch('/api/admin/access-control/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save user');
    }
    return res.json();
  },

  async deleteUser(userId: string): Promise<{ success: boolean; state: AccessControlState }> {
    const res = await fetch(`/api/admin/access-control/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete user');
    }
    return res.json();
  },

  async saveRole(role: UserRoleDefinition): Promise<{ role: UserRoleDefinition; state: AccessControlState }> {
    const res = await fetch('/api/admin/access-control/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save role');
    }
    return res.json();
  },

  async deleteRole(roleId: string): Promise<{ success: boolean; state: AccessControlState }> {
    const res = await fetch(`/api/admin/access-control/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete role');
    }
    return res.json();
  },

  async resetAccessControl(): Promise<AccessControlState> {
    const res = await fetch('/api/admin/access-control/reset', {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reset access control');
    }
    return res.json();
  },

  // ==========================================
  // INVENTORY MANAGEMENT API CLIENT METHODS
  // ==========================================

  async getInventoryDashboard(): Promise<InventoryDashboardKPIs> {
    const res = await fetch('/api/inventory/dashboard');
    if (!res.ok) throw new Error('Failed to load inventory dashboard');
    return res.json();
  },

  async getInventoryCategories(): Promise<InventoryCategory[]> {
    const res = await fetch('/api/inventory/categories');
    if (!res.ok) throw new Error('Failed to load inventory categories');
    return res.json();
  },

  async saveInventoryCategory(category: Partial<InventoryCategory>): Promise<InventoryCategory> {
    const res = await fetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save inventory category');
    }
    return res.json();
  },

  async getInventoryStorerooms(): Promise<InventoryStoreroom[]> {
    const res = await fetch('/api/inventory/storerooms');
    if (!res.ok) throw new Error('Failed to load storerooms');
    return res.json();
  },

  async saveInventoryStoreroom(storeroom: Partial<InventoryStoreroom>): Promise<InventoryStoreroom> {
    const res = await fetch('/api/inventory/storerooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeroom),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save storeroom');
    }
    return res.json();
  },

  async deleteInventoryStoreroom(id: string): Promise<{ success: boolean; deletedId: string }> {
    const res = await fetch(`/api/inventory/storerooms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete storeroom');
    }
    return res.json();
  },

  async getInventoryItems(): Promise<InventoryItem[]> {
    const res = await fetch('/api/inventory/items');
    if (!res.ok) throw new Error('Failed to load inventory items');
    return res.json();
  },

  async getInventoryItem(id: string): Promise<InventoryItem> {
    const res = await fetch(`/api/inventory/items/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Item not found');
    return res.json();
  },

  async saveInventoryItem(item: Partial<InventoryItem>): Promise<InventoryItem> {
    const isEdit = Boolean(item.item_id);
    const url = isEdit ? `/api/inventory/items/${encodeURIComponent(item.item_id!)}` : '/api/inventory/items';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save inventory item');
    }
    return res.json();
  },

  async getItemStockCard(id: string): Promise<{
    item: InventoryItem;
    opening_stock: number;
    current_stock: number;
    total_in: number;
    total_out: number;
    movements: StockMovement[];
  }> {
    const res = await fetch(`/api/inventory/items/${encodeURIComponent(id)}/stock-card`);
    if (!res.ok) throw new Error('Failed to load item stock card');
    return res.json();
  },

  async lookupBarcode(barcode: string): Promise<InventoryItem> {
    const res = await fetch(`/api/inventory/barcode/${encodeURIComponent(barcode)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Barcode "${barcode}" not recognized`);
    }
    return res.json();
  },

  async getStockMovements(filters?: {
    item_id?: string;
    storeroom_id?: string;
    movement_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<StockMovement[]> {
    const params = new URLSearchParams();
    if (filters?.item_id) params.set('item_id', filters.item_id);
    if (filters?.storeroom_id) params.set('storeroom_id', filters.storeroom_id);
    if (filters?.movement_type) params.set('movement_type', filters.movement_type);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);

    const res = await fetch(`/api/inventory/movements?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load stock movements');
    return res.json();
  },

  async processGoodsReceipt(data: {
    date: string;
    po_reference: string;
    vendor_name: string;
    storeroom_id: string;
    items: {
      item_id: string;
      received_quantity: number;
      unit_cost: number;
      bin_location?: string;
      batch_or_lot?: string;
      expiry_date?: string;
    }[];
    notes?: string;
  }): Promise<{ receipt: GoodsReceipt; journal_id?: string }> {
    const res = await fetch('/api/inventory/receiving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process goods receipt');
    }
    return res.json();
  },

  async getGoodsReceipts(): Promise<GoodsReceipt[]> {
    const res = await fetch('/api/inventory/receipts');
    if (!res.ok) throw new Error('Failed to load goods receipts');
    return res.json();
  },

  async getRequisitions(): Promise<DepartmentRequisition[]> {
    const res = await fetch('/api/inventory/requisitions');
    if (!res.ok) throw new Error('Failed to load requisitions');
    return res.json();
  },

  async createRequisition(data: {
    date: string;
    department_code: string;
    requester_name: string;
    storeroom_id: string;
    items: { item_id: string; requested_quantity: number }[];
    notes?: string;
  }): Promise<DepartmentRequisition> {
    const res = await fetch('/api/inventory/requisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create requisition');
    }
    return res.json();
  },

  async approveRequisition(
    id: string,
    approverName: string,
    itemApprovals?: { item_id: string; approved_quantity: number }[]
  ): Promise<DepartmentRequisition> {
    const res = await fetch(`/api/inventory/requisitions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver_name: approverName, itemApprovals }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve requisition');
    }
    return res.json();
  },

  async issueRequisition(
    id: string,
    issuerName: string
  ): Promise<{ requisition: DepartmentRequisition; journal_id?: string }> {
    const res = await fetch(`/api/inventory/requisitions/${encodeURIComponent(id)}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issuer_name: issuerName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to issue requisition');
    }
    return res.json();
  },

  // ==========================================
  // PURCHASE ORDER (PROCUREMENT) APIS
  // ==========================================

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const res = await fetch('/api/inventory/purchase-orders');
    if (!res.ok) throw new Error('Failed to load purchase orders');
    return res.json();
  },

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to load purchase order');
    return res.json();
  },

  async createPurchaseOrder(data: {
    order_date?: string;
    expected_delivery_date?: string;
    supplier_name: string;
    supplier_contact?: string;
    supplier_email?: string;
    supplier_address?: string;
    storeroom_id: string;
    department_code: string;
    requisition_ids?: string[];
    items: {
      item_id: string;
      ordered_quantity: number;
      unit_cost?: number;
      requisition_id?: string;
      notes?: string;
    }[];
    tax_rate_pct?: number;
    payment_terms?: string;
    notes?: string;
    created_by?: string;
  }): Promise<PurchaseOrder> {
    const res = await fetch('/api/inventory/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create purchase order');
    }
    return res.json();
  },

  async generatePurchaseOrderJournal(
    poId: string,
    mode: 'COMMITMENT' | 'ACCRUAL' = 'COMMITMENT'
  ): Promise<{ po: PurchaseOrder; journal_id: string }> {
    const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(poId)}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate purchase order journal');
    }
    return res.json();
  },

  async updatePurchaseOrderStatus(
    poId: string,
    status: PurchaseOrder['status']
  ): Promise<PurchaseOrder> {
    const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(poId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update purchase order status');
    }
    return res.json();
  },

  async updatePurchaseOrder(
    poId: string,
    updates: Partial<PurchaseOrder>
  ): Promise<PurchaseOrder> {
    const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(poId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update purchase order details');
    }
    return res.json();
  },

  async receivePurchaseOrder(
    poId: string,
    options?: {
      received_date?: string;
      notes?: string;
      storeroom_id?: string;
      items?: {
        item_id: string;
        received_quantity: number;
        unit_cost?: number;
        bin_location?: string;
        batch_or_lot?: string;
        expiry_date?: string;
      }[];
      userName?: string;
    }
  ): Promise<{ receipt: GoodsReceipt; po: PurchaseOrder; journal_id?: string }> {
    const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(poId)}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to receive purchase order');
    }
    return res.json();
  },

  // --- ACCOUNTS RECEIVABLE (AR) APIS ---
  async getARItems(): Promise<{ items: ARAgingItem[]; summary: AgingSummary }> {
    const res = await fetch('/api/ar/items');
    if (!res.ok) throw new Error('Failed to load Accounts Receivable records');
    return res.json();
  },

  async recordARSettlement(data: {
    ar_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    bank_account_code: string;
    reference: string;
    userName?: string;
  }): Promise<{ settlement_id: string; journal_id: string }> {
    const res = await fetch('/api/ar/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record AR settlement');
    }
    return res.json();
  },

  // --- ACCOUNTS PAYABLE (AP) APIS ---
  async getAPItems(): Promise<{ items: APAgingItem[]; summary: AgingSummary }> {
    const res = await fetch('/api/ap/items');
    if (!res.ok) throw new Error('Failed to load Accounts Payable records');
    return res.json();
  },

  async recordAPPayment(data: {
    ap_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    bank_account_code: string;
    reference: string;
    userName?: string;
  }): Promise<{ payment_id: string; journal_id: string }> {
    const res = await fetch('/api/ap/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record AP payment');
    }
    return res.json();
  },

  async directStockIssue(data: {
    date: string;
    storeroom_id: string;
    department_code: string;
    items: { item_id: string; quantity: number }[];
    issued_to: string;
    notes?: string;
  }): Promise<{ movements: StockMovement[]; journal_id?: string }> {
    const res = await fetch('/api/inventory/issues/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to issue stock');
    }
    return res.json();
  },

  async processStockTransfer(data: {
    date: string;
    from_storeroom_id: string;
    to_storeroom_id: string;
    to_bin_location?: string;
    items: { item_id: string; quantity: number }[];
    notes?: string;
  }): Promise<{ success: boolean; movements: StockMovement[] }> {
    const res = await fetch('/api/inventory/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to transfer stock');
    }
    return res.json();
  },

  async getStockCountSessions(): Promise<StockCountSession[]> {
    const res = await fetch('/api/inventory/counts');
    if (!res.ok) throw new Error('Failed to load count sessions');
    return res.json();
  },

  async getStockCountSession(id: string): Promise<StockCountSession> {
    const res = await fetch(`/api/inventory/counts/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Count session not found');
    return res.json();
  },

  async startStockCount(data: {
    title: string;
    storeroom_id: string;
    counted_by: string;
  }): Promise<StockCountSession> {
    const res = await fetch('/api/inventory/counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start stock count');
    }
    return res.json();
  },

  async updateStockCountItems(
    id: string,
    updates: { item_id: string; physical_quantity: number; notes?: string }[]
  ): Promise<StockCountSession> {
    const res = await fetch(`/api/inventory/counts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update count');
    }
    return res.json();
  },

  async submitStockCount(id: string): Promise<StockCountSession> {
    const res = await fetch(`/api/inventory/counts/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit count');
    }
    return res.json();
  },

  async approveStockCount(
    id: string,
    approverName: string
  ): Promise<{ session: StockCountSession; journal_id?: string }> {
    const res = await fetch(`/api/inventory/counts/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver_name: approverName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve count');
    }
    return res.json();
  },

  async createStockAdjustment(data: {
    date: string;
    type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
    storeroom_id: string;
    item_id: string;
    quantity: number;
    reason_code: string;
    reason_notes: string;
  }): Promise<{ adjustment: StockAdjustmentRecord; journal_id?: string }> {
    const res = await fetch('/api/inventory/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record stock adjustment');
    }
    return res.json();
  },

  async getStockAdjustments(): Promise<StockAdjustmentRecord[]> {
    const res = await fetch('/api/inventory/adjustments');
    if (!res.ok) throw new Error('Failed to load adjustments');
    return res.json();
  },

  async getInventoryReports(params?: {
    period?: string;
    storeroom_id?: string;
    category_id?: string;
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.storeroom_id) query.set('storeroom_id', params.storeroom_id);
    if (params?.category_id) query.set('category_id', params.category_id);

    const res = await fetch(`/api/inventory/reports?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load inventory reports');
    return res.json();
  },

  // --- STAFF SERVICE CHARGE & GRATUITIES POOL ---

  async getServiceChargeKPIs(): Promise<ServiceChargeKPIs> {
    const res = await fetch('/api/service-charge/kpis');
    if (!res.ok) throw new Error('Failed to load Service Charge KPIs');
    return res.json();
  },

  async getServiceChargeEmployees(): Promise<StaffEmployee[]> {
    const res = await fetch('/api/service-charge/employees');
    if (!res.ok) throw new Error('Failed to load employee points registry');
    return res.json();
  },

  async saveServiceChargeEmployee(emp: Partial<StaffEmployee> & { employee_name: string; department_code: string }): Promise<StaffEmployee> {
    const res = await fetch('/api/service-charge/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emp),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save employee');
    }
    return res.json();
  },

  async deleteServiceChargeEmployee(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/service-charge/employees/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to deactivate employee');
    }
    return res.json();
  },

  async getServiceChargeCollections(period?: string): Promise<ServiceChargeCollection[]> {
    const url = period ? `/api/service-charge/collections?period=${encodeURIComponent(period)}` : '/api/service-charge/collections';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load service charge collections');
    return res.json();
  },

  async recordServiceChargeCollection(data: {
    date: string;
    source: string;
    department_code: string;
    gross_sales_amount: number;
    service_charge_rate_pct?: number;
    reference_no?: string;
    notes?: string;
    auto_post_journal?: boolean;
  }): Promise<{ collection: ServiceChargeCollection; journal?: any }> {
    const res = await fetch('/api/service-charge/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record service charge collection');
    }
    return res.json();
  },

  async getServiceChargeCycles(): Promise<ServiceChargeDistributionCycle[]> {
    const res = await fetch('/api/service-charge/cycles');
    if (!res.ok) throw new Error('Failed to load distribution cycles');
    return res.json();
  },

  async getServiceChargeCycle(id: string): Promise<ServiceChargeDistributionCycle> {
    const res = await fetch(`/api/service-charge/cycles/${id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load cycle detail');
    }
    return res.json();
  },

  async calculateServiceChargeDistribution(params: {
    period: string;
    company_retention_pct?: number;
    custom_pool_amount?: number;
    title?: string;
    standard_calendar_days?: number;
    staff_days_override?: Record<string, number>;
  }): Promise<ServiceChargeDistributionCycle> {
    const res = await fetch('/api/service-charge/cycles/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to calculate distribution cycle');
    }
    return res.json();
  },

  async approveServiceChargeDistribution(cycleId: string, approverName?: string): Promise<{ cycle: ServiceChargeDistributionCycle; journal: any }> {
    const res = await fetch(`/api/service-charge/cycles/${cycleId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver_name: approverName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve and post distribution to General Ledger');
    }
    return res.json();
  },

  async resetServiceChargeDefaults(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/service-charge/seed-defaults', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset service charge defaults');
    return res.json();
  },

  // --- APARTMENT OWNER POOL & RETURN DISTRIBUTION ---

  async getOwnerPoolKPIs(period?: string): Promise<OwnerPoolDashboardKPIs> {
    const url = period ? `/api/owner-pool/kpis?period=${encodeURIComponent(period)}` : '/api/owner-pool/kpis';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch Owner Pool KPIs');
    return res.json();
  },

  async getOwnerPoolRoomRevenue(period?: string): Promise<{
    totalRoomRevenue: number;
    transientRevenue: number;
    groupRevenue: number;
    transactionsCount: number;
    journalLines: any[];
  }> {
    const url = period ? `/api/owner-pool/room-revenue?period=${encodeURIComponent(period)}` : '/api/owner-pool/room-revenue';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch posted Room Revenue');
    return res.json();
  },

  async getOwnerUnits(): Promise<{
    units: OwnerUnit[];
    summary: {
      totalUnitsCount: number;
      activeUnitsCount: number;
      eligibleUnitsCount: number;
      totalEligibleSqm: number;
      distinctOwnersCount: number;
      averageSqm: number;
    };
  }> {
    const res = await fetch('/api/owner-pool/units');
    if (!res.ok) throw new Error('Failed to fetch apartment units');
    return res.json();
  },

  async saveOwnerUnit(unit: Partial<OwnerUnit> & { unit_number: string; owner_name: string; unit_sqm: number }): Promise<OwnerUnit> {
    const res = await fetch('/api/owner-pool/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unit),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save apartment unit');
    }
    return res.json();
  },

  async deleteOwnerUnit(unitId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/owner-pool/units/${encodeURIComponent(unitId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete apartment unit');
    }
    return res.json();
  },

  async getOwnerPoolConfig(): Promise<{
    config: OwnerDistributionRuleConfig;
    history: OwnerDistributionRuleConfig[];
  }> {
    const res = await fetch('/api/owner-pool/config');
    if (!res.ok) throw new Error('Failed to fetch Owner Pool configuration');
    return res.json();
  },

  async updateOwnerPoolConfig(config: Partial<OwnerDistributionRuleConfig>): Promise<{
    success: boolean;
    config: OwnerDistributionRuleConfig;
    history: OwnerDistributionRuleConfig[];
  }> {
    const res = await fetch('/api/owner-pool/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update Owner Pool configuration');
    }
    return res.json();
  },

  async getOwnerPoolBatches(): Promise<OwnerDistributionBatch[]> {
    const res = await fetch('/api/owner-pool/batches');
    if (!res.ok) throw new Error('Failed to fetch distribution batches');
    return res.json();
  },

  async getOwnerPoolBatch(batchId: string): Promise<OwnerDistributionBatch> {
    const res = await fetch(`/api/owner-pool/batches/${encodeURIComponent(batchId)}`);
    if (!res.ok) throw new Error('Failed to fetch distribution batch');
    return res.json();
  },

  async calculateOwnerPoolDistribution(params: {
    period: string;
    custom_room_revenue?: number;
    title?: string;
  }): Promise<OwnerDistributionBatch> {
    const res = await fetch('/api/owner-pool/batches/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to calculate Owner Pool distribution');
    }
    return res.json();
  },

  async markOwnerPoolBatchInReview(batchId: string): Promise<OwnerDistributionBatch> {
    const res = await fetch(`/api/owner-pool/batches/${encodeURIComponent(batchId)}/review`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update batch status to Review');
    }
    return res.json();
  },

  async approveOwnerPoolBatch(batchId: string, approverName?: string): Promise<OwnerDistributionBatch> {
    const res = await fetch(`/api/owner-pool/batches/${encodeURIComponent(batchId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver_name: approverName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to approve batch');
    }
    return res.json();
  },

  async postOwnerPoolBatch(batchId: string, postedBy?: string): Promise<OwnerDistributionBatch> {
    const res = await fetch(`/api/owner-pool/batches/${encodeURIComponent(batchId)}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posted_by: postedBy }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post batch to General Ledger');
    }
    return res.json();
  },

  async reverseOwnerPoolBatch(batchId: string, reason: string, reversedBy?: string): Promise<OwnerDistributionBatch> {
    const res = await fetch(`/api/owner-pool/batches/${encodeURIComponent(batchId)}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, reversed_by: reversedBy }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reverse batch');
    }
    return res.json();
  },

  async getOwnerStatement(unitId: string, period?: string): Promise<{
    unit: OwnerUnit | null;
    distributionLine: OwnerPoolAllocationLine | null;
    batch: OwnerDistributionBatch | null;
    historicalLines: { period: string; line: OwnerPoolAllocationLine; batchStatus: string }[];
  }> {
    const url = `/api/owner-pool/statement?unit_id=${encodeURIComponent(unitId)}${period ? `&period=${encodeURIComponent(period)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch Owner Statement');
    return res.json();
  },

  async getScottExecutiveMatrix(period: string = '2026-09'): Promise<ScottExecutiveMatrixSummary> {
    const res = await fetch(`/api/owner-pool/scotts-matrix?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('Failed to fetch Scott Executive Matrix');
    return res.json();
  },

  async getOwnerStays(period?: string): Promise<OwnerStayRecord[]> {
    const url = `/api/owner-pool/stays${period ? `?period=${encodeURIComponent(period)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch owner stays');
    return res.json();
  },

  async recordOwnerStay(data: {
    unit_id: string;
    check_in_date: string;
    check_out_date: string;
    nights_count: number;
    period: string;
    market_rate_per_night: number;
    notes?: string;
  }): Promise<OwnerStayRecord> {
    const res = await fetch('/api/owner-pool/stays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record owner stay');
    }
    return res.json();
  },

  // --- OWNER RETURN DISTRIBUTION EMAIL AUTOMATION API ---

  async getOwnerEmailConfig(): Promise<OwnerDistributionEmailConfig> {
    const res = await fetch('/api/owner-pool/email-config');
    if (!res.ok) throw new Error('Failed to fetch email configuration');
    return res.json();
  },

  async updateOwnerEmailConfig(config: Partial<OwnerDistributionEmailConfig>): Promise<{ success: boolean; config: OwnerDistributionEmailConfig }> {
    const res = await fetch('/api/owner-pool/email-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update email configuration');
    }
    return res.json();
  },

  async getOwnerEmailDrafts(period: string = '2026-09', batchId?: string): Promise<OwnerDistributionEmailDraft[]> {
    const url = `/api/owner-pool/email-drafts?period=${encodeURIComponent(period)}${batchId ? `&batch_id=${encodeURIComponent(batchId)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load owner distribution email drafts');
    return res.json();
  },

  async saveOwnerEmailDraft(draftId: string, updates: Partial<OwnerDistributionEmailDraft>): Promise<{ success: boolean; draft: OwnerDistributionEmailDraft }> {
    const res = await fetch(`/api/owner-pool/email-drafts/${encodeURIComponent(draftId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save email draft');
    }
    return res.json();
  },

  async resetOwnerEmailDraft(draftId: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/owner-pool/email-drafts/${encodeURIComponent(draftId)}/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset email draft to template');
    return res.json();
  },

  async sendSingleOwnerEmail(draftId: string, testEmail?: string): Promise<{ success: boolean; dispatch: OwnerEmailDispatchLog; draft: OwnerDistributionEmailDraft }> {
    const res = await fetch(`/api/owner-pool/email-drafts/${encodeURIComponent(draftId)}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_email: testEmail }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send owner email');
    }
    return res.json();
  },

  // ONE BUTTON TO EMAIL ALL INVESTORS
  async emailAllInvestors(params: {
    period: string;
    unit_ids?: string[];
    test_email?: string;
  }): Promise<{ success: boolean; message: string; result: OwnerEmailBatchResult }> {
    const res = await fetch('/api/owner-pool/email-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to email all investors');
    }
    return res.json();
  },

  async getOwnerEmailDispatches(period?: string): Promise<OwnerEmailDispatchLog[]> {
    const url = `/api/owner-pool/email-dispatches${period ? `?period=${encodeURIComponent(period)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch email dispatch logs');
    return res.json();
  },

  async clearOwnerEmailDispatches(period?: string): Promise<{ count: number }> {
    const url = `/api/owner-pool/email-dispatches${period ? `?period=${encodeURIComponent(period)}` : ''}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear email logs');
    return res.json();
  },

  async testOwnerEmailSmtp(smtp?: any): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/owner-pool/email-test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp }),
    });
    return res.json();
  },

  getDocumentPreviewUrl(docType: string, unitId: string, period: string): string {
    return `/api/owner-pool/document-preview?doc_type=${encodeURIComponent(docType)}&unit_id=${encodeURIComponent(unitId)}&period=${encodeURIComponent(period)}`;
  },

  // --- TAX MODULE API METHODS ---

  async getTaxRules(): Promise<TaxRuleConfig[]> {
    const res = await fetch('/api/tax/rules');
    if (!res.ok) throw new Error('Failed to fetch tax rules');
    return res.json();
  },

  async updateTaxRule(taxCode: TaxTypeCode, data: Partial<TaxRuleConfig>, updatedBy?: string): Promise<TaxRuleConfig> {
    const res = await fetch(`/api/tax/rules/${encodeURIComponent(taxCode)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(updatedBy ? { 'x-user-name': updatedBy } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update tax rule');
    }
    return res.json();
  },

  async createTaxRule(data: Partial<TaxRuleConfig>, createdBy?: string): Promise<TaxRuleConfig> {
    const res = await fetch('/api/tax/rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(createdBy ? { 'x-user-name': createdBy } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create tax rule');
    }
    return res.json();
  },

  async deleteTaxRule(taxCode: string): Promise<{ success: boolean; deletedCode: string }> {
    const res = await fetch(`/api/tax/rules/${encodeURIComponent(taxCode)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete tax rule');
    }
    return res.json();
  },

  async getTaxSummary(period: string): Promise<TaxPeriodSummaryKPIs> {
    const res = await fetch(`/api/tax/summary?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('Failed to fetch tax summary');
    return res.json();
  },

  async getTaxObligations(period: string): Promise<TaxObligationItem[]> {
    const res = await fetch(`/api/tax/obligations?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('Failed to fetch tax obligations');
    return res.json();
  },

  async calculateTaxObligation(period: string, taxCode: TaxTypeCode, user?: string): Promise<TaxObligationItem> {
    const res = await fetch('/api/tax/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-user-name': user } : {}),
      },
      body: JSON.stringify({ period, tax_code: taxCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to calculate tax obligation');
    }
    return res.json();
  },

  async recordTaxPayment(params: {
    period: string;
    tax_code: TaxTypeCode;
    payment_date: string;
    ntpn_reference: string;
    amount: number;
    payment_bank_account?: string;
    user?: string;
  }): Promise<TaxObligationItem> {
    const res = await fetch('/api/tax/payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.user ? { 'x-user-name': params.user } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record tax payment');
    }
    return res.json();
  },

  async recordTaxFiling(params: {
    period: string;
    tax_code: TaxTypeCode;
    filing_date: string;
    bpe_reference: string;
    user?: string;
  }): Promise<TaxObligationItem> {
    const res = await fetch('/api/tax/filing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.user ? { 'x-user-name': params.user } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record tax filing');
    }
    return res.json();
  },

  async attachTaxDocument(params: {
    period: string;
    tax_code: TaxTypeCode;
    doc_type: string;
    file_name: string;
    file_url?: string;
    notes?: string;
    user?: string;
  }): Promise<TaxDocumentAttachment> {
    const res = await fetch('/api/tax/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(params.user ? { 'x-user-name': params.user } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to attach tax document');
    }
    return res.json();
  },

  async getTaxReconciliation(period: string): Promise<TaxReconciliationLine[]> {
    const res = await fetch(`/api/tax/reconciliation?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('Failed to fetch tax reconciliation');
    return res.json();
  },

  async checkTaxPeriodClose(period: string): Promise<TaxPeriodCloseValidation> {
    const res = await fetch(`/api/tax/period-close-check?period=${encodeURIComponent(period)}`);
    if (!res.ok) throw new Error('Failed to validate tax period close');
    return res.json();
  },

  async closeTaxPeriod(period: string, notes?: string, user?: string): Promise<{ success: boolean; period: string }> {
    const res = await fetch('/api/tax/period-close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-user-name': user } : {}),
      },
      body: JSON.stringify({ period, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to close tax period');
    }
    return res.json();
  },

  async reopenTaxPeriod(period: string, user?: string): Promise<{ success: boolean; period: string }> {
    const res = await fetch('/api/tax/period-reopen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-user-name': user } : {}),
      },
      body: JSON.stringify({ period }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reopen tax period');
    }
    return res.json();
  },

  // --- KAS KECIL OPERASIONAL (OPERATIONAL PETTY CASH) API METHODS ---

  async getPettyCashBalance(): Promise<PettyCashBalanceSummary> {
    const res = await fetch('/api/petty-cash/balance');
    if (!res.ok) throw new Error('Failed to fetch petty cash balance');
    return res.json();
  },

  async getPettyCashTransactions(): Promise<PettyCashTransaction[]> {
    const res = await fetch('/api/petty-cash/transactions');
    if (!res.ok) throw new Error('Failed to fetch petty cash transactions');
    return res.json();
  },

  async createPettyCashTransaction(data: {
    date: string;
    category: string;
    department_code?: string;
    department_name?: string;
    account_code?: string;
    account_name?: string;
    amount: number;
    paid_to: string;
    description: string;
    receipt_image_url?: string;
    receipt_filename?: string;
    created_by?: string;
  }): Promise<PettyCashTransaction> {
    const res = await fetch('/api/petty-cash/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record petty cash expense');
    }
    return res.json();
  },

  async deletePettyCashTransaction(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/petty-cash/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete petty cash voucher');
    }
    return res.json();
  },

  async replenishPettyCash(params: {
    approved_by?: string;
    notes?: string;
    bank_account_code?: string;
  }): Promise<{ claim: PettyCashReplenishmentClaim; journalId: string }> {
    const res = await fetch('/api/petty-cash/replenish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process petty cash replenishment');
    }
    return res.json();
  },

  async updatePettyCashConfig(config: Partial<PettyCashFloatConfig>): Promise<PettyCashFloatConfig> {
    const res = await fetch('/api/petty-cash/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update petty cash config');
    }
    return res.json();
  },
};

