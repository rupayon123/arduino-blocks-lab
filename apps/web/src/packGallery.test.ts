import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePackGallery, resolveGalleryPackUrl } from "./packGallery";

describe("pack gallery", () => {
  it("parses valid gallery entries and ignores malformed rows", () => {
    const entries = parsePackGallery({
      packs: [
        {
          id: "community.soil-moisture",
          name: "Community Soil Moisture Pack",
          description: "Plant sensor lesson.",
          url: "packs/soil-moisture-pack.json",
          tags: ["sensor", "plants"],
          componentCount: 1,
          lessonCount: 1
        },
        { id: "missing-url", name: "Bad", description: "No URL" },
        {
          id: "community.soil-moisture",
          name: "Duplicate",
          description: "Ignored duplicate.",
          url: "packs/duplicate.json"
        }
      ]
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "community.soil-moisture",
      tags: ["sensor", "plants"],
      componentCount: 1,
      lessonCount: 1
    });
  });

  it("resolves relative gallery pack URLs against the app URL", () => {
    const entry = parsePackGallery({
      packs: [
        {
          id: "community.soil-moisture",
          name: "Community Soil Moisture Pack",
          description: "Plant sensor lesson.",
          url: "packs/soil-moisture-pack.json"
        }
      ]
    })[0]!;

    expect(resolveGalleryPackUrl(entry, "https://pisces123.github.io/arduino-blocks-lab/?v=gallery")).toBe(
      "https://pisces123.github.io/arduino-blocks-lab/packs/soil-moisture-pack.json"
    );
  });

  it("parses the bundled public gallery index", () => {
    const index = JSON.parse(readFileSync(new URL("../public/packs/index.json", import.meta.url), "utf8"));
    const entries = parsePackGallery(index);

    expect(entries.map((entry) => entry.id)).toEqual(["community.soil-moisture", "community.classroom-sensors"]);
    expect(entries.find((entry) => entry.id === "community.classroom-sensors")).toMatchObject({
      componentCount: 4,
      lessonCount: 4,
      tags: ["sensor", "classroom", "serial"]
    });
  });
});
