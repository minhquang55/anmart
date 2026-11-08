"use client";

import { useState } from "react";
import {
  DENOMINATIONS,
  calcTotals,
  formatNumber,
  formatVnd,
  loadCounts,
  parseQty,
  saveCounts,
  type Counts,
} from "@/lib/denominations";
import { useMounted } from "@/lib/use-mounted";
import { Card } from "@/components/ui";

/** Công cụ đếm tiền; dữ liệu lưu localStorage sau khi blur / bấm +/-. */
export default function CashCounter({ compact = false }: { compact?: boolean }) {
  const mounted = useMounted();
  return mounted ? <Inner compact={compact} /> : null;
}

function Inner({ compact }: { compact: boolean }) {
  const [counts, setCounts] = useState<Counts>(loadCounts);

  function setQty(d: number, value: string) {
    setCounts((c) => ({ ...c, [d]: String(parseQty(value) || "") }));
  }

  function step(d: number, delta: number) {
    setCounts((c) => {
      const next = { ...c, [d]: String(Math.max(0, parseQty(c[d]) + delta) || "") };
      saveCounts(next);
      return next;
    });
  }

  function reset() {
    if (!confirm("Xóa hết số liệu đã nhập?")) return;
    setCounts({});
    saveCounts({});
  }

  const { total, notes } = calcTotals(counts);

  return (
    <Card>
      <ul className="space-y-2">
        {DENOMINATIONS.map((d) => {
          const q = parseQty(counts[d]);
          return (
            <li key={d} className="flex items-center gap-2">
              <span className="w-20 font-medium tabular-nums">{formatNumber(d)}</span>
              <button
                onClick={() => step(d, -1)}
                className={`rounded-lg border border-border ${compact ? "h-8 w-8" : "h-10 w-10 text-xl"}`}
                aria-label={`Giảm ${d}`}
              >
                −
              </button>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={counts[d] ?? ""}
                placeholder="0"
                onChange={(e) => setQty(d, e.target.value)}
                onBlur={() => saveCounts(counts)}
                onFocus={(e) => e.target.select()}
                className={`rounded-lg border border-border bg-transparent text-center ${
                  compact ? "h-8 w-14" : "h-10 w-16 text-lg"
                }`}
                aria-label={`Số tờ ${d}`}
              />
              <button
                onClick={() => step(d, 1)}
                className={`rounded-lg border border-border ${compact ? "h-8 w-8" : "h-10 w-10 text-xl"}`}
                aria-label={`Tăng ${d}`}
              >
                +
              </button>
              <span className="ml-auto text-right text-sm tabular-nums text-muted">
                {q ? formatVnd(q * d) : "–"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
        <button onClick={reset} className="text-sm text-danger">
          Xóa hết
        </button>
        <div className="text-right">
          <div className="text-xs text-muted">{notes} tờ</div>
          <div className="text-3xl font-bold tabular-nums">{formatVnd(total)}</div>
        </div>
      </div>
    </Card>
  );
}

