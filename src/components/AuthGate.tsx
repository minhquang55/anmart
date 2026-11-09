"use client";

import { createContext, useContext, useSyncExternalStore, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export type UserRole = "admin" | "staff";

export interface AppUser {
  id: string;
  name: string;
  displayName: string;
  role: UserRole;
}

export interface AuthContextType {
  user: AppUser | null;
  role: UserRole;
  isAdmin: boolean;
  signOut: () => void;
}

const AUTH_STORAGE_KEY = "anmart.auth.session";

export const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "staff",
  isAdmin: false,
  signOut: () => {},
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredSnapshot(): string {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

/** Chặn truy cập khi chưa đăng nhập. */
export default function AuthGate({
  children,
}: {
  children: React.ReactNode | ((signOut: () => void) => React.ReactNode);
}) {
  const snapshot = useSyncExternalStore(subscribe, getStoredSnapshot, getServerSnapshot);
  const [localUser, setLocalUser] = useState<AppUser | null>(null);

  let currentUser: AppUser | null = localUser;
  if (!currentUser && snapshot) {
    try {
      const parsed = JSON.parse(snapshot) as AppUser;
      if (parsed?.name) currentUser = parsed;
    } catch {}
  }

  const handleLogin = (user: AppUser) => {
    setLocalUser(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch {}
  };

  const signOut = () => {
    setLocalUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    try {
      void getSupabase().auth.signOut();
    } catch {}
  };

  if (!currentUser) return <LoginForm onLogin={handleLogin} />;

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        role: currentUser.role,
        isAdmin: currentUser.role === "admin",
        signOut,
      }}
    >
      {typeof children === "function" ? children(signOut) : children}
    </AuthContext.Provider>
  );
}

function LoginForm({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const account = identifier.trim();
    if (!account || !password) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }

    setBusy(true);
    const sb = getSupabase();

    try {
      // 1. Thử xác thực qua bảng staff_accounts (hỗ trợ text tự do, sđt, email)
      const { data, error: rpcErr } = await sb.rpc("verify_staff_login", {
        p_username: account,
        p_password: password,
      });

      if (!rpcErr && data) {
        const res = data as { username: string; role: string; display_name: string };
        onLogin({
          id: res.username,
          name: res.username,
          displayName: res.display_name || res.username,
          role: res.role === "admin" ? "admin" : "staff",
        });
        setBusy(false);
        return;
      }

      // 2. Fallback thử qua Supabase Auth truyền thống (nếu tài khoản dạng email có sẵn trong auth.users)
      const emailToTry = account.includes("@") ? account : `${account.replace(/[^0-9]/g, "")}@anmart.vn`;
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
        email: emailToTry,
        password,
      });

      if (!authErr && authData.user) {
        // Lấy role từ metadata
        const userMeta = authData.user.user_metadata || {};
        const isAdmin = userMeta.role === "admin" || account.toLowerCase().includes("admin");
        onLogin({
          id: authData.user.id,
          name: account,
          displayName: account,
          role: isAdmin ? "admin" : "staff",
        });
        setBusy(false);
        return;
      }

      setError("Tài khoản hoặc mật khẩu không chính xác.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi đăng nhập: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4 bg-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-7 shadow-lg"
      >
        <div className="mb-2 text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            A
          </div>
          <h1 className="text-xl font-bold text-foreground">AnMart</h1>
          <p className="text-xs text-muted">Đăng nhập tài khoản</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Tên tài khoản (SĐT / Chữ / Email)
            </label>
            <input
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="VD: admin, 0912345678, user1..."
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
          disabled={busy || !identifier.trim() || !password}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>

        <p className="pt-2 text-center text-[11px] text-muted">
          Tài khoản do quản trị viên cấp qua hệ thống database
        </p>
      </form>
    </div>
  );
}
