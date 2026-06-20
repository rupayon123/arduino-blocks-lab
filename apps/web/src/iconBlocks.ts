import type { ComponentDefinition, ComponentInstance, ProgramStep, ProjectDocument } from "@abl/block-schema";
import { describeProgramStep } from "./programDescriptions";

export type IconBlockTone = "output" | "input" | "motion" | "sensor" | "display" | "time" | "serial";

export type IconBlockAction = {
  id: string;
  title: string;
  detail: string;
  tone: IconBlockTone;
  step: ProgramStep;
};

export type IconBlockCard = {
  id: string;
  title: string;
  detail: string;
  tone: IconBlockTone;
};

function definitionMap(definitions: ComponentDefinition[]) {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

function componentsByDefinition(project: ProjectDocument, definitions: ComponentDefinition[], predicate: (definition: ComponentDefinition) => boolean) {
  const definitionsById = definitionMap(definitions);
  return project.components.filter((component) => {
    const definition = definitionsById.get(component.componentId);
    return definition ? predicate(definition) : false;
  });
}

function firstComponent(project: ProjectDocument, componentId: string) {
  return project.components.find((component) => component.componentId === componentId);
}

function componentName(components: ComponentInstance[], componentId: string | undefined) {
  if (!componentId) return "part";
  return components.find((component) => component.id === componentId)?.label ?? componentId;
}

function hasAnalogSignal(definition: ComponentDefinition) {
  return definition.pinLabels.signal?.toLowerCase().includes("analog") || String(definition.defaultPins.signal ?? "").startsWith("A");
}

function hasDigitalSignal(definition: ComponentDefinition) {
  return definition.pinLabels.signal?.toLowerCase().includes("digital") || Number.isInteger(Number(definition.defaultPins.signal));
}

function readableSignal(definition: ComponentDefinition) {
  return ["input", "sensor", "communication"].includes(definition.category);
}

export function createIconBlockActions(project: ProjectDocument, definitions: ComponentDefinition[]): IconBlockAction[] {
  const led = firstComponent(project, "led");
  const button = firstComponent(project, "button");
  const servo = firstComponent(project, "servo");
  const motor = firstComponent(project, "dc-motor-driver");
  const potentiometer = firstComponent(project, "potentiometer");
  const joystick = firstComponent(project, "joystick");
  const ultrasonic = firstComponent(project, "ultrasonic-hcsr04");
  const dht = project.components.find((component) => ["dht11", "dht22"].includes(component.componentId));
  const display = project.components.find((component) => ["lcd-1602-i2c", "oled-ssd1306"].includes(component.componentId));
  const strip = firstComponent(project, "neopixel-strip");
  const buzzer = firstComponent(project, "buzzer");
  const relay = firstComponent(project, "relay");
  const analogSensor = componentsByDefinition(project, definitions, (definition) => readableSignal(definition) && hasAnalogSignal(definition))[0];
  const digitalSensor = componentsByDefinition(project, definitions, (definition) => readableSignal(definition) && hasDigitalSignal(definition))[0];

  const actions: IconBlockAction[] = [];
  if (led) {
    actions.push(
      {
        id: "led-on",
        title: "LED on",
        detail: led.label,
        tone: "output",
        step: { kind: "digital-write", componentId: led.id, value: "HIGH" }
      },
      {
        id: "led-off",
        title: "LED off",
        detail: led.label,
        tone: "output",
        step: { kind: "digital-write", componentId: led.id, value: "LOW" }
      }
    );
  }

  actions.push({
    id: "wait",
    title: "Wait",
    detail: "1000 ms",
    tone: "time",
    step: { kind: "delay", ms: 1000 }
  });

  if (button && led) {
    actions.push({
      id: "button-led",
      title: "Button LED",
      detail: `${button.label} + ${led.label}`,
      tone: "input",
      step: { kind: "button-controls-led", buttonId: button.id, ledId: led.id }
    });
  }

  if (potentiometer && servo) {
    actions.push({
      id: "knob-servo",
      title: "Knob servo",
      detail: `${potentiometer.label} + ${servo.label}`,
      tone: "motion",
      step: { kind: "potentiometer-controls-servo", potentiometerId: potentiometer.id, servoId: servo.id }
    });
  }

  if (servo) {
    actions.push({
      id: "servo-middle",
      title: "Servo 90",
      detail: servo.label,
      tone: "motion",
      step: { kind: "servo-write", componentId: servo.id, angle: 90 }
    });
  }

  if (motor) {
    actions.push({
      id: "motor-forward",
      title: "Motor forward",
      detail: motor.label,
      tone: "motion",
      step: { kind: "dc-motor-write", componentId: motor.id, direction: "forward", speed: 180 }
    });
  }

  if (joystick) {
    actions.push({
      id: "joystick",
      title: "Joystick",
      detail: joystick.label,
      tone: "serial",
      step: { kind: "joystick-serial", componentId: joystick.id }
    });
  }

  if (ultrasonic) {
    actions.push({
      id: "distance",
      title: "Distance",
      detail: ultrasonic.label,
      tone: "sensor",
      step: { kind: "ultrasonic-serial", componentId: ultrasonic.id, label: "distance_cm" }
    });
  }

  if (dht) {
    actions.push({
      id: "weather",
      title: "Weather",
      detail: dht.label,
      tone: "sensor",
      step: { kind: "dht-serial", componentId: dht.id }
    });
  }

  if (display) {
    actions.push({
      id: "display-text",
      title: "Display",
      detail: display.label,
      tone: "display",
      step:
        display.componentId === "oled-ssd1306"
          ? { kind: "oled-print", componentId: display.id, text: "Hello", clear: true }
          : { kind: "lcd-print", componentId: display.id, text: "Hello", clear: true }
    });
  }

  if (strip) {
    actions.push({
      id: "pixels",
      title: "Pixels",
      detail: strip.label,
      tone: "output",
      step: { kind: "neopixel-fill", componentId: strip.id, red: 24, green: 160, blue: 120 }
    });
  }

  if (buzzer) {
    actions.push({
      id: "tone",
      title: "Tone",
      detail: buzzer.label,
      tone: "output",
      step: { kind: "tone", componentId: buzzer.id, frequency: 440, duration: 250 }
    });
  }

  if (relay) {
    actions.push({
      id: "relay-on",
      title: "Relay on",
      detail: relay.label,
      tone: "output",
      step: { kind: "relay-write", componentId: relay.id, value: "HIGH" }
    });
  }

  if (analogSensor) {
    actions.push({
      id: "analog-read",
      title: "Analog",
      detail: analogSensor.label,
      tone: "serial",
      step: { kind: "read-analog-serial", componentId: analogSensor.id }
    });
  }

  if (digitalSensor) {
    actions.push({
      id: "digital-read",
      title: "Digital",
      detail: digitalSensor.label,
      tone: "serial",
      step: { kind: "read-digital-serial", componentId: digitalSensor.id }
    });
  }

  return actions;
}

export function createIconBlockCards(program: ProgramStep[], components: ComponentInstance[]): IconBlockCard[] {
  return program.map((step, index) => {
    const detail = describeProgramStep(step);
    switch (step.kind) {
      case "digital-write":
        return {
          id: `${index}-${step.kind}`,
          title: step.value === "LOW" || step.value === false ? "LED off" : "LED on",
          detail: componentName(components, step.componentId),
          tone: "output"
        };
      case "delay":
        return {
          id: `${index}-${step.kind}`,
          title: "Wait",
          detail: `${step.ms} ms`,
          tone: "time"
        };
      case "button-controls-led":
        return {
          id: `${index}-${step.kind}`,
          title: "Button LED",
          detail: `${componentName(components, step.buttonId)} controls ${componentName(components, step.ledId)}`,
          tone: "input"
        };
      case "potentiometer-controls-servo":
        return {
          id: `${index}-${step.kind}`,
          title: "Knob servo",
          detail: `${componentName(components, step.potentiometerId)} moves ${componentName(components, step.servoId)}`,
          tone: "motion"
        };
      case "servo-write":
        return {
          id: `${index}-${step.kind}`,
          title: "Servo",
          detail: `${componentName(components, step.componentId)} to ${step.angle}`,
          tone: "motion"
        };
      case "dc-motor-write":
        return {
          id: `${index}-${step.kind}`,
          title: "Motor",
          detail: `${componentName(components, step.componentId)} ${step.direction} ${step.speed}`,
          tone: "motion"
        };
      case "digital-toggle":
        return {
          id: `${index}-${step.kind}`,
          title: "Toggle",
          detail: `pin ${step.pin}`,
          tone: "output"
        };
      case "if-pin":
        return {
          id: `${index}-${step.kind}`,
          title: "If",
          detail: `pin ${step.pin}`,
          tone: "input"
        };
      case "if-pin-else":
        return {
          id: `${index}-${step.kind}`,
          title: "If / Else",
          detail: `pin ${step.pin}`,
          tone: "input"
        };
      case "repeat":
        return {
          id: `${index}-${step.kind}`,
          title: "Repeat",
          detail: `${step.count}x`,
          tone: "time"
        };
      case "while-pin":
        return {
          id: `${index}-${step.kind}`,
          title: "While",
          detail: `pin ${step.pin}`,
          tone: "time"
        };
      case "ultrasonic-serial":
      case "dht-serial":
      case "joystick-serial":
      case "read-analog-serial":
      case "read-digital-serial":
      case "ir-read-serial":
        return {
          id: `${index}-${step.kind}`,
          title: detail.split(" ").slice(0, 2).join(" "),
          detail: componentName(components, step.componentId),
          tone: "serial"
        };
      case "lcd-print":
      case "oled-print":
        return {
          id: `${index}-${step.kind}`,
          title: "Display",
          detail: `${componentName(components, step.componentId)}: ${step.text}`,
          tone: "display"
        };
      default:
        return {
          id: `${index}-${step.kind}`,
          title: detail,
          detail: "Arduino block",
          tone: "output"
        };
    }
  });
}
