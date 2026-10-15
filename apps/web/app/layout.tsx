import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import Providers from "./providers";
import SiteNav from "./components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceAML Analyst Workbench",
  description:
    "TraceAML analyst workbench. Queue, investigation, and benchmark views read from the API.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#0B0B10] text-[#F2F0F8]">
        <header className="border-b border-[#292936] bg-[#12121A]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#B68CFF] font-mono text-sm font-bold text-[#0B0B10]"
              >
                T
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold tracking-wide">
                  TraceAML
                </span>
                <span className="text-xs text-[#9693A8]">
                  Analyst workbench shell
                </span>
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          <Providers>{children}</Providers>
        </div>
        <footer className="border-t border-[#292936]">
          <p className="mx-auto w-full max-w-6xl px-6 py-4 font-mono text-xs text-[#9693A8]">
            TraceAML workbench. Displayed records and metrics come from the API; nothing is invented locally.
          </p>
        </footer>
      </body>
    </html>
  );
}
