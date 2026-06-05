import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { boards, components, createComponentInstance } from "@abl/catalog";
import { autoAssignProjectPins, collectBoardPinUsage } from "./pinPlanner";
import { collectWiringDiagnostics } from "./wiringDiagnostics";

function definition(id: string) {
  const component = components.find((candidate) => candidate.id === id);
  if (!component) throw new Error(id);
  return component;
}

function project(overrides: Partial<ProjectDocument>): ProjectDocument {
  return {
    schemaVersion: "1.0.0",
    name: "Pin planner test",
    boardId: "arduino-uno",
    components: [],
    program: [],
    ...overrides
  };
}

describe("autoAssignProjectPins", () => {
  it("moves duplicate signal pins to free board pins", () => {
    const led = createComponentInstance(definition("led"));
    const button = createComponentInstance(definition("button"));
    led.pins.signal = 13;
    button.pins.signal = 13;

    const result = autoAssignProjectPins(project({ components: [led, button] }), boards[0], components);
    const diagnostics = collectWiringDiagnostics(result.project, boards[0], components);

    expect(result.changes).toHaveLength(1);
    expect(result.project.components[1]?.pins.signal).not.toBe(13);
    expect(diagnostics.some((diagnostic) => diagnostic.title === "Shared signal pin")).toBe(false);
  });

  it("moves PWM components onto PWM-capable pins", () => {
    const servo = createComponentInstance(definition("servo"));
    servo.pins.signal = 2;

    const result = autoAssignProjectPins(project({ components: [servo] }), boards[0], components);

    expect(boards[0]?.pwmPins).toContain(String(result.project.components[0]?.pins.signal));
    expect(result.changes[0]).toMatchObject({ componentLabel: "Servo", pinName: "signal" });
  });

  it("assigns analog controls to distinct analog pins", () => {
    const joystick = createComponentInstance(definition("joystick"));
    joystick.pins.x = 99;
    joystick.pins.y = "A0";

    const result = autoAssignProjectPins(project({ components: [joystick] }), boards[0], components);

    expect(result.project.components[0]?.pins.x).toBe("A0");
    expect(result.project.components[0]?.pins.y).toBe("A1");
  });

  it("preserves non-board metadata pins", () => {
    const strip = createComponentInstance(definition("neopixel-strip"));
    strip.pins.signal = 0;
    strip.pins.count = 24;

    const result = autoAssignProjectPins(project({ components: [strip] }), boards[0], components);

    expect(result.project.components[0]?.pins.count).toBe(24);
    expect(result.project.components[0]?.pins.signal).not.toBe(0);
  });
});

describe("collectBoardPinUsage", () => {
  it("marks used, conflicting, and reserved board pins", () => {
    const led = createComponentInstance(definition("led"));
    const button = createComponentInstance(definition("button"));
    led.pins.signal = 0;
    button.pins.signal = 0;

    const usage = collectBoardPinUsage(project({ components: [led, button] }), boards[0], components);
    const d0 = usage.find((pin) => pin.label === "D0");

    expect(d0?.reserved).toBe(true);
    expect(d0?.conflict).toBe(true);
    expect(d0?.usedBy).toHaveLength(2);
  });
});
