/** Paths that must stay public for people and for Meta’s crawler. Never send these to login. */
export const PUBLIC_LEGAL_PATHS = ["/privacy", "/terms", "/data-deletion"] as const;

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/robots.txt",
] as const;

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}
