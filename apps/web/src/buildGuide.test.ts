import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { catalog, starterProjects } from "@abl/catalog";
import { createBuildGuide } from "./buildGuide";

describe("createBuildGuide", () => {
  it("exports board, parts, wiring, program flow, and sketch for a starter project", () => {
    const guide = createBuildGuide(starterProjects.servoKnob, catalog);

    expect(guide).toContain("# Servo Knob");
    expect(guide).toContain("- Arduino Uno (arduino:avr:uno)");
    expect(guide).toContain("- Potentiometer x1");
    expect(guide).toContain("- Servo x1");
    expect(guide).toContain("- Signal: middle pin -> A0");
    expect(guide).toContain("- Signal: orange/yellow wire -> D9");
    expect(guide).toContain("1. map knob value to servo angle");
    expect(guide).toContain("- Servo");
    expect(guide).toContain("```cpp");
    expect(guide).toContain("void loop()");
  });

  it("shows a no-library fallback for simple builds", () => {
    const guide = createBuildGuide(starterProjects.blink, catalog);

    expect(guide).toContain("## Libraries\n- No external libraries.");
    expect(guide).toContain("- Signal: long LED leg through 220 ohm resistor -> D13");
    expect(guide).toContain("- Code generation checks clear.");
  });

  it("includes library install names for display and sensor builds", () => {
    const guide = createBuildGuide(starterProjects.dhtDisplay, catalog, { includeSketch: false });

    expect(guide).toContain("- DHT sensor library");
    expect(guide).toContain("- LiquidCrystal I2C");
    expect(guide).not.toContain("```cpp");
  });

  it("surfaces wiring diagnostics and code generation warnings", () => {
    const project: ProjectDocument = {
      schemaVersion: "1.0.0",
      name: "Broken Guide",
      boardId: "arduino-uno",
      components: [
        {
          id: "led_1",
          componentId: "led",
          label: "LED",
          pins: { signal: 99 }
        }
      ],
      program: [{ kind: "digital-write", componentId: "missing_led", value: "HIGH" }]
    };

    const guide = createBuildGuide(project, catalog);

    expect(guide).toContain("[ERROR] Pin not on board");
    expect(guide).toContain("[CODE] Missing component instance: missing_led");
  });
});
