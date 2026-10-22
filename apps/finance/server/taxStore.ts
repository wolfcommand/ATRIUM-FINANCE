/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  TaxTypeCode,
  TaxRuleConfig,
  TaxObligationItem,
  TaxPeriodSummaryKPIs,
  TaxReconciliationLine,
  TaxPeriodCloseValidation,
  TaxDocumentAttachment,
  TaxFilingStatus,
} from '../src/types';
import { store as accountingStore } from './store';
import { ownerPoolStore } from './ownerPoolStore';
import { serviceChargeStore } from './serviceChargeStore';

const TAX_DATA_FILE = path.join(process.cwd(), 'data', 'tax_module.json');

// Default initial Tax configurations (Indonesian Hotel & Hospitality Statutory Guidelines)
// Note: Rates are configurable by authorized users; calculations never guess if is_rate_configured is false.
export const DEFAULT_TAX_RULES: TaxRuleConfig[] = [
  {
    tax_code: 'PBJT_HOTEL',
    tax_name: 'PBJT Hotel (Local Hospitality & Accommodation Tax)',
    tax_category: 'LOCAL_TAX',
    tax_rate_pct: 10.0,
    is_rate_configured: true,
    tax_base_description: 'Gross Hotel Room & Food/Beverage Operating Revenue (Local District Tax, separate from PPN)',
    gl_liability_account: '2080',
    source_data_type: 'REVENUE',
    filing_due_day: 15,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Local regional government hospitality tax (Pajak Barang dan Jasa Tertentu). Handled as distinct local tax, not Coretax PPN.',
  },
  {
    tax_code: 'PPH_21',
    tax_name: 'PPh 21 (Employee Income & Payroll Withholding)',
    tax_category: 'NATIONAL_WHT',
    tax_rate_pct: 5.0, // Blended / progressive effective standard withholding
    is_rate_configured: true,
    tax_base_description: 'Total Operating Payroll & Staff Compensation Expenses (Acct 6010, 6020, 6110, 2020)',
    gl_liability_account: '2040',
    source_data_type: 'PAYROLL',
    filing_due_day: 20,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Monthly withholding tax deducted on staff wages, service charge payouts, and permanent hotel personnel.',
  },
  {
    tax_code: 'PPH_23',
    tax_name: 'PPh 23 (Vendor Services & Rental Withholding)',
    tax_category: 'NATIONAL_WHT',
    tax_rate_pct: 2.0,
    is_rate_configured: true,
    tax_base_description: 'Procurement of Services, Maintenance, and Technical Fees (AP Invoices / Acct 2010)',
    gl_liability_account: '2081',
    source_data_type: 'SPENDING_AP',
    filing_due_day: 20,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Withheld at 2% on domestic corporate vendor invoices for engineering, repairs, security, and consultancy.',
  },
  {
    tax_code: 'PPH_26',
    tax_name: 'PPh 26 (Non-Resident & Foreign Entity Withholding)',
    tax_category: 'NATIONAL_WHT',
    tax_rate_pct: 20.0,
    is_rate_configured: true,
    tax_base_description: 'Foreign Vendor Payments, Offshore Software Licenses & International Royalties',
    gl_liability_account: '2082',
    source_data_type: 'SPENDING_AP',
    filing_due_day: 20,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Withheld at 20% (or treaty DTA rate with COD Form DGT) on non-resident suppliers.',
  },
  {
    tax_code: 'PPH_FINAL_4_2',
    tax_name: 'PPh Final Pasal 4(2) (Land/Building Rent & Construction)',
    tax_category: 'NATIONAL_WHT',
    tax_rate_pct: 10.0,
    is_rate_configured: true,
    tax_base_description: 'Lease/Rent of Premises, Land, and Specific Construction Services',
    gl_liability_account: '2083',
    source_data_type: 'SPENDING_AP',
    filing_due_day: 20,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Final tax on building rental leases and qualified construction contractors.',
  },
  {
    tax_code: 'PPH_25',
    tax_name: 'PPh 25 (Monthly Corporate Income Tax Installment)',
    tax_category: 'CORPORATE_TAX',
    tax_rate_pct: 0.0, // Fixed monthly corporate installment set from prior year annual SPT
    is_rate_configured: false, // Must be configured by Controller
    tax_base_description: 'Prior Year Assessed Net Taxable Income / 12 (Direct Corporate Installment)',
    gl_liability_account: '2084',
    source_data_type: 'CORPORATE_P_L',
    filing_due_day: 20,
    payment_due_day: 15,
    active: 'Y',
    notes: 'Monthly corporate prepayment against year-end PPh Badan liability.',
  },
  {
    tax_code: 'PPH_BADAN',
    tax_name: 'PPh Badan (Annual Corporate Income Tax Provision)',
    tax_category: 'CORPORATE_TAX',
    tax_rate_pct: 22.0,
    is_rate_configured: true,
    tax_base_description: 'Net Operating Income / Taxable Profit before Corporate Tax',
    gl_liability_account: '2085',
    source_data_type: 'CORPORATE_P_L',
    filing_due_day: 30,
    payment_due_day: 28,
    active: 'Y',
    notes: 'Corporate tax provision computed on net operating profit (22% statutory corporate income tax rate).',
  },
  {
    tax_code: 'PPN',
    tax_name: 'PPN (Value Added Tax / Output VAT where applicable)',
    tax_category: 'VAT',
    tax_rate_pct: 11.0,
    is_rate_configured: true,
    tax_base_description: 'Non-PBJT Taxable Services & Goods (e.g. Commercial Retail Sub-Leases, Laundry Only)',
    gl_liability_account: '2086',
    source_data_type: 'REVENUE',
    filing_due_day: 30,
    payment_due_day: 30,
    active: 'Y',
    notes: 'Applies only to ancillary services not exempt under Local PBJT legislation.',
  },
  {
    tax_code: 'OWNER_TAX',
    tax_name: 'Owner Tax (PPh Final 4(2) / PPh 23 Withholding on Owner Distribution)',
    tax_category: 'OWNER_TAX',
    tax_rate_pct: 10.0, // Typically 10% for individual unit rental / 2% for corporate management
    is_rate_configured: true,
    tax_base_description: 'Gross Owner Pool Return Distribution (Direct link to Owner Pool Module)',
    gl_liability_account: '2070',
    source_data_type: 'OWNER_POOL',
    filing_due_day: 20,
    payment_due_day: 10,
    active: 'Y',
    notes: 'Connected seamlessly to the Owner Distribution Module. Pulls verified gross pool returns and applies withholding.',
  },
];

export class TaxStore {
  public rules: Map<TaxTypeCode, TaxRuleConfig> = new Map();
  public obligations: Map<string, TaxObligationItem> = new Map(); // key: period:tax_code
  public closedPeriods: Map<string, { closed_at: string; closed_by: string; notes?: string }> = new Map();

  constructor() {
    this.init();
  }

  public init(): void {
    // 1. Populate default rules
    DEFAULT_TAX_RULES.forEach((rule) => {
      this.rules.set(rule.tax_code, { ...rule });
    });

    // 2. Load disk cache if exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create data directory:', err);
      }
    }

    if (fs.existsSync(TAX_DATA_FILE)) {
      try {
        const raw = fs.readFileSync(TAX_DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed.rules)) {
          parsed.rules.forEach((r: TaxRuleConfig) => this.rules.set(r.tax_code, r));
        }

        if (Array.isArray(parsed.obligations)) {
          parsed.obligations.forEach((o: TaxObligationItem) => {
            const key = `${o.period}:${o.tax_code}`;
            this.obligations.set(key, o);
          });
        }

        if (Array.isArray(parsed.closedPeriods)) {
          parsed.closedPeriods.forEach((c: { period: string; closed_at: string; closed_by: string; notes?: string }) => {
            this.closedPeriods.set(c.period, c);
          });
        }
      } catch (e) {
        console.warn('Failed to parse tax data cache:', e);
      }
    }
  }

  public persist(): void {
    try {
      const data = {
        rules: Array.from(this.rules.values()),
        obligations: Array.from(this.obligations.values()),
        closedPeriods: Array.from(this.closedPeriods.entries()).map(([period, val]) => ({
          period,
          ...val,
        })),
      };
      fs.writeFileSync(TAX_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error persisting tax data:', e);
    }
  }

  // --- 1. TAX SETTINGS & RULES ---
  public getTaxRules(): TaxRuleConfig[] {
    return Array.from(this.rules.values());
  }

  public updateTaxRule(taxCode: TaxTypeCode, update: Partial<TaxRuleConfig>, updatedBy: string): TaxRuleConfig {
    const existing = this.rules.get(taxCode);
    if (!existing) {
      throw new Error(`Tax code ${taxCode} not found`);
    }

    const updated: TaxRuleConfig = {
      ...existing,
      ...update,
      tax_code: taxCode,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || 'Financial Controller',
    };

    if (typeof update.tax_rate_pct === 'number') {
      updated.is_rate_configured = true;
    }

    this.rules.set(taxCode, updated);
    this.persist();
    return updated;
  }

  public createTaxRule(newRule: Partial<TaxRuleConfig>, createdBy: string): TaxRuleConfig {
    if (!newRule.tax_code) {
      throw new Error('Tax code is required');
    }
    const code = newRule.tax_code.toUpperCase().replace(/\s+/g, '_') as TaxTypeCode;
    if (this.rules.has(code)) {
      throw new Error(`Tax rule with code ${code} already exists`);
    }

    const rule: TaxRuleConfig = {
      tax_code: code,
      tax_name: newRule.tax_name || code,
      tax_category: newRule.tax_category || 'NATIONAL_WHT',
      tax_rate_pct: typeof newRule.tax_rate_pct === 'number' ? newRule.tax_rate_pct : 0,
      is_rate_configured: typeof newRule.tax_rate_pct === 'number',
      tax_base_description: newRule.tax_base_description || 'General taxable base',
      gl_liability_account: newRule.gl_liability_account || '2080',
      source_data_type: newRule.source_data_type || 'SPENDING_AP',
      filing_due_day: newRule.filing_due_day || 20,
      payment_due_day: newRule.payment_due_day || 10,
      active: newRule.active || 'Y',
      notes: newRule.notes || '',
      updated_at: new Date().toISOString(),
      updated_by: createdBy || 'Financial Controller',
    };

    this.rules.set(code, rule);
    this.persist();
    return rule;
  }

  public deleteTaxRule(taxCode: string): { success: boolean; deletedCode: string } {
    const code = taxCode as TaxTypeCode;
    if (!this.rules.has(code)) {
      throw new Error(`Tax rule with code ${taxCode} not found`);
    }
    this.rules.delete(code);
    this.persist();
    return { success: true, deletedCode: taxCode };
  }

  // --- 2. SOURCE DATA RESOLUTION ENGINE (READS REAL ERP DATA ONLY) ---
  /**
   * Reads existing ERP data without duplication:
   * - PBJT Hotel: Posted Hotel Rooms + F&B revenue
   * - PPh 21: Operating payroll lines from Spending transactions and Payroll accounts
   * - PPh 23 / 26 / Final 4(2): Procurement spending records and AP balances
   * - PPh 25 / PPh Badan: Operating P&L profit calculation
   * - Owner Tax: Owner Distribution Batch gross return amount
   */
  public extractSourceDataForPeriod(period: string, taxCode: TaxTypeCode): {
    taxBase: number;
    transactionsCount: number;
    sourceReference: string;
    hasSourceData: boolean;
    ruleDescription: string;
    isConfigured: boolean;
  } {
    const rule = this.rules.get(taxCode);
    if (!rule) {
      return {
        taxBase: 0,
        transactionsCount: 0,
        sourceReference: 'Rule not found',
        hasSourceData: false,
        ruleDescription: 'Unrecognized tax type',
        isConfigured: false,
      };
    }

    if (!rule.is_rate_configured) {
      return {
        taxBase: 0,
        transactionsCount: 0,
        sourceReference: 'Tax rate not configured',
        hasSourceData: false,
        ruleDescription: 'Tax rate not configured.',
        isConfigured: false,
      };
    }

    switch (taxCode) {
      case 'PBJT_HOTEL': {
        // Read posted room revenue (accounts 4010, 4020) and F&B (4110, 4120, 4130)
        const journalHeaders = accountingStore.getJournals();
        const postedHeaders = journalHeaders.filter((h) => h.status === 'POSTED' && h.period === period);
        let totalRevenue = 0;
        let count = 0;

        for (const h of postedHeaders) {
          for (const l of h.lines) {
            if (['4010', '4020', '4110', '4120', '4130'].includes(l.account_code)) {
              totalRevenue += (l.credit || 0) - (l.debit || 0);
              count++;
            }
          }
        }

        // Also check unposted/posted revenue transactions table if journals not yet generated
        if (totalRevenue <= 0) {
          const revTxs = accountingStore.getRevenueTransactions().filter((r) => r.date.startsWith(period));
          for (const r of revTxs) {
            totalRevenue += r.amount;
            count++;
          }
        }

        const hasData = totalRevenue > 0;
        return {
          taxBase: Math.max(0, Math.round(totalRevenue * 100) / 100),
          transactionsCount: count,
          sourceReference: count > 0 ? `General Ledger Operating Revenue (${count} transactions)` : 'No source revenue found',
          hasSourceData: hasData,
          ruleDescription: `Local PBJT ${rule.tax_rate_pct}% on gross hotel room & F&B receipts`,
          isConfigured: true,
        };
      }

      case 'PPH_21': {
        // Read Payroll spending transactions or posted accounts 6010, 6020, 6110
        const spendings = accountingStore.getSpendingTransactions().filter((s) => s.type === 'Payroll' && s.date.startsWith(period));
        let totalPayroll = spendings.reduce((sum, s) => sum + s.amount, 0);
        let count = spendings.length;

        if (totalPayroll === 0) {
          // Check posted GL entries on payroll expense accounts
          const headers = accountingStore.getJournals().filter((h) => h.status === 'POSTED' && h.period === period);
          for (const h of headers) {
            for (const l of h.lines) {
              if (['6010', '6020', '6110'].includes(l.account_code)) {
                totalPayroll += (l.debit || 0) - (l.credit || 0);
                count++;
              }
            }
          }
        }

        return {
          taxBase: Math.max(0, Math.round(totalPayroll * 100) / 100),
          transactionsCount: count,
          sourceReference: count > 0 ? `Payroll Spending & Staff Journal (${count} records)` : 'No payroll records in period',
          hasSourceData: totalPayroll > 0,
          ruleDescription: `PPh 21 progressive withholding (effective base rate ${rule.tax_rate_pct}%) on staff compensation`,
          isConfigured: true,
        };
      }

      case 'PPH_23': {
        // Read Procurement spending lines marked for services or repair
        const spendings = accountingStore.getSpendingTransactions().filter(
          (s) => s.type === 'Procurement' && s.date.startsWith(period) && (
            s.description.toLowerCase().includes('service') ||
            s.description.toLowerCase().includes('maintenance') ||
            s.description.toLowerCase().includes('repair') ||
            s.description.toLowerCase().includes('jasa') ||
            s.account_code === '7020' ||
            s.account_code === '8010'
          )
        );
        const totalBase = spendings.reduce((sum, s) => sum + s.amount, 0);

        return {
          taxBase: Math.round(totalBase * 100) / 100,
          transactionsCount: spendings.length,
          sourceReference: spendings.length > 0 ? `AP Procurement Qualifying Services (${spendings.length} vouchers)` : 'No qualifying service AP invoices',
          hasSourceData: totalBase > 0,
          ruleDescription: `PPh 23 2% withholding on domestic vendor service invoices`,
          isConfigured: true,
        };
      }

      case 'PPH_26': {
        // Non-resident vendor procurement
        const spendings = accountingStore.getSpendingTransactions().filter(
          (s) => s.type === 'Procurement' && s.date.startsWith(period) && (
            s.description.toLowerCase().includes('foreign') ||
            s.description.toLowerCase().includes('overseas') ||
            s.description.toLowerCase().includes('international') ||
            s.description.toLowerCase().includes('offshore') ||
            s.description.toLowerCase().includes('royalty')
          )
        );
        const totalBase = spendings.reduce((sum, s) => sum + s.amount, 0);
        return {
          taxBase: Math.round(totalBase * 100) / 100,
          transactionsCount: spendings.length,
          sourceReference: spendings.length > 0 ? `Foreign Vendor Invoices (${spendings.length} records)` : 'No non-resident supplier transactions',
          hasSourceData: totalBase > 0,
          ruleDescription: `PPh 26 20% withholding on non-resident service/royalty fees`,
          isConfigured: true,
        };
      }

      case 'PPH_FINAL_4_2': {
        // Building/land rent and construction
        const spendings = accountingStore.getSpendingTransactions().filter(
          (s) => s.type === 'Procurement' && s.date.startsWith(period) && (
            s.description.toLowerCase().includes('rent') ||
            s.description.toLowerCase().includes('sewa') ||
            s.description.toLowerCase().includes('lease') ||
            s.description.toLowerCase().includes('construction') ||
            s.description.toLowerCase().includes('renovation')
          )
        );
        const totalBase = spendings.reduce((sum, s) => sum + s.amount, 0);
        return {
          taxBase: Math.round(totalBase * 100) / 100,
          transactionsCount: spendings.length,
          sourceReference: spendings.length > 0 ? `Lease & Construction Vouchers (${spendings.length} records)` : 'No rent/construction transactions in period',
          hasSourceData: totalBase > 0,
          ruleDescription: `PPh Final Pasal 4(2) 10% withholding on premises lease & contractors`,
          isConfigured: true,
        };
      }

      case 'PPH_25': {
        // Monthly Corporate Income Tax Installment (typically fixed monthly assessed installment)
        if (!rule.is_rate_configured || rule.tax_rate_pct <= 0) {
          return {
            taxBase: 0,
            transactionsCount: 0,
            sourceReference: 'Tax rate not configured',
            hasSourceData: false,
            ruleDescription: 'Tax rate not configured.',
            isConfigured: false,
          };
        }
        // Base is estimated from monthly operating profit if configured
        let netProfit = 0;
        try {
          const reports = accountingStore.getFinancialStatements(period);
          netProfit = Math.max(0, reports.income_statement.net_operating_income || 0);
        } catch {
          netProfit = 0;
        }
        return {
          taxBase: netProfit,
          transactionsCount: 1,
          sourceReference: `Corporate P&L Net Operating Income: Rp${netProfit.toLocaleString('id-ID')}`,
          hasSourceData: netProfit > 0,
          ruleDescription: `PPh 25 monthly corporate tax installment calculation`,
          isConfigured: true,
        };
      }

      case 'PPH_BADAN': {
        // Corporate Income Tax provision based on P&L Operating Profit
        let operatingProfit = 0;
        try {
          const reports = accountingStore.getFinancialStatements(period);
          operatingProfit = Math.max(0, reports.income_statement.net_operating_income || 0);
        } catch {
          operatingProfit = 0;
        }
        return {
          taxBase: operatingProfit,
          transactionsCount: 1,
          sourceReference: `Monthly Operating Net Profit (P&L): Rp${operatingProfit.toLocaleString('id-ID')}`,
          hasSourceData: operatingProfit > 0,
          ruleDescription: `PPh Badan corporate income tax provision (${rule.tax_rate_pct}% on monthly taxable income)`,
          isConfigured: true,
        };
      }

      case 'PPN': {
        // Value Added Tax (where applicable on non-PBJT items)
        const spendings = accountingStore.getSpendingTransactions().filter(
          (s) => s.date.startsWith(period) && (
            s.description.toLowerCase().includes('ppn') ||
            s.description.toLowerCase().includes('vat')
          )
        );
        const totalBase = spendings.reduce((sum, s) => sum + s.amount, 0);
        return {
          taxBase: Math.round(totalBase * 100) / 100,
          transactionsCount: spendings.length,
          sourceReference: spendings.length > 0 ? `Taxable Sales Receipts (${spendings.length} records)` : 'No non-PBJT VAT transactions recorded',
          hasSourceData: totalBase > 0,
          ruleDescription: `PPN Output VAT (${rule.tax_rate_pct}%) on ancillary supplies`,
          isConfigured: true,
        };
      }

      case 'OWNER_TAX': {
        // Directly connect to Owner Distribution module for the period
        const batch = ownerPoolStore.getBatchByPeriod(period);
        let grossReturn = 0;
        let taxWithheld = 0;
        let count = 0;

        if (batch) {
          grossReturn = batch.total_gross_return;
          taxWithheld = batch.total_tax_withholding;
          count = batch.lines.length;
        }

        return {
          taxBase: grossReturn,
          transactionsCount: count,
          sourceReference: batch
            ? `Owner Distribution Batch ${batch.batch_id} (${count} units, Status: ${batch.status})`
            : 'No Owner Pool Distribution calculated for this period',
          hasSourceData: grossReturn > 0,
          ruleDescription: `Owner Tax Withholding (Pasal 4(2) / PPh 23) calculated by Owner Pool Module`,
          isConfigured: true,
        };
      }

      default:
        return {
          taxBase: 0,
          transactionsCount: 0,
          sourceReference: 'No source data available',
          hasSourceData: false,
          ruleDescription: 'No source data available.',
          isConfigured: false,
        };
    }
  }

  // --- 3. TAX OBLIGATIONS & CALCULATION ---
  public getObligationsForPeriod(period: string): TaxObligationItem[] {
    const isClosed = this.closedPeriods.has(period);
    const result: TaxObligationItem[] = [];

    const periodYear = parseInt(period.split('-')[0], 10);
    const periodMonth = parseInt(period.split('-')[1], 10);
    const nextMonthYear = periodMonth === 12 ? periodYear + 1 : periodYear;
    const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
    const nextMonthStr = String(nextMonth).padStart(2, '0');

    for (const rule of this.rules.values()) {
      const key = `${period}:${rule.tax_code}`;
      let item = this.obligations.get(key);

      if (!item) {
        // Query live source data
        let source: {
          taxBase: number;
          transactionsCount: number;
          sourceReference: string;
          hasSourceData: boolean;
          ruleDescription: string;
          isConfigured: boolean;
        };
        try {
          source = this.extractSourceDataForPeriod(period, rule.tax_code);
        } catch (e: any) {
          source = {
            taxBase: 0,
            transactionsCount: 0,
            sourceReference: `Extraction notice: ${e.message}`,
            hasSourceData: false,
            ruleDescription: rule.tax_name,
            isConfigured: rule.is_rate_configured,
          };
        }

        const glAcc = accountingStore.getAccounts().find((a) => a.account_code === rule.gl_liability_account);

        const filingDueDate = `${nextMonthYear}-${nextMonthStr}-${String(rule.filing_due_day).padStart(2, '0')}`;
        const paymentDueDate = `${nextMonthYear}-${nextMonthStr}-${String(rule.payment_due_day).padStart(2, '0')}`;

        let taxAmount = 0;
        if (rule.is_rate_configured && source.hasSourceData) {
          taxAmount = Math.round(source.taxBase * (rule.tax_rate_pct / 100) * 100) / 100;
        }

        item = {
          id: `TAX-${period}-${rule.tax_code}`,
          period,
          tax_code: rule.tax_code,
          tax_name: rule.tax_name,
          tax_base: source.taxBase,
          tax_rate_pct: rule.tax_rate_pct,
          is_rate_configured: rule.is_rate_configured,
          tax_amount: taxAmount,
          paid_amount: 0,
          filing_due_date: filingDueDate,
          payment_due_date: paymentDueDate,
          status: isClosed ? 'Closed' : 'Draft',
          source_data_available: source.hasSourceData,
          source_data_type: rule.source_data_type,
          source_transactions_count: source.transactionsCount,
          source_reference: source.sourceReference,
          gl_account_code: rule.gl_liability_account,
          gl_account_name: glAcc ? glAcc.account_name : 'Tax Liability Account',
          rule_applied_description: source.ruleDescription,
          documents: [],
        };
        this.obligations.set(key, item);
      } else {
        // Ensure status reflects closed if period is closed
        if (isClosed && item.status !== 'Closed') {
          item.status = 'Closed';
        }
      }

      result.push(item);
    }

    return result;
  }

  public calculateObligation(period: string, taxCode: TaxTypeCode, user: string): TaxObligationItem {
    if (this.closedPeriods.has(period)) {
      throw new Error(`Period ${period} is closed and read-only. Cannot recalculate taxes.`);
    }

    const rule = this.rules.get(taxCode);
    if (!rule) throw new Error(`Tax code ${taxCode} not found`);

    if (!rule.is_rate_configured) {
      throw new Error('Tax rate not configured.');
    }

    const source = this.extractSourceDataForPeriod(period, taxCode);
    if (!source.hasSourceData) {
      throw new Error(`No source data available for ${rule.tax_name} in ${period}.`);
    }

    const key = `${period}:${taxCode}`;
    let item = this.obligations.get(key);
    const glAcc = accountingStore.getAccounts().find((a) => a.account_code === rule.gl_liability_account);

    const periodYear = parseInt(period.split('-')[0], 10);
    const periodMonth = parseInt(period.split('-')[1], 10);
    const nextMonthYear = periodMonth === 12 ? periodYear + 1 : periodYear;
    const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
    const nextMonthStr = String(nextMonth).padStart(2, '0');

    const filingDueDate = `${nextMonthYear}-${nextMonthStr}-${String(rule.filing_due_day).padStart(2, '0')}`;
    const paymentDueDate = `${nextMonthYear}-${nextMonthStr}-${String(rule.payment_due_day).padStart(2, '0')}`;

    let computedTaxAmount = 0;
    if (taxCode === 'OWNER_TAX') {
      const batch = ownerPoolStore.getBatchByPeriod(period);
      computedTaxAmount = batch ? batch.total_tax_withholding : Math.round(source.taxBase * (rule.tax_rate_pct / 100) * 100) / 100;
    } else {
      computedTaxAmount = Math.round(source.taxBase * (rule.tax_rate_pct / 100) * 100) / 100;
    }

    item = {
      ...(item || {
        id: `TAX-${period}-${taxCode}`,
        paid_amount: 0,
        documents: [],
      }),
      period,
      tax_code: taxCode,
      tax_name: rule.tax_name,
      tax_base: source.taxBase,
      tax_rate_pct: rule.tax_rate_pct,
      is_rate_configured: true,
      tax_amount: computedTaxAmount,
      paid_amount: item?.paid_amount || 0,
      filing_due_date: filingDueDate,
      payment_due_date: paymentDueDate,
      status: (item?.status === 'Draft' || !item?.status) ? 'Ready' : item.status,
      source_data_available: true,
      source_data_type: rule.source_data_type,
      source_transactions_count: source.transactionsCount,
      source_reference: source.sourceReference,
      gl_account_code: rule.gl_liability_account,
      gl_account_name: glAcc ? glAcc.account_name : 'Tax Liability Account',
      rule_applied_description: source.ruleDescription,
      calculation_timestamp: new Date().toISOString(),
      calculated_by: user || 'Financial Controller',
      documents: item?.documents || [],
    };

    this.obligations.set(key, item);
    this.persist();
    return item;
  }

  // --- 4. TAX FILING & PAYMENT RECORDING ---
  public recordPayment(params: {
    period: string;
    tax_code: TaxTypeCode;
    payment_date: string;
    ntpn_reference: string;
    amount: number;
    payment_bank_account?: string;
    user: string;
  }): TaxObligationItem {
    if (this.closedPeriods.has(params.period)) {
      throw new Error(`Period ${params.period} is closed. Cannot modify payment.`);
    }

    const key = `${params.period}:${params.tax_code}`;
    let item = this.obligations.get(key);
    if (!item) {
      item = this.calculateObligation(params.period, params.tax_code, params.user);
    }

    if (!params.payment_date) throw new Error('Payment date is required');
    if (!params.ntpn_reference || !params.ntpn_reference.trim()) {
      throw new Error('NTPN / Payment Reference is required');
    }
    if (params.amount <= 0) throw new Error('Payment amount must be greater than zero');

    item.payment_date = params.payment_date;
    item.ntpn_reference = params.ntpn_reference.trim().toUpperCase();
    item.paid_amount = params.amount;
    item.payment_bank_account = params.payment_bank_account || 'BCA Operating Account (1010)';

    if (item.status === 'Draft' || item.status === 'Ready') {
      item.status = 'Paid';
    }

    this.obligations.set(key, item);
    this.persist();
    return item;
  }

  public recordFiling(params: {
    period: string;
    tax_code: TaxTypeCode;
    filing_date: string;
    bpe_reference: string;
    user: string;
  }): TaxObligationItem {
    if (this.closedPeriods.has(params.period)) {
      throw new Error(`Period ${params.period} is closed. Cannot modify filing.`);
    }

    const key = `${params.period}:${params.tax_code}`;
    let item = this.obligations.get(key);
    if (!item) {
      item = this.calculateObligation(params.period, params.tax_code, params.user);
    }

    if (!params.filing_date) throw new Error('Filing date is required');
    if (!params.bpe_reference || !params.bpe_reference.trim()) {
      throw new Error('BPE / Filing Reference is required');
    }

    item.filing_date = params.filing_date;
    item.bpe_reference = params.bpe_reference.trim().toUpperCase();

    if (item.paid_amount >= item.tax_amount && item.tax_amount > 0) {
      item.status = 'Filed';
    } else if (item.status === 'Draft' || item.status === 'Ready') {
      item.status = 'Filed';
    }

    this.obligations.set(key, item);
    this.persist();
    return item;
  }

  // --- 5. ATTACH EVIDENCE / DOCUMENTS ---
  public attachDocument(params: {
    period: string;
    tax_code: TaxTypeCode;
    doc_type: TaxDocumentAttachment['doc_type'];
    file_name: string;
    file_url?: string;
    notes?: string;
    user: string;
  }): TaxDocumentAttachment {
    if (this.closedPeriods.has(params.period)) {
      throw new Error(`Period ${params.period} is closed. Cannot attach documents.`);
    }

    const key = `${params.period}:${params.tax_code}`;
    let item = this.obligations.get(key);
    if (!item) {
      item = this.calculateObligation(params.period, params.tax_code, params.user);
    }

    if (!params.file_name.trim()) throw new Error('File name or document title is required');

    const attachment: TaxDocumentAttachment = {
      id: `DOC-TAX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      obligation_id: item.id,
      doc_type: params.doc_type,
      file_name: params.file_name.trim(),
      file_url: params.file_url || '#',
      notes: params.notes,
      uploaded_at: new Date().toISOString(),
      uploaded_by: params.user || 'Financial Controller',
    };

    item.documents.push(attachment);
    this.obligations.set(key, item);
    this.persist();
    return attachment;
  }

  // --- 6. TAX RECONCILIATION ENGINE ---
  public getReconciliationForPeriod(period: string): TaxReconciliationLine[] {
    const obligations = this.getObligationsForPeriod(period);
    const result: TaxReconciliationLine[] = [];

    // Query real General Ledger account balances for each tax liability account
    const glBalances = accountingStore.getPostedAccountBalances(period);

    for (const ob of obligations) {
      // GL balance for the liability account (Credit normal balance)
      const glEntry = glBalances.get(ob.gl_account_code);
      const glBalance = glEntry ? Math.round(glEntry.credit * 100) / 100 : 0;

      const calcAmount = ob.tax_amount;
      const paidAmount = ob.paid_amount;
      const filedAmount = ob.bpe_reference ? (ob.paid_amount > 0 ? ob.paid_amount : ob.tax_amount) : 0;

      // In a reconciled state: Calculated === GL === Paid === Filed (or within 0.05 tolerance)
      const diff1 = Math.abs(calcAmount - glBalance);
      const diff2 = Math.abs(calcAmount - paidAmount);
      const diff3 = Math.abs(calcAmount - filedAmount);

      const maxDiff = Math.max(diff1, diff2, diff3);
      const isReconciled = ob.tax_amount === 0
        ? glBalance === 0
        : (calcAmount > 0 && paidAmount > 0 && filedAmount > 0 && maxDiff < 1.0);

      let discrepancyNote = '';
      if (!isReconciled) {
        const notes: string[] = [];
        if (Math.abs(calcAmount - glBalance) >= 1.0) {
          notes.push(`GL Variance: Rp${Math.abs(calcAmount - glBalance).toLocaleString('id-ID')} (Calculated Rp${calcAmount.toLocaleString('id-ID')} vs GL Rp${glBalance.toLocaleString('id-ID')})`);
        }
        if (calcAmount > 0 && paidAmount === 0) {
          notes.push(`Payment Pending: Rp${calcAmount.toLocaleString('id-ID')}`);
        } else if (Math.abs(calcAmount - paidAmount) >= 1.0 && paidAmount > 0) {
          notes.push(`Payment Variance: Under/Over by Rp${Math.abs(calcAmount - paidAmount).toLocaleString('id-ID')}`);
        }
        if (!ob.bpe_reference && calcAmount > 0) {
          notes.push('Filing reference (BPE) not yet registered');
        }
        discrepancyNote = notes.join('; ');
      }

      result.push({
        tax_code: ob.tax_code,
        tax_name: ob.tax_name,
        gl_account_code: ob.gl_account_code,
        gl_account_name: ob.gl_account_name,
        calculated_amount: calcAmount,
        gl_balance_amount: glBalance,
        paid_amount: paidAmount,
        filed_amount: filedAmount,
        difference_amount: Math.round(maxDiff * 100) / 100,
        status: isReconciled ? 'RECONCILED' : 'DIFFERENCE_FOUND',
        discrepancy_note: discrepancyNote,
      });
    }

    return result;
  }

  // --- 7. TAX DASHBOARD OVERVIEW KPIS ---
  public getPeriodSummaryKPIs(period: string): TaxPeriodSummaryKPIs {
    const obligations = this.getObligationsForPeriod(period);
    const isClosed = this.closedPeriods.has(period);
    const closedMeta = this.closedPeriods.get(period);

    // Sum payable, paid, outstanding
    let taxPayable = 0;
    let taxPaid = 0;
    let filingDueCount = 0;
    let overdueCount = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    let hasData = false;
    for (const ob of obligations) {
      if (ob.tax_base > 0 || ob.tax_amount > 0 || ob.paid_amount > 0) {
        hasData = true;
      }
      taxPayable += ob.tax_amount;
      taxPaid += ob.paid_amount;

      if (!ob.bpe_reference && ob.tax_amount > 0) {
        filingDueCount++;
        if (ob.filing_due_date < todayStr) {
          overdueCount++;
        }
      }
    }

    const taxOutstanding = Math.max(0, Math.round((taxPayable - taxPaid) * 100) / 100);

    return {
      period,
      has_data: hasData,
      tax_payable: Math.round(taxPayable * 100) / 100,
      tax_paid: Math.round(taxPaid * 100) / 100,
      tax_outstanding: taxOutstanding,
      filing_due_count: filingDueCount,
      overdue_count: overdueCount,
      is_period_closed: isClosed,
      closed_at: closedMeta?.closed_at,
      closed_by: closedMeta?.closed_by,
    };
  }

  // --- 8. PERIOD CLOSE VALIDATION & ACTION ---
  public validatePeriodClose(period: string): TaxPeriodCloseValidation {
    const obligations = this.getObligationsForPeriod(period);
    const missing: string[] = [];

    let allCalculated = true;
    let allPayments = true;
    let allFilings = true;
    let requiredEvidence = true;

    for (const ob of obligations) {
      if (ob.tax_base > 0 && ob.tax_amount === 0 && ob.is_rate_configured) {
        allCalculated = false;
        missing.push(`${ob.tax_name}: Tax calculation is pending.`);
      }

      if (ob.tax_amount > 0) {
        if (!ob.payment_date || !ob.ntpn_reference) {
          allPayments = false;
          missing.push(`${ob.tax_name}: Payment (Date & NTPN Reference) is missing.`);
        }

        if (!ob.filing_date || !ob.bpe_reference) {
          allFilings = false;
          missing.push(`${ob.tax_name}: Tax Filing (Date & BPE Reference) is missing.`);
        }

        if (!ob.documents || ob.documents.length === 0) {
          requiredEvidence = false;
          missing.push(`${ob.tax_name}: Supporting evidence (Bukti Potong, NTPN, or BPE document) is not attached.`);
        }
      }
    }

    const recons = this.getReconciliationForPeriod(period);
    const unreconciledItems = recons.filter((r) => r.status === 'DIFFERENCE_FOUND' && r.calculated_amount > 0);
    const allReconciled = unreconciledItems.length === 0;

    if (!allReconciled) {
      unreconciledItems.forEach((u) => {
        missing.push(`${u.tax_name}: Reconciliation difference found (${u.discrepancy_note || `Variance Rp${u.difference_amount.toLocaleString('id-ID')}`})`);
      });
    }

    const canClose = allCalculated && allPayments && allFilings && requiredEvidence && allReconciled;

    return {
      can_close: canClose,
      checks: {
        all_taxes_calculated: allCalculated,
        all_payments_recorded: allPayments,
        all_filings_recorded: allFilings,
        required_evidence_attached: requiredEvidence,
        all_reconciled: allReconciled,
      },
      missing_items: missing,
    };
  }

  public closePeriod(period: string, user: string, notes?: string): { success: boolean; period: string } {
    const validation = this.validatePeriodClose(period);
    if (!validation.can_close) {
      throw new Error(`Cannot close period ${period}. Missing requirements:\n- ` + validation.missing_items.join('\n- '));
    }

    this.closedPeriods.set(period, {
      closed_at: new Date().toISOString(),
      closed_by: user || 'Financial Controller',
      notes,
    });

    // Mark all obligations as Closed
    const obligations = this.getObligationsForPeriod(period);
    for (const ob of obligations) {
      ob.status = 'Closed';
      this.obligations.set(`${period}:${ob.tax_code}`, ob);
    }

    this.persist();
    return { success: true, period };
  }

  public reopenPeriod(period: string, user: string): { success: boolean; period: string } {
    if (!this.closedPeriods.has(period)) {
      throw new Error(`Period ${period} is not closed.`);
    }

    this.closedPeriods.delete(period);

    // Revert closed statuses
    const obligations = this.getObligationsForPeriod(period);
    for (const ob of obligations) {
      if (ob.status === 'Closed') {
        ob.status = ob.bpe_reference ? 'Filed' : (ob.paid_amount > 0 ? 'Paid' : 'Ready');
        this.obligations.set(`${period}:${ob.tax_code}`, ob);
      }
    }

    this.persist();
    return { success: true, period };
  }

  // --- MOCK DATA RESET ---
  public resetMockData(): { clearedObligations: number; clearedClosedPeriods: number } {
    const clearedObligations = this.obligations.size;
    const clearedClosedPeriods = this.closedPeriods.size;
    this.obligations.clear();
    this.closedPeriods.clear();
    this.persist();
    return { clearedObligations, clearedClosedPeriods };
  }
}

export const taxStore = new TaxStore();
