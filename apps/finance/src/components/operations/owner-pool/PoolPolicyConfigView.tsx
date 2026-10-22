/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OwnerDistributionRuleConfig } from '../../../types';
import { api } from '../../../services/api';
import {
  Sliders,
  CheckCircle,
  AlertTriangle,
  History,
  Shield,
  Save,
  Clock,
  Info,
} from 'lucide-react';

export const PoolPolicyConfigView: React.FC = () => {
  const [config, setConfig] = useState<OwnerDistributionRuleConfig | null>(null);
  const [history, setHistory] = useState<OwnerDistributionRuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    owner_pool_pct: 65.0,
    amg_allocation_pct: 35.0,
    guaranteed_return_rate_pct: 10.0,
    guaranteed_period_years: 3,
    guaranteed_return_basis: 'PURCHASE_PRICE_LESS_VAT' as const,
    guarantee_difference_rule: 'AUTO_TOP_UP' as const,
    facility_discount_pct: 10.0,
    payout_day_of_month: 15,
    stay_annual_quota_days: 28,
    stay_rate_pct_within_quota: 10.0,
    stay_rate_pct_excess: 75.0,
    developer_entity_name: 'PT Keen Eye',
    developer_md_name: 'Scott',
    operator_entity_name: 'PT Atrium Management Group',
    effective_date: new Date().toISOString().substring(0, 10),
    revision_notes: '',
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await api.getOwnerPoolConfig();
      setConfig(data.config);
      setHistory(data.history || []);
      setFormData({
        owner_pool_pct: data.config.owner_pool_pct,
        amg_allocation_pct: data.config.amg_allocation_pct,
        guaranteed_return_rate_pct: data.config.guaranteed_return_rate_pct,
        guaranteed_period_years: data.config.guaranteed_period_years,
        guaranteed_return_basis: data.config.guaranteed_return_basis,
        guarantee_difference_rule: data.config.guarantee_difference_rule,
        facility_discount_pct: data.config.facility_discount_pct !== undefined ? data.config.facility_discount_pct : 10.0,
        payout_day_of_month: data.config.payout_day_of_month || 15,
        stay_annual_quota_days: data.config.stay_annual_quota_days || 28,
        stay_rate_pct_within_quota: data.config.stay_rate_pct_within_quota !== undefined ? data.config.stay_rate_pct_within_quota : 10.0,
        stay_rate_pct_excess: data.config.stay_rate_pct_excess !== undefined ? data.config.stay_rate_pct_excess : 75.0,
        developer_entity_name: data.config.developer_entity_name || 'PT Keen Eye',
        developer_md_name: data.config.developer_md_name || 'Scott',
        operator_entity_name: data.config.operator_entity_name || 'PT Atrium Management Group',
        effective_date: new Date().toISOString().substring(0, 10),
        revision_notes: '',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load policy configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate 100% split
    const total = Number(formData.owner_pool_pct) + Number(formData.amg_allocation_pct);
    if (Math.abs(total - 100) > 0.001) {
      setErrorMsg(`Owner Pool % (${formData.owner_pool_pct}%) + AMG % (${formData.amg_allocation_pct}%) must sum to exactly 100%. Current sum: ${total}%`);
      setSaving(false);
      return;
    }

    try {
      const res = await api.updateOwnerPoolConfig({
        ...formData,
        owner_pool_pct: Number(formData.owner_pool_pct),
        amg_allocation_pct: Number(formData.amg_allocation_pct),
        guaranteed_return_rate_pct: Number(formData.guaranteed_return_rate_pct),
        guaranteed_period_years: Number(formData.guaranteed_period_years),
      });
      setConfig(res.config);
      setHistory(res.history);
      setSuccessMsg('Owner Pool policy configuration successfully updated. Historical batches remain unaffected.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading policy rules...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Notice Banner */}
      <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-sm block">Effective-Dated Policy Enforcement</span>
          <p className="text-slate-500">
            AMG ERP uses strict temporal immutability. Updating rules below will only apply to future or newly calculated monthly distribution cycles. Any historical batch that was posted retains the exact rules and configuration that were active at its calculation time.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Hotel Revenue & Return Distribution Rules</h3>
            <p className="text-xs text-slate-500">Configure splits, contractual guaranteed returns, and calculation bases</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Revenue Split */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              1. Hotel Room Revenue Split (Must Equal 100%)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Owner Pool Percentage (%) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={formData.owner_pool_pct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        owner_pool_pct: val,
                        amg_allocation_pct: Math.round((100 - val) * 10) / 10,
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-indigo-900 text-sm"
                  />
                  <span className="font-bold text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Default: 65% of audited hotel room revenue</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  AMG Operator Allocation (%) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={formData.amg_allocation_pct}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({
                        ...formData,
                        amg_allocation_pct: val,
                        owner_pool_pct: Math.round((100 - val) * 10) / 10,
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-700 text-sm"
                  />
                  <span className="font-bold text-slate-500">%</span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">Remaining 35% operator share</span>
              </div>
            </div>
          </div>

          {/* Guaranteed Return Parameters */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              2. Contractual Guaranteed Return Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Guaranteed Rate (% Annual) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={formData.guaranteed_return_rate_pct}
                  onChange={(e) => setFormData({ ...formData, guaranteed_return_rate_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 text-sm"
                />
                <span className="text-[11px] text-slate-500 block mt-1">Standard: 10.0% per annum</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Guarantee Duration (Years) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={formData.guaranteed_period_years}
                  onChange={(e) => setFormData({ ...formData, guaranteed_period_years: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800 text-sm"
                />
                <span className="text-[11px] text-slate-500 block mt-1">First 3 years from contract start</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Calculation Basis *
                </label>
                <select
                  value={formData.guaranteed_return_basis}
                  onChange={(e) => setFormData({ ...formData, guaranteed_return_basis: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-medium"
                >
                  <option value="PURCHASE_PRICE_LESS_VAT">Purchase Price Less VAT (Default)</option>
                  <option value="PURCHASE_PRICE">Gross Purchase Price</option>
                </select>
                <span className="text-[11px] text-slate-500 block mt-1">Net-of-tax asset base</span>
              </div>
            </div>
          </div>

          {/* Guarantee Difference Treatment */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              3. Guarantee Difference Accounting Treatment
            </h4>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-slate-700 font-semibold mb-1">
                Policy Rule for Difference (Shortfall / Surplus)
              </label>
              <select
                value={formData.guarantee_difference_rule}
                onChange={(e) => setFormData({ ...formData, guarantee_difference_rule: e.target.value as any })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                <option value="FLAG_FOR_REVIEW">Flag for Review ("Guarantee adjustment rule requires configuration")</option>
                <option value="SEPARATE_OPERATOR_TOP_UP">Separate AMG Operator Top-Up Journal</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-2">
                Mandate adherence: Do not invent top-up or shortfall accounting treatments unless an existing AMG configuration defines it.
              </p>
            </div>
          </div>

          {/* Audit & Effective Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Effective Date *</label>
              <input
                type="date"
                required
                value={formData.effective_date}
                onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Revision Notes</label>
              <input
                type="text"
                placeholder="Reason for policy revision..."
                value={formData.revision_notes}
                onChange={(e) => setFormData({ ...formData, revision_notes: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Policy...' : 'Save & Enact Policy'}
            </button>
          </div>
        </form>
      </div>

      {/* Historical Effective-Dated Configurations Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <History className="w-4 h-4 text-slate-500" />
          <span>Policy Revision & Effective Dating Audit Trail</span>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {history.map((h, idx) => (
            <div key={h.config_id || idx} className="py-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    {h.owner_pool_pct}% Pool / {h.amg_allocation_pct}% AMG
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-500">
                    Effective {h.effective_date}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {h.revision_notes || 'Standard configuration'} • By {h.updated_by}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                {h.updated_at ? h.updated_at.substring(0, 10) : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
