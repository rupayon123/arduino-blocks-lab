export function normalizePackageIndexUrls(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\s,]+/) : [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const value of raw) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Invalid Boards Manager URL: ${trimmed}`);
    }
    if (!["http:", "https:", "file:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported Boards Manager URL protocol: ${parsed.protocol}`);
    }
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

export function extractPackageIndexUrls(config: unknown): string[] {
  const root = config as {
    board_manager?: { additional_urls?: unknown };
    boardManager?: { additionalUrls?: unknown };
  };
  const candidates = root?.board_manager?.additional_urls ?? root?.boardManager?.additionalUrls;
  return normalizePackageIndexUrls(candidates);
}
