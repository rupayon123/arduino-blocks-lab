import { describe, expect, it } from "vitest";
import type { ExtensionManifest } from "@abl/block-schema";
import { importedPackFromManifest, parseStoredExtensionPacks, serializeExtensionPacks } from "./extensionPacks";

const manifest: ExtensionManifest = {
  formatVersion: "1.0.0",
  id: "community.test",
  name: "Community Test",
  version: "0.1.0",
  components: [
    {
      id: "test-sensor",
      name: "Test Sensor",
      category: "sensor",
      description: "Analog test sensor.",
      defaultPins: { signal: "A2" },
      pinLabels: { signal: "Analog pin" },
      wiring: [{ label: "Signal", from: "OUT", to: "{{pins.signal}}" }]
    }
  ]
};

describe("extension pack storage", () => {
  it("round-trips valid pack manifests", () => {
    const saved = serializeExtensionPacks([importedPackFromManifest(manifest)]);
    const loaded = parseStoredExtensionPacks(saved);

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("community.test");
    expect(loaded[0]?.manifest.components?.[0]?.id).toBe("test-sensor");
  });

  it("drops invalid or corrupted stored packs", () => {
    expect(parseStoredExtensionPacks("{nope")).toEqual([]);
    expect(parseStoredExtensionPacks(JSON.stringify([{ formatVersion: "2.0.0" }, manifest]))).toHaveLength(1);
  });
});
