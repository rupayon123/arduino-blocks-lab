import type { BoardDefinition, ComponentDefinition, ProgramStep, ProjectDocument } from "@abl/block-schema";
import type { WiringDiagnostic } from "./wiringDiagnostics";
import type { WiringCanvasConnection, WiringCanvasModel, WiringCanvasPinKind, WiringCanvasStatus } from "./wiringCanvas";
import { unsupportedWokwiComponents } from "./wokwiExport";

export type CircuitStudioStepState = "done" | "next" | "warning" | "blocked";
export type CircuitStudioEventTone = "output" | "input" | "motion" | "display" | "serial" | "wait";

export type CircuitStudioPlacement = {
  id: string;
  label: string;
  name: string;
  category: ComponentDefinition["category"] | "unknown";
  x: number;
  y: number;
  accent: string;
  pinCount: number;
};

export type CircuitStudioWire = {
  id: string;
  label: string;
  kind: WiringCanvasPinKind;
  status: WiringCanvasStatus;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
};

export type CircuitStudioStep = {
  id: string;
  label: string;
  detail: string;
  state: CircuitStudioStepState;
};

export type CircuitStudioEvent = {
  id: string;
  title: string;
  detail: string;
  tone: CircuitStudioEventTone;
};

export type CircuitStudioBenchTestTone = "output" | "input" | "motion" | "display" | "serial";

export type CircuitStudioBenchSimulationKind =
  | "digital-output"
  | "analog-output"
  | "serial-print"
  | "analog-serial"
  | "digital-serial"
  | "button-led"
  | "servo-knob"
  | "servo-angle"
  | "rgb-output"
  | "ultrasonic"
  | "dht"
  | "display-text"
  | "neopixel"
  | "tone"
  | "relay"
  | "ir-serial";

export type CircuitStudioBenchControl =
  | {
      id: string;
      label: string;
      kind: "range";
      min: number;
      max: number;
      step: number;
      defaultValue: number;
      unit?: string;
      lowLabel?: string;
      highLabel?: string;
    }
  | {
      id: string;
      label: string;
      kind: "toggle";
      defaultValue: boolean;
      offLabel: string;
      onLabel: string;
    }
  | {
      id: string;
      label: string;
      kind: "choice";
      defaultValue: string;
      options: Array<{ value: string; label: string }>;
    };

export type CircuitStudioBenchControlValue = number | boolean | string;

export type CircuitStudioBenchReading = {
  id: string;
  label: string;
  value: string;
  tone: CircuitStudioBenchTestTone;
};

export type CircuitStudioBenchSimulation = {
  kind: CircuitStudioBenchSimulationKind;
  controls: CircuitStudioBenchControl[];
  metadata: Record<string, string | number | boolean>;
};

export type CircuitStudioBenchTest = {
  id: string;
  title: string;
  setup: string;
  expected: string;
  tone: CircuitStudioBenchTestTone;
  simulation: CircuitStudioBenchSimulation;
  readings: CircuitStudioBenchReading[];
};

export type CircuitStudioSimulatorTone = "ready" | "partial" | "blocked";

export type CircuitStudioSimulatorItem = {
  id: string;
  tone: CircuitStudioSimulatorTone;
  title: string;
  detail: string;
};

export type CircuitStudioSimulatorPlan = {
  tone: CircuitStudioSimulatorTone;
  title: string;
  detail: string;
  coveragePercent: number;
  supportedParts: number;
  unsupportedParts: string[];
  virtualTests: number;
  items: CircuitStudioSimulatorItem[];
};

export type CircuitStudioBreadboardTone = "ready" | "warning" | "blocked";

export type CircuitStudioBreadboardItem = {
  id: string;
  tone: CircuitStudioBreadboardTone;
  title: string;
  detail: string;
};

export type CircuitStudioBreadboardPlan = {
  tone: CircuitStudioBreadboardTone;
  title: string;
  detail: string;
  powerWires: number;
  groundWires: number;
  signalWires: number;
  busWires: number;
  simulatorHints: string[];
  items: CircuitStudioBreadboardItem[];
};

export type CircuitStudioModel = {
  boardName: string;
  projectName: string;
  placements: CircuitStudioPlacement[];
  wires: CircuitStudioWire[];
  steps: CircuitStudioStep[];
  events: CircuitStudioEvent[];
  benchTests: CircuitStudioBenchTest[];
  simulatorPlan: CircuitStudioSimulatorPlan;
  breadboardPlan: CircuitStudioBreadboardPlan;
  stats: {
    components: number;
    wires: number;
    powerWires: number;
    signalWires: number;
    warnings: number;
    errors: number;
  };
};

type CircuitStudioInput = {
  project: ProjectDocument;
  board: BoardDefinition | undefined;
  definitions: ComponentDefinition[];
  wiringCanvas: WiringCanvasModel;
  wiringDiagnostics: WiringDiagnostic[];
};

const categoryAccents: Record<ComponentDefinition["category"] | "unknown", string> = {
  output: "#f36c52",
  input: "#2fa66f",
  sensor: "#14a8e0",
  display: "#ffc83d",
  motion: "#7d77ff",
  communication: "#ad7bf7",
  power: "#ff9e64",
  unknown: "#8aa4b5"
};

function componentDefinitionMap(definitions: ComponentDefinition[]) {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

function componentLabel(project: ProjectDocument, componentId: string | undefined) {
  if (!componentId) return "selected part";
  return project.components.find((component) => component.id === componentId)?.label ?? componentId;
}

function signalLabel(connections: WiringCanvasConnection[], componentId: string | undefined) {
  if (!componentId) return "signal pin";
  const connection = connections.find((wire) => wire.componentId === componentId && ["digital", "analog", "bus"].includes(wire.boardPinKind));
  return connection?.boardPinLabel ?? "signal pin";
}

function pinCount(definition: ComponentDefinition | undefined) {
  return definition ? Object.keys(definition.pinLabels).length : 0;
}

function createPlacements(project: ProjectDocument, definitions: ComponentDefinition[]): CircuitStudioPlacement[] {
  const definitionsById = componentDefinitionMap(definitions);
  const placementByComponent = new Map(project.componentPlacement?.map((placement) => [placement.componentId, placement]));

  return project.components.map((component, index) => {
    const definition = definitionsById.get(component.componentId);
    const category = definition?.category ?? "unknown";
    const custom = placementByComponent.get(component.id);

    if (custom && Number.isFinite(custom.x) && Number.isFinite(custom.y)) {
      return {
        id: component.id,
        label: component.label,
        name: definition?.name ?? component.componentId,
        category,
        x: custom.x,
        y: custom.y,
        accent: categoryAccents[category],
        pinCount: pinCount(definition)
      };
    }

    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: component.id,
      label: component.label,
      name: definition?.name ?? component.componentId,
      category,
      x: 54 + column * 10,
      y: 24 + row * 17 + (column % 2) * 3,
      accent: categoryAccents[category],
      pinCount: pinCount(definition)
    };
  });
}

function sourcePoint(kind: WiringCanvasPinKind, index: number) {
  if (kind === "analog") return { x: 25, y: 68 + (index % 4) * 2 };
  if (kind === "power") return { x: 45, y: 79 + (index % 5) * 1.5 };
  if (kind === "bus") return { x: 42, y: 38 + (index % 4) * 2 };
  if (kind === "unknown") return { x: 32, y: 58 + (index % 5) * 2 };
  return { x: 27, y: 47 + (index % 7) * 2 };
}

function createWires(connections: WiringCanvasConnection[], placements: CircuitStudioPlacement[]): CircuitStudioWire[] {
  const placementsById = new Map(placements.map((placement) => [placement.id, placement]));
  return connections.slice(0, 18).map((connection, index) => {
    const source = sourcePoint(connection.boardPinKind, index);
    const placement = placementsById.get(connection.componentId);
    const target = placement
      ? { x: Math.min(92, placement.x + 5 + (index % 3) * 2), y: Math.min(88, placement.y + 6 + (index % 2) * 4) }
      : { x: 76, y: 38 + index * 2 };
    return {
      id: connection.id,
      label: `${connection.boardPinLabel} to ${connection.componentLabel}`,
      kind: connection.boardPinKind,
      status: connection.status,
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      c1x: source.x + 16,
      c1y: source.y - 12,
      c2x: target.x - 18,
      c2y: target.y + 10
    };
  });
}

function createSteps(input: CircuitStudioInput): CircuitStudioStep[] {
  const diagnosticsWithErrors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const diagnosticsWithWarnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const powerWires = input.wiringCanvas.connections.filter((connection) => connection.boardPinKind === "power").length;
  const signalWires = input.wiringCanvas.connections.filter((connection) => ["digital", "analog", "bus"].includes(connection.boardPinKind)).length;
  const componentCount = input.project.components.length;
  const blockCount = input.project.program.length;

  return [
    {
      id: "parts",
      label: "Place parts",
      detail:
        componentCount > 0
          ? `${input.board?.name ?? input.project.boardId} with ${componentCount} part${componentCount === 1 ? "" : "s"}.`
          : "Add a sensor, output, motor, or display.",
      state: componentCount > 0 ? "done" : "next"
    },
    {
      id: "power",
      label: "Power rails",
      detail: powerWires > 0 ? `${powerWires} power or ground wire${powerWires === 1 ? "" : "s"} planned.` : "No power rail wires required yet.",
      state: componentCount > 0 ? "done" : "next"
    },
    {
      id: "signals",
      label: "Signal wires",
      detail:
        diagnosticsWithErrors.length > 0
          ? `${diagnosticsWithErrors.length} signal issue${diagnosticsWithErrors.length === 1 ? "" : "s"} must be fixed.`
          : diagnosticsWithWarnings.length > 0
            ? `${diagnosticsWithWarnings.length} signal warning${diagnosticsWithWarnings.length === 1 ? "" : "s"} to review.`
            : `${signalWires} signal wire${signalWires === 1 ? "" : "s"} mapped.`,
      state: diagnosticsWithErrors.length > 0 ? "blocked" : diagnosticsWithWarnings.length > 0 ? "warning" : signalWires > 0 ? "done" : "next"
    },
    {
      id: "behavior",
      label: "Code behavior",
      detail: blockCount > 0 ? `${blockCount} block step${blockCount === 1 ? "" : "s"} ready to test.` : "Add blocks to create behavior.",
      state: blockCount > 0 ? "done" : "next"
    }
  ];
}

function eventFromStep(step: ProgramStep, index: number, project: ProjectDocument, connections: WiringCanvasConnection[]): CircuitStudioEvent {
  const id = `event-${index}-${step.kind}`;
  switch (step.kind) {
    case "digital-write":
      return {
        id,
        title: `${componentLabel(project, step.componentId)} goes ${String(step.value)}`,
        detail: `${signalLabel(connections, step.componentId)} changes state and the output should ${step.value === "LOW" || step.value === false ? "turn off" : "turn on"}.`,
        tone: "output"
      };
    case "analog-write":
      return {
        id,
        title: `${componentLabel(project, step.componentId)} gets PWM ${step.value}`,
        detail: `${signalLabel(connections, step.componentId)} pulses quickly to control brightness or speed.`,
        tone: "output"
      };
    case "delay":
      return {
        id,
        title: `Wait ${step.ms} ms`,
        detail: "The board holds the current circuit state before the next block runs.",
        tone: "wait"
      };
    case "serial-print":
      return {
        id,
        title: "Print serial text",
        detail: `${JSON.stringify(step.value)} appears in the serial console${step.newline === false ? "" : " on a new line"}.`,
        tone: "serial"
      };
    case "button-controls-led":
      return {
        id,
        title: "Button drives LED",
        detail: `${componentLabel(project, step.buttonId)} is read, then ${componentLabel(project, step.ledId)} follows the press.`,
        tone: "input"
      };
    case "potentiometer-controls-servo":
      return {
        id,
        title: "Knob sweeps servo",
        detail: `${componentLabel(project, step.potentiometerId)} maps 0-1023 into a servo angle for ${componentLabel(project, step.servoId)}.`,
        tone: "motion"
      };
    case "servo-write":
      return {
        id,
        title: `Servo moves to ${step.angle}`,
        detail: `${componentLabel(project, step.componentId)} should rotate to the requested angle.`,
        tone: "motion"
      };
    case "rgb-write":
      return {
        id,
        title: "RGB color changes",
        detail: `${componentLabel(project, step.componentId)} mixes red ${step.red}, green ${step.green}, blue ${step.blue}.`,
        tone: "output"
      };
    case "ultrasonic-serial":
      return {
        id,
        title: "Distance reading",
        detail: `${componentLabel(project, step.componentId)} sends trigger and echo timing, then prints centimeters.`,
        tone: "serial"
      };
    case "dht-serial":
      return {
        id,
        title: "Weather reading",
        detail: `${componentLabel(project, step.componentId)} reads temperature and humidity for serial output.`,
        tone: "serial"
      };
    case "lcd-print":
    case "oled-print":
      return {
        id,
        title: "Display text",
        detail: `${componentLabel(project, step.componentId)} shows ${JSON.stringify(step.text)}.`,
        tone: "display"
      };
    case "neopixel-fill":
      return {
        id,
        title: "NeoPixels update",
        detail: `${componentLabel(project, step.componentId)} fills with red ${step.red}, green ${step.green}, blue ${step.blue}.`,
        tone: "output"
      };
    case "tone":
      return {
        id,
        title: `Tone ${step.frequency} Hz`,
        detail: `${componentLabel(project, step.componentId)} plays for ${step.duration ?? 250} ms.`,
        tone: "output"
      };
    case "relay-write":
      return {
        id,
        title: `Relay ${String(step.value)}`,
        detail: `${componentLabel(project, step.componentId)} switches the connected load path.`,
        tone: "output"
      };
    case "read-analog-serial":
    case "read-digital-serial":
    case "ir-read-serial":
      return {
        id,
        title: "Sensor serial reading",
        detail: `${componentLabel(project, step.componentId)} is read and printed for debugging.`,
        tone: "serial"
      };
    default:
      return {
        id,
        title: "Run block",
        detail: "The next generated Arduino C++ statement runs.",
        tone: "output"
      };
  }
}

function createEvents(project: ProjectDocument, connections: WiringCanvasConnection[]) {
  return project.program.map((step, index) => eventFromStep(step, index, project, connections)).slice(0, 10);
}

function highState(value: "HIGH" | "LOW" | boolean) {
  return value === "HIGH" || value === true;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function metadataText(simulation: CircuitStudioBenchSimulation, key: string, fallback = "") {
  const value = simulation.metadata[key];
  return typeof value === "string" ? value : fallback;
}

function metadataNumber(simulation: CircuitStudioBenchSimulation, key: string, fallback = 0) {
  const value = simulation.metadata[key];
  return typeof value === "number" ? value : fallback;
}

function controlNumber(values: Record<string, CircuitStudioBenchControlValue>, id: string, fallback: number) {
  const value = values[id];
  return typeof value === "number" ? value : fallback;
}

function controlBoolean(values: Record<string, CircuitStudioBenchControlValue>, id: string, fallback: boolean) {
  const value = values[id];
  return typeof value === "boolean" ? value : fallback;
}

function controlString(values: Record<string, CircuitStudioBenchControlValue>, id: string, fallback: string) {
  const value = values[id];
  return typeof value === "string" ? value : fallback;
}

function reading(id: string, label: string, value: string, tone: CircuitStudioBenchTestTone): CircuitStudioBenchReading {
  return { id, label, value, tone };
}

export function defaultBenchControlValues(test: CircuitStudioBenchTest) {
  return Object.fromEntries(test.simulation.controls.map((control) => [control.id, control.defaultValue])) as Record<string, CircuitStudioBenchControlValue>;
}

export function simulateBenchReadings(test: CircuitStudioBenchTest, values: Record<string, CircuitStudioBenchControlValue> = defaultBenchControlValues(test)) {
  const simulation = test.simulation;
  switch (simulation.kind) {
    case "digital-output": {
      const state = controlBoolean(values, "state", Boolean(simulation.metadata.defaultState));
      return [reading("state", metadataText(simulation, "componentLabel", "Output"), state ? "ON / HIGH" : "OFF / LOW", "output")];
    }
    case "analog-output": {
      const pwm = Math.round(clamp(controlNumber(values, "pwm", metadataNumber(simulation, "defaultPwm", 128)), 0, 255));
      return [
        reading("pwm", "PWM value", String(pwm), "output"),
        reading("strength", metadataText(simulation, "componentLabel", "Output"), `${Math.round((pwm / 255) * 100)}% power`, "output")
      ];
    }
    case "serial-print":
      return [reading("serial", "Serial Monitor", metadataText(simulation, "text", ""), "serial")];
    case "analog-serial": {
      const analog = Math.round(clamp(controlNumber(values, "analog", 512), 0, 1023));
      return [reading("serial", "Serial Monitor", `${metadataText(simulation, "componentLabel", "Analog input")}: ${analog}`, "serial")];
    }
    case "digital-serial": {
      const state = controlBoolean(values, "state", false);
      return [reading("serial", "Serial Monitor", `${metadataText(simulation, "componentLabel", "Digital input")}: ${state ? "HIGH" : "LOW"}`, "serial")];
    }
    case "button-led": {
      const pressed = controlBoolean(values, "pressed", false);
      return [
        reading("button", metadataText(simulation, "buttonLabel", "Button"), pressed ? "LOW pressed" : "HIGH released", "input"),
        reading("led", metadataText(simulation, "ledLabel", "LED"), pressed ? "ON" : "OFF", "output")
      ];
    }
    case "servo-knob": {
      const analog = Math.round(clamp(controlNumber(values, "analog", 512), 0, 1023));
      const angle = Math.round((analog / 1023) * 180);
      return [
        reading("analog", metadataText(simulation, "potLabel", "Knob"), String(analog), "input"),
        reading("angle", metadataText(simulation, "servoLabel", "Servo"), `${angle} deg`, "motion")
      ];
    }
    case "servo-angle": {
      const angle = Math.round(clamp(controlNumber(values, "angle", metadataNumber(simulation, "angle", 90)), 0, 180));
      return [reading("angle", metadataText(simulation, "componentLabel", "Servo"), `${angle} deg`, "motion")];
    }
    case "rgb-output": {
      const red = Math.round(clamp(controlNumber(values, "red", metadataNumber(simulation, "red", 0)), 0, 255));
      const green = Math.round(clamp(controlNumber(values, "green", metadataNumber(simulation, "green", 0)), 0, 255));
      const blue = Math.round(clamp(controlNumber(values, "blue", metadataNumber(simulation, "blue", 0)), 0, 255));
      return [reading("rgb", metadataText(simulation, "componentLabel", "RGB LED"), `rgb(${red}, ${green}, ${blue})`, "output")];
    }
    case "ultrasonic": {
      const distance = Math.round(clamp(controlNumber(values, "distance", 42), 2, 400));
      return [
        reading("echo", "Echo time", `${Math.round(distance * 58)} us`, "input"),
        reading("serial", "Serial Monitor", `distance_cm: ${distance}`, "serial")
      ];
    }
    case "dht": {
      const tempC = Math.round(clamp(controlNumber(values, "tempC", 22), -10, 50));
      const humidity = Math.round(clamp(controlNumber(values, "humidity", 45), 0, 100));
      return [
        reading("temp", "temperature_c", `${tempC} C`, "serial"),
        reading("humidity", "humidity", `${humidity}%`, "serial")
      ];
    }
    case "display-text":
      return [reading("display", metadataText(simulation, "componentLabel", "Display"), metadataText(simulation, "text", ""), "display")];
    case "neopixel": {
      const red = Math.round(clamp(controlNumber(values, "red", metadataNumber(simulation, "red", 0)), 0, 255));
      const green = Math.round(clamp(controlNumber(values, "green", metadataNumber(simulation, "green", 0)), 0, 255));
      const blue = Math.round(clamp(controlNumber(values, "blue", metadataNumber(simulation, "blue", 0)), 0, 255));
      return [reading("pixels", metadataText(simulation, "componentLabel", "NeoPixels"), `all pixels rgb(${red}, ${green}, ${blue})`, "output")];
    }
    case "tone": {
      const frequency = Math.round(clamp(controlNumber(values, "frequency", metadataNumber(simulation, "frequency", 440)), 31, 4978));
      const duration = Math.round(clamp(controlNumber(values, "duration", metadataNumber(simulation, "duration", 250)), 50, 2000));
      return [reading("tone", metadataText(simulation, "componentLabel", "Buzzer"), `${frequency} Hz for ${duration} ms`, "output")];
    }
    case "relay": {
      const state = controlBoolean(values, "state", Boolean(simulation.metadata.defaultState));
      return [reading("relay", metadataText(simulation, "componentLabel", "Relay"), state ? "closed / energized" : "open / relaxed", "output")];
    }
    case "ir-serial": {
      const code = controlString(values, "code", "0xFFA25D");
      return [reading("serial", "Serial Monitor", `IR code: ${code}`, "serial")];
    }
    default:
      return [];
  }
}

function withReadings(test: Omit<CircuitStudioBenchTest, "readings">): CircuitStudioBenchTest {
  const fullTest = { ...test, readings: [] };
  return { ...fullTest, readings: simulateBenchReadings(fullTest) };
}

function numericValue(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function simulationFromStep(step: ProgramStep, project: ProjectDocument): CircuitStudioBenchSimulation | undefined {
  switch (step.kind) {
    case "digital-write": {
      const isHigh = highState(step.value);
      return {
        kind: "digital-output",
        controls: [{ id: "state", label: "Pin state", kind: "toggle", defaultValue: isHigh, offLabel: "LOW", onLabel: "HIGH" }],
        metadata: { componentLabel: componentLabel(project, step.componentId), defaultState: isHigh }
      };
    }
    case "analog-write": {
      const defaultPwm = clamp(Math.round(numericValue(step.value, 128)), 0, 255);
      return {
        kind: "analog-output",
        controls: [
          { id: "pwm", label: "PWM", kind: "range", min: 0, max: 255, step: 1, defaultValue: defaultPwm, lowLabel: "off", highLabel: "full" }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId), defaultPwm }
      };
    }
    case "serial-print":
      return {
        kind: "serial-print",
        controls: [],
        metadata: { text: String(step.value) }
      };
    case "read-analog-serial":
      return {
        kind: "analog-serial",
        controls: [
          {
            id: "analog",
            label: "Analog value",
            kind: "range",
            min: 0,
            max: 1023,
            step: 1,
            defaultValue: 512,
            lowLabel: "0",
            highLabel: "1023"
          }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId) }
      };
    case "read-digital-serial":
      return {
        kind: "digital-serial",
        controls: [{ id: "state", label: "Digital input", kind: "toggle", defaultValue: false, offLabel: "LOW", onLabel: "HIGH" }],
        metadata: { componentLabel: componentLabel(project, step.componentId) }
      };
    case "button-controls-led":
      return {
        kind: "button-led",
        controls: [{ id: "pressed", label: "Button", kind: "toggle", defaultValue: false, offLabel: "Released", onLabel: "Pressed" }],
        metadata: {
          buttonLabel: componentLabel(project, step.buttonId),
          ledLabel: componentLabel(project, step.ledId)
        }
      };
    case "potentiometer-controls-servo":
      return {
        kind: "servo-knob",
        controls: [
          {
            id: "analog",
            label: "Knob value",
            kind: "range",
            min: 0,
            max: 1023,
            step: 1,
            defaultValue: 512,
            lowLabel: "0 deg",
            highLabel: "180 deg"
          }
        ],
        metadata: {
          potLabel: componentLabel(project, step.potentiometerId),
          servoLabel: componentLabel(project, step.servoId)
        }
      };
    case "servo-write": {
      const angle = clamp(Math.round(numericValue(step.angle, 90)), 0, 180);
      return {
        kind: "servo-angle",
        controls: [
          { id: "angle", label: "Servo angle", kind: "range", min: 0, max: 180, step: 1, defaultValue: angle, unit: "deg", lowLabel: "0", highLabel: "180" }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId), angle }
      };
    }
    case "rgb-write":
      return {
        kind: "rgb-output",
        controls: [
          { id: "red", label: "Red", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.red },
          { id: "green", label: "Green", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.green },
          { id: "blue", label: "Blue", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.blue }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId), red: step.red, green: step.green, blue: step.blue }
      };
    case "ultrasonic-serial":
      return {
        kind: "ultrasonic",
        controls: [
          {
            id: "distance",
            label: "Target distance",
            kind: "range",
            min: 2,
            max: 400,
            step: 1,
            defaultValue: 42,
            unit: "cm",
            lowLabel: "close",
            highLabel: "far"
          }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId) }
      };
    case "dht-serial":
      return {
        kind: "dht",
        controls: [
          { id: "tempC", label: "Temperature", kind: "range", min: -10, max: 50, step: 1, defaultValue: 22, unit: "C", lowLabel: "cold", highLabel: "hot" },
          { id: "humidity", label: "Humidity", kind: "range", min: 0, max: 100, step: 1, defaultValue: 45, unit: "%", lowLabel: "dry", highLabel: "humid" }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId) }
      };
    case "lcd-print":
    case "oled-print":
      return {
        kind: "display-text",
        controls: [],
        metadata: { componentLabel: componentLabel(project, step.componentId), text: step.text }
      };
    case "neopixel-fill":
      return {
        kind: "neopixel",
        controls: [
          { id: "red", label: "Red", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.red },
          { id: "green", label: "Green", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.green },
          { id: "blue", label: "Blue", kind: "range", min: 0, max: 255, step: 1, defaultValue: step.blue }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId), red: step.red, green: step.green, blue: step.blue }
      };
    case "tone":
      return {
        kind: "tone",
        controls: [
          {
            id: "frequency",
            label: "Frequency",
            kind: "range",
            min: 31,
            max: 4978,
            step: 1,
            defaultValue: step.frequency,
            unit: "Hz",
            lowLabel: "low",
            highLabel: "high"
          },
          {
            id: "duration",
            label: "Duration",
            kind: "range",
            min: 50,
            max: 2000,
            step: 10,
            defaultValue: step.duration ?? 250,
            unit: "ms",
            lowLabel: "short",
            highLabel: "long"
          }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId), frequency: step.frequency, duration: step.duration ?? 250 }
      };
    case "relay-write": {
      const isHigh = highState(step.value);
      return {
        kind: "relay",
        controls: [{ id: "state", label: "Relay input", kind: "toggle", defaultValue: isHigh, offLabel: "LOW", onLabel: "HIGH" }],
        metadata: { componentLabel: componentLabel(project, step.componentId), defaultState: isHigh }
      };
    }
    case "ir-read-serial":
      return {
        kind: "ir-serial",
        controls: [
          {
            id: "code",
            label: "Remote button",
            kind: "choice",
            defaultValue: "0xFFA25D",
            options: [
              { value: "0xFFA25D", label: "Power" },
              { value: "0xFF629D", label: "Up" },
              { value: "0xFF22DD", label: "Left" }
            ]
          }
        ],
        metadata: { componentLabel: componentLabel(project, step.componentId) }
      };
    case "delay":
      return undefined;
    default:
      return undefined;
  }
}

function benchTestFromStep(step: ProgramStep, index: number, project: ProjectDocument, connections: WiringCanvasConnection[]): CircuitStudioBenchTest | undefined {
  const id = `bench-${index}-${step.kind}`;
  const simulation = simulationFromStep(step, project);
  if (!simulation) return undefined;
  const create = (test: Omit<CircuitStudioBenchTest, "simulation" | "readings">) => withReadings({ ...test, simulation });
  switch (step.kind) {
    case "digital-write": {
      const isHigh = highState(step.value);
      return create({
        id,
        title: `Watch ${componentLabel(project, step.componentId)}`,
        setup: `Force ${signalLabel(connections, step.componentId)} ${isHigh ? "HIGH" : "LOW"} in the bench.`,
        expected: `${componentLabel(project, step.componentId)} should ${isHigh ? "turn on or energize" : "turn off or relax"}.`,
        tone: "output"
      });
    }
    case "analog-write":
      return create({
        id,
        title: `Sweep ${componentLabel(project, step.componentId)}`,
        setup: `Try PWM 0, 128, and ${step.value} on ${signalLabel(connections, step.componentId)}.`,
        expected: "Brightness, speed, or output strength should rise smoothly as PWM increases.",
        tone: "output"
      });
    case "serial-print":
      return create({
        id,
        title: "Open Serial Monitor",
        setup: "Start the bench serial console at the sketch baud rate.",
        expected: `${JSON.stringify(step.value)} should print${step.newline === false ? "" : " on its own line"}.`,
        tone: "serial"
      });
    case "read-analog-serial":
      return create({
        id,
        title: `Move ${componentLabel(project, step.componentId)}`,
        setup: "Drag the analog test value from 0 to 1023.",
        expected: `${componentLabel(project, step.componentId)} readings should stream as changing serial values.`,
        tone: "serial"
      });
    case "read-digital-serial":
      return create({
        id,
        title: `Toggle ${componentLabel(project, step.componentId)}`,
        setup: "Flip the digital test state between LOW and HIGH.",
        expected: `${componentLabel(project, step.componentId)} should print the matching digital state.`,
        tone: "serial"
      });
    case "button-controls-led":
      return create({
        id,
        title: "Press the button",
        setup: `${componentLabel(project, step.buttonId)} reads LOW while pressed, then HIGH when released.`,
        expected: `${componentLabel(project, step.ledId)} turns on during the press and turns off after release.`,
        tone: "input"
      });
    case "potentiometer-controls-servo":
      return create({
        id,
        title: "Turn the knob",
        setup: `${componentLabel(project, step.potentiometerId)} moves through 0, 512, and 1023.`,
        expected: `${componentLabel(project, step.servoId)} should sweep near 0, 90, and 180 degrees.`,
        tone: "motion"
      });
    case "servo-write":
      return create({
        id,
        title: `Check ${componentLabel(project, step.componentId)}`,
        setup: `Set the bench servo angle to ${step.angle}.`,
        expected: `${componentLabel(project, step.componentId)} should rotate to the requested position without jitter.`,
        tone: "motion"
      });
    case "rgb-write":
      return create({
        id,
        title: "Preview RGB mix",
        setup: `Set red ${step.red}, green ${step.green}, and blue ${step.blue}.`,
        expected: `${componentLabel(project, step.componentId)} should show the same blended color.`,
        tone: "output"
      });
    case "ultrasonic-serial":
      return create({
        id,
        title: "Move the target",
        setup: "Try close, middle, and far target distances in centimeters.",
        expected: `${componentLabel(project, step.componentId)} should print distance_cm values that follow the target.`,
        tone: "serial"
      });
    case "dht-serial":
      return create({
        id,
        title: "Change room weather",
        setup: "Try cool/dry, room, and warm/humid readings.",
        expected: `${componentLabel(project, step.componentId)} should print temperature and humidity without NaN errors.`,
        tone: "serial"
      });
    case "lcd-print":
    case "oled-print":
      return create({
        id,
        title: "Read the display",
        setup: `Clear the screen, then write ${JSON.stringify(step.text)}.`,
        expected: `${componentLabel(project, step.componentId)} should show the text without clipping.`,
        tone: "display"
      });
    case "neopixel-fill":
      return create({
        id,
        title: "Preview strip color",
        setup: `Fill the strip with RGB(${step.red}, ${step.green}, ${step.blue}).`,
        expected: `${componentLabel(project, step.componentId)} should light every pixel with the chosen color.`,
        tone: "output"
      });
    case "tone":
      return create({
        id,
        title: "Listen for tone",
        setup: `Play ${step.frequency} Hz for ${step.duration ?? 250} ms.`,
        expected: `${componentLabel(project, step.componentId)} should chirp once at the chosen pitch.`,
        tone: "output"
      });
    case "relay-write": {
      const isHigh = highState(step.value);
      return create({
        id,
        title: `Switch ${componentLabel(project, step.componentId)}`,
        setup: `Set the relay control pin ${isHigh ? "HIGH" : "LOW"}.`,
        expected: `${componentLabel(project, step.componentId)} should ${isHigh ? "click closed" : "open"} in the bench preview.`,
        tone: "output"
      });
    }
    case "ir-read-serial":
      return create({
        id,
        title: "Send an IR code",
        setup: "Pick a remote button code in the bench input.",
        expected: `${componentLabel(project, step.componentId)} should print the received code in serial.`,
        tone: "serial"
      });
    case "delay":
      return undefined;
    default:
      return undefined;
  }
}

function createBenchTests(project: ProjectDocument, connections: WiringCanvasConnection[]) {
  return project.program
    .map((step, index) => benchTestFromStep(step, index, project, connections))
    .filter((test): test is CircuitStudioBenchTest => Boolean(test))
    .slice(0, 6);
}

function simulatorCoveragePercent(project: ProjectDocument, supportedParts: number, benchTests: CircuitStudioBenchTest[]) {
  if (project.components.length === 0 && project.program.length === 0) return 0;
  const partCoverage = project.components.length === 0 ? 1 : supportedParts / project.components.length;
  const behaviorSteps = project.program.filter((step) => step.kind !== "delay").length;
  const behaviorCoverage = behaviorSteps === 0 ? 0 : Math.min(1, benchTests.length / behaviorSteps);
  return Math.round(((partCoverage + behaviorCoverage) / 2) * 100);
}

function createSimulatorPlan(input: CircuitStudioInput, benchTests: CircuitStudioBenchTest[]): CircuitStudioSimulatorPlan {
  const unsupportedParts = unsupportedWokwiComponents(input.project, input.definitions);
  const supportedParts = Math.max(0, input.project.components.length - unsupportedParts.length);
  const errors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const hasHardware = input.project.components.length > 0;
  const hasBehavior = input.project.program.length > 0;
  const coveragePercent = simulatorCoveragePercent(input.project, supportedParts, benchTests);
  const items: CircuitStudioSimulatorItem[] = [];

  if (errors.length > 0) {
    items.push({
      id: "fix-wiring",
      tone: "blocked",
      title: "Fix wiring before simulation",
      detail: `${errors.length} wiring error${errors.length === 1 ? "" : "s"} can make the virtual test misleading.`
    });
  }

  if (supportedParts > 0) {
    items.push({
      id: "wokwi-export",
      tone: unsupportedParts.length > 0 ? "partial" : "ready",
      title: unsupportedParts.length > 0 ? "Export the supported parts" : "Wokwi package is ready",
      detail:
        unsupportedParts.length > 0
          ? `${supportedParts} part${supportedParts === 1 ? "" : "s"} can be exported now; add ${unsupportedParts.join(", ")} manually in Wokwi.`
          : "Download the Wokwi project to test the sketch and diagram before wiring the real board."
    });
  } else if (hasHardware) {
    items.push({
      id: "manual-simulator",
      tone: "partial",
      title: "Manual simulator setup needed",
      detail: `Add ${unsupportedParts.join(", ")} manually in Wokwi, then paste the generated Arduino C++.`
    });
  }

  if (benchTests.length > 0) {
    items.push({
      id: "bench-tests",
      tone: warnings.length > 0 ? "partial" : "ready",
      title: "Run the bench tests",
      detail: `${benchTests.length} virtual check${benchTests.length === 1 ? "" : "s"} can be tried here before upload.`
    });
  } else if (hasBehavior) {
    items.push({
      id: "bench-gap",
      tone: "partial",
      title: "Code preview only",
      detail: "This sketch can be exported, but the current blocks do not have an interactive bench control yet."
    });
  } else {
    items.push({
      id: "add-code",
      tone: "partial",
      title: "Add code to simulate behavior",
      detail: "Place behavior blocks so Circuit Studio can show expected sensor, output, or serial readings."
    });
  }

  if (!hasHardware) {
    items.unshift({
      id: "add-hardware",
      tone: "partial",
      title: "Add parts to plan a circuit",
      detail: "Choose a starter project or add hardware before opening a virtual simulator."
    });
  }

  const tone: CircuitStudioSimulatorTone =
    errors.length > 0
      ? "blocked"
      : !hasHardware || !hasBehavior || unsupportedParts.length > 0 || warnings.length > 0 || benchTests.length === 0
        ? "partial"
        : "ready";

  return {
    tone,
    title: tone === "ready" ? "Ready to simulate" : tone === "blocked" ? "Fix before simulating" : "Partial simulator plan",
    detail:
      tone === "ready"
        ? "The wiring, Wokwi export, and bench checks line up for a virtual test."
        : tone === "blocked"
          ? "Repair the circuit checks first so the simulator matches the real build."
          : "Some pieces are ready now; review the notes before trusting the virtual result.",
    coveragePercent,
    supportedParts,
    unsupportedParts,
    virtualTests: benchTests.length,
    items
  };
}

function connectionPinList(connections: WiringCanvasConnection[]) {
  const labels = Array.from(new Set(connections.map((connection) => connection.boardPinLabel))).slice(0, 5);
  return labels.length > 0 ? labels.join(", ") : "no pins";
}

function isGroundConnection(connection: WiringCanvasConnection) {
  return connection.boardPinId.toUpperCase().includes("GND") || connection.boardPinLabel.toUpperCase().includes("GND");
}

function createBreadboardPlan(input: CircuitStudioInput): CircuitStudioBreadboardPlan {
  const errors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const connections = input.wiringCanvas.connections;
  const powerConnections = connections.filter((connection) => connection.boardPinKind === "power" && !isGroundConnection(connection));
  const groundConnections = connections.filter((connection) => connection.boardPinKind === "power" && isGroundConnection(connection));
  const signalConnections = connections.filter((connection) => ["digital", "analog"].includes(connection.boardPinKind));
  const busConnections = connections.filter((connection) => connection.boardPinKind === "bus");
  const definitionsById = componentDefinitionMap(input.definitions);
  const simulatorHints = Array.from(
    new Set(input.project.components.flatMap((component) => definitionsById.get(component.componentId)?.simulatorHints ?? []))
  ).slice(0, 4);
  const items: CircuitStudioBreadboardItem[] = [];

  if (input.project.components.length === 0) {
    items.push({
      id: "add-hardware",
      tone: "warning",
      title: "Pick parts first",
      detail: "Add a starter project or hardware part so the breadboard plan can map real pins."
    });
  }

  if (errors.length > 0) {
    items.push({
      id: "repair-errors",
      tone: "blocked",
      title: "Repair pin errors",
      detail: `${errors.length} wiring error${errors.length === 1 ? "" : "s"} must be fixed before the physical circuit will match the sketch.`
    });
  }

  if (powerConnections.length > 0 || groundConnections.length > 0) {
    items.push({
      id: "rails-first",
      tone: errors.length > 0 ? "blocked" : "ready",
      title: "Build rails first",
      detail: `${powerConnections.length} power wire${powerConnections.length === 1 ? "" : "s"} and ${groundConnections.length} ground wire${groundConnections.length === 1 ? "" : "s"} should be placed before signal wires.`
    });
  } else if (input.project.components.length > 0) {
    items.push({
      id: "no-rails",
      tone: "ready",
      title: "No power rail needed",
      detail: "This circuit only needs signal or ground-style connections, so keep the layout simple."
    });
  }

  if (signalConnections.length > 0) {
    items.push({
      id: "signal-route",
      tone: warnings.length > 0 ? "warning" : errors.length > 0 ? "blocked" : "ready",
      title: "Route signal wires",
      detail: `${signalConnections.length} signal wire${signalConnections.length === 1 ? "" : "s"} land on ${connectionPinList(signalConnections)}.`
    });
  }

  if (busConnections.length > 0) {
    items.push({
      id: "bus-route",
      tone: warnings.length > 0 ? "warning" : errors.length > 0 ? "blocked" : "ready",
      title: "Keep bus pairs together",
      detail: `${connectionPinList(busConnections)} should stay paired and short for I2C or bus modules.`
    });
  }

  if (warnings.length > 0) {
    items.push({
      id: "review-warnings",
      tone: "warning",
      title: "Review warning notes",
      detail: `${warnings.length} warning${warnings.length === 1 ? "" : "s"} may still work, but students should resolve or understand them before upload.`
    });
  }

  if (simulatorHints.length > 0) {
    items.push({
      id: "simulator-stand-ins",
      tone: errors.length > 0 ? "blocked" : "ready",
      title: "Use simulator stand-ins",
      detail: simulatorHints[0] ?? "Use the component hints from this pack when building the virtual circuit."
    });
  }

  const tone: CircuitStudioBreadboardTone = errors.length > 0 ? "blocked" : warnings.length > 0 || input.project.components.length === 0 ? "warning" : "ready";

  return {
    tone,
    title: tone === "ready" ? "Ready to breadboard" : tone === "blocked" ? "Fix before breadboard" : "Review before breadboard",
    detail:
      tone === "ready"
        ? "Wire rails first, add signal leads, then run the bench test before upload."
        : tone === "blocked"
          ? "The physical build would not match the board pin map yet."
          : "A teacher or student should review the notes before trusting the circuit.",
    powerWires: powerConnections.length,
    groundWires: groundConnections.length,
    signalWires: signalConnections.length,
    busWires: busConnections.length,
    simulatorHints,
    items
  };
}

export function createCircuitStudioModel(input: CircuitStudioInput): CircuitStudioModel {
  const placements = createPlacements(input.project, input.definitions);
  const wires = createWires(input.wiringCanvas.connections, placements);
  const benchTests = createBenchTests(input.project, input.wiringCanvas.connections);
  const powerWires = input.wiringCanvas.connections.filter((connection) => connection.boardPinKind === "power").length;
  const signalWires = input.wiringCanvas.connections.filter((connection) => ["digital", "analog", "bus"].includes(connection.boardPinKind)).length;
  const errors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  return {
    boardName: input.board?.name ?? input.project.boardId,
    projectName: input.project.name,
    placements,
    wires,
    steps: createSteps(input),
    events: createEvents(input.project, input.wiringCanvas.connections),
    benchTests,
    simulatorPlan: createSimulatorPlan(input, benchTests),
    breadboardPlan: createBreadboardPlan(input),
    stats: {
      components: input.project.components.length,
      wires: input.wiringCanvas.connections.length,
      powerWires,
      signalWires,
      warnings,
      errors
    }
  };
}
