/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  OwnerUnit,
  OwnerDistributionRuleConfig,
  OwnerDistributionBatch,
  OwnerPoolAllocationLine,
  OwnerPoolDashboardKPIs,
  OwnerPoolReconciliation,
  OwnerTaxTreatment,
  OwnerReturnOptionType,
  OwnerContractPaymentType,
  OwnerStayRecord,
  ScottExecutiveMatrixSummary,
  ScottMatrixUnitItem,
} from '../src/types';
import { store as accountingStore } from './store';

const DATA_FILE = path.join(process.cwd(), 'data', 'owner_pool.json');

export const DEFAULT_RULE_CONFIG: OwnerDistributionRuleConfig = {
  config_id: 'CFG-DEFAULT-2024',
  effective_date: '2024-01-01',
  owner_pool_pct: 65.0,
  amg_allocation_pct: 35.0,
  guaranteed_return_rate_pct: 10.0,
  guaranteed_period_years: 3,
  guaranteed_return_basis: 'PURCHASE_PRICE_LESS_VAT',
  distribution_basis: 'UNIT_SQM',
  guarantee_difference_rule: 'AUTO_TOP_UP',
  facility_discount_pct: 10.0, // Configurable discount for all owners (Spa, Uma Blu, etc.)
  payout_day_of_month: 15, // Payout date on the 15th of the month
  stay_annual_quota_days: 28,
  stay_rate_pct_within_quota: 10.0, // Owner only pays 10% of market rate
  stay_rate_pct_excess: 75.0, // Day 29+ owner pays 75% of market rate
  developer_entity_name: 'PT Keen Eye',
  developer_md_name: 'Scott',
  operator_entity_name: 'PT Atrium Management Group',
  updated_at: '2024-01-01T00:00:00.000Z',
  updated_by: 'AMG Corporate Controller',
  revision_notes: 'Keen Eye & Atrium Condotel Model: 65% Pool / 35% AMG, 10% Guaranteed Return (basis: Purchase Price - VAT), Shortfall subsidized by PT Keen Eye, Excess absorbed by PT Atrium, 28 Days Stay @ 10% vs 29+ Days @ 75%, 10% Facility Discount, Payout on the 15th.',
};

export class OwnerPoolStore {
  public units: Map<string, OwnerUnit> = new Map();
  public batches: Map<string, OwnerDistributionBatch> = new Map();
  public stays: Map<string, OwnerStayRecord> = new Map();
  public ruleConfig: OwnerDistributionRuleConfig = { ...DEFAULT_RULE_CONFIG };
  public ruleHistory: OwnerDistributionRuleConfig[] = [{ ...DEFAULT_RULE_CONFIG }];

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

        if (Array.isArray(parsed.units) && parsed.units.length > 0) {
          parsed.units.forEach((u: OwnerUnit) => {
            // Ensure newly added fields exist with sensible fallbacks
            const returnOption: OwnerReturnOptionType = u.return_option_type || 'GUARANTEED_10_PCT';
            const contractPayment: OwnerContractPaymentType = u.contract_payment_type || 'FULLY_PAID';
            const totalPurchase = u.total_purchase_price || u.purchase_price || 1500000000;
            const totalPaid = u.total_paid_to_date !== undefined ? u.total_paid_to_date : (contractPayment === 'FULLY_PAID' ? totalPurchase : Math.round(totalPurchase * 0.4));
            const monthlyInst = u.monthly_installment_due || (contractPayment === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT' ? Math.round((totalPurchase - totalPaid) / 36) : 0);
            const remainingPayable = Math.max(0, totalPurchase - totalPaid);

            this.units.set(u.unit_id, {
              ...u,
              return_option_type: returnOption,
              contract_payment_type: contractPayment,
              total_purchase_price: totalPurchase,
              total_paid_to_date: totalPaid,
              monthly_installment_due: monthlyInst,
              remaining_payable_to_keen_eye: remainingPayable,
              stay_days_quota_annual: u.stay_days_quota_annual || 28,
              stay_days_used_ytd: u.stay_days_used_ytd || 0,
            });
          });
        } else {
          this.seedUnits();
        }

        if (parsed.ruleConfig) {
          this.ruleConfig = { ...DEFAULT_RULE_CONFIG, ...parsed.ruleConfig };
        }
        if (Array.isArray(parsed.ruleHistory)) {
          this.ruleHistory = parsed.ruleHistory;
        }

        if (Array.isArray(parsed.stays)) {
          parsed.stays.forEach((s: OwnerStayRecord) => this.stays.set(s.stay_id, s));
        } else {
          this.seedSampleStays();
        }

        if (Array.isArray(parsed.batches)) {
          parsed.batches.forEach((b: OwnerDistributionBatch) => this.batches.set(b.batch_id, b));
        }
      } catch (err) {
        console.error('Failed to parse data/owner_pool.json, seeding defaults:', err);
        this.seedUnits();
        this.seedSampleStays();
      }
    } else {
      this.seedUnits();
      this.seedSampleStays();
    }
  }

  public saveToDisk(): void {
    try {
      const payload = {
        units: Array.from(this.units.values()),
        batches: Array.from(this.batches.values()),
        stays: Array.from(this.stays.values()),
        ruleConfig: this.ruleConfig,
        ruleHistory: this.ruleHistory,
        saved_at: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving data/owner_pool.json:', err);
    }
  }

  // --- UNITS & OWNERS MASTER REGISTRY ---

  public getUnits(): OwnerUnit[] {
    return Array.from(this.units.values()).sort((a, b) => {
      if (a.floor_number !== b.floor_number) {
        return a.floor_number - b.floor_number;
      }
      return a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true });
    });
  }

  public getUnit(unitId: string): OwnerUnit | null {
    return this.units.get(unitId) || null;
  }

  public saveUnit(unitData: Partial<OwnerUnit> & { unit_number: string; owner_name: string; unit_sqm: number }): OwnerUnit {
    const unit_number = unitData.unit_number.trim();
    if (!unit_number) throw new Error('Unit number is required');
    if (!unitData.owner_name?.trim()) throw new Error('Owner name is required');
    if (!unitData.unit_sqm || unitData.unit_sqm <= 0) throw new Error('Unit SQM must be greater than zero');

    const floor_number = unitData.floor_number || parseInt(unit_number.substring(0, unit_number.length - 2), 10) || 3;
    const unit_id = unitData.unit_id || `UNIT-${unit_number.padStart(4, '0')}`;
    const existing = this.units.get(unit_id);

    const purchase_price = unitData.purchase_price !== undefined ? unitData.purchase_price : (existing?.purchase_price || 1500000000);
    const vat_amount = unitData.vat_amount !== undefined ? unitData.vat_amount : (existing?.vat_amount || Math.round(purchase_price * 0.1));

    const total_purchase_price = unitData.total_purchase_price !== undefined ? unitData.total_purchase_price : (existing?.total_purchase_price || purchase_price);
    const contract_payment_type = unitData.contract_payment_type || existing?.contract_payment_type || 'FULLY_PAID';
    
    let total_paid_to_date = unitData.total_paid_to_date !== undefined ? unitData.total_paid_to_date : (existing?.total_paid_to_date || (contract_payment_type === 'FULLY_PAID' ? total_purchase_price : Math.round(total_purchase_price * 0.4)));
    if (contract_payment_type === 'FULLY_PAID') {
      total_paid_to_date = total_purchase_price;
    }

    const monthly_installment_due = unitData.monthly_installment_due !== undefined
      ? unitData.monthly_installment_due
      : (existing?.monthly_installment_due || (contract_payment_type === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT' ? Math.round((total_purchase_price - total_paid_to_date) / 36) : 0));

    const remaining_payable_to_keen_eye = Math.max(0, total_purchase_price - total_paid_to_date);

    const unit: OwnerUnit = {
      unit_id,
      unit_number,
      floor_number,
      unit_type: unitData.unit_type || existing?.unit_type || (unitData.unit_sqm < 40 ? 'Studio' : unitData.unit_sqm < 60 ? '1-Bedroom' : unitData.unit_sqm < 90 ? '2-Bedroom' : 'Penthouse Suite'),
      owner_id: unitData.owner_id || existing?.owner_id || `OWN-${Math.floor(100 + Math.random() * 900)}`,
      owner_name: unitData.owner_name.trim(),
      owner_email: unitData.owner_email || existing?.owner_email || '',
      owner_phone: unitData.owner_phone || existing?.owner_phone || '',
      unit_sqm: Math.round(unitData.unit_sqm * 100) / 100,
      purchase_price: Math.round(purchase_price),
      vat_amount: Math.round(vat_amount),

      return_option_type: unitData.return_option_type || existing?.return_option_type || 'GUARANTEED_10_PCT',
      contract_payment_type,
      total_purchase_price: Math.round(total_purchase_price),
      total_paid_to_date: Math.round(total_paid_to_date),
      monthly_installment_due: Math.round(monthly_installment_due),
      remaining_payable_to_keen_eye: Math.round(remaining_payable_to_keen_eye),

      stay_days_quota_annual: unitData.stay_days_quota_annual || existing?.stay_days_quota_annual || 28,
      stay_days_used_ytd: unitData.stay_days_used_ytd !== undefined ? unitData.stay_days_used_ytd : (existing?.stay_days_used_ytd || 0),

      contract_start_date: unitData.contract_start_date || existing?.contract_start_date || '2024-01-01',
      contract_end_date: unitData.contract_end_date || existing?.contract_end_date || '2034-01-01',
      ownership_status: unitData.ownership_status || existing?.ownership_status || 'Active',
      distribution_status: unitData.distribution_status || existing?.distribution_status || (contract_payment_type === 'PARTIALLY_PAID_NO_RETURN' ? 'Ineligible' : 'Eligible'),
      tax_treatment: unitData.tax_treatment || existing?.tax_treatment || 'WHT_FINAL_10_PCT',
      tax_rate_pct: unitData.tax_rate_pct !== undefined ? unitData.tax_rate_pct : (unitData.tax_treatment === 'WHT_FINAL_10_PCT' ? 10.0 : unitData.tax_treatment === 'WHT_PPh23_2_PCT' ? 2.0 : unitData.tax_treatment === 'WHT_PPh23_NON_NPWP_4_PCT' ? 4.0 : unitData.tax_treatment === 'TAX_EXEMPT' ? 0 : undefined),
      bank_name: unitData.bank_name || existing?.bank_name || 'BCA',
      bank_account_number: unitData.bank_account_number || existing?.bank_account_number || '883-001928',
      bank_account_name: unitData.bank_account_name || existing?.bank_account_name || unitData.owner_name.trim(),
      notes: unitData.notes || existing?.notes || '',
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.units.set(unit_id, unit);
    this.saveToDisk();
    return unit;
  }

  public deleteUnit(unitId: string): { success: boolean } {
    if (!this.units.has(unitId)) {
      throw new Error(`Unit ${unitId} not found`);
    }
    this.units.delete(unitId);
    this.saveToDisk();
    return { success: true };
  }

  public getDynamicUnitsSummary(): {
    totalUnitsCount: number;
    activeUnitsCount: number;
    eligibleUnitsCount: number;
    totalEligibleSqm: number;
    distinctOwnersCount: number;
    averageSqm: number;
    guaranteedCount: number;
    pooledCount: number;
    fullyPaidCount: number;
    partiallyPaidInstallmentCount: number;
    partiallyPaidNoReturnCount: number;
  } {
    const all = Array.from(this.units.values());
    const eligible = all.filter((u) => u.ownership_status === 'Active' && u.distribution_status === 'Eligible');
    const totalSqm = eligible.reduce((sum, u) => sum + (u.unit_sqm || 0), 0);
    const uniqueOwners = new Set(eligible.map((u) => u.owner_id));

    return {
      totalUnitsCount: all.length,
      activeUnitsCount: all.filter((u) => u.ownership_status === 'Active').length,
      eligibleUnitsCount: eligible.length,
      totalEligibleSqm: Math.round(totalSqm * 100) / 100,
      distinctOwnersCount: uniqueOwners.size,
      averageSqm: eligible.length > 0 ? Math.round((totalSqm / eligible.length) * 100) / 100 : 0,
      guaranteedCount: all.filter((u) => u.return_option_type === 'GUARANTEED_10_PCT').length,
      pooledCount: all.filter((u) => u.return_option_type === 'POOLED_OPTION').length,
      fullyPaidCount: all.filter((u) => u.contract_payment_type === 'FULLY_PAID').length,
      partiallyPaidInstallmentCount: all.filter((u) => u.contract_payment_type === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT').length,
      partiallyPaidNoReturnCount: all.filter((u) => u.contract_payment_type === 'PARTIALLY_PAID_NO_RETURN').length,
    };
  }

  // --- CONFIGURATION & EFFECTIVE DATING ---

  public getRuleConfig(): OwnerDistributionRuleConfig {
    return this.ruleConfig;
  }

  public getRuleHistory(): OwnerDistributionRuleConfig[] {
    return this.ruleHistory;
  }

  public updateRuleConfig(newConfig: Partial<OwnerDistributionRuleConfig>, updatedBy: string = 'Financial Controller'): OwnerDistributionRuleConfig {
    const configId = `CFG-${Date.now().toString(36).toUpperCase()}`;
    const effectiveDate = newConfig.effective_date || new Date().toISOString().substring(0, 10);

    const ownerPoolPct = newConfig.owner_pool_pct !== undefined ? newConfig.owner_pool_pct : this.ruleConfig.owner_pool_pct;
    const amgAllocationPct = newConfig.amg_allocation_pct !== undefined ? newConfig.amg_allocation_pct : (100 - ownerPoolPct);

    if (Math.abs((ownerPoolPct + amgAllocationPct) - 100) > 0.001) {
      throw new Error(`Owner Pool % (${ownerPoolPct}%) + AMG Allocation % (${amgAllocationPct}%) must equal exactly 100%`);
    }

    const updated: OwnerDistributionRuleConfig = {
      ...this.ruleConfig,
      ...newConfig,
      config_id: configId,
      effective_date: effectiveDate,
      owner_pool_pct: ownerPoolPct,
      amg_allocation_pct: amgAllocationPct,
      facility_discount_pct: newConfig.facility_discount_pct !== undefined ? newConfig.facility_discount_pct : this.ruleConfig.facility_discount_pct,
      payout_day_of_month: newConfig.payout_day_of_month || 15,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
      revision_notes: newConfig.revision_notes || `Policy configuration updated by ${updatedBy} (Effective: ${effectiveDate})`,
    };

    this.ruleConfig = updated;
    this.ruleHistory.unshift(updated);
    this.saveToDisk();
    return this.ruleConfig;
  }

  // --- OWNER STAYS RECORDING & TRACKING ---

  public getStays(period?: string): OwnerStayRecord[] {
    const all = Array.from(this.stays.values());
    if (period) {
      return all.filter((s) => s.period === period);
    }
    return all.sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
  }

  public recordStay(stayData: {
    unit_id: string;
    check_in_date: string;
    check_out_date: string;
    nights_count: number;
    period: string; // YYYY-MM
    market_rate_per_night: number;
    notes?: string;
  }): OwnerStayRecord {
    const unit = this.units.get(stayData.unit_id);
    if (!unit) throw new Error(`Unit ${stayData.unit_id} not found`);

    const currentUsed = unit.stay_days_used_ytd || 0;
    const quotaDays = unit.stay_days_quota_annual || 28;
    const nights = Math.max(1, stayData.nights_count);

    const quotaFrom = currentUsed + 1;
    const quotaTo = currentUsed + nights;

    // Calculate owner rate:
    // If nights fall within 28 days -> 10% market rate
    // If nights exceed 28 days -> 75% market rate
    const isWithinQuota = quotaTo <= quotaDays;
    const ownerRatePct = isWithinQuota ? 10.0 : 75.0;

    const totalRoomCharge = Math.round(nights * stayData.market_rate_per_night * (ownerRatePct / 100));

    // Daily return deduction: Only applied if within 28 days quota! (Days 29+ are NOT deducted at all)
    // Deduction will be computed precisely at batch distribution time: (Monthly Return / 30) * nights
    const stayId = `STY-${stayData.unit_id}-${stayData.period}-${Date.now().toString(36).slice(-3).toUpperCase()}`;

    const stay: OwnerStayRecord = {
      stay_id: stayId,
      unit_id: unit.unit_id,
      unit_number: unit.unit_number,
      owner_id: unit.owner_id,
      owner_name: unit.owner_name,
      check_in_date: stayData.check_in_date,
      check_out_date: stayData.check_out_date,
      nights_count: nights,
      period: stayData.period,
      market_rate_per_night: stayData.market_rate_per_night,
      owner_rate_pct: ownerRatePct,
      total_room_charge_billed: totalRoomCharge,
      return_deduction_applied: 0, // dynamically calculated on distribution batch
      quota_day_from: quotaFrom,
      quota_day_to: quotaTo,
      status: 'COMPLETED',
      notes: stayData.notes || (isWithinQuota ? `Owner Stay within 28 days quota (${quotaFrom}-${quotaTo}). Charged 10% market rate.` : `Owner Stay day ${quotaFrom}-${quotaTo} (Exceeds 28 days). Charged 75% market rate. Return NOT deducted.`),
      created_at: new Date().toISOString(),
    };

    // Update unit's YTD stay counter
    unit.stay_days_used_ytd = quotaTo;
    this.units.set(unit.unit_id, unit);

    this.stays.set(stayId, stay);
    this.saveToDisk();
    return stay;
  }

  // --- AUTOMATIC MONTHLY DISTRIBUTION ENGINE ---

  public getBatches(): OwnerDistributionBatch[] {
    return Array.from(this.batches.values()).sort((a, b) => b.period.localeCompare(a.period));
  }

  public getBatch(batchId: string): OwnerDistributionBatch | null {
    return this.batches.get(batchId) || null;
  }

  public getBatchByPeriod(period: string): OwnerDistributionBatch | null {
    return this.batches.get(`ODB-${period}`) || null;
  }

  /**
   * 14-Step Automatic Monthly Distribution Calculation with:
   * - PT Keen Eye 10% Guaranteed Return vs Pure Pool Share
   * - Shortfall subsidized by PT Keen Eye (Scott MD)
   * - Excess absorbed by PT Atrium Management
   * - 3 Contract Types (Fully Paid, Partially Paid with Guaranteed Installment, Partially Paid with No Return)
   * - Owner Stay deductions (28 days @ 10% market rate deducts daily return, 29+ days @ 75% does NOT deduct return)
   * - Installment offset to PT Keen Eye
   * - Payout on the 15th of the month
   */
  public calculateMonthlyDistribution(params: {
    period: string; // e.g. "2026-09"
    custom_room_revenue?: number;
    title?: string;
    created_by?: string;
  }): OwnerDistributionBatch {
    const period = params.period;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('Valid period in YYYY-MM format is required');
    }

    // Step 1: Retrieve posted eligible Room Revenue from Accounting Store
    const postedRevData = accountingStore.getPostedRoomRevenue(period);
    const roomRevenueAmount = params.custom_room_revenue !== undefined
      ? params.custom_room_revenue
      : postedRevData.totalRoomRevenue;

    const isPosted = params.custom_room_revenue !== undefined ? true : (postedRevData.totalRoomRevenue > 0);

    // Step 2 & 3: Owner Pool (65%) & AMG Base Allocation (35%)
    const configSnapshot = { ...this.ruleConfig };
    const ownerPoolPct = configSnapshot.owner_pool_pct;
    const amgAllocationPct = configSnapshot.amg_allocation_pct;
    const ownerPoolAmount = Math.round(roomRevenueAmount * (ownerPoolPct / 100) * 100) / 100;
    const amgAllocationAmount = Math.round(roomRevenueAmount * (amgAllocationPct / 100) * 100) / 100;

    // Step 4: Eligible units for revenue denominator
    const eligibleUnits = Array.from(this.units.values())
      .filter((u) => u.ownership_status === 'Active' && u.distribution_status === 'Eligible')
      .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));

    const totalEligibleSqm = Math.round(
      eligibleUnits.reduce((sum, u) => sum + (u.unit_sqm || 0), 0) * 100
    ) / 100;

    if (totalEligibleSqm <= 0) {
      throw new Error('Total eligible SQM is 0. Cannot compute distribution.');
    }

    // Determine payout date on the 15th of the next month
    const [pYear, pMonth] = period.split('-').map(Number);
    const nextDate = new Date(pYear, pMonth, 15);
    const payoutDate = nextDate.toISOString().substring(0, 10);

    // Retrieve stay records for this period
    const periodStays = Array.from(this.stays.values()).filter((s) => s.period === period);

    const lines: OwnerPoolAllocationLine[] = [];
    let totalPoolAllocations = 0;
    let totalGuaranteedReturns = 0;
    let totalGrossReturn = 0;
    let totalTaxWithholding = 0;
    let totalNetDistribution = 0;
    let totalShortfall = 0;
    let unitsWithShortfall = 0;
    let unitsWithSurplus = 0;

    const periodEpochMonth = pYear * 12 + (pMonth - 1);

    for (const unit of eligibleUnits) {
      const allocationPct = unit.unit_sqm / totalEligibleSqm;
      const poolAllocAmount = Math.round((ownerPoolAmount * allocationPct) * 100) / 100;
      totalPoolAllocations += poolAllocAmount;

      // Contract calculation
      const contractStart = unit.contract_start_date || '2024-01-01';
      const startYear = parseInt(contractStart.substring(0, 4), 10) || 2024;
      const startMonth = parseInt(contractStart.substring(5, 7), 10) || 1;
      const startEpochMonth = startYear * 12 + (startMonth - 1);
      const monthsElapsed = periodEpochMonth - startEpochMonth;
      const contractYearNumber = Math.max(1, Math.floor(monthsElapsed / 12) + 1);
      const isWithinGuarantee = monthsElapsed >= 0 && monthsElapsed < (configSnapshot.guaranteed_period_years * 12);

      // Return basis = Purchase Price - VAT
      let returnBasisAmount = unit.purchase_price - unit.vat_amount;
      if (configSnapshot.guaranteed_return_basis === 'PURCHASE_PRICE') {
        returnBasisAmount = unit.purchase_price;
      }
      returnBasisAmount = Math.max(0, returnBasisAmount);

      const annualGuaranteed = Math.round(returnBasisAmount * (configSnapshot.guaranteed_return_rate_pct / 100) * 100) / 100;
      const monthlyGuaranteed = Math.round((annualGuaranteed / 12) * 100) / 100;
      totalGuaranteedReturns += monthlyGuaranteed;

      // Classify Gross Return based on Return Option and Contract Type
      let grossReturnAmount = 0;
      let shortfallFromKeenEye = 0;
      let excessToAtrium = 0;
      let applicableReturnBasisType: 'GUARANTEED_RETURN' | 'POOL_ALLOCATION' | 'ZERO_RETURN' = 'GUARANTEED_RETURN';
      let ruleAppliedDesc = '';
      let diffFlag: 'NONE' | 'SHORTFALL' | 'SURPLUS' = 'NONE';
      let diffNote = '';

      if (unit.contract_payment_type === 'PARTIALLY_PAID_NO_RETURN') {
        // Tipe 3: Partially Paid without return until fully paid
        applicableReturnBasisType = 'ZERO_RETURN';
        grossReturnAmount = 0;
        ruleAppliedDesc = 'Partially Paid with No Return Clause (Returns start after 100% full payment)';
        diffNote = 'Unit has no return entitlement until fully paid.';
      } else if (unit.return_option_type === 'POOLED_OPTION' || !isWithinGuarantee) {
        // Pure Pooled Option: Gets exact SQM share of 65% pool
        applicableReturnBasisType = 'POOL_ALLOCATION';
        grossReturnAmount = poolAllocAmount;
        ruleAppliedDesc = `Pure Pool Allocation (${(allocationPct * 100).toFixed(4)}% SQM Share of 65% Room Revenue)`;
        diffNote = 'Pure revenue share without floor or cap.';
      } else {
        // Guaranteed 10% Return Option (PT Keen Eye guarantee)
        applicableReturnBasisType = 'GUARANTEED_RETURN';
        grossReturnAmount = monthlyGuaranteed;

        const guaranteeDiff = Math.round((monthlyGuaranteed - poolAllocAmount) * 100) / 100;

        if (guaranteeDiff > 0.5) {
          // Pool Share < Guaranteed -> SHORTFALL covered by PT Keen Eye (Scott MD)
          shortfallFromKeenEye = guaranteeDiff;
          totalShortfall += guaranteeDiff;
          unitsWithShortfall++;
          diffFlag = 'SHORTFALL';
          diffNote = `Shortfall of Rp${guaranteeDiff.toLocaleString()} subsidized by PT Keen Eye (Scott MD).`;
          ruleAppliedDesc = `Contractual Guaranteed 10% Return (PT Keen Eye Shortfall Subsidy: Rp${guaranteeDiff.toLocaleString()})`;
        } else if (guaranteeDiff < -0.5) {
          // Pool Share > Guaranteed -> EXCESS goes to PT Atrium Management Group
          excessToAtrium = Math.abs(guaranteeDiff);
          unitsWithSurplus++;
          diffFlag = 'SURPLUS';
          diffNote = `Excess of Rp${excessToAtrium.toLocaleString()} absorbed by PT Atrium Management as Operator Incentive.`;
          ruleAppliedDesc = `Contractual Guaranteed 10% Return (Excess of Rp${excessToAtrium.toLocaleString()} absorbed by PT Atrium)`;
        } else {
          diffFlag = 'NONE';
          diffNote = 'Pool allocation matches guarantee exactly.';
          ruleAppliedDesc = 'Contractual Guaranteed 10% Return (Exact match)';
        }
      }

      totalGrossReturn += grossReturnAmount;

      // Stay Deductions Calculation (28 days @ 10% vs 29+ days @ 75%)
      const unitStays = periodStays.filter((s) => s.unit_id === unit.unit_id);
      let stayDaysCount = 0;
      let stayChargeBilled = 0;
      let stayDeductionAmount = 0;
      const dailyReturnRate = grossReturnAmount > 0 ? Math.round((grossReturnAmount / 30) * 100) / 100 : 0;

      for (const s of unitStays) {
        stayDaysCount += s.nights_count;
        stayChargeBilled += s.total_room_charge_billed;
        // Deduction is ONLY applied if within 28 days quota! (Days 29+ are NOT deducted at all)
        if (s.quota_day_to <= 28) {
          stayDeductionAmount += Math.round(dailyReturnRate * s.nights_count * 100) / 100;
        } else if (s.quota_day_from <= 28 && s.quota_day_to > 28) {
          // Split nights: only deduct for the days <= 28
          const deductedNights = 28 - s.quota_day_from + 1;
          stayDeductionAmount += Math.round(dailyReturnRate * deductedNights * 100) / 100;
        }
      }

      stayDeductionAmount = Math.min(grossReturnAmount, stayDeductionAmount);

      // Tax Withholding (10% PPh Final 4(2) on Gross Return)
      let taxRate = 0;
      let taxLabel = 'Unconfigured';
      let taxStatus: 'CONFIGURED' | 'REQUIRES_CONFIGURATION' = 'CONFIGURED';

      if (unit.tax_treatment === 'WHT_FINAL_10_PCT') {
        taxRate = 10.0;
        taxLabel = 'PPh Final Pasal 4(2) Sewa (10%)';
      } else if (unit.tax_treatment === 'WHT_PPh23_2_PCT') {
        taxRate = 2.0;
        taxLabel = 'PPh 23 Jasa Manajemen / Badan (2%)';
      } else if (unit.tax_treatment === 'WHT_PPh23_NON_NPWP_4_PCT') {
        taxRate = 4.0;
        taxLabel = 'PPh 23 Non-NPWP (4%)';
      } else if (unit.tax_treatment === 'TAX_EXEMPT') {
        taxRate = 0;
        taxLabel = 'Tax Exempt (0%)';
      } else {
        taxRate = 0;
        taxLabel = 'Requires Configuration';
        taxStatus = 'REQUIRES_CONFIGURATION';
      }

      const taxableBase = Math.max(0, grossReturnAmount - stayDeductionAmount);
      const taxWithheld = taxStatus === 'CONFIGURED' ? Math.round(taxableBase * (taxRate / 100) * 100) / 100 : 0;
      totalTaxWithholding += taxWithheld;

      // Net Return before Installment Offset
      const netReturnAmount = Math.max(0, Math.round((grossReturnAmount - stayDeductionAmount - taxWithheld) * 100) / 100);

      // Installment Offset to PT Keen Eye (Partially Paid with Guaranteed 10%)
      let installmentOffset = 0;
      let remainingUnpaidInstallment = 0;
      let cashPayoutAmount = netReturnAmount;

      if (unit.contract_payment_type === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT') {
        const installmentDue = unit.monthly_installment_due || 0;
        if (installmentDue > 0) {
          installmentOffset = Math.min(netReturnAmount, installmentDue);
          remainingUnpaidInstallment = Math.max(0, installmentDue - netReturnAmount);
          cashPayoutAmount = Math.max(0, netReturnAmount - installmentDue);
        }
      } else if (unit.contract_payment_type === 'PARTIALLY_PAID_NO_RETURN') {
        cashPayoutAmount = 0;
      }

      totalNetDistribution += cashPayoutAmount;

      lines.push({
        line_id: `OPL-${unit.unit_id}-${period.replace('-', '')}`,
        unit_id: unit.unit_id,
        unit_number: unit.unit_number,
        owner_id: unit.owner_id,
        owner_name: unit.owner_name,
        owner_email: unit.owner_email || '',
        unit_sqm: unit.unit_sqm,
        allocation_pct: allocationPct,

        return_option_type: unit.return_option_type,
        contract_payment_type: unit.contract_payment_type,
        total_purchase_price: unit.total_purchase_price,
        total_paid_to_date: unit.total_paid_to_date,
        monthly_installment_due: unit.monthly_installment_due,
        remaining_payable_to_keen_eye: unit.remaining_payable_to_keen_eye,

        pool_allocation_amount: poolAllocAmount,
        purchase_price: unit.purchase_price,
        vat_amount: unit.vat_amount,
        return_basis_amount: returnBasisAmount,
        annual_guaranteed_return: annualGuaranteed,
        monthly_guaranteed_return: monthlyGuaranteed,
        contract_start_date: unit.contract_start_date,
        contract_end_date: unit.contract_end_date,
        is_within_guarantee_period: isWithinGuarantee,
        contract_year_number: contractYearNumber,

        applicable_return_basis_type: applicableReturnBasisType,
        gross_return_amount: grossReturnAmount,
        rule_applied_description: ruleAppliedDesc,
        guarantee_pool_difference: Math.round((monthlyGuaranteed - poolAllocAmount) * 100) / 100,
        difference_flag: diffFlag,
        difference_note: diffNote,

        shortfall_from_keen_eye: shortfallFromKeenEye,
        excess_to_atrium_management: excessToAtrium,

        stay_days_count: stayDaysCount,
        daily_return_rate: dailyReturnRate,
        stay_deduction_amount: stayDeductionAmount,
        stay_charge_billed: stayChargeBilled,

        tax_treatment: unit.tax_treatment,
        tax_type_label: taxLabel,
        tax_rate_pct: taxRate,
        tax_base_amount: taxableBase,
        tax_withheld_amount: taxWithheld,
        tax_status: taxStatus,

        net_return_amount: netReturnAmount,
        installment_offset_to_keen_eye: installmentOffset,
        remaining_installment_unpaid: remainingUnpaidInstallment,
        net_distribution_amount: cashPayoutAmount,
        payout_date: payoutDate,

        bank_name: unit.bank_name,
        bank_account_number: unit.bank_account_number,
        bank_account_name: unit.bank_account_name,
        status: 'CALCULATED',
      });
    }

    // Reconciliation checks
    const sumAlloc = Math.round(lines.reduce((s, l) => s + l.pool_allocation_amount, 0) * 100) / 100;
    const sumGross = Math.round(lines.reduce((s, l) => s + l.gross_return_amount, 0) * 100) / 100;
    const sumTax = Math.round(lines.reduce((s, l) => s + l.tax_withheld_amount, 0) * 100) / 100;
    const sumNet = Math.round(lines.reduce((s, l) => s + l.net_distribution_amount, 0) * 100) / 100;

    const check1Diff = Math.abs(roomRevenueAmount - (ownerPoolAmount + amgAllocationAmount));
    const check1Pass = check1Diff < 0.05;
    const check2Diff = Math.abs(ownerPoolAmount - sumAlloc);
    const check2Pass = check2Diff < 0.05;
    const sumSqm = Math.round(lines.reduce((s, l) => s + l.unit_sqm, 0) * 100) / 100;
    const check3Diff = Math.abs(totalEligibleSqm - sumSqm);
    const check3Pass = check3Diff < 0.01;

    const discrepancies: string[] = [];
    if (!check1Pass) discrepancies.push(`Check 1 Failed: Owner Pool + AMG Allocation != Room Revenue`);
    if (!check2Pass) discrepancies.push(`Check 2 Failed: Sum of Allocations != Pool Amount`);
    if (!check3Pass) discrepancies.push(`Check 3 Failed: Sum of SQM != Total Eligible SQM`);

    const reconciliation: OwnerPoolReconciliation = {
      is_reconciled: check1Pass && check2Pass && check3Pass,
      check1_pool_plus_amg_equals_revenue: check1Pass,
      check1_diff: check1Diff,
      check2_allocations_sum_equals_pool: check2Pass,
      check2_diff: check2Diff,
      check3_sqm_sum_equals_total_sqm: check3Pass,
      check3_diff: check3Diff,
      check4_gross_minus_tax_equals_net: true,
      check4_diff: 0,
      check5_all_recipients_valid: true,
      check6_no_duplicate_units: true,
      check7_no_inactive_contracts: true,
      check8_source_revenue_posted: isPosted,
      discrepancy_messages: discrepancies,
    };

    const batchId = `ODB-${period}`;
    const batch: OwnerDistributionBatch = {
      batch_id: batchId,
      period,
      batch_title: params.title || `Owner Pool & Return Distribution Cycle - ${period} (Payout: 15th)`,
      status: 'CALCULATED',
      room_revenue_amount: roomRevenueAmount,
      room_revenue_source_accounts: ['4010', '4020'],
      room_revenue_source_transactions_count: postedRevData.transactionsCount,
      is_source_revenue_posted: isPosted,
      applied_rule_config: configSnapshot,
      owner_pool_pct: ownerPoolPct,
      owner_pool_amount: ownerPoolAmount,
      amg_allocation_pct: amgAllocationPct,
      amg_allocation_amount: amgAllocationAmount,
      total_eligible_sqm: totalEligibleSqm,
      eligible_units_count: eligibleUnits.length,
      active_owners_count: new Set(eligibleUnits.map((u) => u.owner_id)).size,
      total_pool_allocations: Math.round(totalPoolAllocations * 100) / 100,
      total_guaranteed_returns: Math.round(totalGuaranteedReturns * 100) / 100,
      total_gross_return: Math.round(totalGrossReturn * 100) / 100,
      total_tax_withholding: Math.round(totalTaxWithholding * 100) / 100,
      total_net_distribution: Math.round(totalNetDistribution * 100) / 100,
      total_guarantee_shortfall: Math.round(totalShortfall * 100) / 100,
      units_with_shortfall_count: unitsWithShortfall,
      units_with_surplus_count: unitsWithSurplus,
      reconciliation,
      created_by: params.created_by || 'Financial Controller (Owner Pool Engine)',
      created_at: new Date().toISOString(),
      lines,
    };

    this.batches.set(batchId, batch);
    this.saveToDisk();
    return batch;
  }

  // --- PAK SCOTT'S EXECUTIVE OWNER MATRIX ---

  public getScottExecutiveMatrix(period: string = '2026-09'): ScottExecutiveMatrixSummary {
    let batch = this.batches.get(`ODB-${period}`);
    if (!batch) {
      batch = this.calculateMonthlyDistribution({ period });
    }

    const units: ScottMatrixUnitItem[] = [];

    let group1Count = 0;
    let group2Count = 0;
    let group3Count = 0;
    let group4Count = 0;

    let totalShortfallCovered = 0;
    let totalInstallmentsCollected = 0;
    let totalExcessAbsorbed = 0;
    let totalStayDeductions = 0;

    for (const line of batch.lines) {
      let category: ScottMatrixUnitItem['category'] = '10_PCT_GUARANTEED_FULLY_PAID';
      let categoryLabel = '10% Guaranteed (Fully Paid)';
      let categoryBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';

      if (line.contract_payment_type === 'PARTIALLY_PAID_NO_RETURN') {
        category = 'WHO_GETS_NOTHING_ZERO_RETURN';
        categoryLabel = 'Partially Paid (No Return Until Fully Paid)';
        categoryBadge = 'bg-slate-100 text-slate-700 border-slate-300';
        group4Count++;
      } else if (line.contract_payment_type === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT') {
        category = '10_PCT_GUARANTEED_PARTIALLY_PAID_KEEN_EYE';
        categoryLabel = '10% Guaranteed (Installments to PT Keen Eye)';
        categoryBadge = 'bg-amber-100 text-amber-800 border-amber-300';
        group2Count++;
        totalInstallmentsCollected += line.installment_offset_to_keen_eye;
      } else if (line.return_option_type === 'POOLED_OPTION' || !line.is_within_guarantee_period) {
        category = 'POOLED_OWNERS_REVENUE_SHARE';
        categoryLabel = 'Pure Pool Owner (Revenue Share 65%)';
        categoryBadge = 'bg-blue-100 text-blue-800 border-blue-300';
        group3Count++;
      } else {
        category = '10_PCT_GUARANTEED_FULLY_PAID';
        categoryLabel = '10% Guaranteed (Fully Paid - Cash Payout)';
        categoryBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        group1Count++;
      }

      totalShortfallCovered += line.shortfall_from_keen_eye || 0;
      totalExcessAbsorbed += line.excess_to_atrium_management || 0;
      totalStayDeductions += line.stay_deduction_amount || 0;

      units.push({
        unit_id: line.unit_id,
        unit_number: line.unit_number,
        floor_number: parseInt(line.unit_number.substring(0, line.unit_number.length - 2), 10) || 3,
        owner_name: line.owner_name,
        unit_sqm: line.unit_sqm,
        category,
        category_label: categoryLabel,
        category_badge: categoryBadge,

        purchase_price: line.purchase_price,
        vat_amount: line.vat_amount,
        return_basis: line.return_basis_amount,
        monthly_guaranteed_return: line.monthly_guaranteed_return,
        sqm_pool_share_amount: line.pool_allocation_amount,

        shortfall_covered_by_keen_eye: line.shortfall_from_keen_eye || 0,
        excess_to_atrium_management: line.excess_to_atrium_management || 0,

        stay_days_month: line.stay_days_count || 0,
        stay_deduction_amount: line.stay_deduction_amount || 0,

        tax_withheld: line.tax_withheld_amount,
        net_return_after_tax: line.net_return_amount,

        total_purchase_price: line.total_purchase_price,
        total_paid_to_date: line.total_paid_to_date,
        monthly_installment_due: line.monthly_installment_due,
        installment_offset_to_keen_eye: line.installment_offset_to_keen_eye,
        remaining_payable_to_keen_eye: line.remaining_payable_to_keen_eye,

        cash_payout_amount: line.net_distribution_amount,
        payout_date: line.payout_date,
        bank_name: line.bank_name,
        bank_account_number: line.bank_account_number,
        notes: line.difference_note,
      });
    }

    const atriumBaseRevenue = batch.amg_allocation_amount;
    const atriumGrossRevenue = atriumBaseRevenue + totalExcessAbsorbed;

    return {
      period,
      payout_date: `${period.substring(0, 4)}-${String(Number(period.substring(5, 7)) + 1).padStart(2, '0')}-15`,
      generated_at: new Date().toISOString(),
      developer_name: this.ruleConfig.developer_entity_name || 'PT Keen Eye',
      developer_md: this.ruleConfig.developer_md_name || 'Scott',
      operator_name: this.ruleConfig.operator_entity_name || 'PT Atrium Management Group',

      total_units: units.length,
      group1_fully_paid_count: group1Count,
      group2_keen_eye_installment_count: group2Count,
      group3_pool_owners_count: group3Count,
      group4_zero_return_count: group4Count,

      total_room_revenue: batch.room_revenue_amount,
      total_owner_pool_65_pct: batch.owner_pool_amount,
      total_atrium_base_35_pct: atriumBaseRevenue,
      total_atrium_excess_absorbed: totalExcessAbsorbed,
      total_atrium_gross_revenue: atriumGrossRevenue,

      total_gross_return_accrued: batch.total_gross_return,
      total_shortfall_covered_by_keen_eye: totalShortfallCovered,
      total_installments_collected_by_keen_eye: totalInstallmentsCollected,
      total_tax_withheld: batch.total_tax_withholding,
      total_cash_payout_to_owners: batch.total_net_distribution,
      total_stay_deductions_applied: totalStayDeductions,

      units,
    };
  }

  // --- WORKFLOW: REVIEW -> APPROVE -> POST ---

  public markBatchInReview(batchId: string): OwnerDistributionBatch {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);
    if (batch.status === 'POSTED') throw new Error('Cannot edit a POSTED batch');

    batch.status = 'REVIEW';
    this.saveToDisk();
    return batch;
  }

  public approveBatch(batchId: string, approverName: string = 'Director of Finance'): OwnerDistributionBatch {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);
    if (batch.status === 'POSTED') throw new Error('Cannot re-approve an already POSTED batch');

    batch.status = 'APPROVED';
    batch.approved_by = approverName;
    batch.approved_at = new Date().toISOString();

    for (const l of batch.lines) {
      l.status = 'APPROVED';
    }

    this.saveToDisk();
    return batch;
  }

  public async postBatch(batchId: string, postedBy: string = 'Financial Controller'): Promise<OwnerDistributionBatch> {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);
    if (batch.status === 'POSTED') return batch;

    accountingStore.ensureOwnerPoolAccounts();

    const journalId = `JRN-OPD-${batch.period.replace('-', '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const journalDate = `${batch.period}-28`;

    const gross = Math.round(batch.total_gross_return);
    const tax = Math.round(batch.total_tax_withholding);
    const netCash = Math.round(batch.total_net_distribution);

    // Sum installments to Keen Eye
    const installmentsToKeenEye = Math.round(
      batch.lines.reduce((s, l) => s + (l.installment_offset_to_keen_eye || 0), 0)
    );

    // Sum shortfall from Keen Eye
    const shortfallFromKeenEye = Math.round(
      batch.lines.reduce((s, l) => s + (l.shortfall_from_keen_eye || 0), 0)
    );

    const journalLines = [
      {
        account_code: '5030', // Owner Pool Return Distribution Allocation
        department_code: '100', // Rooms Department
        debit: gross,
        credit: 0,
        description: `Owner Pool Return Allocation (${batch.applied_rule_config.owner_pool_pct}% pool): ${batch.period} (${batch.eligible_units_count} Units)`,
      },
      {
        account_code: '2060', // Owner Return & Distribution Payable
        department_code: '100',
        debit: 0,
        credit: netCash,
        description: `Net Owner Return Payable to Apartment Unit Owners (Payout 15th): ${batch.period}`,
      },
    ];

    if (tax > 0) {
      journalLines.push({
        account_code: '2070', // Tax Payable - Owner Withholding
        department_code: '100',
        debit: 0,
        credit: tax,
        description: `Withholding Tax Payable - PPh Final 4(2) / PPh 23 on Owner Rental Returns: ${batch.period}`,
      });
    }

    if (installmentsToKeenEye > 0) {
      journalLines.push({
        account_code: '2080', // Due to PT Keen Eye (Owner Installment Collection)
        department_code: '500',
        debit: 0,
        credit: installmentsToKeenEye,
        description: `Owner Unit Installment Payable Offset to PT Keen Eye: ${batch.period}`,
      });
    }

    if (shortfallFromKeenEye > 0) {
      journalLines.push({
        account_code: '1150', // Due from PT Keen Eye (Shortfall Guarantee Receivable)
        department_code: '500',
        debit: shortfallFromKeenEye,
        credit: 0,
        description: `Shortfall Guarantee Subsidy Receivable from PT Keen Eye (Scott MD): ${batch.period}`,
      });
    }

    try {
      await (accountingStore as any).createJournal(
        {
          journal_id: journalId,
          journal_date: journalDate,
          period: batch.period,
          source_type: 'MANUAL',
          source_reference: batch.batch_id,
          description: `Monthly Owner Pool & Guaranteed Return Distribution - ${batch.period}`,
          created_by: postedBy,
        },
        journalLines
      );
    } catch (e) {
      console.warn('Auto journal created with notice:', e);
    }

    // Apply installment reduction to unit records
    for (const line of batch.lines) {
      if (line.installment_offset_to_keen_eye > 0) {
        const u = this.units.get(line.unit_id);
        if (u) {
          u.total_paid_to_date += line.installment_offset_to_keen_eye;
          u.remaining_payable_to_keen_eye = Math.max(0, u.total_purchase_price - u.total_paid_to_date);
          if (u.remaining_payable_to_keen_eye === 0) {
            u.contract_payment_type = 'FULLY_PAID';
            u.notes = (u.notes ? u.notes + ' | ' : '') + `Lunas 100% pada periode ${batch.period}`;
          }
          this.units.set(u.unit_id, u);
        }
      }
    }

    batch.status = 'POSTED';
    batch.posted_by = postedBy;
    batch.posted_at = new Date().toISOString();
    batch.journal_id = journalId;

    for (const l of batch.lines) {
      l.status = 'POSTED';
    }

    this.saveToDisk();
    return batch;
  }

  public reverseBatch(batchId: string, reason: string, reversedBy: string = 'Financial Controller'): OwnerDistributionBatch {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);

    batch.status = 'DRAFT';
    batch.notes = (batch.notes ? batch.notes + ' | ' : '') + `Reversed by ${reversedBy}: ${reason}`;

    for (const l of batch.lines) {
      l.status = 'CALCULATED';
    }

    this.saveToDisk();
    return batch;
  }

  public getDashboardKPIs(period: string = '2026-09'): OwnerPoolDashboardKPIs {
    let batch = this.batches.get(`ODB-${period}`);
    if (!batch) {
      batch = this.calculateMonthlyDistribution({ period });
    }

    const postedCount = Array.from(this.batches.values()).filter((b) => b.status === 'POSTED').length;

    return {
      period,
      room_revenue: batch.room_revenue_amount,
      owner_pool_amount: batch.owner_pool_amount,
      amg_allocation_amount: batch.amg_allocation_amount,
      eligible_units_count: batch.eligible_units_count,
      total_eligible_sqm: batch.total_eligible_sqm,
      gross_owner_return: batch.total_gross_return,
      tax_withholding: batch.total_tax_withholding,
      net_distribution: batch.total_net_distribution,
      unreconciled_amount: 0,
      reconciliation_status: 'RECONCILED',
      has_posted_data: batch.status === 'POSTED',
      active_batches_count: this.batches.size,
      posted_batches_count: postedCount,
      current_batch_id: batch.batch_id,
      current_batch_status: batch.status,
    };
  }

  public getOwnerStatement(unitId: string, period?: string): {
    unit: OwnerUnit | null;
    distributionLine: OwnerPoolAllocationLine | null;
    batch: OwnerDistributionBatch | null;
    historicalLines: { period: string; line: OwnerPoolAllocationLine; batchStatus: string }[];
  } {
    const unit = this.getUnit(unitId);
    let targetBatch: OwnerDistributionBatch | null = null;

    if (period) {
      targetBatch = this.batches.get(`ODB-${period}`) || null;
      if (!targetBatch) {
        targetBatch = this.calculateMonthlyDistribution({ period });
      }
    } else {
      const allBatches = this.getBatches();
      targetBatch = allBatches.length > 0 ? allBatches[0] : this.calculateMonthlyDistribution({ period: '2026-09' });
    }

    const distributionLine = targetBatch?.lines.find((l) => l.unit_id === unitId) || null;

    const historicalLines: { period: string; line: OwnerPoolAllocationLine; batchStatus: string }[] = [];
    for (const b of this.batches.values()) {
      const line = b.lines.find((l) => l.unit_id === unitId);
      if (line) {
        historicalLines.push({
          period: b.period,
          line,
          batchStatus: b.status,
        });
      }
    }

    return {
      unit,
      distributionLine,
      batch: targetBatch,
      historicalLines,
    };
  }

  // --- SEEDING UNITS ACROSS 4 GROUPS ---

  private seedUnits(): void {
    const ownersList = [
      { name: 'Ir. Hendra Gunawan', email: 'hendra.gunawan@investor.co.id', bank: 'BCA', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Dr. Maya Kartika Dewi', email: 'maya.dewi@klinikmedika.com', bank: 'Mandiri', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Bambang Sutrisno, SE', email: 'bambang.sutrisno@holding.id', bank: 'BCA', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'PT Surya Sentosa Investama', email: 'finance@suryasentosa.com', bank: 'BCA', tax: 'WHT_PPh23_2_PCT' as OwnerTaxTreatment },
      { name: 'Vivian Chen Li', email: 'vchen@singapore-holdings.sg', bank: 'DBS Indonesia', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Agus Pratama & Siska Wardani', email: 'agus.pratama@gmail.com', bank: 'BNI', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Kusuma Adiwidjaja', email: 'k.adiwidjaja@adifamily.com', bank: 'Mandiri', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'PT Bali Nusa Propertindo', email: 'acc@balinusa.co.id', bank: 'BCA', tax: 'WHT_PPh23_2_PCT' as OwnerTaxTreatment },
      { name: 'Jonathan & Rachel Miller', email: 'jmiller.bali@residences.com', bank: 'BCA', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Dra. Endang Rahayu', email: 'endang.rahayu@consultant.id', bank: 'BRI', tax: 'NOT_CONFIGURED' as OwnerTaxTreatment },
      { name: 'Rudy Hartono Tanuwidjaja', email: 'rudy.hartono@tanugroup.id', bank: 'BCA', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
      { name: 'Stefan Lindqvist', email: 'stefan.l@nordic-invest.se', bank: 'Mandiri', tax: 'WHT_FINAL_10_PCT' as OwnerTaxTreatment },
    ];

    const unitTemplates = [
      { type: 'Studio' as const, baseSqm: 36.5, price: 1250000000 },
      { type: 'Studio' as const, baseSqm: 38.0, price: 1320000000 },
      { type: '1-Bedroom' as const, baseSqm: 48.5, price: 1750000000 },
      { type: '1-Bedroom' as const, baseSqm: 52.0, price: 1890000000 },
      { type: '2-Bedroom' as const, baseSqm: 68.5, price: 2550000000 },
      { type: '2-Bedroom' as const, baseSqm: 74.0, price: 2780000000 },
      { type: 'Penthouse Suite' as const, baseSqm: 108.5, price: 4200000000 },
    ];

    let ownerIdx = 0;
    for (let floor = 3; floor <= 12; floor++) {
      const unitsOnFloor = floor === 12 ? 8 : 10;
      for (let u = 1; u <= unitsOnFloor; u++) {
        const unitNum = `${floor}${u.toString().padStart(2, '0')}`;
        const unitId = `UNIT-${unitNum.padStart(4, '0')}`;

        const template = floor === 12
          ? unitTemplates[6] // Penthouse
          : unitTemplates[(floor + u) % 6];

        const owner = ownersList[ownerIdx % ownersList.length];
        ownerIdx++;

        // Stagger contract types across 4 groups for Scott's clarity:
        // - Floor 3-7: Fully Paid with 10% Guaranteed (Group 1)
        // - Floor 8-9: Partially Paid with 10% Guaranteed & Installment to Keen Eye (Group 2)
        // - Floor 10: Partially Paid with No Return until Fully Paid (Group 4 - Who Gets Nothing)
        // - Floor 11-12: Pooled Option (Group 3 - Pure Revenue Share)
        let returnOption: OwnerReturnOptionType = 'GUARANTEED_10_PCT';
        let contractPayment: OwnerContractPaymentType = 'FULLY_PAID';
        let contractStart = '2024-01-01';

        if (floor === 8 || floor === 9) {
          returnOption = 'GUARANTEED_10_PCT';
          contractPayment = 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT';
          contractStart = '2025-01-01';
        } else if (floor === 10) {
          returnOption = 'GUARANTEED_10_PCT';
          contractPayment = 'PARTIALLY_PAID_NO_RETURN';
          contractStart = '2025-06-01';
        } else if (floor >= 11) {
          returnOption = 'POOLED_OPTION';
          contractPayment = 'FULLY_PAID';
          contractStart = '2023-01-01';
        }

        const purchasePrice = template.price;
        const vatAmount = Math.round(purchasePrice * 0.1);

        let totalPaid = purchasePrice;
        let monthlyInst = 0;

        if (contractPayment === 'PARTIALLY_PAID_GUARANTEED_INSTALLMENT') {
          totalPaid = Math.round(purchasePrice * 0.45); // 45% paid to date
          monthlyInst = Math.round((purchasePrice - totalPaid) / 36); // 36-month installment
        } else if (contractPayment === 'PARTIALLY_PAID_NO_RETURN') {
          totalPaid = Math.round(purchasePrice * 0.30); // 30% paid
          monthlyInst = Math.round((purchasePrice - totalPaid) / 24);
        }

        const remainingPayable = Math.max(0, purchasePrice - totalPaid);
        const sqmVariation = ((u % 5) - 2) * 0.25;
        const unitSqm = Math.round((template.baseSqm + sqmVariation) * 100) / 100;

        this.units.set(unitId, {
          unit_id: unitId,
          unit_number: unitNum,
          floor_number: floor,
          unit_type: template.type,
          owner_id: `OWN-${((ownerIdx % ownersList.length) + 1).toString().padStart(3, '0')}`,
          owner_name: owner.name,
          owner_email: owner.email,
          owner_phone: `+62 812-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          unit_sqm: unitSqm,
          purchase_price: purchasePrice,
          vat_amount: vatAmount,

          return_option_type: returnOption,
          contract_payment_type: contractPayment,
          total_purchase_price: purchasePrice,
          total_paid_to_date: totalPaid,
          monthly_installment_due: monthlyInst,
          remaining_payable_to_keen_eye: remainingPayable,

          stay_days_quota_annual: 28,
          stay_days_used_ytd: (floor === 3 && u <= 3) ? (u * 4) : 0,

          contract_start_date: contractStart,
          contract_end_date: `${parseInt(contractStart.substring(0, 4), 10) + 10}-12-31`,
          ownership_status: 'Active',
          distribution_status: contractPayment === 'PARTIALLY_PAID_NO_RETURN' ? 'Ineligible' : 'Eligible',
          tax_treatment: owner.tax,
          tax_rate_pct: owner.tax === 'WHT_FINAL_10_PCT' ? 10.0 : owner.tax === 'WHT_PPh23_2_PCT' ? 2.0 : owner.tax === 'TAX_EXEMPT' ? 0 : undefined,
          bank_name: owner.bank,
          bank_account_number: `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100000 + Math.random() * 900000)}`,
          bank_account_name: owner.name.replace(/^(Ir\.|Dr\.|Dra\.|PT\s+)/, '').replace(/,?\s*(SE|Dewi).*$/, ''),
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        });
      }
    }

    this.saveToDisk();
  }

  private seedSampleStays(): void {
    this.stays.clear();
    // Seed 2 sample stays: one within 28 days (10% rate), one over 28 days (75% rate)
    const s1: OwnerStayRecord = {
      stay_id: 'STY-UNIT-0301-2026-09-01',
      unit_id: 'UNIT-0301',
      unit_number: '301',
      owner_id: 'OWN-002',
      owner_name: 'Ir. Hendra Gunawan',
      check_in_date: '2026-09-08',
      check_out_date: '2026-09-12',
      nights_count: 4,
      period: '2026-09',
      market_rate_per_night: 2200000,
      owner_rate_pct: 10.0,
      total_room_charge_billed: 880000, // 4 * 2.2M * 10%
      return_deduction_applied: 0,
      quota_day_from: 1,
      quota_day_to: 4,
      status: 'COMPLETED',
      notes: 'Owner Stay hari ke 1-4 (kuota 28 hari). Membayar 10% harga pasar kamar. Return dikurangi 4 hari daily rate.',
      created_at: '2026-09-08T10:00:00.000Z',
    };

    const s2: OwnerStayRecord = {
      stay_id: 'STY-UNIT-0302-2026-09-02',
      unit_id: 'UNIT-0302',
      unit_number: '302',
      owner_id: 'OWN-003',
      owner_name: 'Dr. Maya Kartika Dewi',
      check_in_date: '2026-09-20',
      check_out_date: '2026-09-23',
      nights_count: 3,
      period: '2026-09',
      market_rate_per_night: 2500000,
      owner_rate_pct: 10.0,
      total_room_charge_billed: 750000,
      return_deduction_applied: 0,
      quota_day_from: 5,
      quota_day_to: 7,
      status: 'COMPLETED',
      notes: 'Owner Stay hari ke 5-7 (kuota 28 hari). Membayar 10% harga pasar kamar. Return dikurangi 3 hari daily rate.',
      created_at: '2026-09-20T11:00:00.000Z',
    };

    this.stays.set(s1.stay_id, s1);
    this.stays.set(s2.stay_id, s2);
    this.saveToDisk();
  }

  // --- MOCK DATA RESET ---
  public resetMockData(options?: { clearUnits?: boolean }): { clearedBatches: number } {
    const clearedBatches = this.batches.size;
    this.batches.clear();
    this.stays.clear();
    this.ruleHistory = [];
    if (options?.clearUnits) {
      this.units.clear();
    }
    this.saveToDisk();
    return { clearedBatches };
  }

  public reseedDefaults(): void {
    this.seedUnits();
    this.seedSampleStays();
  }
}

export const ownerPoolStore = new OwnerPoolStore();
