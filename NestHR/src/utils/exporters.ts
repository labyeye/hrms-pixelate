import { Alert, Share } from 'react-native';
import RNPrint from 'react-native-print';

export interface ExportCol<T = any> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const csvCell = (v: unknown) => `"${text(v).replace(/"/g, '""')}"`;
const esc = (v: unknown) =>
  text(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** CSV opens in Excel; handed to the native share sheet (same approach as the Reports screen). */
export async function exportExcel<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const csv = [cols.map(c => csvCell(c.header)).join(',')]
    .concat(rows.map(r => cols.map(c => csvCell(c.value(r))).join(',')))
    .join('\n');
  await Share.share({ message: csv, title: `${name}.csv` });
}

/** Opens the system print dialog, where "Save as PDF" is available. */
export async function exportPdf<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const html = `<html><head><meta charset="utf-8"><style>
    body{font-family:sans-serif;font-size:10px;padding:12px}h2{margin:0 0 8px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}
    th{background:#024BAB;color:#fff}tr:nth-child(even){background:#f3f6fc}
  </style></head><body><h2>${esc(name)}</h2><table><thead><tr>${cols
    .map(c => `<th>${esc(c.header)}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(r => `<tr>${cols.map(c => `<td>${esc(c.value(r))}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></body></html>`;
  await RNPrint.print({ html });
}

/** Asks Excel or PDF, then exports. Keeps screens to a single call. */
export function chooseExport<T>(name: string, cols: ExportCol<T>[], rows: T[]) {
  const run = (fn: typeof exportExcel) => () =>
    fn(name, cols, rows).catch((e: any) => {
      if (e?.message && !/cancel/i.test(e.message)) Alert.alert('Export failed', e.message);
    });
  Alert.alert('Export', `${rows.length} row(s)`, [
    { text: 'Excel (CSV)', onPress: run(exportExcel) },
    { text: 'PDF', onPress: run(exportPdf) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
