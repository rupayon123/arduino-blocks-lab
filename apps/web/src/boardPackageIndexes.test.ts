import { describe, expect, it } from "vitest";
import { packageIndexPresetForCore, parsePackageIndexInput, searchPackageIndexPresets } from "./boardPackageIndexes";

describe("parsePackageIndexInput", () => {
  it("extracts valid Boards Manager URLs from pasted text", () => {
    expect(
      parsePackageIndexInput(
        "https://espressif.github.io/arduino-esp32/package_esp32_index.json,\nhttps://espressif.github.io/arduino-esp32/package_esp32_index.json file:///tmp/package.json"
      )
    ).toEqual(["https://espressif.github.io/arduino-esp32/package_esp32_index.json", "file:///tmp/package.json"]);
  });

  it("ignores unsupported or incomplete values", () => {
    expect(parsePackageIndexInput("esp32 javascript:alert(1) https://example.com/package.json")).toEqual(["https://example.com/package.json"]);
  });
});

describe("packageIndexPresetForCore", () => {
  it("finds a one-click preset for ESP32 boards", () => {
    expect(packageIndexPresetForCore("esp32:esp32")?.id).toBe("esp32");
  });

  it("does not require a preset for the built-in Arduino AVR core", () => {
    expect(packageIndexPresetForCore("arduino:avr")).toBeUndefined();
  });
});

describe("searchPackageIndexPresets", () => {
  it("suggests matching board families from board search text", () => {
    expect(searchPackageIndexPresets("pico w", "", 2).map((preset) => preset.id)).toContain("rp2040");
  });

  it("prioritizes the selected core over broad search text", () => {
    expect(searchPackageIndexPresets("wifi", "esp8266:esp8266", 1)[0]?.id).toBe("esp8266");
  });
});
