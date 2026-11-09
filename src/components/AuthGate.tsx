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

/** Chặn truy cập khi chưa đăng nhập Supabase. */
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
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const account = identifier.trim();
    if (!account) {
      setError("Vui lòng nhập số điện thoại hoặc email.");
      setBusy(false);
      return;
    }

    const sb = getSupabase();

    // 1. Nếu có @, đăng nhập bằng email trực tiếp
    if (account.includes("@")) {
      const { error: err } = await sb.auth.signInWithPassword({ email: account, password });
      if (err) {
        setError("Email hoặc mật khẩu không đúng.");
      }
      setBusy(false);
      return;
    }

    // 2. Nếu là số điện thoại hoặc username, thử tìm email qua RPC get_login_email
    try {
      const { data: foundEmail } = await sb.rpc("get_login_email", { identifier: account });
      if (foundEmail) {
        const { error: errFound } = await sb.auth.signInWithPassword({
          email: foundEmail,
          password,
        });
        if (!errFound) {
          setBusy(false);
          return;
        }
      }
    } catch {}

    // 3. Thử đăng nhập quy ước số điện thoại dạng @anmart.vn
    const cleanPhone = account.replace(/[^0-9]/g, "");
    if (cleanPhone) {
      const { error: errEmail } = await sb.auth.signInWithPassword({
        email: `${cleanPhone}@anmart.vn`,
        password,
      });
      if (!errEmail) {
        setBusy(false);
        return;
      }

      // 4. Thử đăng nhập chuẩn số điện thoại Supabase Auth (E.164: +84...)
      let phoneE164 = cleanPhone;
      if (phoneE164.startsWith("0")) {
        phoneE164 = "+84" + phoneE164.slice(1);
      } else if (!phoneE164.startsWith("+")) {
        phoneE164 = "+84" + phoneE164;
      }

      const { error: errPhone } = await sb.auth.signInWithPassword({
        phone: phoneE164,
        password,
      });
      if (!errPhone) {
        setBusy(false);
        return;
      }
    }

    setError("Số điện thoại/Email hoặc mật khẩu không đúng.");
    setBusy(false);
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-7 shadow-lg"
      >
        <div className="mb-2 text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            A
          </div>
          <h1 className="text-xl font-bold text-foreground">AnMart</h1>
          <p className="text-xs text-muted">Đăng nhập tài khoản cửa hàng</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Số điện thoại hoặc Email
            </label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="VD: 0912345678 hoặc admin@gmail.com"
              className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 p-2.5 text-xs font-medium text-danger">
            ⚠️ {error}
          </div>
        )}

        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>

        <p className="pt-2 text-center text-xs text-muted">
          Tài khoản nhân viên được cấp bởi quản trị viên cửa hàng
        </p>
      </form>
    </div>
  );
}
