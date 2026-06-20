import { describe, expect, it } from "vitest";
import type { ProgramStep, ProjectDocument } from "@abl/block-schema";
import { catalog, starterProjects } from "@abl/catalog";
import { createCircuitRuntime } from "./circuitRuntime";

function createRuntimeFromProject(project: ProjectDocument) {
  return createCircuitRuntime({
    project: {
      components: project.components,
      program: project.program,
      pinAssignments: project.pinAssignments,
      connections: project.connections
    },
    definitions: catalog.components
  });
}

describe("circuit runtime", () => {
  it("executes blink-style digital writes and delay timing", () => {
    const blinkLedId = starterProjects.blink.components[0]?.id;
    const project = {
      ...starterProjects.blink,
      program: [
        { kind: "digital-write", componentId: blinkLedId, value: "HIGH" },
        { kind: "delay", ms: 1 },
        { kind: "digital-write", componentId: blinkLedId, value: "LOW" },
        { kind: "delay", ms: 1 }
      ] as ProgramStep[]
    };

    const runtime = createRuntimeFromProject(project);
    const afterTwoOperations = runtime.run(2);

    expect(afterTwoOperations.pinValues["13"]).toBe("HIGH");
    expect(afterTwoOperations.stepIndex).toBe(2);

    const afterTwoMore = runtime.run(2);
    expect(afterTwoMore.pinValues["13"]).toBe("LOW");
    expect(afterTwoMore.serialLog.join("\n")).toContain("digital 13 = LOW");
  });

  it("consumes delay in wall-clock chunks so long waits keep advancing", () => {
    const blinkLedId = starterProjects.blink.components[0]?.id;
    const project = {
      ...starterProjects.blink,
      program: [
        { kind: "digital-write", componentId: blinkLedId, value: "HIGH" },
        { kind: "delay", ms: 1000 },
        { kind: "digital-write", componentId: blinkLedId, value: "LOW" }
      ] as ProgramStep[]
    };

    const runtime = createRuntimeFromProject(project);
    const oneTick = runtime.run(10, 180);
    expect(oneTick.stepIndex).toBeGreaterThanOrEqual(2);
    expect(oneTick.pinValues["13"]).toBe("HIGH");
    expect(oneTick.delayRemainingMs).toBeLessThan(1000);
    expect(oneTick.delayRemainingMs).toBeGreaterThan(700);

    const secondTick = runtime.run(10, 180);
    expect(secondTick.stepIndex).toBeGreaterThanOrEqual(3);
    expect(secondTick.pinValues["13"]).toBe("HIGH");
    expect(secondTick.delayRemainingMs).toBeLessThan(oneTick.delayRemainingMs ?? Infinity);

    const fullTick = runtime.run(20, 1200);
    expect(fullTick.halted).toBeUndefined();
    expect(fullTick.serialLog.join("\n")).toContain("digital 13 = LOW");
  });

  it("maps component pins to board pins for behavior blocks", () => {
    const runtime = createRuntimeFromProject(starterProjects.servoKnob);
    const servoId = starterProjects.servoKnob.components[1]?.id;

    runtime.setInput("A0", 1023);
    runtime.step();

    const snapshot = runtime.getSnapshot();
    expect(snapshot.componentState[servoId ?? ""]).toMatchObject({ ANGLE: 180 });
    expect(snapshot.pinValues["9"]).toBe(180);
    expect(snapshot.pinValues["A0"]).toBe(1023);
    expect(snapshot.serialLog.join("\n")).toContain("servo");
  });

  it("drives button-controlled LED behavior from input pin values", () => {
    const runtime = createRuntimeFromProject(starterProjects.buttonLed);
    const ledId = starterProjects.buttonLed.components[1]?.id;

    runtime.setInput("2", "LOW");
    runtime.step();

    const pressedSnapshot = runtime.getSnapshot();
    expect(pressedSnapshot.serialLog.join("\n")).toContain("pressed");
    expect(pressedSnapshot.componentState[ledId ?? ""]).toMatchObject({ VALUE: "HIGH" });
    expect(pressedSnapshot.pinValues["13"]).toBe("HIGH");

    runtime.setInput("2", "HIGH");
    runtime.run(3);
    const releasedSnapshot = runtime.getSnapshot();
    expect(releasedSnapshot.serialLog.join("\n")).toContain("released");
    expect(releasedSnapshot.componentState[ledId ?? ""]).toMatchObject({ VALUE: "LOW" });
    expect(releasedSnapshot.pinValues["13"]).toBe("LOW");
  });

  it("records unsupported blocks but keeps moving", () => {
    const unsupportedProject = {
      ...starterProjects.blink,
      program: [
        { kind: "bad-kind", pin: "13", value: "HIGH" } as unknown as ProgramStep,
        ...starterProjects.blink.program
      ]
    };

    const runtime = createRuntimeFromProject(unsupportedProject);
    const snapshot = runtime.run(3);

    expect(snapshot.warnings).toEqual(expect.arrayContaining([expect.stringContaining("Unsupported") ]));
    expect(snapshot.serialLog).toEqual(expect.arrayContaining(["digital 13 = HIGH"]));
  });

  it("loops program blocks continuously instead of stopping after one cycle", () => {
    const runtime = createRuntimeFromProject({
      ...starterProjects.blink,
      program: [
        { kind: "digital-write", componentId: starterProjects.blink.components[0]?.id, value: "HIGH" },
        { kind: "digital-write", componentId: starterProjects.blink.components[0]?.id, value: "LOW" }
      ] as ProgramStep[]
    });

    const first = runtime.run(1);
    const second = runtime.run(1);
    const third = runtime.run(1);

    expect(first.pinValues["13"]).toBe("HIGH");
    expect(second.pinValues["13"]).toBe("LOW");
    expect(third.pinValues["13"]).toBe("HIGH");
    expect(first.halted).toBeUndefined();
    expect(second.halted).toBeUndefined();
    expect(third.halted).toBeUndefined();
  });

  it("halts while-pin loops that get stuck and adds safety warnings", () => {
    const project = {
      ...starterProjects.blink,
      program: [
        {
          kind: "while-pin",
          pin: "2",
          expectedValue: "HIGH",
          body: [{ kind: "digital-write", pin: "13", value: "HIGH" }]
        },
        { kind: "digital-write", pin: "13", value: "LOW" }
      ] as ProgramStep[]
    };

    const runtime = createRuntimeFromProject(project);
    runtime.setInput("2", "HIGH");
    const snapshot = runtime.run(600);

    expect(snapshot.halted).toBe("blocked");
    expect(snapshot.warnings).toEqual(expect.arrayContaining(["while-pin reached safety limit and was stopped."]));
    expect(snapshot.pinValues["13"]).toBe("HIGH");
  });

  it("simulates DC motor direction and speed", () => {
    const project: ProjectDocument = {
      schemaVersion: "1.0.0",
      name: "Motor",
      boardId: "arduino-uno",
      components: [
        {
          id: "motor_1",
          componentId: "dc-motor-driver",
          label: "Motor",
          pins: { in1: 5, in2: 6, enable: 3 }
        }
      ],
      program: [{ kind: "dc-motor-write", componentId: "motor_1", direction: "reverse", speed: 210 }]
    };

    const runtime = createRuntimeFromProject(project);
    const snapshot = runtime.step();

    expect(snapshot.pinValues["5"]).toBe("LOW");
    expect(snapshot.pinValues["6"]).toBe("HIGH");
    expect(snapshot.pinValues["3"]).toBe(210);
    expect(snapshot.componentState.motor_1).toMatchObject({ DIRECTION: "reverse", SPEED: 210 });
    expect(snapshot.serialLog.join("\n")).toContain("motor_1: reverse 210");
  });

  it("simulates joystick serial readings from virtual pin inputs", () => {
    const project: ProjectDocument = {
      schemaVersion: "1.0.0",
      name: "Joystick",
      boardId: "arduino-uno",
      components: [
        {
          id: "joystick_1",
          componentId: "joystick",
          label: "Joystick",
          pins: { x: "A2", y: "A3", button: 12 }
        }
      ],
      program: [{ kind: "joystick-serial", componentId: "joystick_1" }]
    };

    const runtime = createRuntimeFromProject(project);
    runtime.setInput("A2", 800);
    runtime.setInput("A3", 250);
    runtime.setInput("12", "LOW");
    const snapshot = runtime.step();

    expect(snapshot.componentState.joystick_1).toMatchObject({ X: 800, Y: 250, BUTTON: "LOW" });
    expect(snapshot.serialLog.join("\n")).toContain("joystick_1: x 800 y 250 button LOW");
  });
});
