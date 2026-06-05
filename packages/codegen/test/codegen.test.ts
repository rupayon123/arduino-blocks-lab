import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ComponentInstance, ProjectDocument, ProgramStep } from "@abl/block-schema";
import { catalog, components, createComponentInstance, mergeExtensionManifest, parseExtensionManifest, starterProjects } from "@abl/catalog";
import { collectLibraries, generateSketch } from "../src";

function projectFor(componentIds: string[], step: (instances: Record<string, ComponentInstance>) => ProgramStep): ProjectDocument {
  const instances: Record<string, ComponentInstance> = {};
  for (const componentId of componentIds) {
    const definition = components.find((component) => component.id === componentId);
    if (!definition) throw new Error(componentId);
    instances[componentId] = createComponentInstance(definition);
  }
  return {
    schemaVersion: "1.0.0",
    name: `Test ${componentIds.join("-") || "pins"}`,
    boardId: "arduino-uno",
    components: Object.values(instances),
    program: [step(instances)]
  };
}

describe("generateSketch", () => {
  it("generates starter project snapshots", () => {
    for (const starter of Object.values(starterProjects)) {
      expect(generateSketch(starter, catalog).code).toMatchSnapshot(starter.name);
    }
  });

  it("collects libraries from component runtime metadata", () => {
    expect(collectLibraries(starterProjects.dhtDisplay, catalog).map((library) => library.name)).toEqual([
      "DHT sensor library",
      "LiquidCrystal I2C"
    ]);
  });

  it("has codegen coverage for every V1 component", () => {
    for (const component of components) {
      const instance = createComponentInstance(component);
      const project: ProjectDocument = {
        schemaVersion: "1.0.0",
        name: `${component.name} coverage`,
        boardId: "arduino-uno",
        components: [instance],
        program: [{ kind: "serial-print", value: component.name }]
      };
      const generated = generateSketch(project, catalog);
      expect(generated.code).toContain("void setup()");
      expect(generated.code).toContain("void loop()");
      expect(generated.warnings).toEqual([]);
    }
  });

  it("supports each V1 program step kind", () => {
    const cases: Array<{ components: string[]; step: (instances: Record<string, ComponentInstance>) => ProgramStep; expected: string }> = [
      { components: [], step: () => ({ kind: "digital-write", pin: 13, value: "HIGH" }), expected: "digitalWrite(13, HIGH)" },
      { components: [], step: () => ({ kind: "analog-write", pin: 9, value: 128 }), expected: "analogWrite(9, 128)" },
      { components: [], step: () => ({ kind: "delay", ms: 42 }), expected: "delay(42)" },
      { components: [], step: () => ({ kind: "serial-print", value: "hello" }), expected: "Serial.println(\"hello\")" },
      { components: ["potentiometer"], step: ({ potentiometer }) => ({ kind: "read-analog-serial", componentId: potentiometer!.id }), expected: "analogRead(A0)" },
      { components: ["pir"], step: ({ pir }) => ({ kind: "read-digital-serial", componentId: pir!.id }), expected: "digitalRead(3)" },
      {
        components: ["button", "led"],
        step: ({ button, led }) => ({ kind: "button-controls-led", buttonId: button!.id, ledId: led!.id }),
        expected: "if (digitalRead(2) == LOW)"
      },
      {
        components: ["potentiometer", "servo"],
        step: ({ potentiometer, servo }) => ({ kind: "potentiometer-controls-servo", potentiometerId: potentiometer!.id, servoId: servo!.id }),
        expected: "int servoAngle = map(knobValue, 0, 1023, 0, 180)"
      },
      { components: ["servo"], step: ({ servo }) => ({ kind: "servo-write", componentId: servo!.id, angle: 90 }), expected: ".write(90)" },
      { components: ["rgb-led"], step: ({ "rgb-led": rgb }) => ({ kind: "rgb-write", componentId: rgb!.id, red: 1, green: 2, blue: 3 }), expected: "analogWrite(9, 1)" },
      {
        components: ["ultrasonic-hcsr04"],
        step: ({ "ultrasonic-hcsr04": ultrasonic }) => ({ kind: "ultrasonic-serial", componentId: ultrasonic!.id }),
        expected: "pulseIn(7, HIGH)"
      },
      { components: ["dht11"], step: ({ dht11 }) => ({ kind: "dht-serial", componentId: dht11!.id }), expected: ".readHumidity()" },
      { components: ["lcd-1602-i2c"], step: ({ "lcd-1602-i2c": lcd }) => ({ kind: "lcd-print", componentId: lcd!.id, text: "Hi", clear: true }), expected: ".print(\"Hi\")" },
      { components: ["oled-ssd1306"], step: ({ "oled-ssd1306": oled }) => ({ kind: "oled-print", componentId: oled!.id, text: "Hi", clear: true }), expected: ".display()" },
      {
        components: ["neopixel-strip"],
        step: ({ "neopixel-strip": strip }) => ({ kind: "neopixel-fill", componentId: strip!.id, red: 1, green: 2, blue: 3 }),
        expected: ".fill("
      },
      { components: ["buzzer"], step: ({ buzzer }) => ({ kind: "tone", componentId: buzzer!.id, frequency: 440, duration: 100 }), expected: "tone(8, 440, 100)" },
      { components: ["relay"], step: ({ relay }) => ({ kind: "relay-write", componentId: relay!.id, value: "HIGH" }), expected: "digitalWrite(7, HIGH)" },
      { components: ["ir-receiver"], step: ({ "ir-receiver": ir }) => ({ kind: "ir-read-serial", componentId: ir!.id }), expected: "IrReceiver.decode()" }
    ];

    for (const testCase of cases) {
      const project = projectFor(testCase.components, testCase.step);
      expect(generateSketch(project, catalog).code).toContain(testCase.expected);
    }
  });

  it("generates Arduino C++ for an imported extension-pack lesson", () => {
    const sample = JSON.parse(readFileSync(new URL("../../../examples/extensions/soil-moisture-pack.json", import.meta.url), "utf8"));
    const parsed = parseExtensionManifest(sample);
    const merged = mergeExtensionManifest(catalog, parsed.manifest!);
    const lesson = merged.catalog.lessons.find((candidate) => candidate.id === "lesson-soil-moisture");

    expect(parsed.errors).toEqual([]);
    expect(lesson).toBeDefined();
    expect(generateSketch(lesson!.starterProject, merged.catalog).code).toContain("analogRead(A1)");
  });

  it("generates Arduino C++ for a multi-sensor classroom extension lesson", () => {
    const sample = JSON.parse(readFileSync(new URL("../../../examples/extensions/classroom-sensors-pack.json", import.meta.url), "utf8"));
    const parsed = parseExtensionManifest(sample);
    const merged = mergeExtensionManifest(catalog, parsed.manifest!);
    const lesson = merged.catalog.lessons.find((candidate) => candidate.id === "lesson-line-tracker");

    expect(parsed.errors).toEqual([]);
    expect(lesson).toBeDefined();
    expect(generateSketch(lesson!.starterProject, merged.catalog).code).toContain("digitalRead(3)");
  });
});
