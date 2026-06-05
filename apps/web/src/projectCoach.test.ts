import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { collectProjectCoach } from "./projectCoach";
import type { UploadReadiness } from "./uploadReadiness";
import type { WiringDiagnostic } from "./wiringDiagnostics";

function project(overrides: Partial<ProjectDocument> = {}): ProjectDocument {
  return {
    schemaVersion: "1.0.0",
    name: "Coach test",
    boardId: "arduino-uno",
    components: [],
    program: [],
    ...overrides
  };
}

function readiness(overrides: Partial<UploadReadiness> = {}): UploadReadiness {
  return {
    title: "Setup needed",
    detail: "2 setup items left.",
    readyToCompile: false,
    readyToUpload: false,
    blockedCount: 2,
    warningCount: 0,
    items: [],
    ...overrides
  };
}

function coach(overrides: Partial<Parameters<typeof collectProjectCoach>[0]> = {}) {
  return collectProjectCoach({
    project: project(),
    boardName: "Arduino Uno",
    wiringDiagnostics: [],
    generatedWarnings: [],
    uploadReadiness: readiness(),
    ...overrides
  });
}

describe("collectProjectCoach", () => {
  it("points empty projects toward adding hardware and blocks", () => {
    const result = coach();

    expect(result.progressPercent).toBe(33);
    expect(result.nextStep?.id).toBe("hardware");
    expect(result.steps.find((step) => step.id === "hardware")?.state).toBe("next");
    expect(result.steps.find((step) => step.id === "blocks")?.state).toBe("next");
  });

  it("surfaces wiring errors as blocked work", () => {
    const diagnostic: WiringDiagnostic = {
      severity: "error",
      title: "Pin not on board",
      message: "LED uses 99."
    };

    const result = coach({
      project: project({
        components: [{ id: "led_1", componentId: "led", label: "LED", pins: { signal: 99 } }],
        program: [{ kind: "digital-write", componentId: "led_1", value: "HIGH" }]
      }),
      wiringDiagnostics: [diagnostic]
    });

    expect(result.nextStep?.id).toBe("wiring");
    expect(result.steps.find((step) => step.id === "wiring")?.state).toBe("blocked");
  });

  it("keeps generated code warnings visible", () => {
    const result = coach({
      project: project({
        components: [{ id: "led_1", componentId: "led", label: "LED", pins: { signal: 13 } }],
        program: [{ kind: "digital-write", componentId: "missing", value: "HIGH" }]
      }),
      generatedWarnings: ["Missing LED"]
    });

    expect(result.steps.find((step) => step.id === "code")?.state).toBe("warning");
    expect(result.nextStep?.id).toBe("code");
  });

  it("shows compile-ready projects as waiting for a USB port", () => {
    const result = coach({
      project: project({
        components: [{ id: "led_1", componentId: "led", label: "LED", pins: { signal: 13 } }],
        program: [{ kind: "digital-write", componentId: "led_1", value: "HIGH" }]
      }),
      uploadReadiness: readiness({ readyToCompile: true, detail: "Compile is ready; choose a USB port to upload." })
    });

    expect(result.steps.find((step) => step.id === "upload")?.state).toBe("warning");
    expect(result.nextStep?.id).toBe("upload");
  });

  it("marks all steps done when upload is ready", () => {
    const result = coach({
      project: project({
        components: [{ id: "led_1", componentId: "led", label: "LED", pins: { signal: 13 } }],
        program: [{ kind: "digital-write", componentId: "led_1", value: "HIGH" }]
      }),
      uploadReadiness: readiness({ readyToCompile: true, readyToUpload: true, detail: "Ready to upload." })
    });

    expect(result.doneCount).toBe(result.totalCount);
    expect(result.progressPercent).toBe(100);
    expect(result.nextStep).toBeUndefined();
  });
});
