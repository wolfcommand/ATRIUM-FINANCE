/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Database,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Server,
  Workflow,
  Radio,
  FileSpreadsheet,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { SheetsDiagnostics } from '../types';

interface IntegrationsViewProps {
  onViewJournal?: (journalId: string) => void;
  onRefresh?: () => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onViewJournal, onRefresh }) => {
  const [diagnostics, setDiagnostics] = useState<SheetsDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // PMS Night Audit Ingestion Form State
  const [pmsDate, setPmsDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [roomRev, setRoomRev] = useState<number>(15500000);
  const [fbRev, setFbRev] = useState<number>(6200000);
  const [eventsRev, setEventsRev] = useState<number>(2000000);
  const [pmsDesc, setPmsDesc] = useState<string>('Daily In-House Guest Ledger & Outlets Closing');
  const [ingestingPms, setIngestingPms] = useState(false);
  const [createdJournalId, setCreatedJournalId] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoadingDiag(true);
    setStatusMessage(null);
    try {
      const res = await api.getSheetsDiagnostics();
      setDiagnostics(res);
      setStatusMessage({
        type: 'success',
        text: `Diagnostics completed in ${res.latency_ms}ms. ${res.tabs_verified?.length || 0} sheets verified.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to execute Google Sheets diagnostics',
      });
    } finally {
      setLoadingDiag(false);
    }
  };

  const handleForceResync = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await api.reinitSheets();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Google Sheets synchronization refreshed successfully. All master data & journals aligned.',
        });
        await runDiagnostics();
        if (onRefresh) onRefresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.status?.error || 'Google Sheets re-initialization encountered an issue.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to trigger re-synchronization',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleIngestPms = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestingPms(true);
    setStatusMessage(null);
    setCreatedJournalId(null);

    try {
      const res = await api.ingestPmsAudit({
        date: pmsDate,
        room_revenue: Number(roomRev) || 0,
        fb_revenue: Number(fbRev) || 0,
        other_revenue: Number(eventsRev) || 0,
        description: pmsDesc,
      });

      setCreatedJournalId(res.journal?.journal_id || null);
      setStatusMessage({
        type: 'success',
        text: `PMS Night Audit recorded! Created ${res.transactions?.length || 0} revenue transactions and Draft Journal ${res.journal?.journal_id || ''}.`,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to ingest PMS Night Audit batch',
      });
    } finally {
      setIngestingPms(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const sheetUrl = diagnostics?.spreadsheet_id
    ? `https://docs.google.com/spreadsheets/d/${diagnostics.spreadsheet_id}`
    : 'https://docs.google.com/spreadsheets/d/1xcAejEwYu7WHEtZ77IvB-OdYMX83nU5LxbQ4VsIGO-I';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-xs backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Workflow className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Integrations & External Ecosystem
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-900/10/60 border border-emerald-800/40 text-emerald-700">
                ACTIVE DATA PIPELINES
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live Google Sheets ledger datastore, automated PMS Night Audit batch ingestion, and channel manager adapters
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleForceResync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Force Sheets Re-Sync'}</span>
            </button>

            <button
              onClick={runDiagnostics}
              disabled={loadingDiag}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
              <span>{loadingDiag ? 'Testing Latency...' : 'Run Diagnostics'}</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-slate-900/10/40 border border-emerald-800/50 text-emerald-200'
              : 'bg-red-600/10/40 border border-rose-800/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{statusMessage.text}</span>
            {createdJournalId && onViewJournal && (
              <button
                onClick={() => onViewJournal(createdJournalId)}
                className="ml-3 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold flex items-center gap-1"
              >
                <span>View Journal</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="font-mono text-[11px] opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid of Connectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Sheets Live Datastore */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-900/10/60 border border-emerald-800/40 flex items-center justify-center text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Google Sheets Live Datastore</h3>
                <span className="text-xs text-slate-500">Persistent General Ledger Backend</span>
              </div>
            </div>
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-emerald-700 bg-slate-900/10/60 border border-emerald-800/40 hover:bg-emerald-900/50"
            >
              <span>Open Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Spreadsheet ID:</span>
              <span className="text-slate-700 truncate max-w-[200px]" title={diagnostics?.spreadsheet_id}>
                {diagnostics?.spreadsheet_id || '1xcAejEwYu7WHEtZ77IvB-OdYMX83nU5LxbQ4VsIGO-I'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Spreadsheet Title:</span>
              <span className="text-slate-700">
                {diagnostics?.spreadsheet_title || 'Atrium Master Accounting Sheet'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">API Gateway Latency:</span>
              <span className="text-emerald-700 font-semibold">
                {diagnostics ? `${diagnostics.latency_ms} ms` : 'Checking...'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Connection Status:</span>
              <span className="text-emerald-700 font-semibold">
                {diagnostics?.connected ? 'AUTHENTICATED & HEALTHY' : 'CONNECTING...'}
              </span>
            </div>
          </div>

          {/* Verified Tabs Summary */}
          {diagnostics?.tabs_verified && diagnostics.tabs_verified.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Verified Database Tabs:
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {diagnostics.tabs_verified.map((tab) => (
                  <div
                    key={tab.tab_name}
                    className="p-2 rounded bg-white border border-slate-200 flex justify-between items-center"
                  >
                    <span className="text-slate-700 truncate">{tab.tab_name}</span>
                    <span className="text-emerald-700 text-[11px] font-semibold">{tab.rows_count} rows</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Automated PMS Night Audit Ingestor */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-slate-500">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">PMS Night Audit Interface</h3>
                <span className="text-xs text-slate-500">Automated Daily Revenue Posting</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-blue-950/60 border border-blue-800/40 text-blue-300">
              REAL-TIME ADAPTER
            </span>
          </div>

          <form onSubmit={handleIngestPms} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Night Audit Date:
                </label>
                <input
                  type="date"
                  value={pmsDate}
                  onChange={(e) => setPmsDate(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Transient Rooms Revenue:
                </label>
                <input
                  type="number"
                  value={roomRev}
                  onChange={(e) => setRoomRev(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-xs focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  F&B Outlets Revenue:
                </label>
                <input
                  type="number"
                  value={fbRev}
                  onChange={(e) => setFbRev(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Banquets & Events Revenue:
                </label>
                <input
                  type="number"
                  value={eventsRev}
                  onChange={(e) => setEventsRev(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 font-mono text-xs focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Audit Batch Reference / Description:
              </label>
              <input
                type="text"
                value={pmsDesc}
                onChange={(e) => setPmsDesc(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-slate-700 text-xs focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="p-2.5 rounded bg-white border border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Total Batch Impact:</span>
              <span className="font-mono text-emerald-700 font-bold text-xs">
                Rp {(((roomRev || 0) + (fbRev || 0) + (eventsRev || 0)) || 0).toLocaleString()}
              </span>
            </div>

            <button
              type="submit"
              disabled={ingestingPms}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {ingestingPms ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" />
              )}
              <span>
                {ingestingPms
                  ? 'Generating Double-Entry Journal...'
                  : 'Post Night Audit Batch to Workbench'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
