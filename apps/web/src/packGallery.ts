import { normalizePackUrl } from "./packUrls";

export type PackGalleryEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  tags: string[];
  componentCount?: number;
  lessonCount?: number;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : [])) : [];
}

function asCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseEntry(value: unknown): PackGalleryEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const id = asString(item.id);
  const name = asString(item.name);
  const description = asString(item.description);
  const url = asString(item.url);
  if (!id || !name || !description || !url) return undefined;

  return {
    id,
    name,
    description,
    url,
    tags: asStringArray(item.tags),
    ...(asCount(item.componentCount) !== undefined ? { componentCount: asCount(item.componentCount) } : {}),
    ...(asCount(item.lessonCount) !== undefined ? { lessonCount: asCount(item.lessonCount) } : {})
  };
}

export function parsePackGallery(data: unknown): PackGalleryEntry[] {
  if (!data || typeof data !== "object") return [];
  const root = data as { packs?: unknown };
  if (!Array.isArray(root.packs)) return [];

  const seen = new Set<string>();
  return root.packs.flatMap((entry) => {
    const parsed = parseEntry(entry);
    if (!parsed || seen.has(parsed.id)) return [];
    seen.add(parsed.id);
    return [parsed];
  });
}

export function resolveGalleryPackUrl(entry: PackGalleryEntry, baseUrl: string): string {
  return normalizePackUrl(entry.url, baseUrl);
}
