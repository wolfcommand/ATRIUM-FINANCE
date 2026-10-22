/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Layers,
  TrendingUp,
  Sliders,
  ShieldAlert,
  Workflow,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  ChevronDown,
  Lock,
  LogOut,
  Package,
  Coins,
  Building2,
  Receipt,
  PieChart,
  BookOpen,
  Wallet,
} from 'lucide-react';
import { PrimaryNavPillar, SystemUser, UserRoleDefinition } from '../types';
import { AtriumLogo } from './common/AtriumLogo';

export type NavTab =
  | 'dashboard'
  | 'accounts'
  | 'revenue'
  | 'spending'
  | 'inventory'
  | 'service-charge'
  | 'owner-pool'
  | 'workbench'
  | 'reports'
  | 'ledger'
  | 'trial-balance'
  | 'controls'
  | 'integrations'
  | 'admin'
  | 'configuration';

interface NavbarProps {
  activePillar: PrimaryNavPillar;
  onSelectPillar: (pillar: PrimaryNavPillar) => void;
  // Sub-tabs for pillars that have sub-views
  operationsSubTab?: 'revenue' | 'spending' | 'inventory' | 'service-charge' | 'petty-cash';
  onSelectOperationsSubTab?: (tab: 'revenue' | 'spending' | 'inventory' | 'service-charge' | 'petty-cash') => void;
  accountingCoreSubTab?: 'workbench' | 'ledger' | 'trial-balance';
  onSelectAccountingCoreSubTab?: (tab: 'workbench' | 'ledger' | 'trial-balance') => void;
  reportsSubTab?: 'usali' | 'financial' | 'trial-balance' | 'ledger' | 'owner-pool';
  onSelectReportsSubTab?: (tab: 'usali' | 'financial' | 'trial-balance' | 'ledger' | 'owner-pool') => void;
  // RBAC Current User & Roles
  currentUser?: SystemUser;
  currentRole?: UserRoleDefinition;
  allUsers?: SystemUser[];
  onSwitchUser?: (userId: string) => void;
  onSignOut?: () => void;
  // Legacy / Direct navigations
  pendingJournalsCount: number;
  exceptionsCount?: number;
  dbStatus?: {
    connected?: boolean;
    spreadsheetId?: string;
    hasCredentials?: boolean;
    error?: string | null;
  } | null;
  onOpenMappingModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePillar,
  onSelectPillar,
  operationsSubTab = 'revenue',
  onSelectOperationsSubTab,
  accountingCoreSubTab = 'workbench',
  onSelectAccountingCoreSubTab,
  reportsSubTab = 'usali',
  onSelectReportsSubTab,
  currentUser,
  currentRole,
  allUsers = [],
  onSwitchUser,
  onSignOut,
  pendingJournalsCount,
  exceptionsCount = 0,
  dbStatus,
  onOpenMappingModal,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

  const pillars: {
    id: PrimaryNavPillar;
    num: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | null;
    badgeColor?: 'rose' | 'amber';
  }[] = [
    { id: 'command-centre', num: '1', label: 'Command Centre', icon: LayoutDashboard },
    { id: 'operations', num: '2', label: 'Operations', icon: ArrowLeftRight },
    {
      id: 'accounting-core',
      num: '3',
      label: 'Accounting Core',
      icon: Layers,
      badge: pendingJournalsCount > 0 ? pendingJournalsCount : null,
      badgeColor: 'amber',
    },
    { id: 'reports', num: '4', label: 'Reports', icon: TrendingUp },
    { id: 'tax', num: '5', label: 'Tax', icon: Receipt },
    { id: 'configuration', num: '6', label: 'Configuration', icon: Sliders },
    {
      id: 'controls-audit',
      num: '7',
      label: 'Controls & Audit',
      icon: ShieldAlert,
      badge: exceptionsCount > 0 ? exceptionsCount : null,
      badgeColor: 'rose',
    },
    { id: 'integrations', num: '8', label: 'Integrations', icon: Workflow },
    { id: 'administration', num: '9', label: 'Administration', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      {/* Primary Brand & Status Utility Bar */}
      <div className="border-b border-slate-200 px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 max-w-7xl mx-auto">
          {/* Brand: PT ATRIUM MANAGEMENT GROUP */}
          <div
            className="flex items-center gap-2 cursor-pointer group max-w-[60%]"
            onClick={() => onSelectPillar('command-centre')}
          >
            <div className="shrink-0 group-hover:scale-105 transition-transform duration-200">
              <AtriumLogo variant="arch-only" size="md" theme="light" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm uppercase truncate">
                  PT ATRIUM MANAGEMENT GROUP
                </span>
              </div>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-2.5">
            {/* Dynamic RBAC User Profile Badge & Quick Persona Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-2.5 pr-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                title="Current authenticated user session"
              >
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold ring-1 ring-slate-200">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="text-left leading-tight hidden sm:block">
                  <span className="block text-xs font-semibold text-slate-900 max-w-[110px] truncate">
                    {currentUser?.name || 'Authorized User'}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-mono max-w-[120px] truncate">
                    {currentRole?.name?.split('(')[0]?.trim() || 'Staff'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              </button>

              {/* Quick Persona Switcher Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xs p-2 z-50 text-xs">
                  <div className="p-2 border-b border-slate-200 pb-2 mb-1.5">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Active User Session
                    </span>
                    <span className="font-bold text-slate-900 text-sm block">
                      {currentUser?.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block">
                      {currentRole?.name}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-2 block">
                      Switch Role Persona (Simulator):
                    </span>
                    {allUsers.map((user) => {
                      const isCurrent = user.id === currentUser?.id;
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            if (onSwitchUser) onSwitchUser(user.id);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                            isCurrent
                              ? 'bg-slate-900/10 border border-emerald-200/50 text-emerald-700 font-semibold'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <div className="truncate">
                            <span className="block text-xs">{user.name}</span>
                            <span className="block text-[10px] text-slate-500 font-mono truncate">
                              {user.email}
                            </span>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-mono text-emerald-700 font-bold ml-1">
                              ACTIVE
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-200 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPillar('administration');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-center py-1.5 rounded bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors border border-slate-200"
                    >
                      Manage Access in Administration →
                    </button>
                    {onSignOut && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded hover:bg-red-600/50 text-red-600 text-xs font-medium transition-colors border border-transparent hover:border-red-200"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar / Kunci Sesi</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary 8-Pillar Navigation Bar */}
      <div className="px-4 lg:px-6 bg-white">
        <div className="max-w-7xl mx-auto overflow-x-auto no-scrollbar py-1">
          <nav className="flex items-center gap-1 min-w-max">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              const isActive = activePillar === pillar.id;
              // Check if current user has permission to view this pillar
              const hasViewAccess = currentRole
                ? Boolean(currentRole.permissions?.[pillar.id]?.canView)
                : true;

              return (
                <button
                  key={pillar.id}
                  id={`nav-pillar-${pillar.id}`}
                  onClick={() => onSelectPillar(pillar.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all relative ${
                    isActive
                      ? 'bg-slate-900 text-white border border-slate-900 shadow-xs font-semibold'
                      : !hasViewAccess
                        ? 'text-slate-500 hover:text-slate-500 hover:bg-slate-100 opacity-60'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={!hasViewAccess ? `Access to ${pillar.label} is restricted for your role (${currentRole?.name})` : undefined}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : !hasViewAccess ? 'text-slate-500' : 'text-slate-500'}`} />
                  <span className="font-mono text-[11px] text-slate-500 mr-0.5">{pillar.num}.</span>
                  <span className={`font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{pillar.label}</span>
                  {!hasViewAccess && (
                    <Lock className="w-3 h-3 text-amber-700 ml-0.5" />
                  )}
                  {pillar.badge ? (
                    <span
                      className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono border ${
                        pillar.badgeColor === 'rose'
                          ? 'bg-slate-900/10 text-amber-700 border-amber-200/50'
                          : 'bg-slate-900/10 text-amber-700 border-amber-200/50'
                      }`}
                    >
                      {pillar.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Contextual Sub-Navigation Bar for Multi-View Pillars */}
      {activePillar === 'operations' && (
        <div className="px-3 lg:px-6 py-1.5 bg-white border-t border-slate-200 overflow-x-auto">
          <div className="max-w-full mx-auto min-w-0">
            <div className="flex flex-wrap items-start justify-start text-xs gap-1.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Operations Cycle:
              </span>
              <button
                onClick={() => onSelectOperationsSubTab && onSelectOperationsSubTab('revenue')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  operationsSubTab === 'revenue'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-3 h-3 text-slate-500" />
                <span className={`${operationsSubTab === 'revenue' ? 'text-white' : 'text-slate-500'}`}>Revenue Cycle (Sales &amp; AR)</span>
              </button>

              <button
                onClick={() => onSelectOperationsSubTab && onSelectOperationsSubTab('spending')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  operationsSubTab === 'spending'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3 h-3 text-slate-500" />
                <span className={`${operationsSubTab === 'spending' ? 'text-white' : 'text-slate-500'}`}>Spending Cycle (Procurement, AP)</span>
              </button>

              <button
                id="nav-operations-inventory"
                onClick={() => onSelectOperationsSubTab && onSelectOperationsSubTab('inventory')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  operationsSubTab === 'inventory'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Package className="w-3 h-3 text-slate-500" />
                <span className={`${operationsSubTab === 'inventory' ? 'text-white' : 'text-slate-500'}`}>Procurement, PO &amp; Storerooms</span>
              </button>

              <button
                id="nav-operations-service-charge"
                onClick={() => onSelectOperationsSubTab && onSelectOperationsSubTab('service-charge')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  operationsSubTab === 'service-charge'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3 h-3 text-slate-500" />
                <span className={`${operationsSubTab === 'service-charge' ? 'text-white' : 'text-slate-500'}`}>Staff Service Charge &amp; Pool</span>
              </button>

              <button
                id="nav-operations-petty-cash"
                onClick={() => onSelectOperationsSubTab && onSelectOperationsSubTab('petty-cash')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  operationsSubTab === 'petty-cash'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Wallet className="w-3 h-3 text-slate-500" />
                <span className={`${operationsSubTab === 'petty-cash' ? 'text-white' : 'text-slate-500'}`}>Petty Cash (Operasional)</span>
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:block mt-1">
              Auto-generates balanced double-entry drafts
            </span>
          </div>
        </div>
      )}

      {activePillar === 'reports' && (
        <div className="px-3 lg:px-6 py-1.5 bg-white border-t border-slate-200 overflow-x-auto">
          <div className="max-w-full mx-auto min-w-0">
            <div className="flex flex-wrap items-start justify-start text-xs gap-1.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Reports &amp; Statements:
              </span>
              <button
                onClick={() => onSelectReportsSubTab && onSelectReportsSubTab('usali')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  reportsSubTab === 'usali'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3 h-3 text-slate-500" />
                <span className={`${reportsSubTab === 'usali' ? 'text-white' : 'text-slate-500'}`}>USALI 12 Statements</span>
              </button>

              <button
                onClick={() => onSelectReportsSubTab && onSelectReportsSubTab('financial')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  reportsSubTab === 'financial'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3 h-3 text-slate-500" />
                <span className={`${reportsSubTab === 'financial' ? 'text-white' : 'text-slate-500'}`}>Balance Sheet &amp; P&amp;L</span>
              </button>

              <button
                onClick={() => onSelectReportsSubTab && onSelectReportsSubTab('trial-balance')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  reportsSubTab === 'trial-balance'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                <span className={`${reportsSubTab === 'trial-balance' ? 'text-white' : 'text-slate-500'}`}>Trial Balance</span>
              </button>

              <button
                onClick={() => onSelectReportsSubTab && onSelectReportsSubTab('ledger')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  reportsSubTab === 'ledger'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3 h-3 text-slate-500" />
                <span className={`${reportsSubTab === 'ledger' ? 'text-white' : 'text-slate-500'}`}>General Ledger</span>
              </button>

              <button
                id="nav-reports-owner-pool"
                onClick={() => onSelectReportsSubTab && onSelectReportsSubTab('owner-pool')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  reportsSubTab === 'owner-pool'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <PieChart className="w-3 h-3 text-slate-500" />
                <span className={`${reportsSubTab === 'owner-pool' ? 'text-white' : 'text-slate-500'}`}>Owner Pool &amp; Return</span>
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:block mt-1">
              USALI 12 Financial Reporting &amp; Owner Yield Analysis
            </span>
          </div>
        </div>
      )}

      {activePillar === 'accounting-core' && (
        <div className="px-3 lg:px-6 py-1.5 bg-white border-t border-slate-200 overflow-x-auto">
          <div className="max-w-full mx-auto min-w-0">
            <div className="flex flex-wrap items-start justify-start text-xs gap-1.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Accounting Core:
              </span>
              <button
                onClick={() => onSelectAccountingCoreSubTab && onSelectAccountingCoreSubTab('workbench')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  accountingCoreSubTab === 'workbench'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span className={`${accountingCoreSubTab === 'workbench' ? 'text-white' : 'text-slate-500'}`}>Journal Workbench</span>
                {pendingJournalsCount > 0 && (
                  <span className="ml-1 px-1 py-0.2 rounded-full text-[9px] bg-slate-900/10 text-amber-700 border-amber-200 font-bold">
                    {pendingJournalsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectAccountingCoreSubTab && onSelectAccountingCoreSubTab('ledger')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  accountingCoreSubTab === 'ledger'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                <span className={`${accountingCoreSubTab === 'ledger' ? 'text-white' : 'text-slate-500'}`}>General Ledger</span>
              </button>

              <button
                onClick={() => onSelectAccountingCoreSubTab && onSelectAccountingCoreSubTab('trial-balance')}
                className={`flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap border border-slate-200 ${
                  accountingCoreSubTab === 'trial-balance'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Scale className="w-3 h-3 text-slate-500" />
                <span className={`${accountingCoreSubTab === 'trial-balance' ? 'text-white' : 'text-slate-500'}`}>Trial Balance</span>
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500 hidden sm:block mt-1">
              Rule 31 &amp; 32 Enforced: Balanced Proof
            </span>
          </div>
        </div>
      )}
    </header>
  );
};