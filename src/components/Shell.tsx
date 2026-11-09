"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGate, { useAuth } from "@/components/AuthGate";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Frame>{children}</Frame>
    </AuthGate>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, isAdmin, signOut } = useAuth();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Chỉ hiển thị mục Danh mục nếu tài khoản có quyền admin
  const navItems = [
    { href: "/", label: "Tổng quan", icon: "▦" },
    { href: "/cash-count", label: "Đếm tiền", icon: "₫" },
    { href: "/labels", label: "Tem giá", icon: "▤" },
    ...(isAdmin ? [{ href: "/catalog", label: "Danh mục", icon: "☰" }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              A
            </span>
            AnMart
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              isAdmin ? "bg-primary/15 text-primary" : "bg-muted/15 text-muted"
            }`}
          >
            {role}
          </span>
        </div>
        <nav className="space-y-1 text-sm">
          {navItems.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                isActive(n.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-background"
              }`}
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-muted opacity-60">
            <span>◷ Kết ca</span>
            <span className="rounded bg-background px-1.5 text-xs">Sắp có</span>
          </div>
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          {user?.email && (
            <div className="mb-2 truncate text-xs text-muted" title={user.email}>
              {user.email}
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-background"
          >
            ⎋ Đăng xuất
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>

      {/* Thanh điều hướng dưới cho điện thoại */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid border-t border-border bg-sidebar md:!hidden"
        style={{
          gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
        }}
      >
        {navItems.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center py-2 text-xs ${
              isActive(n.href) ? "text-primary font-medium" : "text-muted"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
