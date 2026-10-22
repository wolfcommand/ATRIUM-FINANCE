/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ReportFormattingSettings,
  ReportTableDensity,
  ReportVisualTheme,
  DEFAULT_MASTER_REPORT_CONFIG,
} from '../types';

/**
 * Formats a numeric amount based on the configured report formatting settings
 */
export function formatAmount(
  rawAmount: number,
  formatting: ReportFormattingSettings = DEFAULT_MASTER_REPORT_CONFIG.formatting
): string {
  if (rawAmount === 0 || isNaN(rawAmount)) {
    if (formatting.zero_format === 'dash') return '—';
    if (formatting.zero_format === 'blank') return '';
    // 'zero' format
    const prefix = formatting.currency_position === 'prefix' ? `${formatting.currency_symbol} ` : '';
    const suffix = formatting.currency_position === 'suffix' ? ` ${formatting.currency_symbol}` : '';
    const formattedZero = (0).toFixed(formatting.decimal_places);
    return `${prefix}${formattedZero}${suffix}`;
  }

  // 1. Scale
  let scaled = rawAmount;
  let scaleSuffix = '';
  if (formatting.number_scale === 'thousands') {
    scaled = rawAmount / 1000;
    scaleSuffix = ' k';
  } else if (formatting.number_scale === 'millions') {
    scaled = rawAmount / 1000000;
    scaleSuffix = ' M';
  }

  const isNegative = scaled < 0;
  const absValue = Math.abs(scaled);

  // Format with commas and decimal places
  const parts = absValue.toFixed(formatting.decimal_places).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedAbs = parts.join('.') + scaleSuffix;

  const symbol = formatting.currency_symbol;
  let res = '';

  if (formatting.currency_position === 'prefix') {
    if (isNegative) {
      if (formatting.negative_format === 'parentheses' || formatting.negative_format === 'red') {
        res = `(${symbol} ${formattedAbs})`;
      } else {
        res = `-${symbol} ${formattedAbs}`;
      }
    } else {
      res = `${symbol} ${formattedAbs}`;
    }
  } else {
    // suffix
    if (isNegative) {
      if (formatting.negative_format === 'parentheses' || formatting.negative_format === 'red') {
        res = `(${formattedAbs} ${symbol})`;
      } else {
        res = `-${formattedAbs} ${symbol}`;
      }
    } else {
      res = `${formattedAbs} ${symbol}`;
    }
  }

  return res;
}

/**
 * Returns Tailwind classes based on table density
 */
export function getDensityClasses(density: ReportTableDensity = 'standard') {
  switch (density) {
    case 'compact':
      return {
        th: 'py-1.5 px-3 text-[11px]',
        td: 'py-1 px-3 text-xs',
        sectionHeader: 'py-1.5 px-3 text-xs font-semibold tracking-wider',
        subtotal: 'py-2 px-3 text-xs font-bold',
        total: 'py-2 px-3 text-xs font-bold',
      };
    case 'spacious':
      return {
        th: 'py-3.5 px-5 text-xs',
        td: 'py-3.5 px-5 text-sm',
        sectionHeader: 'py-3 px-5 text-sm font-semibold tracking-wider',
        subtotal: 'py-4 px-5 text-sm font-bold',
        total: 'py-4 px-5 text-base font-bold',
      };
    case 'standard':
    default:
      return {
        th: 'py-2.5 px-4 text-xs',
        td: 'py-2.5 px-4 text-xs',
        sectionHeader: 'py-2 px-4 text-xs font-semibold tracking-wider',
        subtotal: 'py-3 px-4 text-xs font-bold',
        total: 'py-3.5 px-4 text-sm font-bold',
      };
  }
}

/**
 * Returns Tailwind visual theme classes
 */
export function getThemeClasses(theme: ReportVisualTheme = 'slate') {
  switch (theme) {
    case 'classic':
      return {
        cardBg: 'bg-amber-950/20 border-amber-900/40 text-amber-100',
        tableBg: 'bg-amber-950/30',
        thBg: 'bg-amber-950/50 text-amber-200 border-amber-900/50',
        rowHover: 'hover:bg-amber-900/20',
        sectionRevenue: 'bg-amber-950/60 text-amber-300 border-l-2 border-amber-500',
        sectionExpense: 'bg-amber-950/60 text-orange-300 border-l-2 border-orange-500',
        sectionGeneric: 'bg-amber-950/60 text-amber-200 border-l-2 border-amber-600',
        subtotalBg: 'bg-amber-950/40 text-amber-200 border-t border-amber-800/60',
        totalBg: 'bg-amber-900/30 text-amber-100 border-t-2 border-amber-700',
        textHighlight: 'text-amber-400',
      };
    case 'emerald':
      return {
        cardBg: 'bg-emerald-950/20 border-emerald-900/40 text-slate-100',
        tableBg: 'bg-slate-900/70',
        thBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50',
        rowHover: 'hover:bg-emerald-900/20',
        sectionRevenue: 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-400',
        sectionExpense: 'bg-emerald-950/60 text-rose-300 border-l-2 border-rose-400',
        sectionGeneric: 'bg-emerald-950/60 text-teal-300 border-l-2 border-teal-400',
        subtotalBg: 'bg-emerald-950/40 text-slate-100 border-t border-emerald-800/60',
        totalBg: 'bg-emerald-900/30 text-emerald-200 border-t-2 border-emerald-600',
        textHighlight: 'text-emerald-400',
      };
    case 'contrast':
      return {
        cardBg: 'bg-black border-slate-700 text-white',
        tableBg: 'bg-black',
        thBg: 'bg-slate-900 text-slate-200 border-slate-700',
        rowHover: 'hover:bg-slate-900',
        sectionRevenue: 'bg-slate-900 text-white font-bold border-l-2 border-white',
        sectionExpense: 'bg-slate-900 text-white font-bold border-l-2 border-white',
        sectionGeneric: 'bg-slate-900 text-white font-bold border-l-2 border-white',
        subtotalBg: 'bg-slate-900 text-white border-t border-slate-600 font-bold',
        totalBg: 'bg-slate-900 text-white border-t-2 border-white font-bold',
        textHighlight: 'text-white font-bold underline',
      };
    case 'slate':
    default:
      return {
        cardBg: 'bg-slate-900/70 border-slate-800 text-slate-100',
        tableBg: 'bg-slate-900/40',
        thBg: 'bg-slate-950/60 text-slate-300 border-slate-800',
        rowHover: 'hover:bg-slate-800/50',
        sectionRevenue: 'bg-slate-950/50 text-emerald-400 border-l-2 border-emerald-500',
        sectionExpense: 'bg-slate-950/50 text-rose-400 border-l-2 border-rose-500',
        sectionGeneric: 'bg-slate-950/50 text-sky-400 border-l-2 border-sky-500',
        subtotalBg: 'bg-slate-950/60 text-slate-100 border-t border-slate-800',
        totalBg: 'bg-slate-900 text-slate-100 border-t-2 border-slate-700',
        textHighlight: 'text-emerald-400',
      };
  }
}
