/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sliders,
  Palette,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Hash,
  Coins,
  Type,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  MasterReportConfig,
  DEFAULT_MASTER_REPORT_CONFIG,
  ConfigurableReportSection,
  ConfigurableReportLine,
  Account,
} from '../../types';
import { api } from '../../services/api';
import { formatAmount, getDensityClasses, getThemeClasses } from '../../utils/reportFormatter';

interface ReportConfigDesignerProps {
  accounts: Account[];
  onConfigSaved?: () => void;
}

export const ReportConfigDesigner: React.FC<ReportConfigDesignerProps> = ({
  accounts,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<MasterReportConfig>(
    JSON.parse(JSON.stringify(DEFAULT_MASTER_REPORT_CONFIG))
  );
  const [originalConfig, setOriginalConfig] = useState<MasterReportConfig>(
    JSON.parse(JSON.stringify(DEFAULT_MASTER_REPORT_CONFIG))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sub-tabs within Report Designer
  const [activeSubTab, setActiveSubTab] = useState<'formatting' | 'structure' | 'preview'>('formatting');
  const [selectedReportType, setSelectedReportType] = useState<'usali' | 'balance_sheet' | 'income_statement'>('usali');

  // Preview mock amounts for structure preview
  const previewAmounts: Record<string, number> = {
    'USALI-REV-ROOMS': 142000000,
    'USALI-REV-FB': 68500000,
    'USALI-REV-OTHER': 12300000,
    'USALI-REV-MISC': 4200000,
    'USALI-EXP-ROOMS': 28400000,
    'USALI-EXP-FB': 24600000,
    'USALI-EXP-OTHER': 3900000,
    'USALI-UND-AG': 18500000,
    'USALI-UND-POM': 9200000,
    'USALI-UND-SM': 11400000,
    'USALI-UND-ENERGY': 14800000,
    'USALI-MGMT-FEES': 8500000,
    'USALI-NON-OP': 6200000,

    'BS-AST-CASH': 854000000,
    'BS-AST-RECEIVABLES': 324000000,
    'BS-AST-INVENTORY': 98000000,
    'BS-AST-PREPAID': 45000000,
    'BS-AST-PPE': 4500000000,
    'BS-AST-DEPR': -650000000,
    'BS-LIA-AP': 185000000,
    'BS-LIA-ACCRUED': 92000000,
    'BS-LIA-TAX': 45000000,
    'BS-LIA-DEBT': 1500000000,
    'BS-EQU-CAPITAL': 2500000000,
    'BS-EQU-RETAINED': 844000000,

    'IS-REV-ROOMS': 142000000,
    'IS-REV-FB': 68500000,
    'IS-REV-OTHER': 16500000,
    'IS-COS-FB': 24600000,
    'IS-COS-OTHER': 3900000,
    'IS-EXP-ROOMS': 28400000,
    'IS-EXP-FB': 12500000,
    'IS-EXP-AG': 18500000,
    'IS-EXP-POM': 9200000,
    'IS-EXP-SM': 11400000,
    'IS-EXP-UTILITIES': 14800000,
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getReportConfig();
      if (data && data.formatting && data.structures) {
        setConfig(data);
        setOriginalConfig(JSON.parse(JSON.stringify(data)));
      }
    } catch (err: any) {
      console.error('Error loading report config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const saved = await api.updateReportConfig(config);
      setConfig(saved);
      setOriginalConfig(JSON.parse(JSON.stringify(saved)));
      setMessage({
        type: 'success',
        text: 'Report format and structure configuration successfully saved and applied to all reporting statements.',
      });
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const safeConfirm = (msg: string): boolean => {
    try {
      return window.confirm(msg);
    } catch {
      return true;
    }
  };

  const handleResetDefaults = async () => {
    if (!safeConfirm('Reset all report formats and structures to default USALI 12th Edition and statutory standards?')) return;
    try {
      setSaving(true);
      setMessage(null);
      const reset = await api.resetReportConfig();
      setConfig(reset);
      setOriginalConfig(JSON.parse(JSON.stringify(reset)));
      setMessage({
        type: 'success',
        text: 'Report configurations have been reset to factory USALI 12 and statutory standards.',
      });
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset configuration' });
    } finally {
      setSaving(false);
    }
  };

  // Helpers for Structure editing
  const getActiveSections = (): ConfigurableReportSection[] => {
    if (selectedReportType === 'usali') return config.structures.usali_sections;
    if (selectedReportType === 'balance_sheet') return config.structures.balance_sheet_sections;
    return config.structures.income_statement_sections;
  };

  const updateActiveSections = (newSections: ConfigurableReportSection[]) => {
    if (selectedReportType === 'usali') {
      setConfig({
        ...config,
        structures: { ...config.structures, usali_sections: newSections },
      });
    } else if (selectedReportType === 'balance_sheet') {
      setConfig({
        ...config,
        structures: { ...config.structures, balance_sheet_sections: newSections },
      });
    } else {
      setConfig({
        ...config,
        structures: { ...config.structures, income_statement_sections: newSections },
      });
    }
  };

  const handleUpdateSectionTitle = (sectionIdx: number, newTitle: string) => {
    const updated = [...getActiveSections()];
    updated[sectionIdx].section_title = newTitle;
    updateActiveSections(updated);
  };

  const handleToggleSectionVisibility = (sectionIdx: number) => {
    const updated = [...getActiveSections()];
    updated[sectionIdx].is_visible = !updated[sectionIdx].is_visible;
    updateActiveSections(updated);
  };

  const handleUpdateLine = (sectionIdx: number, lineIdx: number, field: keyof ConfigurableReportLine, value: any) => {
    const updated = [...getActiveSections()];
    const line = { ...updated[sectionIdx].lines[lineIdx], [field]: value };
    updated[sectionIdx].lines[lineIdx] = line;
    updateActiveSections(updated);
  };

  const handleMoveLine = (sectionIdx: number, lineIdx: number, direction: 'up' | 'down') => {
    const updated = [...getActiveSections()];
    const lines = [...updated[sectionIdx].lines];
    const targetIdx = direction === 'up' ? lineIdx - 1 : lineIdx + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const temp = lines[lineIdx];
    lines[lineIdx] = lines[targetIdx];
    lines[targetIdx] = temp;

    // re-assign orders
    lines.forEach((l, idx) => (l.order = idx + 1));
    updated[sectionIdx].lines = lines;
    updateActiveSections(updated);
  };

  const handleAddCustomLine = (sectionIdx: number) => {
    const updated = [...getActiveSections()];
    const section = updated[sectionIdx];
    const newId = `CUSTOM-${Date.now().toString().slice(-4)}`;
    const newLine: ConfigurableReportLine = {
      id: newId,
      label: 'New Custom Report Line',
      category: section.section_id.includes('rev') ? 'Revenue' : 'Expense',
      account_prefixes: [],
      indent_level: 1,
      is_visible: true,
      is_bold: false,
      order: section.lines.length + 1,
    };
    section.lines.push(newLine);
    updateActiveSections(updated);
  };

  const handleDeleteLine = (sectionIdx: number, lineIdx: number) => {
    const updated = [...getActiveSections()];
    updated[sectionIdx].lines.splice(lineIdx, 1);
    updated[sectionIdx].lines.forEach((l, idx) => (l.order = idx + 1));
    updateActiveSections(updated);
  };

  const themeCls = getThemeClasses(config.formatting.visual_theme);
  const densityCls = getDensityClasses(config.formatting.table_density);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mb-2"></div>
        <p className="text-xs">Loading report layout configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-slate-900">
              Report Format & Structure Designer
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900/10/60 border border-emerald-800/40 text-emerald-700">
              LIVE CONFIGURABLE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tailor currency symbols, number scaling, financial typography, section roll-up lines, and account mappings for all USALI & Statutory statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Reset to default USALI 12 standards"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Standards</span>
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-900 shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Notification Message */}
      {message && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs animate-in fade-in duration-200 ${
            message.type === 'success'
              ? 'bg-slate-900/10/40 border-emerald-800/50 text-emerald-700'
              : 'bg-red-600/10/40 border-rose-800/50 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Designer Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('formatting')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'formatting'
              ? 'bg-slate-900/10 text-emerald-700 border border-emerald-500/30 font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>1. Format & Presentation Rules</span>
        </button>

        <button
          onClick={() => setActiveSubTab('structure')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'structure'
              ? 'bg-slate-900/10 text-emerald-700 border border-emerald-500/30 font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>2. Sections & Line Item Structure</span>
        </button>

        <button
          onClick={() => setActiveSubTab('preview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'preview'
              ? 'bg-slate-900/10 text-emerald-700 border border-emerald-500/30 font-semibold shadow-xs'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>3. Live Interactive Preview</span>
        </button>
      </div>

      {/* TAB 1: FORMAT & PRESENTATION RULES */}
      {activeSubTab === 'formatting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card A: Currency & Number Scale */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 border-b border-slate-200 pb-2.5">
              <Coins className="w-4 h-4" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Currency & Number Scaling
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Base Currency Symbol
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.formatting.currency_symbol}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, currency_symbol: e.target.value },
                      })
                    }
                    placeholder="Rp"
                    className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">e.g. Rp, $, €, £, S$</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  ISO Currency Code
                </label>
                <input
                  type="text"
                  value={config.formatting.currency_code}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      formatting: { ...config.formatting, currency_code: e.target.value.toUpperCase() },
                    })
                  }
                  placeholder="IDR"
                  className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Currency Symbol Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, currency_position: 'prefix' },
                      })
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                      config.formatting.currency_position === 'prefix'
                        ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Prefix ({config.formatting.currency_symbol} 100)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, currency_position: 'suffix' },
                      })
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-colors ${
                      config.formatting.currency_position === 'suffix'
                        ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Suffix (100 {config.formatting.currency_symbol})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Denomination / Number Scale
                </label>
                <select
                  value={config.formatting.number_scale}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      formatting: { ...config.formatting, number_scale: e.target.value as any },
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="full">Exact Full Amount (e.g. 15,000,000)</option>
                  <option value="thousands">In Thousands (k) (e.g. 15,000 k)</option>
                  <option value="millions">In Millions (M) (e.g. 15.00 M)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Decimal Places
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((dp) => (
                    <button
                      key={dp}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, decimal_places: dp },
                        })
                      }
                      className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                        config.formatting.decimal_places === dp
                          ? 'bg-slate-900/20 border-emerald-500 text-emerald-700 font-bold'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {dp} decimals
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card B: Negative Values & Zero Presentation */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 border-b border-slate-200 pb-2.5">
              <Hash className="w-4 h-4" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Accounting Notation Rules
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Negative Numbers Format
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer hover:border-slate-200">
                    <input
                      type="radio"
                      name="negative_format"
                      checked={config.formatting.negative_format === 'parentheses'}
                      onChange={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, negative_format: 'parentheses' },
                        })
                      }
                      className="text-emerald-700 focus:ring-emerald-500"
                    />
                    <span>Accounting Parentheses: <strong>(1,250,000)</strong></span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer hover:border-slate-200">
                    <input
                      type="radio"
                      name="negative_format"
                      checked={config.formatting.negative_format === 'minus'}
                      onChange={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, negative_format: 'minus' },
                        })
                      }
                      className="text-emerald-700 focus:ring-emerald-500"
                    />
                    <span>Standard Minus: <strong>-1,250,000</strong></span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer hover:border-slate-200">
                    <input
                      type="radio"
                      name="negative_format"
                      checked={config.formatting.negative_format === 'red'}
                      onChange={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, negative_format: 'red' },
                        })
                      }
                      className="text-emerald-700 focus:ring-emerald-500"
                    />
                    <span>Red Font Parentheses: <strong className="text-red-600">(1,250,000)</strong></span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Zero Values Presentation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, zero_format: 'dash' },
                      })
                    }
                    className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                      config.formatting.zero_format === 'dash'
                        ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Dash (—)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, zero_format: 'zero' },
                      })
                    }
                    className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                      config.formatting.zero_format === 'zero'
                        ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Zero (0)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, zero_format: 'blank' },
                      })
                    }
                    className={`py-1.5 rounded-lg text-xs font-medium border text-center transition-colors ${
                      config.formatting.zero_format === 'blank'
                        ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Blank Space
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.formatting.double_underline_totals}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, double_underline_totals: e.target.checked },
                      })
                    }
                    className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                  />
                  <span>Classic accounting double underline on grand totals</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.formatting.show_percent_of_revenue}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, show_percent_of_revenue: e.target.checked },
                      })
                    }
                    className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                  />
                  <span>Display % of Total Revenue column in statements</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.formatting.show_account_codes}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, show_account_codes: e.target.checked },
                      })
                    }
                    className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                  />
                  <span>Show GL Account Code tags beside line items</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card C: Visual Layout, Theme & Density */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 border-b border-slate-200 pb-2.5">
              <Palette className="w-4 h-4" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Visual Style & Density
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Table Padding & Density
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'compact', label: 'Compact', desc: 'Dense Ledger' },
                    { id: 'standard', label: 'Standard', desc: 'Default' },
                    { id: 'spacious', label: 'Spacious', desc: 'Executive' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, table_density: d.id as any },
                        })
                      }
                      className={`p-2 rounded-lg text-center border transition-colors ${
                        config.formatting.table_density === d.id
                          ? 'bg-slate-900/20 border-emerald-500 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[10px] text-slate-500">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Report Color Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'slate', name: 'Executive Slate', tag: 'bg-white border-slate-200' },
                    { id: 'emerald', name: 'Crisp Emerald', tag: 'bg-slate-900/10 border-emerald-700' },
                    { id: 'classic', name: 'Warm Ledger', tag: 'bg-slate-900/10 border-amber-700' },
                    { id: 'contrast', name: 'Crisp Contrast', tag: 'bg-black border-white' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          formatting: { ...config.formatting, visual_theme: t.id as any },
                        })
                      }
                      className={`p-2 rounded-lg flex items-center gap-2 border text-left transition-colors ${
                        config.formatting.visual_theme === t.id
                          ? 'border-emerald-500 bg-slate-900/10/30 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border ${t.tag}`}></span>
                      <span className="text-xs font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Report Header Property Name
                  </label>
                  <input
                    type="text"
                    value={config.formatting.header_company_name}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, header_company_name: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Report Sub-heading
                  </label>
                  <input
                    type="text"
                    value={config.formatting.header_subtitle}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, header_subtitle: e.target.value },
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={config.formatting.show_signature_block}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        formatting: { ...config.formatting, show_signature_block: e.target.checked },
                      })
                    }
                    className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                  />
                  <span>Include Controller Certification Sign-Off Block</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECTIONS & LINE ITEM STRUCTURE */}
      {activeSubTab === 'structure' && (
        <div className="space-y-6">
          {/* Report Type Selector */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold text-slate-700">
                Select Report Statement to Customize:
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedReportType('usali')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'usali'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                USALI 12th Operating Statement
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('balance_sheet')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'balance_sheet'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Balance Sheet (Position)
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('income_statement')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'income_statement'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Income Statement (P&L)
              </button>
            </div>
          </div>

          {/* Section Accordions / Line Editors */}
          <div className="space-y-4">
            {getActiveSections().map((section, sIdx) => (
              <div
                key={section.section_id}
                className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs"
              >
                {/* Section Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/60 border-b border-slate-200">
                  <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
                    <input
                      type="text"
                      value={section.section_title}
                      onChange={(e) => handleUpdateSectionTitle(sIdx, e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none flex-1 max-w-sm"
                      title="Edit Section Title"
                    />
                    <span className="text-[11px] font-mono text-slate-500">
                      [{section.section_id}]
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={section.is_visible}
                        onChange={() => handleToggleSectionVisibility(sIdx)}
                        className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                      />
                      <span>Section Visible</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleAddCustomLine(sIdx)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-200 text-emerald-700 border border-slate-200 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Line</span>
                    </button>
                  </div>
                </div>

                {/* Section Lines Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-white/40 text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-12 text-center">Order</th>
                        <th className="py-2.5 px-4 w-32">Line ID</th>
                        <th className="py-2.5 px-4">Line Label (Displayed on Report)</th>
                        <th className="py-2.5 px-4 w-48">Mapped Account Prefixes</th>
                        <th className="py-2.5 px-4 w-24 text-center">Indent</th>
                        <th className="py-2.5 px-4 w-20 text-center">Visible</th>
                        <th className="py-2.5 px-4 w-28 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {section.lines.map((line, lIdx) => (
                        <tr key={line.id} className="hover:bg-white/30 transition-colors">
                          <td className="py-2.5 px-4 text-center text-slate-500 font-mono">
                            {line.order || lIdx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-emerald-700">
                            {line.id}
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={line.label}
                              onChange={(e) => handleUpdateLine(sIdx, lIdx, 'label', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={(line.account_prefixes || []).join(', ')}
                              onChange={(e) => {
                                const prefixes = e.target.value
                                  .split(',')
                                  .map((p) => p.trim())
                                  .filter(Boolean);
                                handleUpdateLine(sIdx, lIdx, 'account_prefixes', prefixes);
                              }}
                              placeholder="e.g. 40, 4010"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded font-mono text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                              title="Comma-separated account code prefixes that roll into this line"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <select
                              value={line.indent_level || 1}
                              onChange={(e) =>
                                handleUpdateLine(sIdx, lIdx, 'indent_level', parseInt(e.target.value, 10))
                              }
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="0">0 (Flush)</option>
                              <option value="1">1 (Indent)</option>
                              <option value="2">2 (Double)</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={line.is_visible !== false}
                              onChange={(e) => handleUpdateLine(sIdx, lIdx, 'is_visible', e.target.checked)}
                              className="rounded bg-white border-slate-200 text-emerald-700 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveLine(sIdx, lIdx, 'up')}
                                disabled={lIdx === 0}
                                className="p-1 rounded hover:bg-white text-slate-500 hover:text-slate-700 disabled:opacity-30"
                                title="Move line up"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveLine(sIdx, lIdx, 'down')}
                                disabled={lIdx === section.lines.length - 1}
                                className="p-1 rounded hover:bg-white text-slate-500 hover:text-slate-700 disabled:opacity-30"
                                title="Move line down"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLine(sIdx, lIdx)}
                                className="p-1 rounded hover:bg-red-600/10/50 text-slate-500 hover:text-red-600 ml-1"
                                title="Delete line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {section.lines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-500 italic">
                            No lines configured in this section. Click &ldquo;Add Line&rdquo; to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LIVE INTERACTIVE PREVIEW */}
      {activeSubTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-semibold text-slate-700">
                Live Rendering Preview under active formatting ({config.formatting.visual_theme} / {config.formatting.number_scale})
              </span>
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedReportType('usali')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'usali'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                USALI Statement
              </button>
              <button
                type="button"
                onClick={() => setSelectedReportType('balance_sheet')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'balance_sheet'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Balance Sheet
              </button>
              <button
                type="button"
                onClick={() => setSelectedReportType('income_statement')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedReportType === 'income_statement'
                    ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Income Statement
              </button>
            </div>
          </div>

          {/* Rendered Live Statement Document */}
          <div className={`p-6 rounded-xl border shadow-xs transition-all ${themeCls.cardBg}`}>
            {/* Header */}
            <div className="border-b border-slate-200/80 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    {config.formatting.header_company_name || 'PT Atrium Management Group'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {config.formatting.header_subtitle || 'Summary Operating Statement'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-mono font-semibold bg-slate-900/10 text-emerald-700 border border-emerald-500/30">
                    Currency: {config.formatting.currency_code} ({config.formatting.currency_symbol}) • Scale: {config.formatting.number_scale}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1">Period: All Time (Live Sample)</div>
                </div>
              </div>
            </div>

            {/* Statement Table */}
            <div className="overflow-x-auto">
              <table className={`w-full text-left rounded-lg overflow-hidden ${themeCls.tableBg}`}>
                <thead className={`border-b ${themeCls.thBg}`}>
                  <tr>
                    <th className={densityCls.th}>Statement Line Item</th>
                    {config.formatting.show_account_codes && (
                      <th className={`${densityCls.th} w-32`}>Account Roll-ups</th>
                    )}
                    <th className={`${densityCls.th} text-right w-44`}>
                      Current Period ({config.formatting.currency_symbol})
                    </th>
                    {config.formatting.show_percent_of_revenue && (
                      <th className={`${densityCls.th} text-right w-24`}>% of Rev</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {getActiveSections()
                    .filter((s) => s.is_visible)
                    .map((sec) => {
                      const visibleLines = sec.lines.filter((l) => l.is_visible !== false);
                      const secTotal = visibleLines.reduce(
                        (sum, l) => sum + (previewAmounts[l.id] || 15000000),
                        0
                      );

                      return (
                        <React.Fragment key={sec.section_id}>
                          {/* Section Header */}
                          <tr className={themeCls.sectionGeneric}>
                            <td
                              colSpan={
                                2 +
                                (config.formatting.show_account_codes ? 1 : 0) +
                                (config.formatting.show_percent_of_revenue ? 1 : 0)
                              }
                              className={densityCls.sectionHeader}
                            >
                              {sec.section_title.toUpperCase()}
                            </td>
                          </tr>

                          {/* Line items */}
                          {visibleLines.map((line) => {
                            const amount = previewAmounts[line.id] || 15000000;
                            const totalRevMock = 227000000;
                            const pct = Math.abs(Math.round((amount / totalRevMock) * 1000) / 10);

                            return (
                              <tr key={line.id} className={`${themeCls.rowHover} transition-colors`}>
                                <td className={densityCls.td}>
                                  <div
                                    style={{
                                      paddingLeft: `${(line.indent_level || 1) * 16}px`,
                                    }}
                                  >
                                    {line.label}
                                  </div>
                                </td>
                                {config.formatting.show_account_codes && (
                                  <td className={`${densityCls.td} font-mono text-[11px] text-slate-500`}>
                                    {(line.account_prefixes || []).join(', ') || 'Auto'}
                                  </td>
                                )}
                                <td
                                  className={`${densityCls.td} text-right font-mono font-medium ${
                                    amount < 0 && config.formatting.negative_format === 'red'
                                      ? 'text-red-600'
                                      : ''
                                  }`}
                                >
                                  {formatAmount(amount, config.formatting)}
                                </td>
                                {config.formatting.show_percent_of_revenue && (
                                  <td className={`${densityCls.td} text-right font-mono text-slate-500`}>
                                    {pct}%
                                  </td>
                                )}
                              </tr>
                            );
                          })}

                          {/* Section Subtotal */}
                          <tr className={themeCls.subtotalBg}>
                            <td className={densityCls.subtotal}>
                              <div className="font-semibold pl-4">
                                Total {sec.section_title}
                              </div>
                            </td>
                            {config.formatting.show_account_codes && <td></td>}
                            <td
                              className={`${densityCls.subtotal} text-right font-mono ${
                                config.formatting.double_underline_totals
                                  ? 'border-b-4 border-double border-emerald-500/60'
                                  : 'border-b border-emerald-500/40'
                              }`}
                            >
                              {formatAmount(secTotal, config.formatting)}
                            </td>
                            {config.formatting.show_percent_of_revenue && (
                              <td className={`${densityCls.subtotal} text-right font-mono text-emerald-700`}>
                                {Math.round((Math.abs(secTotal) / 227000000) * 1000) / 10}%
                              </td>
                            )}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Controller Sign-off Block */}
            {config.formatting.show_signature_block && (
              <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
                <div className="space-y-1">
                  <div className="font-medium text-slate-700">Financial Controller Certification:</div>
                  <div className="text-[11px] text-slate-500">
                    Prepared under strictly balanced double-entry accounting records.
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="w-36 border-b border-slate-200 pb-1 font-mono text-[11px] text-slate-700">
                      Approved
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">General Manager</div>
                  </div>

                  <div className="text-center">
                    <div className="w-36 border-b border-slate-200 pb-1 font-mono text-[11px] text-emerald-700">
                      Certified True
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Financial Controller</div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Disclaimer */}
            <div className="mt-4 pt-3 border-t border-slate-900 text-center text-[10px] text-slate-500">
              {config.formatting.footer_disclaimer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
