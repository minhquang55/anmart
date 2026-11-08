"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import {
  importCatalogToDb,
  loadCatalog,
  parseCatalogFile,
  syncCatalog,
  type ParsedCatalog,
} from "@/lib/catalog";
import { formatNumber } from "@/lib/denominations";

export default function CatalogPage() {
  const [info, setInfo] = useState<{ count: number; updatedAt: string | null } | null>(() => {
    const local = loadCatalog();
    return { count: local.items.length, updatedAt: local.updatedAt };
  });
  const [preview, setPreview] = useState<(ParsedCatalog & { fileName: string }) | null>(null);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  // Lấy danh mục mới nhất từ DB khi mở trang (đã khởi tạo từ bản cục bộ).
  useEffect(() => {
    syncCatalog()
      .then((d) => setInfo({ count: d.items.length, updatedAt: d.updatedAt }))
      .catch((e: Error) => setError(`Không tải được danh mục từ DB: ${e.message}`));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setWarnings([]);
    setPreview(null);
    setBusy(true);
    setProgress("Đang đọc file...");
    try {
      setPreview({ ...(await parseCatalogFile(file)), fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đọc được file.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const data = await importCatalogToDb(preview.items, (done, total) =>
        setProgress(`Đang lưu vào DB: ${formatNumber(done)}/${formatNumber(total)}`),
      );
      setInfo({ count: data.items.length, updatedAt: data.updatedAt });
      setPreview(null);
      if (data.warnings.length) {
        setWarnings(data.warnings);
      }
    } catch (err) {
      setError(`Lưu vào DB thất bại: ${err instanceof Error ? err.message : "lỗi không rõ"}`);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Danh mục sản phẩm" subtitle="Nhập file Excel xuất từ KiotViet, lưu vào cơ sở dữ liệu" />

      <Card className="mb-4 text-sm">
        {!info ? (
          "Đang tải..."
        ) : info.count && info.updatedAt ? (
          <>
            <div>
              <b>{formatNumber(info.count)}</b> sản phẩm trong DB
            </div>
            <div className="text-muted">
              Cập nhật: {new Date(info.updatedAt).toLocaleString("vi-VN")}
            </div>
          </>
        ) : (
          "Chưa có danh mục. Hãy tải file Excel xuất từ KiotViet."
        )}
      </Card>

      <p className="mb-2 text-sm text-muted">
        KiotViet → Hàng hóa → Danh sách hàng hóa → Xuất file. Tải lại file mới để cập nhật giá.
      </p>
      <input type="file" accept=".xlsx" onChange={onFile} disabled={busy} className="mb-4 block w-full text-sm" />
      {progress && <p className="text-sm">{progress}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {warnings.length > 0 && (
        <Card className="mb-4 border-amber-500/50 bg-amber-500/10 text-sm">
          <p className="font-semibold text-amber-600 dark:text-amber-400">
            Có {warnings.length} sản phẩm gặp lỗi và đã được bỏ qua hoặc tự gán giá 0:
          </p>
          <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-muted">
            {warnings.slice(0, 50).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
            {warnings.length > 50 && <li>...và {warnings.length - 50} lỗi khác</li>}
          </ul>
        </Card>
      )}

      {preview && (
        <Card className="text-sm">
          <div className="font-semibold">{preview.fileName}</div>
          <ul className="my-2 list-disc pl-5">
            <li>{formatNumber(preview.items.length)} sản phẩm hợp lệ</li>
            <li>
              {formatNumber(preview.withoutBarcode)} sản phẩm không có mã vạch (tìm bằng tên/mã hàng)
            </li>
            {preview.skipped > 0 && <li>{preview.skipped} dòng bị bỏ qua (thiếu hoặc trùng mã hàng)</li>}
          </ul>
          <p className="mb-2 text-muted">
            Sản phẩm trùng Mã hàng sẽ được cập nhật; sản phẩm không còn trong file sẽ bị xóa khỏi danh mục.
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmImport}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              Lưu vào DB
            </button>
            <button onClick={() => setPreview(null)} disabled={busy} className="rounded-lg border border-border px-4 py-2">
              Hủy
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
