// Spreadsheet read/write on exceljs (replaces the unpatched "xlsx" package). Loaded on demand so it stays out of the main bundle.
// Reads .xlsx and .csv; legacy binary .xls is not supported.

export type Aoa = unknown[][];

const load = async () => (await import("exceljs")).default;

function download(buf: BlobPart, filename: string, type: string) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([buf], { type })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function writeSheet(
  filename: string,
  sheetName: string,
  aoa: Aoa,
  colWidth = 0,
) {
  const ExcelJS = await load();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  aoa.forEach((r) => ws.addRow(r.map((c) => c ?? null) as any[]));
  if (colWidth) ws.columns.forEach((c) => (c.width = colWidth));
  download(
    await wb.xlsx.writeBuffer(),
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') ((cur += '"'), i++);
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") (row.push(cur), (cur = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) (row.push(cur), rows.push(row));
  return rows;
}

/** First sheet of an .xlsx/.csv file as rows; empty cells are "", dates stay Date. */
export async function readRows(file: File): Promise<any[][]> {
  if (/\.xls$/i.test(file.name))
    throw new Error(
      "Old .xls files are not supported. Save it as .xlsx or .csv.",
    );
  if (/\.csv$/i.test(file.name))
    return parseCsv((await file.text()).replace(/^﻿/, ""));
  const ExcelJS = await load();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  const out: any[][] = [];
  ws?.eachRow({ includeEmpty: true }, (row) => {
    const vals: any[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      let v: any = row.getCell(c).value;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("result" in v) v = (v as any).result;
        else if ("text" in v) v = (v as any).text;
        else if ("richText" in v)
          v = (v as any).richText.map((t: any) => t.text).join("");
      }
      vals.push(v ?? "");
    }
    out.push(vals);
  });
  return out;
}

const str = (v: any) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();

/** Header-keyed objects with every value as a trimmed string. */
export async function readObjects(
  file: File,
): Promise<Record<string, string>[]> {
  const rows = await readRows(file);
  const head = (rows[0] || []).map(str);
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c !== "" && c != null))
    .map((r) => {
      const o: Record<string, string> = {};
      head.forEach((h, i) => {
        if (h) o[h] = str(r[i]);
      });
      return o;
    });
}

export interface ReportSheetMeta {
  title: string;
  period?: string;
  companyName?: string;
  generatedBy?: string;
}

// Professional report workbook: title block, styled header, number formats, zebra rows, totals row, frozen header, print-ready.
export async function writeReportSheet(
  filename: string,
  meta: ReportSheetMeta,
  headers: string[],
  rows: unknown[][],
) {
  const { analyzeColumns, parseNum } = await import("./reportPrintHTML");
  const ExcelJS = await load();
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.companyName || "NestHR";
  wb.created = new Date();
  const ws = wb.addWorksheet((meta.title || "Report").slice(0, 31), {
    views: [{ state: "frozen", ySplit: 6 }],
  });
  const cols = Math.max(headers.length, 4);
  const { numeric, money } = analyzeColumns(headers, rows);

  const band = (r: number, text: string, size: number, bold: boolean, color = "FF111111") => {
    ws.mergeCells(r, 1, r, cols);
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { name: "Calibri", size, bold, color: { argb: color } };
    c.alignment = { vertical: "middle", horizontal: "left" };
  };
  band(1, meta.companyName || "NestHR", 16, true, "FF024BAB");
  band(2, meta.title, 13, true);
  band(3, [meta.period && `Period: ${meta.period}`, `Generated: ${new Date().toLocaleString("en-IN")}`, meta.generatedBy && `By: ${meta.generatedBy}`].filter(Boolean).join("   |   "), 10, false, "FF6B7280");
  band(4, `Total records: ${rows.length}`, 10, false, "FF6B7280");
  ws.getRow(1).height = 24;

  const headRow = ws.getRow(6);
  headers.forEach((h, i) => {
    const c = headRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF024BAB" } };
    c.alignment = { vertical: "middle", horizontal: numeric[i] ? "right" : "left", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: "FF012F6B" } } };
  });
  headRow.height = 22;

  rows.forEach((r, ri) => {
    const row = ws.getRow(7 + ri);
    headers.forEach((_, ci) => {
      const raw = r[ci];
      const n = numeric[ci] ? parseNum(raw) : null;
      const c = row.getCell(ci + 1);
      c.value = n !== null ? n : ((raw ?? "") as any);
      if (n !== null) {
        c.numFmt = money[ci] ? "#,##0.00;[Red]-#,##0.00" : "General";
        c.alignment = { horizontal: "right" };
      }
      c.border = { bottom: { style: "hair", color: { argb: "FFD1D5DB" } } };
      if (ri % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFF" } };
    });
  });

  const last = 6 + rows.length;
  if (rows.length > 1 && money.some(Boolean)) {
    const t = ws.getRow(last + 1);
    headers.forEach((_, ci) => {
      const c = t.getCell(ci + 1);
      if (ci === 0) c.value = "TOTAL";
      if (money[ci]) {
        const L = ws.getColumn(ci + 1).letter;
        c.value = { formula: `SUM(${L}7:${L}${last})` } as any;
        c.numFmt = "#,##0.00;[Red]-#,##0.00";
        c.alignment = { horizontal: "right" };
      }
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      c.border = { top: { style: "medium", color: { argb: "FF024BAB" } } };
    });
  }

  ws.columns.forEach((col, i) => {
    const longest = Math.max(
      String(headers[i] ?? "").length,
      ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length),
    );
    col.width = Math.min(Math.max(longest + 3, 10), 40);
  });
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(last, 6), column: headers.length } };
  ws.pageSetup = { orientation: headers.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.headerFooter.oddFooter = "&L&8" + (meta.companyName || "NestHR") + " - Confidential&R&8Page &P of &N";

  download(
    await wb.xlsx.writeBuffer(),
    filename,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
