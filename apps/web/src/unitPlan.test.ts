import { describe, expect, it } from "vitest";
import { catalog } from "@abl/catalog";
import { createUnitPlan, createUnitPlanMarkdown, unitPlanFilename } from "./unitPlan";

describe("teacher unit plan", () => {
  it("aggregates pacing, classroom materials, libraries, and lesson load", () => {
    const plan = createUnitPlan(catalog.lessons, catalog, { sessionMinutes: 45 });

    expect(plan.totalLessons).toBe(catalog.lessons.length);
    expect(plan.totalMinutes).toBeGreaterThan(0);
    expect(plan.sessionCount).toBe(Math.ceil(plan.totalMinutes / 45));
    expect(plan.totalWires).toBeGreaterThan(0);
    expect(plan.totalBlocks).toBeGreaterThan(0);
    expect(plan.materials).toEqual(expect.arrayContaining(["Arduino board", "HC-SR04 ultrasonic sensor", "jumper wires"]));
    expect(plan.concepts).toEqual(expect.arrayContaining(["digital output", "serial monitor"]));
    expect(plan.libraries).toEqual(expect.arrayContaining(["Servo", "DHT sensor library", "LiquidCrystal I2C"]));
    expect(plan.prepNotes.some((note) => note.includes("Install or queue Arduino libraries"))).toBe(true);
  });

  it("creates a teacher-ready markdown handout", () => {
    const plan = createUnitPlan(catalog.lessons.slice(0, 2), catalog, { title: "Intro Arduino Unit", sessionMinutes: 40 });
    const markdown = createUnitPlanMarkdown(plan);

    expect(unitPlanFilename(plan)).toBe("Intro_Arduino_Unit-unit-plan.md");
    expect(markdown).toContain("# Intro Arduino Unit");
    expect(markdown).toContain("Suggested sessions:");
    expect(markdown).toContain("## Teacher Prep");
    expect(markdown).toContain("### 1. First Blink");
    expect(markdown).toContain("### 2. Button Switch");
    expect(markdown).toContain("1 block");
  });
});
