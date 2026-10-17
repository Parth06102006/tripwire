import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "./components/shell/app-shell";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceAML Obsidian Graph Console",
  description:
    "Graph-based fraud investigation workstation. Alerts, cases, graph evidence, benchmarks and system diagnostics read from the TraceAML API.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-canvas text-ink">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
