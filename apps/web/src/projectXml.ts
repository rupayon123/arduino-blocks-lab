import type { ProgramStep, ProjectDocument } from "@abl/block-schema";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function field(name: string, value: string | number | boolean | undefined): string {
  return `<field name="${name}">${escapeXml(String(value ?? ""))}</field>`;
}

function blockForStep(step: ProgramStep): string {
  switch (step.kind) {
    case "digital-write":
      return step.componentId
        ? `<block type="abl_led_write">${field("COMPONENT", step.componentId)}${field("STATE", step.value === "LOW" || step.value === false ? "LOW" : "HIGH")}</block>`
        : `<block type="abl_digital_write_pin">${field("PIN", step.pin)}${field("STATE", step.value === "LOW" || step.value === false ? "LOW" : "HIGH")}</block>`;
    case "pin-mode":
      return `<block type="abl_pin_mode">${field("PIN", step.pin)}${field("MODE", step.mode)}</block>`;
    case "analog-write":
      return `<block type="abl_analog_write_pin">${field("PIN", step.pin)}${field("VALUE", step.value)}</block>`;
    case "digital-if-write":
      return `<block type="abl_digital_if_write">${field("INPUT_PIN", step.inputPin)}${field("EXPECTED", step.expectedValue)}${field("OUTPUT_PIN", step.outputPin)}${field("OUTPUT_VALUE", step.outputValue)}</block>`;
    case "delay-microseconds":
      return `<block type="abl_delay_microseconds">${field("MICROSECONDS", step.us)}</block>`;
    case "delay":
      return `<block type="abl_delay">${field("MS", step.ms)}</block>`;
    case "serial-print":
      return `<block type="abl_serial_print">${field("VALUE", step.value)}${field("NEWLINE", step.newline === false ? "false" : "true")}</block>`;
    case "button-controls-led":
      return `<block type="abl_button_led">${field("BUTTON", step.buttonId)}${field("LED", step.ledId)}</block>`;
    case "potentiometer-controls-servo":
      return `<block type="abl_pot_servo">${field("POT", step.potentiometerId)}${field("SERVO", step.servoId)}</block>`;
    case "servo-write":
      return `<block type="abl_servo_write">${field("SERVO", step.componentId)}${field("ANGLE", step.angle)}</block>`;
    case "rgb-write":
      return `<block type="abl_rgb_color">${field("RGB", step.componentId)}${field("RED", step.red)}${field("GREEN", step.green)}${field("BLUE", step.blue)}</block>`;
    case "ultrasonic-serial":
      return `<block type="abl_ultrasonic_serial">${field("SENSOR", step.componentId)}</block>`;
    case "dht-serial":
      return `<block type="abl_dht_serial">${field("SENSOR", step.componentId)}</block>`;
    case "lcd-print":
      return `<block type="abl_lcd_print">${field("DISPLAY", step.componentId)}${field("TEXT", step.text)}</block>`;
    case "oled-print":
      return `<block type="abl_oled_print">${field("DISPLAY", step.componentId)}${field("TEXT", step.text)}</block>`;
    case "neopixel-fill":
      return `<block type="abl_neopixel_color">${field("STRIP", step.componentId)}${field("RED", step.red)}${field("GREEN", step.green)}${field("BLUE", step.blue)}</block>`;
    case "tone":
      return `<block type="abl_buzzer_tone">${field("BUZZER", step.componentId)}${field("FREQUENCY", step.frequency)}${field("DURATION", step.duration ?? 250)}</block>`;
    case "relay-write":
      return `<block type="abl_relay_write">${field("RELAY", step.componentId)}${field("STATE", step.value === "LOW" || step.value === false ? "LOW" : "HIGH")}</block>`;
    case "read-analog-serial":
      return step.componentId
        ? `<block type="abl_analog_serial">${field("SENSOR", step.componentId)}${field("LABEL", step.label ?? "analog")}</block>`
        : `<block type="abl_analog_read_pin">${field("PIN", step.pin)}${field("LABEL", step.label ?? "analog")}</block>`;
    case "read-digital-serial":
      return step.componentId
        ? `<block type="abl_digital_serial">${field("SENSOR", step.componentId)}${field("LABEL", step.label ?? "digital")}</block>`
        : `<block type="abl_digital_read_pin">${field("PIN", step.pin)}${field("LABEL", step.label ?? "digital")}</block>`;
    case "ir-read-serial":
      return `<block type="abl_ir_serial">${field("SENSOR", step.componentId)}</block>`;
    default:
      return `<block type="abl_delay">${field("MS", 250)}</block>`;
  }
}

function chain(blocks: string[]): string {
  if (blocks.length === 0) return "";
  const [first, ...rest] = blocks;
  if (!first) return "";
  if (rest.length === 0) return first;
  return first.replace("</block>", `<next>${chain(rest)}</next></block>`);
}

export function projectToBlocklyXml(project: ProjectDocument): string {
  return `<xml xmlns="https://developers.google.com/blockly/xml">${chain(project.program.map(blockForStep))}</xml>`;
}
