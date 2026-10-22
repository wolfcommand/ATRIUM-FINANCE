/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OwnerPoolAllocationLine, OwnerDistributionBatch } from '../../../types';
import { X, Calculator, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface CalculationDetailModalProps {
  line: OwnerPoolAllocationLine;
  batch: OwnerDistributionBatch;
  onClose: () => void;
}

export const CalculationDetailModal: React.FC<CalculationDetailModalProps> = ({
  line,
  batch,
  onClose,
}) => {
  const formatIDR = (val: number) => `Rp ${Math.round(val).toLocaleString('id-ID')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900/20 text-emerald-700 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Step-by-Step Return Calculation Audit
              </h3>
              <p className="text-xs text-slate-700">
                Unit {line.unit_number} • {line.owner_name} • Period {batch.period}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Unit & Contract Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Unit SQM:</span>
              <span className="font-bold text-slate-800 text-sm">{line.unit_sqm.toFixed(2)} m²</span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Pool SQM:</span>
              <span className="font-bold text-slate-800 text-sm">{batch.total_eligible_sqm.toFixed(2)} m²</span>
            </div>
            <div>
              <span className="text-slate-500 block">Contract Start:</span>
              <span className="font-semibold text-slate-800">{line.contract_start_date}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Contract Year:</span>
              <span className="font-semibold text-slate-800">
                Year {line.contract_year_number} {line.is_within_guarantee_period ? '(Guarantee Active)' : '(Post-Guarantee)'}
              </span>
            </div>
          </div>

          {/* Formula 1: Hotel Room Revenue & 65% Pool Split */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                Formula 1: Hotel Room Revenue Pool Allocation (65%)
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                Effective Rule: {batch.applied_rule_config.owner_pool_pct}% Pool
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded font-mono text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Eligible Room Revenue:</span>
                <span className="font-bold">{formatIDR(batch.room_revenue_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Owner Pool Percentage:</span>
                <span>× {batch.owner_pool_pct}%</span>
              </div>
              <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-indigo-900">
                <span>Total Distributable Owner Pool:</span>
                <span>= {formatIDR(batch.owner_pool_amount)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Note: AMG allocation is {batch.amg_allocation_pct}% ({formatIDR(batch.amg_allocation_amount)}). Room revenue excludes PBJT and Service Charge.
            </p>
          </div>

          {/* Formula 2: Dynamic SQM Pro-Rata Share */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                Formula 2: Unit Pro-Rata SQM Allocation Share
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                Dynamic Basis
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded font-mono text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Unit Floor Area:</span>
                <span>{line.unit_sqm.toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between">
                <span>Total Participating Area ({batch.eligible_units_count} units):</span>
                <span>÷ {batch.total_eligible_sqm.toFixed(2)} m²</span>
              </div>
              <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-blue-900">
                <span>Unit Distribution Share:</span>
                <span>= {(line.allocation_pct * 100).toFixed(4)}%</span>
              </div>
              <div className="flex justify-between pt-1 text-slate-500">
                <span>Pool-Based Return:</span>
                <span>{formatIDR(batch.owner_pool_amount)} × {(line.allocation_pct * 100).toFixed(4)}% = <strong>{formatIDR(line.pool_allocation_amount)}</strong></span>
              </div>
            </div>
          </div>

          {/* Formula 3: Guaranteed Return Calculation (10% Annual on Net-of-VAT) */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Formula 3: Contractual Guaranteed 10% Return
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                line.is_within_guarantee_period ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
              }`}>
                {line.is_within_guarantee_period ? 'Active (Within 3 Years)' : 'Guarantee Period Expired'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded font-mono text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Apartment Purchase Price:</span>
                <span>{formatIDR(line.purchase_price)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Less VAT Amount (Basis Rule):</span>
                <span>- {formatIDR(line.vat_amount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between font-medium">
                <span>Net Return Calculation Basis:</span>
                <span>= {formatIDR(line.return_basis_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Guaranteed Return Rate (Annual):</span>
                <span>× {batch.applied_rule_config.guaranteed_return_rate_pct}%</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Annual Guaranteed Return:</span>
                <span>= {formatIDR(line.annual_guaranteed_return)} / year</span>
              </div>
              <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-emerald-900">
                <span>Monthly Guaranteed Return:</span>
                <span>÷ 12 months = {formatIDR(line.monthly_guaranteed_return)} / month</span>
              </div>
            </div>
          </div>

          {/* Comparison & Applicable Return Resolution */}
          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Comparison: Guaranteed Return vs Actual Pool
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                Rule Applied: {line.applicable_return_basis_type}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded border border-amber-200">
                <span className="text-slate-500 block text-[11px]">Monthly Guaranteed:</span>
                <span className="font-bold text-slate-800 text-sm">{formatIDR(line.monthly_guaranteed_return)}</span>
              </div>
              <div className="p-2.5 bg-white rounded border border-amber-200">
                <span className="text-slate-500 block text-[11px]">Actual Pool Allocation:</span>
                <span className="font-bold text-slate-800 text-sm">{formatIDR(line.pool_allocation_amount)}</span>
              </div>
            </div>
            <div className="p-3 bg-white rounded border border-amber-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-900">
                  Difference ({line.difference_flag}): {formatIDR(Math.abs(line.guarantee_pool_difference))}
                </span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {line.difference_note}
                </p>
              </div>
            </div>
          </div>

          {/* Formula 4: Tax Withholding & Net Payout */}
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Formula 4: Tax Withholding & Net Owner Distribution
            </span>
            <div className="p-3 bg-slate-50 rounded font-mono text-xs text-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span>Applicable Gross Return:</span>
                <span className="font-bold text-slate-900">{formatIDR(line.gross_return_amount)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Tax Withholding ({line.tax_type_label}):</span>
                <span className="text-rose-600 font-semibold">- {formatIDR(line.tax_withheld_amount)} ({line.tax_rate_pct}%)</span>
              </div>
              <div className="border-t-2 border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
                <span>Net Owner Distribution (Payable):</span>
                <span className="text-emerald-700">= {formatIDR(line.net_distribution_amount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Settlement Account: {line.bank_name} - {line.bank_account_number} ({line.bank_account_name})</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Audit Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
