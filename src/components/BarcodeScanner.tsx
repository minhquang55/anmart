"use client";

import { useEffect, useRef, useState } from "react";

function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 1000;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 90);
  } catch {}
  navigator.vibrate?.(60);
}

interface Props {
  onDetect: (text: string) => void;
  onClose: () => void;
}

/** Quét mã vạch liên tục bằng camera; bỏ qua mã lặp lại trong 2 giây. */
export default function BarcodeScanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState("");

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let cancelled = false;
    let last = { text: "", at: 0 };

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 150,
        });
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current ?? undefined,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            if (text === last.text && now - last.at < 2000) return;
            last = { text, at: now };
            beep();
            onDetectRef.current(text);
          },
        );
        if (cancelled) c.stop();
        else controls = c;
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Chưa cấp quyền camera. Hãy cho phép camera trong trình duyệt."
            : "Không mở được camera (cần HTTPS hoặc localhost).",
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-border bg-card">
      <video ref={videoRef} className="aspect-video w-full bg-black object-cover" muted playsInline />
      <div className="flex items-center justify-between p-2 text-sm">
        <span className={error ? "text-danger" : "text-muted"}>
          {error || "Đưa mã vạch vào khung hình"}
        </span>
        <button onClick={onClose} className="rounded-lg border border-border px-3 py-1">
          Tắt camera
        </button>
      </div>
    </div>
  );
}

