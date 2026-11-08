"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

function checkConfigError(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env";
  }
  return "";
}

/** Chặn truy cập khi chưa đăng nhập Supabase (email + mật khẩu). */
export default function AuthGate({
  children,
}: {
  children: (signOut: () => void) => React.ReactNode;
}) {
  const [configError] = useState(checkConfigError);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (configError) return;
    const sb = getSupabase();
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [configError]);

  if (configError) return <div className="p-6 text-sm text-danger">{configError}</div>;
  if (!ready) return <div className="p-6 text-sm text-muted">Đang tải...</div>;
  if (!session) return <LoginForm />;
  return <>{children(() => void getSupabase().auth.signOut())}</>;
}

function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) setError("Email hoặc mật khẩu không đúng.");
    } else {
      const { data, error } = await getSupabase().auth.signUp({ email, password });
      if (error) {
        setError(`Đăng ký thất bại: ${error.message}`);
      } else if (data.session) {
        // Tự động đăng nhập nếu không bật confirm email
      } else {
        setSuccess("Đăng ký thành công! Nếu cần xác thực email, hãy kiểm tra hộp thư hoặc vào Supabase xác nhận.");
      }
    }
    setBusy(false);
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">A</span>
            AnMart
          </div>
          <span className="text-xs text-muted">{mode === "login" ? "Đăng nhập" : "Đăng ký"}</span>
        </div>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-primary">{success}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
        <div className="pt-2 text-center text-xs text-muted">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setSuccess("");
              }}
              className="text-primary hover:underline"
            >
              Chưa có tài khoản? Đăng ký tại đây
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
              className="text-primary hover:underline"
            >
              Đã có tài khoản? Đăng nhập
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

