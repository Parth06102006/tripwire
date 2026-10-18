import path from "node:path";

import type { NextConfig } from "next";

// The container image sets NEXT_OUTPUT=standalone to emit a self-contained
// server (apps/web/Dockerfile). Local `next start` keeps the default output.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
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
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
