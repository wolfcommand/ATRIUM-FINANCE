/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OwnerUnit, OwnerPoolAllocationLine, OwnerDistributionBatch } from '../../../types';
import { api } from '../../../services/api';
import { AtriumLogo } from '../../common/AtriumLogo';
import {
  FileText,
  Search,
  Printer,
  Building,
  CheckCircle,
  Calendar,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';;
import { createReportExporter, ReportExportFormat } from '../../../utils/excelExporter';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { printReportElement } from '../../../utils/printManager';

export const OwnerStatementView: React.FC = () => {
  const [units, setUnits] = useState<OwnerUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-09');
  const [loading, setLoading] = useState(false);
  const [statementData, setStatementData] = useState<{
    unit: OwnerUnit | null;
    distributionLine: OwnerPoolAllocationLine | null;
    batch: OwnerDistributionBatch | null;
    historicalLines: { period: string; line: OwnerPoolAllocationLine; batchStatus: string }[];
  } | null>(null);

  useEffect(() => {
    api.getOwnerUnits().then((res) => {
      const list = Array.isArray(res?.units) ? res.units : (Array.isArray(res) ? res : []);
      setUnits(list);
      if (list.length > 0 && !selectedUnitId) {
        setSelectedUnitId(list[0].unit_id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedUnitId) return;
    setLoading(true);
    api.getOwnerStatement(selectedUnitId, selectedPeriod)
      .then((res) => {
        setStatementData(res);
      })
      .catch((err) => {
        console.error('Error fetching statement:', err);
      })
      .finally(() => setLoading(false));
  }, [selectedUnitId, selectedPeriod]);

  const handlePrint = () => {
    printReportElement('owner-statement-printable-sheet', {
      title: `Owner_Statement_${unit?.unit_number || 'Unit'}_${selectedPeriod}`,
      orientation: 'portrait',
    });
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    if (!line || !unit) return;

    const rows: (string | number)[][] = [
      ['OWNER & UNIT SPECIFICATIONS', ''],
      ['Owner / Investor', unit.owner_name],
      ['Owner Email', unit.owner_email || '—'],
      ['Unit Number', unit.unit_number],
      ['Unit Type', unit.unit_type],
      ['Floor Number', unit.floor_number],
      ['Unit Area (sqm)', unit.unit_sqm],
      ['Contract Start Date', unit.contract_start_date],
      ['Purchase Price', unit.purchase_price],
      ['Less VAT Deducted', -unit.vat_amount],
      ['Net Return Basis', line.return_basis_amount],
      ['', ''],
      ['HOTEL OPERATIONS & DISTRIBUTABLE POOL', ''],
      ['Total Room Revenue', batch?.room_revenue_amount ?? 0],
      ['Owner Pool', batch?.owner_pool_amount ?? 0],
      ['Operator Allocation', batch?.amg_allocation_amount ?? 0],
      ['', ''],
      ['UNIT ALLOCATION & SETTLEMENT', ''],
      ['Unit Allocation Weight (Sqm Share)', `${(line.allocation_pct * 100).toFixed(4)}%`],
      ['Pool Allocation', line.pool_allocation_amount],
      ['Monthly Guaranteed Return', line.monthly_guaranteed_return],
      ['Gross Return Applied', line.gross_return_amount],
      ['Stay Deduction', -line.stay_deduction_amount],
      [`Tax Withheld (${line.tax_type_label})`, -line.tax_withheld_amount],
      ['Installment Offset to Keen Eye', -line.installment_offset_to_keen_eye],
      ['', ''],
      ['NET DISBURSED TO INVESTOR', line.net_distribution_amount],
    ];

    createReportExporter(format)(
      `Owner_Statement_Unit_${unit.unit_number}_${selectedPeriod}.xlsx`,
      [
        {
          name: `Unit ${unit.unit_number}`,
          title: `MONTHLY RETURN STATEMENT — UNIT ${unit.unit_number}`,
          subtitle: `PT Atrium Management Group • Atrium Suites & Residences Lombok • Period: ${selectedPeriod}`,
          headers: ['Statement Breakdown Item', 'Amount / Detail'],
          rows,
          colWidths: [40, 25],
        },
      ]
    );
  };

  const formatIDR = (val?: number) => {
    if (val === undefined || val === null) return 'Rp 0';
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  const line = statementData?.distributionLine;
  const unit = statementData?.unit;
  const batch = statementData?.batch;

  return (
    <div className="space-y-6">
      {/* Statement Print Stylesheet */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 15mm 10mm;
        }
        @media print {
          header, nav, aside, footer,
          .print\\:hidden,
          button,
          .sidebar,
          #root > header {
            display: none !important;
          }
          html, body {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 9.5pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root, #root > div {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Control / Selector Header (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Unit / Owner:</label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 min-w-[260px]"
            >
              {units.map((u) => (
                <option key={u.unit_id} value={u.unit_id}>
                  Unit {u.unit_number} ({u.unit_sqm}m²) - {u.owner_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Distribution Period:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
            >
              <option value="2026-09">September 2026 (2026-09)</option>
              <option value="2026-08">August 2026 (2026-08)</option>
              <option value="2026-07">July 2026 (2026-07)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ReportExportButtons onExport={handleExportExcel} disabled={!line || !unit} />

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Main Statement Document */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-500 rounded-xl border border-slate-200">
          Loading owner distribution statement...
        </div>
      ) : !line || !unit ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-700 mx-auto" />
          <h3 className="font-bold text-slate-800 text-base">No Posted Distribution Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No active or posted distribution record was found for Unit {units.find((u) => u.unit_id === selectedUnitId)?.unit_number} in period {selectedPeriod}. Please calculate and approve the distribution batch first.
          </p>
        </div>
      ) : (
        <div id="owner-statement-printable-sheet" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden p-8 sm:p-10 space-y-8 font-sans max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
          {/* Statement Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3.5">
              <div className="shrink-0">
                <AtriumLogo variant="arch-only" size="lg" theme="light" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  PT ATRIUM MANAGEMENT GROUP
                </span>
                <p className="text-xs text-amber-800 font-semibold uppercase tracking-wider">
                  Atrium Suites &amp; Residences • Lombok
                </p>
                <p className="text-xs text-slate-500">
                  Jl. Raya Senggigi, Batu Layar, Lombok Barat, NTB
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-800 font-bold text-xs rounded-md uppercase tracking-wider mb-1">
                Monthly Return Statement
              </span>
              <p className="text-xs text-slate-500">
                Statement Period: <strong className="text-slate-800">{batch?.period}</strong>
              </p>
              <p className="text-xs text-slate-500">
                Status:{' '}
                <strong className={batch?.status === 'POSTED' ? 'text-emerald-700' : 'text-amber-700'}>
                  {batch?.status}
                </strong>
              </p>
              {batch?.journal_id && (
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  GL Voucher: {batch.journal_id}
                </p>
              )}
            </div>
          </div>

          {/* Unit & Owner Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 bg-slate-50/80 p-5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Owner / Investor:</span>
              <span className="font-bold text-slate-900 text-sm">{unit.owner_name}</span>
              <span className="text-slate-500 block text-[11px]">{unit.owner_email || 'No email registered'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Unit Specification:</span>
              <span className="font-bold text-slate-900 text-sm">Unit {unit.unit_number}</span>
              <span className="text-slate-500 block text-[11px]">
                {unit.unit_type} • Floor {unit.floor_number} • {unit.unit_sqm.toFixed(2)} m²
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Contract Status:</span>
              <span className="font-bold text-slate-900">
                Year {line.contract_year_number} of 3 ({line.is_within_guarantee_period ? 'Guarantee Active' : 'Post-Guarantee'})
              </span>
              <span className="text-slate-500 block text-[11px]">Since {unit.contract_start_date}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Purchase Price:</span>
              <span className="font-semibold text-slate-800">{formatIDR(unit.purchase_price)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Less VAT Deducted:</span>
              <span className="font-semibold text-slate-800">- {formatIDR(unit.vat_amount)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Net Return Calculation Basis:</span>
              <span className="font-bold text-indigo-900">{formatIDR(line.return_basis_amount)}</span>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Hotel Operations & Distributable Pool
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 text-slate-500">Total Audited Hotel Room Revenue (Gross)</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatIDR(batch?.room_revenue_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-500">
                      Owner Distribution Pool Share ({batch?.owner_pool_pct}%)
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-900">
                      {formatIDR(batch?.owner_pool_amount)}
                    </td>
                  </tr>
                  <tr className="text-slate-500">
                    <td className="py-2 px-4 text-[11px]">AMG Hotel Operator Allocation ({batch?.amg_allocation_pct}%)</td>
                    <td className="py-2 px-4 text-right font-mono text-[11px]">
                      {formatIDR(batch?.amg_allocation_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Unit Return Calculations & Entitlement
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800">SQM-Based Pool Allocation</span>
                      <span className="block text-[11px] text-slate-500">
                        {unit.unit_sqm} m² ÷ {batch?.total_eligible_sqm} m² = {(line.allocation_pct * 100).toFixed(4)}% of pool
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatIDR(line.pool_allocation_amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800">Contractual Guaranteed Return (10% Annual)</span>
                      <span className="block text-[11px] text-slate-500">
                        Basis {formatIDR(line.return_basis_amount)} × 10% ÷ 12 months
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatIDR(line.monthly_guaranteed_return)}
                    </td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-amber-900">
                        Comparison & Return Applied ({line.applicable_return_basis_type})
                      </span>
                      <span className="block text-[11px] text-amber-700">
                        {line.difference_note}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">
                      {line.difference_flag === 'SHORTFALL' ? '-' : '+'} {formatIDR(Math.abs(line.guarantee_pool_difference))}
                    </td>
                  </tr>
                  <tr className="bg-slate-100/70 font-semibold">
                    <td className="py-3 px-4 text-slate-900">Applicable Gross Owner Return</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatIDR(line.gross_return_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tax & Net Payout */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Tax Withholding & Net Disbursement
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800">
                        Tax Withholding: {line.tax_type_label}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Statutory withholding tax deducted at source
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-rose-600">
                      - {formatIDR(line.tax_withheld_amount)} ({line.tax_rate_pct}%)
                    </td>
                  </tr>
                  <tr className="bg-emerald-50 border-t-2 border-emerald-600">
                    <td className="py-4 px-4">
                      <span className="text-sm font-bold text-emerald-950 block">
                        Net Owner Distribution Payable
                      </span>
                      <span className="text-xs text-emerald-700">
                        Cleared for electronic bank settlement
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-lg font-black text-emerald-800">
                      {formatIDR(line.net_distribution_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Banking / Settlement Info */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800">Beneficiary Banking Details:</span>
              <p className="text-slate-500">
                {unit.bank_name} • Acc: <strong className="font-mono">{unit.bank_account_number}</strong>
              </p>
              <p className="text-slate-500 text-[11px]">A/N: {unit.bank_account_name || unit.owner_name}</p>
            </div>
            <div className="text-right sm:text-right">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4" /> Verified Financial Record
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Processed via PT Atrium Management Group ERP
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
