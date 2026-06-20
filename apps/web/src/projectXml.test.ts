import { describe, expect, it } from "vitest";
import type { ProgramStep, ProjectDocument } from "@abl/block-schema";
import { projectToBlocklyXml } from "./projectXml";

const base: Omit<ProjectDocument, "name" | "program"> = {
  schemaVersion: "1.0.0",
  boardId: "arduino-uno",
  components: [],
  pinAssignments: [],
  componentPlacement: [],
  connections: [],
  simulationState: {}
};

function project(program: ProgramStep[]) {
  return { ...base, name: "Test", program } as ProjectDocument;
}

describe("projectToBlocklyXml", () => {
  it("serializes if-block statements into nested statement XML", () => {
    const generated = projectToBlocklyXml(
      project([
        { kind: "if-pin", pin: 2, expectedValue: "HIGH", then: [{ kind: "digital-write", pin: 13, value: "HIGH" }] }
      ])
    );
    expect(generated).toContain('<block type="abl_if_digital"');
    expect(generated).toContain('<statement name="DO"><block type="abl_digital_write_pin"');
  });

  it("serializes repeat blocks with nested loop statements", () => {
    const generated = projectToBlocklyXml(
      project([
        {
          kind: "repeat",
          count: 3,
          body: [
            { kind: "delay", ms: 250 },
            { kind: "digital-write", pin: 9, value: "LOW" }
          ]
        }
      ])
    );
    expect(generated).toContain('<block type="abl_repeat"');
    expect(generated).toContain('<statement name="DO">');
    expect(generated).toContain('<block type="abl_delay"');
  });

  it("serializes if-else and while blocks with statements", () => {
    const generated = projectToBlocklyXml(
      project([
        {
          kind: "if-pin-else",
          pin: 2,
          expectedValue: "HIGH",
          then: [{ kind: "digital-write", pin: 13, value: "HIGH" }],
          else: [{ kind: "digital-write", pin: 13, value: "LOW" }]
        },
        { kind: "while-pin", pin: 3, expectedValue: "HIGH", body: [{ kind: "delay", ms: 20 }] }
      ])
    );
    expect(generated).toContain('<block type="abl_if_else_digital"');
    expect(generated).toContain('<statement name="DO">');
    expect(generated).toContain('<statement name="ELSE">');
    expect(generated).toContain('<block type="abl_digital_write_pin"');
    expect(generated).toContain('<block type="abl_while_digital"');
    expect(generated).toContain('<statement name="BODY">');
  });

  it("serializes motor and joystick blocks", () => {
    const generated = projectToBlocklyXml(
      project([
        { kind: "dc-motor-write", componentId: "motor_1", direction: "forward", speed: 180 },
        { kind: "joystick-serial", componentId: "joystick_1" }
      ])
    );

    expect(generated).toContain('<block type="abl_dc_motor_write"');
    expect(generated).toContain('<field name="DIRECTION">forward</field>');
    expect(generated).toContain('<block type="abl_joystick_serial"');
  });
});
