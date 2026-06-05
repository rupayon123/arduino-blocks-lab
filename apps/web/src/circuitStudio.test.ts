import { describe, expect, it } from "vitest";
import { boards, catalog, starterProjects } from "@abl/catalog";
import { collectWiringDiagnostics } from "./wiringDiagnostics";
import { createWiringCanvasModel } from "./wiringCanvas";
import { createCircuitStudioModel } from "./circuitStudio";

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
    expect(model.steps.find((step) => step.id === "behavior")?.state).toBe("done");
  });

  it("tracks power, signal, and display behavior for a multi-part project", () => {
    const model = studioFor(starterProjects.dhtDisplay);

    expect(model.stats.components).toBe(2);
    expect(model.stats.powerWires).toBeGreaterThan(0);
    expect(model.stats.signalWires).toBeGreaterThan(0);
    expect(model.events.some((event) => event.tone === "display")).toBe(true);
  });
});
