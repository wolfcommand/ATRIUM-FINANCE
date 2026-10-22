/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Database, RefreshCw, CheckCircle2, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface DbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status?: any;
  dbStatus?: any;
  onRefresh: () => void;
}

export const DbStatusModal: React.FC<DbStatusModalProps> = ({
  isOpen,
  onClose,
  status: propStatus,
  dbStatus,
  onRefresh,
}) => {
  const status = propStatus || dbStatus || {};
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await api.reinitSheets();
      if (res.success) {
        setMessage('Successfully connected to Google Sheets and verified required tabs!');
      } else {
        setMessage(`Connection check: ${res.status?.error || 'Unable to connect to Google Sheets'}`);
      }
      onRefresh();
    } catch (err: any) {
      setMessage(`Error: ${err.message || 'Failed to re-initialize'}`);
    } finally {
      setTesting(false);
    }
  };

  const expectedTabs = [
    'chart_of_accounts',
    'departments',
    'journal_header',
    'journal_line',
    'revenue_transactions',
    'spending_transactions',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${status?.connected ? 'bg-slate-900/10/60 border-emerald-800/60 text-emerald-700' : 'bg-slate-900/10/60 border-amber-800/60 text-amber-700'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Google Sheets Database Status</h2>
              <p className="text-xs text-slate-500">Atrium Finance persistent data store connection</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Badge */}
          <div className={`p-4 rounded-lg border flex items-start gap-3 ${status?.connected ? 'bg-slate-900/10/30 border-emerald-800/50' : 'bg-slate-900/10/20 border-amber-800/40'}`}>
            {status?.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                {status?.connected ? 'Live Connected to Google Sheets' : 'Local Sandbox / Session Storage Active'}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {status?.connected
                  ? 'All transaction journals, chart of accounts, and ledger records are synchronizing in real time to your Google Sheets spreadsheet.'
                  : 'Google Sheets service account credentials are not configured or pending in AI Studio Secrets. The application runs locally in memory so you can test all accounting workflows.'}
              </p>
            </div>
          </div>

          {/* Connection Details */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-900 gap-1">
              <span className="text-slate-500">Spreadsheet ID:</span>
              <span className="text-slate-700 truncate max-w-xs">{status?.spreadsheetId || '(Not set in GOOGLE_SPREADSHEET_ID)'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-900 gap-1">
              <span className="text-slate-500">Service Account Email:</span>
              <span className="text-slate-700 truncate max-w-xs">{status?.clientEmail || '(Not set in GOOGLE_SERVICE_ACCOUNT_EMAIL)'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">Private Key:</span>
              <span className="text-slate-700">{status?.hasCredentials ? 'Configured (Hidden)' : '(Not set)'}</span>
            </div>
          </div>

          {/* Tab Verification */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Required Google Sheets Tabs
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {expectedTabs.map((tab) => {
                const isFound = status?.initializedTabs?.includes(tab);
                return (
                  <div key={tab} className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-md text-xs font-mono">
                    <span className="text-slate-700">{tab}</span>
                    {isFound ? (
                      <span className="text-emerald-700 text-[11px] flex items-center gap-1 font-sans font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px] font-sans">
                        Auto-creates on sync
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup Guide for Financial Controller */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Key className="w-4 h-4 text-emerald-700" />
              <span>How to connect your Google Sheets:</span>
            </div>
            <ol className="list-decimal list-inside text-xs text-slate-500 space-y-1 pl-1">
              <li>Create a Google Cloud Service Account and download the JSON key.</li>
              <li>Share your Google Sheet with the Service Account email (Editor permissions).</li>
              <li>In Google AI Studio, open Settings &gt; Secrets, and add:
                <div className="mt-1 pl-2 font-mono text-[11px] text-slate-700 space-y-0.5">
                  <div>- GOOGLE_PROJECT_ID</div>
                  <div>- GOOGLE_SERVICE_ACCOUNT_EMAIL</div>
                  <div>- GOOGLE_PRIVATE_KEY</div>
                  <div>- GOOGLE_SPREADSHEET_ID</div>
                </div>
              </li>
              <li>Click "Test &amp; Re-sync with Sheets" below.</li>
            </ol>
          </div>

          {message && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
              {message}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {status?.storeStats ? `${status.storeStats.journals} journals recorded in memory` : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Test & Re-sync'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
