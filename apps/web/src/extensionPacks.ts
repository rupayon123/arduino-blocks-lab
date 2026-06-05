import type { ExtensionManifest } from "@abl/block-schema";
import { parseExtensionManifest } from "@abl/catalog";

export type ImportedExtensionPack = {
  id: string;
  name: string;
  version: string;
  manifest: ExtensionManifest;
};

export function importedPackFromManifest(manifest: ExtensionManifest): ImportedExtensionPack {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    manifest
  };
}

export function parseStoredExtensionPacks(raw: string | null): ImportedExtensionPack[] {
  if (!raw) return [];
  try {
    const manifests = JSON.parse(raw) as unknown[];
    if (!Array.isArray(manifests)) return [];
    return manifests.flatMap((manifest) => {
      const result = parseExtensionManifest(manifest);
      return result.manifest ? [importedPackFromManifest(result.manifest)] : [];
    });
  } catch {
    return [];
  }
}

export function serializeExtensionPacks(packs: ImportedExtensionPack[]): string {
  return JSON.stringify(packs.map((pack) => pack.manifest));
}
