// Compatibility entry point for existing report data adapters.
export { exportReport as exportReportToExcel, withTotal } from './reportExport';
export type { ReportSheet as ExcelSheetData, ReportExportFormat } from './reportExport';
import { exportReport, type ReportExportFormat, type ReportSheet } from './reportExport';

export const createReportExporter = (format: ReportExportFormat) =>
  (filename: string, sheets: ReportSheet[]) => exportReport(filename, sheets, format);
