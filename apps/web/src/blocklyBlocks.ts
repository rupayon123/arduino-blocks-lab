import * as Blockly from "blockly/core";
import "blockly/blocks";
import type { ComponentDefinition, ComponentInstance } from "@abl/block-schema";

type Option = [string, string];

let componentProvider = () => [] as ComponentInstance[];
let componentDefinitionProvider = () => [] as ComponentDefinition[];
let registered = false;

const blockColours = {
  io: "#ef3e7a",
  sensors: "#12a988",
  motion: "#4f86f7",
  displays: "#8f5cf7",
  timing: "#78a841",
  serial: "#f6a31e"
};

type ToolboxBlockItem = {
  kind: "block";
  type: string;
};

type StyledToolboxCategory = {
  kind: "category";
  name: string;
  colour: string;
  cssConfig: {
    row: string;
    icon: string;
  };
  contents: ToolboxBlockItem[];
};

type StyledToolbox = {
  kind: "categoryToolbox";
  contents: StyledToolboxCategory[];
};

function categoryCss(tone: keyof typeof blockColours) {
  return {
    row: `blocklyToolboxCategory abl-category-${tone}`,
    icon: `blocklyToolboxCategoryIcon abl-toolbox-icon abl-toolbox-icon-${tone}`
  };
}

export const toolbox: StyledToolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Input / Output",
      colour: blockColours.io,
      cssConfig: categoryCss("io"),
      contents: [
        { kind: "block", type: "abl_led_write" },
        { kind: "block", type: "abl_digital_write_pin" },
        { kind: "block", type: "abl_analog_write_pin" },
        { kind: "block", type: "abl_builtin_led_write" },
        { kind: "block", type: "abl_digital_if_write" },
        { kind: "block", type: "abl_pin_mode" },
        { kind: "block", type: "abl_relay_write" },
        { kind: "block", type: "abl_buzzer_tone" },
        { kind: "block", type: "abl_rgb_color" },
        { kind: "block", type: "abl_neopixel_color" }
      ]
    },
    {
      kind: "category",
      name: "Sensors",
      colour: blockColours.sensors,
      cssConfig: categoryCss("sensors"),
      contents: [
        { kind: "block", type: "abl_button_led" },
        { kind: "block", type: "abl_digital_read_pin" },
        { kind: "block", type: "abl_analog_read_pin" }
      ]
    },
    {
      kind: "category",
      name: "Motion",
      colour: blockColours.motion,
      cssConfig: categoryCss("motion"),
      contents: [
        { kind: "block", type: "abl_servo_write" },
        { kind: "block", type: "abl_pot_servo" }
      ]
    },
    {
      kind: "category",
      name: "Displays",
      colour: blockColours.displays,
      cssConfig: categoryCss("displays"),
      contents: [
        { kind: "block", type: "abl_lcd_print" },
        { kind: "block", type: "abl_oled_print" }
      ]
    },
    {
      kind: "category",
      name: "Timing",
      colour: blockColours.timing,
      cssConfig: categoryCss("timing"),
      contents: [
        { kind: "block", type: "abl_delay" },
        { kind: "block", type: "abl_delay_microseconds" }
      ]
    },
    {
      kind: "category",
      name: "Serial",
      colour: blockColours.serial,
      cssConfig: categoryCss("serial"),
      contents: [
        { kind: "block", type: "abl_serial_print" },
        { kind: "block", type: "abl_analog_serial" },
        { kind: "block", type: "abl_digital_serial" },
        { kind: "block", type: "abl_ultrasonic_serial" },
        { kind: "block", type: "abl_dht_serial" },
        { kind: "block", type: "abl_ir_serial" }
      ]
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

function pinField(value: string | number = "13") {
  return new Blockly.FieldTextInput(String(value));
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
        .appendField(new Blockly.FieldDropdown([ ["on", "HIGH"], ["off", "LOW"] ]), "STATE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_digital_write_pin = {
    init() {
      this.appendDummyInput()
        .appendField("set pin")
        .appendField(pinField("13"), "PIN")
        .appendField("to")
        .appendField(new Blockly.FieldDropdown([ ["on", "HIGH"], ["off", "LOW"] ]), "STATE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_analog_write_pin = {
    init() {
      this.appendDummyInput()
        .appendField("set pin")
        .appendField(pinField("3"), "PIN")
        .appendField("to PWM")
        .appendField(numberField(128, 0, 255), "VALUE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_builtin_led_write = {
    init() {
      this.appendDummyInput()
        .appendField("set built-in LED")
        .appendField(new Blockly.FieldDropdown([ ["on", "HIGH"], ["off", "LOW"] ]), "STATE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_digital_if_write = {
    init() {
      this.appendDummyInput()
        .appendField("if")
        .appendField(pinField("2"), "INPUT_PIN")
        .appendField("is")
        .appendField(new Blockly.FieldDropdown([ ["high", "HIGH"], ["low", "LOW"] ]), "EXPECTED")
        .appendField("then")
        .appendField("set")
        .appendField(pinField("13"), "OUTPUT_PIN")
        .appendField("to")
        .appendField(new Blockly.FieldDropdown([ ["on", "HIGH"], ["off", "LOW"] ]), "OUTPUT_VALUE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_pin_mode = {
    init() {
      this.appendDummyInput()
        .appendField("set pin")
        .appendField(pinField("2"), "PIN")
        .appendField("mode")
        .appendField(new Blockly.FieldDropdown([ ["INPUT", "INPUT"], ["OUTPUT", "OUTPUT"], ["INPUT_PULLUP", "INPUT_PULLUP"] ]), "MODE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_digital_read_pin = {
    init() {
      this.appendDummyInput()
        .appendField("print digital pin")
        .appendField(pinField("2"), "PIN")
        .appendField("as")
        .appendField(new Blockly.FieldTextInput("button"), "LABEL");
      statement(this, blockColours.sensors);
    }
  };

  Blockly.Blocks.abl_analog_read_pin = {
    init() {
      this.appendDummyInput()
        .appendField("print analog pin")
        .appendField(pinField("A0"), "PIN")
        .appendField("as")
        .appendField(new Blockly.FieldTextInput("potentiometer"), "LABEL");
      statement(this, blockColours.sensors);
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
      statement(this, blockColours.io);
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
      statement(this, blockColours.io);
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
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_relay_write = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["relay"])), "RELAY")
        .appendField("to")
        .appendField(new Blockly.FieldDropdown([["on", "HIGH"], ["off", "LOW"]]), "STATE");
      statement(this, blockColours.io);
    }
  };

  Blockly.Blocks.abl_delay = {
    init() {
      this.appendDummyInput().appendField("wait").appendField(numberField(1000, 0, 60000), "MS").appendField("ms");
      statement(this, blockColours.timing);
    }
  };

  Blockly.Blocks.abl_delay_microseconds = {
    init() {
      this.appendDummyInput().appendField("wait").appendField(numberField(500, 1, 100000), "MICROSECONDS").appendField("µs");
      statement(this, blockColours.timing);
    }
  };

  Blockly.Blocks.abl_button_led = {
    init() {
      this.appendDummyInput()
        .appendField("button")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["button"])), "BUTTON")
        .appendField("controls")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["led"])), "LED");
      statement(this, blockColours.sensors);
    }
  };

  Blockly.Blocks.abl_pot_servo = {
    init() {
      this.appendDummyInput()
        .appendField("knob")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["potentiometer"])), "POT")
        .appendField("controls")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["servo"])), "SERVO");
      statement(this, blockColours.motion);
    }
  };

  Blockly.Blocks.abl_ultrasonic_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print distance from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["ultrasonic-hcsr04"])), "SENSOR");
      statement(this, blockColours.serial);
    }
  };

  Blockly.Blocks.abl_dht_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print weather from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["dht11", "dht22"])), "SENSOR");
      statement(this, blockColours.serial);
    }
  };

  Blockly.Blocks.abl_analog_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print analog")
        .appendField(
          new Blockly.FieldDropdown(() =>
            componentsMatching((component) => signalPinLabel(component).includes("analog") || String(component.defaultPins.signal ?? "").startsWith("A") || String(component.defaultPins.signal ?? "").includes("A"))
          ),
          "SENSOR"
        )
        .appendField("as")
        .appendField(new Blockly.FieldTextInput("light"), "LABEL");
      statement(this, blockColours.serial);
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
        )
        .appendField("as")
        .appendField(new Blockly.FieldTextInput("button"), "LABEL");
      statement(this, blockColours.serial);
    }
  };

  Blockly.Blocks.abl_ir_serial = {
    init() {
      this.appendDummyInput()
        .appendField("print IR code from")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["ir-receiver"])), "SENSOR");
      statement(this, blockColours.serial);
    }
  };

  Blockly.Blocks.abl_servo_write = {
    init() {
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["servo"])), "SERVO")
        .appendField("angle")
        .appendField(numberField(90, 0, 180), "ANGLE");
      statement(this, blockColours.motion);
    }
  };

  Blockly.Blocks.abl_lcd_print = {
    init() {
      this.appendDummyInput()
        .appendField("LCD")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["lcd-1602-i2c"])), "DISPLAY")
        .appendField("print")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT");
      statement(this, blockColours.displays);
    }
  };

  Blockly.Blocks.abl_oled_print = {
    init() {
      this.appendDummyInput()
        .appendField("OLED")
        .appendField(new Blockly.FieldDropdown(() => componentOptions(["oled-ssd1306"])), "DISPLAY")
        .appendField("print")
        .appendField(new Blockly.FieldTextInput("Hello"), "TEXT");
      statement(this, blockColours.displays);
    }
  };

  Blockly.Blocks.abl_serial_print = {
    init() {
      this.appendDummyInput()
        .appendField("print text")
        .appendField(new Blockly.FieldTextInput("hello"), "VALUE")
        .appendField("newline")
        .appendField(new Blockly.FieldDropdown([ ["yes", "true"], ["no", "false"] ]), "NEWLINE");
      statement(this, blockColours.serial);
    }
  };

}
