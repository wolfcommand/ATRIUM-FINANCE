/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Printer,
  X,
  Building,
  CheckCircle2,
  Calendar,
  Warehouse,
  FileText,
  Coins,
  ExternalLink,
  ShieldCheck,
  ShoppingCart,
  PackageCheck,
  User,
  Clock,
  Tag,
  AlertCircle,
} from 'lucide-react';;
import {
  DepartmentRequisition,
  InventoryItem,
  InventoryStoreroom,
  Department,
} from '../../types';
import { AtriumLogo } from '../common/AtriumLogo';
import { createReportExporter, ReportExportFormat , withTotal } from '../../utils/excelExporter';
import { ReportExportButtons } from '../reports/ReportExportButtons';
import { printReportElement } from '../../utils/printManager';

interface PurchaseRequisitionDocumentModalProps {
  requisition: DepartmentRequisition;
  departments: Department[];
  storerooms: InventoryStoreroom[];
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onApprove?: (req: DepartmentRequisition) => void;
  onCreatePo?: (requisitionId: string) => void;
  onIssueStock?: (req: DepartmentRequisition) => void;
  onViewJournal?: (journalId: string) => void;
}

export const PurchaseRequisitionDocumentModal: React.FC<PurchaseRequisitionDocumentModalProps> = ({
  requisition,
  departments,
  storerooms,
  inventoryItems,
  onClose,
  onApprove,
  onCreatePo,
  onIssueStock,
  onViewJournal,
}) => {
  // Configurable Letterhead metadata
  const [hotelName] = useState('PT ATRIUM MANAGEMENT GROUP');
  const [hotelDivision] = useState('Hospitality Operations & Procurement Directorate');
  const [hotelAddress] = useState('Jl. Raya Senggigi, Batu Layar, Lombok Barat, NTB 83355');
  const [hotelTaxId] = useState('01.345.678.9-541.000');
  const [hotelPhone] = useState('+62 370 612-8888');
  const [hotelEmail] = useState('purchasing@atriumresort.com');

  const dept = departments.find((d) => d.department_code === requisition.department_code);
  const storeroom = storerooms.find((s) => s.storeroom_id === requisition.storeroom_id);

  const totalRequestedQty = requisition.items.reduce((s, it) => s + (it.requested_quantity || 0), 0);
  const totalApprovedQty = requisition.items.reduce(
    (s, it) => s + (it.approved_quantity !== undefined ? it.approved_quantity : it.requested_quantity),
    0
  );

  const totalEstimatedCost = requisition.items.reduce((sum, line) => {
    const item = inventoryItems.find((i) => i.item_id === line.item_id);
    const unitPrice = line.unit_cost || item?.average_cost || item?.last_purchase_price || 0;
    const qty = line.approved_quantity !== undefined ? line.approved_quantity : line.requested_quantity;
    return sum + (qty * unitPrice);
  }, 0);

  const handlePrint = () => {
    printReportElement('requisition-printable-document', {
      title: `PR_${requisition.requisition_id}_${requisition.department_code}`,
      property: hotelName,
      orientation: 'portrait',
    });
  };

  const handleExportExcel = (format: ReportExportFormat = 'xlsx') => {
    const rows: (string | number)[][] = requisition.items.map((line, idx) => {
      const invItem = inventoryItems.find((i) => i.item_id === line.item_id);
      const unitPrice = line.unit_cost || invItem?.average_cost || 0;
      const qty = line.approved_quantity !== undefined ? line.approved_quantity : line.requested_quantity;
      return [
        idx + 1,
        line.item_code || invItem?.item_code || '',
        line.item_name || invItem?.item_name || '',
        line.uom || invItem?.uom || '',
        line.requested_quantity,
        line.approved_quantity !== undefined ? line.approved_quantity : line.requested_quantity,
        unitPrice,
        qty * unitPrice,
      ];
    });

    withTotal(rows, [
      'TOTAL',
      '',
      '',
      '',
      totalRequestedQty,
      totalApprovedQty,
      'Total Estimated Cost',
      totalEstimatedCost,
    ]);

    createReportExporter(format)(`PR_${requisition.requisition_id}_PT_Atrium_Management_Group.xlsx`, [
      {
        name: `PR ${requisition.requisition_id}`.slice(0, 31),
        title: `DEPARTMENT PURCHASE REQUISITION — ${requisition.requisition_id}`,
        subtitle: `Dept: ${dept?.department_name || requisition.department_name} | Requester: ${requisition.requester_name} | Date: ${requisition.date} | Status: ${requisition.status}`,
        headers: [
          'No',
          'Item Code',
          'Item Description',
          'UOM',
          'Requested Qty',
          'Approved Qty',
          'Est Unit Price (Rp)',
          'Total Amount (Rp)',
        ],
        rows,
        colWidths: [6, 15, 35, 10, 14, 14, 18, 20],
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white/85 backdrop-blur-sm flex flex-col justify-start items-center p-2 sm:p-4 overflow-y-auto">
      {/* Inline Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #requisition-printable-document, #requisition-printable-document * {
            visibility: visible;
          }
          #requisition-printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 18mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .no-print * {
            display: none !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Main Container */}
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col my-4 overflow-hidden">
        {/* Modal Action Header (Hidden in Print) */}
        <div className="no-print bg-white px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Purchase Requisition Form</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  {requisition.requisition_id}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    requisition.status === 'ISSUED'
                      ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/30'
                      : requisition.status === 'APPROVED'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : requisition.status === 'ORDERED'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {requisition.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Official Department Stock &amp; Purchase Requisition Document (Formulir Permintaan Pembelian).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {requisition.status === 'PENDING' && onApprove && (
              <button
                type="button"
                onClick={() => onApprove(requisition)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            )}

            {(requisition.status === 'APPROVED' || requisition.status === 'PARTIALLY_ORDERED') && onCreatePo && (
              <button
                type="button"
                onClick={() => onCreatePo(requisition.requisition_id)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-blue-950 transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Create PO</span>
              </button>
            )}

            {requisition.status === 'APPROVED' && onIssueStock && (
              <button
                type="button"
                onClick={() => onIssueStock(requisition)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Issue Stock</span>
              </button>
            )}

            {requisition.journal_id && onViewJournal && (
              <button
                type="button"
                onClick={() => onViewJournal(requisition.journal_id!)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors"
                title="View Double-Entry Journal"
              >
                <span>Journal</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            <ReportExportButtons onExport={handleExportExcel} />

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-purple-950 transition-colors"
              title="Print Requisition Form (A4 / Letter)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Form</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Sheet (Pure White Paper for High-Fidelity Printing) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white/70">
          <div
            id="requisition-printable-document"
            className="bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-xs border border-slate-200 max-w-4xl mx-auto transition-all"
          >
            {/* Header / Letterhead */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-5 mb-6 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    <AtriumLogo variant="arch-only" size="md" theme="light" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                      {hotelName}
                    </h1>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {hotelDivision}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                  <div>{hotelAddress}</div>
                  <div className="flex flex-wrap gap-x-4">
                    <span>Phone: {hotelPhone}</span>
                    <span>Email: {hotelEmail}</span>
                    <span>NPWP / Tax ID: {hotelTaxId}</span>
                  </div>
                </div>
              </div>

              {/* Document Title & Reference Block */}
              <div className="text-left sm:text-right sm:min-w-[240px]">
                <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase mb-1">
                  PURCHASE REQUISITION
                </div>
                <div className="text-[11px] text-slate-500 font-medium">Formulir Permintaan Barang &amp; Pembelian</div>
                <div className="text-lg font-mono font-black text-purple-900 mt-1">
                  #{requisition.requisition_id}
                </div>
                <div className="text-xs font-mono text-slate-700 mt-0.5">
                  Date: <span className="font-bold">{requisition.date}</span>
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase border ${
                      requisition.status === 'ISSUED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : requisition.status === 'APPROVED'
                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                        : requisition.status === 'ORDERED'
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    STATUS: {requisition.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Department & Requisition Coordinates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Requesting Department Details */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-purple-700" />
                  <span>REQUESTING COST CENTER:</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {dept?.department_name || requisition.department_name} ({requisition.department_code})
                </div>
                <div className="text-xs text-slate-700 font-medium mt-1">
                  Requester: <span className="font-bold text-slate-900">{requisition.requester_name}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Target Storeroom:{' '}
                  <span className="font-mono font-bold text-slate-800">
                    {storeroom?.name || requisition.storeroom_name || requisition.storeroom_id} ({requisition.storeroom_id})
                  </span>
                </div>
              </div>

              {/* Purpose & Procurement Linkage Details */}
              <div className="border border-slate-300 rounded-lg p-3.5 bg-slate-50">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-purple-700" />
                  <span>PURPOSE &amp; JUSTIFICATION:</span>
                </div>
                <div className="text-xs text-slate-800 italic">
                  "{requisition.notes || 'Routine department consumption & operational replenishment.'}"
                </div>
                {requisition.linked_po_ids && requisition.linked_po_ids.length > 0 && (
                  <div className="text-[11px] text-purple-800 font-mono font-semibold mt-2 flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Linked POs: {requisition.linked_po_ids.join(', ')}</span>
                  </div>
                )}
                {requisition.journal_id && (
                  <div className="text-[11px] text-emerald-800 font-mono mt-1">
                    GL Expense Journal: #{requisition.journal_id}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-mono text-[10px] uppercase">
                    <th className="py-2.5 px-3 w-8 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description / Specification</th>
                    <th className="py-2.5 px-3 w-28">SKU Code</th>
                    <th className="py-2.5 px-3 text-center w-16">UOM</th>
                    <th className="py-2.5 px-3 text-right w-20">Req Qty</th>
                    <th className="py-2.5 px-3 text-right w-20">Appr Qty</th>
                    <th className="py-2.5 px-3 text-right w-28">Unit Cost (Rp)</th>
                    <th className="py-2.5 px-3 text-right w-32">Total Cost (Rp)</th>
                    <th className="py-2.5 px-3 text-right w-20">Stock On Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {requisition.items.map((line, idx) => {
                    const item = inventoryItems.find((i) => i.item_id === line.item_id);
                    const unitCost = line.unit_cost || item?.average_cost || item?.last_purchase_price || 0;
                    const approvedQty = line.approved_quantity !== undefined ? line.approved_quantity : line.requested_quantity;
                    const lineTotal = line.total_cost || (approvedQty * unitCost);
                    const onHand = item?.current_stock ?? 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-center text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{line.item_name}</div>
                          {item?.subcategory && (
                            <div className="text-[10px] text-slate-500 font-medium">Category: {item.subcategory}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {line.item_code}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-center text-slate-700">
                          {line.uom}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-semibold text-slate-800">
                          {line.requested_quantity}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-bold text-purple-900">
                          {approvedQty}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-700">
                          Rp {unitCost.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right font-bold text-slate-900">
                          Rp {lineTotal.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-500">
                          {onHand} {line.uom}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Box */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-300 rounded-lg p-4 bg-slate-50 mb-8 page-break-inside-avoid">
              <div className="text-xs text-slate-500 space-y-1">
                <div>
                  Total SKUs: <span className="font-bold font-mono text-slate-900">{requisition.items.length}</span> items
                </div>
                <div>
                  Total Quantity: Requested <span className="font-bold font-mono text-slate-900">{totalRequestedQty}</span> units • Approved <span className="font-bold font-mono text-purple-900">{totalApprovedQty}</span> units
                </div>
                <div className="text-[11px] text-slate-500">
                  All estimations are based on perpetual moving average costs in Indonesian Rupiah (Rp).
                </div>
              </div>

              <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-300 pt-3 sm:pt-0 sm:pl-6 min-w-[240px]">
                <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                  TOTAL ESTIMATED BUDGET (RP)
                </div>
                <div className="text-2xl font-mono font-black text-slate-900 mt-0.5">
                  Rp {totalEstimatedCost.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] font-mono text-emerald-700 font-semibold mt-0.5">
                  Indonesian Rupiah Currency Validated
                </div>
              </div>
            </div>

            {/* Corporate Authorization & 4-Tier Signatures Grid */}
            <div className="border border-slate-300 rounded-lg p-5 bg-white mb-6 page-break-inside-avoid">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-4 border-b border-slate-200 pb-2">
                HOSPITALITY INTERNAL CONTROL &amp; AUTHORIZATION SIGNATURES:
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {/* 1. Requested By */}
                <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex flex-col justify-between h-36">
                  <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    1. REQUESTED BY
                  </div>
                  <div className="my-auto">
                    <div className="text-xs font-bold text-slate-900">{requisition.requester_name}</div>
                    <div className="text-[10px] text-slate-500">Department Staff / User</div>
                  </div>
                  <div className="pt-2 border-t border-slate-300 text-[10px] font-mono text-slate-500">
                    Date: {requisition.date}
                  </div>
                </div>

                {/* 2. Reviewed & Approved By (HOD) */}
                <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex flex-col justify-between h-36">
                  <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    2. DEPT HEAD APPROVAL
                  </div>
                  <div className="my-auto">
                    <div className="text-xs font-bold text-slate-900">
                      {requisition.approver_name || 'Head of Department'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {requisition.status !== 'PENDING' ? (
                        <span className="text-emerald-700 font-semibold">✓ Verified &amp; Approved</span>
                      ) : (
                        'Pending Review'
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-300 text-[10px] font-mono text-slate-500">
                    Date: {requisition.approved_at ? requisition.approved_at.split('T')[0] : '—'}
                  </div>
                </div>

                {/* 3. Verified By Storekeeper */}
                <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex flex-col justify-between h-36">
                  <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    3. STOREKEEPER VERIFY
                  </div>
                  <div className="my-auto">
                    <div className="text-xs font-bold text-slate-900">
                      {requisition.issuer_name || 'Central Storekeeper'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {requisition.status === 'ISSUED' ? (
                        <span className="text-emerald-700 font-semibold">✓ Stock Dispatched</span>
                      ) : (
                        'Inventory Availability Check'
                      )}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-300 text-[10px] font-mono text-slate-500">
                    Date: {requisition.issued_at ? requisition.issued_at.split('T')[0] : '—'}
                  </div>
                </div>

                {/* 4. Authorized By Financial Controller */}
                <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex flex-col justify-between h-36">
                  <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                    4. PURCHASING / FC
                  </div>
                  <div className="my-auto">
                    <div className="text-xs font-bold text-slate-900">Financial Controller</div>
                    <div className="text-[10px] text-slate-500">Budget Clearance &amp; PO Release</div>
                  </div>
                  <div className="pt-2 border-t border-slate-300 text-[10px] font-mono text-slate-500">
                    Date: {requisition.date}
                  </div>
                </div>
              </div>
            </div>

            {/* Standard Hospitality Internal Policy Footer */}
            <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div>
                Document Ref: #{requisition.requisition_id} • System Generated on {new Date().toLocaleDateString('id-ID')}
              </div>
              <div className="font-mono">
                The Atrium Hotel &amp; Resort Hospitality ERP System • USALI 12
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
