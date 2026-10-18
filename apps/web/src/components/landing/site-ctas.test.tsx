import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithClient } from "@/test/render";

import Hero from "./hero";
import SiteHeader from "./site-header";

const DEMO_VIDEO_URL = "https://youtu.be/EI_i-Osb0kg";

const signOut = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: () => signOut() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  signOut.mockClear();
});

/** Answer the session check the way Better Auth's route handler does. */
function session(state: "signed-out" | "signed-in" | "off") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (!String(input).includes("/api/auth/get-session")) {
        return new Response("{}", { status: 599 });
      }
      if (state === "off") {
        return new Response('{"detail":"sign-in is switched off"}', { status: 404 });
      }
      const body =
        state === "signed-in"
          ? { user: { id: "u1", name: "Ana", email: "ana@example.com" }, session: { id: "s1" } }
          : null;
      return Response.json(body);
    }),
  );
}

const header = () => screen.getByRole("banner");

describe("landing header", () => {
  it("links only to Docs in the middle", async () => {
    session("signed-out");
    renderWithClient(<SiteHeader />);
    const sections = within(header()).getAllByRole("navigation", { name: "Sections" });
    for (const nav of sections) {
      const links = within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent);
      expect(links.filter((text) => text !== "Sign in")).toEqual(["Docs"]);
    }
    for (const gone of ["Product", "How it works", "Typologies", "Benchmarks"]) {
      expect(within(header()).queryByRole("link", { name: gone })).toBeNull();
    }
  });

  it("offers Sign in, Sign up and View Demo to a visitor who is signed out", async () => {
    session("signed-out");
    renderWithClient(<SiteHeader />);
    expect(await within(header()).findAllByRole("link", { name: "Sign in" })).not.toHaveLength(0);
    expect(within(header()).getAllByRole("link", { name: "Sign up" })[0]).toHaveAttribute(
      "href",
      "/login?mode=signup",
    );
    const demoLinks = within(header()).getAllByRole("link", { name: /View Demo/ });
    expect(demoLinks.length).toBeGreaterThan(0);
    for (const link of demoLinks) {
      expect(link).toHaveAttribute("href", DEMO_VIDEO_URL);
    }
    expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull();
    expect(screen.queryByText(/Contact us/)).toBeNull();
  });

  it("gives a signed-in visitor a way to sign out, and no workbench button", async () => {
    session("signed-in");
    renderWithClient(<SiteHeader />);
    const out = await within(header()).findAllByRole("button", { name: /Sign out/ });
    expect(within(header()).queryByRole("link", { name: "Open the workbench" })).toBeNull();
    expect(within(header()).queryByRole("link", { name: "Sign up" })).toBeNull();

    await userEvent.click(out[0]!);
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it("with sign-in off, has no sign-in buttons, no sign out and no workbench button", async () => {
    session("off");
    renderWithClient(<SiteHeader />);
    await vi.waitFor(() =>
      expect(within(header()).queryByRole("link", { name: "Sign in" })).toBeNull(),
    );
    expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open the workbench" })).toBeNull();
    expect(within(header()).getAllByRole("link", { name: /View Demo/ }).length).toBeGreaterThan(0);
  });
});

describe("hero", () => {
  it("has one way in: Get started, to the sign-in page", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: /Get started/ })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: /View Demo/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Open the workbench" })).toBeNull();
    expect(screen.queryByText(/Contact us/)).toBeNull();
  });

  it("keeps the line under the headline short", () => {
    render(<Hero />);
    const line = screen.getByText(/Trace suspicious money through the graph/);
    expect(line.textContent?.split(/\s+/).length).toBeLessThanOrEqual(15);
  });
});
