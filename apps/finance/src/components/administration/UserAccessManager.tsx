/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Shield,
  Key,
  Eye,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  Building,
  Mail,
  Lock,
  Layers,
  FileSpreadsheet,
  Download,
  Info,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  SystemUser,
  UserRoleDefinition,
  PrimaryNavPillar,
  Department,
  AccessAction,
} from '../../types';

interface UserAccessManagerProps {
  users: SystemUser[];
  roles: UserRoleDefinition[];
  currentUserId: string;
  departments: Department[];
  onSwitchUser: (userId: string) => Promise<void>;
  onSaveUser: (userData: Partial<SystemUser> & { name: string; email: string; roleId: string }) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onSaveRole: (roleData: UserRoleDefinition) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
  onResetDefaults: () => Promise<void>;
}

const PILLAR_METADATA: Record<
  PrimaryNavPillar,
  { label: string; number: string; description: string }
> = {
  'command-centre': {
    label: 'Command Centre',
    number: '1',
    description: 'Executive dashboard, KPI cards, operating cash balances, and financial health charts',
  },
  'operations': {
    label: 'Operations',
    number: '2',
    description: 'Revenue batch entry, Night Audit ingestion, and procurement/payroll disbursements',
  },
  'accounting-core': {
    label: 'Accounting Core',
    number: '3',
    description: 'Double-entry workbench, journal draft review, General Ledger, and Trial Balance',
  },
  'reports': {
    label: 'Reports Hub',
    number: '4',
    description: 'USALI 12 P&L, Balance Sheet, Income Statement, and financial statement exports',
  },
  'tax': {
    label: 'Tax Module',
    number: '5',
    description: 'Hospitality tax obligations (PBJT, PPh 21, PPh 23, PPN, Owner Tax), filing, and reconciliation',
  },
  'configuration': {
    label: 'Configuration',
    number: '6',
    description: 'Chart of Accounts, Departmental cost centers, and report formatting designs',
  },
  'controls-audit': {
    label: 'Controls & Audit',
    number: '7',
    description: 'Continuous anomaly scans, automated journal exception logs, and audit trails',
  },
  'integrations': {
    label: 'Integrations',
    number: '8',
    description: 'Google Sheets synchronization, PMS night audit connectors, and data imports',
  },
  'administration': {
    label: 'Administration',
    number: '9',
    description: 'Accounting period lock date, hotel master profile, user access, and RBAC permissions',
  },
};

const ACTION_METADATA: { key: keyof UserRoleDefinition['permissions'][PrimaryNavPillar]; label: string; description: string }[] = [
  { key: 'canView', label: 'View / Read', description: 'Can open and view this module' },
  { key: 'canCreate', label: 'Create', description: 'Can add new records or draft transactions' },
  { key: 'canEdit', label: 'Edit / Modify', description: 'Can modify unposted records or configuration' },
  { key: 'canApprove', label: 'Post / Approve', description: 'Can approve journals, post to GL, and execute closures' },
  { key: 'canDelete', label: 'Delete / Void', description: 'Can delete drafts or discard unposted items' },
  { key: 'canExport', label: 'Export / Print', description: 'Can download CSV, PDF, and audit extracts' },
];

export const UserAccessManager: React.FC<UserAccessManagerProps> = ({
  users = [],
  roles = [],
  currentUserId,
  departments = [],
  onSwitchUser,
  onSaveUser,
  onDeleteUser,
  onSaveRole,
  onDeleteRole,
  onResetDefaults,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'roles' | 'matrix' | 'simulator'>('users');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'role-financial-controller');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editingRole, setEditingRole] = useState<UserRoleDefinition | null>(null);

  // Form states
  const [userForm, setUserForm] = useState<{
    id?: string;
    name: string;
    email: string;
    roleId: string;
    departmentCode: string;
    status: 'active' | 'suspended';
  }>({
    name: '',
    email: '',
    roleId: roles[0]?.id || '',
    departmentCode: '',
    status: 'active',
  });

  const [roleForm, setRoleForm] = useState<UserRoleDefinition>({
    id: '',
    name: '',
    description: '',
    isSystemRole: false,
    permissions: Object.keys(PILLAR_METADATA).reduce((acc, key) => {
      acc[key as PrimaryNavPillar] = {
        canView: true,
        canCreate: false,
        canEdit: false,
        canApprove: false,
        canDelete: false,
        canExport: true,
      };
      return acc;
    }, {} as UserRoleDefinition['permissions']),
  });

  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = users?.find((u) => u.id === currentUserId) || users?.[0];
  const activeRole = roles?.find((r) => r.id === selectedRoleId) || roles?.[0];

  // Open modal to add or edit user
  const handleOpenUserModal = (user?: SystemUser) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        password: user.password || '',
        departmentCode: user.departmentCode || '',
        status: user.status === 'suspended' ? 'suspended' : 'active',
      });
    } else {
      setEditingUser(null);
      setUserForm({
        name: '',
        email: '',
        roleId: roles[0]?.id || '',
        password: 'AtriumUser2026!',
        departmentCode: '',
        status: 'active',
      });
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.roleId) {
      setFeedbackMessage({ type: 'error', text: 'Name, email, and role assignment are required.' });
      return;
    }
    try {
      setSaving(true);
      setFeedbackMessage(null);
      await onSaveUser(userForm);
      setIsUserModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `User profile for "${userForm.name}" successfully updated.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save user' });
    } finally {
      setSaving(false);
    }
  };

  // Open modal to add or edit role
  const handleOpenRoleModal = (role?: UserRoleDefinition) => {
    if (role) {
      setEditingRole(role);
      setRoleForm(JSON.parse(JSON.stringify(role)));
    } else {
      setEditingRole(null);
      setRoleForm({
        id: '',
        name: '',
        description: '',
        isSystemRole: false,
        permissions: Object.keys(PILLAR_METADATA).reduce((acc, key) => {
          acc[key as PrimaryNavPillar] = {
            canView: true,
            canCreate: false,
            canEdit: false,
            canApprove: false,
            canDelete: false,
            canExport: true,
          };
          return acc;
        }, {} as UserRoleDefinition['permissions']),
      });
    }
    setIsRoleModalOpen(true);
  };

  const handleSaveRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Role name is required.' });
      return;
    }
    try {
      setSaving(true);
      setFeedbackMessage(null);
      await onSaveRole(roleForm);
      setIsRoleModalOpen(false);
      setSelectedRoleId(roleForm.id || selectedRoleId);
      setFeedbackMessage({
        type: 'success',
        text: `Role permissions for "${roleForm.name}" updated successfully.`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save role' });
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

  const handleDeleteUserClick = async (userId: string, userName: string) => {
    if (!safeConfirm(`Are you sure you want to remove user access for "${userName}"?`)) {
      return;
    }
    try {
      setSaving(true);
      await onDeleteUser(userId);
      setFeedbackMessage({ type: 'success', text: `User "${userName}" access removed.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete user' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoleClick = async (roleId: string, roleName: string) => {
    if (!safeConfirm(`Are you sure you want to delete custom role "${roleName}"?`)) {
      return;
    }
    try {
      setSaving(true);
      await onDeleteRole(roleId);
      setSelectedRoleId(roles[0]?.id || '');
      setFeedbackMessage({ type: 'success', text: `Role "${roleName}" deleted.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete role' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRolePermission = async (
    roleId: string,
    pillar: PrimaryNavPillar,
    actionKey: keyof UserRoleDefinition['permissions'][PrimaryNavPillar]
  ) => {
    const role = (roles || []).find((r) => r.id === roleId);
    if (!role) return;

    const updatedRole: UserRoleDefinition = JSON.parse(JSON.stringify(role));
    const currentVal = Boolean(updatedRole.permissions[pillar]?.[actionKey]);
    
    if (!updatedRole.permissions[pillar]) {
      updatedRole.permissions[pillar] = {
        canView: false,
        canCreate: false,
        canEdit: false,
        canApprove: false,
        canDelete: false,
        canExport: false,
      };
    }

    updatedRole.permissions[pillar][actionKey] = !currentVal;

    // If enabling create/edit/approve/delete, automatically enable canView
    if (actionKey !== 'canView' && !currentVal) {
      updatedRole.permissions[pillar].canView = true;
    }
    // If disabling canView, disable child actions
    if (actionKey === 'canView' && currentVal) {
      updatedRole.permissions[pillar].canCreate = false;
      updatedRole.permissions[pillar].canEdit = false;
      updatedRole.permissions[pillar].canApprove = false;
      updatedRole.permissions[pillar].canDelete = false;
    }

    try {
      await onSaveRole(updatedRole);
      setFeedbackMessage({
        type: 'success',
        text: `Updated "${role.name}" [${PILLAR_METADATA[pillar].label} → ${actionKey}].`,
      });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update permission' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">
                User Access & Permissions Governance (RBAC)
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900/10/80 border border-emerald-800/60 text-emerald-700">
                SEGREGATION OF DUTIES
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage system users, assign hotel roles, and customize granular permissions across all 8 operational and financial pillars.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-mono border border-slate-200 transition-colors"
              title="Reset hotel users and roles to standard hotel operating defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={() => handleOpenUserModal()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 pt-4 mt-4 border-t border-slate-200/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSubTab('users')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === 'users'
                ? 'bg-slate-900/10/70 text-emerald-700 border border-emerald-800/60 font-semibold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Hotel Users Directory ({(users || []).length})</span>
          </button>

          <button
            onClick={() => setSubTab('roles')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === 'roles'
                ? 'bg-slate-900/10/70 text-emerald-700 border border-emerald-800/60 font-semibold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles & Privilege Profiles ({(roles || []).length})</span>
          </button>

          <button
            onClick={() => setSubTab('matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === 'matrix'
                ? 'bg-slate-900/10/70 text-emerald-700 border border-emerald-800/60 font-semibold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Full Permission Matrix</span>
          </button>

          <button
            onClick={() => setSubTab('simulator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              subTab === 'simulator'
                ? 'bg-slate-900/10/70 text-emerald-700 border border-emerald-800/60 font-semibold'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Active Session Simulator</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedbackMessage.type === 'success'
              ? 'bg-slate-900/10/50 border-emerald-800/70 text-emerald-200'
              : 'bg-red-600/10/50 border-rose-800/70 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-[11px] font-mono hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. USERS DIRECTORY VIEW */}
      {subTab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Hotel Staff & User Accounts</h4>
              <p className="text-xs text-slate-500">
                Staff authorized to operate, review, or audit Atrium Finance
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Active Session: <span className="text-emerald-700 font-semibold">{currentUser?.name}</span> ({currentUser?.email})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-500 font-medium border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">User / Contact</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Cost Center Dept</th>
                  <th className="py-3 px-4">Password / Key</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {(users || []).map((user) => {
                  const role = (roles || []).find((r) => r.id === user.roleId);
                  const isCurrent = user.id === currentUserId;
                  const dept = (departments || []).find((d) => d.department_code === user.departmentCode);

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-white/40 transition-colors ${
                        isCurrent ? 'bg-slate-900/10/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isCurrent
                                ? 'bg-slate-900 text-white ring-2 ring-emerald-500/50'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{user.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900/10 border border-emerald-800 text-emerald-700 font-bold">
                                  CURRENT USER
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-700 block">
                            {role?.name || 'Unassigned'}
                          </span>
                          <span className="text-[10px] text-slate-500 block max-w-xs truncate">
                            {role?.description}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        {dept ? (
                          <span className="text-slate-700">
                            {dept.department_code} - {dept.department_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Global / All Departments</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          {user.password || '••••••••'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            user.status === 'active'
                              ? 'bg-slate-900/10/80 text-emerald-700 border border-emerald-800/50'
                              : 'bg-red-600/10/80 text-rose-300 border border-rose-800/50'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {user.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {user.lastLogin || 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCurrent && (
                            <button
                              onClick={() => onSwitchUser(user.id)}
                              className="px-2.5 py-1 rounded bg-white hover:bg-slate-200 text-emerald-700 hover:text-emerald-700 text-[11px] font-mono border border-slate-200 transition-colors"
                              title={`Switch active persona to ${user.name}`}
                            >
                              Login As
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenUserModal(user)}
                            className="p-1.5 rounded hover:bg-white text-slate-500 hover:text-slate-700 transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteUserClick(user.id, user.name)}
                              className="p-1.5 rounded hover:bg-red-600/10/50 text-slate-500 hover:text-red-600 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ROLES & PRIVILEGE PROFILES */}
      {subTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                System & Custom Roles
              </h4>
              <button
                onClick={() => handleOpenRoleModal()}
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Role</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {(roles || []).map((role) => {
                const isSelected = role.id === selectedRoleId;
                const assignedCount = (users || []).filter((u) => u.roleId === role.id).length;

                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-white/90 border-emerald-500/60 shadow-xs'
                        : 'bg-white/40 border-slate-200/60 hover:bg-white/40 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{role.name}</span>
                      {role.isSystemRole ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-slate-500 border border-slate-200">
                          SYSTEM
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900/10/80 text-amber-300 border border-amber-800/60">
                          CUSTOM
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                      {role.description}
                    </p>
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono">
                      <span>Assigned: {assignedCount} user(s)</span>
                      {isSelected && <span className="text-emerald-700 font-bold">Active View →</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Detail & Permission Customizer */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900">{activeRole.name}</h4>
                  {activeRole.isSystemRole && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/10 text-emerald-700 border border-emerald-800">
                      Standard Hotel Role
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{activeRole.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenRoleModal(activeRole)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Role Info</span>
                </button>
                {!activeRole.isSystemRole && (
                  <button
                    onClick={() => handleDeleteRoleClick(activeRole.id, activeRole.name)}
                    className="p-1.5 rounded-lg bg-red-600/10/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-colors"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Pillar Permissions Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Module Access Rules (Click checks to toggle directly)
                </span>
                <span className="text-[11px] text-slate-500">
                  Real-time synchronization across Atrium Finance
                </span>
              </div>

              <div className="space-y-3">
                {(Object.keys(PILLAR_METADATA) as PrimaryNavPillar[]).map((pillarKey) => {
                  const meta = PILLAR_METADATA[pillarKey];
                  const perms = activeRole.permissions[pillarKey] || {
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canApprove: false,
                    canDelete: false,
                    canExport: false,
                  };

                  return (
                    <div
                      key={pillarKey}
                      className="p-3.5 rounded-lg bg-white border border-slate-200/90 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-white text-emerald-700 font-mono text-xs flex items-center justify-center font-bold">
                            {meta.number}
                          </span>
                          <div>
                            <span className="font-semibold text-slate-900 text-xs">{meta.label}</span>
                            <span className="text-[11px] text-slate-500 block hidden sm:inline sm:ml-2">
                              {meta.description}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            perms.canView
                              ? 'bg-slate-900/10/80 text-emerald-700 border border-emerald-800/40'
                              : 'bg-red-600/10/80 text-rose-300 border border-rose-800/40'
                          }`}
                        >
                          {perms.canView ? 'MODULE ACCESSIBLE' : 'ACCESS RESTRICTED'}
                        </span>
                      </div>

                      {/* Action Checkboxes */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                        {ACTION_METADATA.map((action) => {
                          const isEnabled = Boolean(perms[action.key]);

                          return (
                            <button
                              key={action.key}
                              type="button"
                              onClick={() =>
                                handleToggleRolePermission(activeRole.id, pillarKey, action.key)
                              }
                              className={`flex items-center justify-between p-2 rounded-md border text-left text-xs transition-colors ${
                                isEnabled
                                  ? 'bg-slate-900/10/40 border-emerald-700/60 text-emerald-200 hover:bg-emerald-900/50'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-850 hover:text-slate-700'
                              }`}
                              title={action.description}
                            >
                              <div className="space-y-0.5 leading-tight">
                                <span className="block font-medium text-[11px]">{action.label}</span>
                              </div>
                              {isEnabled ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FULL PERMISSION MATRIX */}
      {subTab === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-4 p-5">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Hotel Role-Based Entitlements Matrix
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side comparison of capabilities across all hotel management functions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="p-3 border-r border-slate-200">Pillar Module</th>
                  <th className="p-3 border-r border-slate-200">Access Action</th>
                  {roles.map((r) => (
                    <th key={r.id} className="p-3 text-center min-w-[120px]">
                      <span className="block text-slate-700 font-semibold">{r.name}</span>
                      <span className="block text-[9px] text-slate-500 font-mono font-normal">
                        {r.isSystemRole ? 'System' : 'Custom'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-700">
                {(Object.keys(PILLAR_METADATA) as PrimaryNavPillar[]).map((pillarKey) => {
                  const meta = PILLAR_METADATA[pillarKey];

                  return (
                    <React.Fragment key={pillarKey}>
                      {ACTION_METADATA.map((action, actionIdx) => (
                        <tr
                          key={`${pillarKey}-${action.key}`}
                          className={`hover:bg-white/30 ${
                            actionIdx === 0 ? 'border-t-2 border-slate-200' : ''
                          }`}
                        >
                          {actionIdx === 0 && (
                            <td
                              rowSpan={ACTION_METADATA.length}
                              className="p-3 font-semibold text-slate-900 bg-white/60 border-r border-slate-200 align-top"
                            >
                              <div className="flex items-center gap-2 sticky top-0">
                                <span className="w-5 h-5 rounded bg-slate-900/10 border border-emerald-800/60 text-emerald-700 font-mono text-[10px] flex items-center justify-center font-bold">
                                  {meta.number}
                                </span>
                                <div>
                                  <span className="block">{meta.label}</span>
                                  <span className="block text-[10px] text-slate-500 font-normal">
                                    {meta.description}
                                  </span>
                                </div>
                              </div>
                            </td>
                          )}

                          <td className="p-3 font-mono text-[11px] text-slate-700 border-r border-slate-200 bg-white/30">
                            {action.label}
                          </td>

                          {roles.map((role) => {
                            const isAllowed = Boolean(role.permissions[pillarKey]?.[action.key]);

                            return (
                              <td
                                key={`${role.id}-${pillarKey}-${action.key}`}
                                className="p-3 text-center"
                              >
                                {isAllowed ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-900/10/80 border border-emerald-700/60 text-emerald-700">
                                    ✓
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-slate-200 text-slate-500">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ACTIVE SESSION SIMULATOR */}
      {subTab === 'simulator' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-700" />
                <h4 className="text-base font-bold text-slate-900">
                  Role-Based UI Impersonation & Testing Simulator
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate how Atrium Finance behaves when logged in as different hotel staff members.
              </p>
            </div>
            <span className="px-3 py-1 rounded text-xs font-mono font-semibold bg-slate-900/10 text-emerald-700 border border-emerald-800">
              Active Session: {currentUser?.name}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(users || []).map((user) => {
              const isSelected = user.id === currentUserId;
              const role = (roles || []).find((r) => r.id === user.roleId);

              return (
                <div
                  key={user.id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    isSelected
                      ? 'bg-slate-900/10/40 border-emerald-500 shadow-xs ring-1 ring-emerald-500/40'
                      : 'bg-white border-slate-200 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs">{user.name}</h5>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {user.email}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-900/80 text-emerald-700 font-bold border border-emerald-600/40">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1 pt-2 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">Role:</span>
                      <span className="font-semibold text-emerald-700">{role?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-mono text-slate-700">
                        {user.departmentCode || 'All Hotel Departments'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {isSelected ? (
                      <div className="text-center py-1.5 px-3 rounded bg-slate-900/10 border border-emerald-800 text-emerald-700 text-xs font-semibold">
                        Currently Impersonating This Account
                      </div>
                    ) : (
                      <button
                        onClick={() => onSwitchUser(user.id)}
                        className="w-full py-1.5 px-3 rounded bg-white hover:bg-slate-800 text-slate-700 hover:text-white text-xs font-semibold border border-slate-200 hover:border-emerald-500 transition-all"
                      >
                        Switch to {user.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xs animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingUser ? 'Edit User Credentials' : 'Add New Hotel Staff User'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dewi Sartika"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. staff@atriumhotel.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Access Password / PIN *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AtriumPass2026!"
                  value={(userForm as any).password || ''}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value } as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono focus:border-emerald-500 outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Kata sandi yang digunakan staf untuk masuk ke portal sistem keuangan Atrium.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Assigned Role Privilege *</label>
                <select
                  required
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Department Cost Center Restriction</label>
                <select
                  value={userForm.departmentCode}
                  onChange={(e) => setUserForm({ ...userForm, departmentCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                >
                  <option value="">Global (All Hotel Departments)</option>
                  {departments.map((d) => (
                    <option key={d.department_code} value={d.department_code}>
                      {d.department_code} - {d.department_name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Optional: restrict transaction submission to this department only.
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Account Access Status</label>
                <select
                  value={userForm.status}
                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                >
                  <option value="active">Active (Granted Access)</option>
                  <option value="suspended">Suspended (Blocked Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save User Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE MODAL */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xs animate-in fade-in duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white/60">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingRole ? 'Edit Role Details' : 'Create Custom Role'}
                </h3>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Banquet & Event Accountant"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Role Description</label>
                <textarea
                  rows={3}
                  placeholder="Specify operational responsibilities and governance boundaries"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-500 text-[11px]">
                Tip: After saving this role, you can immediately toggle detailed permissions per module in the Roles tab.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
