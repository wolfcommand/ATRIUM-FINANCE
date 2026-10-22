/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type NormalBalance = 'Debit' | 'Credit';
export type ActiveStatus = 'Y' | 'N';

export interface Account {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  statutory_line: string;
  usali_line: string;
  active: ActiveStatus;
}

export interface Department {
  department_code: string;
  department_name: string;
  active: ActiveStatus;
}

export type JournalStatus = 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'POSTED' | 'REVERSED';
export type SourceType = 'REVENUE' | 'SPENDING' | 'MANUAL' | 'REVERSAL' | 'AR_SETTLEMENT' | 'AP_PAYMENT';

export interface JournalHeader {
  journal_id: string;
  /** Wolf company workspace — required for isolation (Prompt 5) */
  company_id: string;
  /** ISO 4217 currency for all lines on this journal */
  currency: string;
  journal_date: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  status: JournalStatus;
  source_type: SourceType;
  source_reference: string;
  created_by: string;
  approved_by: string;
  posted_at: string;
  reversal_of: string;
  /** Snapshot of approval policy used when approved (architecture §9.5) */
  approval_policy_snapshot?: {
    policy_id: string;
    policy_version: number;
    request_type: string;
    snapshotted_at: string;
  };
}

export interface JournalLine {
  journal_id: string;
  line_no: number;
  account_code: string;
  department_code: string;
  /** Major units (derived from debit_minor for UI / Sheets) */
  debit: number;
  credit: number;
  /** Integer minor units — source of truth for money */
  debit_minor: number;
  credit_minor: number;
  currency: string;
  description: string;
}

export interface JournalWithLines extends JournalHeader {
  lines: JournalLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export type RevenueSource = 'Manual' | 'PMS';

export interface RevenueTransaction {
  transaction_id: string;
  date: string;
  source: RevenueSource;
  department_code: string;
  account_code: string;
  amount: number;
  description: string;
  journal_id: string;
}

export type SpendingType = 'Procurement' | 'Payroll' | 'Other';

export interface SpendingTransaction {
  transaction_id: string;
  date: string;
  type: SpendingType;
  vendor_or_employee: string;
  department_code: string;
  account_code: string;
  amount: number;
  description: string;
  journal_id: string;
}

export interface MappingConfig {
  revenue_default_debit_account: string; // e.g. Cash in Transit / Guest Ledger (Asset)
  spending_procurement_credit_account: string; // e.g. Accounts Payable (Liability)
  spending_payroll_credit_account: string; // e.g. Accrued Payroll / Bank (Liability/Asset)
  spending_other_credit_account: string;
  confirmed_by_controller: boolean;
}

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  revenue_default_debit_account: '',
  spending_procurement_credit_account: '',
  spending_payroll_credit_account: '',
  spending_other_credit_account: '',
  confirmed_by_controller: false,
};

export interface GeneralLedgerEntry {
  journal_id: string;
  journal_date: string;
  period: string;
  source_type: string;
  source_reference: string;
  department_code: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface TrialBalanceItem {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  debit_sum: number;
  credit_sum: number;
  net_balance: number;
  net_debit: number;
  net_credit: number;
}

export interface TrialBalanceReport {
  period: string;
  items: TrialBalanceItem[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
  variance: number;
}

export interface DatabaseStatus {
  connected: boolean;
  type: 'google_sheets' | 'session_storage';
  spreadsheet_id?: string;
  service_account?: string;
  error?: string;
  tabs_initialized: string[];
}

export interface SystemSettings {
  property_name: string;
  room_count: number;
  base_currency: string;
  fiscal_year: string;
  period_lock_date: string; // e.g. '2026-08-31'
  controller_name: string;
}

export interface SheetsDiagnostics {
  connected: boolean;
  latency_ms: number;
  spreadsheet_title?: string;
  spreadsheet_id: string;
  tabs_verified: {
    tab_name: string;
    rows_count: number;
    has_headers: boolean;
  }[];
  checked_at: string;
}

export type MasterModule =
  | 'command-centre'
  | 'operations'
  | 'accounting-core'
  | 'reports'
  | 'configuration'
  | 'controls-audit'
  | 'integrations'
  | 'administration';

export interface ReportLineItem {
  line_id: string;
  label: string;
  amount: number;
  prior_amount?: number;
  account_codes: string[];
  is_subtotal?: boolean;
  is_header?: boolean;
  indent_level: number;
}

export type ReportNumberScale = 'full' | 'thousands' | 'millions';
export type NegativeNumberFormat = 'parentheses' | 'minus' | 'red';
export type ZeroValueFormat = 'dash' | 'zero' | 'blank';
export type ReportTableDensity = 'compact' | 'standard' | 'spacious';
export type ReportVisualTheme = 'slate' | 'classic' | 'emerald' | 'contrast';

export interface ReportFormattingSettings {
  currency_symbol: string;
  currency_code: string;
  currency_position: 'prefix' | 'suffix';
  decimal_places: number;
  number_scale: ReportNumberScale;
  negative_format: NegativeNumberFormat;
  zero_format: ZeroValueFormat;
  table_density: ReportTableDensity;
  visual_theme: ReportVisualTheme;
  show_account_codes: boolean;
  show_department_tags: boolean;
  show_variance_column: boolean;
  show_percent_of_revenue: boolean;
  double_underline_totals: boolean;
  show_signature_block: boolean;
  header_company_name: string;
  header_subtitle: string;
  footer_disclaimer: string;
}

export interface ConfigurableReportLine {
  id: string;
  label: string;
  category: string;
  account_prefixes: string[]; // e.g. ['40', '4010']
  indent_level: number;
  is_visible: boolean;
  is_bold: boolean;
  order: number;
}

export interface ConfigurableReportSection {
  section_id: string;
  section_title: string;
  is_visible: boolean;
  lines: ConfigurableReportLine[];
}

export interface ReportStructureConfig {
  usali_sections: ConfigurableReportSection[];
  balance_sheet_sections: ConfigurableReportSection[];
  income_statement_sections: ConfigurableReportSection[];
}

export interface MasterReportConfig {
  formatting: ReportFormattingSettings;
  structures: ReportStructureConfig;
  updated_at: string;
}

export const DEFAULT_MASTER_REPORT_CONFIG: MasterReportConfig = {
  formatting: {
    currency_symbol: 'Rp',
    currency_code: 'IDR',
    currency_position: 'prefix',
    decimal_places: 0,
    number_scale: 'full',
    negative_format: 'parentheses',
    zero_format: 'dash',
    table_density: 'standard',
    visual_theme: 'slate',
    show_account_codes: false,
    show_department_tags: true,
    show_variance_column: false,
    show_percent_of_revenue: true,
    double_underline_totals: true,
    show_signature_block: true,
    header_company_name: 'PT Atrium Management Group',
    header_subtitle: 'USALI 12th Revised Edition & Statutory Financial Reporting',
    footer_disclaimer: 'CONFIDENTIAL • Generated from strict double-entry posted journals. Zero variance verified.',
  },
  structures: {
    usali_sections: [
      {
        section_id: 'operating_revenue',
        section_title: 'Operating Revenue',
        is_visible: true,
        lines: [
          { id: 'USALI-REV-ROOMS', label: 'Rooms Revenue', category: 'Revenue', account_prefixes: ['40'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'USALI-REV-FB', label: 'Food & Beverage Revenue', category: 'Revenue', account_prefixes: ['41'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'USALI-REV-OTHER', label: 'Other Operated Departments', category: 'Revenue', account_prefixes: ['42'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
          { id: 'USALI-REV-MISC', label: 'Miscellaneous Income', category: 'Revenue', account_prefixes: ['49'], indent_level: 1, is_visible: true, is_bold: false, order: 4 },
        ],
      },
      {
        section_id: 'departmental_expenses',
        section_title: 'Departmental Expenses',
        is_visible: true,
        lines: [
          { id: 'USALI-EXP-ROOMS', label: 'Rooms Expenses', category: 'Expense', account_prefixes: ['60', '70'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'USALI-EXP-FB', label: 'Food & Beverage Expenses', category: 'Expense', account_prefixes: ['50', '61'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'USALI-EXP-OTHER', label: 'Other Operated Departments Expenses', category: 'Expense', account_prefixes: ['62'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
        ],
      },
      {
        section_id: 'undistributed_expenses',
        section_title: 'Undistributed Operating Expenses',
        is_visible: true,
        lines: [
          { id: 'USALI-UND-AG', label: 'Administrative & General (A&G)', category: 'Expense', account_prefixes: ['80'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'USALI-UND-POM', label: 'Property Operation & Maintenance (POM)', category: 'Expense', account_prefixes: ['85'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'USALI-UND-SM', label: 'Sales & Marketing', category: 'Expense', account_prefixes: ['90'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
          { id: 'USALI-UND-ENERGY', label: 'Energy, Water & Waste (Utilities)', category: 'Expense', account_prefixes: ['75'], indent_level: 1, is_visible: true, is_bold: false, order: 4 },
        ],
      },
      {
        section_id: 'management_fees',
        section_title: 'Management Fees',
        is_visible: true,
        lines: [
          { id: 'USALI-MGMT-FEES', label: 'Base & Incentive Management Fees', category: 'Expense', account_prefixes: ['88'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
        ],
      },
      {
        section_id: 'non_operating_expenses',
        section_title: 'Non-Operating Income & Expenses',
        is_visible: true,
        lines: [
          { id: 'USALI-NON-OP', label: 'Non-Operating Income & Expenses', category: 'Expense', account_prefixes: ['95'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
        ],
      },
    ],
    balance_sheet_sections: [
      {
        section_id: 'assets_current',
        section_title: 'Current Assets',
        is_visible: true,
        lines: [
          { id: 'BS-AST-CASH', label: 'Cash & Cash Equivalents', category: 'Asset', account_prefixes: ['1010'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'BS-AST-RECEIVABLES', label: 'Accounts Receivable & Guest Ledger', category: 'Asset', account_prefixes: ['1020', '1030'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'BS-AST-INVENTORY', label: 'Inventories & Operating Supplies', category: 'Asset', account_prefixes: ['1040'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
          { id: 'BS-AST-PREPAID', label: 'Prepaid Expenses & Security Deposits', category: 'Asset', account_prefixes: ['1050'], indent_level: 1, is_visible: true, is_bold: false, order: 4 },
        ],
      },
      {
        section_id: 'assets_noncurrent',
        section_title: 'Non-Current Assets & PPE',
        is_visible: true,
        lines: [
          { id: 'BS-AST-PPE', label: 'Property, Plant & Equipment', category: 'Asset', account_prefixes: ['1510'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'BS-AST-DEPR', label: 'Less: Accumulated Depreciation', category: 'Asset', account_prefixes: ['1520'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
        ],
      },
      {
        section_id: 'liabilities_current',
        section_title: 'Current Liabilities',
        is_visible: true,
        lines: [
          { id: 'BS-LIA-AP', label: 'Accounts Payable (Trade Payables)', category: 'Liability', account_prefixes: ['2010'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'BS-LIA-ACCRUED', label: 'Accrued Payroll & Operational Expenses', category: 'Liability', account_prefixes: ['2020', '2030'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'BS-LIA-TAX', label: 'Hotel & Sales Taxes Payable', category: 'Liability', account_prefixes: ['2040'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
        ],
      },
      {
        section_id: 'liabilities_longterm',
        section_title: 'Long-Term Liabilities',
        is_visible: true,
        lines: [
          { id: 'BS-LIA-DEBT', label: 'Long-Term Debt & Bank Borrowings', category: 'Liability', account_prefixes: ['2510'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
        ],
      },
      {
        section_id: 'equity_sections',
        section_title: "Owner's Equity & Retained Capital",
        is_visible: true,
        lines: [
          { id: 'BS-EQU-CAPITAL', label: 'Contributed Capital / Shareholder Capital', category: 'Equity', account_prefixes: ['3010'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'BS-EQU-RETAINED', label: 'Retained Earnings (Prior Periods)', category: 'Equity', account_prefixes: ['3020'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
        ],
      },
    ],
    income_statement_sections: [
      {
        section_id: 'is_revenue',
        section_title: 'Operating Revenue',
        is_visible: true,
        lines: [
          { id: 'IS-REV-ROOMS', label: 'Rooms Revenue', category: 'Revenue', account_prefixes: ['40'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'IS-REV-FB', label: 'Food & Beverage Revenue', category: 'Revenue', account_prefixes: ['41'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'IS-REV-OTHER', label: 'Other Operating Revenue', category: 'Revenue', account_prefixes: ['42', '49'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
        ],
      },
      {
        section_id: 'is_cost_of_sales',
        section_title: 'Cost of Sales (COGS)',
        is_visible: true,
        lines: [
          { id: 'IS-COS-FB', label: 'Food & Beverage Cost of Sales', category: 'Expense', account_prefixes: ['50'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'IS-COS-OTHER', label: 'Other Department Direct Costs', category: 'Expense', account_prefixes: ['51'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
        ],
      },
      {
        section_id: 'is_operating_expenses',
        section_title: 'Operating Expenses',
        is_visible: true,
        lines: [
          { id: 'IS-EXP-ROOMS', label: 'Rooms Department Operating Expenses', category: 'Expense', account_prefixes: ['60', '70'], indent_level: 1, is_visible: true, is_bold: false, order: 1 },
          { id: 'IS-EXP-FB', label: 'Food & Beverage Operating Expenses', category: 'Expense', account_prefixes: ['61'], indent_level: 1, is_visible: true, is_bold: false, order: 2 },
          { id: 'IS-EXP-AG', label: 'Administrative & General Expenses', category: 'Expense', account_prefixes: ['80'], indent_level: 1, is_visible: true, is_bold: false, order: 3 },
          { id: 'IS-EXP-POM', label: 'Property Operation & Maintenance', category: 'Expense', account_prefixes: ['85'], indent_level: 1, is_visible: true, is_bold: false, order: 4 },
          { id: 'IS-EXP-SM', label: 'Sales & Marketing Expenses', category: 'Expense', account_prefixes: ['90'], indent_level: 1, is_visible: true, is_bold: false, order: 5 },
          { id: 'IS-EXP-UTILITIES', label: 'Utilities & Energy Costs', category: 'Expense', account_prefixes: ['75'], indent_level: 1, is_visible: true, is_bold: false, order: 6 },
        ],
      },
    ],
  },
  updated_at: new Date().toISOString(),
};

export interface FinancialStatementsReport {
  period: string;
  property_name: string;
  currency: string;
  formatting?: ReportFormattingSettings;
  balance_sheet: {
    assets: ReportLineItem[];
    total_assets: number;
    liabilities: ReportLineItem[];
    total_liabilities: number;
    equity: ReportLineItem[];
    total_equity: number;
    total_liabilities_and_equity: number;
    is_balanced: boolean;
    variance: number;
  };
  income_statement: {
    operating_revenue: ReportLineItem[];
    total_operating_revenue: number;
    cost_of_sales: ReportLineItem[];
    total_cost_of_sales: number;
    gross_profit: number;
    operating_expenses: ReportLineItem[];
    total_operating_expenses: number;
    net_operating_income: number;
  };
}

export interface UsaliStatementReport {
  period: string;
  property_name: string;
  currency: string;
  formatting?: ReportFormattingSettings;
  operating_revenue: ReportLineItem[];
  total_operating_revenue: number;
  departmental_expenses: ReportLineItem[];
  total_departmental_expenses: number;
  total_departmental_profit: number;
  undistributed_operating_expenses: ReportLineItem[];
  total_undistributed_expenses: number;
  gross_operating_profit: number; // GOP
  management_fees: ReportLineItem[];
  total_management_fees: number;
  income_before_non_operating: number;
  non_operating_expenses: ReportLineItem[];
  total_non_operating_expenses: number;
  ebitda: number;
  schedules_summary: {
    rooms_revenue: number;
    rooms_expense: number;
    rooms_profit: number;
    fb_revenue: number;
    fb_expense: number;
    fb_profit: number;
    ag_expense: number;
    pom_expense: number;
    sm_expense: number;
    energy_expense: number;
  };
  reconciliation: {
    posted_revenue_total: number;
    posted_expense_total: number;
    report_revenue_total: number;
    report_expense_total: number;
    variance: number;
    is_reconciled: boolean;
  };
}

export interface DrilldownJournalLine {
  journal_id: string;
  journal_date: string;
  period: string;
  source_type: string;
  source_reference: string;
  created_by: string;
  approved_by: string;
  posted_at: string;
  account_code: string;
  department_code: string;
  debit: number;
  credit: number;
  net_amount: number;
  description: string;
  source_transaction?: {
    type: string;
    id: string;
    date: string;
    description: string;
    vendor_or_guest: string;
    department: string;
    amount: number;
  } | null;
  voucher?: {
    attached: boolean;
    document_type?: string;
    reference_number?: string;
    notes?: string;
  };
}

export interface DrilldownAccountSummary {
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
  lines_count: number;
}

export interface DrilldownDetail {
  report_type: string;
  line_id: string;
  line_label: string;
  period: string;
  line_total: number;
  accounts: DrilldownAccountSummary[];
  journal_lines: DrilldownJournalLine[];
}

export interface ControlException {
  id: string;
  category: 'UNMAPPED_ACCOUNT' | 'UNASSIGNED_DEPARTMENT' | 'DRAFT_PENDING' | 'MISSING_SOURCE' | 'MISSING_VOUCHER' | 'RECONCILIATION_VARIANCE' | 'TAX_RECONCILIATION';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  account_code?: string;
  journal_id?: string;
  posted_amount?: number;
  action_label: string;
  action_target: string;
}

export type PrimaryNavPillar =
  | 'command-centre'
  | 'operations'
  | 'accounting-core'
  | 'reports'
  | 'tax'
  | 'configuration'
  | 'controls-audit'
  | 'integrations'
  | 'administration';

// --- USER ACCESS & ROLE-BASED ACCESS CONTROL (RBAC) ---

export type AccessAction = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'export';

export interface ModulePermission {
  module: PrimaryNavPillar;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface UserRoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystemRole?: boolean;
  permissions: Record<PrimaryNavPillar, {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canApprove: boolean;
    canDelete: boolean;
    canExport: boolean;
  }>;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  roleId: string;
  password?: string;
  mustChangePassword?: boolean;
  departmentCode?: string;
  status: 'active' | 'suspended' | 'invited';
  lastLogin?: string;
  customPermissionsOverride?: Partial<Record<PrimaryNavPillar, {
    canView?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canApprove?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
  }>>;
}

export interface AccessControlState {
  users: SystemUser[];
  roles: UserRoleDefinition[];
  currentUserId: string;
}

// ==========================================
// HOTEL INVENTORY MANAGEMENT MODULE TYPES
// ==========================================

export interface InventoryCategory {
  category_id: string;
  name: string;
  subcategories: string[];
  default_inventory_account: string; // e.g. '1080' Operating Supplies & Inventories
  default_expense_account: string; // e.g. '5010' Food Cost, '7010' Guest Supplies
  is_fixed_asset: boolean; // Must be false - fixed assets are excluded
  active: ActiveStatus;
}

export interface InventoryStoreroom {
  storeroom_id: string;
  name: string;
  storeroom_name?: string;
  department_code: string;
  manager_name: string;
  in_charge?: string;
  bins: string[];
  default_bin_prefix?: string;
  active: ActiveStatus;
  is_active?: boolean;
  description?: string;
}

export interface ItemStoreroomStock {
  item_id: string;
  storeroom_id: string;
  bin_location: string;
  quantity: number;
  last_counted_at?: string;
}

export interface InventoryItem {
  item_id: string;
  item_code: string; // Unique
  item_name: string;
  category_id: string;
  subcategory: string;
  uom: string; // KG, L, BTL, PCS, BOX, PACK, ROLL, SET
  barcode: string; // Unique where assigned (Manufacturer or Internal ATRIUM)
  supplier: string;
  default_storeroom_id: string;
  default_bin_location: string;
  min_stock: number;
  reorder_point: number;
  max_stock: number;
  current_stock: number; // Aggregated total hotel stock
  last_purchase_cost: number;
  average_cost: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  created_by: string;
  storeroom_stocks?: ItemStoreroomStock[];
}

export type StockMovementType =
  | 'RECEIPT'
  | 'DEPARTMENT_ISSUE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'SUPPLIER_RETURN'
  | 'DEPARTMENT_RETURN';

export type MovementReferenceType =
  | 'PURCHASE_RECEIPT'
  | 'GOODS_RECEIPT'
  | 'DEPARTMENT_REQUISITION'
  | 'DIRECT_ISSUE'
  | 'STOCK_TRANSFER'
  | 'PHYSICAL_COUNT_ADJUSTMENT'
  | 'MANUAL_ADJUSTMENT'
  | 'INITIAL_BALANCE';

export interface StockMovement {
  movement_id: string;
  timestamp: string; // ISO String
  date: string; // YYYY-MM-DD
  movement_type: StockMovementType;
  reference_type: MovementReferenceType;
  reference_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  storeroom_id: string;
  storeroom_name: string;
  to_storeroom_id?: string;
  to_storeroom_name?: string;
  bin_location?: string;
  quantity: number; // Always positive magnitude
  before_quantity: number;
  after_quantity: number;
  unit_cost: number;
  total_cost: number;
  department_code?: string;
  department_name?: string;
  user_id: string;
  user_name: string;
  notes?: string;
  journal_id?: string; // Linked accounting double-entry voucher
}

export interface RequisitionItem {
  item_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  requested_quantity: number;
  approved_quantity: number;
  issued_quantity: number;
  unit_cost: number;
  total_cost: number;
}

export type RequisitionStatus = 'PENDING' | 'APPROVED' | 'PARTIALLY_ORDERED' | 'ORDERED' | 'ISSUED' | 'REJECTED';

export interface DepartmentRequisition {
  requisition_id: string;
  date: string;
  department_code: string;
  department_name: string;
  requester_name: string;
  storeroom_id: string;
  storeroom_name: string;
  status: RequisitionStatus;
  items: RequisitionItem[];
  notes?: string;
  approver_name?: string;
  approved_at?: string;
  issuer_name?: string;
  issued_at?: string;
  linked_po_ids?: string[];
  journal_id?: string;
  created_at: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'FULFILLED' | 'CANCELLED';

export interface PurchaseOrderItem {
  item_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
  subtotal: number;
  requisition_id?: string; // Linked requisition source
  notes?: string;
}

export interface PurchaseOrder {
  po_id: string; // e.g. PO-2026-0001
  po_number: string;
  order_date: string;
  expected_delivery_date?: string;
  supplier_id?: string;
  supplier_name: string;
  supplier_contact?: string;
  supplier_email?: string;
  supplier_address?: string;
  storeroom_id: string;
  storeroom_name: string;
  department_code: string;
  department_name: string;
  requisition_ids: string[]; // 1 Requisition can be split across multiple POs / suppliers
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax_rate_pct: number; // e.g. 11% PPN
  tax_amount: number;
  total_amount: number;
  payment_terms: string; // e.g. "Net 30 Days", "COD", "50% Advance"
  notes?: string;
  // Document customization & letterhead
  hotel_name?: string;
  hotel_division?: string;
  hotel_address?: string;
  hotel_tax_id?: string;
  hotel_phone?: string;
  hotel_email?: string;
  receiving_dock_instructions?: string;
  terms_conditions?: string;
  prepared_by_title?: string;
  authorized_by_title?: string;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  journal_id?: string; // Encumbrance / Commitment or Procurement Accrual Journal ID
  created_at: string;
  updated_at: string;
}

export interface GoodsReceiptItem {
  item_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  received_quantity: number;
  unit_cost: number;
  total_cost: number;
  bin_location?: string;
  batch_or_lot?: string;
  expiry_date?: string;
}

export interface GoodsReceipt {
  receipt_id: string;
  date: string;
  po_reference: string;
  vendor_name: string;
  storeroom_id: string;
  storeroom_name: string;
  items: GoodsReceiptItem[];
  total_amount: number;
  received_by: string;
  notes?: string;
  journal_id?: string;
  created_at: string;
}

export interface StockCountItem {
  item_id: string;
  item_code: string;
  item_name: string;
  barcode: string;
  uom: string;
  bin_location: string;
  system_quantity: number;
  physical_quantity: number;
  variance_quantity: number; // physical_quantity - system_quantity
  unit_cost: number;
  variance_value: number; // variance_quantity * unit_cost
  notes?: string;
}

export type StockCountStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface StockCountSession {
  count_id: string;
  title: string;
  date: string;
  storeroom_id: string;
  storeroom_name: string;
  counted_by: string;
  status: StockCountStatus;
  items: StockCountItem[];
  total_system_value: number;
  total_physical_value: number;
  total_variance_value: number;
  approved_by?: string;
  approved_at?: string;
  adjustment_journal_id?: string;
  created_at: string;
}

export type AdjustmentReasonCode =
  | 'DAMAGE'
  | 'EXPIRY'
  | 'BREAKAGE'
  | 'SHRINKAGE'
  | 'COUNT_VARIANCE'
  | 'INITIAL_SEED'
  | 'OTHER';

export interface StockAdjustmentRecord {
  adjustment_id: string;
  date: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  storeroom_id: string;
  storeroom_name: string;
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reason_code: AdjustmentReasonCode;
  reason_notes: string;
  approved_by: string;
  journal_id?: string;
  timestamp: string;
}

export interface InventoryDashboardKPIs {
  total_valuation: number;
  total_inventory_value_idr?: number;
  total_inventory_value_usd?: number;
  total_skus: number;
  total_items_count?: number;
  low_stock_count: number;
  low_stock_items_count?: number;
  out_of_stock_count: number;
  pending_requisitions_count: number;
  open_stock_counts_count?: number;
  monthly_receipts_value: number;
  monthly_issues_value: number;
  recent_movements: StockMovement[];
  top_consumed_items: {
    item_code: string;
    item_name: string;
    quantity: number;
    uom: string;
    total_cost: number;
  }[];
  category_breakdown?: {
    category_id: string;
    category_name: string;
    total_value_idr: number;
    items_count: number;
  }[];
  storeroom_breakdown?: {
    storeroom_id: string;
    storeroom_name: string;
    total_value_idr: number;
    items_count: number;
  }[];
}

// ==========================================
// 7. STAFF SERVICE CHARGE & GRATUITIES POOL
// ==========================================

export type StaffGradeLevel = 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' | 'Grade 5';
export type EmploymentStatus = 'Permanent' | 'Contract' | 'Probation' | 'Casual';
export type ServiceChargeSource = 'PMS_ROOMS' | 'POS_FB' | 'POS_SPA' | 'BANQUETS_MICE' | 'MANUAL_GRATUITY';
export type DistributionCycleStatus = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'POSTED_TO_PAYROLL';

export interface StaffEmployee {
  employee_id: string;
  employee_name: string;
  department_code: string; // e.g. 100 Rooms, 200 F&B, 300 Spa, 800 Engineering
  job_title: string;
  grade_level: StaffGradeLevel;
  base_points: number; // e.g. 1.0, 1.2, 1.5, 1.8, 2.2
  hire_date: string; // YYYY-MM-DD
  employment_status: EmploymentStatus;
  bank_account_number: string;
  bank_name: string;
  is_eligible: boolean; // ExCom/GM excluded by law, operational staff included
  active: 'Y' | 'N';
  notes?: string;
}

export interface ServiceChargeCollection {
  collection_id: string;
  date: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  source: ServiceChargeSource;
  department_code: string;
  gross_sales_amount: number;
  service_charge_rate_pct: number; // default 10.0%
  service_charge_amount: number; // 10% of gross
  reference_no: string; // Folio / Check / Banquet contract no.
  status: 'ACCRUED' | 'DISTRIBUTED';
  journal_id?: string;
  notes?: string;
}

export interface ServiceChargeStaffAllocationLine {
  employee_id: string;
  employee_name: string;
  department_code: string;
  job_title: string;
  grade_level: StaffGradeLevel;
  base_points: number;
  years_of_service: number;
  seniority_bonus_pct: number; // +5% per full year, capped at 25%
  standard_calendar_days: number; // e.g. 31 days in Aug
  days_worked: number; // e.g. 31 days
  attendance_ratio: number; // days_worked / standard_calendar_days
  effective_points: number; // base_points * (1 + seniority_bonus_pct/100) * attendance_ratio
  point_value_rate: number; // Rp per point
  gross_payout: number; // effective_points * point_value_rate
  tax_withholding_pct: number; // e.g. 5% PPh 21
  tax_withheld_amount: number;
  net_payout: number;
  payout_status: 'PENDING' | 'DISBURSED';
}

export interface ServiceChargeDistributionCycle {
  cycle_id: string; // e.g. SC-2026-08
  period: string; // YYYY-MM
  title: string;
  status: DistributionCycleStatus;
  total_collected_amount: number;
  company_retention_pct: number; // 0% or up to 5% legal breakage reserve
  company_retention_amount: number;
  prior_reserve_carryover: number;
  distributable_pool_amount: number;
  total_staff_count: number;
  total_weighted_points: number;
  point_value_rate: number; // Distributable Pool / Total Points
  total_gross_payout: number;
  total_tax_withheld: number;
  total_net_payout: number;
  reserve_balance_retained: number; // Remaining rounding or reserve
  journal_id?: string;
  created_by: string;
  approved_by?: string;
  posted_at?: string;
  reconciliation_notes?: string;
  lines: ServiceChargeStaffAllocationLine[];
}

export interface ServiceChargeKPIs {
  trust_liability_balance: number; // In Account 2030 (Trust Liability)
  current_period_collections: number;
  active_eligible_staff: number;
  estimated_point_value: number;
  last_distributed_amount: number;
  last_distributed_point_value: number;
  total_all_time_distributed: number;
  department_breakdown: {
    department_code: string;
    department_name: string;
    staff_count: number;
    allocated_amount: number;
  }[];
}

// ==========================================
// APARTMENT OWNER POOL & RETURN DISTRIBUTION
// ==========================================

export type OwnershipStatus = 'Active' | 'Inactive' | 'Pending';
export type OwnerDistributionEligibility = 'Eligible' | 'Suspended' | 'Ineligible';

export type OwnerTaxTreatment = 
  | 'WHT_FINAL_10_PCT'          // PPh Final Pasal 4(2) Sewa Tanah/Bangunan 10%
  | 'WHT_PPh23_2_PCT'           // PPh 23 Badan (2%)
  | 'WHT_PPh23_NON_NPWP_4_PCT'  // PPh 23 Non-NPWP (4%)
  | 'TAX_EXEMPT'                // Tax Exempt (0%)
  | 'NOT_CONFIGURED';           // Requires Configuration

export type OwnerReturnOptionType = 'GUARANTEED_10_PCT' | 'POOLED_OPTION';

export type OwnerContractPaymentType =
  | 'FULLY_PAID'
  | 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT'
  | 'PARTIALLY_PAID_NO_RETURN';

export interface OwnerStayRecord {
  stay_id: string;
  unit_id: string;
  unit_number: string;
  owner_id: string;
  owner_name: string;
  check_in_date: string;
  check_out_date: string;
  nights_count: number;
  period: string; // e.g. "2026-09"
  market_rate_per_night: number; // BAR (Best Available Rate)
  owner_rate_pct: number; // 10% if within 28 days quota, 75% if 29+ days
  total_room_charge_billed: number; // nights * market_rate * (owner_rate_pct / 100)
  return_deduction_applied: number; // (Monthly Return / 30) * nights if within 28 days; 0 if 29+ days
  quota_day_from: number; // e.g. 1
  quota_day_to: number; // e.g. 4
  status: 'RESERVED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  created_at: string;
}

export interface OwnerUnit {
  unit_id: string;              // e.g. "UNIT-0301"
  unit_number: string;          // e.g. "301"
  floor_number: number;         // e.g. 3
  unit_type: 'Studio' | '1-Bedroom' | '2-Bedroom' | 'Penthouse Suite';
  owner_id: string;             // e.g. "OWN-001"
  owner_name: string;           // e.g. "Ir. Hendra Gunawan"
  owner_email?: string;
  owner_phone?: string;
  unit_sqm: number;             // Required: e.g. 45.50 SQM
  purchase_price: number;       // Required: Purchase price in IDR
  vat_amount: number;           // Required: VAT amount in IDR (Purchase Price - VAT = Return Basis)

  // Contract & Payment Classification
  return_option_type: OwnerReturnOptionType; // 'GUARANTEED_10_PCT' | 'POOLED_OPTION'
  contract_payment_type: OwnerContractPaymentType; // 'FULLY_PAID' | 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT' | 'PARTIALLY_PAID_NO_RETURN'
  
  // 3 Requested Installment Tracking Columns
  total_purchase_price: number;       // Total harga jual unit
  total_paid_to_date: number;         // Total pembayaran pokok yang sudah disetor ke Keen Eye
  monthly_installment_due: number;    // Tagihan cicilan bulanan yang wajib dibayar ke Keen Eye
  remaining_payable_to_keen_eye: number; // Sisa pokok hutang ke Keen Eye (total_purchase_price - total_paid_to_date)

  // Owner Stay Privilege (28 days quota per calendar year)
  stay_days_quota_annual: number;     // Default 28 days
  stay_days_used_ytd: number;         // Tracked stay days used this year
  
  contract_start_date: string;  // Required: YYYY-MM-DD
  contract_end_date: string;    // Required: YYYY-MM-DD
  ownership_status: OwnershipStatus;
  distribution_status: OwnerDistributionEligibility;
  tax_treatment: OwnerTaxTreatment;
  tax_rate_pct?: number;        // e.g. 10.0 or 2.0 (undefined if NOT_CONFIGURED)
  bank_name: string;            // e.g. "BCA"
  bank_account_number: string;  // e.g. "883-0192831"
  bank_account_name: string;    // e.g. "Hendra Gunawan"
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type GuaranteedReturnBasisType = 'PURCHASE_PRICE_LESS_VAT' | 'PURCHASE_PRICE' | 'CUSTOM';
export type DistributionBasisType = 'UNIT_SQM';

export interface OwnerDistributionRuleConfig {
  config_id: string;
  effective_date: string;       // YYYY-MM-DD
  owner_pool_pct: number;       // Default: 65.0 (%)
  amg_allocation_pct: number;   // Default: 35.0 (%)
  guaranteed_return_rate_pct: number; // Default: 10.0 (%)
  guaranteed_period_years: number;    // Default: 3 (years)
  guaranteed_return_basis: GuaranteedReturnBasisType; // Default: 'PURCHASE_PRICE_LESS_VAT'
  distribution_basis: DistributionBasisType;          // Default: 'UNIT_SQM'
  guarantee_difference_rule: 'FLAG_FOR_REVIEW' | 'AUTO_TOP_UP' | 'NO_ADJUSTMENT'; // Default: 'FLAG_FOR_REVIEW'
  
  // Configurable Facility Discount & Stay Rules
  facility_discount_pct: number; // Default: 10.0 (%) on all facilities (Spa, Uma Blu, etc.)
  payout_day_of_month: number;   // Default: 15 (Setiap tanggal 15)
  stay_annual_quota_days: number; // Default: 28 days
  stay_rate_pct_within_quota: number; // Default: 10% of market rate
  stay_rate_pct_excess: number;       // Default: 75% of market rate for day 29+
  developer_entity_name: string;      // Default: "PT Keen Eye"
  developer_md_name: string;          // Default: "Scott"
  operator_entity_name: string;       // Default: "PT Atrium Management Group"

  updated_at: string;
  updated_by: string;
  revision_notes?: string;
}

export interface OwnerPoolAllocationLine {
  line_id: string;
  unit_id: string;
  unit_number: string;
  owner_id: string;
  owner_name: string;
  owner_email?: string;
  unit_sqm: number;
  allocation_pct: number;       // Unit SQM / Total Eligible SQM

  // Options & Contract Types
  return_option_type: OwnerReturnOptionType;
  contract_payment_type: OwnerContractPaymentType;
  
  // 3 Installment Columns
  total_purchase_price: number;
  total_paid_to_date: number;
  monthly_installment_due: number;
  remaining_payable_to_keen_eye: number;

  // Pool-Based SQM Allocation
  pool_allocation_amount: number; // Owner Pool * allocation_pct

  // Guaranteed Return Calculation
  purchase_price: number;
  vat_amount: number;
  return_basis_amount: number;  // purchase_price - vat_amount
  annual_guaranteed_return: number; // return_basis_amount * 10%
  monthly_guaranteed_return: number; // annual / 12
  contract_start_date: string;
  contract_end_date: string;
  is_within_guarantee_period: boolean;
  contract_year_number: number; // 1, 2, 3, or >3

  // Comparison & Applicable Return
  applicable_return_basis_type: 'GUARANTEED_RETURN' | 'POOL_ALLOCATION' | 'ZERO_RETURN';
  gross_return_amount: number;
  rule_applied_description: string;
  guarantee_pool_difference: number; // monthly_guaranteed_return - pool_allocation_amount
  difference_flag: 'NONE' | 'SHORTFALL' | 'SURPLUS';
  difference_note: string;

  // Shortfall & Excess Mechanisms
  shortfall_from_keen_eye: number;        // Subsidized by PT Keen Eye when pool < 10%
  excess_to_atrium_management: number;    // Absorbed by PT Atrium Management when pool > 10%

  // Stay Deductions (28 days @ 10% vs 29+ days @ 75%)
  stay_days_count: number;
  daily_return_rate: number;              // Monthly Return / 30
  stay_deduction_amount: number;          // Daily Rate * days (only deducted for days <= 28)
  stay_charge_billed: number;             // Market room fee charged to owner

  // Tax Withholding Breakdown
  tax_treatment: OwnerTaxTreatment;
  tax_type_label: string;
  tax_rate_pct: number;
  tax_base_amount: number;
  tax_withheld_amount: number;
  tax_status: 'CONFIGURED' | 'REQUIRES_CONFIGURATION';

  // Net Return before Offset
  net_return_amount: number;              // gross_return_amount - stay_deduction_amount - tax_withheld_amount

  // Installment Offset to PT Keen Eye (for Partially Paid with Guaranteed 10%)
  installment_offset_to_keen_eye: number; // Deducted from return to pay Keen Eye installment
  remaining_installment_unpaid: number;   // If installment due > net return

  // Net Cash Payout transferred on the 15th
  net_distribution_amount: number;        // Actual cash payout to owner bank account
  payout_date: string;                    // e.g. "2026-10-15"

  // Bank & Audit Snapshot
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  status: 'CALCULATED' | 'APPROVED' | 'POSTED';
}

export interface OwnerPoolReconciliation {
  is_reconciled: boolean;
  check1_pool_plus_amg_equals_revenue: boolean;
  check1_diff: number;
  check2_allocations_sum_equals_pool: boolean;
  check2_diff: number;
  check3_sqm_sum_equals_total_sqm: boolean;
  check3_diff: number;
  check4_gross_minus_tax_equals_net: boolean;
  check4_diff: number;
  check5_all_recipients_valid: boolean;
  check6_no_duplicate_units: boolean;
  check7_no_inactive_contracts: boolean;
  check8_source_revenue_posted: boolean;
  discrepancy_messages: string[];
}

export type OwnerDistributionBatchStatus = 'DRAFT' | 'CALCULATED' | 'REVIEW' | 'APPROVED' | 'POSTED' | 'REVERSED';

export interface OwnerDistributionBatch {
  batch_id: string;             // e.g. "ODB-2026-09"
  period: string;               // e.g. "2026-09"
  batch_title: string;
  status: OwnerDistributionBatchStatus;

  // Source Revenue
  room_revenue_amount: number;
  room_revenue_source_accounts: string[];
  room_revenue_source_transactions_count: number;
  is_source_revenue_posted: boolean;

  // Rule Config Applied (Snapshot at calculation time)
  applied_rule_config: OwnerDistributionRuleConfig;

  // 65/35 Pool Split
  owner_pool_pct: number;       // 65.0%
  owner_pool_amount: number;
  amg_allocation_pct: number;   // 35.0%
  amg_allocation_amount: number;

  // Master Dynamic Stats
  total_eligible_sqm: number;
  eligible_units_count: number;
  active_owners_count: number;

  // Aggregated Totals
  total_pool_allocations: number;
  total_guaranteed_returns: number;
  total_gross_return: number;
  total_tax_withholding: number;
  total_net_distribution: number;

  // Shortfall / Surplus Analysis
  total_guarantee_shortfall: number;
  units_with_shortfall_count: number;
  units_with_surplus_count: number;

  // Reconciliation
  reconciliation: OwnerPoolReconciliation;

  // Accounting Ledger Linkage
  journal_id?: string;
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  posted_by?: string;
  posted_at?: string;
  reversal_of_batch_id?: string;
  notes?: string;

  lines: OwnerPoolAllocationLine[];
}

export interface OwnerPoolDashboardKPIs {
  period: string;
  room_revenue: number;
  owner_pool_amount: number;
  amg_allocation_amount: number;
  eligible_units_count: number;
  total_eligible_sqm: number;
  gross_owner_return: number;
  tax_withholding: number;
  net_distribution: number;
  unreconciled_amount: number;
  reconciliation_status: 'RECONCILED' | 'REQUIRES_REVIEW';
  has_posted_data: boolean;
  active_batches_count: number;
  posted_batches_count: number;
  current_batch_id?: string;
  current_batch_status?: OwnerDistributionBatchStatus;
}

export type OwnerEmailAttachmentType =
  | 'STATEMENT_PDF'
  | 'CALCULATION_AUDIT'
  | 'HOTEL_PERFORMANCE_CERT'
  | 'PAYMENT_ADVICE'
  | 'TAX_WITHHOLDING_SLIP'
  | 'CSV_DATA_BREAKDOWN';

export interface OwnerEmailAttachmentConfig {
  include_statement_pdf: boolean;
  statement_format: 'PDF_FORMATTED' | 'HTML_SUMMARY';
  include_calculation_audit: boolean;
  include_hotel_performance_cert: boolean;
  include_payment_advice: boolean;
  include_tax_slip: boolean;
  include_csv_breakdown: boolean;
}

export interface OwnerEmailSmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface OwnerDistributionEmailConfig {
  config_id: string;
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
  subject_template: string;
  body_template: string;
  cc_emails: string[];
  bcc_emails: string[];
  attachments: OwnerEmailAttachmentConfig;
  auto_archive_sent: boolean;
  smtp?: OwnerEmailSmtpConfig;
  updated_at: string;
  updated_by: string;
}

export interface OwnerDistributionEmailDraftAttachment {
  id: string;
  type: OwnerEmailAttachmentType;
  name: string;
  description: string;
  format: string;
  size_kb: number;
  enabled: boolean;
  preview_available: boolean;
}

export interface OwnerDistributionEmailDraft {
  draft_id: string;
  batch_id: string;
  period: string;
  unit_id: string;
  unit_number: string;
  owner_id: string;
  owner_name: string;
  recipient_email: string;
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body_text: string;
  body_html: string;
  custom_note?: string;
  attachments: OwnerDistributionEmailDraftAttachment[];
  financial_summary: {
    unit_sqm: number;
    allocation_pct: number;
    pool_allocation_amount: number;
    guaranteed_return_amount: number;
    applicable_return_basis_type: string;
    gross_return_amount: number;
    tax_type_label: string;
    tax_rate_pct: number;
    tax_withheld_amount: number;
    net_distribution_amount: number;
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
  };
  status: 'DRAFT' | 'READY' | 'SENT' | 'FAILED';
  last_edited_at?: string;
  sent_at?: string;
  delivery_message_id?: string;
  error_message?: string;
}

export interface OwnerEmailDispatchLog {
  dispatch_id: string;
  batch_id: string;
  period: string;
  unit_id: string;
  unit_number: string;
  owner_name: string;
  recipient_email: string;
  subject: string;
  attachments_count: number;
  attachment_names: string[];
  net_amount: number;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  dispatched_at: string;
  sent_by: string;
  delivery_message_id?: string;
  notes?: string;
}

export interface OwnerEmailBatchResult {
  batch_id: string;
  period: string;
  total_recipients: number;
  successful_count: number;
  failed_count: number;
  dispatched_at: string;
  dispatches: OwnerEmailDispatchLog[];
}

// ==========================================
// --- TAX MODULE TYPES (Indonesian Hospitality Tax Framework) ---
// ==========================================

export type TaxTypeCode =
  | 'PBJT_HOTEL'
  | 'PPH_21'
  | 'PPH_23'
  | 'PPH_26'
  | 'PPH_FINAL_4_2'
  | 'PPH_25'
  | 'PPH_BADAN'
  | 'PPN'
  | 'OWNER_TAX';

export type TaxObligationStatus =
  | 'DRAFT'
  | 'READY'
  | 'PAID'
  | 'FILED'
  | 'RECONCILED'
  | 'CLOSED';

export type TaxFilingStatus =
  | 'Draft'
  | 'Ready'
  | 'Paid'
  | 'Filed'
  | 'Reconciled'
  | 'Closed';

export interface TaxRuleConfig {
  tax_code: TaxTypeCode;
  tax_name: string;
  tax_category: 'LOCAL_TAX' | 'NATIONAL_WHT' | 'CORPORATE_TAX' | 'VAT' | 'OWNER_TAX';
  tax_rate_pct: number; // Configurable; historical snapshots stored per calculation
  is_rate_configured: boolean; // Flag to disallow guessing if not configured
  tax_base_description: string;
  gl_liability_account: string; // e.g. 2040, 2070, 2080
  source_data_type: 'REVENUE' | 'PAYROLL' | 'SPENDING_AP' | 'CORPORATE_P_L' | 'OWNER_POOL' | 'MANUAL';
  filing_due_day: number; // Day of following month (e.g. 10th for PBJT, 20th for PPh, end of month for PPN)
  payment_due_day: number;
  active: 'Y' | 'N';
  notes?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface TaxDocumentAttachment {
  id: string;
  obligation_id: string;
  doc_type: 'Invoice' | 'Bukti Potong' | 'NTPN' | 'BPE' | 'Tax Return' | 'Payment Receipt' | 'Other';
  file_name: string;
  file_url: string;
  notes?: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface TaxObligationItem {
  id: string; // e.g. TAX-2026-09-PBJT_HOTEL
  period: string; // YYYY-MM
  tax_code: TaxTypeCode;
  tax_name: string;
  tax_base: number;
  tax_rate_pct: number;
  is_rate_configured: boolean;
  tax_amount: number;
  paid_amount: number;
  filing_due_date: string;
  payment_due_date: string;
  status: TaxFilingStatus;

  // Source & Audit Trail
  source_data_available: boolean;
  source_data_type: string;
  source_transactions_count: number;
  source_reference: string;
  gl_account_code: string;
  gl_account_name: string;
  rule_applied_description: string;

  // Payment Details
  payment_date?: string;
  ntpn_reference?: string;
  payment_bank_account?: string;

  // Filing Details
  filing_date?: string;
  bpe_reference?: string;

  // Evidence & Audit
  documents: TaxDocumentAttachment[];
  calculation_timestamp?: string;
  calculated_by?: string;
  reconciled_at?: string;
  reconciled_by?: string;
  closed_at?: string;
  closed_by?: string;
}

export interface TaxPeriodSummaryKPIs {
  period: string;
  has_data: boolean;
  tax_payable: number;
  tax_paid: number;
  tax_outstanding: number;
  filing_due_count: number;
  overdue_count: number;
  is_period_closed: boolean;
  closed_at?: string;
  closed_by?: string;
}

export interface TaxReconciliationLine {
  tax_code: TaxTypeCode;
  tax_name: string;
  gl_account_code: string;
  gl_account_name: string;
  calculated_amount: number;
  gl_balance_amount: number;
  paid_amount: number;
  filed_amount: number;
  difference_amount: number;
  status: 'RECONCILED' | 'DIFFERENCE_FOUND';
  discrepancy_note?: string;
}

export interface TaxPeriodCloseValidation {
  can_close: boolean;
  checks: {
    all_taxes_calculated: boolean;
    all_payments_recorded: boolean;
    all_filings_recorded: boolean;
    required_evidence_attached: boolean;
    all_reconciled: boolean;
  };
  missing_items: string[];
}

// ==========================================
// ACCOUNTS RECEIVABLE (AR) & ACCOUNTS PAYABLE (AP) MODULE
// ==========================================

export interface ARAgingItem {
  id: string;
  source: 'REVENUE_TX' | 'NIGHT_AUDIT' | 'MANUAL';
  transaction_id: string;
  journal_id: string;
  date: string;
  due_date: string;
  customer_name: string;
  customer_type: 'GUEST_FOLIO' | 'CITY_LEDGER_CORPORATE' | 'OTA_COLLECT' | 'BANQUET_CLIENT';
  department_code: string;
  department_name: string;
  account_code: string;
  original_amount: number;
  paid_amount: number;
  outstanding_balance: number;
  days_overdue: number;
  aging_bucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';
  status: 'PENDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'DISPUTED';
  notes?: string;
  settlements: {
    settlement_id: string;
    date: string;
    amount: number;
    payment_method: string;
    reference: string;
    journal_id?: string;
  }[];
}

export interface APAgingItem {
  id: string;
  source: 'PURCHASE_ORDER' | 'SPENDING_TX' | 'DIRECT_INVOICE';
  reference_id: string;
  journal_id?: string;
  date: string;
  due_date: string;
  vendor_name: string;
  vendor_contact?: string;
  department_code: string;
  department_name: string;
  account_code: string;
  original_amount: number;
  paid_amount: number;
  outstanding_balance: number;
  days_overdue: number;
  aging_bucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'SCHEDULED';
  payment_terms: string;
  notes?: string;
  payments: {
    payment_id: string;
    date: string;
    amount: number;
    payment_method: string;
    bank_account_code: string;
    reference: string;
    journal_id?: string;
  }[];
}

export interface AgingSummary {
  total_outstanding: number;
  current: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_over_90: number;
  count: number;
}

// ==========================================
// PAK SCOTT'S EXECUTIVE OWNER MATRIX
// ==========================================

export type ScottMatrixGroupCategory =
  | '10_PCT_GUARANTEED_FULLY_PAID'
  | '10_PCT_GUARANTEED_PARTIALLY_PAID_KEEN_EYE'
  | 'POOLED_OWNERS_REVENUE_SHARE'
  | 'WHO_GETS_NOTHING_ZERO_RETURN';

export interface ScottMatrixUnitItem {
  unit_id: string;
  unit_number: string;
  floor_number: number;
  owner_name: string;
  unit_sqm: number;
  category: ScottMatrixGroupCategory;
  category_label: string;
  category_badge: string;
  
  // Financial specifics
  purchase_price: number;
  vat_amount: number;
  return_basis: number; // Purchase Price - VAT
  monthly_guaranteed_return: number;
  sqm_pool_share_amount: number;
  
  // Shortfall & Excess
  shortfall_covered_by_keen_eye: number; // If pool < 10%
  excess_to_atrium_management: number;   // If pool > 10%
  
  // Stay Deductions
  stay_days_month: number;
  stay_deduction_amount: number; // (Monthly return / 30) * stay days
  
  // Tax & Net
  tax_withheld: number;
  net_return_after_tax: number;
  
  // Installment to Keen Eye
  total_purchase_price: number;
  total_paid_to_date: number;
  monthly_installment_due: number;
  installment_offset_to_keen_eye: number; // Offset against return
  remaining_payable_to_keen_eye: number;
  
  // Final Cash Disbursed to Owner
  cash_payout_amount: number; // Disbursed every 15th
  payout_date: string;
  bank_name: string;
  bank_account_number: string;
  notes: string;
}

export interface ScottExecutiveMatrixSummary {
  period: string; // e.g. "2026-09"
  payout_date: string; // e.g. "2026-10-15" (every 15th)
  generated_at: string;
  developer_name: string; // "PT Keen Eye"
  developer_md: string;   // "Scott"
  operator_name: string;  // "PT Atrium Management Group"
  
  // High-Level Executive KPIs
  total_units: number;
  group1_fully_paid_count: number;
  group2_keen_eye_installment_count: number;
  group3_pool_owners_count: number;
  group4_zero_return_count: number;

  // Financial Aggregates
  total_room_revenue: number;
  total_owner_pool_65_pct: number;
  total_atrium_base_35_pct: number;
  total_atrium_excess_absorbed: number;
  total_atrium_gross_revenue: number; // 35% base + excess

  total_gross_return_accrued: number;
  total_shortfall_covered_by_keen_eye: number; // Kas masuk dari Keen Eye
  total_installments_collected_by_keen_eye: number; // Return dialihkan ke Keen Eye
  total_tax_withheld: number;
  total_cash_payout_to_owners: number; // Uang cash keluar ke rekening owner
  total_stay_deductions_applied: number;

  units: ScottMatrixUnitItem[];
}

// ==========================================
// KAS KECIL OPERASIONAL (OPERATIONAL PETTY CASH)
// ==========================================

export type PettyCashExpenseCategory =
  | 'KITCHEN_EMERGENCY'
  | 'HOUSEKEEPING_GUEST_SUPPLIES'
  | 'ENGINEERING_MAINTENANCE'
  | 'FRONT_DESK_GUEST_RELATIONS'
  | 'OFFICE_STATIONERY_ADMIN'
  | 'TRANSPORT_COURIER'
  | 'OTHER_OPERATIONAL';

export interface PettyCashTransaction {
  id: string;
  voucher_number: string; // e.g. "PCV-2026-001"
  date: string; // YYYY-MM-DD
  category: PettyCashExpenseCategory;
  category_label: string;
  department_code: string; // e.g. "100" (Rooms), "200" (F&B)
  department_name: string;
  account_code: string; // USALI Expense account
  account_name: string;
  amount: number;
  paid_to: string; // Penerima uang / Toko / Vendor
  description: string;
  receipt_image_url?: string; // Data URL or URL for physical receipt / nota
  receipt_filename?: string;
  status: 'PENDING_REIMBURSEMENT' | 'REIMBURSED' | 'VOIDED';
  reimbursement_id?: string;
  created_by: string;
  created_at: string;
}

export interface PettyCashFloatConfig {
  account_name: string; // "Kas Kecil Operasional Atrium"
  gl_account_code: string; // "1010" (Cash on Hand)
  bank_replenishment_account: string; // "1020" (Mandiri Operating)
  float_limit: number; // Plafon tetap (misal Rp 10.000.000)
  low_balance_threshold: number; // Peringatan saldo rendah (misal Rp 2.000.000)
  updated_at: string;
}

export interface PettyCashBalanceSummary {
  float_limit: number;
  current_balance: number;
  pending_expenses_total: number;
  pending_vouchers_count: number;
  is_low_balance: boolean;
  total_reimbursed_ytd: number;
  config: PettyCashFloatConfig;
}

export interface PettyCashReplenishmentClaim {
  claim_id: string; // e.g. "PCR-2026-001"
  claim_date: string;
  claim_period: string;
  total_amount: number;
  vouchers_count: number;
  voucher_ids: string[];
  bank_source_account: string;
  journal_id?: string;
  approved_by: string;
  status: 'POSTED';
  notes?: string;
  created_at: string;
}






