import type { ProjectDocument } from "@abl/block-schema";
import { parseStoredProject, serializeProject } from "./projectStorage";

export const projectShareHashPrefix = "#project=";

type BufferLike = {
  from(value: string | Uint8Array, encoding?: BufferEncoding): {
    toString(encoding?: BufferEncoding): string;
  };
};

type BufferEncoding = "utf8" | "base64";

function bytesToBinary(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return binary;
}

function binaryToBytes(binary: string) {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bufferFallback() {
  return (globalThis as typeof globalThis & { Buffer?: BufferLike }).Buffer;
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  const base64 =
    typeof btoa === "function"
      ? btoa(bytesToBinary(bytes))
      : bufferFallback()?.from(bytes).toString("base64");
  if (!base64) throw new Error("Base64 encoding is unavailable.");
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return new TextDecoder().decode(binaryToBytes(atob(padded)));
  }
  const decoded = bufferFallback()?.from(padded, "base64").toString("utf8");
  if (decoded === undefined) throw new Error("Base64 decoding is unavailable.");
  return decoded;
}

export function projectToShareHash(project: ProjectDocument) {
  return `${projectShareHashPrefix}${encodeBase64Url(serializeProject(project))}`;
}

export function projectFromShareHash(hash: string): ProjectDocument | undefined {
  if (!hash.startsWith(projectShareHashPrefix)) return undefined;
  try {
    return parseStoredProject(decodeBase64Url(hash.slice(projectShareHashPrefix.length)));
  } catch {
    return undefined;
  }
}

export function shareUrlForProject(project: ProjectDocument, href: string) {
  const url = new URL(href);
  url.hash = projectToShareHash(project).slice(1);
  return url.toString();
}
