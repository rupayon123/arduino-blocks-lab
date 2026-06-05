import { describe, expect, it } from "vitest";
import { starterProjects } from "@abl/catalog";
import { createWokwiDiagram, unsupportedWokwiComponents } from "./wokwiExport";

describe("createWokwiDiagram", () => {
  it("exports Blink as an Arduino Uno plus LED diagram", () => {
    const diagram = createWokwiDiagram(starterProjects.blink);

    expect(diagram.parts.map((part) => part.type)).toContain("wokwi-arduino-uno");
    expect(diagram.parts.map((part) => part.type)).toContain("wokwi-led");
    expect(diagram.connections).toContainEqual(["uno:13", "led_1:A", "green", []]);
  });

  it("exports servo knob with servo and potentiometer wiring", () => {
    const diagram = createWokwiDiagram(starterProjects.servoKnob);

    expect(diagram.parts.map((part) => part.type)).toEqual(expect.arrayContaining(["wokwi-potentiometer", "wokwi-servo"]));
    expect(diagram.connections.some((connection) => connection[0] === "uno:A0")).toBe(true);
    expect(diagram.connections.some((connection) => connection[0] === "uno:9")).toBe(true);
  });

  it("reports unsupported components separately", () => {
    expect(unsupportedWokwiComponents(starterProjects.dhtDisplay)).toEqual(["LCD 1602 I2C"]);
  });
});
