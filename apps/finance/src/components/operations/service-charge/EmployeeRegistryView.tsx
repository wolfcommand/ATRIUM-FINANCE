/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  Calendar,
  CreditCard,
  Edit2,
  Trash2,
  Info,
  Award,
} from 'lucide-react';
import { StaffEmployee, Department, StaffGradeLevel, EmploymentStatus } from '../../../types';
import { api } from '../../../services/api';
import { ReportExportButtons } from '../../reports/ReportExportButtons';
import { exportReport } from '../../../utils/reportExport';

interface EmployeeRegistryViewProps {
  employees: StaffEmployee[];
  departments: Department[];
  onRefresh: () => void;
}

export const EmployeeRegistryView: React.FC<EmployeeRegistryViewProps> = ({
  employees,
  departments,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<StaffEmployee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    employee_name: string;
    department_code: string;
    job_title: string;
    grade_level: StaffGradeLevel;
    base_points: number;
    hire_date: string;
    employment_status: EmploymentStatus;
    bank_account_number: string;
    bank_name: string;
    is_eligible: boolean;
    active: 'Y' | 'N';
    notes: string;
  }>({
    employee_name: '',
    department_code: '100',
    job_title: '',
    grade_level: 'Grade 2',
    base_points: 1.2,
    hire_date: new Date().toISOString().substring(0, 10),
    employment_status: 'Permanent',
    bank_account_number: '',
    bank_name: 'Bank Central Asia (BCA)',
    is_eligible: true,
    active: 'Y',
    notes: '',
  });

  const gradePointsMap: Record<StaffGradeLevel, number> = {
    'Grade 1': 1.0,
    'Grade 2': 1.2,
    'Grade 3': 1.5,
    'Grade 4': 1.8,
    'Grade 5': 2.2,
  };

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setFormData({
      employee_name: '',
      department_code: departments[0]?.department_code || '100',
      job_title: '',
      grade_level: 'Grade 2',
      base_points: 1.2,
      hire_date: new Date().toISOString().substring(0, 10),
      employment_status: 'Permanent',
      bank_account_number: '',
      bank_name: 'Bank Central Asia (BCA)',
      is_eligible: true,
      active: 'Y',
      notes: '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: StaffEmployee) => {
    setEditingEmp(emp);
    setFormData({
      employee_name: emp.employee_name,
      department_code: emp.department_code,
      job_title: emp.job_title,
      grade_level: emp.grade_level,
      base_points: emp.base_points,
      hire_date: emp.hire_date,
      employment_status: emp.employment_status,
      bank_account_number: emp.bank_account_number,
      bank_name: emp.bank_name,
      is_eligible: emp.is_eligible,
      active: emp.active,
      notes: emp.notes || '',
    });
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleGradeChange = (grade: StaffGradeLevel) => {
    setFormData((prev) => ({
      ...prev,
      grade_level: grade,
      base_points: gradePointsMap[grade] || 1.0,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_name.trim()) {
      setErrorMsg('Employee name is required');
      return;
    }
    if (!formData.job_title.trim()) {
      setErrorMsg('Job title is required');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await api.saveServiceChargeEmployee({
        ...(editingEmp ? { employee_id: editingEmp.employee_id } : {}),
        ...formData,
      });
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save staff record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (window.confirm(`Deactivate employee "${name}" from future service charge distribution pools?`)) {
      try {
        await api.deleteServiceChargeEmployee(id);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  // Filtered employees
  const filtered = employees.filter((emp) => {
    const matchesSearch =
      emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || emp.department_code === selectedDept;
    const matchesGrade = selectedGrade === 'ALL' || emp.grade_level === selectedGrade;
    return matchesSearch && matchesDept && matchesGrade;
  });

  const getDeptName = (code: string) => {
    const d = departments.find((dept) => dept.department_code === code);
    return d ? d.department_name : `Dept ${code}`;
  };

  const calculateSeniority = (hireDate: string) => {
    const diffMs = Date.now() - new Date(hireDate).getTime();
    const yrs = Math.max(0, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000)));
    return yrs;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Grade Matrix Explainer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Hospitality Grade Points &amp; Seniority System
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            In standard Southeast Asian and global luxury hotel covenants, the 10% Service Charge Trust Liability is distributed proportionally to operational staff. Points reflect operational tier, scaled by attendance days and a +5%/year seniority longevity multiplier. General Manager and Executive Committee are legally excluded.
          </p>
          <div className="grid grid-cols-5 gap-2 pt-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-white/60 border border-slate-200 text-center">
              <span className="text-slate-500 block font-bold">Grade 1</span>
              <span className="text-emerald-700 font-bold text-xs">1.0 pt</span>
              <span className="text-[10px] text-slate-500 block truncate">Steward/Linen</span>
            </div>
            <div className="p-2 rounded bg-white/60 border border-slate-200 text-center">
              <span className="text-slate-500 block font-bold">Grade 2</span>
              <span className="text-emerald-700 font-bold text-xs">1.2 pts</span>
              <span className="text-[10px] text-slate-500 block truncate">Waiter/Attendant</span>
            </div>
            <div className="p-2 rounded bg-white/60 border border-slate-200 text-center">
              <span className="text-slate-500 block font-bold">Grade 3</span>
              <span className="text-emerald-700 font-bold text-xs">1.5 pts</span>
              <span className="text-[10px] text-slate-500 block truncate">GSA/Therapist</span>
            </div>
            <div className="p-2 rounded bg-white/60 border border-slate-200 text-center">
              <span className="text-slate-500 block font-bold">Grade 4</span>
              <span className="text-emerald-700 font-bold text-xs">1.8 pts</span>
              <span className="text-[10px] text-slate-500 block truncate">Supervisor/CDP</span>
            </div>
            <div className="p-2 rounded bg-white/60 border border-slate-200 text-center">
              <span className="text-slate-500 block font-bold">Grade 5</span>
              <span className="text-emerald-700 font-bold text-xs">2.2 pts</span>
              <span className="text-[10px] text-slate-500 block truncate">Duty Mgr/Sous Chef</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
              Registered Operational Staff
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-mono">
                {employees.filter((e) => e.active === 'Y').length}
              </span>
              <span className="text-xs text-emerald-700 font-semibold">Active Participants</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Total weighted base points:{' '}
              <strong className="text-slate-700">
                {employees
                  .filter((e) => e.active === 'Y')
                  .reduce((sum, e) => sum + e.base_points, 0)
                  .toFixed(1)}{' '}
                pts
              </strong>
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, title, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <ReportExportButtons
            onExport={format => exportReport('Service_Charge_Staff_Registry', [{
              name: 'Staff Registry',
              title: 'STAFF SERVICE CHARGE ELIGIBILITY & GRADE POINT REGISTRY',
              subtitle: `${filtered.length} of ${employees.length} staff | Dept: ${selectedDept} | Grade: ${selectedGrade}`,
              headers: ['Employee ID', 'Employee Name', 'Department', 'Job Title', 'Grade', 'Base Points', 'Hire Date', 'Employment Status', 'SC Eligible', 'Bank', 'Bank Account', 'Status'],
              rows: filtered.map(e => [e.employee_id, e.employee_name, getDeptName(e.department_code), e.job_title, e.grade_level, e.base_points, e.hire_date, e.employment_status, e.is_eligible ? 'Yes' : 'No', e.bank_name, e.bank_account_number, e.active === 'Y' ? 'Active' : 'Inactive']),
              colWidths: [14, 26, 22, 22, 12, 11, 14, 16, 12, 20, 20, 12],
            }], format)}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.department_code} value={d.department_code}>
                  {d.department_code} - {d.department_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Grade:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Grades</option>
              <option value="Grade 1">Grade 1 (1.0 pt)</option>
              <option value="Grade 2">Grade 2 (1.2 pts)</option>
              <option value="Grade 3">Grade 3 (1.5 pts)</option>
              <option value="Grade 4">Grade 4 (1.8 pts)</option>
              <option value="Grade 5">Grade 5 (2.2 pts)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/80 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee ID &amp; Name</th>
                <th className="py-3 px-4">Department &amp; Title</th>
                <th className="py-3 px-4">Grade Level</th>
                <th className="py-3 px-4">Base Pts</th>
                <th className="py-3 px-4">Tenure (Seniority)</th>
                <th className="py-3 px-4">Bank Disbursement</th>
                <th className="py-3 px-4">Pool Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No employees matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const seniorityYears = calculateSeniority(emp.hire_date);
                  const bonusPct = Math.min(25, seniorityYears * 5);
                  return (
                    <tr key={emp.employee_id} className="hover:bg-white/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-sans font-bold text-slate-900">{emp.employee_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{emp.employee_id}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="text-slate-700 font-medium">{emp.job_title}</div>
                        <div className="text-[11px] text-slate-500">
                          {emp.department_code} - {getDeptName(emp.department_code)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                          {emp.grade_level}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-emerald-700 text-sm">
                          {emp.base_points.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">
                          {seniorityYears} {seniorityYears === 1 ? 'yr' : 'yrs'}
                        </div>
                        <div className="text-[10px] text-emerald-700">+{bonusPct}% bonus</div>
                      </td>
                      <td className="py-3 px-4 font-sans text-[11px]">
                        <div className="text-slate-700 font-mono">{emp.bank_account_number}</div>
                        <div className="text-slate-500 text-[10px]">{emp.bank_name}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        {emp.active === 'Y' && emp.is_eligible ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-white transition-colors"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {emp.active === 'Y' && (
                            <button
                              onClick={() => handleDeactivate(emp.employee_id, emp.employee_name)}
                              className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-white transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs max-w-lg w-full overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-850">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingEmp ? 'Edit Operational Employee' : 'Register New Staff Member'}
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

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wayan Darmayasa"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Department *</label>
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
                  <label className="block text-slate-700 font-semibold mb-1">Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Duty Manager"
                    value={formData.job_title}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Grade Level *</label>
                  <select
                    value={formData.grade_level}
                    onChange={(e) => handleGradeChange(e.target.value as StaffGradeLevel)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Grade 1">Grade 1 (1.0 pt)</option>
                    <option value="Grade 2">Grade 2 (1.2 pts)</option>
                    <option value="Grade 3">Grade 3 (1.5 pts)</option>
                    <option value="Grade 4">Grade 4 (1.8 pts)</option>
                    <option value="Grade 5">Grade 5 (2.2 pts)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Base Points (Weight)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={formData.base_points}
                    onChange={(e) => setFormData({ ...formData, base_points: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date of Hire (Seniority) *</label>
                  <input
                    type="date"
                    required
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employment Status</label>
                  <select
                    value={formData.employment_status}
                    onChange={(e) => setFormData({ ...formData, employment_status: e.target.value as EmploymentStatus })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Permanent">Permanent</option>
                    <option value="Contract">Contract</option>
                    <option value="Probation">Probation</option>
                    <option value="Casual">Casual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. BCA Bali"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 883-10291"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_eligible}
                    onChange={(e) => setFormData({ ...formData, is_eligible: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Eligible for Service Charge Pool (Non-ExCom)</span>
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
                  {isSaving ? 'Saving...' : editingEmp ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
