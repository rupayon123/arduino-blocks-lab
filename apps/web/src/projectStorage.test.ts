import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { isProjectDocument, parseStoredProject, serializeProject } from "./projectStorage";

const project: ProjectDocument = {
  schemaVersion: "1.0.0",
  name: "Saved Blink",
  boardId: "arduino-uno",
  components: [
    {
      id: "led_1",
      componentId: "led",
      label: "LED",
      pins: { signal: 13 }
    }
  ],
  program: [{ kind: "digital-write", componentId: "led_1", value: "HIGH" }],
  blocksXml: "<xml />"
};

describe("project storage", () => {
  it("round-trips a valid project document", () => {
    const stored = serializeProject(project);
    const restored = parseStoredProject(stored);

    expect(restored?.name).toBe("Saved Blink");
    expect(restored?.components[0]?.pins.signal).toBe(13);
  });

  it("rejects malformed or corrupted project data", () => {
    expect(parseStoredProject("{nope")).toBeUndefined();
    expect(isProjectDocument({ schemaVersion: "1.0.0", name: "Bad" })).toBe(false);
    expect(parseStoredProject(JSON.stringify({ ...project, components: [{ id: "bad" }] }))).toBeUndefined();
  });
});
