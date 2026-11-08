import { getSupabase } from "@/lib/supabase";

export const CATALOG_KEY = "anmart.catalog.v1";

export interface Product {
  code: string;
  barcode: string;
  name: string;
  price: number;
  unit: string;
}

export interface CatalogData {
  updatedAt: string | null;
  items: Product[];
}

export interface ParsedCatalog {
  items: Product[];
  skipped: number;
  withoutBarcode: number;
}

// Tiêu đề cột trong file KiotViet "Danh sách hàng hóa".
const HEADERS = {
  code: "Mã hàng",
  barcode: "Mã vạch",
  name: "Tên hàng",
  price: "Giá bán",
  unit: "ĐVT",
} as const;

type HeaderKey = keyof typeof HEADERS;

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

/**
 * Chuẩn hóa giá bán: luôn đảm bảo trả về số >= 0, không bao giờ là null/NaN.
 * Nếu file KiotViet gắn định dạng ngày cho ô số, đổi ngược về số ngày Excel.
 */
export function sanitizePrice(v: unknown): number {
  if (v == null || v === "") return 0;
  if (v instanceof Date) {
    const t = v.getTime();
    if (isNaN(t)) return 0;
    const num = Math.round((t - Date.UTC(1899, 11, 30)) / 86400000);
    return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
  }
  if (typeof v === "number") {
    return isNaN(v) || !isFinite(v) ? 0 : Math.max(0, v);
  }
  const clean = String(v).replace(/,/g, "").replace(/[^0-9.-]/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
}

/** Đọc file Excel danh sách hàng hóa của KiotViet; ném lỗi nếu thiếu cột. */
export async function parseCatalogFile(file: Blob): Promise<ParsedCatalog> {
  const { readSheet } = await import("read-excel-file/universal");
  let rows: unknown[][];
  try {
    rows = (await readSheet(file)) as unknown[][];
  } catch {
    throw new Error("Không đọc được file. Hãy chọn file .xlsx xuất từ KiotViet.");
  }
  if (!rows.length) throw new Error("File không có dữ liệu.");

  const col: Partial<Record<HeaderKey, number>> = {};
  rows[0].forEach((cell, n) => {
    const text = cellText(cell);
    for (const key of Object.keys(HEADERS) as HeaderKey[]) {
      if (text === HEADERS[key]) col[key] = n;
    }
  });
  const missing = (Object.keys(HEADERS) as HeaderKey[])
    .filter((key) => col[key] === undefined)
    .map((key) => HEADERS[key]);
  if (missing.length) throw new Error(`Thiếu cột: ${missing.join(", ")}`);

  const get = (row: unknown[], key: HeaderKey) => cellText(row[col[key] as number]);

  const items: Product[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const code = get(row, "code");
    if (!code || seen.has(code)) {
      if (code || row.some((c) => c != null && c !== "")) skipped++;
      continue;
    }
    seen.add(code);
    items.push({
      code,
      barcode: get(row, "barcode"),
      name: get(row, "name"),
      price: sanitizePrice(row[col.price as number]),
      unit: get(row, "unit"),
    });
  }
  return {
    items,
    skipped,
    withoutBarcode: items.filter((i) => !i.barcode).length,
  };
}

export function loadCatalog(): CatalogData {
  try {
    const data = JSON.parse(localStorage.getItem(CATALOG_KEY) || "null") as CatalogData | null;
    if (data && Array.isArray(data.items)) return data;
  } catch {}
  return { updatedAt: null, items: [] };
}

/** Lưu bản sao danh mục vào trình duyệt để tra cứu nhanh (nguồn chính là DB). */
export function saveCatalog(items: Product[], updatedAt: string | null = new Date().toISOString()): CatalogData {
  const data: CatalogData = { updatedAt, items };
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(data));
  } catch {}
  return data;
}

const PAGE = 1000;

/** Tải toàn bộ danh mục từ Supabase (phân trang) và cập nhật bản sao cục bộ. */
export async function syncCatalog(): Promise<CatalogData> {
  const sb = getSupabase();
  const items: Product[] = [];
  let latest: string | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("products")
      .select("code,barcode,name,price,unit,updated_at")
      .order("code")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data) {
      items.push({
        code: r.code,
        barcode: r.barcode ?? "",
        name: r.name,
        price: Number(r.price),
        unit: r.unit ?? "",
      });
      if (!latest || r.updated_at > latest) latest = r.updated_at;
    }
    if (data.length < PAGE) break;
  }
  return saveCatalog(items, latest);
}

export interface ImportCatalogResult extends CatalogData {
  warnings: string[];
}

/** Ghi danh mục vào Supabase: thêm/cập nhật theo Mã hàng, xóa mã không còn trong file. */
export async function importCatalogToDb(
  items: Product[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportCatalogResult> {
  const sb = getSupabase();
  const ts = new Date().toISOString();
  const CHUNK = 500;
  const warnings: string[] = [];

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const rows = chunk.map((p) => ({
      code: String(p.code ?? "").trim(),
      barcode: String(p.barcode ?? "").trim(),
      name: String(p.name ?? "").trim(),
      price: sanitizePrice(p.price),
      unit: String(p.unit ?? "").trim(),
      updated_at: ts,
    })).filter((r) => r.code);

    const { error } = await sb.from("products").upsert(rows, { onConflict: "code" });
    if (error) {
      console.warn("Lỗi khi import chunk, thử lưu từng sản phẩm để bỏ qua dòng lỗi:", error.message);
      // Xử lý bypass lỗi: lưu từng dòng để bỏ qua dòng lỗi và tiếp tục vòng lặp
      for (const row of rows) {
        try {
          const { error: rowErr } = await sb.from("products").upsert([row], { onConflict: "code" });
          if (rowErr) {
            warnings.push(`Sản phẩm ${row.code} (${row.name}): ${rowErr.message}`);
          }
        } catch (e) {
          warnings.push(`Sản phẩm ${row.code}: ${e instanceof Error ? e.message : "Lỗi không xác định"}`);
        }
      }
    }
    onProgress?.(Math.min(i + CHUNK, items.length), items.length);
  }

  try {
    const { error: delErr } = await sb.from("products").delete().lt("updated_at", ts);
    if (delErr) {
      console.warn("Không xóa được sản phẩm cũ:", delErr.message);
    }
  } catch (e) {
    console.warn("Lỗi dọn sản phẩm cũ:", e);
  }

  const catalog = saveCatalog(items, ts);
  return {
    ...catalog,
    warnings,
  };
}

/** Bộ tra cứu: mã vạch trước, mã hàng sau. */
export function buildIndex(items: Product[]) {
  const byBarcode = new Map<string, Product>();
  const byCode = new Map<string, Product>();
  for (const it of items) {
    if (it.barcode) byBarcode.set(it.barcode, it);
    byCode.set(it.code, it);
  }
  return {
    find(raw: string): Product | null {
      const key = raw.trim();
      if (!key) return null;
      return byBarcode.get(key) ?? byCode.get(key) ?? null;
    },
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

/** Tìm theo tên/mã hàng/mã vạch (không phân biệt dấu). */
export function searchItems(items: Product[], query: string, limit = 8): Product[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const out: Product[] = [];
  for (const it of items) {
    if (
      normalize(it.name).includes(q) ||
      it.code.toLowerCase().includes(q) ||
      it.barcode.includes(q)
    ) {
      out.push(it);
      if (out.length >= limit) break;
    }
  }
  return out;
}

