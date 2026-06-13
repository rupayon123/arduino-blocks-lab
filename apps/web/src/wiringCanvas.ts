import type { BoardDefinition, ComponentDefinition, ComponentInstance, PinValue, ProjectDocument } from "@abl/block-schema";
import { components as defaultComponents } from "@abl/catalog";

export type WiringCanvasPinKind = "digital" | "analog" | "power" | "bus" | "unknown";
export type WiringCanvasStatus = "ok" | "warning" | "error";

export type WiringCanvasConnection = {
  id: string;
  componentId: string;
  componentLabel: string;
  componentName: string;
  componentCategory: ComponentDefinition["category"] | "unknown";
  pinKey: string;
  editable: boolean;
  wireLabel: string;
  wireFrom: string;
  wireTo: string;
  boardPinId: string;
  boardPinLabel: string;
  boardPinKind: WiringCanvasPinKind;
  status: WiringCanvasStatus;
  note?: string;
};

export type WiringCanvasComponent = {
  id: string;
  label: string;
  name: string;
  category: ComponentDefinition["category"] | "unknown";
  connectionCount: number;
  missingDefinition: boolean;
};

export type WiringCanvasModel = {
  boardName: string;
  components: WiringCanvasComponent[];
  connections: WiringCanvasConnection[];
  summary: {
    total: number;
    ok: number;
    warning: number;
    error: number;
  };
};

function pinValue(value: PinValue | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function extractPinNameFromTemplate(template: string) {
  const match = /\{\{pins\.([a-zA-Z0-9_]+)\}\}/g.exec(template);
  return match ? match[1] : null;
}

function renderPinTemplate(template: string, instance: ComponentInstance): string {
  return template.replace(/\{\{pins\.([a-zA-Z0-9_]+)\}\}/g, (_, pinName: string) => pinValue(instance.pins[pinName]));
}

function displayDigitalPin(pin: string) {
  return `D${pin}`;
}

function resolvePowerTarget(upperTarget: string) {
  if (upperTarget.includes("GND")) return { boardPinId: "GND", boardPinLabel: "GND", boardPinKind: "power" as const };
  if (upperTarget.includes("3V3") || upperTarget.includes("3.3V")) {
    return { boardPinId: "3V3", boardPinLabel: "3V3", boardPinKind: "power" as const };
  }
  if (upperTarget.includes("5V") || upperTarget.includes("VCC")) {
    return { boardPinId: "5V", boardPinLabel: upperTarget.includes("EXTERNAL") ? "5V external" : "5V", boardPinKind: "power" as const };
  }
  return undefined;
}

function resolveBoardTarget(target: string, board: BoardDefinition | undefined) {
  const trimmed = target.trim();
  const upper = trimmed.toUpperCase();
  const power = resolvePowerTarget(upper);
  if (power) return { ...power, status: "ok" as const };

  if (upper === "BOARD SDA" || upper === "SDA") {
    const pin = board?.i2cPins?.sda;
    return pin
      ? { boardPinId: pin, boardPinLabel: `SDA ${pin}`, boardPinKind: "bus" as const, status: "ok" as const }
      : { boardPinId: "SDA", boardPinLabel: "SDA", boardPinKind: "bus" as const, status: "error" as const, note: "Board has no SDA pin." };
  }

  if (upper === "BOARD SCL" || upper === "SCL") {
    const pin = board?.i2cPins?.scl;
    return pin
      ? { boardPinId: pin, boardPinLabel: `SCL ${pin}`, boardPinKind: "bus" as const, status: "ok" as const }
      : { boardPinId: "SCL", boardPinLabel: "SCL", boardPinKind: "bus" as const, status: "error" as const, note: "Board has no SCL pin." };
  }

  const analog = upper.match(/^A\d+$/);
  if (analog) {
    const available = Boolean(board?.analogPins.includes(upper));
    return {
      boardPinId: upper,
      boardPinLabel: upper,
      boardPinKind: "analog" as const,
      status: available ? ("ok" as const) : ("error" as const),
      ...(available ? {} : { note: `${upper} is not on ${board?.name ?? "this board"}.` })
    };
  }

  const digital = upper.match(/^D?(\d+)$/);
  if (digital?.[1]) {
    const pin = digital[1];
    const available = Boolean(board?.digitalPins.includes(pin));
    return {
      boardPinId: pin,
      boardPinLabel: displayDigitalPin(pin),
      boardPinKind: "digital" as const,
      status: available ? ("ok" as const) : ("error" as const),
      ...(available ? {} : { note: `${displayDigitalPin(pin)} is not on ${board?.name ?? "this board"}.` })
    };
  }

  return {
    boardPinId: trimmed || "unknown",
    boardPinLabel: trimmed || "Unknown",
    boardPinKind: "unknown" as const,
    status: "warning" as const,
    note: "No board pin target was recognized."
  };
}

function isConflictCandidate(connection: WiringCanvasConnection) {
  return ["digital", "analog"].includes(connection.boardPinKind) && connection.status !== "error";
}

function markSharedPins(connections: WiringCanvasConnection[]): WiringCanvasConnection[] {
  const counts = new Map<string, WiringCanvasConnection[]>();
  for (const connection of connections) {
    if (!isConflictCandidate(connection)) continue;
    const key = `${connection.boardPinKind}:${connection.boardPinId}`;
    counts.set(key, [...(counts.get(key) ?? []), connection]);
  }

  const sharedKeys = new Set(Array.from(counts.entries()).filter(([, values]) => values.length > 1).map(([key]) => key));
  return connections.map((connection) => {
    const key = `${connection.boardPinKind}:${connection.boardPinId}`;
    if (!sharedKeys.has(key) || connection.status === "error") return connection;
    return {
      ...connection,
      status: "warning" as const,
      note: `${connection.boardPinLabel} is shared by multiple signal wires.`
    };
  });
}

export function createWiringCanvasModel(
  project: ProjectDocument,
  board: BoardDefinition | undefined,
  definitions: ComponentDefinition[] = defaultComponents
): WiringCanvasModel {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const components: WiringCanvasComponent[] = [];
  const connections: WiringCanvasConnection[] = [];
  const explicitAssignments = new Map(
    (project.connections ?? []).map((assignment) => [
      `${assignment.componentId}:${assignment.pin}`,
      assignment.boardPin
    ])
  );
  const usedExplicitAssignments = new Set<string>();

  for (const instance of project.components) {
    const definition = definitionsById.get(instance.componentId);
    components.push({
      id: instance.id,
      label: instance.label,
      name: definition?.name ?? instance.componentId,
      category: definition?.category ?? "unknown",
      connectionCount: definition?.wiring.length ?? 0,
      missingDefinition: !definition
    });

    if (!definition) continue;
    for (const [wireIndex, wire] of definition.wiring.entries()) {
      const pinName = extractPinNameFromTemplate(wire.to);
      const explicitKey = pinName ? `${instance.id}:${pinName}` : null;
      const pinKey = pinName ?? `wire-${wireIndex}`;
      const explicitPin = explicitKey ? explicitAssignments.get(explicitKey) : undefined;

      if (pinName) {
        usedExplicitAssignments.add(`${instance.id}:${pinName}`);
      }

      const wireTo = explicitPin ?? renderPinTemplate(wire.to, instance);
      const target = resolveBoardTarget(wireTo, board);
      connections.push({
        id: `${instance.id}-${wireIndex}-${wire.label}`,
        componentId: instance.id,
        componentLabel: instance.label,
        componentName: definition.name,
        componentCategory: definition.category,
        pinKey,
        editable: Boolean(pinName),
        wireLabel: wire.label,
        wireFrom: wire.from,
        wireTo: wireTo,
        boardPinId: target.boardPinId,
        boardPinLabel: target.boardPinLabel,
        boardPinKind: target.boardPinKind,
        status: target.status,
        ...(wire.note || target.note ? { note: wire.note ?? target.note } : {})
      });
    }

    for (const assignment of project.connections ?? []) {
      if (assignment.componentId !== instance.id) continue;
      const explicitKey = `${assignment.componentId}:${assignment.pin}`;
      if (definition.wiring.some((wire) => extractPinNameFromTemplate(wire.to) === assignment.pin)) continue;
      if (usedExplicitAssignments.has(explicitKey)) continue;

      const target = resolveBoardTarget(assignment.boardPin, board);
      connections.push({
        id: `extra-${assignment.id ?? `custom-${instance.id}-${assignment.pin}`}`,
        componentId: instance.id,
        componentLabel: instance.label,
        componentName: definition.name,
        componentCategory: definition.category,
        pinKey: assignment.pin,
        editable: true,
        wireLabel: `${assignment.pin} (custom)`,
        wireFrom: "custom pin",
        wireTo: assignment.boardPin,
        boardPinId: target.boardPinId,
        boardPinLabel: target.boardPinLabel,
        boardPinKind: target.boardPinKind,
        status: target.status,
        ...(assignment.pin in instance.pins ? { note: "Connected from this project's wiring assignment." } : { note: "Custom pin assignment on this project." })
      });
      usedExplicitAssignments.add(explicitKey);
    }
  }

  for (const assignment of project.connections ?? []) {
    if (project.components.some((instance) => instance.id === assignment.componentId)) continue;
    const target = resolveBoardTarget(assignment.boardPin, board);
    const syntheticComponentLabel = `Component ${assignment.componentId}`;
    const syntheticName = "Unknown component";
    const syntheticCategory = "unknown" as const;
    const syntheticPinKey = `${assignment.pin}`;
    const assignmentKey = `${assignment.componentId}:${assignment.pin}`;
    if (usedExplicitAssignments.has(assignmentKey)) continue;

    components.push({
      id: assignment.componentId,
      label: syntheticComponentLabel,
      name: syntheticName,
      category: syntheticCategory,
      connectionCount: 0,
      missingDefinition: true
    });

    connections.push({
      id: `orphan-${assignment.id ?? `${assignment.componentId}-${assignment.pin}`}`,
      componentId: assignment.componentId,
      componentLabel: syntheticComponentLabel,
      componentName: syntheticName,
      componentCategory: syntheticCategory,
      pinKey: syntheticPinKey,
      editable: true,
      wireLabel: `${assignment.pin} (custom)`,
      wireFrom: "custom pin",
      wireTo: assignment.boardPin,
      boardPinId: target.boardPinId,
      boardPinLabel: target.boardPinLabel,
      boardPinKind: target.boardPinKind,
      status: target.status,
      note: "Component no longer has matching catalog definition."
    });
    usedExplicitAssignments.add(assignmentKey);
  }

  const markedConnections = markSharedPins(connections);
  const summary = markedConnections.reduce(
    (current, connection) => ({
      ...current,
      [connection.status]: current[connection.status] + 1
    }),
    { total: markedConnections.length, ok: 0, warning: 0, error: 0 }
  );

  return {
    boardName: board?.name ?? project.boardId,
    components,
    connections: markedConnections,
    summary
  };
}
