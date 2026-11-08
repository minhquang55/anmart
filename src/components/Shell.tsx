"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGate from "@/components/AuthGate";

const NAV = [
  { href: "/", label: "Tổng quan", icon: "▦" },
  { href: "/cash-count", label: "Đếm tiền", icon: "₫" },
  { href: "/labels", label: "Tem giá", icon: "▤" },
  { href: "/catalog", label: "Danh mục", icon: "☰" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  return <AuthGate>{(signOut) => <Frame signOut={signOut}>{children}</Frame>}</AuthGate>;
}

function Frame({ children, signOut }: { children: React.ReactNode; signOut: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            A
          </span>
          AnMart
        </div>
        <nav className="space-y-1 text-sm">
          {NAV.map((n) => (
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
        <button onClick={signOut} className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-background">
          ⎋ Đăng xuất
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>

      {/* Thanh điều hướng dưới cho điện thoại */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-border bg-sidebar md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center py-2 text-xs ${
              isActive(n.href) ? "text-primary" : "text-muted"
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

