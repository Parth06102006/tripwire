# Multi-stage image for the Tripwire web app (Next.js standalone server).
#
# Build from the repository root (pnpm workspace):
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg TRACEAML_API_ORIGIN=http://api:8000 -t traceaml-web .
#
# TRACEAML_API_ORIGIN is baked into the /api rewrite at build time, because
# Next.js serializes next.config during `next build`. It is the API address as
# seen from this container, not from the browser.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS builder
WORKDIR /src
ARG TRACEAML_API_ORIGIN=http://api:8000
ENV TRACEAML_API_ORIGIN=$TRACEAML_API_ORIGIN \
    NEXT_OUTPUT=standalone

# Dependency layer: workspace and lock files only, so source edits reuse it.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web...

COPY apps/web apps/web
RUN pnpm --dir apps/web build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN useradd --uid 1001 --create-home webuser
# Sign-in accounts and sessions (a volume in compose). Created here so the volume
# is initialised with the right owner.
RUN mkdir -p /app/data/auth && chown -R webuser:webuser /app/data

# The standalone tree mirrors the workspace; static assets are copied beside it.
COPY --from=builder --chown=webuser:webuser /src/apps/web/.next/standalone ./
COPY --from=builder --chown=webuser:webuser /src/apps/web/.next/static ./apps/web/.next/static

USER webuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
