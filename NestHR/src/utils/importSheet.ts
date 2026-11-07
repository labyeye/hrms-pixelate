import { Share } from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import * as XLSX from 'xlsx';

const cell = (v: unknown) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v === null || v === undefined ? '' : String(v).trim();
};

/** Picks an .xlsx/.xls/.csv and returns the first sheet as header-keyed rows (all values as strings). Returns null if the user cancels. */
export async function pickSheet(): Promise<Record<string, string>[] | null> {
  let file;
  try {
    file = await DocumentPicker.pickSingle({
      type: [types.xlsx, types.xls, types.csv, types.allFiles],
      copyTo: 'cachesDirectory',
      mode: 'import',
    });
  } catch (e: any) {
    if (DocumentPicker.isCancel(e)) return null;
    throw e;
  }
  const uri = file.fileCopyUri || file.uri;
  const blob = await (await fetch(uri)).blob();
  const b64: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(new Error('Could not read the file'));
    r.readAsDataURL(blob);
  });
  const wb = XLSX.read(b64, { type: 'base64', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Sheet is empty');
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: true,
  });
  return raw
    .map(r => {
      const o: Record<string, string> = {};
      Object.keys(r).forEach(k => (o[String(k).trim()] = cell(r[k])));
      return o;
    })
    .filter(r => Object.values(r).some(v => v !== ''));
}

/** Sample file as CSV via the share sheet (same mechanism as exports). */
export function shareTemplate(
  name: string,
  headers: string[],
  example: (string | number)[],
) {
  const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(q).join(','), example.map(q).join(',')].join('\n');
  return Share.share({ message: csv, title: `${name}_template.csv` });
}
