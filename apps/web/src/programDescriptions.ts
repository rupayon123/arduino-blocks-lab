import type { ProgramStep } from "@abl/block-schema";

export function describeProgramStep(step: ProgramStep): string {
  switch (step.kind) {
    case "digital-write":
      return `set digital output ${step.componentId ?? step.pin} to ${step.value}`;
    case "digital-if-write":
      return `if pin ${step.inputPin} is ${step.expectedValue}, set pin ${step.outputPin} to ${step.outputValue}`;
    case "if-pin":
      return `if pin ${step.pin} is ${step.expectedValue}, run ${step.then.length} step${step.then.length === 1 ? "" : "s"} inside.`;
    case "if-pin-else":
      return `if pin ${step.pin} is ${step.expectedValue}, run ${step.then.length} step${step.then.length === 1 ? "" : "s"} in then and ${step.else?.length ?? 0} in else.`;
    case "repeat":
      return `repeat ${step.count} time${String(step.count) === "1" ? "" : "s"} for the following steps`;
    case "while-pin":
      return `run steps while pin ${step.pin} is ${step.expectedValue}.`;
    case "digital-toggle":
      return `toggle output on pin ${step.pin}`;
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
    case "dc-motor-write":
      return `set motor ${step.direction} at speed ${step.speed}`;
    case "joystick-serial":
      return "read joystick and print X, Y, and button";
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
    case "tone-stop":
      return `stop active tone on ${step.componentId}`;
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
