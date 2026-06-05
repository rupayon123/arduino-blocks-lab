import type { BoardDefinition, ComponentDefinition, ProgramStep, ProjectDocument } from "@abl/block-schema";
import type { WiringDiagnostic } from "./wiringDiagnostics";
import type { WiringCanvasConnection, WiringCanvasModel, WiringCanvasPinKind, WiringCanvasStatus } from "./wiringCanvas";

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

export type CircuitStudioModel = {
  boardName: string;
  projectName: string;
  placements: CircuitStudioPlacement[];
  wires: CircuitStudioWire[];
  steps: CircuitStudioStep[];
  events: CircuitStudioEvent[];
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
  return project.components.map((component, index) => {
    const definition = definitionsById.get(component.componentId);
    const category = definition?.category ?? "unknown";
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

export function createCircuitStudioModel(input: CircuitStudioInput): CircuitStudioModel {
  const placements = createPlacements(input.project, input.definitions);
  const wires = createWires(input.wiringCanvas.connections, placements);
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
