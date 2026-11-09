"use client";

import { createContext, useContext, useSyncExternalStore, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export type UserRole = "admin" | "staff";

export interface AppUser {
  id: string;
  name: string;
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

  // Xác định user từ snapshot hoặc state cục bộ vừa đăng nhập
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
  const [role, setRole] = useState<UserRole>("staff");
  const [busy, setBusy] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = identifier.trim();
    if (!name) return;

    setBusy(true);

    // Tự động gán quyền admin nếu tên hoặc sđt chứa từ khoá "admin"
    const finalRole: UserRole =
      role === "admin" || name.toLowerCase().includes("admin") ? "admin" : "staff";

    const user: AppUser = {
      id: name,
      name,
      role: finalRole,
    };

    onLogin(user);
    setBusy(false);
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
              Tên đăng nhập / Số điện thoại / Email
            </label>
            <input
              type="text"
              required
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Nhập bất kỳ (SĐT, tên, email...)"
              className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm transition-colors focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Vai trò (Role)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("staff")}
                className={`rounded-xl border py-2 text-xs font-medium transition-all ${
                  role === "staff"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted hover:bg-muted/10"
                }`}
              >
                Nhân viên (Staff)
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`rounded-xl border py-2 text-xs font-medium transition-all ${
                  role === "admin"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted hover:bg-muted/10"
                }`}
              >
                Quản lý (Admin)
              </button>
            </div>
          </div>
        </div>

        <button
          disabled={busy || !identifier.trim()}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy ? "Đang vào..." : "Vào cửa hàng"}
        </button>

        <p className="pt-2 text-center text-[11px] text-muted">
          Đăng nhập trực tiếp, không cần mật khẩu hay mã xác thực
        </p>
      </form>
    </div>
  );
}
