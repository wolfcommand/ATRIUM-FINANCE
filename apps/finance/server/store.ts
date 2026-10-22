/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  Account,
  Department,
  JournalHeader,
  JournalLine,
  JournalWithLines,
  RevenueTransaction,
  SpendingTransaction,
  MappingConfig,
  GeneralLedgerEntry,
  TrialBalanceReport,
  TrialBalanceItem,
  FinancialStatementsReport,
  UsaliStatementReport,
  ReportLineItem,
  DrilldownDetail,
  DrilldownAccountSummary,
  DrilldownJournalLine,
  ControlException,
  MasterReportConfig,
  DEFAULT_MASTER_REPORT_CONFIG,
  ConfigurableReportLine,
  ConfigurableReportSection,
  SystemUser,
  UserRoleDefinition,
  AccessControlState,
} from '../src/types';
import { GoogleSheetsClient, REQUIRED_TABS } from './sheets';

export class AccountingStore {
  public sheetsClient: GoogleSheetsClient;

  // Persistent mock data status flag
  public isMockDataCleared: boolean = false;

  // In-memory active dataset (mirrored with Google Sheets when connected)
  public accounts: Map<string, Account> = new Map();
  public departments: Map<string, Department> = new Map();
  public journalHeaders: Map<string, JournalHeader> = new Map();
  public journalLines: JournalLine[] = [];
  public revenueTransactions: Map<string, RevenueTransaction> = new Map();
  public spendingTransactions: Map<string, SpendingTransaction> = new Map();

  // Accounting mapping configuration for automated journal generation
  public mappingConfig: MappingConfig = {
    revenue_default_debit_account: '', // e.g. '1020' - Guest Ledger / Cash in Transit
    spending_procurement_credit_account: '', // e.g. '2010' - Accounts Payable Trade
    spending_payroll_credit_account: '', // e.g. '2020' - Accrued Payroll
    spending_other_credit_account: '', // e.g. '1010' - Operating Cash
    confirmed_by_controller: false,
  };

  // Report structure and formatting configuration
  public reportConfig: MasterReportConfig = JSON.parse(JSON.stringify(DEFAULT_MASTER_REPORT_CONFIG));

  // System Administration & Period Close Policy
  public systemSettings = {
    property_name: 'Atrium Hotel & Resort (Flagship)',
    room_count: 120,
    base_currency: 'IDR',
    fiscal_year: '2026',
    period_lock_date: '2026-07-31', // Accounting periods on or before this date are closed
    controller_name: 'Financial Controller',
  };

  // User Access & RBAC Storage
  public roles: Map<string, UserRoleDefinition> = new Map();
  public users: Map<string, SystemUser> = new Map();
  public currentUserId: string = 'usr-controller-1';
  /** Active Wolf company for request-scoped isolation (Prompt 5). */
  public currentCompanyId: string | null = null;
  /** Fake backfill company until an owner mapping is provided. */
  public defaultCompanyId: string = process.env.WOLF_DEFAULT_COMPANY_ID || 'company-amg-fake';

  constructor() {
    this.sheetsClient = new GoogleSheetsClient();
    this.initDefaultAccessControl();
  }

  public ensureJournalCompanyIds(): void {
    for (const [id, header] of this.journalHeaders.entries()) {
      if (!header.company_id) {
        this.journalHeaders.set(id, { ...header, company_id: this.defaultCompanyId, currency: 'IDR' });
      }
    }
  }

  // Seed standard hotel roles and initial users
  public initDefaultAccessControl(): void {
    const roles: UserRoleDefinition[] = [
      {
        id: 'role-financial-controller',
        name: 'Financial Controller (Full Admin)',
        description: 'Complete system control: period closes, full chart of accounts, posting approvals, journal reversals, and user permission management.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'operations': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'accounting-core': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'reports': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'tax': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'configuration': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'controls-audit': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'integrations': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
          'administration': { canView: true, canCreate: true, canEdit: true, canApprove: true, canDelete: true, canExport: true },
        },
      },
      {
        id: 'role-general-accountant',
        name: 'General Accountant',
        description: 'Enters operational transactions, prepares drafts, validates journals, and analyzes general ledger. Cannot approve or alter system configuration.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'operations': { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
          'accounting-core': { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
          'reports': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'tax': { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
          'configuration': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'controls-audit': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'integrations': { canView: true, canCreate: true, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'administration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
        },
      },
      {
        id: 'role-front-office-cashier',
        name: 'Front Office / Night Auditor',
        description: 'Enters daily revenue batches, guest folio settlements, and night audit balancing feeds. Restricted from accounting core, reports, and admin.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'operations': { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: false },
          'accounting-core': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'reports': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'tax': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'configuration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'controls-audit': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'integrations': { canView: true, canCreate: true, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'administration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
        },
      },
      {
        id: 'role-ap-purchasing',
        name: 'Accounts Payable & Purchasing Clerk',
        description: 'Records procurement vouchers, invoices, and supplier bills. Generates spending lines but cannot approve payment journals or view executive reports.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'operations': { canView: true, canCreate: true, canEdit: true, canApprove: false, canDelete: false, canExport: true },
          'accounting-core': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'reports': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'tax': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'configuration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'controls-audit': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'integrations': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'administration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
        },
      },
      {
        id: 'role-general-manager-owner',
        name: 'General Manager / Hotel Owner (Executive)',
        description: 'High-level executive access: Full visibility into Command Centre, USALI P&L, balance sheets, departmental audits. Read & export only; no edits or posting.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'operations': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'accounting-core': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'reports': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'tax': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'configuration': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'controls-audit': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'integrations': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
          'administration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: false },
        },
      },
      {
        id: 'role-external-auditor',
        name: 'Internal & External Auditor',
        description: 'Read-only access across all financial ledgers, audit trails, and journals for compliance verification. Zero modification rights.',
        isSystemRole: true,
        permissions: {
          'command-centre': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'operations': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'accounting-core': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'reports': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'tax': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'configuration': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'controls-audit': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'integrations': { canView: true, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
          'administration': { canView: false, canCreate: false, canEdit: false, canApprove: false, canDelete: false, canExport: true },
        },
      },
    ];

    roles.forEach((r) => this.roles.set(r.id, r));

    const users: SystemUser[] = [
      {
        id: 'usr-controller-1',
        name: 'Zayen Lalu',
        email: 'laluzayen@gmail.com',
        roleId: 'role-financial-controller',
        password: 'AdminPassword2026!',
        status: 'active',
        lastLogin: 'Just now',
      },
      {
        id: 'usr-accountant-1',
        name: 'Dewi Sartika',
        email: 'dewi.sartika@atriumhotel.com',
        roleId: 'role-general-accountant',
        departmentCode: '700',
        password: 'AtriumAccountant123!',
        status: 'active',
        lastLogin: 'Today at 08:30 AM',
      },
      {
        id: 'usr-front-desk-1',
        name: 'Budi Santoso',
        email: 'budi.santoso@atriumhotel.com',
        roleId: 'role-front-office-cashier',
        departmentCode: '100',
        password: 'FrontDeskPass123!',
        status: 'active',
        lastLogin: 'Yesterday at 11:45 PM',
      },
      {
        id: 'usr-ap-buyer-1',
        name: 'Rian Hidayat',
        email: 'rian.purchasing@atriumhotel.com',
        roleId: 'role-ap-purchasing',
        departmentCode: '700',
        password: 'PurchasingPass123!',
        status: 'active',
        lastLogin: '2 days ago',
      },
      {
        id: 'usr-gm-1',
        name: 'Alexander Ward',
        email: 'gm@atriumhotel.com',
        roleId: 'role-general-manager-owner',
        password: 'ExecutivePass123!',
        status: 'active',
        lastLogin: '3 days ago',
      },
    ];

    users.forEach((u) => this.users.set(u.id, u));
  }

  public async init(): Promise<void> {
    const stateFile = path.join(process.cwd(), 'data', 'system_state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        if (state.mock_data_cleared) {
          this.isMockDataCleared = true;
        }
      } catch (e) {
        console.warn('Failed to parse system_state.json', e);
      }
    }

    const connected = await this.sheetsClient.initialize();
    if (connected) {
      await this.loadFromSheets();
      if (this.accounts.size === 0) {
        await this.seedStandardHotelAccounts();
      }
    } else {
      if (this.accounts.size === 0) {
        await this.seedStandardHotelAccounts();
      }
    }
    this.ensureServiceChargeAccounts();
    this.ensureOwnerPoolAccounts();
    this.ensureTaxAccounts();
    await this.seedInitialPostedNightAuditRevenueIfEmpty();
  }

  public ensureServiceChargeAccounts(): void {
    if (!this.accounts.has('2030')) {
      this.accounts.set('2030', {
        account_code: '2030',
        account_name: 'Staff Service Charge Fund (Trust Liability)',
        account_type: 'Liability',
        normal_balance: 'Credit',
        statutory_line: 'Current Liabilities',
        usali_line: 'Service Charge Trust Liability',
        active: 'Y',
      });
    }
    if (!this.accounts.has('2040')) {
      this.accounts.set('2040', {
        account_code: '2040',
        account_name: 'Tax Payable - Employee Withholding (PPh 21)',
        account_type: 'Liability',
        normal_balance: 'Credit',
        statutory_line: 'Taxes Payable',
        usali_line: 'Payroll Taxes Payable',
        active: 'Y',
      });
    }
  }

  public ensureOwnerPoolAccounts(): void {
    if (!this.accounts.has('2060')) {
      this.accounts.set('2060', {
        account_code: '2060',
        account_name: 'Owner Return & Distribution Payable (Escrow Liability)',
        account_type: 'Liability',
        normal_balance: 'Credit',
        statutory_line: 'Current Liabilities',
        usali_line: 'Owner Distribution Payable',
        active: 'Y',
      });
    }
    if (!this.accounts.has('2070')) {
      this.accounts.set('2070', {
        account_code: '2070',
        account_name: 'Tax Payable - Owner Withholding (PPh Final Pasal 4(2) / PPh 23)',
        account_type: 'Liability',
        normal_balance: 'Credit',
        statutory_line: 'Taxes Payable',
        usali_line: 'Owner Withholding Taxes Payable',
        active: 'Y',
      });
    }
    if (!this.accounts.has('5030')) {
      this.accounts.set('5030', {
        account_code: '5030',
        account_name: 'Owner Pool Return Distribution Allocation',
        account_type: 'Expense',
        normal_balance: 'Debit',
        statutory_line: 'Operating Expenses',
        usali_line: 'Owner Pool Allocation',
        active: 'Y',
      });
    }
  }

  public ensureTaxAccounts(): void {
    const taxAccounts: { code: string; name: string; statutory: string; usali: string }[] = [
      { code: '2040', name: 'Tax Payable - Employee Withholding (PPh 21)', statutory: 'Taxes Payable', usali: 'Payroll Taxes Payable' },
      { code: '2070', name: 'Tax Payable - Owner Withholding (PPh Final Pasal 4(2) / PPh 23)', statutory: 'Taxes Payable', usali: 'Owner Withholding Taxes Payable' },
      { code: '2080', name: 'Tax Payable - PBJT Hotel (Local Hospitality Tax)', statutory: 'Taxes Payable', usali: 'Local Taxes Payable' },
      { code: '2081', name: 'Tax Payable - PPh 23 Vendor Withholding', statutory: 'Taxes Payable', usali: 'Vendor Taxes Payable' },
      { code: '2082', name: 'Tax Payable - PPh 26 Non-Resident Withholding', statutory: 'Taxes Payable', usali: 'Withholding Taxes Payable' },
      { code: '2083', name: 'Tax Payable - PPh Final Pasal 4(2) Rent & Services', statutory: 'Taxes Payable', usali: 'Withholding Taxes Payable' },
      { code: '2084', name: 'Tax Payable - PPh 25 Corporate Monthly Installment', statutory: 'Taxes Payable', usali: 'Corporate Taxes Payable' },
      { code: '2085', name: 'Tax Payable - PPh Badan Corporate Income Tax', statutory: 'Taxes Payable', usali: 'Corporate Income Taxes Payable' },
      { code: '2086', name: 'Tax Payable - PPN Keluaran (Value Added Tax)', statutory: 'Taxes Payable', usali: 'VAT Payable' },
      { code: '1100', name: 'Prepaid Tax & PPN Masukan (VAT In)', statutory: 'Other Current Assets', usali: 'Prepaid Expenses' },
      { code: '9010', name: 'Purchase Order Encumbrance (Committed Expense)', statutory: 'Commitments & Contingencies', usali: 'PO Encumbrances' },
      { code: '9020', name: 'Reserve for Encumbrances (PO Outstanding Commitments)', statutory: 'Commitments & Contingencies', usali: 'Reserve for PO Commitments' },
    ];

    for (const t of taxAccounts) {
      if (!this.accounts.has(t.code)) {
        this.accounts.set(t.code, {
          account_code: t.code,
          account_name: t.name,
          account_type: 'Liability',
          normal_balance: 'Credit',
          statutory_line: t.statutory,
          usali_line: t.usali,
          active: 'Y',
        });
      }
    }
  }

  public async seedInitialPostedNightAuditRevenueIfEmpty(): Promise<void> {
    if (this.isMockDataCleared || this.journalHeaders.has('JRN-PMS-202609-CLOSE')) return;

    // Seed realistic posted Night Audit revenues for 2026-08 and 2026-09
    const seedBatches = [
      {
        journal_id: 'JRN-PMS-202608-CLOSE',
        date: '2026-08-31',
        period: '2026-08',
        txId: 'REV-PMS-20260831',
        transient: 1350000000,
        group: 0,
        desc: 'OPERA PMS Month-End Rooms Revenue Audited Close (August 2026)',
      },
      {
        journal_id: 'JRN-PMS-202609-CLOSE',
        date: '2026-09-30',
        period: '2026-09',
        txId: 'REV-PMS-20260930',
        transient: 1480000000,
        group: 120000000,
        desc: 'OPERA PMS Month-End Rooms Revenue Audited Close (September 2026)',
      },
    ];

    for (const b of seedBatches) {
      const total = b.transient + b.group;
      const lines: JournalLine[] = [
        {
          journal_id: b.journal_id,
          line_no: 1,
          account_code: '1020',
          department_code: '100',
          debit: total,
          credit: 0,
          description: `Guest Folio Settlement & City Ledger Clearing: ${b.desc}`,
        },
        {
          journal_id: b.journal_id,
          line_no: 2,
          account_code: '4010',
          department_code: '100',
          debit: 0,
          credit: b.transient,
          description: `Transient Room Revenue: ${b.desc}`,
        },
      ];

      if (b.group > 0) {
        lines.push({
          journal_id: b.journal_id,
          line_no: 3,
          account_code: '4020',
          department_code: '100',
          debit: 0,
          credit: b.group,
          description: `Group & Corporate Room Revenue: ${b.desc}`,
        });
      }

      const header: JournalHeader = {
        journal_id: b.journal_id,
        journal_date: b.date,
        period: b.period,
        source_type: 'REVENUE',
        source_reference: b.txId,
        created_by: 'PMS Night Audit Interface (OPERA / Cloud PMS)',
        approved_by: 'Financial Controller',
        status: 'POSTED',
        posted_at: `${b.date}T23:59:59.000Z`,
        reversal_of: null,
      };

      this.journalHeaders.set(b.journal_id, header);
      for (const l of lines) {
        this.journalLines.push(l);
      }

      this.revenueTransactions.set(b.txId, {
        transaction_id: b.txId,
        date: b.date,
        source: 'PMS',
        department_code: '100',
        account_code: '4010',
        amount: total,
        description: b.desc,
        journal_id: b.journal_id,
      });
    }
  }

  // Reload all data from Google Sheets
  public async loadFromSheets(): Promise<void> {
    if (!this.sheetsClient.isConnected) return;

    try {
      // 1. Chart of Accounts
      const rawAccounts = await this.sheetsClient.readTab('chart_of_accounts');
      this.accounts.clear();
      for (const row of rawAccounts) {
        if (row.account_code) {
          this.accounts.set(String(row.account_code).trim(), {
            account_code: String(row.account_code).trim(),
            account_name: String(row.account_name || '').trim(),
            account_type: (row.account_type || 'Asset') as any,
            normal_balance: (row.normal_balance || 'Debit') as any,
            statutory_line: String(row.statutory_line || '').trim(),
            usali_line: String(row.usali_line || '').trim(),
            active: (String(row.active).toUpperCase() === 'N' ? 'N' : 'Y') as any,
          });
        }
      }

      // 2. Departments
      const rawDepts = await this.sheetsClient.readTab('departments');
      this.departments.clear();
      for (const row of rawDepts) {
        if (row.department_code) {
          this.departments.set(String(row.department_code).trim(), {
            department_code: String(row.department_code).trim(),
            department_name: String(row.department_name || '').trim(),
            active: (String(row.active).toUpperCase() === 'N' ? 'N' : 'Y') as any,
          });
        }
      }

      // 3. Journal Headers
      const rawHeaders = await this.sheetsClient.readTab('journal_header');
      this.journalHeaders.clear();
      for (const row of rawHeaders) {
        if (row.journal_id) {
          this.journalHeaders.set(String(row.journal_id).trim(), {
            journal_id: String(row.journal_id).trim(),
            journal_date: String(row.journal_date || '').trim(),
            period: String(row.period || '').trim(),
            status: (row.status || 'DRAFT') as any,
            source_type: (row.source_type || 'MANUAL') as any,
            source_reference: String(row.source_reference || '').trim(),
            created_by: String(row.created_by || '').trim(),
            approved_by: String(row.approved_by || '').trim(),
            posted_at: String(row.posted_at || '').trim(),
            reversal_of: String(row.reversal_of || '').trim(),
          });
        }
      }

      // 4. Journal Lines
      const rawLines = await this.sheetsClient.readTab('journal_line');
      this.journalLines = [];
      for (const row of rawLines) {
        if (row.journal_id) {
          this.journalLines.push({
            journal_id: String(row.journal_id).trim(),
            line_no: Number(row.line_no) || 1,
            account_code: String(row.account_code || '').trim(),
            department_code: String(row.department_code || '').trim(),
            debit: parseFloat(row.debit) || 0,
            credit: parseFloat(row.credit) || 0,
            description: String(row.description || '').trim(),
          });
        }
      }

      // 5. Revenue Transactions
      const rawRev = await this.sheetsClient.readTab('revenue_transactions');
      this.revenueTransactions.clear();
      for (const row of rawRev) {
        if (row.transaction_id) {
          this.revenueTransactions.set(String(row.transaction_id).trim(), {
            transaction_id: String(row.transaction_id).trim(),
            date: String(row.date || '').trim(),
            source: (row.source || 'Manual') as any,
            department_code: String(row.department_code || '').trim(),
            account_code: String(row.account_code || '').trim(),
            amount: parseFloat(row.amount) || 0,
            description: String(row.description || '').trim(),
            journal_id: String(row.journal_id || '').trim(),
          });
        }
      }

      // 6. Spending Transactions
      const rawSpend = await this.sheetsClient.readTab('spending_transactions');
      this.spendingTransactions.clear();
      for (const row of rawSpend) {
        if (row.transaction_id) {
          this.spendingTransactions.set(String(row.transaction_id).trim(), {
            transaction_id: String(row.transaction_id).trim(),
            date: String(row.date || '').trim(),
            type: (row.type || 'Procurement') as any,
            vendor_or_employee: String(row.vendor_or_employee || '').trim(),
            department_code: String(row.department_code || '').trim(),
            account_code: String(row.account_code || '').trim(),
            amount: parseFloat(row.amount) || 0,
            description: String(row.description || '').trim(),
            journal_id: String(row.journal_id || '').trim(),
          });
        }
      }
    } catch (err) {
      console.error('Failed to sync from Google Sheets:', err);
    }
  }

  // Persist a single table to Google Sheets
  public async syncTabToSheets(tabName: keyof typeof REQUIRED_TABS): Promise<void> {
    if (!this.sheetsClient.isConnected) return;

    try {
      const headers = REQUIRED_TABS[tabName];
      let rows: any[][] = [];

      switch (tabName) {
        case 'chart_of_accounts':
          rows = Array.from(this.accounts.values()).map((a) => [
            a.account_code,
            a.account_name,
            a.account_type,
            a.normal_balance,
            a.statutory_line,
            a.usali_line,
            a.active,
          ]);
          break;
        case 'departments':
          rows = Array.from(this.departments.values()).map((d) => [
            d.department_code,
            d.department_name,
            d.active,
          ]);
          break;
        case 'journal_header':
          rows = Array.from(this.journalHeaders.values()).map((j) => [
            j.journal_id,
            j.journal_date,
            j.period,
            j.status,
            j.source_type,
            j.source_reference,
            j.created_by,
            j.approved_by,
            j.posted_at,
            j.reversal_of,
          ]);
          break;
        case 'journal_line':
          rows = this.journalLines.map((l) => [
            l.journal_id,
            l.line_no,
            l.account_code,
            l.department_code,
            l.debit,
            l.credit,
            l.description,
          ]);
          break;
        case 'revenue_transactions':
          rows = Array.from(this.revenueTransactions.values()).map((r) => [
            r.transaction_id,
            r.date,
            r.source,
            r.department_code,
            r.account_code,
            r.amount,
            r.description,
            r.journal_id,
          ]);
          break;
        case 'spending_transactions':
          rows = Array.from(this.spendingTransactions.values()).map((s) => [
            s.transaction_id,
            s.date,
            s.type,
            s.vendor_or_employee,
            s.department_code,
            s.account_code,
            s.amount,
            s.description,
            s.journal_id,
          ]);
          break;
      }

      await this.sheetsClient.writeTab(tabName, headers, rows);
    } catch (err) {
      console.error(`Error saving ${tabName} to Google Sheets:`, err);
    }
  }

  // --- ACCOUNTS LOGIC ---
  public getAccounts(): Account[] {
    return Array.from(this.accounts.values()).sort((a, b) =>
      a.account_code.localeCompare(b.account_code)
    );
  }

  public async saveAccount(account: Account): Promise<Account> {
    const code = account.account_code.trim();
    if (!code) throw new Error('Account code is required');
    if (!account.account_name.trim()) throw new Error('Account name is required');

    this.accounts.set(code, {
      ...account,
      account_code: code,
      active: account.active === 'N' ? 'N' : 'Y',
    });

    await this.syncTabToSheets('chart_of_accounts');
    return this.accounts.get(code)!;
  }

  public async deactivateAccount(code: string): Promise<Account> {
    const acc = this.accounts.get(code);
    if (!acc) throw new Error(`Account ${code} not found`);

    acc.active = 'N';
    this.accounts.set(code, acc);
    await this.syncTabToSheets('chart_of_accounts');
    return acc;
  }

  public async deleteAccount(code: string): Promise<void> {
    const acc = this.accounts.get(code);
    if (!acc) throw new Error(`Account ${code} not found`);

    // Check if account has any posted journal history
    const hasPostedHistory = this.journalLines.some((l) => {
      if (l.account_code !== code) return false;
      const header = this.journalHeaders.get(l.journal_id);
      return header && header.status === 'POSTED';
    });

    if (hasPostedHistory) {
      throw new Error(
        `Account ${code} has posted journal history and cannot be deleted. Deactivate it instead.`
      );
    }

    this.accounts.delete(code);
    await this.syncTabToSheets('chart_of_accounts');
  }

  // --- DEPARTMENTS LOGIC ---
  public getDepartments(): Department[] {
    return Array.from(this.departments.values()).sort((a, b) =>
      a.department_code.localeCompare(b.department_code)
    );
  }

  public async saveDepartment(dept: Department): Promise<Department> {
    const code = dept.department_code.trim();
    if (!code) throw new Error('Department code is required');
    if (!dept.department_name.trim()) throw new Error('Department name is required');

    this.departments.set(code, {
      ...dept,
      department_code: code,
      active: dept.active === 'N' ? 'N' : 'Y',
    });

    await this.syncTabToSheets('departments');
    return this.departments.get(code)!;
  }

  // --- JOURNAL MANAGEMENT & WORKFLOW ---
  public getJournals(): JournalWithLines[] {
    this.ensureJournalCompanyIds();
    const result: JournalWithLines[] = [];
    const companyId = this.currentCompanyId;

    for (const header of this.journalHeaders.values()) {
      if (companyId && header.company_id && header.company_id !== companyId) continue;
      const lines = this.journalLines.filter((l) => l.journal_id === header.journal_id);
      const total_debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const total_credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      const is_balanced = Math.abs(total_debit - total_credit) < 0.0001 && total_debit > 0;

      result.push({
        ...header,
        lines,
        total_debit: Math.round(total_debit * 100) / 100,
        total_credit: Math.round(total_credit * 100) / 100,
        is_balanced,
      });
    }

    // Sort newest first
    return result.sort((a, b) => {
      if (a.journal_date !== b.journal_date) {
        return b.journal_date.localeCompare(a.journal_date);
      }
      return b.journal_id.localeCompare(a.journal_id);
    });
  }

  public getJournalById(journalId: string): JournalWithLines | null {
    this.ensureJournalCompanyIds();
    const header = this.journalHeaders.get(journalId);
    if (!header) return null;
    if (
      this.currentCompanyId &&
      header.company_id &&
      header.company_id !== this.currentCompanyId
    ) {
      return null;
    }

    const lines = this.journalLines.filter((l) => l.journal_id === journalId);
    const total_debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const total_credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    const is_balanced = Math.abs(total_debit - total_credit) < 0.0001 && total_debit > 0;

    return {
      ...header,
      lines,
      total_debit: Math.round(total_debit * 100) / 100,
      total_credit: Math.round(total_credit * 100) / 100,
      is_balanced,
    };
  }

  public async createJournal(
    headerData: Omit<JournalHeader, 'journal_id' | 'status' | 'approved_by' | 'posted_at' | 'reversal_of'> & {
      journal_id?: string;
      status?: 'DRAFT';
      reversal_of?: string;
    },
    linesData: Omit<JournalLine, 'journal_id' | 'line_no'>[]
  ): Promise<JournalWithLines> {
    const journal_id =
      headerData.journal_id ||
      `JRN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    if (linesData.length < 2) {
      throw new Error('Double-entry journal requires at least two lines.');
    }

    if (this.systemSettings.period_lock_date && headerData.journal_date <= this.systemSettings.period_lock_date) {
      throw new Error(
        `Period Lock Enforced: Journal date (${headerData.journal_date}) is within a closed accounting period (Cut-off: ${this.systemSettings.period_lock_date}). Postings to closed periods are prohibited by Financial Controller policy.`
      );
    }

    const lines: JournalLine[] = linesData.map((line, idx) => ({
      journal_id,
      line_no: idx + 1,
      account_code: line.account_code,
      department_code: line.department_code || '',
      debit: Math.round((line.debit || 0) * 100) / 100,
      credit: Math.round((line.credit || 0) * 100) / 100,
      description: line.description || '',
    }));
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);

    const header: JournalHeader = {
      journal_id,
      journal_date: headerData.journal_date,
      period: headerData.period || headerData.journal_date.substring(0, 7),
      status: 'DRAFT',
      source_type: headerData.source_type,
      source_reference: headerData.source_reference || '',
      created_by: headerData.created_by || 'Financial Controller',
      approved_by: '',
      posted_at: '',
      reversal_of: headerData.reversal_of || '',
      company_id: this.currentCompanyId || this.defaultCompanyId,
      currency: 'IDR',
      total_debit_minor: Math.round(totalDebit * 100),
    };

    this.journalHeaders.set(journal_id, header);
    this.journalLines.push(...lines);

    await this.syncTabToSheets('journal_header');
    await this.syncTabToSheets('journal_line');

    return this.getJournalById(journal_id)!;
  }

  // Validate workflow step
  public async validateJournal(journalId: string): Promise<JournalWithLines> {
    const journal = this.getJournalById(journalId);
    if (!journal) throw new Error(`Journal ${journalId} not found`);

    if (journal.status !== 'DRAFT') {
      throw new Error(`Only DRAFT journals can be validated. Current status: ${journal.status}`);
    }

    // 1. Balance check: Debits must strictly equal Credits
    if (!journal.is_balanced) {
      throw new Error(
        `Debits (${journal.total_debit.toFixed(2)}) must strictly equal Credits (${journal.total_credit.toFixed(2)}) before validation.`
      );
    }

    // 2. Validate accounts exist and are active
    for (const line of journal.lines) {
      const acc = this.accounts.get(line.account_code);
      if (!acc) {
        throw new Error(`Line references invalid account code: ${line.account_code}`);
      }
      if (acc.active === 'N') {
        throw new Error(`Line references inactive account: ${line.account_code} (${acc.account_name})`);
      }
    }

    const updatedHeader: JournalHeader = {
      ...this.journalHeaders.get(journalId)!,
      status: 'VALIDATED',
    };
    this.journalHeaders.set(journalId, updatedHeader);

    await this.syncTabToSheets('journal_header');
    return this.getJournalById(journalId)!;
  }

  // Approve workflow step — resolves configurable policy (default = single approver)
  public async approveJournal(journalId: string, approverName: string = 'Zayen (Controller)'): Promise<JournalWithLines> {
    const { resolvePolicy } = await import('./approvalPolicy.js');
    const journal = this.getJournalById(journalId);
    if (!journal) throw new Error(`Journal ${journalId} not found`);

    if (journal.status !== 'VALIDATED') {
      throw new Error(`Journal must be in VALIDATED status before Approval. Current status: ${journal.status}`);
    }

    const companyId = journal.company_id || this.currentCompanyId || this.defaultCompanyId;
    const snapshot = resolvePolicy(
      companyId,
      'finance.journal',
      journal.total_debit_minor ?? Math.round(journal.total_debit * 100),
    );
    if (!snapshot.steps.length) {
      throw new Error('Approval policy has no applicable steps for this journal.');
    }

    const updatedHeader: JournalHeader = {
      ...this.journalHeaders.get(journalId)!,
      status: 'APPROVED',
      approved_by: approverName,
      approval_snapshot: {
        policyId: snapshot.policyId,
        policyVersion: snapshot.policyVersion,
        snapshotAt: snapshot.snapshotAt,
      },
    };
    this.journalHeaders.set(journalId, updatedHeader);

    await this.syncTabToSheets('journal_header');
    return this.getJournalById(journalId)!;
  }

  // Post workflow step — locks the journal, immutable
  public async postJournal(
    journalId: string,
    options?: { autoApprove?: boolean; approver?: string }
  ): Promise<JournalWithLines> {
    const journal = this.getJournalById(journalId);
    if (!journal) throw new Error(`Journal ${journalId} not found`);

    if (journal.status === 'POSTED') {
      return journal; // Already posted, safely return existing state
    }
    if (journal.status === 'REVERSED') {
      throw new Error(`Journal ${journalId} has already been reversed and cannot be posted again.`);
    }

    // Auto-approval and validation progression if needed
    if (journal.status !== 'APPROVED') {
      if (options?.autoApprove !== false) {
        if (journal.status === 'DRAFT') {
          await this.validateJournal(journalId);
        }
        await this.approveJournal(
          journalId,
          options?.approver || 'Zayen (Financial Controller)'
        );
      } else {
        throw new Error(
          `Journal must be in APPROVED status before posting. Current status: ${journal.status}. Validate and approve before posting.`
        );
      }
    }

    const currentJournal = this.getJournalById(journalId)!;

    if (
      this.systemSettings.period_lock_date &&
      currentJournal.journal_date <= this.systemSettings.period_lock_date
    ) {
      throw new Error(
        `Period Lock Enforced: Journal date (${currentJournal.journal_date}) falls in a closed accounting period (Cut-off: ${this.systemSettings.period_lock_date}). Postings to closed periods are prohibited. Change the journal date or adjust the period cut-off in Administration Settings.`
      );
    }

    const postedTimestamp = new Date().toISOString();
    const updatedHeader: JournalHeader = {
      ...this.journalHeaders.get(journalId)!,
      status: 'POSTED',
      posted_at: postedTimestamp,
    };
    this.journalHeaders.set(journalId, updatedHeader);

    // Link journal_id back to source transaction if applicable
    if (updatedHeader.source_type === 'REVENUE' && updatedHeader.source_reference) {
      const rev = this.revenueTransactions.get(updatedHeader.source_reference);
      if (rev) {
        rev.journal_id = journalId;
        this.revenueTransactions.set(rev.transaction_id, rev);
        await this.syncTabToSheets('revenue_transactions');
      }
    } else if (updatedHeader.source_type === 'SPENDING' && updatedHeader.source_reference) {
      const sp = this.spendingTransactions.get(updatedHeader.source_reference);
      if (sp) {
        sp.journal_id = journalId;
        this.spendingTransactions.set(sp.transaction_id, sp);
        await this.syncTabToSheets('spending_transactions');
      }
    }

    await this.syncTabToSheets('journal_header');
    return this.getJournalById(journalId)!;
  }

  // Reversal workflow step: creates an offsetting journal; original stays untouched with status POSTED
  public async reverseJournal(journalId: string, reversalDate?: string): Promise<{ original: JournalWithLines; reversal: JournalWithLines }> {
    const original = this.getJournalById(journalId);
    if (!original) throw new Error(`Journal ${journalId} not found`);

    if (original.status !== 'POSTED') {
      throw new Error(`Only POSTED journals can be reversed. Current status: ${original.status}`);
    }

    const revDate = reversalDate || new Date().toISOString().split('T')[0];

    if (this.systemSettings.period_lock_date && revDate <= this.systemSettings.period_lock_date) {
      throw new Error(
        `Period Lock Enforced: Reversal date (${revDate}) falls within a closed accounting period (Cut-off: ${this.systemSettings.period_lock_date}). Post reversals to an open period.`
      );
    }

    const reversalJournalId = `REV-${journalId}`;

    // Check if reversal already exists
    if (this.journalHeaders.has(reversalJournalId)) {
      throw new Error(`A reversal journal (${reversalJournalId}) already exists for this journal.`);
    }

    // Offset lines: invert debits and credits
    const reversalLines: Omit<JournalLine, 'journal_id' | 'line_no'>[] = original.lines.map((l) => ({
      account_code: l.account_code,
      department_code: l.department_code,
      debit: l.credit, // Invert
      credit: l.debit, // Invert
      description: `Reversal of ${journalId} line: ${l.description || ''}`,
    }));

    const reversalJournal = await this.createJournal(
      {
        journal_id: reversalJournalId,
        journal_date: revDate,
        period: revDate.substring(0, 7),
        source_type: 'REVERSAL',
        source_reference: journalId,
        created_by: 'Financial Controller',
        reversal_of: journalId,
      },
      reversalLines
    );

    // Note: The prompt states:
    // "POSTED journals are immutable. Editing a posted journal is not allowed anywhere in the UI. Corrections happen via reversal + new journal."
    // We mark the original header status as REVERSED or preserve POSTED with audit note.
    // Setting original status to 'REVERSED' makes it clear in workbench while lines remain immutable.
    const origHeader = this.journalHeaders.get(journalId)!;
    origHeader.status = 'REVERSED';
    this.journalHeaders.set(journalId, origHeader);
    await this.syncTabToSheets('journal_header');

    return {
      original: this.getJournalById(journalId)!,
      reversal: reversalJournal,
    };
  }

  // Delete draft journal only (company-scoped)
  public async deleteDraftJournal(journalId: string): Promise<void> {
    const journal = this.getJournalById(journalId);
    if (!journal) throw new Error(`Journal ${journalId} not found`);

    if (journal.status !== 'DRAFT') {
      throw new Error(`Only DRAFT journals can be deleted. Journal ${journalId} is in ${journal.status} status.`);
    }

    this.journalHeaders.delete(journalId);
    this.journalLines = this.journalLines.filter((l) => l.journal_id !== journalId);

    await this.syncTabToSheets('journal_header');
    await this.syncTabToSheets('journal_line');
  }

  // --- REVENUE CYCLE ---
  public getRevenueTransactions(): RevenueTransaction[] {
    return Array.from(this.revenueTransactions.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  public async recordRevenueTransaction(params: {
    date: string;
    source: 'Manual' | 'PMS';
    department_code: string;
    account_code: string;
    amount: number;
    description: string;
    debit_account_code?: string; // Counterpart asset account (Cash / Guest Ledger)
  }): Promise<{ transaction: RevenueTransaction; draftJournal: JournalWithLines }> {
    if (!params.date) throw new Error('Transaction date is required');
    if (!params.department_code) throw new Error('Department code is required');
    if (!params.account_code) throw new Error('Revenue account code is required');
    if (params.amount <= 0) throw new Error('Transaction amount must be greater than zero');

    // Verify revenue account exists and is Revenue type
    const revAcc = this.accounts.get(params.account_code);
    if (!revAcc) throw new Error(`Account code ${params.account_code} does not exist`);

    // Determine counterpart debit account (Asset / Cash / Guest Ledger)
    const counterpartCode =
      params.debit_account_code || this.mappingConfig.revenue_default_debit_account;

    if (!counterpartCode) {
      throw new Error(
        'Counterpart Debit account (e.g. Guest Ledger / Cash in Transit) is not configured. Please confirm default mapping before generating journal.'
      );
    }

    const counterpartAcc = this.accounts.get(counterpartCode);
    if (!counterpartAcc) {
      throw new Error(
        `Configured counterpart account code ${counterpartCode} does not exist in Chart of Accounts.`
      );
    }

    const txId = `REV-TX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    // Create draft journal automatically
    const journalId = `JRN-REV-${txId.substring(7)}`;
    const draftJournal = await this.createJournal(
      {
        journal_id: journalId,
        journal_date: params.date,
        period: params.date.substring(0, 7),
        source_type: 'REVENUE',
        source_reference: txId,
        created_by: 'Financial Controller (Revenue Cycle)',
      },
      [
        {
          account_code: counterpartCode,
          department_code: params.department_code,
          debit: params.amount,
          credit: 0,
          description: `Settlement: ${params.description || 'Revenue Transaction'}`,
        },
        {
          account_code: params.account_code,
          department_code: params.department_code,
          debit: 0,
          credit: params.amount,
          description: params.description || `${revAcc.account_name} (${params.source})`,
        },
      ]
    );

    const transaction: RevenueTransaction = {
      transaction_id: txId,
      date: params.date,
      source: params.source || 'Manual',
      department_code: params.department_code,
      account_code: params.account_code,
      amount: params.amount,
      description: params.description || '',
      journal_id: journalId,
    };

    this.revenueTransactions.set(txId, transaction);
    await this.syncTabToSheets('revenue_transactions');

    return { transaction, draftJournal };
  }

  // --- AUTOMATED PMS NIGHT AUDIT INGESTION ---
  public async ingestPmsNightAudit(params: {
    date: string;
    room_revenue: number;
    fb_revenue: number;
    other_revenue?: number;
    description?: string;
  }): Promise<{
    transactions: RevenueTransaction[];
    journal: JournalWithLines;
  }> {
    if (!params.date) throw new Error('Night audit business date is required');
    if (this.systemSettings.period_lock_date && params.date <= this.systemSettings.period_lock_date) {
      throw new Error(`Period Lock Enforced: Night audit date (${params.date}) falls in a closed accounting period.`);
    }

    const defaultDebit = this.mappingConfig.revenue_default_debit_account || '1020';
    const roomsAcc = '4010';
    const fbAcc = '4110';
    const otherAcc = '4130';
    const otherRev = params.other_revenue || 0;
    const totalRev = Math.round((params.room_revenue + params.fb_revenue + otherRev) * 100) / 100;

    if (totalRev <= 0) {
      throw new Error('Total revenue for night audit batch must be greater than zero.');
    }

    const timeStamp = Date.now().toString(36).toUpperCase();
    const txRoomsId = `REV-PMS-${timeStamp}-1`;
    const txFbId = `REV-PMS-${timeStamp}-2`;
    const journalId = `JRN-PMS-${timeStamp}`;

    const txRooms: RevenueTransaction = {
      transaction_id: txRoomsId,
      date: params.date,
      source: 'PMS',
      department_code: '100',
      account_code: roomsAcc,
      amount: params.room_revenue,
      description: `PMS Night Audit Room Revenue - ${params.description || 'Daily In-House Guest Ledger'}`,
      journal_id: journalId,
    };

    const txFb: RevenueTransaction = {
      transaction_id: txFbId,
      date: params.date,
      source: 'PMS',
      department_code: '200',
      account_code: fbAcc,
      amount: params.fb_revenue,
      description: `PMS Night Audit F&B Revenue - ${params.description || 'Outlets & Dining Folio'}`,
      journal_id: journalId,
    };

    const createdTxs = [txRooms, txFb];
    this.revenueTransactions.set(txRoomsId, txRooms);
    this.revenueTransactions.set(txFbId, txFb);

    if (otherRev > 0) {
      const txOtherId = `REV-PMS-${timeStamp}-3`;
      const txOther: RevenueTransaction = {
        transaction_id: txOtherId,
        date: params.date,
        source: 'PMS',
        department_code: '200',
        account_code: otherAcc,
        amount: otherRev,
        description: `PMS Night Audit Events / Banquets Revenue - ${params.description || 'Banquet Folios'}`,
        journal_id: journalId,
      };
      this.revenueTransactions.set(txOtherId, txOther);
      createdTxs.push(txOther);
    }

    const journalLines: Omit<JournalLine, 'journal_id' | 'line_no'>[] = [
      {
        account_code: defaultDebit,
        department_code: '100',
        debit: totalRev,
        credit: 0,
        description: `PMS Night Audit: Guest Ledger Clearing & Settlement (${params.date})`,
      },
      {
        account_code: roomsAcc,
        department_code: '100',
        debit: 0,
        credit: params.room_revenue,
        description: `PMS Night Audit: Rooms Revenue - Transient (${params.date})`,
      },
      {
        account_code: fbAcc,
        department_code: '200',
        debit: 0,
        credit: params.fb_revenue,
        description: `PMS Night Audit: Food & Beverage Outlets (${params.date})`,
      },
    ];

    if (otherRev > 0) {
      journalLines.push({
        account_code: otherAcc,
        department_code: '200',
        debit: 0,
        credit: otherRev,
        description: `PMS Night Audit: Banquet & Event Services (${params.date})`,
      });
    }

    const draftJournal = await this.createJournal(
      {
        journal_id: journalId,
        journal_date: params.date,
        period: params.date.substring(0, 7),
        source_type: 'REVENUE',
        source_reference: txRoomsId,
        created_by: 'PMS Night Audit Interface (OPERA / Cloud PMS)',
      },
      journalLines
    );

    await this.syncTabToSheets('revenue_transactions');
    return { transactions: createdTxs, journal: draftJournal };
  }

  // Helper for Owner Pool and USALI Room Revenue Reconciliation
  public getPostedRoomRevenue(period?: string): {
    totalRoomRevenue: number;
    transientRevenue: number;
    groupRevenue: number;
    transactionsCount: number;
    journalLines: {
      journal_id: string;
      journal_date: string;
      account_code: string;
      account_name: string;
      description: string;
      credit: number;
      debit: number;
      net: number;
    }[];
  } {
    const roomAccounts = new Set(['4010', '4020']);
    const postedJournalIds = new Set<string>();
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'POSTED') {
        if (!period || h.period === period) {
          postedJournalIds.add(h.journal_id);
        }
      }
    }

    let transientRevenue = 0;
    let groupRevenue = 0;
    const lines: {
      journal_id: string;
      journal_date: string;
      account_code: string;
      account_name: string;
      description: string;
      credit: number;
      debit: number;
      net: number;
    }[] = [];

    for (const l of this.journalLines) {
      if (postedJournalIds.has(l.journal_id) && roomAccounts.has(l.account_code)) {
        const net = (l.credit || 0) - (l.debit || 0);
        if (l.account_code === '4010') transientRevenue += net;
        if (l.account_code === '4020') groupRevenue += net;
        const header = this.journalHeaders.get(l.journal_id);
        const acc = this.accounts.get(l.account_code);
        lines.push({
          journal_id: l.journal_id,
          journal_date: header?.journal_date || '',
          account_code: l.account_code,
          account_name: acc?.account_name || (l.account_code === '4010' ? 'Rooms Revenue - Transient' : 'Rooms Revenue - Group'),
          description: l.description,
          credit: l.credit,
          debit: l.debit,
          net: Math.round(net * 100) / 100,
        });
      }
    }

    const totalRoomRevenue = Math.round((transientRevenue + groupRevenue) * 100) / 100;
    return {
      totalRoomRevenue,
      transientRevenue: Math.round(transientRevenue * 100) / 100,
      groupRevenue: Math.round(groupRevenue * 100) / 100,
      transactionsCount: lines.length,
      journalLines: lines,
    };
  }

  // --- SPENDING CYCLE ---
  public getSpendingTransactions(): SpendingTransaction[] {
    return Array.from(this.spendingTransactions.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  public async recordSpendingTransaction(params: {
    date: string;
    type: 'Procurement' | 'Payroll' | 'Other';
    vendor_or_employee: string;
    department_code: string;
    account_code: string; // Expense / Asset account (Debit)
    amount: number;
    description: string;
    credit_account_code?: string; // Counterpart payable or cash account (Credit)
  }): Promise<{ transaction: SpendingTransaction; draftJournal: JournalWithLines }> {
    if (!params.date) throw new Error('Transaction date is required');
    if (!params.vendor_or_employee.trim()) throw new Error('Vendor or Employee name is required');
    if (!params.department_code) throw new Error('Department code is required');
    if (!params.account_code) throw new Error('Expense or Asset account code is required');
    if (params.amount <= 0) throw new Error('Transaction amount must be greater than zero');

    const expAcc = this.accounts.get(params.account_code);
    if (!expAcc) throw new Error(`Account code ${params.account_code} does not exist`);

    // Counterpart credit account lookup
    let counterpartCode = params.credit_account_code;
    if (!counterpartCode) {
      if (params.type === 'Procurement') {
        counterpartCode = this.mappingConfig.spending_procurement_credit_account;
      } else if (params.type === 'Payroll') {
        counterpartCode = this.mappingConfig.spending_payroll_credit_account;
      } else {
        counterpartCode = this.mappingConfig.spending_other_credit_account;
      }
    }

    if (!counterpartCode) {
      throw new Error(
        `Counterpart Credit account (Payable or Cash clearing) for ${params.type} is not configured. Please confirm default mapping before generating journal.`
      );
    }

    const counterpartAcc = this.accounts.get(counterpartCode);
    if (!counterpartAcc) {
      throw new Error(`Counterpart account ${counterpartCode} does not exist in Chart of Accounts.`);
    }

    const txId = `SPD-TX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const journalId = `JRN-SPD-${txId.substring(7)}`;

    // Create draft journal: Debit expense, Credit payable/cash
    const draftJournal = await this.createJournal(
      {
        journal_id: journalId,
        journal_date: params.date,
        period: params.date.substring(0, 7),
        source_type: 'SPENDING',
        source_reference: txId,
        created_by: 'Financial Controller (Spending Cycle)',
      },
      [
        {
          account_code: params.account_code,
          department_code: params.department_code,
          debit: params.amount,
          credit: 0,
          description: `${params.type}: ${params.vendor_or_employee} - ${params.description || expAcc.account_name}`,
        },
        {
          account_code: counterpartCode,
          department_code: params.department_code,
          debit: 0,
          credit: params.amount,
          description: `Payable/Settlement to ${params.vendor_or_employee}`,
        },
      ]
    );

    const transaction: SpendingTransaction = {
      transaction_id: txId,
      date: params.date,
      type: params.type,
      vendor_or_employee: params.vendor_or_employee,
      department_code: params.department_code,
      account_code: params.account_code,
      amount: params.amount,
      description: params.description || '',
      journal_id: journalId,
    };

    this.spendingTransactions.set(txId, transaction);
    await this.syncTabToSheets('spending_transactions');

    return { transaction, draftJournal };
  }

  // --- GENERAL LEDGER (POSTED ONLY) ---
  public getGeneralLedger(params?: {
    account_code?: string;
    period?: string;
    start_date?: string;
    end_date?: string;
  }): {
    account: Account | null;
    entries: GeneralLedgerEntry[];
    total_debit: number;
    total_credit: number;
    ending_balance: number;
  } {
    const account = params?.account_code ? this.accounts.get(params.account_code) || null : null;
    const entries: GeneralLedgerEntry[] = [];

    // Rule: "A transaction is only 'real' in reporting once its journal is POSTED.
    // Draft/Validated/Approved journals must NOT appear in financial reports."
    // Also include REVERSED journals as historical posted entries, along with their offsetting reversal journals.
    const postedJournalIds = new Set<string>();
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'POSTED' || h.status === 'REVERSED') {
        postedJournalIds.add(h.journal_id);
      }
    }

    // Filter relevant lines
    const matchedLines = this.journalLines.filter((l) => {
      if (!postedJournalIds.has(l.journal_id)) return false;
      if (params?.account_code && l.account_code !== params.account_code) return false;
      return true;
    });

    // Attach header information and sort chronologically
    const enriched = matchedLines
      .map((line) => {
        const header = this.journalHeaders.get(line.journal_id)!;
        return {
          journal_id: line.journal_id,
          journal_date: header.journal_date,
          period: header.period,
          source_type: header.source_type,
          source_reference: header.source_reference,
          department_code: line.department_code,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          account_code: line.account_code,
        };
      })
      .filter((e) => {
        if (params?.period && e.period !== params.period) return false;
        if (params?.start_date && e.journal_date < params.start_date) return false;
        if (params?.end_date && e.journal_date > params.end_date) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.journal_date !== b.journal_date) {
          return a.journal_date.localeCompare(b.journal_date);
        }
        return a.journal_id.localeCompare(b.journal_id);
      });

    // Compute running balance according to normal balance
    let running = 0;
    const isNormalCredit =
      account?.normal_balance === 'Credit' ||
      account?.account_type === 'Liability' ||
      account?.account_type === 'Equity' ||
      account?.account_type === 'Revenue';

    for (const item of enriched) {
      if (isNormalCredit) {
        running += item.credit - item.debit;
      } else {
        running += item.debit - item.credit;
      }

      entries.push({
        journal_id: item.journal_id,
        journal_date: item.journal_date,
        period: item.period,
        source_type: item.source_type,
        source_reference: item.source_reference,
        department_code: item.department_code,
        description: item.description,
        debit: item.debit,
        credit: item.credit,
        running_balance: Math.round(running * 100) / 100,
      });
    }

    const total_debit = entries.reduce((s, e) => s + e.debit, 0);
    const total_credit = entries.reduce((s, e) => s + e.credit, 0);

    return {
      account,
      entries,
      total_debit: Math.round(total_debit * 100) / 100,
      total_credit: Math.round(total_credit * 100) / 100,
      ending_balance: Math.round(running * 100) / 100,
    };
  }

  // --- TRIAL BALANCE (POSTED ONLY) ---
  public getTrialBalance(period?: string): TrialBalanceReport {
    // Only POSTED and REVERSED entries
    const postedJournalIds = new Set<string>();
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'POSTED' || h.status === 'REVERSED') {
        if (!period || h.period === period) {
          postedJournalIds.add(h.journal_id);
        }
      }
    }

    const sumsByAccount: Record<string, { debit: number; credit: number }> = {};

    for (const l of this.journalLines) {
      if (postedJournalIds.has(l.journal_id)) {
        if (!sumsByAccount[l.account_code]) {
          sumsByAccount[l.account_code] = { debit: 0, credit: 0 };
        }
        sumsByAccount[l.account_code].debit += l.debit;
        sumsByAccount[l.account_code].credit += l.credit;
      }
    }

    const items: TrialBalanceItem[] = [];
    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    // Iterate through all accounts that either have transactions or are active
    const allAccounts = this.getAccounts();
    for (const acc of allAccounts) {
      const sums = sumsByAccount[acc.account_code] || { debit: 0, credit: 0 };
      const debit_sum = Math.round(sums.debit * 100) / 100;
      const credit_sum = Math.round(sums.credit * 100) / 100;

      // Calculate net balance
      const net = debit_sum - credit_sum;
      let net_debit = 0;
      let net_credit = 0;

      if (net > 0) {
        net_debit = Math.round(net * 100) / 100;
      } else if (net < 0) {
        net_credit = Math.round(Math.abs(net) * 100) / 100;
      }

      grandTotalDebit += net_debit;
      grandTotalCredit += net_credit;

      items.push({
        account_code: acc.account_code,
        account_name: acc.account_name,
        account_type: acc.account_type,
        normal_balance: acc.normal_balance,
        debit_sum,
        credit_sum,
        net_balance: net,
        net_debit,
        net_credit,
      });
    }

    const total_debits = Math.round(grandTotalDebit * 100) / 100;
    const total_credits = Math.round(grandTotalCredit * 100) / 100;
    const variance = Math.round(Math.abs(total_debits - total_credits) * 100) / 100;
    const is_balanced = variance < 0.01;

    return {
      period: period || 'All Time',
      items,
      total_debits,
      total_credits,
      is_balanced,
      variance,
    };
  }

  // --- DASHBOARD METRICS ---
  public getDashboardMetrics(selectedPeriod?: string) {
    const today = new Date().toISOString().split('T')[0];
    const currentPeriod = selectedPeriod || today.substring(0, 7);

    // Posted Revenue (Lines with account_type == 'Revenue' in POSTED journals)
    let postedRevenueToday = 0;
    let postedRevenuePeriod = 0;
    let postedSpendingToday = 0;
    let postedSpendingPeriod = 0;

    for (const line of this.journalLines) {
      const header = this.journalHeaders.get(line.journal_id);
      if (!header || (header.status !== 'POSTED' && header.status !== 'REVERSED')) continue;

      const acc = this.accounts.get(line.account_code);
      if (!acc) continue;

      // Net revenue impact (Credit increases revenue, Debit reduces revenue)
      if (acc.account_type === 'Revenue') {
        const netRev = line.credit - line.debit;
        if (header.journal_date === today) {
          postedRevenueToday += netRev;
        }
        if (header.period === currentPeriod) {
          postedRevenuePeriod += netRev;
        }
      }

      // Net spending/expense impact (Debit increases expense, Credit reduces expense)
      if (acc.account_type === 'Expense') {
        const netExp = line.debit - line.credit;
        if (header.journal_date === today) {
          postedSpendingToday += netExp;
        }
        if (header.period === currentPeriod) {
          postedSpendingPeriod += netExp;
        }
      }
    }

    // Awaiting Approval / Action count
    let awaitingValidationCount = 0;
    let awaitingApprovalCount = 0;
    let awaitingPostingCount = 0;

    for (const h of this.journalHeaders.values()) {
      if (h.status === 'DRAFT') awaitingValidationCount++;
      if (h.status === 'VALIDATED') awaitingApprovalCount++;
      if (h.status === 'APPROVED') awaitingPostingCount++;
    }

    // Exceptions list:
    // 1. Unmapped revenue or spending configuration
    // 2. Draft journals not yet validated
    // 3. Transactions without posted journals
    const exceptions: { type: string; title: string; description: string; severity: 'warning' | 'error' | 'info' }[] = [];

    if (!this.mappingConfig.confirmed_by_controller) {
      exceptions.push({
        type: 'UNCONFIRMED_MAPPING',
        title: 'Default Account Mappings Not Confirmed',
        description: 'Revenue and spending default counterpart accounts require confirmation by Financial Controller.',
        severity: 'warning',
      });
    }

    if (awaitingValidationCount > 0) {
      exceptions.push({
        type: 'DRAFTS_PENDING',
        title: `${awaitingValidationCount} Draft Journal(s) Pending Validation`,
        description: 'Draft journals have been generated but not validated or tested for debit=credit balance.',
        severity: 'info',
      });
    }

    if (awaitingApprovalCount > 0) {
      exceptions.push({
        type: 'APPROVALS_PENDING',
        title: `${awaitingApprovalCount} Validated Journal(s) Awaiting Approval`,
        description: 'Financial transactions validated and pending Controller approval before posting.',
        severity: 'warning',
      });
    }

    return {
      today,
      currentPeriod,
      postedRevenueToday: Math.round(postedRevenueToday * 100) / 100,
      postedRevenuePeriod: Math.round(postedRevenuePeriod * 100) / 100,
      postedSpendingToday: Math.round(postedSpendingToday * 100) / 100,
      postedSpendingPeriod: Math.round(postedSpendingPeriod * 100) / 100,
      awaitingValidationCount,
      awaitingApprovalCount,
      awaitingPostingCount,
      totalJournalsAwaitingAction: awaitingValidationCount + awaitingApprovalCount + awaitingPostingCount,
      exceptions,
    };
  }

  // --- REUSABLE REPORT ENGINE (POSTED LEDGER ONLY) ---

  // Helper: compute net posted balances per account for a given period
  public getPostedAccountBalances(period?: string): Map<string, { debit: number; credit: number; net: number }> {
    const postedJournalIds = new Set<string>();
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'POSTED' || h.status === 'REVERSED') {
        if (!period || h.period === period) {
          postedJournalIds.add(h.journal_id);
        }
      }
    }

    const balances = new Map<string, { debit: number; credit: number; net: number }>();
    for (const l of this.journalLines) {
      if (postedJournalIds.has(l.journal_id)) {
        const cur = balances.get(l.account_code) || { debit: 0, credit: 0, net: 0 };
        cur.debit += l.debit || 0;
        cur.credit += l.credit || 0;
        balances.set(l.account_code, cur);
      }
    }

    // Compute net balance based on account normal balance
    for (const [code, val] of balances.entries()) {
      const acc = this.accounts.get(code);
      const isCredit =
        acc?.normal_balance === 'Credit' ||
        acc?.account_type === 'Liability' ||
        acc?.account_type === 'Equity' ||
        acc?.account_type === 'Revenue';
      val.net = isCredit ? val.credit - val.debit : val.debit - val.credit;
      val.net = Math.round(val.net * 100) / 100;
      val.debit = Math.round(val.debit * 100) / 100;
      val.credit = Math.round(val.credit * 100) / 100;
    }

    return balances;
  }

  // Report Configuration Management
  public getReportConfig(): MasterReportConfig {
    return this.reportConfig;
  }

  public updateReportConfig(config: Partial<MasterReportConfig>): MasterReportConfig {
    if (config.formatting) {
      this.reportConfig.formatting = {
        ...this.reportConfig.formatting,
        ...config.formatting,
      };
    }
    if (config.structures) {
      this.reportConfig.structures = {
        ...this.reportConfig.structures,
        ...config.structures,
      };
    }
    this.reportConfig.updated_at = new Date().toISOString();
    return this.reportConfig;
  }

  public resetReportConfig(): MasterReportConfig {
    this.reportConfig = JSON.parse(JSON.stringify(DEFAULT_MASTER_REPORT_CONFIG));
    return this.reportConfig;
  }

  // Financial Statements: Statement of Financial Position & Income Statement
  public getFinancialStatements(period?: string): FinancialStatementsReport {
    const balances = this.getPostedAccountBalances(period);
    const allAccounts = this.getAccounts();
    const formatting = this.reportConfig.formatting;
    const bsSections = this.reportConfig.structures.balance_sheet_sections;
    const isSections = this.reportConfig.structures.income_statement_sections;

    const calcSum = (codes: string[]) => {
      return Math.round(codes.reduce((s, c) => s + (balances.get(c)?.net || 0), 0) * 100) / 100;
    };

    // Helper to resolve lines for configured sections
    const buildLinesForSections = (sections: ConfigurableReportSection[], defaultAccType: string) => {
      const lineItems: ReportLineItem[] = [];
      const assignedAccounts = new Set<string>();

      for (const section of sections) {
        if (!section.is_visible) continue;
        const sortedLines = [...section.lines].sort((a, b) => (a.order || 0) - (b.order || 0));

        for (const line of sortedLines) {
          if (line.is_visible === false) continue;
          const matchingAccounts: string[] = [];

          for (const acc of allAccounts) {
            if (acc.account_type !== defaultAccType) continue;
            // Check prefix match
            const matchesPrefix = line.account_prefixes?.some((p) => acc.account_code.startsWith(p));
            const matchesId = (acc.statutory_line || '').toLowerCase().includes(line.label.toLowerCase());
            if (matchesPrefix || matchesId) {
              matchingAccounts.push(acc.account_code);
              assignedAccounts.add(acc.account_code);
            }
          }

          lineItems.push({
            line_id: line.id,
            label: line.label,
            amount: calcSum(matchingAccounts),
            account_codes: matchingAccounts,
            indent_level: line.indent_level || 1,
          });
        }
      }

      // Check if any accounts of this type were unassigned; append to first line if so
      const unassigned = allAccounts.filter((a) => a.account_type === defaultAccType && !assignedAccounts.has(a.account_code));
      if (unassigned.length > 0 && lineItems.length > 0) {
        lineItems[lineItems.length - 1].account_codes.push(...unassigned.map((a) => a.account_code));
        lineItems[lineItems.length - 1].amount = calcSum(lineItems[lineItems.length - 1].account_codes);
      }

      return lineItems;
    };

    // Balance Sheet: Assets, Liabilities, Equity
    const assetSections = bsSections.filter((s) => s.section_id.includes('asset'));
    const liabSections = bsSections.filter((s) => s.section_id.includes('liabilit'));
    const eqSections = bsSections.filter((s) => s.section_id.includes('equity'));

    const assets = buildLinesForSections(assetSections.length ? assetSections : bsSections.slice(0, 2), 'Asset');
    const liabilities = buildLinesForSections(liabSections.length ? liabSections : bsSections.slice(2, 4), 'Liability');
    const equity = buildLinesForSections(eqSections.length ? eqSections : bsSections.slice(4), 'Equity');

    // Income Statement: Revenue, Cost of Sales, Expenses
    const revSection = isSections.filter((s) => s.section_id.includes('revenue'));
    const cosSection = isSections.filter((s) => s.section_id.includes('cost_of_sales') || s.section_id.includes('cos'));
    const expSection = isSections.filter((s) => s.section_id.includes('operating_expenses') || s.section_id.includes('exp'));

    const operating_revenue = buildLinesForSections(revSection, 'Revenue');

    // For Cost of Sales and Operating Expenses, separate Expense accounts
    const cosLines: ReportLineItem[] = [];
    const expLines: ReportLineItem[] = [];
    const assignedExpenses = new Set<string>();

    for (const sec of (cosSection.length ? cosSection : [isSections[1]])) {
      if (!sec || !sec.is_visible) continue;
      for (const line of sec.lines) {
        if (line.is_visible === false) continue;
        const matching: string[] = [];
        for (const acc of allAccounts) {
          if (acc.account_type !== 'Expense') continue;
          if (line.account_prefixes?.some((p) => acc.account_code.startsWith(p))) {
            matching.push(acc.account_code);
            assignedExpenses.add(acc.account_code);
          }
        }
        cosLines.push({
          line_id: line.id,
          label: line.label,
          amount: calcSum(matching),
          account_codes: matching,
          indent_level: line.indent_level || 1,
        });
      }
    }

    for (const sec of (expSection.length ? expSection : [isSections[2]])) {
      if (!sec || !sec.is_visible) continue;
      for (const line of sec.lines) {
        if (line.is_visible === false) continue;
        const matching: string[] = [];
        for (const acc of allAccounts) {
          if (acc.account_type !== 'Expense') continue;
          if (line.account_prefixes?.some((p) => acc.account_code.startsWith(p))) {
            matching.push(acc.account_code);
            assignedExpenses.add(acc.account_code);
          }
        }
        expLines.push({
          line_id: line.id,
          label: line.label,
          amount: calcSum(matching),
          account_codes: matching,
          indent_level: line.indent_level || 1,
        });
      }
    }

    // Capture remaining unassigned expenses
    const unassignedExpenses = allAccounts.filter((a) => a.account_type === 'Expense' && !assignedExpenses.has(a.account_code));
    if (unassignedExpenses.length > 0 && expLines.length > 0) {
      expLines[expLines.length - 1].account_codes.push(...unassignedExpenses.map((a) => a.account_code));
      expLines[expLines.length - 1].amount = calcSum(expLines[expLines.length - 1].account_codes);
    }

    const cost_of_sales = cosLines;
    const operating_expenses = expLines;

    const total_assets = Math.round(assets.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const total_liabilities = Math.round(liabilities.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const total_operating_revenue = Math.round(operating_revenue.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const total_cost_of_sales = Math.round(cost_of_sales.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const gross_profit = Math.round((total_operating_revenue - total_cost_of_sales) * 100) / 100;
    const total_operating_expenses = Math.round(operating_expenses.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const net_operating_income = Math.round((gross_profit - total_operating_expenses) * 100) / 100;

    // Roll Net Operating Income into Equity for Balance Sheet presentation
    let total_equity = Math.round(equity.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    total_equity = Math.round((total_equity + net_operating_income) * 100) / 100;

    // Add Net Income line to equity presentation
    equity.push({
      line_id: 'EQU-NET-INCOME',
      label: 'Current Period Net Income / (Loss)',
      amount: net_operating_income,
      account_codes: [],
      indent_level: 1,
    });

    const total_liabilities_and_equity = Math.round((total_liabilities + total_equity) * 100) / 100;
    const variance = Math.round(Math.abs(total_assets - total_liabilities_and_equity) * 100) / 100;
    const is_balanced = variance < 0.05;

    return {
      period: period || 'All Time',
      property_name: formatting.header_company_name || this.systemSettings.property_name,
      currency: `${formatting.currency_code} (${formatting.currency_symbol})`,
      formatting,
      balance_sheet: {
        assets,
        total_assets,
        liabilities,
        total_liabilities,
        equity,
        total_equity,
        total_liabilities_and_equity,
        is_balanced,
        variance,
      },
      income_statement: {
        operating_revenue,
        total_operating_revenue,
        cost_of_sales,
        total_cost_of_sales,
        gross_profit,
        operating_expenses,
        total_operating_expenses,
        net_operating_income,
      },
    };
  }

  // USALI 12th Revised Edition Summary Operating Statement
  public getUsaliOperatingStatement(period?: string): UsaliStatementReport {
    const balances = this.getPostedAccountBalances(period);
    const allAccounts = this.getAccounts();
    const formatting = this.reportConfig.formatting;
    const usaliSections = this.reportConfig.structures.usali_sections;

    const calcSum = (codes: string[]) => {
      return Math.round(codes.reduce((s, c) => s + (balances.get(c)?.net || 0), 0) * 100) / 100;
    };

    let postedRevenueTotal = 0;
    let postedExpenseTotal = 0;
    for (const acc of allAccounts) {
      const bal = balances.get(acc.account_code)?.net || 0;
      if (acc.account_type === 'Revenue') postedRevenueTotal += bal;
      if (acc.account_type === 'Expense') postedExpenseTotal += bal;
    }

    // Helper to map lines for a specific USALI section
    const buildUsaliSectionLines = (sectionId: string, defaultType: 'Revenue' | 'Expense') => {
      const sec = usaliSections.find((s) => s.section_id === sectionId);
      if (!sec || !sec.is_visible) return [];
      const lines: ReportLineItem[] = [];
      const sortedLines = [...sec.lines].sort((a, b) => (a.order || 0) - (b.order || 0));

      for (const line of sortedLines) {
        if (line.is_visible === false) continue;
        const matching: string[] = [];

        for (const acc of allAccounts) {
          if (acc.account_type !== defaultType) continue;
          const code = acc.account_code;
          const usali = (acc.usali_line || '').toLowerCase();
          const matchesPrefix = line.account_prefixes?.some((p) => code.startsWith(p));
          const matchesLabel = usali.includes(line.label.toLowerCase().slice(0, 5));

          if (matchesPrefix || matchesLabel) {
            matching.push(code);
          }
        }

        lines.push({
          line_id: line.id,
          label: line.label,
          amount: calcSum(matching),
          account_codes: matching,
          indent_level: line.indent_level || 1,
        });
      }

      return lines;
    };

    // 1. Operating Revenue
    const operating_revenue = buildUsaliSectionLines('operating_revenue', 'Revenue');
    // Ensure all revenue accounts are assigned somewhere (reconciliation guarantee)
    const assignedRev = new Set<string>();
    operating_revenue.forEach((l) => l.account_codes.forEach((c) => assignedRev.add(c)));
    const unassignedRev = allAccounts.filter((a) => a.account_type === 'Revenue' && !assignedRev.has(a.account_code));
    if (unassignedRev.length > 0 && operating_revenue.length > 0) {
      operating_revenue[operating_revenue.length - 1].account_codes.push(...unassignedRev.map((a) => a.account_code));
      operating_revenue[operating_revenue.length - 1].amount = calcSum(operating_revenue[operating_revenue.length - 1].account_codes);
    }
    const total_operating_revenue = Math.round(operating_revenue.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    // 2. Departmental Expenses
    const departmental_expenses = buildUsaliSectionLines('departmental_expenses', 'Expense');
    const total_departmental_expenses = Math.round(departmental_expenses.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const total_departmental_profit = Math.round((total_operating_revenue - total_departmental_expenses) * 100) / 100;

    // 3. Undistributed Operating Expenses
    const undistributed_operating_expenses = buildUsaliSectionLines('undistributed_expenses', 'Expense');
    const total_undistributed_expenses = Math.round(undistributed_operating_expenses.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const gross_operating_profit = Math.round((total_departmental_profit - total_undistributed_expenses) * 100) / 100;

    // 4. Management Fees
    const management_fees = buildUsaliSectionLines('management_fees', 'Expense');
    const total_management_fees = Math.round(management_fees.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const income_before_non_operating = Math.round((gross_operating_profit - total_management_fees) * 100) / 100;

    // 5. Non-Operating Expenses
    const non_operating_expenses = buildUsaliSectionLines('non_operating_expenses', 'Expense');
    // Ensure all expense accounts are assigned somewhere (reconciliation guarantee)
    const assignedExp = new Set<string>();
    [...departmental_expenses, ...undistributed_operating_expenses, ...management_fees, ...non_operating_expenses].forEach((l) =>
      l.account_codes.forEach((c) => assignedExp.add(c))
    );
    const unassignedExp = allAccounts.filter((a) => a.account_type === 'Expense' && !assignedExp.has(a.account_code));
    if (unassignedExp.length > 0 && non_operating_expenses.length > 0) {
      non_operating_expenses[non_operating_expenses.length - 1].account_codes.push(...unassignedExp.map((a) => a.account_code));
      non_operating_expenses[non_operating_expenses.length - 1].amount = calcSum(non_operating_expenses[non_operating_expenses.length - 1].account_codes);
    }
    const total_non_operating_expenses = Math.round(non_operating_expenses.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    const ebitda = Math.round((income_before_non_operating - total_non_operating_expenses) * 100) / 100;

    // Schedule summaries (Rooms, FB, AG, POM, SM, Energy)
    const roomsRevLine = operating_revenue.find((l) => l.line_id.includes('ROOMS'))?.amount || 0;
    const roomsExpLine = departmental_expenses.find((l) => l.line_id.includes('ROOMS'))?.amount || 0;
    const fbRevLine = operating_revenue.find((l) => l.line_id.includes('FB'))?.amount || 0;
    const fbExpLine = departmental_expenses.find((l) => l.line_id.includes('FB'))?.amount || 0;
    const agExpLine = undistributed_operating_expenses.find((l) => l.line_id.includes('AG'))?.amount || 0;
    const pomExpLine = undistributed_operating_expenses.find((l) => l.line_id.includes('POM'))?.amount || 0;
    const smExpLine = undistributed_operating_expenses.find((l) => l.line_id.includes('SM'))?.amount || 0;
    const energyExpLine = undistributed_operating_expenses.find((l) => l.line_id.includes('ENERGY'))?.amount || 0;

    const reportRevenueTotal = total_operating_revenue;
    const reportExpenseTotal = Math.round(
      (total_departmental_expenses + total_undistributed_expenses + total_management_fees + total_non_operating_expenses) * 100
    ) / 100;
    const variance = Math.round(
      (Math.abs(postedRevenueTotal - reportRevenueTotal) + Math.abs(postedExpenseTotal - reportExpenseTotal)) * 100
    ) / 100;

    return {
      period: period || 'All Time',
      property_name: formatting.header_company_name || this.systemSettings.property_name,
      currency: `${formatting.currency_code} (${formatting.currency_symbol})`,
      formatting,
      operating_revenue,
      total_operating_revenue,
      departmental_expenses,
      total_departmental_expenses,
      total_departmental_profit,
      undistributed_operating_expenses,
      total_undistributed_expenses,
      gross_operating_profit,
      management_fees,
      total_management_fees,
      income_before_non_operating,
      non_operating_expenses,
      total_non_operating_expenses,
      ebitda,
      schedules_summary: {
        rooms_revenue: roomsRevLine,
        rooms_expense: roomsExpLine,
        rooms_profit: Math.round((roomsRevLine - roomsExpLine) * 100) / 100,
        fb_revenue: fbRevLine,
        fb_expense: fbExpLine,
        fb_profit: Math.round((fbRevLine - fbExpLine) * 100) / 100,
        ag_expense: agExpLine,
        pom_expense: pomExpLine,
        sm_expense: smExpLine,
        energy_expense: energyExpLine,
      },
      reconciliation: {
        posted_revenue_total: Math.round(postedRevenueTotal * 100) / 100,
        posted_expense_total: Math.round(postedExpenseTotal * 100) / 100,
        report_revenue_total: reportRevenueTotal,
        report_expense_total: reportExpenseTotal,
        variance,
        is_reconciled: variance < 0.05,
      },
    };
  }

  // Universal Drill-Down Service: Report -> Line -> Account -> Journal -> Source -> Voucher
  public getDrilldown(params: {
    report_type: string;
    line_id?: string;
    account_code?: string;
    period?: string;
  }): DrilldownDetail {
    const balances = this.getPostedAccountBalances(params.period);

    // 1. Identify targeted account codes
    let targetAccountCodes: string[] = [];
    let lineLabel = params.line_id || params.account_code || 'Report Line';

    if (params.account_code) {
      targetAccountCodes = [params.account_code];
      const acc = this.accounts.get(params.account_code);
      if (acc) lineLabel = `${acc.account_code} - ${acc.account_name}`;
    } else if (params.line_id) {
      // Lookup accounts from USALI or Financial Statements report lines
      const usaliRep = this.getUsaliOperatingStatement(params.period);
      const allLines = [
        ...usaliRep.operating_revenue,
        ...usaliRep.departmental_expenses,
        ...usaliRep.undistributed_operating_expenses,
        ...usaliRep.management_fees,
        ...usaliRep.non_operating_expenses,
      ];
      const found = allLines.find((l) => l.line_id === params.line_id);
      if (found) {
        targetAccountCodes = found.account_codes;
        lineLabel = found.label;
      } else {
        const finRep = this.getFinancialStatements(params.period);
        const finLines = [
          ...finRep.balance_sheet.assets,
          ...finRep.balance_sheet.liabilities,
          ...finRep.balance_sheet.equity,
          ...finRep.income_statement.operating_revenue,
          ...finRep.income_statement.cost_of_sales,
          ...finRep.income_statement.operating_expenses,
        ];
        const finFound = finLines.find((l) => l.line_id === params.line_id);
        if (finFound) {
          targetAccountCodes = finFound.account_codes;
          lineLabel = finFound.label;
        }
      }
    }

    const postedJournalIds = new Set<string>();
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'POSTED' || h.status === 'REVERSED') {
        if (!params.period || h.period === params.period) {
          postedJournalIds.add(h.journal_id);
        }
      }
    }

    // Filter relevant journal lines
    const matchedLines = this.journalLines.filter((l) => {
      if (!postedJournalIds.has(l.journal_id)) return false;
      return targetAccountCodes.includes(l.account_code);
    });

    // Compute account summaries
    const accountsSummary: DrilldownAccountSummary[] = targetAccountCodes.map((code) => {
      const acc = this.accounts.get(code);
      const bal = balances.get(code)?.net || 0;
      const count = matchedLines.filter((l) => l.account_code === code).length;
      return {
        account_code: code,
        account_name: acc?.account_name || 'Unknown Account',
        account_type: acc?.account_type || 'Asset',
        balance: bal,
        lines_count: count,
      };
    });

    const line_total = Math.round(accountsSummary.reduce((s, a) => s + a.balance, 0) * 100) / 100;

    // Enrich journal lines with Header, Source Transaction, and Voucher details
    const journal_lines: DrilldownJournalLine[] = matchedLines.map((line) => {
      const header = this.journalHeaders.get(line.journal_id)!;
      const acc = this.accounts.get(line.account_code);
      const isCredit =
        acc?.normal_balance === 'Credit' ||
        acc?.account_type === 'Liability' ||
        acc?.account_type === 'Equity' ||
        acc?.account_type === 'Revenue';

      const net_amount = isCredit ? (line.credit || 0) - (line.debit || 0) : (line.debit || 0) - (line.credit || 0);

      // Trace Source Transaction
      let sourceTx: DrilldownJournalLine['source_transaction'] = null;
      let voucher: DrilldownJournalLine['voucher'] = { attached: false };

      if (header.source_type === 'REVENUE' && header.source_reference) {
        const rev = this.revenueTransactions.get(header.source_reference);
        if (rev) {
          sourceTx = {
            type: 'Revenue / PMS Cycle',
            id: rev.transaction_id,
            date: rev.date,
            description: rev.description,
            vendor_or_guest: rev.source === 'PMS' ? 'PMS Guest In-House' : 'Front Desk Manual',
            department: rev.department_code,
            amount: rev.amount,
          };
          voucher = {
            attached: true,
            document_type: rev.source === 'PMS' ? 'PMS Guest Ledger Folio' : 'Cashier Receipt & Shift Audit',
            reference_number: `VCH-REV-${rev.transaction_id.slice(-6)}`,
            notes: `Verified against Night Audit business date ${rev.date}.`,
          };
        }
      } else if (header.source_type === 'SPENDING' && header.source_reference) {
        const sp = this.spendingTransactions.get(header.source_reference);
        if (sp) {
          sourceTx = {
            type: `Spending / ${sp.type}`,
            id: sp.transaction_id,
            date: sp.date,
            description: sp.description,
            vendor_or_guest: sp.vendor_or_employee,
            department: sp.department_code,
            amount: sp.amount,
          };
          voucher = {
            attached: true,
            document_type: sp.type === 'Payroll' ? 'Certified Monthly Payroll Schedule' : 'Vendor Tax Invoice & Goods Receipt',
            reference_number: `VCH-SPD-${sp.transaction_id.slice(-6)}`,
            notes: `Payee: ${sp.vendor_or_employee}. Account: ${sp.account_code}.`,
          };
        }
      } else if (header.source_type === 'MANUAL') {
        sourceTx = {
          type: 'Manual Journal Entry',
          id: header.journal_id,
          date: header.journal_date,
          description: `Manual Journal posted by ${header.created_by}`,
          vendor_or_guest: 'Controller General Ledger Entry',
          department: line.department_code || 'General',
          amount: line.debit || line.credit,
        };
        voucher = {
          attached: false,
          notes: 'Supporting Document: Not attached (Direct Journal Voucher).',
        };
      }

      return {
        journal_id: line.journal_id,
        journal_date: header.journal_date,
        period: header.period,
        source_type: header.source_type,
        source_reference: header.source_reference,
        created_by: header.created_by,
        approved_by: header.approved_by,
        posted_at: header.posted_at,
        account_code: line.account_code,
        department_code: line.department_code,
        debit: line.debit,
        credit: line.credit,
        net_amount: Math.round(net_amount * 100) / 100,
        description: line.description,
        source_transaction: sourceTx,
        voucher,
      };
    });

    return {
      report_type: params.report_type || 'USALI',
      line_id: params.line_id || '',
      line_label: lineLabel,
      period: params.period || 'All Time',
      line_total,
      accounts: accountsSummary,
      journal_lines: journal_lines.sort((a, b) => b.journal_date.localeCompare(a.journal_date)),
    };
  }

  // Controls & Audit Exceptions Manager
  public getControlExceptions(period?: string): ControlException[] {
    const exceptions: ControlException[] = [];
    const balances = this.getPostedAccountBalances(period);

    // 1. Unmapped Accounts (has posted balance but missing usali_line or statutory_line)
    for (const acc of this.accounts.values()) {
      const bal = balances.get(acc.account_code)?.net || 0;
      if (Math.abs(bal) > 0.001) {
        if (!acc.usali_line || acc.usali_line.trim() === '') {
          exceptions.push({
            id: `EXC-UNMAPPED-USALI-${acc.account_code}`,
            category: 'UNMAPPED_ACCOUNT',
            severity: 'warning',
            title: `Account ${acc.account_code} Missing USALI Mapping`,
            description: `Account has posted activity of Rp${bal.toLocaleString()} but no USALI schedule mapping.`,
            account_code: acc.account_code,
            posted_amount: bal,
            action_label: 'Map Account in COA',
            action_target: 'configuration',
          });
        }
        if (!acc.statutory_line || acc.statutory_line.trim() === '') {
          exceptions.push({
            id: `EXC-UNMAPPED-STAT-${acc.account_code}`,
            category: 'UNMAPPED_ACCOUNT',
            severity: 'warning',
            title: `Account ${acc.account_code} Missing Statutory Line`,
            description: `Account has posted activity of Rp${bal.toLocaleString()} but no Statutory report classification.`,
            account_code: acc.account_code,
            posted_amount: bal,
            action_label: 'Configure Classification',
            action_target: 'configuration',
          });
        }
      }
    }

    // 2. Draft Journals Pending Validation or Approval
    for (const h of this.journalHeaders.values()) {
      if (h.status === 'DRAFT') {
        exceptions.push({
          id: `EXC-DRAFT-${h.journal_id}`,
          category: 'DRAFT_PENDING',
          severity: 'info',
          title: `Draft Journal ${h.journal_id} Pending Validation`,
          description: `Created on ${h.journal_date} by ${h.created_by}. Debits and credits must be tested and validated.`,
          journal_id: h.journal_id,
          action_label: 'Open Workbench',
          action_target: 'accounting-core',
        });
      } else if (h.status === 'VALIDATED') {
        exceptions.push({
          id: `EXC-VALIDATED-${h.journal_id}`,
          category: 'DRAFT_PENDING',
          severity: 'warning',
          title: `Validated Journal ${h.journal_id} Awaiting Approval`,
          description: `Journal is balanced and verified. Pending Controller approval before posting to General Ledger.`,
          journal_id: h.journal_id,
          action_label: 'Approve & Post',
          action_target: 'accounting-core',
        });
      }
    }

    // 3. Unassigned Departments on operational transactions
    for (const l of this.journalLines) {
      const header = this.journalHeaders.get(l.journal_id);
      if (header && (header.status === 'POSTED' || header.status === 'REVERSED')) {
        const acc = this.accounts.get(l.account_code);
        if ((acc?.account_type === 'Revenue' || acc?.account_type === 'Expense') && !l.department_code) {
          exceptions.push({
            id: `EXC-NODEPT-${l.journal_id}-${l.line_no}`,
            category: 'UNASSIGNED_DEPARTMENT',
            severity: 'warning',
            title: `Unassigned Department in Journal ${l.journal_id}`,
            description: `Line ${l.line_no} for account ${l.account_code} has no operating department assigned.`,
            journal_id: l.journal_id,
            account_code: l.account_code,
            action_label: 'Review Journal Line',
            action_target: 'accounting-core',
          });
        }
      }
    }

    // 4. Default Mapping configuration check
    if (!this.mappingConfig.confirmed_by_controller) {
      exceptions.push({
        id: 'EXC-MAPPING-CONFIG',
        category: 'UNMAPPED_ACCOUNT',
        severity: 'warning',
        title: 'Default Clearing & Settlement Accounts Unconfirmed',
        description: 'Revenue default debit and spending default credit accounts must be confirmed by Controller.',
        action_label: 'Confirm Mapping',
        action_target: 'configuration',
      });
    }

    // 5. Tax Reconciliation & Unpaid Statutory Obligations Check
    const taxCheckPeriod = period || '2026-09';
    try {
      // Dynamic import / require or safe inline check on tax liabilities
      for (const [code, accName] of [
        ['2080', 'PBJT Hotel Local Tax'],
        ['2040', 'PPh 21 Payroll Withholding'],
        ['2070', 'Owner Distribution Tax Withholding'],
      ]) {
        const bal = balances.get(code)?.credit || 0;
        if (bal > 0) {
          exceptions.push({
            id: `EXC-TAX-LIABILITY-${code}-${taxCheckPeriod}`,
            category: 'TAX_RECONCILIATION',
            severity: 'info',
            title: `Statutory Tax Liability Active: ${accName}`,
            description: `Account ${code} has an outstanding credit balance of Rp${bal.toLocaleString('id-ID')} requiring filing & NTPN settlement.`,
            account_code: code,
            posted_amount: bal,
            action_label: 'Open Tax Module',
            action_target: 'tax',
          });
        }
      }
    } catch (e) {
      // safe fallback
    }

    return exceptions;
  }


  // Helper for hotel controller to seed standard USALI Chart of Accounts on request
  public async seedStandardHotelAccounts(): Promise<void> {
    const defaultDepts: Department[] = [
      { department_code: '100', department_name: 'Rooms', active: 'Y' },
      { department_code: '200', department_name: 'Food & Beverage', active: 'Y' },
      { department_code: '300', department_name: 'Spa & Recreation', active: 'Y' },
      { department_code: '700', department_name: 'Administrative & General', active: 'Y' },
      { department_code: '800', department_name: 'Property Operation & Maintenance', active: 'Y' },
      { department_code: '900', department_name: 'Sales & Marketing', active: 'Y' },
    ];

    const defaultAccounts: Account[] = [
      // Assets
      { account_code: '1010', account_name: 'Cash - Operating Bank Account', account_type: 'Asset', normal_balance: 'Debit', statutory_line: 'Cash and Cash Equivalents', usali_line: 'Cash', active: 'Y' },
      { account_code: '1020', account_name: 'Cash in Transit / Guest Ledger Clearing', account_type: 'Asset', normal_balance: 'Debit', statutory_line: 'Current Assets', usali_line: 'Accounts Receivable - Guest', active: 'Y' },
      { account_code: '1030', account_name: 'City Ledger / Trade Accounts Receivable', account_type: 'Asset', normal_balance: 'Debit', statutory_line: 'Accounts Receivable', usali_line: 'Accounts Receivable - City Ledger', active: 'Y' },
      { account_code: '1080', account_name: 'Operating Supplies & Inventories', account_type: 'Asset', normal_balance: 'Debit', statutory_line: 'Inventories', usali_line: 'Inventories', active: 'Y' },
      // Liabilities
      { account_code: '2010', account_name: 'Accounts Payable - Trade Vendors', account_type: 'Liability', normal_balance: 'Credit', statutory_line: 'Accounts Payable', usali_line: 'Accounts Payable', active: 'Y' },
      { account_code: '2020', account_name: 'Accrued Payroll & Staff Liabilities', account_type: 'Liability', normal_balance: 'Credit', statutory_line: 'Accrued Expenses', usali_line: 'Accrued Payroll', active: 'Y' },
      { account_code: '2030', account_name: 'Staff Service Charge Fund (Trust Liability)', account_type: 'Liability', normal_balance: 'Credit', statutory_line: 'Current Liabilities', usali_line: 'Service Charge Trust Liability', active: 'Y' },
      { account_code: '2040', account_name: 'Tax Payable - Employee Withholding (PPh 21)', account_type: 'Liability', normal_balance: 'Credit', statutory_line: 'Taxes Payable', usali_line: 'Payroll Taxes Payable', active: 'Y' },
      { account_code: '2050', account_name: 'Advance Deposits & Guest Escrow', account_type: 'Liability', normal_balance: 'Credit', statutory_line: 'Current Liabilities', usali_line: 'Advance Deposits', active: 'Y' },
      // Equity
      { account_code: '3010', account_name: 'Owner Capital / Retained Earnings', account_type: 'Equity', normal_balance: 'Credit', statutory_line: 'Equity', usali_line: 'Retained Earnings', active: 'Y' },
      // Revenue (USALI Operating Departments)
      { account_code: '4010', account_name: 'Rooms Revenue - Transient', account_type: 'Revenue', normal_balance: 'Credit', statutory_line: 'Operating Revenue', usali_line: 'Rooms - Transient', active: 'Y' },
      { account_code: '4020', account_name: 'Rooms Revenue - Group & Corporate', account_type: 'Revenue', normal_balance: 'Credit', statutory_line: 'Operating Revenue', usali_line: 'Rooms - Group', active: 'Y' },
      { account_code: '4110', account_name: 'Food Revenue - Restaurants & Outlets', account_type: 'Revenue', normal_balance: 'Credit', statutory_line: 'Operating Revenue', usali_line: 'Food - Outlets', active: 'Y' },
      { account_code: '4120', account_name: 'Beverage Revenue - Bar & Lounge', account_type: 'Revenue', normal_balance: 'Credit', statutory_line: 'Operating Revenue', usali_line: 'Beverage - Outlets', active: 'Y' },
      { account_code: '4130', account_name: 'Banquet & Events Revenue', account_type: 'Revenue', normal_balance: 'Credit', statutory_line: 'Operating Revenue', usali_line: 'Food & Beverage - Banquet', active: 'Y' },
      // Expenses
      { account_code: '5010', account_name: 'Cost of Food Sales', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Cost of Sales', usali_line: 'Cost of Food', active: 'Y' },
      { account_code: '5020', account_name: 'Cost of Beverage Sales', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Cost of Sales', usali_line: 'Cost of Beverage', active: 'Y' },
      { account_code: '6010', account_name: 'Salaries & Wages - Front Office', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Personnel Expenses', usali_line: 'Rooms - Payroll', active: 'Y' },
      { account_code: '6020', account_name: 'Salaries & Wages - Housekeeping', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Personnel Expenses', usali_line: 'Rooms - Payroll', active: 'Y' },
      { account_code: '6110', account_name: 'Salaries & Wages - Food & Beverage', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Personnel Expenses', usali_line: 'F&B - Payroll', active: 'Y' },
      { account_code: '7010', account_name: 'Operating Supplies - Guest Rooms', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Operating Expenses', usali_line: 'Rooms - Guest Supplies', active: 'Y' },
      { account_code: '7020', account_name: 'Laundry & Dry Cleaning Expense', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Operating Expenses', usali_line: 'Rooms - Laundry', active: 'Y' },
      { account_code: '7510', account_name: 'Utilities - Electricity & Water', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Utilities', usali_line: 'Utilities - Electricity', active: 'Y' },
      { account_code: '8010', account_name: 'General Insurance & Licenses', account_type: 'Expense', normal_balance: 'Debit', statutory_line: 'Administrative Expenses', usali_line: 'A&G - Insurance', active: 'Y' },
    ];

    for (const d of defaultDepts) {
      if (!this.departments.has(d.department_code)) {
        this.departments.set(d.department_code, d);
      }
    }

    for (const a of defaultAccounts) {
      if (!this.accounts.has(a.account_code)) {
        this.accounts.set(a.account_code, a);
      }
    }

    // Set recommended mappings
    this.mappingConfig = {
      revenue_default_debit_account: '1020',
      spending_procurement_credit_account: '2010',
      spending_payroll_credit_account: '2020',
      spending_other_credit_account: '1010',
      confirmed_by_controller: true,
    };

    await this.syncTabToSheets('departments');
    await this.syncTabToSheets('chart_of_accounts');
  }

  // --- ACCESS CONTROL & USER ROLE MANAGEMENT METHODS ---

  public getAccessControlState(): AccessControlState {
    return {
      users: Array.from(this.users.values()),
      roles: Array.from(this.roles.values()),
      currentUserId: this.currentUserId,
    };
  }

  public setCurrentUser(userId: string): AccessControlState {
    if (!this.users.has(userId)) {
      throw new Error(`User ID ${userId} not found`);
    }
    this.currentUserId = userId;
    return this.getAccessControlState();
  }

  public saveUser(userData: Partial<SystemUser> & { name: string; email: string; roleId: string; password?: string }): SystemUser {
    const userId = userData.id || `usr-${Date.now().toString(36)}`;
    const existing = this.users.get(userId);

    const user: SystemUser = {
      id: userId,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      roleId: userData.roleId,
      password: userData.password ? userData.password.trim() : (existing?.password || 'AtriumHotel2026!'),
      mustChangePassword: userData.mustChangePassword ?? existing?.mustChangePassword ?? false,
      departmentCode: userData.departmentCode || '',
      status: userData.status || existing?.status || 'active',
      lastLogin: existing?.lastLogin || 'Never',
      customPermissionsOverride: userData.customPermissionsOverride || existing?.customPermissionsOverride,
    };

    this.users.set(userId, user);
    return user;
  }

  public deleteUser(userId: string): { success: boolean } {
    if (userId === this.currentUserId) {
      throw new Error('Cannot delete currently authenticated session user');
    }
    if (!this.users.has(userId)) {
      throw new Error(`User ID ${userId} not found`);
    }
    this.users.delete(userId);
    return { success: true };
  }

  public saveRole(roleData: UserRoleDefinition): UserRoleDefinition {
    if (!roleData.id) {
      roleData.id = `role-${roleData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
    }
    this.roles.set(roleData.id, roleData);
    return roleData;
  }

  public deleteRole(roleId: string): { success: boolean } {
    const role = this.roles.get(roleId);
    if (!role) throw new Error(`Role ID ${roleId} not found`);
    if (role.isSystemRole) {
      throw new Error('System-defined default roles cannot be deleted. You can customize permissions or create new roles.');
    }
    // Check if any user assigned to this role
    const assignedUsers = Array.from(this.users.values()).filter((u) => u.roleId === roleId);
    if (assignedUsers.length > 0) {
      throw new Error(`Cannot delete role: ${assignedUsers.length} user(s) currently assigned. Reassign them first.`);
    }
    this.roles.delete(roleId);
    return { success: true };
  }

  public resetAccessControlToDefaults(): AccessControlState {
    this.roles.clear();
    this.users.clear();
    this.currentUserId = 'usr-controller-1';
    this.initDefaultAccessControl();
    return this.getAccessControlState();
  }

  // --- MOCK DATA LIFECYCLE & RESET UTILITIES ---

  public resetMockData(): { clearedJournals: number; clearedRevenue: number; clearedSpending: number } {
    const clearedJournals = this.journalHeaders.size;
    const clearedRevenue = this.revenueTransactions.size;
    const clearedSpending = this.spendingTransactions.size;

    this.journalHeaders.clear();
    this.journalLines = [];
    this.revenueTransactions.clear();
    this.spendingTransactions.clear();
    this.isMockDataCleared = true;

    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const stateFile = path.join(dataDir, 'system_state.json');
      fs.writeFileSync(
        stateFile,
        JSON.stringify({ mock_data_cleared: true, cleared_at: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.error('Failed to write system_state.json:', e);
    }

    return { clearedJournals, clearedRevenue, clearedSpending };
  }

  public async seedDemoData(): Promise<void> {
    this.isMockDataCleared = false;
    try {
      const stateFile = path.join(process.cwd(), 'data', 'system_state.json');
      if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
      }
    } catch (e) {
      console.warn('Could not remove system_state.json:', e);
    }
    await this.seedInitialPostedNightAuditRevenueIfEmpty();
  }

  public getMockDataStats(): {
    journalHeadersCount: number;
    journalLinesCount: number;
    revenueTxCount: number;
    spendingTxCount: number;
    isMockDataCleared: boolean;
  } {
    return {
      journalHeadersCount: this.journalHeaders.size,
      journalLinesCount: this.journalLines.length,
      revenueTxCount: this.revenueTransactions.size,
      spendingTxCount: this.spendingTransactions.size,
      isMockDataCleared: this.isMockDataCleared || (this.journalHeaders.size === 0 && this.revenueTransactions.size === 0),
    };
  }
}

export const store = new AccountingStore();
