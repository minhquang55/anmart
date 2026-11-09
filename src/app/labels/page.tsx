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
  updateListNameDb,
  type LabelList,
} from "@/lib/labels";

type Msg = { kind: "ok" | "error"; text: string } | null;

export default function LabelsPage() {
  const [catalog, setCatalog] = useState(loadCatalog);
  const [lists, setLists] = useState<LabelList[]>([]);
  // activeId: id của nhóm tem đang mở chi tiết. Khi activeId === null => ở màn hình Master (danh sách nhóm tem)
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State cho Modal Tạo / Đổi tên nhóm tem
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listModalMode, setListModalMode] = useState<"create" | "rename">("create");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameInput, setListNameInput] = useState("");
  const [listSearchQuery, setListSearchQuery] = useState("");

  const index = useMemo(() => buildIndex(catalog.items), [catalog]);
  const active = lists.find((l) => l.id === activeId) ?? null;
  const results = useMemo(() => searchItems(catalog.items, query, 10), [catalog, query]);

  // Tải danh mục và danh sách list từ DB khi mở trang.
  useEffect(() => {
    Promise.all([
      syncCatalog().then((c) => setCatalog(c)).catch(() => { }),
      fetchLists().then((ls) => {
        setLists(ls);
      }),
    ])
      .catch((e: Error) => setMsg({ kind: "error", text: `Lỗi tải dữ liệu: ${e.message}` }))
      .finally(() => setLoading(false));
  }, []);

  function enterDetail(id: string) {
    setActiveId(id);
    saveActiveId(id);
    setMsg(null);
    setQuery("");
  }

  function backToMaster() {
    setActiveId(null);
    saveActiveId(null);
    setMsg(null);
    setQuery("");
  }

  function openCreateListModal() {
    setListModalMode("create");
    setEditingListId(null);
    setListNameInput(`Nhóm tem ${lists.length + 1}`);
    setListModalOpen(true);
  }

  function openRenameListModal(list: LabelList, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setListModalMode("rename");
    setEditingListId(list.id);
    setListNameInput(list.name);
    setListModalOpen(true);
  }

  async function handleSaveListModal(e: React.FormEvent) {
    e.preventDefault();
    const name = listNameInput.trim();
    if (!name) return;

    try {
      if (listModalMode === "create") {
        const created = await createListDb(name);
        setLists((ls) => [created, ...ls]);
        setListModalOpen(false);
        // Sau khi tạo xong, mở ngay nhóm tem vừa tạo để thêm tem
        enterDetail(created.id);
      } else if (listModalMode === "rename" && editingListId) {
        await updateListNameDb(editingListId, name);
        setLists((ls) => ls.map((l) => (l.id === editingListId ? { ...l, name } : l)));
        setListModalOpen(false);
      }
    } catch (err) {
      alert(`Thao tác thất bại: ${(err as Error).message}`);
    }
  }

  async function handleDeleteList(targetList: LabelList, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm(`Xóa nhóm tem "${targetList.name}" cùng tất cả tem bên trong?`)) return;
    try {
      await deleteListDb(targetList.id);
      setLists((ls) => ls.filter((l) => l.id !== targetList.id));
      if (activeId === targetList.id) {
        backToMaster();
      }
    } catch (err) {
      setMsg({ kind: "error", text: `Không xóa được nhóm tem: ${(err as Error).message}` });
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

  // Lọc danh sách nhóm tem theo tìm kiếm ở màn Master
  const filteredLists = lists.filter((l) =>
    l.name.toLowerCase().includes(listSearchQuery.toLowerCase().trim()),
  );

  return (
    <div className="mx-auto max-w-4xl">
      {/* =========================================================================
          MÀN HÌNH MASTER: DANH SÁCH CÁC NHÓM TEM GIÁ
         ========================================================================= */}
      {!active ? (
        <div>
          <PageHeader
            title="Nhóm tem giá"
            subtitle="Quản lý các đợt in tem, nhóm sản phẩm cần in bảng giá"
          >
            <button
              onClick={openCreateListModal}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Tạo nhóm tem</span>
            </button>
          </PageHeader>

          {/* Ô tìm kiếm nhanh nhóm tem */}
          {lists.length > 3 && (
            <div className="mb-4">
              <input
                type="text"
                placeholder="Tìm nhóm tem theo tên..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm shadow-xs transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {msg && (
            <p
              className={`mb-4 text-sm font-medium ${msg.kind === "error" ? "text-danger" : "text-primary"
                }`}
            >
              {msg.text}
            </p>
          )}

          {lists.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl">
                🏷️
              </div>
              <h3 className="font-medium text-foreground">Chưa có nhóm tem nào</h3>
              <p className="mt-1 text-sm text-muted">
                Bấm nút “Tạo nhóm tem” ở trên để tạo danh sách tem đầu tiên.
              </p>
              <button
                onClick={openCreateListModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                + Tạo nhóm tem ngay
              </button>
            </Card>
          ) : filteredLists.length === 0 ? (
            <Card className="py-8 text-center text-sm text-muted">
              Không tìm thấy nhóm tem nào khớp với “{listSearchQuery}”.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLists.map((l) => (
                <div
                  key={l.id}
                  onClick={() => enterDetail(l.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      enterDetail(l.id);
                    }
                  }}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {l.name}
                      </h3>
                      {/* Thao tác nhóm: Sửa tên / Xóa */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openRenameListModal(l, e)}
                          title="Đổi tên nhóm"
                          className="rounded-lg p-1.5 text-muted hover:bg-background hover:text-foreground transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteList(l, e)}
                          title="Xóa nhóm tem"
                          className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-muted">
                      {l.items.length === 0 ? "Chưa có sản phẩm" : `${l.items.length} sản phẩm`}
                      {l.created_at && (
                        <span>
                          {" "}
                          · {new Date(l.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <span className="font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Mở danh sách</span>
                      <span>→</span>
                    </span>
                    {l.items.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void exportListXlsx(l);
                        }}
                        title="Xuất Excel"
                        className="rounded-md border border-border px-2 py-1 text-muted hover:bg-background hover:text-foreground transition-colors"
                      >
                        Xuất Excel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            MÀN HÌNH DETAIL: CHI TIẾT CÁC LABEL BÊN TRONG 1 NHÓM
           ========================================================================= */
        <div>
          {/* Nút quay lại màn Master và tiêu đề nhóm */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={backToMaster}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-xs hover:bg-background transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span>Tất cả nhóm</span>
              </button>

              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground sm:text-xl">{active.name}</h1>
                <button
                  type="button"
                  onClick={() => openRenameListModal(active)}
                  title="Đổi tên nhóm tem này"
                  className="rounded-md p-1 text-muted hover:bg-card hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Các thao tác: Chuyển nhóm nhanh, Xóa nhóm, Xuất Excel */}
            <div className="flex flex-wrap items-center gap-2">
              {lists.length > 1 && (
                <select
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground"
                  value={active.id}
                  onChange={(e) => enterDetail(e.target.value)}
                  title="Chuyển nhanh sang nhóm khác"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.items.length})
                    </option>
                  ))}
                </select>
              )}

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
                <span>Xuất Excel ({active.items.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteList(active)}
                className="rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors"
                title="Xóa nhóm tem hiện tại"
              >
                Xóa nhóm
              </button>
            </div>
          </div>

          {/* Ô tìm kiếm & icon quét mã vạch */}
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
                placeholder="Tìm kiếm theo tên sản phẩm, mã vạch hoặc mã hàng để thêm vào list..."
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
                      className={`flex w-full justify-between gap-2 px-3.5 py-2.5 text-left transition-colors ${idx === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-background"
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
            <p
              className={`mb-3 text-sm font-medium ${msg.kind === "error" ? "text-danger" : "text-primary"
                }`}
            >
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
                  <th className="p-3 max-w-[240px] md:max-w-[320px]">Tên hàng hóa</th>
                  <th className="p-3 whitespace-nowrap">Mã hàng</th>
                  <th className="p-3 whitespace-nowrap">Mã vạch</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[100px]">Giá bán</th>
                  <th className="p-3 whitespace-nowrap">ĐVT</th>
                </tr>
              </thead>
              <tbody>
                {active.items.map((i) => (
                  <tr
                    key={i.code}
                    className="border-b border-border last:border-0 hover:bg-background/50 transition-colors"
                  >
                    {/* Nút xóa icon thùng rác */}
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
                    <td className="p-3 font-medium max-w-[240px] md:max-w-[320px] truncate" title={i.name}>
                      {i.name}
                    </td>
                    <td className="p-3 tabular-nums text-muted whitespace-nowrap">{i.code}</td>
                    <td className="p-3 tabular-nums text-muted whitespace-nowrap">{i.barcode || "–"}</td>
                    <td className="p-3 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatNumber(i.price)} đ
                    </td>
                    <td className="p-3 text-muted whitespace-nowrap">{i.unit}</td>
                  </tr>
                ))}
                {!active.items.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      Nhóm tem này đang trống. Nhập tên sản phẩm hoặc bấm icon quét mã vạch ở ô trên để thêm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL THÊM / SỬA TÊN NHÓM TEM
         ========================================================================= */}
      {listModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-lg font-bold">
              {listModalMode === "create" ? "Tạo nhóm tem giá mới" : "Đổi tên nhóm tem"}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {listModalMode === "create"
                ? "Đặt tên gợi nhớ cho đợt in hoặc nhóm tem (ví dụ: Tem bánh kẹo Tết, Đợt in 09/11)"
                : "Nhập tên mới cho nhóm tem này"}
            </p>

            <form onSubmit={handleSaveListModal} className="mt-4">
              <input
                type="text"
                autoFocus
                required
                value={listNameInput}
                onChange={(e) => setListNameInput(e.target.value)}
                placeholder="Nhập tên nhóm tem..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm shadow-xs transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setListModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-background hover:text-foreground transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!listNameInput.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {listModalMode === "create" ? "Tạo nhóm" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}