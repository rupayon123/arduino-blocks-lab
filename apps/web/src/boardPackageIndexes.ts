export type BoardPackageIndexPreset = {
  id: string;
  label: string;
  maker: string;
  detail: string;
  url: string;
  cores: string[];
  keywords: string[];
};

export const boardPackageIndexPresets: BoardPackageIndexPreset[] = [
  {
    id: "esp32",
    label: "ESP32",
    maker: "Espressif",
    detail: "DevKit, S3, C3, WROOM, and many classroom Wi-Fi boards.",
    url: "https://espressif.github.io/arduino-esp32/package_esp32_index.json",
    cores: ["esp32:esp32"],
    keywords: ["esp32", "esp32s3", "esp32-c3", "wroom", "devkit", "wifi"]
  },
  {
    id: "esp8266",
    label: "ESP8266",
    maker: "ESP8266 Community",
    detail: "NodeMCU, D1 mini, and classic low-cost Wi-Fi boards.",
    url: "https://arduino.esp8266.com/stable/package_esp8266com_index.json",
    cores: ["esp8266:esp8266"],
    keywords: ["esp8266", "nodemcu", "d1", "mini", "wifi"]
  },
  {
    id: "rp2040",
    label: "RP2040 / Pico",
    maker: "Arduino-Pico",
    detail: "Raspberry Pi Pico, Pico W, and many RP2040 boards.",
    url: "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json",
    cores: ["rp2040:rp2040"],
    keywords: ["rp2040", "pico", "pico w", "raspberry", "2040"]
  },
  {
    id: "adafruit",
    label: "Adafruit",
    maker: "Adafruit",
    detail: "Feather, ItsyBitsy, Circuit Playground, nRF52, SAMD, and RP2040 boards.",
    url: "https://adafruit.github.io/arduino-board-index/package_adafruit_index.json",
    cores: ["adafruit:samd", "adafruit:nrf52", "adafruit:rp2040"],
    keywords: ["adafruit", "feather", "itsybitsy", "circuit playground", "nrf52", "samd"]
  }
];

export function parsePackageIndexInput(value: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const part of value.split(/[\s,]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      continue;
    }
    if (!["http:", "https:", "file:"].includes(parsed.protocol)) continue;
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

export function packageIndexPresetForCore(core: string) {
  return boardPackageIndexPresets.find((preset) => preset.cores.includes(core));
}

export function searchPackageIndexPresets(query: string, core: string, limit = 3) {
  const normalizedQuery = query.trim().toLowerCase();
  const scored = boardPackageIndexPresets
    .map((preset) => {
      let score = 0;
      if (preset.cores.includes(core)) score += 8;
      if (normalizedQuery) {
        const haystack = [preset.label, preset.maker, preset.detail, preset.url, ...preset.keywords].join(" ").toLowerCase();
        if (haystack.includes(normalizedQuery)) score += 4;
        score += preset.keywords.filter((keyword) => normalizedQuery.includes(keyword)).length;
      }
      return { preset, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.preset.label.localeCompare(b.preset.label));

  return scored.slice(0, limit).map((item) => item.preset);
}
