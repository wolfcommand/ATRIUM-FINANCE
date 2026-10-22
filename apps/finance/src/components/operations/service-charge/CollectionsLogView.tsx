/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  DollarSign,
} from 'lucide-react';;
import { ServiceChargeCollection, Department, ServiceChargeSource } from '../../../types';
import { api } from '../../../services/api';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { exportReport, withTotal } from '../../../utils/reportExport';

interface CollectionsLogViewProps {
  collections: ServiceChargeCollection[];
  departments: Department[];
  onRefresh: () => void;
  onViewJournal?: (journalId: string) => void;
}

export const CollectionsLogView: React.FC<CollectionsLogViewProps> = ({
  collections,
  departments,
  onRefresh,
  onViewJournal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    date: string;
    source: ServiceChargeSource;
    department_code: string;
    gross_sales_amount: number;
    service_charge_rate_pct: number;
    reference_no: string;
    notes: string;
    auto_post_journal: boolean;
  }>({
    date: new Date().toISOString().substring(0, 10),
    source: 'PMS_ROOMS',
    department_code: '100',
    gross_sales_amount: 50000000,
    service_charge_rate_pct: 10.0,
    reference_no: '',
    notes: '',
    auto_post_journal: true,
  });

  const periods = Array.from(new Set(collections.map((c) => c.period))).sort().reverse();

  const handleOpenAdd = () => {
    setFormData({
      date: new Date().toISOString().substring(0, 10),
      source: 'PMS_ROOMS',
      department_code: '100',
      gross_sales_amount: 50000000,
      service_charge_rate_pct: 10.0,
      reference_no: `FOL-${Date.now().toString().slice(-6)}`,
      notes: '',
      auto_post_journal: true,
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSourceChange = (source: ServiceChargeSource) => {
    let dept = '100';
    if (source === 'POS_FB' || source === 'BANQUETS_MICE') dept = '200';
    if (source === 'POS_SPA') dept = '300';
    setFormData((prev) => ({
      ...prev,
      source,
      department_code: dept,
    }));
  };

  const calculatedServiceCharge = Math.round(
    formData.gross_sales_amount * (formData.service_charge_rate_pct / 100)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.gross_sales_amount <= 0) {
      setErrorMsg('Gross sales amount must be positive');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await api.recordServiceChargeCollection(formData);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record collection tranche');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = collections.filter((c) => {
    const matchesSearch =
      c.reference_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.notes && c.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPeriod = selectedPeriod === 'ALL' || c.period === selectedPeriod;
    return matchesSearch && matchesPeriod;
  });

  const totalGross = filtered.reduce((s, c) => s + c.gross_sales_amount, 0);
  const totalServiceCharge = filtered.reduce((s, c) => s + c.service_charge_amount, 0);

  const getSourceLabel = (src: ServiceChargeSource) => {
    switch (src) {
      case 'PMS_ROOMS':
        return 'PMS Room Charges (10%)';
      case 'POS_FB':
        return 'Restaurant & Bar POS (10%)';
      case 'BANQUETS_MICE':
        return 'Banquet & MICE Event (10%)';
      case 'POS_SPA':
        return 'Spa & Wellness POS (10%)';
      case 'MANUAL_GRATUITY':
        return 'Direct Guest Gratuity';
      default:
        return src;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Filtered 10% Service Charge Inflow
          </span>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
            Rp {totalServiceCharge.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {filtered.length} audited guest tranches
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Underlying Gross Folio Volume
          </span>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            Rp {totalGross.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Rooms, Outlets, Banquets &amp; Spa checks
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
            Night Audit &amp; POS Ingestion
          </span>
          <button
            onClick={handleOpenAdd}
            className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Record Guest Inflow Tranche</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <ReportExportButtons onExport={format => exportReport(`Service_Charge_Collections_${selectedPeriod}`, [{
          name: 'Collections', title: 'Service Charge Collections Log', period: selectedPeriod,
          subtitle: searchTerm ? `Search: ${searchTerm}` : undefined,
          headers: ['Date', 'Reference', 'Source', 'Department', 'Gross Sales (Rp)', 'Rate', 'Service Charge (Rp)', 'Status', 'Journal', 'Notes'],
          rows: withTotal(
            filtered.map(c => [c.date, c.reference_no, c.source, c.department_code, c.gross_sales_amount, `${c.service_charge_rate_pct}%`, c.service_charge_amount, c.status, c.journal_id, c.notes]),
            ['TOTAL', '', '', '', totalGross, '', totalServiceCharge, '', '', '']
          ),
          colWidths: [14, 20, 20, 12, 20, 10, 20, 14, 16, 26],
        }], format)} />
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by reference, source, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Period:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
          >
            <option value="ALL">All Periods</option>
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Collections Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Date &amp; ID</th>
                <th className="py-3 px-4">Revenue Stream (Source)</th>
                <th className="py-3 px-4">Reference No.</th>
                <th className="py-3 px-4 text-right">Gross Sales</th>
                <th className="py-3 px-4 text-right">10% Tranche</th>
                <th className="py-3 px-4">Trust Pool Status</th>
                <th className="py-3 px-4 text-right">Journal Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No service charge collection records found.
                  </td>
                </tr>
              ) : (
                filtered.map((col) => (
                  <tr key={col.collection_id} className="hover:bg-white/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-700">{col.date}</div>
                      <div className="text-[10px] text-slate-500">{col.collection_id}</div>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-700">{getSourceLabel(col.source)}</div>
                      <div className="text-[11px] text-slate-500">Dept {col.department_code}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px]">
                        {col.reference_no}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      Rp {col.gross_sales_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 text-sm">
                      Rp {col.service_charge_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      {col.status === 'DISTRIBUTED' ? (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Distributed to Staff
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
                          <Clock className="w-3.5 h-3.5" /> In Trust Pool (Accrued)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      {col.journal_id ? (
                        <button
                          onClick={() => onViewJournal && onViewJournal(col.journal_id!)}
                          className="font-mono text-emerald-700 hover:text-emerald-700 underline text-xs"
                          title="Drilldown to Journal Voucher"
                        >
                          {col.journal_id}
                        </button>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">Pending Sync</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Inflow Tranche Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs max-w-lg w-full overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-850">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Record 10% Service Charge Inflow Tranche
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-600/10/60 border border-rose-800/60 text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Revenue Source *</label>
                  <select
                    value={formData.source}
                    onChange={(e) => handleSourceChange(e.target.value as ServiceChargeSource)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PMS_ROOMS">PMS Room Charges (10%)</option>
                    <option value="POS_FB">Restaurant &amp; Bar POS (10%)</option>
                    <option value="BANQUETS_MICE">Banquet &amp; MICE Events (10%)</option>
                    <option value="POS_SPA">Spa &amp; Wellness POS (10%)</option>
                    <option value="MANUAL_GRATUITY">Direct Staff Gratuity</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department</label>
                  <select
                    value={formData.department_code}
                    onChange={(e) => setFormData({ ...formData, department_code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    {departments.map((d) => (
                      <option key={d.department_code} value={d.department_code}>
                        {d.department_code} - {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Folio / Reference No.</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PMS-AUDIT-20260831"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Gross Sales Amount (IDR) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formData.gross_sales_amount}
                    onChange={(e) => setFormData({ ...formData, gross_sales_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Service Charge Rate</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="0.5"
                    value={formData.service_charge_rate_pct}
                    onChange={(e) => setFormData({ ...formData, service_charge_rate_pct: parseFloat(e.target.value) || 10 })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Live Preview of Tranche */}
              <div className="p-3 rounded-lg bg-white border border-slate-200 flex justify-between items-center font-mono">
                <span className="text-slate-500">10% Tranche to Pool:</span>
                <span className="text-emerald-700 font-bold text-sm">
                  Rp {calculatedServiceCharge.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Audit Notes / Shift Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Audited against PMS night audit folio balancing report"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.auto_post_journal}
                    onChange={(e) => setFormData({ ...formData, auto_post_journal: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Auto-post Balanced Double-Entry Journal (Debit 1020 -&gt; Credit 2030)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Recording...' : 'Record Tranche to Trust Pool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
