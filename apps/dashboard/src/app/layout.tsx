import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadScout",
  description: "LeadScout Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white px-6 py-3 flex items-center gap-6">
          <span className="font-semibold text-gray-900 text-lg">LeadScout</span>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Leads
          </Link>
          <Link href="/pipeline" className="text-sm text-gray-600 hover:text-gray-900">
            Pipeline
          </Link>
          <Link href="/outreach" className="text-sm text-gray-600 hover:text-gray-900">
            Outreach
          </Link>
          <Link href="/inbox" className="text-sm text-gray-600 hover:text-gray-900">
            Inbox
          </Link>
          <Link href="/config" className="text-sm text-gray-600 hover:text-gray-900">
            Config
          </Link>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
