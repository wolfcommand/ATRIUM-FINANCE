import React from 'react';
import { RotateCw, Calendar, Building2, Printer, Eye } from 'lucide-react';
import { ReportExportButtons } from './ReportExportButtons';
import type { ReportExportFormat } from '../../utils/reportExport';

interface UniversalReportToolbarProps {
  reportTitle: string;
  reportSubtitle?: string;
  period: string;
  onPeriodChange: (period: string) => void;
  property?: string;
  onPropertyChange?: (property: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportExcel: (format?: ReportExportFormat) => void;
  onPrint?: () => void;
  previewMode?: boolean;
  onTogglePreview?: () => void;
  loading?: boolean;
  extraControls?: React.ReactNode;
}

export const UniversalReportToolbar: React.FC<UniversalReportToolbarProps> = ({
  reportTitle, reportSubtitle, period, onPeriodChange,
  property = 'PT Atrium Management Group', onPropertyChange, onRefresh,
  onExportExcel, onPrint, previewMode = false, onTogglePreview,
  loading = false, extraControls,
}) => (
  <div className="bg-white/80 border border-slate-200 rounded-xl p-4 shadow-xs backdrop-blur-sm print:hidden">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{reportTitle}</h2>
        {reportSubtitle && <p className="text-xs text-slate-500 mt-0.5">{reportSubtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 border border-slate-200 text-xs">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <select aria-label="Property" value={property} onChange={e => onPropertyChange?.(e.target.value)} className="bg-white text-slate-700 outline-none font-medium">
            <option>PT Atrium Management Group</option>
            <option>Atrium Suites Lombok</option>
            <option value="GGV Properties">GGV (Multi-Property)</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 border border-slate-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <input aria-label="Accounting period" type="month" value={period} onChange={e => onPeriodChange(e.target.value)} className="bg-transparent text-slate-700 font-mono outline-none" />
          {period && <button onClick={() => onPeriodChange('')} className="text-slate-500 hover:text-slate-700">All</button>}
        </div>
        {extraControls}
        <button onClick={onRefresh} disabled={loading} title="Refresh report" className="p-2 rounded-lg bg-white text-slate-700 disabled:opacity-50">
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <ReportExportButtons onExport={onExportExcel} disabled={loading} />
        {onTogglePreview && <button onClick={onTogglePreview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-700 hover:bg-white">
          <Eye className="w-3.5 h-3.5" />{previewMode ? 'Screen View' : 'Print Preview'}
        </button>}
        <button onClick={() => onPrint ? onPrint() : window.dispatchEvent(new CustomEvent('atrium-open-print-preview'))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-700 hover:bg-white">
          <Printer className="w-3.5 h-3.5" />Print
        </button>
      </div>
    </div>
  </div>
);
