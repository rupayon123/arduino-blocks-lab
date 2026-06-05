import { describe, expect, it } from "vitest";
import { nextThemePreference, parseThemePreference } from "./theme";

describe("theme preferences", () => {
  it("defaults unknown values to light mode", () => {
    expect(parseThemePreference(null)).toBe("light");
    expect(parseThemePreference("")).toBe("light");
    expect(parseThemePreference("system")).toBe("light");
  });

  it("parses dark mode explicitly", () => {
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("toggles between light and dark", () => {
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("light");
  });
});
