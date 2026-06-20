import { describe, expect, it } from "vitest";
import { toolbox } from "./blocklyBlocks";

describe("Blockly toolbox", () => {
  it("keeps visible category names clean while styling icons through cssConfig", () => {
    const categories = toolbox.contents;

    expect(categories.map((category) => category.name)).toEqual([
      "Logic",
      "Input / Output",
      "Sensors",
      "Motion",
      "Displays",
      "Timing",
      "Serial"
    ]);
    for (const category of categories) {
      expect(category.name).not.toMatch(/^(I\/O|S|M|LCD|ms)(Input\/Output|Sensors|Motion|Displays|Timing)$/);
      expect(category.cssConfig.row).toContain("blocklyToolboxCategory");
      expect(category.cssConfig.icon).toContain("abl-toolbox-icon");
    }
  });

  it("includes motion and joystick blocks for V1 catalog hardware", () => {
    const allBlocks = toolbox.contents.flatMap((category) => category.contents.map((item) => item.type));

    expect(allBlocks).toContain("abl_dc_motor_write");
    expect(allBlocks).toContain("abl_joystick_serial");
  });
});
