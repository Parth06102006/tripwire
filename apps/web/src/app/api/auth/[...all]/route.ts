import { toNextJsHandler } from "better-auth/next-js";

import { authMode, ensureAuthSchema, getAuth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const off = () => Response.json({ detail: "sign-in is switched off" }, { status: 404 });

async function handlers() {
  await ensureAuthSchema();
  return toNextJsHandler(getAuth());
}

export async function GET(request: Request) {
  if (authMode() === "off") return off();
  return (await handlers()).GET(request);
}

export async function POST(request: Request) {
  if (authMode() === "off") return off();
  return (await handlers()).POST(request);
}
