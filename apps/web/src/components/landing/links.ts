/** Shared destinations for the landing surface. */

export const REPO_URL = "https://github.com/PriyanshuSingh9/tripwire";
export const REPO_ISSUES_URL = `${REPO_URL}/issues`;

export const WORKBENCH_HREF = "/overview";
export const DEMO_HREF = "/investigation";
export const PERFORMANCE_HREF = "/performance";
export const DOCS_HREF = "/docs";
export const SIGN_IN_HREF = "/login";
/** Google and GitHub create the account on first sign-in, so sign-up is the same page in its own words. */
export const SIGN_UP_HREF = "/login?mode=signup";

export const NAV_LINKS = [{ href: "/docs", label: "Docs" }] as const;
