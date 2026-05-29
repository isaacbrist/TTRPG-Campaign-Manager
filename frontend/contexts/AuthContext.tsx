"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { loginApi, registerApi, setAuthToken, setSessionExpiredToast, type AuthUser } from "@/lib/api";
import { useToast } from "@/components/Toast";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Decode the JWT payload and return the `exp` Unix timestamp, or null on failure. */
function getTokenExpiry(token: string): number | null {
  try {
    // JWT uses base64url (no padding, - and _ instead of + and /).
    // atob() requires standard base64 with padding, so convert and pad.
    const base64url = token.split(".")[1];
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  // Keep api.ts in sync whenever the token changes
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Register the toast callback in api.ts so the 401 handler can use it
  useEffect(() => {
    setSessionExpiredToast((msg) => toast.error(msg));
  }, [toast]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Keep stable refs so the auto-logout timer always uses the latest values
  // without needing them in its dependency array.
  const toastRef = useRef(toast);
  const logoutRef = useRef(logout);
  const routerRef = useRef(router);
  toastRef.current = toast;
  logoutRef.current = logout;
  routerRef.current = router;

  // Schedule auto-logout slightly before the JWT expires.
  // Cleans up the previous timer whenever the token changes.
  useEffect(() => {
    if (!token) return;

    const exp = getTokenExpiry(token);
    if (exp === null) return;

    const msUntilWarning = exp * 1000 - Date.now() - 60_000; // 1 min before expiry

    const doExpire = () => {
      toastRef.current.error("Your session expired. Please sign in again.");
      logoutRef.current();
      routerRef.current.replace("/login");
    };

    if (msUntilWarning <= 0) {
      // Token is already expired (or inside the 1-min window) — log out now
      doExpire();
      return;
    }

    const timerId = setTimeout(doExpire, msUntilWarning);
    return () => clearTimeout(timerId);
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);

    // Defensive: reject a token that's already expired before setting it
    const exp = getTokenExpiry(data.token);
    if (exp !== null && exp * 1000 <= Date.now()) {
      throw new Error("Received an already-expired token from the server.");
    }

    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await registerApi(email, password);

    const exp = getTokenExpiry(data.token);
    if (exp !== null && exp * 1000 <= Date.now()) {
      throw new Error("Received an already-expired token from the server.");
    }

    setToken(data.token);
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
