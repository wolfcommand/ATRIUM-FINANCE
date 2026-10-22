/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { RevenueCycleView } from './components/RevenueCycleView';
import { SpendingCycleView } from './components/SpendingCycleView';
import { InventoryModule } from './components/inventory/InventoryModule';
import { ServiceChargeModule } from './components/operations/service-charge/ServiceChargeModule';
import { JournalWorkbenchView } from './components/JournalWorkbenchView';
import { GeneralLedgerView } from './components/GeneralLedgerView';
import { TrialBalanceView } from './components/TrialBalanceView';
import { ConfigurationView } from './components/ConfigurationView';
import { ReportsHubView } from './components/reports/ReportsHubView';
import { TaxModule } from './components/TaxModule';
import { ControlsAuditView } from './components/ControlsAuditView';
import { IntegrationsView } from './components/IntegrationsView';
import { AdministrationView } from './components/AdministrationView';
import { MappingModal } from './components/MappingModal';
import { DbStatusModal } from './components/DbStatusModal';
import { ManualJournalModal } from './components/ManualJournalModal';
import { PettyCashView } from './components/PettyCashView';
import {
  Account,
  Department,
  JournalWithLines,
  RevenueTransaction,
  SpendingTransaction,
  MappingConfig,
  DEFAULT_MAPPING_CONFIG,
  PrimaryNavPillar,
  AccessControlState,
} from './types';
import { api } from './services/api';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:3100';

export default function App() {
  // Wolf handoff session gate (Prompt 3) — legacy localStorage login removed
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Primary 8-Pillar Navigation State
  const [activePillar, setActivePillar] = useState<PrimaryNavPillar>('command-centre');

  // Sub-navigation within multi-view pillars
  const [operationsSubTab, setOperationsSubTab] = useState<'revenue' | 'spending' | 'inventory' | 'service-charge' | 'petty-cash'>('revenue');
  const [accountingCoreSubTab, setAccountingCoreSubTab] = useState<'workbench' | 'ledger' | 'trial-balance'>('workbench');
  const [reportsSubTab, setReportsSubTab] = useState<'usali' | 'financial' | 'trial-balance' | 'ledger' | 'owner-pool'>('usali');

  // Master and Transactional Ledger State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [journals, setJournals] = useState<JournalWithLines[]>([]);
  const [revenueTransactions, setRevenueTransactions] = useState<RevenueTransaction[]>([]);
  const [spendingTransactions, setSpendingTransactions] = useState<SpendingTransaction[]>([]);
  const [mappingConfig, setMappingConfig] = useState<MappingConfig>(DEFAULT_MAPPING_CONFIG);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [exceptionsCount, setExceptionsCount] = useState<number>(0);

  // RBAC Access Control State
  const [accessControl, setAccessControl] = useState<AccessControlState | null>(null);

  // Modals state
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isDbStatusModalOpen, setIsDbStatusModalOpen] = useState(false);
  const [isManualJournalOpen, setIsManualJournalOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // Load all master data and transactions
  const refreshAll = useCallback(async () => {
    try {
      const [
        accsRes,
        deptsRes,
        journalsRes,
        revRes,
        spendRes,
        mappingRes,
        dbStatusRes,
        exceptionsRes,
        accessRes,
      ] = await Promise.all([
        api.getAccounts(),
        api.getDepartments(),
        api.getJournals(),
        api.getRevenue(),
        api.getSpending(),
        api.getMapping(),
        api.getStatus(),
        api.getExceptions().catch(() => []),
        api.getAccessControl().catch(() => null),
      ]);

      setAccounts(accsRes || []);
      setDepartments(deptsRes || []);
      setJournals(journalsRes || []);
      setRevenueTransactions(revRes || []);
      setSpendingTransactions(spendRes || []);
      setMappingConfig(
        mappingRes && !(mappingRes as any).error ? mappingRes : DEFAULT_MAPPING_CONFIG
      );
      setDbStatus(dbStatusRes);
      setExceptionsCount(Array.isArray(exceptionsRes) ? exceptionsRes.length : 0);
      if (accessRes) setAccessControl(accessRes);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAccessControl = useCallback(async () => {
    try {
      const accessRes = await api.getAccessControl();
      setAccessControl(accessRes);
    } catch (err) {
      console.error('Failed to refresh access control:', err);
    }
  }, []);

  const handleSwitchUser = async (userId: string) => {
    try {
      const updatedState = await api.switchActiveUser(userId);
      setAccessControl(updatedState);
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const currentUser = accessControl?.users?.find((u) => u.id === accessControl?.currentUserId);
  const currentRole = accessControl?.roles?.find((r) => r.id === currentUser?.roleId);

  // Enforce Pillar View Access
  const canViewActivePillar = currentRole
    ? Boolean(currentRole.permissions?.[activePillar]?.canView)
    : true;

  useEffect(() => {
    let cancelled = false;
    async function bootstrapWolfSession() {
      try {
        const params = new URLSearchParams(window.location.search);
        const handoffToken = params.get('wolf_token');
        if (handoffToken) {
          const res = await fetch('/api/wolf/handoff', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token: handoffToken }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (!cancelled) setAuthError(body.error || 'handoff_failed');
            return;
          }
          window.history.replaceState({}, '', '/');
        }
        const sessionRes = await fetch('/api/wolf/session', { credentials: 'include' });
        if (!sessionRes.ok) {
          if (!cancelled) {
            setIsAuthenticated(false);
            setAuthError('wolf_session_required');
          }
          return;
        }
        if (!cancelled) {
          setIsAuthenticated(true);
          setAuthError(null);
        }
      } catch {
        if (!cancelled) setAuthError('wolf_unreachable');
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }
    bootstrapWolfSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) refreshAll();
  }, [isAuthenticated, refreshAll]);

  // Direct Pillar Navigation Handler
  const handleNavigateToPillar = (pillar: PrimaryNavPillar, subView?: string) => {
    setActivePillar(pillar);
    if (
      pillar === 'operations' &&
      (subView === 'revenue' || subView === 'spending' || subView === 'inventory' || subView === 'service-charge' || subView === 'petty-cash')
    ) {
      setOperationsSubTab(subView as any);
    } else if (
      pillar === 'accounting-core' &&
      (subView === 'workbench' || subView === 'ledger' || subView === 'trial-balance')
    ) {
      setAccountingCoreSubTab(subView as any);
    } else if (
      pillar === 'reports' &&
      (subView === 'usali' || subView === 'financial' || subView === 'trial-balance' || subView === 'ledger' || subView === 'owner-pool')
    ) {
      setReportsSubTab(subView as any);
    }
  };

  // Cross-Tab Navigation Handler for backward compatibility
  const handleCrossTabNavigate = (tab: string) => {
    if (tab === 'revenue' || tab === 'spending' || tab === 'inventory' || tab === 'service-charge') {
      setActivePillar('operations');
      setOperationsSubTab(tab as any);
    } else if (tab === 'owner-pool') {
      setActivePillar('reports');
      setReportsSubTab('owner-pool');
    } else if (tab === 'workbench' || tab === 'ledger' || tab === 'trial-balance') {
      setActivePillar('accounting-core');
      setAccountingCoreSubTab(tab as any);
    } else if (tab === 'reports') {
      setActivePillar('reports');
    } else if (tab === 'tax') {
      setActivePillar('tax');
    } else if (tab === 'accounts' || tab === 'configuration') {
      setActivePillar('configuration');
    } else if (tab === 'controls') {
      setActivePillar('controls-audit');
    } else if (tab === 'integrations') {
      setActivePillar('integrations');
    } else if (tab === 'admin') {
      setActivePillar('administration');
    } else {
      setActivePillar('command-centre');
    }
  };

  // Navigate directly to Journal Workbench and focus on a specific journal
  const handleViewJournal = (journalId: string) => {
    setSelectedJournalId(journalId);
    setActivePillar('accounting-core');
    setAccountingCoreSubTab('workbench');
  };

  const handleJournalCreated = (journalId: string) => {
    refreshAll();
    handleViewJournal(journalId);
  };

  const handleSignOut = async () => {
    await fetch('/api/wolf/logout', { method: 'POST', credentials: 'include' });
    setIsAuthenticated(false);
    window.location.href = PORTAL_URL;
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        Checking Wolf session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-800 p-6">
        <h1 className="text-xl font-semibold">Finance requires Wolf portal sign-in</h1>
        <p className="text-sm text-slate-600 max-w-md text-center">
          Legacy login is disabled. Open Finance from the Wolf portal launcher
          {authError ? ` (${authError})` : ''}.
        </p>
        <a
          href={PORTAL_URL}
          className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium"
        >
          Go to Wolf portal
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Primary Top Navigation - 8 Pillars */}
      <Navbar
        activePillar={activePillar}
        onSelectPillar={handleNavigateToPillar}
        operationsSubTab={operationsSubTab}
        onSelectOperationsSubTab={setOperationsSubTab}
        accountingCoreSubTab={accountingCoreSubTab}
        onSelectAccountingCoreSubTab={setAccountingCoreSubTab}
        reportsSubTab={reportsSubTab}
        onSelectReportsSubTab={setReportsSubTab}
        currentUser={currentUser}
        currentRole={currentRole}
        allUsers={accessControl?.users || []}
        onSwitchUser={handleSwitchUser}
        onSignOut={handleSignOut}
        onOpenMappingModal={() => setIsMappingModalOpen(true)}
        pendingJournalsCount={
          journals.filter((j) => j.status === 'VALIDATED' || j.status === 'DRAFT').length
        }
        exceptionsCount={exceptionsCount}
      />

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono">Initializing Atrium Finance ledger...</p>
          </div>
        ) : !canViewActivePillar ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto my-12 space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/60 border border-amber-800/40 text-amber-400 mx-auto flex items-center justify-center font-mono text-xl font-bold">
              403
            </div>
            <h2 className="text-lg font-bold text-slate-100">
              Module Access Restricted
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your active role <span className="text-emerald-400 font-semibold">{currentRole?.name || 'Assigned Role'}</span> does not have viewing permissions for <span className="font-mono text-slate-300 font-bold">{activePillar.toUpperCase()}</span>.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setActivePillar('command-centre')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Return to Command Centre
              </button>
              <button
                onClick={() => setActivePillar('administration')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Review RBAC Roles
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. COMMAND CENTRE (Dashboard overview/control surface) */}
            {activePillar === 'command-centre' && (
              <DashboardView
                onNavigateToPillar={handleNavigateToPillar}
                onNavigate={handleCrossTabNavigate}
                onOpenMappingModal={() => setIsMappingModalOpen(true)}
                onOpenDbStatusModal={() => setIsDbStatusModalOpen(true)}
                dbStatus={dbStatus}
              />
            )}

            {/* 2. OPERATIONS (Revenue & Spending operational cycles) */}
            {activePillar === 'operations' && operationsSubTab === 'revenue' && (
              <RevenueCycleView
                transactions={revenueTransactions}
                accounts={accounts}
                departments={departments}
                mappingConfig={mappingConfig}
                onRefresh={refreshAll}
                onOpenMappingModal={() => setIsMappingModalOpen(true)}
                onViewJournal={handleViewJournal}
              />
            )}

            {activePillar === 'operations' && operationsSubTab === 'spending' && (
              <SpendingCycleView
                transactions={spendingTransactions}
                accounts={accounts}
                departments={departments}
                mappingConfig={mappingConfig}
                onRefresh={refreshAll}
                onOpenMappingModal={() => setIsMappingModalOpen(true)}
                onViewJournal={handleViewJournal}
              />
            )}

            {activePillar === 'operations' && operationsSubTab === 'inventory' && (
              <InventoryModule
                departments={departments}
                accounts={accounts}
                onViewJournal={handleViewJournal}
              />
            )}

            {activePillar === 'operations' && operationsSubTab === 'service-charge' && (
              <ServiceChargeModule
                departments={departments}
                accounts={accounts}
                onViewJournal={handleViewJournal}
                onRefreshStore={refreshAll}
              />
            )}

            {activePillar === 'operations' && operationsSubTab === 'petty-cash' && (
              <PettyCashView
                onRefresh={refreshAll}
                onViewJournal={handleViewJournal}
              />
            )}

            {/* 3. ACCOUNTING CORE (Actual independent double-entry accounting module) */}
            {activePillar === 'accounting-core' && accountingCoreSubTab === 'workbench' && (
              <JournalWorkbenchView
                journals={journals}
                accounts={accounts}
                departments={departments}
                selectedJournalId={selectedJournalId}
                onRefresh={refreshAll}
                onOpenManualJournalModal={() => setIsManualJournalOpen(true)}
                onNavigateToLedger={() => {
                  setActivePillar('accounting-core');
                  setAccountingCoreSubTab('ledger');
                }}
              />
            )}

            {activePillar === 'accounting-core' && accountingCoreSubTab === 'ledger' && (
              <GeneralLedgerView
                accounts={accounts}
                onViewJournal={handleViewJournal}
              />
            )}

            {activePillar === 'accounting-core' && accountingCoreSubTab === 'trial-balance' && (
              <TrialBalanceView />
            )}

            {/* 4. REPORTS (Dedicated USALI 12 & Financial Reporting Layer & Owner Pool) */}
            {activePillar === 'reports' && (
              <ReportsHubView
                activeReport={reportsSubTab}
                onSelectReport={setReportsSubTab}
                onOpenJournalInWorkbench={handleViewJournal}
              />
            )}

            {/* 5. TAX (Hospitality Tax Compliance, PBJT, PPh, PPN, Owner Tax) */}
            {activePillar === 'tax' && (
              <TaxModule currentUser={currentUser} currentRole={currentRole} />
            )}

            {/* 6. CONFIGURATION (Isolated from accounting transactions: COA, Depts, Clearing rules) */}
            {activePillar === 'configuration' && (
              <ConfigurationView
                accounts={accounts}
                departments={departments}
                mappingConfig={mappingConfig}
                onRefresh={refreshAll}
              />
            )}

            {/* 6. CONTROLS & AUDIT (Continuous integrity scanner and chronological audit trail) */}
            {activePillar === 'controls-audit' && (
              <ControlsAuditView onNavigateToTab={handleCrossTabNavigate} />
            )}

            {/* 7. INTEGRATIONS (Google Sheets DB, PMS Night Audit ingestion, external feeds) */}
            {activePillar === 'integrations' && (
              <IntegrationsView
                onViewJournal={handleViewJournal}
                onRefresh={refreshAll}
              />
            )}

            {/* 8. ADMINISTRATION (Period close locks, property profile, controller governance, RBAC) */}
            {activePillar === 'administration' && (
              <AdministrationView
                accounts={accounts}
                departments={departments}
                onRefresh={refreshAll}
                accessControl={accessControl}
                onSwitchUser={handleSwitchUser}
                onRefreshAccessControl={refreshAccessControl}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ATRIUM FINANCE / WOLF COMMAND &bull; Strict Double-Entry Ledger</span>
          <span>USALI 12th Revised Edition &bull; Immutable Audit Logs</span>
        </div>
      </footer>

      {/* Global Modals */}
      <MappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        accounts={accounts}
        currentMapping={mappingConfig}
        currentConfig={mappingConfig}
        onSaveMapping={async (config) => {
          await api.updateMapping(config);
          await refreshAll();
        }}
        onSaved={refreshAll}
      />

      <DbStatusModal
        isOpen={isDbStatusModalOpen}
        onClose={() => setIsDbStatusModalOpen(false)}
        dbStatus={dbStatus}
        onRefresh={refreshAll}
      />

      <ManualJournalModal
        isOpen={isManualJournalOpen}
        onClose={() => setIsManualJournalOpen(false)}
        accounts={accounts}
        departments={departments}
        onCreated={handleJournalCreated}
      />
    </div>
  );
}
