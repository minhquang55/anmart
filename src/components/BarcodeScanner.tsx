"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Âm thanh và rung báo hiệu quét thành công
export function notifyScanSuccess() {
  // 1. Rung điện thoại (vibrate pattern: rung 80ms)
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {}

  // 2. Phát âm thanh "bíp" hai tông tần số cao rõ nét kiểu máy pos quét mã
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    // Resume context nếu đang suspended trên trình duyệt mobile
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Tần số chuyển từ 1800Hz lên 2400Hz tạo tiếng bíp điện tử rất rõ và dễ nghe
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.08);

    // Fade out âm lượng để không bị tiếng "tách"
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);

    setTimeout(() => {
      void ctx.close();
    }, 200);
  } catch {}
}

interface Props {
  onDetect: (text: string) => void;
  onClose: () => void;
  scanError?: string;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

export default function BarcodeScanner({ onDetect, onClose, scanError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onDetectRef = useRef(onDetect);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [decodingPhoto, setDecodingPhoto] = useState(false);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // Khởi tạo camera và luồng quét
  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let stream: MediaStream | undefined;
    let cancelled = false;
    let last = { text: "", at: 0 };

    const handleBarcodeFound = (text: string) => {
      const now = Date.now();
      if (text === last.text && now - last.at < 2000) return;
      last = { text, at: now };
      notifyScanSuccess();
      onDetectRef.current(text);
    };

    (async () => {
      try {
        setError("");
        const { BrowserMultiFormatReader, BrowserCodeReader } = await import("@zxing/browser");

        // Lấy danh sách camera có sẵn
        try {
          const videoInputDevices = await BrowserCodeReader.listVideoInputDevices();
          if (!cancelled && videoInputDevices.length > 0) {
            setDevices(
              videoInputDevices.map((d, idx) => ({
                deviceId: d.deviceId,
                label: d.label || `Camera ${idx + 1}`,
              })),
            );
          }
        } catch {}

        // Thiết lập cấu hình nhận diện mã vạch phổ biến trong bán lẻ
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.CODE_128,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 100,
        });

        const videoEl = videoRef.current;
        if (!videoEl) return;

        // Ưu tiên dùng camera đã chọn, hoặc tự động tìm camera sau (environment)
        if (selectedDeviceId) {
          controls = await reader.decodeFromVideoDevice(
            selectedDeviceId,
            videoEl,
            (result) => {
              if (result) handleBarcodeFound(result.getText());
            },
          );
        } else {
          // Thử gọi với facingMode environment
          try {
            controls = await reader.decodeFromConstraints(
              {
                video: {
                  facingMode: { ideal: "environment" },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              videoEl,
              (result) => {
                if (result) handleBarcodeFound(result.getText());
              },
            );
          } catch {
            // Nếu lỗi constraints, thử mở camera mặc định
            controls = await reader.decodeFromVideoDevice(
              undefined,
              videoEl,
              (result) => {
                if (result) handleBarcodeFound(result.getText());
              },
            );
          }
        }

        if (cancelled) {
          controls.stop();
        }
      } catch (e) {
        if (cancelled) return;
        const errName = e instanceof Error ? e.name : "";
        const errMsg = e instanceof Error ? e.message : String(e);

        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setError("Chưa cấp quyền truy cập Camera. Hãy bấm vào biểu tượng ổ khóa/cài đặt trên trình duyệt để cho phép.");
        } else if (!window.isSecureContext && window.location.hostname !== "localhost") {
          setError(
            "Trình duyệt điện thoại chặn Camera khi truy cập qua IP mạng LAN (chỉ cho phép qua HTTPS hoặc localhost). Bạn hãy dùng nút 'Chụp ảnh để quét' bên dưới hoặc mở qua localhost / Vercel.",
          );
        } else {
          setError(`Lỗi mở camera: ${errMsg || errName}`);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        controls?.stop();
        stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, [selectedDeviceId]);

  // Quét mã từ ảnh chụp/tải lên
  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDecodingPhoto(true);
    setError("");

    try {
      // 1. Thử dùng BarcodeDetector nguyên bản của trình duyệt nếu có
      if ("BarcodeDetector" in window) {
        try {
          const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: unknown) => { detect: (bmp: ImageBitmap) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
          const detector = new BarcodeDetectorClass({
            formats: ["ean_13", "code_128", "ean_8", "upc_a", "upc_e", "code_39", "qr_code"],
          });
          const bitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(bitmap);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            notifyScanSuccess();
            onDetectRef.current(barcodes[0].rawValue);
            setDecodingPhoto(false);
            return;
          }
        } catch {}
      }

      // 2. Dùng ZXing decode ảnh
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      const objectUrl = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(objectUrl);
        if (result) {
          notifyScanSuccess();
          onDetectRef.current(result.getText());
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setError("Không tìm thấy mã vạch trong ảnh chụp. Hãy chụp lại gần và rõ nét hơn.");
    } finally {
      setDecodingPhoto(false);
    }
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {/* Khung ngắm mô phỏng tia laser */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="relative h-36 w-64 rounded-lg border-2 border-primary/70">
            <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="absolute -bottom-6 inset-x-0 text-center text-xs text-white/90 drop-shadow">
              Căn mã vạch vào khung đỏ
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3 text-sm">
        {/* Lựa chọn camera nếu có nhiều camera */}
        {devices.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Đổi Camera:</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-transparent p-1 text-xs"
            >
              <option value="">Tự động (Camera sau)</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {(error || scanError) && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs font-medium text-danger animate-in fade-in duration-200">
            ⚠️ {scanError || error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Nút chụp ảnh quét mã: hoạt động trên mọi điện thoại cả khi không có HTTPS */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={decodingPhoto}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            📷 {decodingPhoto ? "Đang xử lý ảnh..." : "Chụp ảnh quét mã"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            Đóng camera
          </button>
        </div>
      </div>
    </div>
  );
}
