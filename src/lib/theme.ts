import { cookies } from "next/headers";

export const THEME_COOKIE = "spotted_theme";

export type Theme = "light" | "dark";

export async function getTheme(): Promise<Theme> {
  const jar = await cookies();
  return jar.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}
