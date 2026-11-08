"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [msg, setMsg] = useState<Msg>(null);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");

  const index = useMemo(() => buildIndex(catalog.items), [catalog]);
  const active = lists.find((l) => l.id === activeId) ?? null;
  const results = useMemo(() => searchItems(catalog.items, query), [catalog, query]);

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
  }

  async function createList() {
    const name = prompt("Tên list tem mới:", `List ${lists.length + 1}`)?.trim();
    if (!name) return;
    try {
      const created = await createListDb(name);
      setLists((ls) => [...ls, created]);
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

  async function addProduct(p: Product) {
    if (!active) return;
    try {
      const ok = await addItemDb(active.id, p);
      if (!ok) {
        setMsg({ kind: "error", text: `Bị trùng: ${p.name} (${p.code}) đã có trong list.` });
        return;
      }
      setLists((ls) =>
        ls.map((l) => (l.id === active.id ? { ...l, items: [...l.items, p] } : l)),
      );
      setMsg({ kind: "ok", text: `Đã thêm: ${p.name}` });
    } catch (e) {
      setMsg({ kind: "error", text: `Lỗi thêm sản phẩm: ${(e as Error).message}` });
    }
  }

  function addByScan(raw: string) {
    const p = index.find(raw);
    if (!p) {
      setMsg({ kind: "error", text: `Không tìm thấy mã "${raw}" trong danh mục.` });
      return;
    }
    void addProduct(p);
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
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Tem giá" subtitle="Quét mã vạch, tạo list và xuất Excel">
        <button onClick={createList} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          + List mới
        </button>
      </PageHeader>

      {!active ? (
        <Card className="text-sm">
          {lists.length ? (
            <label className="block">
              Chọn list:
              <select
                className="mt-1 block w-full rounded-lg border border-border bg-card p-2"
                value=""
                onChange={(e) => switchList(e.target.value)}
              >
                <option value="" disabled>
                  — chọn —
                </option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.items.length})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            "Chưa có list nào. Bấm “+ List mới” để bắt đầu."
          )}
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <select
              className="rounded-lg border border-border bg-card p-2"
              value={active.id}
              onChange={(e) => switchList(e.target.value)}
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.items.length})
                </option>
              ))}
            </select>
            <button onClick={deleteList} className="text-danger">
              Xóa list
            </button>
            <button
              onClick={() => setScanning((s) => !s)}
              className="ml-auto rounded-lg border border-border px-3 py-2"
            >
              {scanning ? "Tắt camera" : "▤ Quét bằng camera"}
            </button>
          </div>

          {scanning && <BarcodeScanner onDetect={addByScan} onClose={() => setScanning(false)} />}

          <form
            className="mb-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) addByScan(manual);
              setManual("");
            }}
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              placeholder="Nhập mã vạch / mã hàng rồi Enter"
              className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            <button className="rounded-lg border border-border px-3 text-sm">Thêm</button>
          </form>

          <div className="relative mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên / mã hàng (dành cho SP không có mã vạch)"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card text-sm shadow-lg">
                {results.map((p) => (
                  <li key={p.code}>
                    <button
                      className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-background"
                      onClick={() => {
                        void addProduct(p);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">
                        {p.name} <span className="text-muted">· {p.unit}</span>
                      </span>
                      <span className="tabular-nums text-muted">{formatNumber(p.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {msg && (
            <p className={`mb-3 text-sm ${msg.kind === "error" ? "text-danger" : "text-muted"}`}>
              {msg.text}
            </p>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3">Mã hàng</th>
                  <th className="p-3">Mã vạch</th>
                  <th className="p-3 text-right">Giá bán</th>
                  <th className="p-3">ĐVT</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {active.items.map((i) => (
                  <tr key={i.code} className="border-b border-border last:border-0">
                    <td className="p-3">{i.name}</td>
                    <td className="p-3 tabular-nums">{i.code}</td>
                    <td className="p-3 tabular-nums">{i.barcode || "–"}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(i.price)}</td>
                    <td className="p-3">{i.unit}</td>
                    <td className="p-3">
                      <button
                        onClick={() => void removeItem(i.code)}
                        className="text-danger"
                        aria-label="Xóa dòng"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {!active.items.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted">
                      List trống. Quét mã vạch hoặc tìm sản phẩm để thêm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted">{active.items.length} sản phẩm</span>
            <button
              disabled={!active.items.length}
              onClick={() => void exportListXlsx(active)}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              Xuất Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
