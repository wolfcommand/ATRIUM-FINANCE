/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  OwnerDistributionEmailConfig,
  OwnerDistributionEmailDraft,
  OwnerEmailDispatchLog,
  OwnerDistributionBatch,
} from '../../../types';
import { api } from '../../../services/api';
import {
  Mail,
  Send,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Edit3,
  Save,
  RotateCcw,
  Settings,
  Paperclip,
  Download,
  Search,
  Users,
  CheckSquare,
  Square,
  ShieldCheck,
  Building,
  RefreshCw,
  X,
  ChevronRight,
  ExternalLink,
  UserCheck,
  HelpCircle,
  Info,
  Server,
  Check,
  Lock,
} from 'lucide-react';

interface EmailDistributionViewProps {
  initialPeriod?: string;
  onNavigateToBatch?: () => void;
}

export const EmailDistributionView: React.FC<EmailDistributionViewProps> = ({
  initialPeriod = '2026-09',
  onNavigateToBatch,
}) => {
  const [period, setPeriod] = useState<string>(initialPeriod);
  const [batches, setBatches] = useState<OwnerDistributionBatch[]>([]);
  const [drafts, setDrafts] = useState<OwnerDistributionEmailDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [config, setConfig] = useState<OwnerDistributionEmailConfig | null>(null);
  const [dispatches, setDispatches] = useState<OwnerEmailDispatchLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sub-tab: 'drafts' | 'logs' | 'config'
  const [activeSubTab, setActiveSubTab] = useState<'drafts' | 'logs' | 'config'>('drafts');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'READY' | 'SENT'>('ALL');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Draft Editor State
  const [editorRecipient, setEditorRecipient] = useState('');
  const [editorCc, setEditorCc] = useState('');
  const [editorSubject, setEditorSubject] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [editorNote, setEditorNote] = useState('');
  const [editorAttachments, setEditorAttachments] = useState<any[]>([]);
  const [editorViewMode, setEditorViewMode] = useState<'preview' | 'code'>('preview');

  // Config Modal State
  const [tempConfig, setTempConfig] = useState<OwnerDistributionEmailConfig | null>(null);

  // Document Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{
    open: boolean;
    title: string;
    docType: string;
    unitId: string;
    url: string;
  } | null>(null);

  // One-Button Email All Confirmation Modal
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [batchTestEmail, setBatchTestEmail] = useState('');

  // SMTP Testing & Setup Guide State
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  const handleTestSmtp = async () => {
    if (!tempConfig?.smtp) {
      setSmtpTestResult({
        success: false,
        message: 'SMTP settings are not configured. Please fill in the Host, Port, and Username.',
      });
      return;
    }
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await api.testOwnerEmailSmtp(tempConfig.smtp);
      setSmtpTestResult(res);
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err.message || 'SMTP connection failed. Check host, port, or password.',
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  const loadAllData = async (targetPeriod: string = period) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [fetchedBatches, fetchedDrafts, fetchedConfig, fetchedLogs] = await Promise.all([
        api.getOwnerPoolBatches(),
        api.getOwnerEmailDrafts(targetPeriod),
        api.getOwnerEmailConfig(),
        api.getOwnerEmailDispatches(targetPeriod),
      ]);

      const safeBatches = Array.isArray(fetchedBatches) ? fetchedBatches : [];
      const safeDrafts = Array.isArray(fetchedDrafts) ? fetchedDrafts : [];
      const safeDispatches = Array.isArray(fetchedLogs) ? fetchedLogs : [];

      setBatches(safeBatches);
      setDrafts(safeDrafts);
      setConfig(fetchedConfig || null);
      setTempConfig(fetchedConfig || null);
      setDispatches(safeDispatches);

      // Select first draft by default if none selected or not found
      if (safeDrafts.length > 0) {
        const found = safeDrafts.find((d) => d.draft_id === selectedDraftId);
        const current = found || safeDrafts[0];
        setSelectedDraftId(current.draft_id);
        populateEditor(current);
        setSelectedUnitIds(safeDrafts.map((d) => d.unit_id));
      } else {
        setSelectedDraftId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load email distribution data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData(period);
  }, [period]);

  const populateEditor = (draft: OwnerDistributionEmailDraft) => {
    setEditorRecipient(draft.recipient_email || '');
    setEditorCc(Array.isArray(draft.cc_emails) ? draft.cc_emails.join(', ') : '');
    setEditorSubject(draft.subject || '');
    setEditorBody(draft.body_text || '');
    setEditorNote(draft.custom_note || '');
    setEditorAttachments(Array.isArray(draft.attachments) ? draft.attachments : []);
  };

  const selectedDraft = drafts.find((d) => d.draft_id === selectedDraftId) || null;

  const handleSelectDraft = (draft: OwnerDistributionEmailDraft) => {
    setSelectedDraftId(draft.draft_id);
    populateEditor(draft);
  };

  const handleSaveCurrentDraft = async () => {
    if (!selectedDraft) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const ccArray = editorCc
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.saveOwnerEmailDraft(selectedDraft.draft_id, {
        recipient_email: editorRecipient,
        cc_emails: ccArray,
        subject: editorSubject,
        body_text: editorBody,
        custom_note: editorNote,
        attachments: editorAttachments,
        status: 'READY',
      });

      setDrafts((prev) =>
        prev.map((d) => (d.draft_id === selectedDraft.draft_id ? res.draft : d))
      );
      setSuccessMsg(`Draft for Unit ${selectedDraft.unit_number} (${selectedDraft.owner_name}) saved.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save draft');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetCurrentDraft = async () => {
    if (!selectedDraft) return;
    if (!window.confirm('Reset this draft to standard default template? Any personal edits will be restored to defaults.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.resetOwnerEmailDraft(selectedDraft.draft_id);
      const reloaded = await api.getOwnerEmailDrafts(period);
      setDrafts(reloaded);
      const found = reloaded.find((d) => d.draft_id === selectedDraft.draft_id);
      if (found) populateEditor(found);
      setSuccessMsg(`Draft for Unit ${selectedDraft.unit_number} reset to template.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset draft');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendSingleEmail = async (testToMe: boolean = false) => {
    if (!selectedDraft) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const testEmail = testToMe ? 'laluzayen@gmail.com' : undefined;
      const res = await api.sendSingleOwnerEmail(selectedDraft.draft_id, testEmail);

      if (testToMe) {
        setSuccessMsg(`Test preview email dispatched to ${testEmail}! Verify your inbox.`);
      } else {
        setSuccessMsg(`Official distribution email sent to ${selectedDraft.owner_name} (${res.dispatch.recipient_email})!`);
        setDrafts((prev) =>
          prev.map((d) => (d.draft_id === selectedDraft.draft_id ? res.draft : d))
        );
      }

      // Refresh logs
      const logs = await api.getOwnerEmailDispatches(period);
      setDispatches(logs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send email');
    } finally {
      setActionLoading(false);
    }
  };

  // ONE BUTTON TO EMAIL ALL INVESTORS
  const handleEmailAllInvestors = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const testEmail = batchTestEmail.trim() || undefined;
      const targetUnitIds = selectedUnitIds.length > 0 ? selectedUnitIds : undefined;

      const res = await api.emailAllInvestors({
        period,
        unit_ids: targetUnitIds,
        test_email: testEmail,
      });

      setShowBatchConfirmModal(false);
      setSuccessMsg(
        testEmail
          ? `Batch simulation completed! ${res.result.successful_count} reports sent to test address: ${testEmail}.`
          : `🎉 One-button email dispatch completed! Successfully delivered reports with certified attachments to ${res.result.successful_count} investors.`
      );

      // Refresh drafts and logs
      const [reloadedDrafts, reloadedLogs] = await Promise.all([
        api.getOwnerEmailDrafts(period),
        api.getOwnerEmailDispatches(period),
      ]);
      setDrafts(reloadedDrafts);
      setDispatches(reloadedLogs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch email dispatch failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!tempConfig) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.updateOwnerEmailConfig(tempConfig);
      setConfig(res.config);
      setSuccessMsg('Email template and attachment rules successfully updated.');
      setActiveSubTab('drafts');
      // Reload drafts with new template applied
      const reloaded = await api.getOwnerEmailDrafts(period);
      setDrafts(reloaded);
      if (selectedDraftId) {
        const found = reloaded.find((d) => d.draft_id === selectedDraftId);
        if (found) populateEditor(found);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update email configuration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAttachmentForCurrentDraft = (attId: string) => {
    setEditorAttachments((prev) =>
      prev.map((a) => (a.id === attId ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleToggleSelectUnit = (unitId: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const handleSelectAllUnits = () => {
    const list = drafts || [];
    if (selectedUnitIds.length === list.length) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(list.map((d) => d.unit_id));
    }
  };

  const handleOpenDocPreview = (docType: string, unitId: string, title: string) => {
    const url = api.getDocumentPreviewUrl(docType, unitId, period);
    setPreviewDoc({
      open: true,
      title,
      docType,
      unitId,
      url,
    });
  };

  const formatIDR = (val?: number) => {
    if (val === undefined || val === null) return 'Rp 0';
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  const filteredDrafts = (drafts || []).filter((d) => {
    const matchesSearch =
      (d.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.unit_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.recipient_email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBatchPayout = (drafts || []).reduce(
    (sum, d) => sum + (d.financial_summary?.net_distribution_amount || 0),
    0
  );

  const sentCount = (drafts || []).filter((d) => d.status === 'SENT').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & One-Button Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Investor Email Distribution Dispatcher
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Auto-Report &amp; Attachments
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Automated delivery of monthly distribution statements, calculation audits, revenue certificates, and bank transfer advice to registered owner emails.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Period Selector & ONE BUTTON TO EMAIL ALL */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Batch Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="2026-09">September 2026 (2026-09)</option>
                <option value="2026-08">August 2026 (2026-08)</option>
                <option value="2026-07">July 2026 (2026-07)</option>
              </select>
            </div>

            {/* ONE BUTTON TO EMAIL ALL INVESTORS */}
            <div className="pt-4 sm:pt-0">
              <button
                type="button"
                onClick={() => setShowBatchConfirmModal(true)}
                disabled={actionLoading || (drafts || []).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Email All Investors ({selectedUnitIds.length}/{(drafts || []).length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-slate-500 block font-medium">Eligible Investors</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">
              {(drafts || []).length} Units ({selectedUnitIds.length} Selected)
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-slate-500 block font-medium">Total Net Distribution</span>
            <span className="text-base font-bold text-emerald-700 mt-0.5 block">
              {formatIDR(totalBatchPayout)}
            </span>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-slate-500 block font-medium">Dispatched Status</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base font-bold text-slate-900">
                {sentCount} / {(drafts || []).length} Sent
              </span>
              {sentCount === (drafts || []).length && (drafts || []).length > 0 && (
                <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-500 block font-medium">Attached Documents</span>
              <span className="text-xs font-bold text-indigo-700 mt-0.5 block">
                {(editorAttachments || []).filter((a) => a?.enabled).length} Documents Active
              </span>
            </div>
            <button
              onClick={() => setActiveSubTab('config')}
              className="p-2 hover:bg-white text-slate-500 hover:text-indigo-600 rounded-md border border-slate-200 transition-colors"
              title="Configure Templates & Attachments"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {successMsg && (
          <div className="mt-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('drafts')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeSubTab === 'drafts'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Investor Drafts &amp; Live Editor</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {(drafts || []).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeSubTab === 'logs'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Dispatch &amp; Delivery Audit Logs</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {(dispatches || []).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeSubTab === 'config'
                ? 'border-indigo-600 text-indigo-700 font-bold bg-indigo-50/40 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Format &amp; Attachment Configuration</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
              showGuide
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>Setup &amp; Workflow Guide</span>
          </button>

          <button
            onClick={() => loadAllData(period)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SETUP & WORKFLOW GUIDE BANNER */}
      {showGuide && (
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white border border-indigo-700/50 rounded-2xl p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Owner Pool Email Distribution: Functional Setup &amp; Operations Guide
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Follow these 5 streamlined steps to configure, verify, test, and broadcast certified return statements to all apartment owners.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-indigo-800/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs pt-1">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Registry Setup</span>
              </div>
              <p className="text-[11px] text-slate-700">
                In <strong>Units &amp; Owners Registry</strong>, ensure each unit has a registered Owner Name, SQM, Valid Email Address, and Bank Account details.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Calculate Batch</span>
              </div>
              <p className="text-[11px] text-slate-700">
                In <strong>Monthly Distribution Engine</strong>, calculate and reconcile the period (e.g. 65% pool vs 10% guarantee). This automatically generates all investor drafts.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">3</span>
                <span>Template &amp; Docs</span>
              </div>
              <p className="text-[11px] text-slate-700">
                In <strong>Format &amp; Attachment Configuration</strong>, define default attachments (Statement, Audit, Revenue Certificate, Bank Advice, PPh slip, CSV) and email text.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">4</span>
                <span>SMTP Gateway</span>
              </div>
              <p className="text-[11px] text-slate-700">
                Configure your corporate SMTP or Gmail App Password under Configuration &amp; test connection. Or leave in Audit Simulator mode for testing.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">5</span>
                <span>Dispatch Emails</span>
              </div>
              <p className="text-[11px] text-slate-700">
                Use <strong>Test to Me</strong> to verify a preview draft in your mailbox, then click <strong>One-Click Dispatch (Email All)</strong> to send certified reports to all investors!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 1: DRAFTS & LIVE EDITOR */}
      {activeSubTab === 'drafts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Investor Recipients List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Investor Drafts ({filteredDrafts.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllUnits}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  {selectedUnitIds.length === (drafts || []).length ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5" /> Select All ({(drafts || []).length})
                    </>
                  )}
                </button>
              </div>

              {/* Search & Status Filter */}
              <div className="space-y-2 mb-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search name, unit, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-1 overflow-x-auto text-[11px]">
                  {(['ALL', 'DRAFT', 'READY', 'SENT'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        statusFilter === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drafts List */}
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto pr-1">
                {filteredDrafts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No matching investor drafts found.
                  </div>
                ) : (
                  filteredDrafts.map((d) => {
                    const isSelected = d.draft_id === selectedDraftId;
                    const isChecked = selectedUnitIds.includes(d.unit_id);

                    return (
                      <div
                        key={d.draft_id}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-indigo-50/80 border border-indigo-200'
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => handleSelectDraft(d)}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelectUnit(d.unit_id);
                          }}
                          className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              Unit {d.unit_number} - {d.owner_name}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                                d.status === 'SENT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.status === 'READY'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {d.recipient_email}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-semibold mt-1">
                            <span className="text-emerald-700">
                              {formatIDR(d.financial_summary?.net_distribution_amount)}
                            </span>
                            <span className="text-slate-500 text-[10px]">
                              {(d.attachments || []).filter((a) => a?.enabled).length} docs
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Investor Draft Editor & Attachment Inspector */}
          <div className="lg:col-span-8 space-y-4">
            {selectedDraft ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                {/* Draft Header & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900">
                        Draft: Unit {selectedDraft.unit_number} ({selectedDraft.financial_summary.unit_sqm} m²)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedDraft.financial_summary.applicable_return_basis_type === 'GUARANTEED_RETURN'
                          ? '10% Guarantee Audit'
                          : 'SQM Pro-Rata Share'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Investor: <strong className="text-slate-700">{selectedDraft.owner_name}</strong> • Bank: {selectedDraft.financial_summary.bank_name} ({selectedDraft.financial_summary.bank_account_number})
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetCurrentDraft}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Reset this draft to standard default template"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrentDraft}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendSingleEmail(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-white hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Sends a test preview to laluzayen@gmail.com"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Test to Me</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendSingleEmail(false)}
                      disabled={actionLoading}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send to Investor</span>
                    </button>
                  </div>
                </div>

                {/* Email Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Investor Email Address *
                    </label>
                    <input
                      type="email"
                      value={editorRecipient}
                      onChange={(e) => setEditorRecipient(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      CC Emails (Finance &amp; Audit)
                    </label>
                    <input
                      type="text"
                      value={editorCc}
                      onChange={(e) => setEditorCc(e.target.value)}
                      placeholder="finance@atriumhotel.com, gm@atriumhotel.com"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Subject Line *
                  </label>
                  <input
                    type="text"
                    value={editorSubject}
                    onChange={(e) => setEditorSubject(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Personalized Custom Note for this investor */}
                <div>
                  <label className="block font-semibold text-indigo-900 mb-1 text-xs flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    Individual Investor Note / Remarks (Optional - included in this email only):
                  </label>
                  <textarea
                    rows={2}
                    value={editorNote}
                    onChange={(e) => setEditorNote(e.target.value)}
                    placeholder="e.g. Account update confirmed. September withholding tax slip is attached under PPh Final 4(2)."
                    className="w-full px-3 py-1.5 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* View Mode Toggle: Preview vs Code */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">Email Body &amp; Letter Format</span>
                    <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => setEditorViewMode('preview')}
                        className={`px-3 py-1 font-semibold transition-colors ${
                          editorViewMode === 'preview'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Visual Rendered Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorViewMode('code')}
                        className={`px-3 py-1 font-semibold transition-colors ${
                          editorViewMode === 'code'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Edit Raw Text
                      </button>
                    </div>
                  </div>

                  {editorViewMode === 'code' ? (
                    <textarea
                      rows={10}
                      value={editorBody}
                      onChange={(e) => setEditorBody(e.target.value)}
                      className="w-full px-3 py-2 font-mono text-xs bg-white text-slate-900 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto text-xs text-slate-800 leading-relaxed shadow-inner">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: selectedDraft.body_html || selectedDraft.body_text,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Attached Documents Checklist & Configuration for this investor */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600" />
                      Configured Document Attachments ({(editorAttachments || []).filter((a) => a?.enabled).length} Enabled)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Toggle attachments or click preview to inspect certified document
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {editorAttachments.map((att) => (
                      <div
                        key={att.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                          att.enabled
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={att.enabled}
                            onChange={() => handleToggleAttachmentForCurrentDraft(att.id)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate flex items-center gap-1">
                              <span>{att.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {att.description} ({att.size_kb} KB)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenDocPreview(att.type, selectedDraft.unit_id, att.name)}
                          className="ml-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 shrink-0"
                          title="Preview Document Content"
                        >
                          <Eye className="w-3 h-3 text-indigo-600" />
                          <span>View</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                <Mail className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                <p className="font-bold text-sm text-slate-700">No Draft Selected</p>
                <p className="text-xs text-slate-500 mt-1">
                  Select an investor from the left list to inspect and edit their personalized distribution report email.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DISPATCH & DELIVERY AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">Email Delivery Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Timestamped records of all owner statements and documents emailed to investors for period {period}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (window.confirm(`Clear email logs for period ${period}?`)) {
                    await api.clearOwnerEmailDispatches(period);
                    const updated = await api.getOwnerEmailDispatches(period);
                    setDispatches(updated);
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-lg text-xs font-semibold transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2.5 px-3">Dispatched At</th>
                  <th className="py-2.5 px-3">Unit / Owner</th>
                  <th className="py-2.5 px-3">Recipient Email</th>
                  <th className="py-2.5 px-3">Subject Line</th>
                  <th className="py-2.5 px-3 text-right">Net Payout</th>
                  <th className="py-2.5 px-3 text-center">Attachments</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Delivery Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dispatches || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No email dispatches recorded for period {period}. Use "Email All Investors" to send reports.
                    </td>
                  </tr>
                ) : (
                  dispatches.map((log) => (
                    <tr key={log.dispatch_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.dispatched_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">Unit {log.unit_number}</div>
                        <div className="text-[11px] text-slate-500">{log.owner_name}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {log.recipient_email}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={log.subject}>
                        {log.subject}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {formatIDR(log.net_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                          {log.attachments_count} files
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                        {log.delivery_message_id || log.dispatch_id}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: FORMAT & ATTACHMENT CONFIGURATION */}
      {activeSubTab === 'config' && tempConfig && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Email Template &amp; Document Attachment Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Configure corporate sender identities, subject placeholders, default email body layout, and statutory document attachments.
              </p>
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={actionLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={tempConfig.sender_name}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, sender_name: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender Email Address
              </label>
              <input
                type="email"
                value={tempConfig.sender_email}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, sender_email: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reply-To Email Address
              </label>
              <input
                type="email"
                value={tempConfig.reply_to_email}
                onChange={(e) =>
                  setTempConfig({ ...tempConfig, reply_to_email: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* SMTP Server & Delivery Gateway Settings */}
          <div className="p-5 bg-white text-slate-900 rounded-xl space-y-4 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <span>SMTP Mail Gateway (Live Delivery to Inboxes)</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tempConfig.smtp?.enabled
                        ? 'bg-slate-900/20 text-emerald-700 border border-emerald-500/30'
                        : 'bg-white text-slate-500 border border-slate-200'
                    }`}>
                      {tempConfig.smtp?.enabled ? 'LIVE SMTP ENABLED' : 'AUDIT SIMULATOR MODE'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Connect your hotel's corporate SMTP server, Google Workspace (Gmail App Password), Microsoft 365, or SendGrid to send real certified emails.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(tempConfig.smtp?.enabled)}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setTempConfig({
                        ...tempConfig,
                        smtp: {
                          enabled,
                          host: tempConfig.smtp?.host || 'smtp.gmail.com',
                          port: tempConfig.smtp?.port || 587,
                          secure: tempConfig.smtp?.secure || false,
                          user: tempConfig.smtp?.user || tempConfig.sender_email || '',
                          pass: tempConfig.smtp?.pass || '',
                        },
                      });
                    }}
                    className="rounded text-indigo-500 focus:ring-indigo-400"
                  />
                  <span>Enable Live SMTP Dispatch</span>
                </label>

                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={smtpTesting || !tempConfig.smtp?.host || !tempConfig.smtp?.user}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white disabled:text-slate-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RefreshCw className={`w-3 h-3 ${smtpTesting ? 'animate-spin' : ''}`} />
                  <span>{smtpTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {/* Test result message banner */}
            {smtpTestResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  smtpTestResult.success
                    ? 'bg-slate-900/10/60 border border-emerald-800/60 text-emerald-200'
                    : 'bg-red-600/10/60 border border-rose-800/60 text-rose-200'
                }`}
              >
                {smtpTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <strong className="block font-semibold">{smtpTestResult.success ? 'Success!' : 'Connection Error:'}</strong>
                  <span>{smtpTestResult.message}</span>
                </div>
              </div>
            )}

            {/* SMTP Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={tempConfig.smtp?.host || ''}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      smtp: {
                        enabled: tempConfig.smtp?.enabled ?? false,
                        host: e.target.value,
                        port: tempConfig.smtp?.port || 587,
                        secure: tempConfig.smtp?.secure || false,
                        user: tempConfig.smtp?.user || '',
                        pass: tempConfig.smtp?.pass || '',
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Port *
                </label>
                <input
                  type="number"
                  placeholder="587"
                  value={tempConfig.smtp?.port || 587}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      smtp: {
                        enabled: tempConfig.smtp?.enabled ?? false,
                        host: tempConfig.smtp?.host || '',
                        port: Number(e.target.value) || 587,
                        secure: tempConfig.smtp?.secure || false,
                        user: tempConfig.smtp?.user || '',
                        pass: tempConfig.smtp?.pass || '',
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  SMTP Username / Email *
                </label>
                <input
                  type="text"
                  placeholder="investor.relations@atriumhotel.com"
                  value={tempConfig.smtp?.user || ''}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      smtp: {
                        enabled: tempConfig.smtp?.enabled ?? false,
                        host: tempConfig.smtp?.host || '',
                        port: tempConfig.smtp?.port || 587,
                        secure: tempConfig.smtp?.secure || false,
                        user: e.target.value,
                        pass: tempConfig.smtp?.pass || '',
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">
                    Password / App Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    {showSmtpPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={tempConfig.smtp?.pass || ''}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      smtp: {
                        enabled: tempConfig.smtp?.enabled ?? false,
                        host: tempConfig.smtp?.host || '',
                        port: tempConfig.smtp?.port || 587,
                        secure: tempConfig.smtp?.secure || false,
                        user: tempConfig.smtp?.user || '',
                        pass: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(tempConfig.smtp?.secure)}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      smtp: {
                        enabled: tempConfig.smtp?.enabled ?? false,
                        host: tempConfig.smtp?.host || '',
                        port: tempConfig.smtp?.port || 587,
                        secure: e.target.checked,
                        user: tempConfig.smtp?.user || '',
                        pass: tempConfig.smtp?.pass || '',
                      },
                    })
                  }
                  className="rounded text-indigo-500 focus:ring-indigo-400"
                />
                <span>Use SSL / TLS Encryption (Port 465). Uncheck for STARTTLS (Port 587).</span>
              </label>
              <span className="text-slate-500">
                Tip: For Google Workspace / Gmail, generate a 16-character <strong>App Password</strong> in Google Account &gt; Security.
              </span>
            </div>
          </div>

          {/* Subject Template */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700 text-xs">
              Subject Line Template
            </label>
            <input
              type="text"
              value={tempConfig.subject_template}
              onChange={(e) =>
                setTempConfig({ ...tempConfig, subject_template: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="text-slate-500 font-semibold">Available placeholders:</span>
              {['{{owner_name}}', '{{unit_number}}', '{{period_name}}', '{{net_distribution}}', '{{gross_return}}'].map((tag) => (
                <code
                  key={tag}
                  onClick={() =>
                    setTempConfig({
                      ...tempConfig,
                      subject_template: `${tempConfig.subject_template} ${tag}`,
                    })
                  }
                  className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-100 text-indigo-700 rounded cursor-pointer transition-colors"
                >
                  {tag}
                </code>
              ))}
            </div>
          </div>

          {/* Configured Document Attachments */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-xs text-slate-900">
                Default Document Attachments Included with Each Email
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_statement_pdf}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_statement_pdf: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Owner Return Statement (PDF)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Official certified return calculation with corporate seal &amp; signatures.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_calculation_audit}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_calculation_audit: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Reconciliation Audit Schedule</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    8-point integrity checks, SQM pro-rata formula, and 10% guarantee audit.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_hotel_performance_cert}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_hotel_performance_cert: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Room Revenue Pool Certificate</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Audit of gross room revenue and 65% owner pool certification.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_payment_advice}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_payment_advice: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Bank Transfer Payment Advice</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Official remittance voucher with bank A/C details and reference number.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_tax_slip}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_tax_slip: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">Tax Withholding Slip (PPh)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Statutory Bukti Potong PPh Final Pasal 4(2) / PPh 23 slip.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                <input
                  type="checkbox"
                  checked={tempConfig.attachments.include_csv_breakdown}
                  onChange={(e) =>
                    setTempConfig({
                      ...tempConfig,
                      attachments: {
                        ...tempConfig.attachments,
                        include_csv_breakdown: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-slate-800">CSV Spreadsheet Export</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Attached data table for investor accounting and recordkeeping.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Email Body Master Template */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700 text-xs">
              Master Email Body Template (HTML / Text format)
            </label>
            <textarea
              rows={12}
              value={tempConfig.body_template}
              onChange={(e) =>
                setTempConfig({ ...tempConfig, body_template: e.target.value })
              }
              className="w-full px-3 py-2 font-mono text-xs bg-white text-slate-900 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* ONE-BUTTON EMAIL ALL CONFIRMATION MODAL */}
      {showBatchConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xs border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Email All Investors ({selectedUnitIds.length} Recipients)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Batch Distribution Period: <strong>{period}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchConfirmModal(false)}
                className="text-slate-500 hover:text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Net Distribution:</span>
                <span className="font-bold text-emerald-700">{formatIDR(totalBatchPayout)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Recipients Selected:</span>
                <span className="font-bold text-slate-900">
                  {selectedUnitIds.length} of {(drafts || []).length} Units
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Attachments per Email:</span>
                <span className="font-bold text-indigo-700">
                  {config?.attachments && typeof config.attachments === 'object'
                    ? Object.values(config.attachments).filter((v) => v === true).length
                    : 4}{' '}
                  Certified Documents
                </span>
              </div>
            </div>

            {/* Test Email Override */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional: Test Send to My Email First
              </label>
              <input
                type="email"
                placeholder="Leave blank to send to registered owner inboxes, or enter your test email"
                value={batchTestEmail}
                onChange={(e) => setBatchTestEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: Enter your email (e.g. <code>laluzayen@gmail.com</code>) to test simulation without messaging real investor inboxes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowBatchConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmailAllInvestors}
                disabled={actionLoading || selectedUnitIds.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatched Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm &amp; Send to All Investors</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && previewDoc.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-xs border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewDoc.title}</h3>
                  <p className="text-[11px] text-slate-500">
                    Official Document Attachment Preview • Period: {period}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-500 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Frame / Content */}
            <div className="flex-1 bg-slate-100 p-2 overflow-hidden">
              <iframe
                src={previewDoc.url}
                className="w-full h-full border border-slate-200 rounded-lg bg-white shadow-inner"
                title="Document Attachment Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
