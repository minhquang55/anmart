"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type UserRole = "admin" | "staff";

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "staff",
  isAdmin: false,
  signOut: () => {},
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

function checkConfigError(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env";
  }
  return "";
}

/** Xác định role từ user metadata hoặc bảng profiles trong DB */
async function resolveRole(user: User): Promise<UserRole> {
  // 1. Kiểm tra metadata trực tiếp từ Supabase Auth (nếu admin set trong Auth)
  const metaRole = (user.app_metadata?.role || user.user_metadata?.role)?.toLowerCase();
  if (metaRole === "admin") return "admin";

  // 2. Thử truy vấn bảng public.profiles trong database
  try {
    const sb = getSupabase();
    // Tự động đảm bảo user có bản ghi trong profiles
    await sb
      .from("profiles")
      .upsert({ id: user.id, email: user.email }, { onConflict: "id", ignoreDuplicates: true });

    const { data } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (data?.role?.toLowerCase() === "admin") {
      return "admin";
    }
  } catch {}

  return "staff";
}

/** Chặn truy cập khi chưa đăng nhập Supabase (email + mật khẩu). */
export default function AuthGate({
  children,
}: {
  children: React.ReactNode | ((signOut: () => void) => React.ReactNode);
}) {
  const [configError] = useState(checkConfigError);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>("staff");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (configError) return;
    const sb = getSupabase();

    async function handleSession(s: Session | null) {
      setSession(s);
      if (s?.user) {
        const r = await resolveRole(s.user);
        setRole(r);
      } else {
        setRole("staff");
      }
      setReady(true);
    }

    void sb.auth.getSession().then(({ data }) => {
      void handleSession(data.session);
    });

    const { data } = sb.auth.onAuthStateChange((_e, s) => {
      void handleSession(s);
    });

    return () => data.subscription.unsubscribe();
  }, [configError]);

  if (configError) return <div className="p-6 text-sm text-danger">{configError}</div>;
  if (!ready) return <div className="p-6 text-sm text-muted">Đang tải...</div>;
  if (!session) return <LoginForm />;

  const signOut = () => void getSupabase().auth.signOut();

  return (
    <AuthContext.Provider
      value={{
        user: session.user,
        role,
        isAdmin: role === "admin",
        signOut,
      }}
    >
      {typeof children === "function" ? children(signOut) : children}
    </AuthContext.Provider>
  );
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
        // Tự động đăng nhập
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
