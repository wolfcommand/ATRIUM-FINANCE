/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import {
  StaffEmployee,
  ServiceChargeCollection,
  ServiceChargeDistributionCycle,
  ServiceChargeStaffAllocationLine,
  ServiceChargeKPIs,
} from '../src/types';
import { store as accountingStore } from './store';

const DATA_FILE = path.join(process.cwd(), 'data', 'service_charge.json');

export class ServiceChargeStore {
  public employees: Map<string, StaffEmployee> = new Map();
  public collections: Map<string, ServiceChargeCollection> = new Map();
  public cycles: Map<string, ServiceChargeDistributionCycle> = new Map();

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

        if (Array.isArray(parsed.employees)) {
          parsed.employees.forEach((emp: StaffEmployee) => this.employees.set(emp.employee_id, emp));
        }
        if (Array.isArray(parsed.collections)) {
          parsed.collections.forEach((col: ServiceChargeCollection) => this.collections.set(col.collection_id, col));
        }
        if (Array.isArray(parsed.cycles)) {
          parsed.cycles.forEach((cyc: ServiceChargeDistributionCycle) => this.cycles.set(cyc.cycle_id, cyc));
        }
      } catch (err) {
        console.error('Failed to parse data/service_charge.json, seeding defaults:', err);
        this.seedDefaults();
      }
    } else {
      this.seedDefaults();
    }
  }

  public saveToDisk(): void {
    try {
      const payload = {
        employees: Array.from(this.employees.values()),
        collections: Array.from(this.collections.values()),
        cycles: Array.from(this.cycles.values()),
        saved_at: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving data/service_charge.json:', err);
    }
  }

  // --- EMPLOYEES & GRADE POINTS REGISTRY ---

  public getEmployees(): StaffEmployee[] {
    return Array.from(this.employees.values()).sort((a, b) => {
      if (a.department_code !== b.department_code) {
        return a.department_code.localeCompare(b.department_code);
      }
      return b.base_points - a.base_points;
    });
  }

  public saveEmployee(empData: Partial<StaffEmployee> & { employee_name: string; department_code: string }): StaffEmployee {
    const employee_id = empData.employee_id || `EMP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const existing = this.employees.get(employee_id);

    const gradePointsMap: Record<string, number> = {
      'Grade 1': 1.0,
      'Grade 2': 1.2,
      'Grade 3': 1.5,
      'Grade 4': 1.8,
      'Grade 5': 2.2,
    };

    const gradeLevel = empData.grade_level || existing?.grade_level || 'Grade 2';
    const basePoints = empData.base_points !== undefined ? empData.base_points : (gradePointsMap[gradeLevel] || 1.2);

    const employee: StaffEmployee = {
      employee_id,
      employee_name: empData.employee_name.trim(),
      department_code: empData.department_code,
      job_title: empData.job_title || existing?.job_title || 'Hospitality Associate',
      grade_level: gradeLevel,
      base_points: basePoints,
      hire_date: empData.hire_date || existing?.hire_date || new Date().toISOString().substring(0, 10),
      employment_status: empData.employment_status || existing?.employment_status || 'Permanent',
      bank_account_number: empData.bank_account_number || existing?.bank_account_number || 'BCA-902-88192',
      bank_name: empData.bank_name || existing?.bank_name || 'Bank Central Asia (BCA)',
      is_eligible: empData.is_eligible !== undefined ? empData.is_eligible : (existing?.is_eligible ?? true),
      active: empData.active || existing?.active || 'Y',
      notes: empData.notes ?? existing?.notes ?? '',
    };

    this.employees.set(employee_id, employee);
    this.saveToDisk();
    return employee;
  }

  public deleteEmployee(employeeId: string): { success: boolean } {
    const emp = this.employees.get(employeeId);
    if (!emp) throw new Error(`Employee ${employeeId} not found`);
    // Soft deactivate
    emp.active = 'N';
    this.employees.set(employeeId, emp);
    this.saveToDisk();
    return { success: true };
  }

  // --- GUEST CHECK SERVICE CHARGE COLLECTIONS (INFLOW TRANCHES) ---

  public getCollections(period?: string): ServiceChargeCollection[] {
    const all = Array.from(this.collections.values());
    const filtered = period ? all.filter((c) => c.period === period) : all;
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }

  public async recordCollection(params: {
    date: string;
    source: ServiceChargeCollection['source'];
    department_code: string;
    gross_sales_amount: number;
    service_charge_rate_pct?: number;
    reference_no?: string;
    notes?: string;
    auto_post_journal?: boolean;
  }): Promise<{ collection: ServiceChargeCollection; journal?: any }> {
    if (!params.date) throw new Error('Collection date is required');
    if (params.gross_sales_amount <= 0) throw new Error('Gross sales amount must be positive');

    const rate = params.service_charge_rate_pct !== undefined ? params.service_charge_rate_pct : 10.0;
    const service_charge_amount = Math.round(params.gross_sales_amount * (rate / 100));

    const collection_id = `SCC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const period = params.date.substring(0, 7);

    let journalId: string | undefined;

    // If requested, generate automated balanced Journal:
    // Debit 1020 (Guest Ledger Clearing / Cash in Transit)
    // Credit 2030 (Staff Service Charge Fund - Trust Liability)
    if (params.auto_post_journal) {
      journalId = `JRN-SC-IN-${collection_id.slice(-6)}`;
      try {
        accountingStore.ensureServiceChargeAccounts();
        await accountingStore.createJournal(
          {
            journal_id: journalId,
            journal_date: params.date,
            period,
            source_type: 'REVENUE',
            source_reference: collection_id,
            created_by: 'Service Charge Collection Ingestion',
          },
          [
            {
              account_code: '1020',
              department_code: params.department_code,
              debit: service_charge_amount,
              credit: 0,
              description: `Guest Folio 10% Service Charge Tranche (${params.source}): ${params.reference_no || collection_id}`,
            },
            {
              account_code: '2030',
              department_code: params.department_code,
              debit: 0,
              credit: service_charge_amount,
              description: `Staff Service Charge Trust Liability Pool (${rate}% of Rp${params.gross_sales_amount.toLocaleString()})`,
            },
          ]
        );
      } catch (jErr) {
        console.warn('Could not auto-generate collection journal:', jErr);
      }
    }

    const collection: ServiceChargeCollection = {
      collection_id,
      date: params.date,
      period,
      source: params.source,
      department_code: params.department_code,
      gross_sales_amount: params.gross_sales_amount,
      service_charge_rate_pct: rate,
      service_charge_amount,
      reference_no: params.reference_no || `FOL-${Date.now().toString().slice(-5)}`,
      status: 'ACCRUED',
      journal_id: journalId,
      notes: params.notes || '',
    };

    this.collections.set(collection_id, collection);
    this.saveToDisk();
    return { collection };
  }

  // --- MONTH-END DISTRIBUTION POOL ENGINE ---

  public getCycles(): ServiceChargeDistributionCycle[] {
    return Array.from(this.cycles.values()).sort((a, b) => b.period.localeCompare(a.period));
  }

  public getCycle(cycleId: string): ServiceChargeDistributionCycle | null {
    return this.cycles.get(cycleId) || null;
  }

  /**
   * Calculates the distribution pool for a given month based on:
   * 1. Total service charge collections accrued
   * 2. Retention allowance (0% to 5% breakage/reserve)
   * 3. Staff base points + seniority bonus (+5%/yr, max 25%)
   * 4. Prorated days worked / calendar days
   * 5. Point Value Rate = Distributable Pool / Total Weighted Points
   */
  public calculateDistribution(params: {
    period: string; // e.g. 2026-08
    company_retention_pct?: number; // e.g. 0% or 5%
    custom_pool_amount?: number; // Optional manual override if using offline books
    title?: string;
    standard_calendar_days?: number;
    staff_days_override?: Record<string, number>; // employee_id -> days worked
  }): ServiceChargeDistributionCycle {
    const period = params.period;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('Valid period (YYYY-MM) is required for Service Charge distribution');
    }

    const retentionPct = params.company_retention_pct !== undefined ? params.company_retention_pct : 0;
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Calculate calendar days in target month
    const calendarDays = params.standard_calendar_days || new Date(year, month, 0).getDate();

    // 1. Gather all collections for this period
    const periodCollections = Array.from(this.collections.values()).filter((c) => c.period === period);
    const totalCollected = params.custom_pool_amount !== undefined
      ? params.custom_pool_amount
      : periodCollections.reduce((sum, c) => sum + c.service_charge_amount, 0);

    const retentionAmount = Math.round(totalCollected * (retentionPct / 100));
    const priorCarryover = 0;
    const distributablePool = totalCollected - retentionAmount + priorCarryover;

    // 2. Identify eligible active operational staff
    const eligibleEmployees = Array.from(this.employees.values()).filter(
      (emp) => emp.active === 'Y' && emp.is_eligible
    );

    if (eligibleEmployees.length === 0) {
      throw new Error('No active eligible operational staff found in the employee registry.');
    }

    const todayMs = new Date(year, month - 1, calendarDays).getTime();

    // 3. Compute points and allocation lines for each staff
    const lines: ServiceChargeStaffAllocationLine[] = eligibleEmployees.map((emp) => {
      // Calculate full years of service as of period close
      const hireDateMs = new Date(emp.hire_date).getTime();
      const diffYears = (todayMs - hireDateMs) / (365.25 * 24 * 3600 * 1000);
      const yearsOfService = Math.max(0, Math.floor(diffYears));

      // Seniority bonus: +5% per full year, capped at 25% (5 years)
      const seniorityBonusPct = Math.min(25, yearsOfService * 5);

      // Attendance: Days worked vs standard calendar days
      const daysWorked = params.staff_days_override?.[emp.employee_id] !== undefined
        ? Math.min(calendarDays, Math.max(0, params.staff_days_override[emp.employee_id]))
        : calendarDays; // Default 100% attendance

      const attendanceRatio = Math.round((daysWorked / calendarDays) * 1000) / 1000;

      // Effective weighted points
      const effectivePoints = Math.round(
        emp.base_points * (1 + seniorityBonusPct / 100) * attendanceRatio * 100
      ) / 100;

      return {
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        department_code: emp.department_code,
        job_title: emp.job_title,
        grade_level: emp.grade_level,
        base_points: emp.base_points,
        years_of_service: yearsOfService,
        seniority_bonus_pct: seniorityBonusPct,
        standard_calendar_days: calendarDays,
        days_worked: daysWorked,
        attendance_ratio: attendanceRatio,
        effective_points: effectivePoints,
        point_value_rate: 0,
        gross_payout: 0,
        tax_withholding_pct: 5.0, // 5% standard withholding tax (PPh 21)
        tax_withheld_amount: 0,
        net_payout: 0,
        payout_status: 'PENDING',
      };
    });

    const totalWeightedPoints = Math.round(lines.reduce((sum, l) => sum + l.effective_points, 0) * 100) / 100;

    // 4. Calculate Point Value Rate (Rp per point)
    const pointValueRate = totalWeightedPoints > 0
      ? Math.floor(distributablePool / totalWeightedPoints)
      : 0;

    // 5. Finalize individual staff payouts
    let totalGrossPayout = 0;
    let totalTaxWithheld = 0;
    let totalNetPayout = 0;

    lines.forEach((line) => {
      line.point_value_rate = pointValueRate;
      line.gross_payout = Math.round(line.effective_points * pointValueRate);
      line.tax_withheld_amount = Math.round(line.gross_payout * (line.tax_withholding_pct / 100));
      line.net_payout = line.gross_payout - line.tax_withheld_amount;

      totalGrossPayout += line.gross_payout;
      totalTaxWithheld += line.tax_withheld_amount;
      totalNetPayout += line.net_payout;
    });

    const reserveBalanceRetained = distributablePool - totalGrossPayout;

    const cycleId = `SC-${period}`;
    const cycle: ServiceChargeDistributionCycle = {
      cycle_id: cycleId,
      period,
      title: params.title || `${new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })} Staff Service Charge Distribution Pool`,
      status: 'CALCULATED',
      total_collected_amount: totalCollected,
      company_retention_pct: retentionPct,
      company_retention_amount: retentionAmount,
      prior_reserve_carryover: priorCarryover,
      distributable_pool_amount: distributablePool,
      total_staff_count: lines.length,
      total_weighted_points: totalWeightedPoints,
      point_value_rate: pointValueRate,
      total_gross_payout: totalGrossPayout,
      total_tax_withheld: totalTaxWithheld,
      total_net_payout: totalNetPayout,
      reserve_balance_retained: Math.max(0, reserveBalanceRetained),
      created_by: 'Financial Controller (Distribution Engine)',
      lines,
    };

    this.cycles.set(cycleId, cycle);
    this.saveToDisk();
    return cycle;
  }

  /**
   * Approves the distribution cycle and generates an audit-ready, balanced
   * double-entry journal posting to the USALI General Ledger:
   *
   * DEBIT:  2030 - Staff Service Charge Fund (Trust Liability)  [Distributable Pool]
   * CREDIT: 2020 - Accrued Payroll & Staff Liabilities          [Net Staff Payout by Dept]
   * CREDIT: 2040 - Tax Payable - Employee Withholding (PPh 21)  [Tax Withheld]
   */
  public async approveAndPostDistribution(
    cycleId: string,
    approverName: string = 'Financial Controller'
  ): Promise<{ cycle: ServiceChargeDistributionCycle; journal: any }> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) throw new Error(`Distribution cycle ${cycleId} not found`);

    if (cycle.status === 'POSTED_TO_PAYROLL') {
      throw new Error(`Cycle ${cycleId} is already posted to General Ledger and Payroll.`);
    }

    accountingStore.ensureServiceChargeAccounts();

    // Group net payout by department for USALI departmental schedule alignment
    const deptTotals: Record<string, number> = {};
    cycle.lines.forEach((l) => {
      deptTotals[l.department_code] = (deptTotals[l.department_code] || 0) + l.net_payout;
    });

    const journalLines: {
      account_code: string;
      department_code: string;
      debit: number;
      credit: number;
      description: string;
    }[] = [];

    // 1. DEBIT Trust Liability 2030 for total distributed gross
    journalLines.push({
      account_code: '2030',
      department_code: '700', // Admin / Finance general
      debit: cycle.total_gross_payout,
      credit: 0,
      description: `Month-End Service Charge Pool Disbursal: ${cycle.period} (${cycle.total_staff_count} staff @ Rp${cycle.point_value_rate.toLocaleString()}/pt)`,
    });

    // 2. CREDIT Accrued Payroll 2020 by operating department
    for (const [deptCode, amount] of Object.entries(deptTotals)) {
      if (amount > 0) {
        const deptObj = accountingStore.departments.get(deptCode);
        const deptName = deptObj ? deptObj.department_name : `Dept ${deptCode}`;
        journalLines.push({
          account_code: '2020',
          department_code: deptCode,
          debit: 0,
          credit: amount,
          description: `Staff Service Charge Net Payout: ${deptName} (${cycle.period})`,
        });
      }
    }

    // 3. CREDIT Tax Payable 2040 for withholding tax (PPh 21)
    if (cycle.total_tax_withheld > 0) {
      journalLines.push({
        account_code: '2040',
        department_code: '700',
        debit: 0,
        credit: cycle.total_tax_withheld,
        description: `Employee Withholding Tax (PPh 21 on Service Charge): ${cycle.period}`,
      });
    }

    const journalId = `JRN-SC-DIST-${cycle.period}`;
    const draftJournal = await accountingStore.createJournal(
      {
        journal_id: journalId,
        journal_date: `${cycle.period}-28`, // Month-end payroll cut-off
        period: cycle.period,
        source_type: 'SPENDING',
        source_reference: cycle.cycle_id,
        created_by: approverName,
      },
      journalLines
    );

    // Validate and auto-post the balanced journal
    try {
      await accountingStore.validateJournal(journalId);
      await accountingStore.postJournal(journalId, { autoApprove: true, approver: approverName });
    } catch (postErr) {
      console.warn('Auto-post warning for service charge journal:', postErr);
    }

    // Update cycle state
    cycle.status = 'POSTED_TO_PAYROLL';
    cycle.approved_by = approverName;
    cycle.posted_at = new Date().toISOString();
    cycle.journal_id = journalId;
    cycle.reconciliation_notes = `Successfully reconciled: Trust Liability pool debited Rp${cycle.total_gross_payout.toLocaleString()} across ${cycle.total_staff_count} operational employees. Posted to General Ledger under ${journalId}.`;

    cycle.lines.forEach((l) => {
      l.payout_status = 'DISBURSED';
    });

    // Mark collections as DISTRIBUTED
    for (const col of this.collections.values()) {
      if (col.period === cycle.period) {
        col.status = 'DISTRIBUTED';
      }
    }

    this.cycles.set(cycleId, cycle);
    this.saveToDisk();

    return { cycle, journal: draftJournal };
  }

  // --- EXECUTIVE & AUDIT KPIS ---

  public getKPIs(): ServiceChargeKPIs {
    accountingStore.ensureServiceChargeAccounts();
    const gl = accountingStore.getGeneralLedger({ account_code: '2030' });
    const scAccountBalance = Math.abs(gl.ending_balance) || 0;

    const currentPeriod = new Date().toISOString().substring(0, 7);
    const periodCollections = Array.from(this.collections.values()).filter((c) => c.period === currentPeriod);
    const currentPeriodSum = periodCollections.reduce((sum, c) => sum + c.service_charge_amount, 0);

    const eligibleStaff = Array.from(this.employees.values()).filter((e) => e.active === 'Y' && e.is_eligible);
    const totalEstPoints = eligibleStaff.reduce((s, e) => s + e.base_points, 0);

    const estPointValue = totalEstPoints > 0 ? Math.floor(currentPeriodSum / totalEstPoints) : 0;

    // Find last distributed cycle
    const completedCycles = Array.from(this.cycles.values())
      .filter((c) => c.status === 'POSTED_TO_PAYROLL')
      .sort((a, b) => b.period.localeCompare(a.period));

    const lastCycle = completedCycles[0];
    const totalAllTime = completedCycles.reduce((s, c) => s + c.total_gross_payout, 0);

    // Department breakdown
    const deptMap: Record<string, { count: number; amount: number }> = {};
    if (lastCycle) {
      lastCycle.lines.forEach((l) => {
        if (!deptMap[l.department_code]) deptMap[l.department_code] = { count: 0, amount: 0 };
        deptMap[l.department_code].count += 1;
        deptMap[l.department_code].amount += l.net_payout;
      });
    } else {
      eligibleStaff.forEach((e) => {
        if (!deptMap[e.department_code]) deptMap[e.department_code] = { count: 0, amount: 0 };
        deptMap[e.department_code].count += 1;
      });
    }

    const deptBreakdown = Object.entries(deptMap).map(([code, data]) => {
      const d = accountingStore.departments.get(code);
      return {
        department_code: code,
        department_name: d?.department_name || `Dept ${code}`,
        staff_count: data.count,
        allocated_amount: data.amount,
      };
    });

    return {
      trust_liability_balance: Math.abs(scAccountBalance) > 0 ? Math.abs(scAccountBalance) : currentPeriodSum,
      current_period_collections: currentPeriodSum,
      active_eligible_staff: eligibleStaff.length,
      estimated_point_value: estPointValue,
      last_distributed_amount: lastCycle?.total_gross_payout || 0,
      last_distributed_point_value: lastCycle?.point_value_rate || 0,
      total_all_time_distributed: totalAllTime,
      department_breakdown: deptBreakdown,
    };
  }

  // --- SEED DEFAULTS (REALISTIC HOSPITALITY STAFF & TRANCHES) ---

  public seedDefaults(): void {
    const defaultStaff: StaffEmployee[] = [
      // Rooms Department (100)
      {
        employee_id: 'EMP-100-01',
        employee_name: 'Wayan Darmayasa',
        department_code: '100',
        job_title: 'Duty Manager / Night Auditor',
        grade_level: 'Grade 5',
        base_points: 2.2,
        hire_date: '2021-03-15',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-883-10291',
        bank_name: 'BCA Bali',
        is_eligible: true,
        active: 'Y',
        notes: 'Exemplary attendance, certified USALI auditor',
      },
      {
        employee_id: 'EMP-100-02',
        employee_name: 'Ni Kadek Ayu Lestari',
        department_code: '100',
        job_title: 'Front Desk Shift Supervisor',
        grade_level: 'Grade 4',
        base_points: 1.8,
        hire_date: '2022-06-01',
        employment_status: 'Permanent',
        bank_account_number: 'Mandiri-142-00918',
        bank_name: 'Bank Mandiri',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-100-03',
        employee_name: 'I Gede Putu Pratama',
        department_code: '100',
        job_title: 'Guest Service Agent (GSA)',
        grade_level: 'Grade 3',
        base_points: 1.5,
        hire_date: '2023-01-10',
        employment_status: 'Permanent',
        bank_account_number: 'BNI-081-22910',
        bank_name: 'BNI',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-100-04',
        employee_name: 'Ni Luh Made Sukasari',
        department_code: '100',
        job_title: 'Executive Housekeeper Assistant',
        grade_level: 'Grade 4',
        base_points: 1.8,
        hire_date: '2021-08-20',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-771-44019',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-100-05',
        employee_name: 'I Ketut Suartana',
        department_code: '100',
        job_title: 'Senior Room Attendant',
        grade_level: 'Grade 2',
        base_points: 1.2,
        hire_date: '2022-11-15',
        employment_status: 'Permanent',
        bank_account_number: 'BRI-330-10928',
        bank_name: 'BRI',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-100-06',
        employee_name: 'Komang Arya Wijaya',
        department_code: '100',
        job_title: 'Bellman / Concierge Porter',
        grade_level: 'Grade 2',
        base_points: 1.2,
        hire_date: '2024-02-01',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-992-01827',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-100-07',
        employee_name: 'Dewi Anggreni',
        department_code: '100',
        job_title: 'Linen & Uniform Attendant',
        grade_level: 'Grade 1',
        base_points: 1.0,
        hire_date: '2024-05-12',
        employment_status: 'Contract',
        bank_account_number: 'CIMB-551-09182',
        bank_name: 'CIMB Niaga',
        is_eligible: true,
        active: 'Y',
      },

      // Food & Beverage Department (200)
      {
        employee_id: 'EMP-200-01',
        employee_name: 'Chef Bambang Suryono',
        department_code: '200',
        job_title: 'Executive Sous Chef',
        grade_level: 'Grade 5',
        base_points: 2.2,
        hire_date: '2021-01-05',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-102-99881',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-02',
        employee_name: 'Agus Wijaya Putra',
        department_code: '200',
        job_title: 'Restaurant Captain & Sommelier',
        grade_level: 'Grade 4',
        base_points: 1.8,
        hire_date: '2022-04-10',
        employment_status: 'Permanent',
        bank_account_number: 'Mandiri-901-22910',
        bank_name: 'Bank Mandiri',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-03',
        employee_name: 'I Made Bayu Anggoro',
        department_code: '200',
        job_title: 'Head Mixologist / Bartender',
        grade_level: 'Grade 3',
        base_points: 1.5,
        hire_date: '2023-03-01',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-448-91028',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-04',
        employee_name: 'Rahmat Santosa',
        department_code: '200',
        job_title: 'Chef de Partie (Hot Kitchen)',
        grade_level: 'Grade 4',
        base_points: 1.8,
        hire_date: '2022-09-15',
        employment_status: 'Permanent',
        bank_account_number: 'BNI-551-09827',
        bank_name: 'BNI',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-05',
        employee_name: 'Siti Rahmawati',
        department_code: '200',
        job_title: 'Food & Beverage Waitress',
        grade_level: 'Grade 2',
        base_points: 1.2,
        hire_date: '2023-07-20',
        employment_status: 'Permanent',
        bank_account_number: 'BRI-102-88712',
        bank_name: 'BRI',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-06',
        employee_name: 'Teguh Prasetyo',
        department_code: '200',
        job_title: 'Commis Pastry Cook',
        grade_level: 'Grade 2',
        base_points: 1.2,
        hire_date: '2024-01-15',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-882-90128',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-200-07',
        employee_name: 'Hadi Gunawan',
        department_code: '200',
        job_title: 'Kitchen Steward (Hygiene)',
        grade_level: 'Grade 1',
        base_points: 1.0,
        hire_date: '2024-03-01',
        employment_status: 'Contract',
        bank_account_number: 'Danamon-992-18271',
        bank_name: 'Bank Danamon',
        is_eligible: true,
        active: 'Y',
      },

      // Spa & Recreation Department (300)
      {
        employee_id: 'EMP-300-01',
        employee_name: 'Ni Made Ratnadi',
        department_code: '300',
        job_title: 'Lead Ayurvedic Spa Therapist',
        grade_level: 'Grade 3',
        base_points: 1.5,
        hire_date: '2022-02-14',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-718-29910',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-300-02',
        employee_name: 'Ida Bagus Manuaba',
        department_code: '300',
        job_title: 'Pool & Recreation Attendant',
        grade_level: 'Grade 2',
        base_points: 1.2,
        hire_date: '2023-09-01',
        employment_status: 'Permanent',
        bank_account_number: 'Mandiri-771-09281',
        bank_name: 'Bank Mandiri',
        is_eligible: true,
        active: 'Y',
      },

      // Property Operation & Maintenance (800)
      {
        employee_id: 'EMP-800-01',
        employee_name: 'Ir. Agus Hendrawan',
        department_code: '800',
        job_title: 'Assistant Chief Engineer',
        grade_level: 'Grade 5',
        base_points: 2.2,
        hire_date: '2021-05-10',
        employment_status: 'Permanent',
        bank_account_number: 'BCA-901-88271',
        bank_name: 'BCA',
        is_eligible: true,
        active: 'Y',
      },
      {
        employee_id: 'EMP-800-02',
        employee_name: 'Danang Saputra',
        department_code: '800',
        job_title: 'HVAC & Electrical Technician',
        grade_level: 'Grade 3',
        base_points: 1.5,
        hire_date: '2022-10-01',
        employment_status: 'Permanent',
        bank_account_number: 'BNI-102-88271',
        bank_name: 'BNI',
        is_eligible: true,
        active: 'Y',
      },
    ];

    this.employees.clear();
    defaultStaff.forEach((s) => this.employees.set(s.employee_id, s));

    // Seed realistic Guest Folio 10% Service Charge Inflow Tranches for 2026-08
    const defaultCollections: ServiceChargeCollection[] = [
      {
        collection_id: 'SCC-202608-01',
        date: '2026-08-05',
        period: '2026-08',
        source: 'PMS_ROOMS',
        department_code: '100',
        gross_sales_amount: 145000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 14500000,
        reference_no: 'PMS-AUDIT-20260805',
        status: 'ACCRUED',
        notes: 'Rooms Guest Ledger 10% Tranche',
      },
      {
        collection_id: 'SCC-202608-02',
        date: '2026-08-10',
        period: '2026-08',
        source: 'POS_FB',
        department_code: '200',
        gross_sales_amount: 98000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 9800000,
        reference_no: 'POS-REST-20260810',
        status: 'ACCRUED',
        notes: 'Atrium Dining & Lounge POS checks',
      },
      {
        collection_id: 'SCC-202608-03',
        date: '2026-08-15',
        period: '2026-08',
        source: 'BANQUETS_MICE',
        department_code: '200',
        gross_sales_amount: 210000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 21000000,
        reference_no: 'BQT-EVENT-ASEAN-08',
        status: 'ACCRUED',
        notes: 'ASEAN Business Summit Banquet Dinner',
      },
      {
        collection_id: 'SCC-202608-04',
        date: '2026-08-20',
        period: '2026-08',
        source: 'PMS_ROOMS',
        department_code: '100',
        gross_sales_amount: 165000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 16500000,
        reference_no: 'PMS-AUDIT-20260820',
        status: 'ACCRUED',
        notes: 'Mid-month Rooms In-House Folios',
      },
      {
        collection_id: 'SCC-202608-05',
        date: '2026-08-25',
        period: '2026-08',
        source: 'POS_SPA',
        department_code: '300',
        gross_sales_amount: 32000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 3200000,
        reference_no: 'SPA-POS-20260825',
        status: 'ACCRUED',
        notes: 'Spa & Wellness packages',
      },
      {
        collection_id: 'SCC-202608-06',
        date: '2026-08-28',
        period: '2026-08',
        source: 'POS_FB',
        department_code: '200',
        gross_sales_amount: 70000000,
        service_charge_rate_pct: 10.0,
        service_charge_amount: 7000000,
        reference_no: 'POS-BAR-20260828',
        status: 'ACCRUED',
        notes: 'Sunset Bar & Terrace weekend revenue',
      },
    ];

    this.collections.clear();
    defaultCollections.forEach((c) => this.collections.set(c.collection_id, c));

    // Pre-calculate August 2026 Cycle
    this.calculateDistribution({
      period: '2026-08',
      company_retention_pct: 0,
      title: 'August 2026 Staff Service Charge Distribution Pool',
    });

    this.saveToDisk();
  }

  // --- MOCK DATA RESET ---
  public resetMockData(options?: { clearEmployees?: boolean }): { clearedCollections: number; clearedCycles: number } {
    const clearedCollections = this.collections.size;
    const clearedCycles = this.cycles.size;
    this.collections.clear();
    this.cycles.clear();
    if (options?.clearEmployees) {
      this.employees.clear();
    }
    this.saveToDisk();
    return { clearedCollections, clearedCycles };
  }
}

export const serviceChargeStore = new ServiceChargeStore();
