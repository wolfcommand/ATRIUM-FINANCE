import { store } from './store.js';
import { inventoryStore } from './inventoryStore.js';

export interface ARAgingItem {
  id: string;
  source: 'REVENUE_TX' | 'NIGHT_AUDIT' | 'MANUAL';
  transaction_id: string;
  journal_id: string;
  date: string;
  due_date: string;
  customer_name: string; // Guest name or Corporate / OTA account
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
  reference_id: string; // PO number or Spending TX id
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

class ARAPStore {
  // Persistence maps for manual payments/settlements on AR and AP items
  private arSettlements: Map<string, ARAgingItem['settlements']> = new Map();
  private apPayments: Map<string, APAgingItem['payments']> = new Map();

  // Helper to calculate days difference
  private calculateDaysOverdue(dueDateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  private determineAgingBucket(daysOverdue: number): ARAgingItem['aging_bucket'] {
    if (daysOverdue <= 0) return 'CURRENT';
    if (daysOverdue <= 30) return '1_30';
    if (daysOverdue <= 60) return '31_60';
    if (daysOverdue <= 90) return '61_90';
    return 'OVER_90';
  }

  // Add 30 days default terms if not provided
  private getDefaultDueDate(dateStr: string, termDays = 30): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + termDays);
    return d.toISOString().split('T')[0];
  }

  // -------------------------------------------------------------
  // AUTOMATIC AR (ACCOUNTS RECEIVABLE) ENGINE
  // Automatically synchronizes from Revenue Transactions & Posted Folio Journals
  // -------------------------------------------------------------
  public getARItems(): { items: ARAgingItem[]; summary: AgingSummary } {
    const revenueTxs = store.getRevenueTransactions();
    const items: ARAgingItem[] = [];

    // Parse all revenue transactions into AR items
    for (const tx of revenueTxs) {
      const id = `AR-${tx.transaction_id}`;
      const settlements = this.arSettlements.get(id) || [];
      const paidAmount = settlements.reduce((s, st) => s + st.amount, 0);
      const outstanding = Math.max(0, Math.round((tx.amount - paidAmount) * 100) / 100);

      const dueDate = this.getDefaultDueDate(tx.date, 30);
      const daysOverdue = this.calculateDaysOverdue(dueDate);
      const bucket = this.determineAgingBucket(daysOverdue);

      let custType: ARAgingItem['customer_type'] = 'GUEST_FOLIO';
      let customerName = 'Direct Hotel Guest';

      if (tx.description.toLowerCase().includes('ota') || tx.description.toLowerCase().includes('booking') || tx.description.toLowerCase().includes('agoda') || tx.description.toLowerCase().includes('expedia')) {
        custType = 'OTA_COLLECT';
        customerName = tx.description.split('-')[0].trim() || 'Online Travel Agent (OTA)';
      } else if (tx.description.toLowerCase().includes('group') || tx.description.toLowerCase().includes('corporate') || tx.description.toLowerCase().includes('company')) {
        custType = 'CITY_LEDGER_CORPORATE';
        customerName = tx.description.split('-')[1]?.trim() || 'Corporate City Ledger';
      } else if (tx.description.toLowerCase().includes('banquet') || tx.description.toLowerCase().includes('wedding')) {
        custType = 'BANQUET_CLIENT';
        customerName = 'Banquet & Event Client';
      } else if (tx.description.includes(':')) {
        customerName = tx.description.split(':')[1]?.trim() || tx.description;
      }

      const dept = store.departments.get(tx.department_code);

      const status: ARAgingItem['status'] =
        outstanding <= 0 ? 'SETTLED' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';

      items.push({
        id,
        source: tx.source === 'PMS' ? 'NIGHT_AUDIT' : 'REVENUE_TX',
        transaction_id: tx.transaction_id,
        journal_id: tx.journal_id,
        date: tx.date,
        due_date: dueDate,
        customer_name: customerName,
        customer_type: custType,
        department_code: tx.department_code,
        department_name: dept?.department_name || `Dept ${tx.department_code}`,
        account_code: tx.account_code,
        original_amount: tx.amount,
        paid_amount: paidAmount,
        outstanding_balance: outstanding,
        days_overdue: daysOverdue,
        aging_bucket: bucket,
        status,
        notes: tx.description,
        settlements,
      });
    }

    // Compute Aging Summary
    const summary: AgingSummary = {
      total_outstanding: 0,
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_over_90: 0,
      count: items.length,
    };

    for (const it of items) {
      if (it.status !== 'SETTLED') {
        summary.total_outstanding += it.outstanding_balance;
        if (it.aging_bucket === 'CURRENT') summary.current += it.outstanding_balance;
        else if (it.aging_bucket === '1_30') summary.bucket_1_30 += it.outstanding_balance;
        else if (it.aging_bucket === '31_60') summary.bucket_31_60 += it.outstanding_balance;
        else if (it.aging_bucket === '61_90') summary.bucket_61_90 += it.outstanding_balance;
        else summary.bucket_over_90 += it.outstanding_balance;
      }
    }

    // Round values
    summary.total_outstanding = Math.round(summary.total_outstanding * 100) / 100;
    summary.current = Math.round(summary.current * 100) / 100;
    summary.bucket_1_30 = Math.round(summary.bucket_1_30 * 100) / 100;
    summary.bucket_31_60 = Math.round(summary.bucket_31_60 * 100) / 100;
    summary.bucket_61_90 = Math.round(summary.bucket_61_90 * 100) / 100;
    summary.bucket_over_90 = Math.round(summary.bucket_over_90 * 100) / 100;

    return { items, summary };
  }

  // Record an incoming AR Customer payment / folio settlement
  public async recordARSettlement(params: {
    ar_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    bank_account_code: string;
    reference: string;
    userName?: string;
  }): Promise<{ settlement_id: string; journal_id: string }> {
    const { items } = this.getARItems();
    const item = items.find((i) => i.id === params.ar_id);
    if (!item) throw new Error(`AR Item ${params.ar_id} not found.`);
    if (params.amount <= 0) throw new Error('Settlement amount must be greater than zero.');
    if (params.amount > item.outstanding_balance) {
      throw new Error(`Payment amount IDR ${params.amount.toLocaleString()} exceeds outstanding balance IDR ${item.outstanding_balance.toLocaleString()}.`);
    }

    const settlementId = `SETTLE-${Date.now().toString(36).toUpperCase()}`;
    const journalId = `JRN-AR-${settlementId.substring(7)}`;

    // Debit Bank/Cash (Asset Increase), Credit AR / Guest Ledger / City Ledger (Asset Decrease)
    const journal = await store.createJournal(
      {
        journal_id: journalId,
        journal_date: params.payment_date,
        period: params.payment_date.substring(0, 7),
        source_type: 'AR_SETTLEMENT',
        source_reference: params.ar_id,
        created_by: params.userName || 'AR Credit & Collections Specialist',
      },
      [
        {
          account_code: params.bank_account_code || '1010', // Operating Bank Account
          department_code: item.department_code,
          debit: params.amount,
          credit: 0,
          description: `AR Receipt / Settlement from ${item.customer_name} [Ref: ${params.reference || 'Bank Transfer'}]`,
        },
        {
          account_code: '1020', // Guest Ledger / Accounts Receivable City Ledger
          department_code: item.department_code,
          debit: 0,
          credit: params.amount,
          description: `Clear AR Folio / Invoice for ${item.customer_name} (${item.transaction_id})`,
        },
      ]
    );

    // Auto-approve journal
    await store.postJournal(journalId, { autoApprove: true, approver: params.userName || 'AR Controller' });

    // Save settlement
    const currentSettlements = this.arSettlements.get(params.ar_id) || [];
    currentSettlements.push({
      settlement_id: settlementId,
      date: params.payment_date,
      amount: params.amount,
      payment_method: params.payment_method,
      reference: params.reference,
      journal_id: journalId,
    });
    this.arSettlements.set(params.ar_id, currentSettlements);

    return { settlement_id: settlementId, journal_id: journalId };
  }

  // -------------------------------------------------------------
  // AUTOMATIC AP (ACCOUNTS PAYABLE) ENGINE
  // Automatically feeds from Purchase Orders (Procurement) & Spending Transactions
  // -------------------------------------------------------------
  public getAPItems(): { items: APAgingItem[]; summary: AgingSummary } {
    const items: APAgingItem[] = [];

    // 1. Ingest all approved & active Purchase Orders from Procurement
    const purchaseOrders = inventoryStore.getPurchaseOrders();
    for (const po of purchaseOrders) {
      // Exclude draft or cancelled POs
      if (po.status === 'CANCELLED') continue;

      const id = `AP-PO-${po.po_number}`;
      const payments = this.apPayments.get(id) || [];
      const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
      const outstanding = Math.max(0, Math.round((po.total_amount - paidAmount) * 100) / 100);

      // Parse payment terms to determine due date
      let termDays = 30;
      if (po.payment_terms?.includes('14')) termDays = 14;
      else if (po.payment_terms?.includes('60')) termDays = 60;
      else if (po.payment_terms?.toLowerCase().includes('cod')) termDays = 0;

      const dueDate = po.expected_delivery_date || this.getDefaultDueDate(po.order_date, termDays);
      const daysOverdue = this.calculateDaysOverdue(dueDate);
      const bucket = this.determineAgingBucket(daysOverdue);

      const status: APAgingItem['status'] =
        outstanding <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';

      items.push({
        id,
        source: 'PURCHASE_ORDER',
        reference_id: po.po_number,
        journal_id: po.journal_id,
        date: po.order_date,
        due_date: dueDate,
        vendor_name: po.supplier_name,
        vendor_contact: po.supplier_contact || po.supplier_email,
        department_code: po.department_code,
        department_name: po.department_name,
        account_code: '2010', // Trade Accounts Payable
        original_amount: po.total_amount,
        paid_amount: paidAmount,
        outstanding_balance: outstanding,
        days_overdue: daysOverdue,
        aging_bucket: bucket,
        status,
        payment_terms: po.payment_terms || 'Net 30 Days',
        notes: `PO: ${po.items.map((it) => it.item_name).join(', ')} (${po.items.length} items)`,
        payments,
      });
    }

    // 2. Ingest Spending Transactions of type 'Procurement' or operational bills
    const spendingTxs = store.getSpendingTransactions();
    for (const sp of spendingTxs) {
      if (sp.type === 'Procurement' || sp.type === 'Other') {
        const id = `AP-SPD-${sp.transaction_id}`;
        const payments = this.apPayments.get(id) || [];
        const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
        const outstanding = Math.max(0, Math.round((sp.amount - paidAmount) * 100) / 100);

        const dueDate = this.getDefaultDueDate(sp.date, 30);
        const daysOverdue = this.calculateDaysOverdue(dueDate);
        const bucket = this.determineAgingBucket(daysOverdue);

        const dept = store.departments.get(sp.department_code);
        const status: APAgingItem['status'] =
          outstanding <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';

        items.push({
          id,
          source: 'SPENDING_TX',
          reference_id: sp.transaction_id,
          journal_id: sp.journal_id,
          date: sp.date,
          due_date: dueDate,
          vendor_name: sp.vendor_or_employee,
          department_code: sp.department_code,
          department_name: dept?.department_name || `Dept ${sp.department_code}`,
          account_code: '2010',
          original_amount: sp.amount,
          paid_amount: paidAmount,
          outstanding_balance: outstanding,
          days_overdue: daysOverdue,
          aging_bucket: bucket,
          status,
          payment_terms: 'Net 30 Days',
          notes: sp.description,
          payments,
        });
      }
    }

    // Compute AP Aging Summary
    const summary: AgingSummary = {
      total_outstanding: 0,
      current: 0,
      bucket_1_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_over_90: 0,
      count: items.length,
    };

    for (const it of items) {
      if (it.status !== 'PAID') {
        summary.total_outstanding += it.outstanding_balance;
        if (it.aging_bucket === 'CURRENT') summary.current += it.outstanding_balance;
        else if (it.aging_bucket === '1_30') summary.bucket_1_30 += it.outstanding_balance;
        else if (it.aging_bucket === '31_60') summary.bucket_31_60 += it.outstanding_balance;
        else if (it.aging_bucket === '61_90') summary.bucket_61_90 += it.outstanding_balance;
        else summary.bucket_over_90 += it.outstanding_balance;
      }
    }

    // Round values
    summary.total_outstanding = Math.round(summary.total_outstanding * 100) / 100;
    summary.current = Math.round(summary.current * 100) / 100;
    summary.bucket_1_30 = Math.round(summary.bucket_1_30 * 100) / 100;
    summary.bucket_31_60 = Math.round(summary.bucket_31_60 * 100) / 100;
    summary.bucket_61_90 = Math.round(summary.bucket_61_90 * 100) / 100;
    summary.bucket_over_90 = Math.round(summary.bucket_over_90 * 100) / 100;

    return { items, summary };
  }

  // Record an outgoing AP Vendor payment & automatically create GL double entry journal
  public async recordAPPayment(params: {
    ap_id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    bank_account_code: string;
    reference: string;
    userName?: string;
  }): Promise<{ payment_id: string; journal_id: string }> {
    const { items } = this.getAPItems();
    const item = items.find((i) => i.id === params.ap_id);
    if (!item) throw new Error(`AP Item ${params.ap_id} not found.`);
    if (params.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (params.amount > item.outstanding_balance) {
      throw new Error(`Payment amount IDR ${params.amount.toLocaleString()} exceeds outstanding payable IDR ${item.outstanding_balance.toLocaleString()}.`);
    }

    const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}`;
    const journalId = `JRN-AP-${paymentId.substring(4)}`;

    // Debit Accounts Payable (Liability Decrease), Credit Bank Account (Asset Decrease)
    const journal = await store.createJournal(
      {
        journal_id: journalId,
        journal_date: params.payment_date,
        period: params.payment_date.substring(0, 7),
        source_type: 'AP_PAYMENT',
        source_reference: item.reference_id,
        created_by: params.userName || 'AP Disbursement Specialist',
      },
      [
        {
          account_code: '2010', // Accounts Payable (Debit to reduce liability)
          department_code: item.department_code,
          debit: params.amount,
          credit: 0,
          description: `Disbursement to Vendor ${item.vendor_name} for [${item.reference_id}]`,
        },
        {
          account_code: params.bank_account_code || '1010', // Operating Bank (Credit to reduce cash)
          department_code: item.department_code,
          debit: 0,
          credit: params.amount,
          description: `Bank Transfer / Cheque to ${item.vendor_name} [Ref: ${params.reference || 'Bank Payout'}]`,
        },
      ]
    );

    // Auto-approve journal to post to GL
    await store.postJournal(journalId, { autoApprove: true, approver: params.userName || 'Financial Controller' });

    // Save payment
    const currentPayments = this.apPayments.get(params.ap_id) || [];
    currentPayments.push({
      payment_id: paymentId,
      date: params.payment_date,
      amount: params.amount,
      payment_method: params.payment_method,
      bank_account_code: params.bank_account_code || '1010',
      reference: params.reference,
      journal_id: journalId,
    });
    this.apPayments.set(params.ap_id, currentPayments);

    return { payment_id: paymentId, journal_id: journalId };
  }

  // --- MOCK DATA RESET ---
  public resetMockData(): { clearedARPayments: number; clearedAPPayments: number } {
    const clearedARPayments = this.arSettlements.size;
    const clearedAPPayments = this.apPayments.size;
    this.arSettlements.clear();
    this.apPayments.clear();
    return { clearedARPayments, clearedAPPayments };
  }
}

export const arapStore = new ARAPStore();
