import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { projectFromShareHash, projectShareHashPrefix, projectToShareHash, shareUrlForProject } from "./projectShare";

const project: ProjectDocument = {
  schemaVersion: "1.0.0",
  name: "Share Blink",
  boardId: "arduino-uno",
  components: [
    {
      id: "led_1",
      componentId: "led",
      label: "LED",
      pins: { signal: 13 }
    }
  ],
  program: [{ kind: "serial-print", value: "hello share link" }],
  blocksXml: "<xml />"
};

describe("project share links", () => {
  it("round-trips a project through a URL-safe hash", () => {
    const hash = projectToShareHash(project);
    const restored = projectFromShareHash(hash);

    expect(hash.startsWith(projectShareHashPrefix)).toBe(true);
    expect(hash).not.toContain("+");
    expect(hash).not.toContain("/");
    expect(restored?.name).toBe("Share Blink");
    expect(restored?.program[0]?.kind).toBe("serial-print");
  });

  it("creates an absolute share URL with the encoded project hash", () => {
    const url = shareUrlForProject(project, "https://example.com/arduino-blocks-lab/?x=1#old");

    expect(url).toContain("https://example.com/arduino-blocks-lab/?x=1#project=");
    expect(projectFromShareHash(new URL(url).hash)?.components[0]?.label).toBe("LED");
  });

  it("rejects missing, corrupted, or malformed project hashes", () => {
    expect(projectFromShareHash("#not-project=abc")).toBeUndefined();
    expect(projectFromShareHash("#project=%%%")).toBeUndefined();
    expect(projectFromShareHash("#project=e30")).toBeUndefined();
  });
});
