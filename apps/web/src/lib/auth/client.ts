"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Same-origin: the sign-in routes are served by this Next.js app. */
export const authClient = createAuthClient({ plugins: [jwtClient()] });
