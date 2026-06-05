import { describe, expect, it } from "vitest";
import { normalizePackUrl } from "./packUrls";

describe("normalizePackUrl", () => {
  it("keeps raw http and https JSON URLs fetchable", () => {
    expect(normalizePackUrl("https://example.com/sensors/soil.json")).toBe("https://example.com/sensors/soil.json");
    expect(normalizePackUrl("http://localhost:4173/packs/test.json")).toBe("http://localhost:4173/packs/test.json");
  });

  it("turns GitHub blob links into raw GitHub content URLs", () => {
    expect(
      normalizePackUrl("https://github.com/pisces123/arduino-blocks-lab/blob/main/examples/extensions/soil-moisture-pack.json")
    ).toBe("https://raw.githubusercontent.com/pisces123/arduino-blocks-lab/main/examples/extensions/soil-moisture-pack.json");
  });

  it("accepts common GitHub URLs without a typed scheme", () => {
    expect(normalizePackUrl("github.com/pisces123/arduino-blocks-lab/blob/main/examples/extensions/soil-moisture-pack.json")).toBe(
      "https://raw.githubusercontent.com/pisces123/arduino-blocks-lab/main/examples/extensions/soil-moisture-pack.json"
    );
  });

  it("resolves same-origin public pack URLs against the current app", () => {
    expect(normalizePackUrl("packs/soil-moisture-pack.json", "https://pisces123.github.io/arduino-blocks-lab/?v=test")).toBe(
      "https://pisces123.github.io/arduino-blocks-lab/packs/soil-moisture-pack.json"
    );
  });

  it("rejects non-web protocols", () => {
    expect(() => normalizePackUrl("file:///tmp/pack.json")).toThrow("http or https");
  });
});
