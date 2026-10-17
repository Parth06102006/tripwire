import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

// Self-hosted from npm so builds never depend on reaching a font CDN.
const sans = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "TraceAML", template: "%s | TraceAML" },
  description: "Graph-backed AML alert investigation over a synthetic IBM AMLworld replay.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (dark-mode tools, for example) add attributes to
    // <html> before React hydrates. This silences that one element only.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
