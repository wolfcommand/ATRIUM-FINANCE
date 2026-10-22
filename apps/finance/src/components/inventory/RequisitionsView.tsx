/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Trash2,
  X,
  ExternalLink,
  Building,
  User,
  Warehouse,
  AlertCircle,
  PackageCheck,
  RefreshCw,
  FileText,
  ShoppingCart,
  Split,
  Printer,
  Coins,
} from 'lucide-react';
import {
  DepartmentRequisition,
  InventoryItem,
  InventoryStoreroom,
  Department,
} from '../../types';
import { api } from '../../services/api';
import { ReportExportButtons } from '../reports/ReportExportButtons';
import { exportReport } from '../../utils/reportExport';
import { PurchaseRequisitionDocumentModal } from './PurchaseRequisitionDocumentModal';

interface RequisitionsViewProps {
  departments: Department[];
  onViewJournal?: (journalId: string) => void;
  onCreatePo?: (requisitionId: string) => void;
}

export const RequisitionsView: React.FC<RequisitionsViewProps> = ({
  departments,
  onViewJournal,
  onCreatePo,
}) => {
  const [requisitions, setRequisitions] = useState<DepartmentRequisition[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [storerooms, setStorerooms] = useState<InventoryStoreroom[]>([]);
  const [loading, setLoading] = useState(true);

  // Printable Requisition Document State
  const [activePrintableReq, setActivePrintableReq] = useState<DepartmentRequisition | null>(null);

  // New Requisition Form
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reqDept, setReqDept] = useState('F&B');
  const [requesterName, setRequesterName] = useState('Chef Agus Santoso');
  const [targetStoreroom, setTargetStoreroom] = useState('CSR-01');
  const [notes, setNotes] = useState('Daily prep replenishment for banqueting.');
  const [createLines, setCreateLines] = useState<{ item_id: string; requested_quantity: number }[]>([
    { item_id: '', requested_quantity: 5 },
  ]);

  // Approval Modal State
  const [approvingReq, setApprovingReq] = useState<DepartmentRequisition | null>(null);
  const [approverName, setApproverName] = useState('Head Chef Wayan Sudarma');
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});

  // Issuing State
  const [issuingReq, setIssuingReq] = useState<DepartmentRequisition | null>(null);
  const [issuerName, setIssuerName] = useState('Budi Raharjo (Central Storekeeper)');

  const [notification, setNotification] = useState<{ text: string; journalId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, itemList, rooms] = await Promise.all([
        api.getRequisitions(),
        api.getInventoryItems(),
        api.getInventoryStorerooms(),
      ]);
      setRequisitions(reqs);
      setItems(itemList);
      setStorerooms(rooms);
      if (itemList.length > 0 && !createLines[0]?.item_id) {
        setCreateLines([{ item_id: itemList[0].item_id, requested_quantity: 5 }]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCreateLine = () => {
    setCreateLines([...createLines, { item_id: items[0]?.item_id || '', requested_quantity: 1 }]);
  };

  const handleRemoveCreateLine = (index: number) => {
    if (createLines.length === 1) return;
    setCreateLines(createLines.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotification(null);

    for (const l of createLines) {
      if (!l.item_id || l.requested_quantity <= 0) {
        setError('Please enter valid items and quantities.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.createRequisition({
        date: new Date().toISOString().split('T')[0],
        department_code: reqDept,
        requester_name: requesterName,
        storeroom_id: targetStoreroom,
        items: createLines,
        notes,
      });

      setNotification({ text: 'Requisition submitted successfully. Status: PENDING.' });
      setIsCreateOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApproveModal = (req: DepartmentRequisition) => {
    setApprovingReq(req);
    const qtys: Record<string, number> = {};
    req.items.forEach((it) => {
      qtys[it.item_id] = it.requested_quantity;
    });
    setApprovedQtys(qtys);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingReq) return;

    setSubmitting(true);
    try {
      const payload = Object.entries(approvedQtys).map(([item_id, approved_quantity]) => ({
        item_id,
        approved_quantity: Number(approved_quantity),
      }));

      await api.approveRequisition(approvingReq.requisition_id, approverName, payload);
      setNotification({ text: `Requisition #${approvingReq.requisition_id} approved! Ready for store issue.` });
      setApprovingReq(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuingReq) return;

    setSubmitting(true);
    try {
      const result = await api.issueRequisition(issuingReq.requisition_id, issuerName);
      setNotification({
        text: `Requisition #${issuingReq.requisition_id} fully issued! Inventory decremented and GL cost journal recorded.`,
        journalId: result.journal_id,
      });
      setIssuingReq(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to issue requisition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 p-4 rounded-xl border border-slate-200">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-400" />
            <span>Department Requisitions & Stock Issuance Workflow</span>
          </h3>
          <p className="text-xs text-slate-500">
            Departments submit material requisitions, heads approve, and storerooms issue stock with automated cost accounting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ReportExportButtons
            disabled={loading}
            onExport={format => exportReport('Department_Requisition_Register', [
              {
                name: 'Requisitions',
                title: 'DEPARTMENT PURCHASE REQUISITION REGISTER',
                subtitle: `${requisitions.length} requisitions`,
                headers: ['Req #', 'Date', 'Department', 'Requester', 'Source Storeroom', 'Line Items', 'Requested Qty', 'Approved Qty', 'Estimated Cost (Rp)', 'Status', 'Approver', 'Issuer', 'Linked POs', 'Journal'],
                rows: requisitions.map(r => [
                  r.requisition_id, r.date, r.department_name, r.requester_name, r.storeroom_name, r.items.length,
                  r.items.reduce((s, i) => s + (i.requested_quantity || 0), 0),
                  r.items.reduce((s, i) => s + (i.approved_quantity ?? i.requested_quantity ?? 0), 0),
                  r.items.reduce((s, i) => s + (i.approved_quantity ?? i.requested_quantity ?? 0) * (i.unit_cost || 0), 0),
                  r.status, r.approver_name, r.issuer_name, (r.linked_po_ids || []).join('; '), r.journal_id,
                ]),
                colWidths: [16, 14, 20, 22, 18, 11, 14, 13, 20, 20, 20, 20, 22, 16],
              },
            ], format)}
          />
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs shadow-purple-950 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-4 rounded-xl bg-slate-900/10/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.text}</span>
          </div>
          {notification.journalId && onViewJournal && (
            <div className="flex items-center gap-2">
              <span className="text-slate-700">Double-Entry Journal:</span>
              <button
                onClick={() => onViewJournal(notification.journalId!)}
                className="px-2 py-0.5 bg-slate-100 text-emerald-700 rounded font-mono font-bold flex items-center gap-1"
              >
                <span>{notification.journalId}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-600/10/40 border border-rose-800/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Requisitions List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 text-slate-500 font-mono text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Req #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Source Storeroom</th>
                <th className="px-4 py-3 text-right">Items Qty</th>
                <th className="px-4 py-3 text-right">Est. Budget (Rp)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Approval / Issuer</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-700">
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-500 font-mono">
                    No department requisitions on record.
                  </td>
                </tr>
              ) : (
                requisitions.map((req) => {
                  const estReqCost = req.items.reduce((sum, line) => {
                    const itm = items.find((i) => i.item_id === line.item_id);
                    const cost = line.unit_cost || itm?.average_cost || itm?.last_purchase_price || 0;
                    const qty = line.approved_quantity !== undefined ? line.approved_quantity : line.requested_quantity;
                    return sum + (qty * cost);
                  }, 0);

                  return (
                    <tr key={req.requisition_id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-purple-400">
                        {req.requisition_number || req.requisition_id}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{req.date}</td>
                      <td className="px-4 py-3 font-semibold text-white">{req.department_code}</td>
                      <td className="px-4 py-3 text-slate-700">{req.requester_name}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{req.storeroom_id}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {req.items.reduce((s, i) => s + (i.issued_quantity || i.requested_quantity), 0)} units (
                        {req.items.length} SKUs)
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                        Rp {estReqCost.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            req.status === 'ISSUED'
                              ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/30'
                              : req.status === 'APPROVED'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : req.status === 'PARTIALLY_ORDERED'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : req.status === 'ORDERED'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : req.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-white text-slate-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {req.approved_by ? `Appr: ${req.approved_by}` : 'Awaiting Dept Head'}
                        {req.issued_by ? ` • Issued: ${req.issued_by}` : ''}
                        {req.linked_po_ids && req.linked_po_ids.length > 0 && (
                          <div className="text-[10px] text-purple-400 font-mono mt-0.5 flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" />
                            <span>{req.linked_po_ids.length} PO(s) Linked</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Printable Form Trigger Button */}
                          <button
                            onClick={() => setActivePrintableReq(req)}
                            className="px-2.5 py-1 rounded bg-white hover:bg-purple-900/40 text-purple-300 hover:text-white border border-slate-200 hover:border-purple-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs"
                            title="Open Printable Requisition Voucher / Form"
                          >
                            <Printer className="w-3 h-3 text-purple-400" />
                            <span>Print Form</span>
                          </button>

                          {req.status === 'PENDING' && (
                            <button
                              onClick={() => handleOpenApproveModal(req)}
                              className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[11px] font-semibold"
                            >
                              Approve
                            </button>
                          )}

                          {(req.status === 'APPROVED' || req.status === 'PARTIALLY_ORDERED') && onCreatePo && (
                            <button
                              onClick={() => onCreatePo(req.requisition_id)}
                              title="Generate Purchase Order to Supplier (supports multi-supplier split)"
                              className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 text-[11px] font-semibold flex items-center gap-1"
                            >
                              <ShoppingCart className="w-3 h-3 text-slate-500" />
                              <span>Create PO</span>
                            </button>
                          )}

                          {req.status === 'APPROVED' && (
                            <button
                              onClick={() => setIssuingReq(req)}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                            >
                              <PackageCheck className="w-3 h-3" />
                              <span>Issue Stock</span>
                            </button>
                          )}

                          {req.journal_id && onViewJournal && (
                            <button
                              onClick={() => onViewJournal(req.journal_id!)}
                              title="View Journal in Workbench"
                              className="p-1 rounded bg-white hover:bg-slate-200 text-emerald-700"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Requisition */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-400" />
                <span>Submit Department Stock Requisition</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-slate-500 block mb-1">Requesting Dept</label>
                  <select
                    value={reqDept}
                    onChange={(e) => setReqDept(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.department_code} value={d.department_code}>
                        {d.department_code} - {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-slate-500 block mb-1">Requester Name</label>
                  <input
                    type="text"
                    required
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="font-mono text-slate-500 block mb-1">Target Storeroom</label>
                  <select
                    value={targetStoreroom}
                    onChange={(e) => setTargetStoreroom(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white font-mono"
                  >
                    {storerooms.map((s) => (
                      <option key={s.storeroom_id} value={s.storeroom_id}>
                        {s.storeroom_id} - {s.storeroom_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase text-slate-500">Requisition Items</span>
                  <button
                    type="button"
                    onClick={handleAddCreateLine}
                    className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {createLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={line.item_id}
                        onChange={(e) => {
                          const newLines = [...createLines];
                          newLines[idx].item_id = e.target.value;
                          setCreateLines(newLines);
                        }}
                        className="flex-1 bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                      >
                        {items.map((i) => (
                          <option key={i.item_id} value={i.item_id}>
                            [{i.item_code}] {i.item_name} (Stock: {i.current_stock} {i.uom})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={line.requested_quantity}
                        onChange={(e) => {
                          const newLines = [...createLines];
                          newLines[idx].requested_quantity = Number(e.target.value);
                          setCreateLines(newLines);
                        }}
                        className="w-24 bg-white border border-slate-200 rounded px-2 py-1.5 text-white font-mono text-right"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveCreateLine(idx)}
                        disabled={createLines.length === 1}
                        className="p-1 text-slate-500 hover:text-red-600 disabled:opacity-20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-slate-500 block mb-1">Notes / Justification</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold shadow-xs shadow-purple-950"
                >
                  {submitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Requisition */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-slate-500" />
                <span>Approve Requisition #{approvingReq.requisition_number}</span>
              </h3>
              <button
                onClick={() => setApprovingReq(null)}
                className="p-1 rounded text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-mono text-slate-500 block mb-1">Approver Name (Dept Head)</label>
                <input
                  type="text"
                  required
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-white/50">
                <span className="font-mono uppercase text-slate-500 block mb-2">
                  Verify or Adjust Approved Quantities:
                </span>
                {approvingReq.items.map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-white font-medium">{item.item_name}</div>
                      <div className="text-[11px] text-slate-500">
                        Requested: {item.requested_quantity} {item.uom}
                      </div>
                    </div>
                    <div className="w-28 flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={approvedQtys[item.item_id] ?? item.requested_quantity}
                        onChange={(e) =>
                          setApprovedQtys({ ...approvedQtys, [item.item_id]: Number(e.target.value) })
                        }
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-white font-mono text-right"
                      />
                      <span className="text-slate-500 text-[11px]">{item.uom}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingReq(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                >
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Storekeeper Issue */}
      {issuingReq && (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-700" />
                <span>Fulfill & Issue Requisition #{issuingReq.requisition_number}</span>
              </h3>
              <button
                onClick={() => setIssuingReq(null)}
                className="p-1 rounded text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-mono text-slate-500 block mb-1">Storekeeper Name (Issuer)</label>
                <input
                  type="text"
                  required
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-white/50">
                <span className="font-mono uppercase text-slate-500 block mb-1">Items to Dispatch:</span>
                {issuingReq.items.map((item) => (
                  <div key={item.item_id} className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-none">
                    <div>
                      <div className="text-white font-medium">{item.item_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        From Storeroom: {issuingReq.storeroom_id}
                      </div>
                    </div>
                    <div className="text-right font-mono font-bold text-emerald-700">
                      {item.approved_quantity || item.requested_quantity} {item.uom}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-blue-300 text-[11px]">
                Posting this issue will decrement on-hand inventory balances and post a General Ledger
                journal debiting departmental operational cost ({issuingReq.department_code}) and crediting Asset 1080 Inventory.
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIssuingReq(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold"
                >
                  {submitting ? 'Posting Issue...' : 'Confirm Issue & Post Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Printable Purchase Requisition Form */}
      {activePrintableReq && (
        <PurchaseRequisitionDocumentModal
          requisition={activePrintableReq}
          departments={departments}
          storerooms={storerooms}
          inventoryItems={items}
          onClose={() => setActivePrintableReq(null)}
          onApprove={(req) => {
            setActivePrintableReq(null);
            handleOpenApproveModal(req);
          }}
          onCreatePo={onCreatePo ? (reqId) => {
            setActivePrintableReq(null);
            onCreatePo(reqId);
          } : undefined}
          onIssueStock={(req) => {
            setActivePrintableReq(null);
            setIssuingReq(req);
          }}
          onViewJournal={onViewJournal}
        />
      )}
    </div>
  );
};
