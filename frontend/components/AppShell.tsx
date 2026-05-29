"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";

// Public routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!token && !isPublicPath) {
      router.replace("/login");
    }
    if (token && isPublicPath) {
      router.replace("/");
    }
  }, [token, isPublicPath, router]);

  // On public pages (/login, /register), render without the nav shell
  if (isPublicPath) {
    return <>{children}</>;
  }

  // While redirecting (no token, not yet on login page), show nothing to avoid flash
  if (!token) {
    return null;
  }

  return (
    <>
      {/* Skip-to-content link — visually hidden until focused */}
      <a
        href="#main-content"
        className="fixed top-0 left-0 -translate-y-full focus:translate-y-0 z-[9999] bg-amber-600 text-stone-950 font-semibold px-4 py-3 rounded-br-lg transition-transform duration-150 shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Sticky nav */}
      <header className="sticky top-0 z-40 border-b border-stone-800/80 bg-stone-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-amber-500 text-lg leading-none" aria-hidden="true">⚔</span>
            <span className="font-cinzel text-amber-400 font-semibold tracking-wide text-lg group-hover:text-amber-300 transition-colors">
              Campaign Manager
            </span>
          </Link>

          {/* User info + logout */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-stone-500 text-sm hidden sm:block truncate max-w-[200px]">
                {user.email}
              </span>
              <button
                onClick={() => { toast.success("Signed out."); logout(); router.replace("/login"); }}
                className="text-stone-400 hover:text-stone-200 text-xs px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-800 hover:border-stone-700"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Page content */}
      <main id="main-content" className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
