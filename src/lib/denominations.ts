export const DENOMINATIONS = [
  500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000,
] as const;

export const STORAGE_KEY = "anmart.cash-count.v1";

/** Số lượng nhập theo mệnh giá (giữ dạng chuỗi để ô nhập có thể trống). */
export type Counts = Record<string, string>;

/** Chuyển chuỗi nhập thành số nguyên không âm; rỗng/không hợp lệ = 0. */
export function parseQty(value: unknown): number {
  const n = parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function calcTotals(counts: Counts): { total: number; notes: number } {
  let total = 0;
  let notes = 0;
  for (const d of DENOMINATIONS) {
    const q = parseQty(counts[d]);
    total += q * d;
    notes += q;
  }
  return { total, notes };
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatVnd(n: number): string {
  return formatNumber(n) + " đ";
}

export function loadCounts(): Counts {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Counts;
  } catch {
    return {};
  }
}

export function saveCounts(counts: Counts): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {}
}

