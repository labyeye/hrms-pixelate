import { useRef, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { readSheet, downloadTemplate } from "@/lib/exporters";

interface Props {
  name: string;
  headers: string[];
  example: (string | number)[];
  /** Receives header-keyed rows; resolve with a short result message. */
  onRows: (rows: Record<string, any>[]) => Promise<string | void>;
}

/** Import button: pick an Excel file -> onRows. A small "Sample" button downloads the template. */
export function ImportButton({ name, headers, example, onRows }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const rows = await readSheet(f);
      if (!rows.length) return alert("File is empty");
      const msg = await onRows(rows);
      if (msg) alert(msg);
    } catch (e: any) {
      alert(e?.message || "Import failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 text-[#00A36C]" />
        )}{" "}
        Import
      </button>
      <button
        type="button"
        title="Download sample Excel"
        onClick={() => downloadTemplate(name, headers, example)}
        className="px-2 border-2 border-l-0 border-black bg-white text-[10px] font-bold uppercase hover:bg-gray-50"
      >
        Sample
      </button>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
