export type ThemePreference = "light" | "dark";

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "dark" ? "dark" : "light";
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return current === "dark" ? "light" : "dark";
}
