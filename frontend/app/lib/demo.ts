/** YC / investor demo: browse deals & map without signing in. Ordering uses /onboard. */

export const DEMO_BROWSE_KEY = "infrastreet_demo";

export function setDemoBrowse(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_BROWSE_KEY, "1");
}

export function isDemoBrowse(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_BROWSE_KEY) === "1";
}
