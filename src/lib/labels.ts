import type { Product } from "@/lib/catalog";
import { getSupabase } from "@/lib/supabase";

const ACTIVE_KEY = "anmart.labels.active";

export interface LabelList {
  id: string;
  name: string;
  created_at?: string;
  items: Product[];
}

export function loadActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

interface ListRow {
  id: string;
  name: string;
  created_at: string;
  label_items: {
    product_code: string;
    barcode: string;
    name: string;
    price: number;
    unit: string;
    added_at: string;
  }[];
}

export async function fetchLists(): Promise<LabelList[]> {
  const { data, error } = await getSupabase()
    .from("label_lists")
    .select("id,name,created_at,label_items(product_code,barcode,name,price,unit,added_at)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ListRow[]).map((l) => ({
    id: l.id,
    name: l.name,
    created_at: l.created_at,
    items: [...l.label_items]
      .sort((a, b) => b.added_at.localeCompare(a.added_at))
      .map((i) => ({
        code: i.product_code,
        barcode: i.barcode ?? "",
        name: i.name,
        price: Number(i.price),
        unit: i.unit ?? "",
      })),
  }));
}

export async function createListDb(name: string): Promise<LabelList> {
  const { data, error } = await getSupabase()
    .from("label_lists")
    .insert({ name })
    .select("id,name,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, created_at: data.created_at, items: [] };
}

export async function updateListNameDb(id: string, name: string): Promise<void> {
  const { error } = await getSupabase().from("label_lists").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteListDb(id: string): Promise<void> {
  const { error } = await getSupabase().from("label_lists").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Thêm sản phẩm vào list. Trả về false nếu sản phẩm đã có trong list (trùng). */
export async function addItemDb(listId: string, p: Product): Promise<boolean> {
  const { error } = await getSupabase().from("label_items").insert({
    list_id: listId,
    product_code: p.code,
    barcode: p.barcode,
    name: p.name,
    price: p.price,
    unit: p.unit,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

export async function removeItemDb(listId: string, code: string): Promise<void> {
  const { error } = await getSupabase()
    .from("label_items")
    .delete()
    .eq("list_id", listId)
    .eq("product_code", code);
  if (error) throw new Error(error.message);
}

/** Xuất list ra file Excel định dạng 97-2003 Worksheet (.xls - BIFF8) và tải về. */
export async function exportListXls(list: LabelList): Promise<void> {
  const XLSX = await import("xlsx");

  // Dữ liệu bảng: Hàng tiêu đề + các hàng sản phẩm
  const rows: (string | number)[][] = [
    ["Tên sản phẩm", "Mã hàng", "Mã vạch", "Giá bán", "Đơn vị tính"],
  ];

  for (const it of list.items) {
    rows.push([
      it.name,
      String(it.code ?? ""), // Dạng chuỗi để giữ nguyên số 0 đầu
      String(it.barcode ?? ""), // Dạng chuỗi
      it.price,
      it.unit || "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Thiết lập độ rộng cột
  ws["!cols"] = [
    { wch: 38 }, // Tên sản phẩm
    { wch: 18 }, // Mã hàng
    { wch: 18 }, // Mã vạch
    { wch: 14 }, // Giá bán
    { wch: 12 }, // Đơn vị tính
  ];

  // Định dạng ô
  for (let r = 1; r < rows.length; r++) {
    // Cột Mã hàng (B) và Mã vạch (C) là Text (@)
    const codeCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (codeCell) {
      codeCell.t = "s";
      codeCell.z = "@";
    }
    const barcodeCell = ws[XLSX.utils.encode_cell({ r, c: 2 })];
    if (barcodeCell) {
      barcodeCell.t = "s";
      barcodeCell.z = "@";
    }
    // Cột Giá bán (D) định dạng số
    const priceCell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (priceCell) {
      priceCell.t = "n";
      priceCell.z = "#,##0";
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tem gia");

  // Ghi ra định dạng biff8 (Excel 97-2004 Workbook .xls)
  const buf = XLSX.write(wb, {
    bookType: "biff8",
    type: "array",
  });

  const blob = new Blob([buf], {
    type: "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tem-gia-${list.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// Alias cho tương thích
export const exportListXlsx = exportListXls;
