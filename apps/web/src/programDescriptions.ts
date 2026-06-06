import type { ProgramStep } from "@abl/block-schema";

export function describeProgramStep(step: ProgramStep): string {
  switch (step.kind) {
    case "digital-write":
      return `set digital output ${step.componentId ?? step.pin} to ${step.value}`;
    case "digital-if-write":
      return `if pin ${step.inputPin} is ${step.expectedValue}, set pin ${step.outputPin} to ${step.outputValue}`;
    case "pin-mode":
      return `set pin ${step.pin} mode to ${step.mode}`;
    case "analog-write":
      return `set PWM output ${step.componentId ?? step.pin} to ${step.value}`;
    case "delay-microseconds":
      return `wait ${step.us} µs`;
    case "delay":
      return `wait ${step.ms} ms`;
    case "serial-print":
      return `print ${JSON.stringify(step.value)}`;
    case "button-controls-led":
      return "button controls LED";
    case "potentiometer-controls-servo":
      return "map knob value to servo angle";
    case "servo-write":
      return `set servo angle to ${step.angle}`;
    case "rgb-write":
      return `set RGB color to ${step.red}, ${step.green}, ${step.blue}`;
    case "ultrasonic-serial":
      return "measure distance and print centimeters";
    case "dht-serial":
      return "read temperature and humidity";
    case "lcd-print":
      return `print ${JSON.stringify(step.text)} on LCD`;
    case "oled-print":
      return `print ${JSON.stringify(step.text)} on OLED`;
    case "neopixel-fill":
      return `fill NeoPixels with ${step.red}, ${step.green}, ${step.blue}`;
    case "tone":
      return `play ${step.frequency} Hz tone`;
    case "relay-write":
      return `set relay to ${step.value}`;
    case "read-analog-serial":
      return `read analog and print as ${step.label ?? "value"}`;
    case "read-digital-serial":
      return `read digital and print as ${step.label ?? "value"}`;
    case "ir-read-serial":
      return "read IR code and print it";
    default:
      return "run block";
  }
}
