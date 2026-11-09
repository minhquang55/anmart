"use client";

import { PageHeader } from "@/components/ui";

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tổng quan" subtitle={today} />
    </div>
  );
}
