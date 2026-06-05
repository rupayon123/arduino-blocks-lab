import type { ComponentInstance, ProjectDocument, PinValue } from "@abl/block-schema";
import { components as defaultComponents } from "@abl/catalog";

export type WokwiPart = {
  type: string;
  id: string;
  top: number;
  left: number;
  attrs: Record<string, string | number | boolean>;
};

export type WokwiDiagram = {
  version: 1;
  author: string;
  editor: "wokwi";
  parts: WokwiPart[];
  connections: Array<[string, string, string, string[]]>;
};

const signalColors = ["green", "orange", "blue", "purple", "magenta", "cyan"];

function normalizePin(value: PinValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const raw = String(value).trim();
  const digital = raw.match(/^D(\d+)$/i);
  return digital?.[1] ?? raw;
}

function digitalBoardPin(value: PinValue | undefined) {
  const pin = normalizePin(value);
  return pin ? `uno:${pin}` : undefined;
}

function analogBoardPin(value: PinValue | undefined) {
  const pin = normalizePin(value);
  return pin ? `uno:${pin}` : undefined;
}

function componentId(instance: ComponentInstance) {
  return instance.id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function pushConnection(connections: WokwiDiagram["connections"], from: string | undefined, to: string | undefined, color: string) {
  if (from && to) connections.push([from, to, color, []]);
}

function emitComponent(instance: ComponentInstance, index: number, connections: WokwiDiagram["connections"]): WokwiPart | undefined {
  const id = componentId(instance);
  const left = 260 + (index % 2) * 190;
  const top = -120 + Math.floor(index / 2) * 150;
  const color = signalColors[index % signalColors.length] ?? "green";

  switch (instance.componentId) {
    case "led":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:A`, color);
      pushConnection(connections, "uno:GND.1", `${id}:C`, "black");
      return { type: "wokwi-led", id, top, left, attrs: { color: "red" } };
    case "rgb-led":
      pushConnection(connections, digitalBoardPin(instance.pins.red), `${id}:R`, "red");
      pushConnection(connections, digitalBoardPin(instance.pins.green), `${id}:G`, "green");
      pushConnection(connections, digitalBoardPin(instance.pins.blue), `${id}:B`, "blue");
      pushConnection(connections, "uno:GND.1", `${id}:COM`, "black");
      return { type: "wokwi-rgb-led", id, top, left, attrs: { common: "cathode" } };
    case "button":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:1.l`, color);
      pushConnection(connections, "uno:GND.1", `${id}:2.l`, "black");
      return { type: "wokwi-pushbutton", id, top, left, attrs: {} };
    case "potentiometer":
      pushConnection(connections, analogBoardPin(instance.pins.signal), `${id}:SIG`, color);
      pushConnection(connections, "uno:5V", `${id}:VCC`, "red");
      pushConnection(connections, "uno:GND.1", `${id}:GND`, "black");
      return { type: "wokwi-potentiometer", id, top, left, attrs: {} };
    case "buzzer":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:1`, color);
      pushConnection(connections, "uno:GND.1", `${id}:2`, "black");
      return { type: "wokwi-buzzer", id, top, left, attrs: {} };
    case "servo":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:PWM`, color);
      pushConnection(connections, "uno:5V", `${id}:V+`, "red");
      pushConnection(connections, "uno:GND.1", `${id}:GND`, "black");
      return { type: "wokwi-servo", id, top, left, attrs: {} };
    case "ultrasonic-hcsr04":
      pushConnection(connections, digitalBoardPin(instance.pins.trigger), `${id}:TRIG`, "green");
      pushConnection(connections, digitalBoardPin(instance.pins.echo), `${id}:ECHO`, "blue");
      pushConnection(connections, "uno:5V", `${id}:VCC`, "red");
      pushConnection(connections, "uno:GND.1", `${id}:GND`, "black");
      return { type: "wokwi-hc-sr04", id, top, left, attrs: {} };
    case "dht11":
    case "dht22":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:SDA`, color);
      pushConnection(connections, "uno:5V", `${id}:VCC`, "red");
      pushConnection(connections, "uno:GND.1", `${id}:GND`, "black");
      return { type: "wokwi-dht22", id, top, left, attrs: {} };
    case "neopixel-strip":
      pushConnection(connections, digitalBoardPin(instance.pins.signal), `${id}:DIN`, color);
      pushConnection(connections, "uno:5V", `${id}:VCC`, "red");
      pushConnection(connections, "uno:GND.1", `${id}:GND`, "black");
      return { type: "wokwi-neopixel", id, top, left, attrs: { pixels: Number(instance.pins.count ?? 8) } };
    default:
      return undefined;
  }
}

export function createWokwiDiagram(project: ProjectDocument): WokwiDiagram {
  const connections: WokwiDiagram["connections"] = [];
  const parts: WokwiPart[] = [
    {
      type: "wokwi-arduino-uno",
      id: "uno",
      top: 0,
      left: 0,
      attrs: {}
    }
  ];

  project.components.forEach((instance, index) => {
    const part = emitComponent(instance, index, connections);
    if (part) parts.push(part);
  });

  return {
    version: 1,
    author: "Arduino Blocks Lab",
    editor: "wokwi",
    parts,
    connections
  };
}

export function unsupportedWokwiComponents(project: ProjectDocument): string[] {
  const supported = new Set(["led", "rgb-led", "button", "potentiometer", "buzzer", "servo", "ultrasonic-hcsr04", "dht11", "dht22", "neopixel-strip"]);
  return project.components
    .filter((instance) => !supported.has(instance.componentId))
    .map((instance) => defaultComponents.find((component) => component.id === instance.componentId)?.name ?? instance.componentId);
}
