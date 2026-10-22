import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Table } from 'lucide-react';
import type { ReportExportFormat } from '../../utils/reportExport';

export interface ReportExportButtonsProps {
  onExport: (format: ReportExportFormat) => void | Promise<void>;
  disabled?: boolean;
}

export function ReportExportButtons({ onExport, disabled = false }: ReportExportButtonsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (format: ReportExportFormat) => {
    setBusy(true);
    setError('');
    try {
      await onExport(format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Export report">
      {([
        ['pdf', 'PDF', FileText], ['csv', 'CSV', Table], ['xlsx', 'Excel', FileSpreadsheet],
      ] as const).map(([format, label, Icon]) => (
        <button key={format} type="button" disabled={disabled || busy} onClick={() => run(format)}
          title={`Download ${label} (.${format})`}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <Icon className="h-3.5 w-3.5" />{label}
        </button>
      ))}
      {error && <span role="alert" className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}
