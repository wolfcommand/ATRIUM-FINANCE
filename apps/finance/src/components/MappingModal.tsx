/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Account, MappingConfig, DEFAULT_MAPPING_CONFIG } from '../types';
import { api } from '../services/api';

interface MappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: Account[];
  currentMapping?: MappingConfig;
  currentConfig?: MappingConfig;
  onSaveMapping?: (config: MappingConfig) => Promise<void>;
  onSaved?: () => void;
}

export const MappingModal: React.FC<MappingModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  currentMapping,
  currentConfig,
  onSaveMapping,
  onSaved,
}) => {
  const activeMapping = currentMapping || currentConfig || DEFAULT_MAPPING_CONFIG;
  const [formData, setFormData] = useState<MappingConfig>({
    ...DEFAULT_MAPPING_CONFIG,
    ...activeMapping,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const config = currentMapping || currentConfig || DEFAULT_MAPPING_CONFIG;
    setFormData({
      ...DEFAULT_MAPPING_CONFIG,
      ...config,
    });
  }, [currentMapping, currentConfig]);

  if (!isOpen) return null;

  // Filter accounts by type for intuitive selection
  const safeAccounts = accounts || [];
  const assetAccounts = safeAccounts.filter(
    (a) => a.account_type === 'Asset' && a.active === 'Y'
  );
  const liabilityAccounts = safeAccounts.filter(
    (a) => a.account_type === 'Liability' && a.active === 'Y'
  );
  const allActiveAccounts = safeAccounts.filter((a) => a.active === 'Y');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload: MappingConfig = {
        revenue_default_debit_account: formData.revenue_default_debit_account || '',
        spending_procurement_credit_account: formData.spending_procurement_credit_account || '',
        spending_payroll_credit_account: formData.spending_payroll_credit_account || '',
        spending_other_credit_account: formData.spending_other_credit_account || '',
        confirmed_by_controller: true,
      };

      if (onSaveMapping) {
        await onSaveMapping(payload);
      } else {
        await api.updateMapping(payload);
      }

      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save mapping configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900/10/60 border border-emerald-800/60 rounded-lg text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Accounting Counterpart Rules
              </h2>
              <p className="text-xs text-slate-500">
                Controller authorization for automated double-entry journal mappings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-slate-900/10/30 border-y border-amber-800/40 px-6 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Per accounting governance rules, transactions will <strong>not</strong> auto-generate
            journals with guessed counterpart accounts. Confirm the default accounts below or
            select an explicit account during transaction entry.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Revenue Mapping */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Revenue Default Settlement Account (Debit)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Default Asset/Receivable account debited when revenue transactions (Rooms, F&B, Events) are recorded.
            </p>
            <select
              id="select-rev-mapping"
              value={formData.revenue_default_debit_account}
              onChange={(e) =>
                setFormData({ ...formData, revenue_default_debit_account: e.target.value })
              }
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="">-- Select Counterpart Asset Account --</option>
              {assetAccounts.map((acc) => (
                <option key={acc.account_code} value={acc.account_code}>
                  [{acc.account_code}] {acc.account_name} ({acc.account_type})
                </option>
              ))}
              {/* If no asset accounts found, display all */}
              {assetAccounts.length === 0 &&
                allActiveAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
            </select>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Spending Default Counterpart Accounts (Credit)
            </h3>

            {/* Procurement AP */}
            <div className="space-y-1">
              <label className="block text-xs text-slate-700">
                1. Procurement & Vendor Purchases (Credit Account)
              </label>
              <select
                id="select-spend-proc-mapping"
                value={formData.spending_procurement_credit_account}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    spending_procurement_credit_account: e.target.value,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="">-- Select Accounts Payable Account --</option>
                {liabilityAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
                {liabilityAccounts.length === 0 &&
                  allActiveAccounts.map((acc) => (
                    <option key={acc.account_code} value={acc.account_code}>
                      [{acc.account_code}] {acc.account_name} ({acc.account_type})
                    </option>
                  ))}
              </select>
            </div>

            {/* Payroll Accrual */}
            <div className="space-y-1">
              <label className="block text-xs text-slate-700">
                2. Payroll & Staff Compensation (Credit Account)
              </label>
              <select
                id="select-spend-payroll-mapping"
                value={formData.spending_payroll_credit_account}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    spending_payroll_credit_account: e.target.value,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="">-- Select Accrued Payroll / Bank Account --</option>
                {allActiveAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Other Spending */}
            <div className="space-y-1">
              <label className="block text-xs text-slate-700">
                3. Direct Disbursements / Other Spending (Credit Account)
              </label>
              <select
                id="select-spend-other-mapping"
                value={formData.spending_other_credit_account}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    spending_other_credit_account: e.target.value,
                  })
                }
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="">-- Select Cash / Bank Account --</option>
                {allActiveAccounts.map((acc) => (
                  <option key={acc.account_code} value={acc.account_code}>
                    [{acc.account_code}] {acc.account_name} ({acc.account_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-lg hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Confirm & Authorize Mappings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
