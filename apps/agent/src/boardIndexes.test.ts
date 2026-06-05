import { describe, expect, it } from "vitest";
import { extractPackageIndexUrls, normalizePackageIndexUrls } from "./boardIndexes";

describe("normalizePackageIndexUrls", () => {
  it("normalizes comma, newline, and array URL input", () => {
    expect(
      normalizePackageIndexUrls([
        " https://espressif.github.io/arduino-esp32/package_esp32_index.json ",
        "https://espressif.github.io/arduino-esp32/package_esp32_index.json"
      ])
    ).toEqual(["https://espressif.github.io/arduino-esp32/package_esp32_index.json"]);

    expect(normalizePackageIndexUrls("https://example.com/one.json,\nfile:///tmp/two.json")).toEqual([
      "https://example.com/one.json",
      "file:///tmp/two.json"
    ]);
  });

  it("rejects unsupported URL protocols", () => {
    expect(() => normalizePackageIndexUrls("javascript:alert(1)")).toThrow("Unsupported Boards Manager URL protocol");
  });
});

describe("extractPackageIndexUrls", () => {
  it("reads Arduino CLI snake_case config output", () => {
    expect(
      extractPackageIndexUrls({
        board_manager: {
          additional_urls: ["https://arduino.esp8266.com/stable/package_esp8266com_index.json"]
        }
      })
    ).toEqual(["https://arduino.esp8266.com/stable/package_esp8266com_index.json"]);
  });

  it("reads camelCase config output if a future CLI returns it", () => {
    expect(
      extractPackageIndexUrls({
        boardManager: {
          additionalUrls: ["https://adafruit.github.io/arduino-board-index/package_adafruit_index.json"]
        }
      })
    ).toEqual(["https://adafruit.github.io/arduino-board-index/package_adafruit_index.json"]);
  });
});
