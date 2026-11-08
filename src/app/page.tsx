"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CashCounter from "@/components/CashCounter";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { loadCatalog, syncCatalog, type CatalogData } from "@/lib/catalog";
import { calcTotals, formatNumber, formatVnd, loadCounts } from "@/lib/denominations";
import { fetchLists, type LabelList } from "@/lib/labels";

export default function DashboardPage() {
  const [catalog, setCatalog] = useState<CatalogData>(loadCatalog);
  const [lists, setLists] = useState<LabelList[]>([]);
  const { total, notes } = calcTotals(loadCounts());

  useEffect(() => {
    void syncCatalog().then(setCatalog).catch(() => {});
    void fetchLists().then(setLists).catch(() => {});
  }, []);

  const withBarcode = catalog.items.filter((i) => i.barcode).length;
  const labelItems = lists.reduce((s, l) => s + l.items.length, 0);
  const updated = catalog.updatedAt ? new Date(catalog.updatedAt) : null;
  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tổng quan" subtitle={today}>
        <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs text-muted sm:block">
          Đồng bộ với cơ sở dữ liệu
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Sản phẩm trong danh mục"
          value={formatNumber(catalog.items.length)}
          hint={`${formatNumber(withBarcode)} có mã vạch`}
        />
        <StatCard
          label="Cập nhật danh mục"
          value={updated ? updated.toLocaleDateString("vi-VN") : "–"}
          hint={updated ? updated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Chưa nhập"}
        />
        <StatCard label="Tiền đang đếm" value={formatVnd(total)} hint={`${notes} tờ (thiết bị này)`} />
        <StatCard
          label="List tem giá"
          value={String(lists.length)}
          hint={`${formatNumber(labelItems)} sản phẩm`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Đếm tiền nhanh</h2>
            <Link href="/cash-count" className="text-sm text-primary">
              Mở đầy đủ →
            </Link>
          </div>
          <CashCounter compact />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold">Lối tắt</h2>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <Link href="/labels" className="rounded-lg bg-primary px-3 py-3 text-primary-foreground">
                ▤ Quét tem mới
              </Link>
              <Link href="/catalog" className="rounded-lg border border-border px-3 py-3">
                ⇪ Nhập danh mục
              </Link>
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">List tem gần đây</h2>
            {lists.length ? (
              <ul className="divide-y divide-border text-sm">
                {lists.slice(-5).reverse().map((l) => (
                  <li key={l.id} className="flex justify-between py-2">
                    <span className="truncate">{l.name}</span>
                    <span className="text-muted">{l.items.length} SP</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Chưa có list nào.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
