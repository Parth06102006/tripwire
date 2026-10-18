import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OPEN_SHORTCUTS_EVENT } from "@/components/layout/keyboard-shortcuts-modal";
import { renderWithClient, stubApi } from "@/test/render";

import { AccountMenu } from "./account-menu";

const signOut = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: () => signOut() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  signOut.mockClear();
});

const window_ = (limit: number, used: number, resets: number | null) => ({
  limit,
  used,
  remaining: limit - used,
  resets_in_seconds: resets,
});

type Session = "signed-in" | "signed-out" | "off";

/**
 * Stub the API and the web app's own session. By default the session follows
 * the API (signed in when the API checks tokens, off when it does not); pass
 * `session` to make them disagree.
 */
function api(me: { auth: string } & Record<string, unknown>, session?: Session) {
  const state: Session = session ?? (me.auth === "jwt" ? "signed-in" : "off");
  return stubApi((url) => {
    if (url.pathname === "/api/auth/get-session") {
      if (state === "off") return { status: 404, body: { detail: "sign-in is switched off" } };
      return {
        body:
          state === "signed-in"
            ? { user: { id: "u1", email: "ana@example.com", name: "Ana Rao" }, session: {} }
            : null,
      };
    }
    if (url.pathname === "/api/me") return { body: me };
    if (url.pathname === "/api/health") {
      return {
        body: { status: "ok", falkordb: "available", version: "0.1.0", llm: "not_configured" },
      };
    }
    return undefined;
  });
}

const signedIn = (hour: ReturnType<typeof window_>, day: ReturnType<typeof window_>) => ({
  auth: "jwt",
  user: { id: "u1", email: "ana@example.com", name: "Ana Rao" },
  usage: { hour, day },
});

describe("AccountMenu", () => {
  it("offers Sign out to a signed-in user even when the API does not enforce limits", async () => {
    api({ auth: "off", user: null, usage: null }, "signed-in");
    renderWithClient(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: /Account menu, Ana Rao/ });
    expect(await within(trigger).findByText("Signed in")).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(await screen.findByText(/Investigation limits are not enforced/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("shows the user and what is left this hour and today when opened", async () => {
    api(signedIn(window_(10, 3, 1500), window_(20, 8, 40_000)));
    renderWithClient(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: /Account menu, Ana Rao/ });
    expect(within(trigger).getByText("7 left this hour")).toBeInTheDocument();

    await userEvent.click(trigger);
    const hourly = await screen.findByTestId("usage-hourly");
    expect(within(hourly).getByText("7 of 10 left")).toBeInTheDocument();
    expect(within(hourly).getByRole("meter")).toHaveAttribute("aria-valuenow", "7");
    expect(within(hourly).getByText(/Oldest frees up in 25 minutes/)).toBeInTheDocument();

    const daily = screen.getByTestId("usage-daily");
    expect(within(daily).getByText("12 of 20 left")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("says when nothing has been used", async () => {
    api(signedIn(window_(10, 0, null), window_(20, 0, null)));
    renderWithClient(<AccountMenu />);
    await userEvent.click(await screen.findByRole("button", { name: /Account menu/ }));
    expect(
      within(await screen.findByTestId("usage-hourly")).getByText("10 of 10 left"),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("usage-daily")).getByText("Nothing used")).toBeInTheDocument();
  });

  it("explains a reached limit and when the next investigation is allowed", async () => {
    api(signedIn(window_(10, 10, 1380), window_(20, 14, 30_000)));
    renderWithClient(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: /Account menu/ });
    expect(await within(trigger).findByText("Limit reached")).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Limit reached. You can start another in 23 minutes.",
    );
    expect(
      within(screen.getByTestId("usage-hourly")).getByText("0 of 10 left"),
    ).toBeInTheDocument();
  });

  it("asks the API for fresh counts each time it opens", async () => {
    const calls = api(signedIn(window_(10, 1, 100), window_(20, 1, 100)));
    renderWithClient(<AccountMenu />);
    const trigger = await screen.findByRole("button", { name: /Account menu/ });
    const before = calls.filter((c) => c.path === "/api/me").length;
    await userEvent.click(trigger);
    await vi.waitFor(() =>
      expect(calls.filter((c) => c.path === "/api/me").length).toBeGreaterThan(before),
    );
  });

  it("signs out and returns to the sign-in page", async () => {
    api(signedIn(window_(10, 1, 100), window_(20, 1, 100)));
    renderWithClient(<AccountMenu />);
    await userEvent.click(await screen.findByRole("button", { name: /Account menu/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("opens the shortcuts guide through the shared event", async () => {
    api(signedIn(window_(10, 1, 100), window_(20, 1, 100)));
    const heard = vi.fn();
    globalThis.addEventListener(OPEN_SHORTCUTS_EVENT, heard);
    renderWithClient(<AccountMenu />);
    await userEvent.click(await screen.findByRole("button", { name: /Account menu/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Keyboard shortcuts/ }));
    expect(heard).toHaveBeenCalledTimes(1);
    globalThis.removeEventListener(OPEN_SHORTCUTS_EVENT, heard);
  });

  it("shows service status and the data disclaimer", async () => {
    api(signedIn(window_(10, 1, 100), window_(20, 1, 100)));
    renderWithClient(<AccountMenu />);
    await userEvent.click(await screen.findByRole("button", { name: /Account menu/ }));
    expect(await screen.findByText("Available")).toBeInTheDocument();
    expect(screen.getByText(/no payment is ever blocked/)).toBeInTheDocument();
  });

  it("with sign-in off, has no limits and no sign out", async () => {
    api({ auth: "off", user: null, usage: null });
    renderWithClient(<AccountMenu />);
    const trigger = await screen.findByRole("button", { name: /Account menu, Local session/ });
    expect(await within(trigger).findByText("Sign-in off")).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(await screen.findByText(/Sign-in is off on this server/)).toBeInTheDocument();
    expect(screen.queryByText("Investigations left")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
