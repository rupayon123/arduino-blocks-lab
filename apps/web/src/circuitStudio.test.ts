import { describe, expect, it } from "vitest";
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
  });

  it("tracks power, signal, and display behavior for a multi-part project", () => {
    const model = studioFor(starterProjects.dhtDisplay);

    expect(model.stats.components).toBe(2);
    expect(model.stats.powerWires).toBeGreaterThan(0);
    expect(model.stats.signalWires).toBeGreaterThan(0);
    expect(model.events.some((event) => event.tone === "display")).toBe(true);
    expect(model.benchTests.some((test) => test.title === "Change room weather")).toBe(true);
    expect(model.benchTests.some((test) => test.title === "Read the display")).toBe(true);
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
});
