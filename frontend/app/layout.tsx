import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/contexts/AuthContext";
import AppShell from "@/components/AppShell";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Campaign Manager",
  description: "AI-powered D&D campaign manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body className="bg-stone-950 text-stone-100 min-h-screen font-sans">
        <ToastProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
