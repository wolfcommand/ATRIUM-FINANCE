/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  PettyCashTransaction,
  PettyCashFloatConfig,
  PettyCashBalanceSummary,
  PettyCashReplenishmentClaim,
  PettyCashExpenseCategory,
} from '../src/types';
import { store as accountingStore } from './store';

const DATA_FILE = path.join(process.cwd(), 'data', 'petty_cash.json');

const DEFAULT_CONFIG: PettyCashFloatConfig = {
  account_name: 'Kas Kecil Operasional Atrium',
  gl_account_code: '1010', // Petty Cash / Cash on Hand
  bank_replenishment_account: '1020', // Bank Mandiri Operasional
  float_limit: 10000000, // Rp 10.000.000 plafon tetap
  low_balance_threshold: 2500000, // Rp 2.500.000
  updated_at: '2024-01-01T00:00:00.000Z',
};

// SVG data URLs for sample receipts so the user can immediately test image viewing
const SAMPLE_RECEIPT_HERBS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500" fill="%23fff"><rect width="100%" height="100%" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="50%" y="40" font-family="monospace" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">PASAR SEGAR BALI - UMA BLU</text><text x="50%" y="65" font-family="monospace" font-size="11" fill="%2364748b" text-anchor="middle">NOTA PEMBELIAN CASH / BUMBU DAPUR</text><line x1="30" y1="85" x2="370" y2="85" stroke="%2394a3b8" stroke-dasharray="4"/><text x="30" y="115" font-family="monospace" font-size="12" fill="%23334155">Tanggal: 14 Okt 2026</text><text x="30" y="135" font-family="monospace" font-size="12" fill="%23334155">No: STR-2026/10/89</text><text x="30" y="170" font-family="monospace" font-size="13" font-weight="bold" fill="%230f172a">ITEM PEMBELIAN:</text><text x="30" y="200" font-family="monospace" font-size="12" fill="%23334155">1. Daun Basil & Mint Segar (2kg)</text><text x="370" y="200" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 120.000</text><text x="30" y="225" font-family="monospace" font-size="12" fill="%23334155">2. Jeruk Nipis Lokal (5kg)</text><text x="370" y="225" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 150.000</text><text x="30" y="250" font-family="monospace" font-size="12" fill="%23334155">3. Es Batu Kristal Darurat (10 bag)</text><text x="370" y="250" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 180.000</text><line x1="30" y1="280" x2="370" y2="280" stroke="%2394a3b8"/><text x="30" y="310" font-family="monospace" font-size="14" font-weight="bold" fill="%230f172a">TOTAL CASH:</text><text x="370" y="310" font-family="monospace" font-size="14" font-weight="bold" fill="%23059669" text-anchor="end">Rp 450.000</text><rect x="30" y="350" width="340" height="70" fill="%23ecfdf5" rx="6" stroke="%2310b981"/><text x="50%" y="380" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23065f46" text-anchor="middle">LUNAS - KAS KECIL OPERASIONAL</text><text x="50%" y="402" font-family="monospace" font-size="10" fill="%23047857" text-anchor="middle">Chef Pastry: Made Wardana</text></svg>`;

const SAMPLE_RECEIPT_STATIONERY = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500" fill="%23fff"><rect width="100%" height="100%" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><text x="50%" y="40" font-family="monospace" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">TOKO BUKU &amp; ATK JAYA</text><text x="50%" y="65" font-family="monospace" font-size="11" fill="%2364748b" text-anchor="middle">KWITANSI RESMI PENGELUARAN KANTOR</text><line x1="30" y1="85" x2="370" y2="85" stroke="%2394a3b8" stroke-dasharray="4"/><text x="30" y="115" font-family="monospace" font-size="12" fill="%23334155">Tanggal: 12 Okt 2026</text><text x="30" y="135" font-family="monospace" font-size="12" fill="%23334155">Untuk: PT Atrium Management Group</text><text x="30" y="170" font-family="monospace" font-size="13" font-weight="bold" fill="%230f172a">RINCIAN:</text><text x="30" y="200" font-family="monospace" font-size="12" fill="%23334155">1. Kertas HVS A4 80gr (3 Rim)</text><text x="370" y="200" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 175.000</text><text x="30" y="225" font-family="monospace" font-size="12" fill="%23334155">2. Materai Tempel 10.000 (10 lbr)</text><text x="370" y="225" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 110.000</text><text x="30" y="250" font-family="monospace" font-size="12" fill="%23334155">3. Map Gantung &amp; Binder Folio</text><text x="370" y="250" font-family="monospace" font-size="12" fill="%23334155" text-anchor="end">Rp 95.000</text><line x1="30" y1="280" x2="370" y2="280" stroke="%2394a3b8"/><text x="30" y="310" font-family="monospace" font-size="14" font-weight="bold" fill="%230f172a">JUMLAH:</text><text x="370" y="310" font-family="monospace" font-size="14" font-weight="bold" fill="%23059669" text-anchor="end">Rp 380.000</text><rect x="30" y="350" width="340" height="70" fill="%23f1f5f9" rx="6" stroke="%2394a3b8"/><text x="50%" y="380" font-family="sans-serif" font-size="12" font-weight="bold" fill="%23334155" text-anchor="middle">PEMBAYARAN LUNAS</text><text x="50%" y="402" font-family="monospace" font-size="10" fill="%2364748b" text-anchor="middle">Diterima oleh Kasir ATK</text></svg>`;

export class PettyCashStore {
  private config: PettyCashFloatConfig = { ...DEFAULT_CONFIG };
  private transactions: Map<string, PettyCashTransaction> = new Map();
  private claims: Map<string, PettyCashReplenishmentClaim> = new Map();

  constructor() {
    this.init();
  }

  public init(): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create data directory:', e);
      }
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.config) this.config = parsed.config;
        if (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
          parsed.transactions.forEach((tx: PettyCashTransaction) => this.transactions.set(tx.id, tx));
        } else {
          this.seedDefaults();
        }
        if (Array.isArray(parsed.claims)) {
          parsed.claims.forEach((c: PettyCashReplenishmentClaim) => this.claims.set(c.claim_id, c));
        }
      } catch (e) {
        console.error('Failed to parse data/petty_cash.json, seeding defaults:', e);
        this.seedDefaults();
      }
    } else {
      this.seedDefaults();
    }
  }

  private saveToDisk(): void {
    try {
      const payload = {
        config: this.config,
        transactions: Array.from(this.transactions.values()),
        claims: Array.from(this.claims.values()),
        saved_at: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving data/petty_cash.json:', e);
    }
  }

  private seedDefaults(): void {
    this.transactions.clear();
    const defaults: PettyCashTransaction[] = [
      {
        id: 'PCV-2026-001',
        voucher_number: 'PCV-2026-001',
        date: '2026-10-14',
        category: 'KITCHEN_EMERGENCY',
        category_label: 'Kitchen & Bar Emergency Herbs',
        department_code: '200',
        department_name: 'Food & Beverage (Uma Blu)',
        account_code: '5210',
        account_name: 'Food & Beverage Operating Supplies',
        amount: 450000,
        paid_to: 'Pasar Segar Bali - Bumbu Dapur',
        description: 'Pembelian darurat daun basil segar, jeruk nipis & es batu kristal untuk operasional Uma Blu Restaurant',
        receipt_image_url: SAMPLE_RECEIPT_HERBS,
        receipt_filename: 'nota-bumbu-pasar-14okt.svg',
        status: 'PENDING_REIMBURSEMENT',
        created_by: 'Made Wardana (Chef Uma Blu)',
        created_at: '2026-10-14T09:30:00.000Z',
      },
      {
        id: 'PCV-2026-002',
        voucher_number: 'PCV-2026-002',
        date: '2026-10-12',
        category: 'OFFICE_STATIONERY_ADMIN',
        category_label: 'Office Stationery & Legal Stamp',
        department_code: '500',
        department_name: 'Admin & General',
        account_code: '6310',
        account_name: 'Printing & Stationery Expense',
        amount: 380000,
        paid_to: 'Toko Buku & ATK Jaya',
        description: 'Kertas HVS A4 80gr (3 rim) dan Materai 10.000 (10 lembar) untuk kontrak legal owner condotel',
        receipt_image_url: SAMPLE_RECEIPT_STATIONERY,
        receipt_filename: 'nota-atk-materai-12okt.svg',
        status: 'PENDING_REIMBURSEMENT',
        created_by: 'Siti Rahma (Admin Staff)',
        created_at: '2026-10-12T14:15:00.000Z',
      },
      {
        id: 'PCV-2026-003',
        voucher_number: 'PCV-2026-003',
        date: '2026-10-10',
        category: 'ENGINEERING_MAINTENANCE',
        category_label: 'Urgent Maintenance Sealant',
        department_code: '600',
        department_name: 'Property Maintenance & Engineering',
        account_code: '6420',
        account_name: 'Maintenance Supplies & Small Hardware',
        amount: 220000,
        paid_to: 'UD Mitra Bangunan Sanur',
        description: 'Sealant anti-bocor & klem pipa darurat untuk perbaikan unit 304 kamar mandi',
        status: 'PENDING_REIMBURSEMENT',
        created_by: 'Wayan Suarjana (Engineering)',
        created_at: '2026-10-10T11:00:00.000Z',
      },
    ];

    defaults.forEach((tx) => this.transactions.set(tx.id, tx));
    this.saveToDisk();
  }

  // --- GETTERS & SUMMARY ---

  public getConfig(): PettyCashFloatConfig {
    return this.config;
  }

  public updateConfig(newConfig: Partial<PettyCashFloatConfig>): PettyCashFloatConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      updated_at: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.config;
  }

  public getTransactions(): PettyCashTransaction[] {
    return Array.from(this.transactions.values()).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  public getBalanceSummary(): PettyCashBalanceSummary {
    const all = Array.from(this.transactions.values());
    const pending = all.filter((t) => t.status === 'PENDING_REIMBURSEMENT');
    const pendingTotal = pending.reduce((sum, t) => sum + (t.amount || 0), 0);
    const reimbursedTotal = all.filter((t) => t.status === 'REIMBURSED').reduce((sum, t) => sum + (t.amount || 0), 0);

    const currentBalance = Math.max(0, this.config.float_limit - pendingTotal);

    return {
      float_limit: this.config.float_limit,
      current_balance: currentBalance,
      pending_expenses_total: pendingTotal,
      pending_vouchers_count: pending.length,
      is_low_balance: currentBalance <= this.config.low_balance_threshold,
      total_reimbursed_ytd: reimbursedTotal,
      config: this.config,
    };
  }

  // --- TRANSACTION OPERATIONS ---

  public addTransaction(data: {
    date: string;
    category: PettyCashExpenseCategory;
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
  }): PettyCashTransaction {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Expense amount must be greater than 0');
    }
    if (!data.paid_to?.trim()) {
      throw new Error('Payee / Vendor name is required');
    }
    if (!data.description?.trim()) {
      throw new Error('Expense description is required');
    }

    // Default account & dept mappings based on category
    let deptCode = data.department_code || '500';
    let deptName = data.department_name || 'Admin & General';
    let accCode = data.account_code || '6310';
    let accName = data.account_name || 'Operating Expenses';
    let catLabel = 'General Operations';

    switch (data.category) {
      case 'KITCHEN_EMERGENCY':
        deptCode = '200';
        deptName = 'Food & Beverage (Uma Blu)';
        accCode = '5210';
        accName = 'F&B Operating Supplies';
        catLabel = 'Kitchen & Bar Emergency';
        break;
      case 'HOUSEKEEPING_GUEST_SUPPLIES':
        deptCode = '100';
        deptName = 'Rooms Department';
        accCode = '5120';
        accName = 'Guest Supplies & Linen Care';
        catLabel = 'Housekeeping Supplies';
        break;
      case 'ENGINEERING_MAINTENANCE':
        deptCode = '600';
        deptName = 'Property Maintenance';
        accCode = '6420';
        accName = 'Maintenance Supplies & Small Hardware';
        catLabel = 'Maintenance & Repair';
        break;
      case 'FRONT_DESK_GUEST_RELATIONS':
        deptCode = '100';
        deptName = 'Rooms Department';
        accCode = '5130';
        accName = 'Front Desk & Guest Amenities';
        catLabel = 'Front Desk & Guest Care';
        break;
      case 'OFFICE_STATIONERY_ADMIN':
        deptCode = '500';
        deptName = 'Admin & General';
        accCode = '6310';
        accName = 'Printing & Stationery Expense';
        catLabel = 'Office Stationery & Admin';
        break;
      case 'TRANSPORT_COURIER':
        deptCode = '500';
        deptName = 'Admin & General';
        accCode = '6340';
        accName = 'Postage, Courier & Local Transport';
        catLabel = 'Courier & Transport';
        break;
    }

    const txCount = this.transactions.size + 1;
    const voucherNumber = `PCV-${new Date().getFullYear()}-${String(txCount).padStart(3, '0')}`;
    const id = voucherNumber;

    const tx: PettyCashTransaction = {
      id,
      voucher_number: voucherNumber,
      date: data.date || new Date().toISOString().substring(0, 10),
      category: data.category,
      category_label: catLabel,
      department_code: deptCode,
      department_name: deptName,
      account_code: accCode,
      account_name: accName,
      amount: Math.round(data.amount),
      paid_to: data.paid_to.trim(),
      description: data.description.trim(),
      receipt_image_url: data.receipt_image_url,
      receipt_filename: data.receipt_filename,
      status: 'PENDING_REIMBURSEMENT',
      created_by: data.created_by || 'Cashier / Admin',
      created_at: new Date().toISOString(),
    };

    this.transactions.set(id, tx);
    this.saveToDisk();
    return tx;
  }

  public deleteTransaction(id: string): { success: boolean } {
    const tx = this.transactions.get(id);
    if (!tx) throw new Error(`Voucher ${id} not found`);
    if (tx.status === 'REIMBURSED') {
      throw new Error('Cannot delete voucher that has already been reimbursed or journalized.');
    }
    this.transactions.delete(id);
    this.saveToDisk();
    return { success: true };
  }

  // --- REPLENISHMENT WORKFLOW (IMPREST FUND CLAIM & AUTO JOURNAL) ---

  public async replenish(params: {
    approved_by?: string;
    notes?: string;
    bank_account_code?: string;
  }): Promise<{ claim: PettyCashReplenishmentClaim; journalId: string }> {
    const pending = Array.from(this.transactions.values()).filter(
      (t) => t.status === 'PENDING_REIMBURSEMENT'
    );

    if (pending.length === 0) {
      throw new Error('No pending petty cash vouchers to reimburse (float is intact).');
    }

    const totalAmount = pending.reduce((sum, t) => sum + t.amount, 0);
    const claimCount = this.claims.size + 1;
    const claimId = `PCR-${new Date().getFullYear()}-${String(claimCount).padStart(3, '0')}`;
    const claimDate = new Date().toISOString().substring(0, 10);
    const period = claimDate.substring(0, 7);

    // Group expenses by account_code + department_code to create clean double-entry journal lines
    const groupedLines = new Map<string, { account_code: string; department_code: string; amount: number; description: string }>();

    pending.forEach((tx) => {
      const key = `${tx.account_code}-${tx.department_code}`;
      const existing = groupedLines.get(key);
      if (existing) {
        existing.amount += tx.amount;
        existing.description += `, ${tx.voucher_number}`;
      } else {
        groupedLines.set(key, {
          account_code: tx.account_code,
          department_code: tx.department_code,
          amount: tx.amount,
          description: `Petty Cash: ${tx.category_label} (${tx.voucher_number})`,
        });
      }
    });

    const journalLines: Array<{ account_code: string; department_code: string; debit: number; credit: number; description: string }> = [];

    // 1. Debits for all expenses
    for (const line of groupedLines.values()) {
      journalLines.push({
        account_code: line.account_code,
        department_code: line.department_code,
        debit: line.amount,
        credit: 0,
        description: line.description,
      });
    }

    // 2. Credit to Bank Account (Replenishment payout from Bank Mandiri)
    const bankAccount = params.bank_account_code || this.config.bank_replenishment_account || '1020';
    journalLines.push({
      account_code: bankAccount,
      department_code: '500', // Finance & General
      debit: 0,
      credit: totalAmount,
      description: `Operational Petty Cash Replenishment (Claim ${claimId} - ${pending.length} Vouchers)`,
    });

    // Create journal in accountingStore
    const journalId = `JRN-PC-${claimDate.replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    try {
      await (accountingStore as any).createJournal(
        {
          journal_id: journalId,
          journal_date: claimDate,
          period,
          source_type: 'MANUAL',
          source_reference: claimId,
          description: `Operational Petty Cash Replenishment (${pending.length} Vouchers)`,
          created_by: params.approved_by || 'Financial Controller',
        },
        journalLines
      );
    } catch (e) {
      console.warn('Could not post auto journal to accountingStore, continuing claim creation:', e);
    }

    // Mark all vouchers as REIMBURSED
    pending.forEach((tx) => {
      tx.status = 'REIMBURSED';
      tx.reimbursement_id = claimId;
    });

    const claim: PettyCashReplenishmentClaim = {
      claim_id: claimId,
      claim_date: claimDate,
      claim_period: period,
      total_amount: totalAmount,
      vouchers_count: pending.length,
      voucher_ids: pending.map((t) => t.id),
      bank_source_account: bankAccount,
      journal_id: journalId,
      approved_by: params.approved_by || 'Financial Controller',
      status: 'POSTED',
      notes: params.notes || `Petty cash reimbursement of Rp ${totalAmount.toLocaleString('id-ID')} disbursed from Bank`,
      created_at: new Date().toISOString(),
    };

    this.claims.set(claimId, claim);
    this.saveToDisk();

    return { claim, journalId };
  }
}

export const pettyCashStore = new PettyCashStore();
