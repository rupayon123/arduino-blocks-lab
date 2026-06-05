import * as Blockly from "blockly/core";
import "blockly/blocks";
import type { ComponentDefinition, ComponentInstance } from "@abl/block-schema";
import { components as defaultComponents } from "@abl/catalog";

let componentProvider = (): ComponentInstance[] => [];
let componentDefinitionProvider = (): ComponentDefinition[] => defaultComponents;
let registered = false;

type Option = [string, string];

export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Output",
      colour: "#d95f43",
      contents: [
        { kind: "block", type: "abl_led_write" },
        { kind: "block", type: "abl_rgb_color" },
        { kind: "block", type: "abl_neopixel_color" },
        { kind: "block", type: "abl_buzzer_tone" },
        { kind: "block", type: "abl_relay_write" }
      ]
    },
    {
      kind: "category",
      name: "Input",
      colour: "#2f8f71",
      contents: [
        { kind: "block", type: "abl_button_led" },
        { kind: "block", type: "abl_pot_servo" },
        { kind: "block", type: "abl_ultrasonic_serial" },
        { kind: "block", type: "abl_dht_serial" },
        { kind: "block", type: "abl_analog_serial" },
        { kind: "block", type: "abl_digital_serial" },
        { kind: "block", type: "abl_ir_serial" }
      ]
    },
    {
      kind: "category",
      name: "Motion",
      colour: "#4f7dbd",
      contents: [{ kind: "block", type: "abl_servo_write" }]
    },
    {
      kind: "category",
      name: "Display",
      colour: "#9a6b2f",
      contents: [
        { kind: "block", type: "abl_lcd_print" },
        { kind: "block", type: "abl_oled_print" }
      ]
    },
    {
      kind: "category",
      name: "Timing",
      colour: "#616b3a",
      contents: [{ kind: "block", type: "abl_delay" }]
    }
  ]
};

export function setBlocklyComponentProvider(provider: () => ComponentInstance[]) {
  componentProvider = provider;
}

export function setBlocklyComponentDefinitionProvider(provider: () => ComponentDefinition[]) {
  componentDefinitionProvider = provider;
}

function componentOptions(componentIds: string[]): Option[] {
  const all = componentProvider();
  const options = all
    .filter((instance) => componentIds.includes(instance.componentId))
    .map((instance) => [instance.label, instance.id] as Option);
  return options.length > 0 ? options : [["Add component first", "__missing__"]];
}

function componentsByCategory(categories: string[]): Option[] {
  const ids = componentDefinitionProvider().filter((component) => categories.includes(component.category)).map((component) => component.id);
  return componentOptions(ids);
}

function componentsMatching(predicate: (component: ComponentDefinition) => boolean): Option[] {
  const ids = componentDefinitionProvider().filter(predicate).map((component) => component.id);
  return componentOptions(ids);
}

function signalPinLabel(component: ComponentDefinition) {
  return component.pinLabels.signal?.toLowerCase() ?? "";
}

function numberField(value: number, min = 0, max = 1023) {
  return new Blockly.FieldNumber(value, min, max, 1);
}

function statement(block: Blockly.Block, colour: string) {
  block.setPreviousStatement(true);
  block.setNextStatement(true);
  block.setColour(colour);
  block.setTooltip("");
  block.setHelpUrl("");
}

export function registerArduinoBlocks() {
  if (registered) return;
  registered = true;

  Blockly.Blocks.abl_led_write = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["led"])), "COMPONENT")
        .appendField("to")
        .appendField(new Blockly.FieldDropdown([["on", "HIGH"], ["off", "LOW"]]), "STATE");
      statement(this, "#d95f43");
    }
  };

  Blockly.Blocks.abl_rgb_color = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["rgb-led"])), "RGB")
        .appendField("R")
        .appendField(numberField(255, 0, 255), "RED")
        .appendField("G")
        .appendField(numberField(80, 0, 255), "GREEN")
        .appendField("B")
        .appendField(numberField(64, 0, 255), "BLUE");
      statement(this, "#d95f43");
    }
  };

  Blockly.Blocks.abl_neopixel_color = {
    init() {
      this.appendDummyInput()
        .appendField("fill")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["neopixel-strip"])), "STRIP")
        .appendField("R")
        .appendField(numberField(24, 0, 255), "RED")
        .appendField("G")
        .appendField(numberField(160, 0, 255), "GREEN")
        .appendField("B")
        .appendField(numberField(120, 0, 255), "BLUE");
      statement(this, "#d95f43");
    }
  };

  Blockly.Blocks.abl_buzzer_tone = {
    init() {
      this.appendDummyInput()
        .appendField("tone")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["buzzer"])), "BUZZER")
        .appendField(numberField(440, 20, 12000), "FREQUENCY")
        .appendField("Hz for")
        .appendField(numberField(250, 1, 10000), "DURATION")
        .appendField("ms");
      statement(this, "#d95f43");
    }
  };

  Blockly.Blocks.abl_relay_write = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["relay"])), "RELAY")
        .appendField("to")
        .appendField(new Blockly.FieldDropdown([["on", "HIGH"], ["off", "LOW"]]), "STATE");
      statement(this, "#d95f43");
    }
  };

  Blockly.Blocks.abl_delay = {
    init() {
      this.appendDummyInput().appendField("wait").appendField(numberField(1000, 0, 60000), "MS").appendField("ms");
      statement(this, "#616b3a");
    }
  };

  Blockly.Blocks.abl_button_led = {
    init() {
      this.appendDummyInput()
        .appendField("button")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["button"])), "BUTTON")
        .appendField("controls")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["led"])), "LED");
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_pot_servo = {
    init() {
      this.appendDummyInput()
        .appendField("knob")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["potentiometer"])), "POT")
        .appendField("controls")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["servo"])), "SERVO");
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_ultrasonic_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print distance from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["ultrasonic-hcsr04"])), "SENSOR");
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_dht_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print weather from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["dht11", "dht22"])), "SENSOR");
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_analog_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print analog")
        .appendField(
          new Blockly.FieldDropdown(() =>
            componentsMatching((component) => signalPinLabel(component).includes("analog") || String(component.defaultPins.signal ?? "").startsWith("A"))
          ),
          "SENSOR"
        );
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_digital_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print digital")
        .appendField(
          new Blockly.FieldDropdown(() =>
            componentsMatching((component) => signalPinLabel(component).includes("digital") || typeof component.defaultPins.signal === "number")
          ),
          "SENSOR"
        );
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_ir_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print IR code from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["ir-receiver"])), "SENSOR");
      statement(this, "#2f8f71");
    }
  };

  Blockly.Blocks.abl_servo_write = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["servo"])), "SERVO")
        .appendField("angle")
        .appendField(numberField(90, 0, 180), "ANGLE");
      statement(this, "#4f7dbd");
    }
  };

  Blockly.Blocks.abl_lcd_print = {
    init() {
      this.appendDummyInput()
        .appendField("LCD")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["lcd-1602-i2c"])), "DISPLAY")
        .appendField("print")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT");
      statement(this, "#9a6b2f");
    }
  };

  Blockly.Blocks.abl_oled_print = {
    init() {
      this.appendDummyInput()
        .appendField("OLED")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["oled-ssd1306"])), "DISPLAY")
        .appendField("print")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT");
      statement(this, "#9a6b2f");
    }
  };
}
