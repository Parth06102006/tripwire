import path from "node:path";

import type { NextConfig } from "next";

// The container image sets NEXT_OUTPUT=standalone to emit a self-contained
// server (apps/web/Dockerfile). Local `next start` keeps the default output.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  // A second build can sit beside a running dev server by setting this; unset it is .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(standalone
    ? {
        output: "standalone" as const,
        // pnpm workspace: trace dependencies from the repository root.
        outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
      }
    : {}),
  // The browser calls same-origin /api; Next.js forwards to the FastAPI service,
  // so no CORS is needed. The config is serialized at build time, so the API
  // origin is fixed when the image is built.
  async rewrites() {
    const apiOrigin = process.env.TRACEAML_API_ORIGIN ?? "http://127.0.0.1:8000";
    // /api/auth/* is this app's own sign-in (Better Auth). A rewrite is matched
    // before dynamic routes, so it has to leave those paths alone.
    return [{ source: "/api/:path((?!auth(?:/|$)).*)", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
