import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalog, mergeExtensionManifest, parseExtensionManifest } from "../src";

const soilPack = {
  formatVersion: "1.0.0",
  id: "community.soil",
  name: "Community Soil Pack",
  version: "0.1.0",
  components: [
    {
      id: "soil-moisture",
      name: "Soil Moisture Sensor",
      category: "sensor",
      description: "Analog capacitive soil moisture probe.",
      defaultPins: { signal: "A1", power: "5V", ground: "GND" },
      pinLabels: { signal: "Analog pin", power: "5V", ground: "GND" },
      wiring: [
        { label: "Signal", from: "AOUT", to: "{{pins.signal}}" },
        { label: "Power", from: "VCC", to: "5V" },
        { label: "Ground", from: "GND", to: "GND" }
      ],
      runtime: {
        setup: ["pinMode({{pins.signal}}, INPUT);"]
      }
    }
  ]
};

describe("extension manifests", () => {
  it("parses and merges a component pack", () => {
    const parsed = parseExtensionManifest(soilPack);

    expect(parsed.errors).toEqual([]);
    expect(parsed.manifest?.components?.[0]?.id).toBe("soil-moisture");

    const merged = mergeExtensionManifest(catalog, parsed.manifest!);
    expect(merged.catalog.components.some((component) => component.id === "soil-moisture")).toBe(true);
    expect(merged.warnings).toEqual([]);
  });

  it("rejects malformed packs with useful errors", () => {
    const parsed = parseExtensionManifest({ formatVersion: "2.0.0", id: "Bad Pack", name: "", version: "" });

    expect(parsed.manifest).toBeUndefined();
    expect(parsed.errors).toEqual(
      expect.arrayContaining(["formatVersion must be 1.0.0.", "id must use lowercase pack id syntax.", "name is required.", "version is required."])
    );
  });

  it("warns when a pack replaces an existing definition", () => {
    const parsed = parseExtensionManifest({
      ...soilPack,
      components: [{ ...soilPack.components[0], id: "led", name: "Custom LED" }]
    });

    const merged = mergeExtensionManifest(catalog, parsed.manifest!);
    expect(merged.catalog.components.find((component) => component.id === "led")?.name).toBe("Custom LED");
    expect(merged.warnings).toEqual(["Component led replaced an existing definition."]);
  });

  it("accepts the public soil moisture example pack", () => {
    const sample = JSON.parse(readFileSync(new URL("../../../examples/extensions/soil-moisture-pack.json", import.meta.url), "utf8"));
    const parsed = parseExtensionManifest(sample);

    expect(parsed.errors).toEqual([]);
    expect(parsed.manifest?.components?.[0]?.id).toBe("soil-moisture");
    expect(parsed.manifest?.lessons?.[0]?.starterProject.name).toBe("Soil Monitor");
    expect(parsed.manifest?.lessons?.[0]?.steps?.[0]?.action).toBe("wire");
    expect(parsed.manifest?.lessons?.[0]?.success?.[0]).toContain("Serial values");
  });

  it("accepts the public classroom sensor example pack", () => {
    const sample = JSON.parse(readFileSync(new URL("../../../examples/extensions/classroom-sensors-pack.json", import.meta.url), "utf8"));
    const parsed = parseExtensionManifest(sample);

    expect(parsed.errors).toEqual([]);
    expect(parsed.manifest?.components?.map((component) => component.id)).toEqual([
      "water-level-sensor",
      "sound-level-sensor",
      "line-tracking-sensor",
      "tilt-switch"
    ]);
    expect(parsed.manifest?.lessons).toHaveLength(4);

    const merged = mergeExtensionManifest(catalog, parsed.manifest!);
    expect(merged.warnings).toEqual([]);
    expect(merged.catalog.lessons.some((lesson) => lesson.id === "lesson-line-tracker")).toBe(true);
  });

  it("rejects invalid guided lesson steps", () => {
    const parsed = parseExtensionManifest({
      ...soilPack,
      lessons: [
        {
          id: "lesson-bad",
          title: "Bad Lesson",
          level: "word",
          goal: "Break parsing.",
          steps: [{ title: "Do it", detail: "Invalid action.", action: "dance" }],
          starterProject: {
            schemaVersion: "1.0.0",
            name: "Bad",
            boardId: "arduino-uno",
            components: [],
            program: []
          }
        }
      ]
    });

    expect(parsed.manifest).toBeUndefined();
    expect(parsed.errors).toEqual(["lessons[0] is missing required lesson or starter project fields."]);
  });
});
