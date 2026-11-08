"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Card, PageHeader } from "@/components/ui";
import { buildIndex, loadCatalog, searchItems, syncCatalog, type Product } from "@/lib/catalog";
import { formatNumber } from "@/lib/denominations";
import {
  addItemDb,
  createListDb,
  deleteListDb,
  exportListXlsx,
  fetchLists,
  loadActiveId,
  removeItemDb,
  saveActiveId,
  type LabelList,
} from "@/lib/labels";

type Msg = { kind: "ok" | "error"; text: string } | null;

export default function LabelsPage() {
  const [catalog, setCatalog] = useState(loadCatalog);
  const [lists, setLists] = useState<LabelList[]>([]);
  const [activeId, setActiveId] = useState<string | null>(loadActiveId);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildIndex(catalog.items), [catalog]);
  const active = lists.find((l) => l.id === activeId) ?? null;
  const results = useMemo(() => searchItems(catalog.items, query, 10), [catalog, query]);

  // Tải danh mục và danh sách list từ DB khi mở trang.
  useEffect(() => {
    Promise.all([
      syncCatalog().then((c) => setCatalog(c)).catch(() => {}),
      fetchLists().then((ls) => {
        setLists(ls);
        setActiveId((cur) => (cur && ls.some((l) => l.id === cur) ? cur : ls[0]?.id ?? null));
      }),
    ])
      .catch((e: Error) => setMsg({ kind: "error", text: `Lỗi tải dữ liệu: ${e.message}` }))
      .finally(() => setLoading(false));
  }, []);

  function switchList(id: string | null) {
    setActiveId(id);
    saveActiveId(id);
    setMsg(null);
  }

  async function createList() {
    const name = prompt("Tên list tem mới:", `List ${lists.length + 1}`)?.trim();
    if (!name) return;
    try {
      const created = await createListDb(name);
      setLists((ls) => [created, ...ls]);
      switchList(created.id);
    } catch (e) {
      setMsg({ kind: "error", text: `Không tạo được list: ${(e as Error).message}` });
    }
  }

  async function deleteList() {
    if (!active || !confirm(`Xóa list "${active.name}"?`)) return;
    try {
      await deleteListDb(active.id);
      const remaining = lists.filter((l) => l.id !== active.id);
      setLists(remaining);
      switchList(remaining[0]?.id ?? null);
    } catch (e) {
      setMsg({ kind: "error", text: `Không xóa được list: ${(e as Error).message}` });
    }
  }

  // Thêm sản phẩm vào đầu list
  async function addProduct(p: Product): Promise<boolean> {
    if (!active) return false;
    try {
      const ok = await addItemDb(active.id, p);
      if (!ok) {
        setMsg({ kind: "error", text: `Bị trùng: "${p.name}" (${p.code}) đã có trong list.` });
        return false;
      }
      setLists((ls) =>
        ls.map((l) =>
          l.id === active.id
            ? { ...l, items: [p, ...l.items.filter((i) => i.code !== p.code)] }
            : l,
        ),
      );
      setMsg({ kind: "ok", text: `Đã thêm vào đầu list: ${p.name}` });
      return true;
    } catch (e) {
      setMsg({ kind: "error", text: `Lỗi thêm sản phẩm: ${(e as Error).message}` });
      return false;
    }
  }

  // Xử lý khi camera quét được mã
  async function handleDetectBarcode(rawCode: string) {
    const code = rawCode.trim();
    if (!code) return;

    const p = index.find(code);
    if (!p) {
      // Quét thất bại: giữ nguyên popup và hiển thị thông báo
      setScanError(`Không tìm thấy sản phẩm có mã "${code}" trong danh mục.`);
      return;
    }

    const ok = await addProduct(p);
    if (!ok) {
      // Sản phẩm đã có trong list: giữ popup và báo trùng
      setScanError(`Sản phẩm "${p.name}" (${p.code}) đã có trong list.`);
      return;
    }

    // Quét thành công: tắt popup
    setScanError("");
    setScanning(false);
  }

  async function removeItem(code: string) {
    if (!active) return;
    try {
      await removeItemDb(active.id, code);
      setLists((ls) =>
        ls.map((l) =>
          l.id === active.id ? { ...l, items: l.items.filter((i) => i.code !== code) } : l,
        ),
      );
    } catch (e) {
      setMsg({ kind: "error", text: `Lỗi xóa dòng: ${(e as Error).message}` });
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted">Đang tải dữ liệu...</div>;
  }

  if (!catalog.items.length) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title="Tem giá" />
        <Card className="text-sm">
          Chưa có danh mục sản phẩm trong database. Hãy{" "}
          <a href="/catalog" className="text-primary underline">
            tải file Excel lên
          </a>{" "}
          trước.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tem giá" subtitle="Tìm kiếm sản phẩm, quét mã vạch và xuất file in tem">
        <button onClick={createList} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          + List mới
        </button>
      </PageHeader>

      {!active ? (
        <Card className="text-sm">
          {lists.length ? (
            <label className="block">
              Chọn list tem để bắt đầu:
              <select
                className="mt-2 block w-full rounded-xl border border-border bg-card p-2.5 text-sm"
                value=""
                onChange={(e) => switchList(e.target.value)}
              >
                <option value="" disabled>
                  — Chọn danh sách —
                </option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.items.length} sản phẩm)
                  </option>
                ))}
              </select>
            </label>
          ) : (
            "Chưa có list nào. Bấm “+ List mới” ở góc trên để tạo danh sách tem đầu tiên."
          )}
        </Card>
      ) : (
        <>
          {/* Thanh chọn list và thao tác phía trên (đã đưa nút Xuất Excel lên đầu) */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Đang xem:</span>
              <select
                className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium"
                value={active.id}
                onChange={(e) => switchList(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.items.length})
                  </option>
                ))}
              </select>
              <button onClick={deleteList} className="text-xs text-danger hover:underline">
                Xóa list
              </button>
            </div>

            {/* Nút Xuất Excel đưa lên ĐẦU bảng */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-muted font-medium">
                {active.items.length} sản phẩm
              </span>
              <button
                disabled={!active.items.length}
                onClick={() => void exportListXlsx(active)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                title="Xuất danh sách ra file Excel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          {/* 1 ô input duy nhất tìm kiếm & append icon quét mã vạch */}
          <div className="relative mb-3">
            <div className="relative flex items-center">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = query.trim();
                    if (!val) return;

                    // 1. Thử tìm chính xác theo mã vạch / mã hàng
                    const exact = index.find(val);
                    if (exact) {
                      void addProduct(exact);
                      setQuery("");
                      return;
                    }

                    // 2. Nếu có kết quả tìm kiếm thì thêm kết quả đang chọn hoặc đầu tiên
                    if (results.length > 0) {
                      const item =
                        selectedIndex >= 0 && selectedIndex < results.length
                          ? results[selectedIndex]
                          : results[0];
                      void addProduct(item);
                      setQuery("");
                      return;
                    }

                    setMsg({ kind: "error", text: `Không tìm thấy sản phẩm nào khớp với "${val}".` });
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : i));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIndex((i) => (i > 0 ? i - 1 : -1));
                  } else if (e.key === "Escape") {
                    setQuery("");
                  }
                }}
                placeholder="Tìm kiếm theo tên sản phẩm, mã vạch hoặc mã hàng..."
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-3.5 pr-11 text-sm shadow-xs transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />

              {/* Icon Quét mã vạch append ở góc phải ô input */}
              <button
                type="button"
                onClick={() => {
                  setScanError("");
                  setScanning(true);
                }}
                title="Bấm để mở camera quét mã vạch"
                aria-label="Quét mã vạch"
                className="absolute inset-y-1 right-1 flex items-center justify-center rounded-lg px-2.5 text-muted hover:bg-background hover:text-primary transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="8" x2="7" y2="16" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="17" y1="8" x2="17" y2="16" />
                </svg>
              </button>
            </div>

            {/* Dropdown gợi ý tìm kiếm */}
            {query.trim().length > 0 && results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card text-sm shadow-xl">
                {results.map((p, idx) => (
                  <li key={p.code}>
                    <button
                      type="button"
                      className={`flex w-full justify-between gap-2 px-3.5 py-2.5 text-left transition-colors ${
                        idx === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-background"
                      }`}
                      onClick={() => {
                        void addProduct(p);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="text-xs text-muted">
                          · {p.unit || "Cái"} · Mã: {p.code}
                          {p.barcode ? ` · Vạch: ${p.barcode}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-muted">
                        {formatNumber(p.price)} đ
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Thông báo thao tác thêm/xóa */}
          {msg && (
            <p className={`mb-3 text-sm font-medium ${msg.kind === "error" ? "text-danger" : "text-primary"}`}>
              {msg.text}
            </p>
          )}

          {/* Popup Modal quét mã vạch */}
          {scanning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="flex items-center gap-2 font-semibold text-base">
                    <span>📷</span> Quét mã vạch sản phẩm
                  </h3>
                  <button
                    onClick={() => {
                      setScanning(false);
                      setScanError("");
                    }}
                    className="rounded-lg p-1 text-muted hover:bg-background hover:text-foreground text-lg leading-none"
                    aria-label="Đóng popup"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <BarcodeScanner
                    onDetect={handleDetectBarcode}
                    onClose={() => {
                      setScanning(false);
                      setScanError("");
                    }}
                    scanError={scanError}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bảng danh sách sản phẩm trong list tem */}
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="p-3 w-10 text-center" aria-label="Xóa"></th>
                  <th className="p-3 min-w-[100px]">Tên hàng hóa</th>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Mã vạch</th>
                  <th className="p-3 text-right">Giá bán</th>
                  <th className="p-3">ĐVT</th>
                </tr>
              </thead>
              <tbody>
                {active.items.map((i) => (
                  <tr key={i.code} className="border-b border-border last:border-0 hover:bg-background/50 transition-colors">
                    {/* Cột 1: Nút xóa icon thùng rác */}
                    <td className="p-3 text-center w-10">
                      <button
                        type="button"
                        onClick={() => void removeItem(i.code)}
                        className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger transition-colors inline-flex items-center justify-center"
                        title={`Xóa ${i.name}`}
                        aria-label={`Xóa ${i.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                    <td className="p-3 font-medium min-w-[100px]">{i.name}</td>
                    <td className="p-3 tabular-nums text-muted">{i.code}</td>
                    <td className="p-3 tabular-nums text-muted">{i.barcode || "–"}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{formatNumber(i.price)} đ</td>
                    <td className="p-3 text-muted">{i.unit}</td>
                  </tr>
                ))}
                {!active.items.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      List tem đang trống. Tìm kiếm hoặc bấm icon quét mã vạch ở ô trên để thêm sản phẩm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
