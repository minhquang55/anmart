import type { Product } from "@/lib/catalog";
import { getSupabase } from "@/lib/supabase";

const ACTIVE_KEY = "anmart.labels.active";

export interface LabelList {
  id: string;
  name: string;
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
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data as ListRow[]).map((l) => ({
    id: l.id,
    name: l.name,
    items: [...l.label_items]
      .sort((a, b) => a.added_at.localeCompare(b.added_at))
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
    .select("id,name")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, items: [] };
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

/** Xuất list ra file .xlsx và tải về. */
export async function exportListXlsx(list: LabelList): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tem giá");
  ws.columns = [
    { header: "Tên sản phẩm", key: "name", width: 40 },
    { header: "Mã hàng", key: "code", width: 22 },
    { header: "Mã vạch", key: "barcode", width: 20 },
    { header: "Giá bán", key: "price", width: 14 },
    { header: "Đơn vị tính", key: "unit", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const it of list.items) ws.addRow(it);
  // Mã hàng/mã vạch giữ dạng chữ để không mất số 0 đầu.
  ws.getColumn("code").numFmt = "@";
  ws.getColumn("barcode").numFmt = "@";
  ws.getColumn("price").numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tem-gia-${list.name.replace(/[^\p{L}\p{N}_-]+/gu, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
