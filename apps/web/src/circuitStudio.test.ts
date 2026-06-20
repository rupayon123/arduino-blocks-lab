import { describe, expect, it } from "vitest";
import type { ProjectDocument } from "@abl/block-schema";
import { boards, catalog, starterProjects } from "@abl/catalog";
import { collectWiringDiagnostics } from "./wiringDiagnostics";
import { createWiringCanvasModel } from "./wiringCanvas";
import { createCircuitStudioModel, defaultBenchControlValues, simulateBenchReadings } from "./circuitStudio";

function studioFor(project = starterProjects.blink) {
  const board = boards.find((candidate) => candidate.id === project.boardId);
  const wiringCanvas = createWiringCanvasModel(project, board, catalog.components);
  return createCircuitStudioModel({
    project,
    board,
    definitions: catalog.components,
    wiringCanvas,
    wiringDiagnostics: collectWiringDiagnostics(project, board, catalog.components)
  });
}

describe("circuit studio model", () => {
  it("creates placements, wires, and behavior events for blink", () => {
    const model = studioFor();

    expect(model.projectName).toBe("Blink");
    expect(model.boardName).toBe("Arduino Uno");
    expect(model.placements).toHaveLength(1);
    expect(model.wires.length).toBeGreaterThan(0);
    expect(model.events.map((event) => event.title)).toContain("Built-in LED goes HIGH");
    expect(model.benchTests.map((test) => test.title)).toContain("Watch Built-in LED");
    expect(model.benchTests[0]?.simulation.kind).toBe("digital-output");
    expect(model.benchTests[0]?.readings[0]?.value).toBe("ON / HIGH");
    expect(model.steps.find((step) => step.id === "behavior")?.state).toBe("done");
    expect(model.breadboardPlan).toMatchObject({
      tone: "ready",
      title: "Ready to breadboard",
      powerWires: 0,
      groundWires: 1,
      signalWires: 1,
      busWires: 0
    });
    expect(model.breadboardPlan.simulatorHints).toContain("Use Wokwi LED or a real 5mm LED with a resistor.");
    expect(model.breadboardPlan.items.some((item) => item.id === "signal-route")).toBe(true);
  });

  it("tracks power, signal, and display behavior for a multi-part project", () => {
    const model = studioFor(starterProjects.dhtDisplay);

    expect(model.stats.components).toBe(2);
    expect(model.stats.powerWires).toBeGreaterThan(0);
    expect(model.stats.signalWires).toBeGreaterThan(0);
    expect(model.events.some((event) => event.tone === "display")).toBe(true);
    expect(model.benchTests.some((test) => test.title === "Change room weather")).toBe(true);
    expect(model.benchTests.some((test) => test.title === "Read the display")).toBe(true);
    expect(model.breadboardPlan).toMatchObject({
      powerWires: 2,
      groundWires: 2,
      signalWires: 1,
      busWires: 2
    });
    expect(model.breadboardPlan.items.some((item) => item.id === "bus-route" && item.detail.includes("SDA A4, SCL A5"))).toBe(true);
  });

  it("simulates ultrasonic distance as echo timing and serial output", () => {
    const model = studioFor(starterProjects.ultrasonicDistance);
    const test = model.benchTests.find((candidate) => candidate.simulation.kind === "ultrasonic");

    expect(test).toBeDefined();
    expect(test?.simulation.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "distance",
          kind: "range"
        })
      ])
    );
    expect(simulateBenchReadings(test!, { ...defaultBenchControlValues(test!), distance: 100 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Echo time", value: "5800 us" }),
        expect.objectContaining({ label: "Serial Monitor", value: "distance_cm: 100" })
      ])
    );
  });

  it("turns knob and servo projects into a motion bench test", () => {
    const model = studioFor(starterProjects.servoKnob);
    const test = model.benchTests[0];

    expect(model.benchTests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Turn the knob",
          tone: "motion"
        })
      ])
    );
    expect(test?.expected).toContain("0, 90, and 180 degrees");
    expect(simulateBenchReadings(test!, { ...defaultBenchControlValues(test!), analog: 1023 })).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Arm Servo", value: "180 deg" })])
    );
  });

  it("simulates button presses against the LED output", () => {
    const model = studioFor(starterProjects.buttonLed);
    const test = model.benchTests[0];

    expect(test?.simulation.kind).toBe("button-led");
    expect(simulateBenchReadings(test!, { ...defaultBenchControlValues(test!), pressed: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Start Button", value: "LOW pressed" }),
        expect.objectContaining({ label: "Built-in LED", value: "ON" })
      ])
    );
  });

  it("adds guided bench tests for motor and joystick blocks", () => {
    const model = studioFor({
      schemaVersion: "1.0.0",
      boardId: "arduino-uno",
      name: "Motor Joystick Lab",
      components: [
        {
          id: "motor_1",
          componentId: "dc-motor-driver",
          label: "Drive Motor",
          pins: { in1: 5, in2: 6, enable: 3 }
        },
        {
          id: "joystick_1",
          componentId: "joystick",
          label: "Drive Stick",
          pins: { x: "A2", y: "A3", button: 12 }
        }
      ],
      program: [
        { kind: "dc-motor-write", componentId: "motor_1", direction: "reverse", speed: 210 },
        { kind: "joystick-serial", componentId: "joystick_1" }
      ]
    });
    const motorTest = model.benchTests.find((candidate) => candidate.simulation.kind === "dc-motor");
    const joystickTest = model.benchTests.find((candidate) => candidate.simulation.kind === "joystick");

    expect(model.events.map((event) => event.title)).toEqual(expect.arrayContaining(["Motor reverse", "Joystick reading"]));
    expect(motorTest).toMatchObject({
      title: "Spin Drive Motor",
      tone: "motion"
    });
    expect(joystickTest).toMatchObject({
      title: "Move Drive Stick",
      tone: "serial"
    });
    expect(simulateBenchReadings(motorTest!, { ...defaultBenchControlValues(motorTest!), direction: "stop", speed: 210 })).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Motor speed", value: "0 PWM / 0%" })])
    );
    expect(simulateBenchReadings(joystickTest!, { ...defaultBenchControlValues(joystickTest!), x: 900, y: 100, pressed: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "X axis", value: "900 (right)" }),
        expect.objectContaining({ label: "Y axis", value: "100 (down)" }),
        expect.objectContaining({ label: "Button", value: "LOW pressed" })
      ])
    );
  });

  it("marks a fully supported starter project ready for simulation", () => {
    const model = studioFor(starterProjects.blink);

    expect(model.simulatorPlan).toMatchObject({
      tone: "ready",
      title: "Ready to simulate",
      coveragePercent: 100,
      supportedParts: 1,
      unsupportedParts: [],
      virtualTests: 2
    });
    expect(model.simulatorPlan.items.some((item) => item.title === "Wokwi package is ready")).toBe(true);
  });

  it("calls out partial simulator support for unsupported parts", () => {
    const model = studioFor(starterProjects.dhtDisplay);

    expect(model.simulatorPlan.tone).toBe("partial");
    expect(model.simulatorPlan.unsupportedParts).toEqual(["LCD 1602 I2C"]);
    expect(model.simulatorPlan.items.some((item) => item.detail.includes("add LCD 1602 I2C manually"))).toBe(true);
  });

  it("blocks simulator trust when wiring has errors", () => {
    const brokenBlink: ProjectDocument = JSON.parse(JSON.stringify(starterProjects.blink));
    brokenBlink.components[0]!.pins.signal = 99;
    const model = studioFor(brokenBlink);

    expect(model.simulatorPlan.tone).toBe("blocked");
    expect(model.simulatorPlan.title).toBe("Fix before simulating");
    expect(model.simulatorPlan.items[0]).toMatchObject({
      id: "fix-wiring",
      tone: "blocked"
    });
    expect(model.breadboardPlan).toMatchObject({
      tone: "blocked",
      title: "Fix before breadboard"
    });
    expect(model.breadboardPlan.items[0]).toMatchObject({
      id: "repair-errors",
      tone: "blocked"
    });
  });
});
