import { describe, expect, it } from "vitest";
import { toolbox } from "./blocklyBlocks";

describe("Blockly toolbox", () => {
  it("keeps visible category names clean while styling icons through cssConfig", () => {
    const categories = toolbox.contents;

    expect(categories.map((category) => category.name)).toEqual(["Input/Output", "Sensors", "Motion", "Displays", "Timing"]);
    for (const category of categories) {
      expect(category.name).not.toMatch(/^(I\/O|S|M|LCD|ms)(Input\/Output|Sensors|Motion|Displays|Timing)$/);
      expect(category.cssConfig.row).toContain("blocklyToolboxCategory");
      expect(category.cssConfig.icon).toContain("abl-toolbox-icon");
    }
  });
});
