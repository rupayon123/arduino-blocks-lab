import type { BoardDefinition, ComponentDefinition, ComponentInstance, PinValue, ProjectDocument } from "@abl/block-schema";
import { components as defaultComponents } from "@abl/catalog";

const ignoredPinKeys = new Set(["power", "ground", "address", "type", "count", "columns", "rows", "width", "height"]);
const serialPins = new Set(["0", "1"]);

export type PinPlanChange = {
  componentId: string;
  componentLabel: string;
  pinName: string;
  from: PinValue | undefined;
  to: PinValue;
};

export type PinPlanSkipped = {
  componentId: string;
  componentLabel: string;
  pinName: string;
  reason: string;
};

export type PinPlanResult = {
  project: ProjectDocument;
  changes: PinPlanChange[];
  skipped: PinPlanSkipped[];
};

export type BoardPinUsage = {
  pin: string;
  label: string;
  kind: "digital" | "analog";
  reserved: boolean;
  usedBy: string[];
  conflict: boolean;
};

function normalizeBoardPin(value: PinValue | undefined): string | undefined {
  if (value === undefined || typeof value === "boolean") return undefined;
  if (typeof value === "number") return String(value);
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || ["5V", "3V3", "3.3V", "GND", "VIN", "VCC"].includes(trimmed)) return undefined;
  const digital = trimmed.match(/^D(\d+)$/);
  if (digital?.[1]) return digital[1];
  if (/^A\d+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed;
  return undefined;
}

function boardPinValue(pin: string): PinValue {
  return /^\d+$/.test(pin) ? Number(pin) : pin;
}

function definitionMap(definitions: ComponentDefinition[]) {
  return new Map(definitions.map((definition) => [definition.id, definition]));
}

function pinLabel(definition: ComponentDefinition, pinName: string) {
  return definition.pinLabels[pinName]?.toLowerCase() ?? "";
}

function defaultPin(definition: ComponentDefinition, pinName: string) {
  return normalizeBoardPin(definition.defaultPins[pinName]);
}

function needsPwm(definition: ComponentDefinition, pinName: string) {
  return ["red", "green", "blue", "enable"].includes(pinName) || pinLabel(definition, pinName).includes("pwm");
}

function needsAnalog(definition: ComponentDefinition, pinName: string, board: BoardDefinition) {
  const label = pinLabel(definition, pinName);
  const defaultValue = defaultPin(definition, pinName);
  return label.includes("analog") || Boolean(defaultValue && board.analogPins.includes(defaultValue));
}

function candidatePins(board: BoardDefinition, definition: ComponentDefinition, pinName: string) {
  if (ignoredPinKeys.has(pinName)) return [];
  if (needsAnalog(definition, pinName, board)) return board.analogPins;
  if (needsPwm(definition, pinName)) return board.pwmPins;
  return board.digitalPins;
}

function pickPin(candidates: string[], used: Set<string>) {
  return candidates.find((pin) => !used.has(pin) && !serialPins.has(pin)) ?? candidates.find((pin) => !used.has(pin));
}

function shouldKeepCurrent(current: string | undefined, candidates: string[], used: Set<string>) {
  if (!current || !candidates.includes(current) || used.has(current)) return false;
  if (!serialPins.has(current)) return true;
  return !candidates.some((pin) => !used.has(pin) && !serialPins.has(pin));
}

function assignablePins(instance: ComponentInstance, definition: ComponentDefinition, board: BoardDefinition) {
  return Object.keys(instance.pins).filter((pinName) => candidatePins(board, definition, pinName).length > 0);
}

function componentSortScore(instance: ComponentInstance, definition: ComponentDefinition, board: BoardDefinition) {
  return assignablePins(instance, definition, board).reduce((score, pinName) => {
    if (needsAnalog(definition, pinName, board)) return score + 3;
    if (needsPwm(definition, pinName)) return score + 2;
    return score + 1;
  }, 0);
}

export function autoAssignProjectPins(
  project: ProjectDocument,
  board: BoardDefinition | undefined,
  definitions: ComponentDefinition[] = defaultComponents
): PinPlanResult {
  if (!board) {
    return {
      project,
      changes: [],
      skipped: project.components.map((component) => ({
        componentId: component.id,
        componentLabel: component.label,
        pinName: "board",
        reason: "No board selected."
      }))
    };
  }

  const definitionsById = definitionMap(definitions);
  const used = new Set<string>();
  const changes: PinPlanChange[] = [];
  const skipped: PinPlanSkipped[] = [];
  const componentPins = new Map<string, ComponentInstance>();
  const sortableComponents = project.components
    .map((component, index) => ({ component, definition: definitionsById.get(component.componentId), index }))
    .sort((left, right) => {
      const leftScore = left.definition ? componentSortScore(left.component, left.definition, board) : -1;
      const rightScore = right.definition ? componentSortScore(right.component, right.definition, board) : -1;
      return rightScore - leftScore || left.index - right.index;
    });

  for (const { component, definition } of sortableComponents) {
    if (!definition) {
      skipped.push({
        componentId: component.id,
        componentLabel: component.label,
        pinName: "component",
        reason: `Missing definition for ${component.componentId}.`
      });
      componentPins.set(component.id, component);
      continue;
    }

    const nextPins = { ...component.pins };
    for (const [pinName, pinValue] of Object.entries(component.pins)) {
      const candidates = candidatePins(board, definition, pinName);
      if (candidates.length === 0) continue;

      const current = normalizeBoardPin(pinValue);
      if (shouldKeepCurrent(current, candidates, used)) {
        if (current) used.add(current);
        continue;
      }

      const next = pickPin(candidates, used);
      if (!next) {
        skipped.push({
          componentId: component.id,
          componentLabel: component.label,
          pinName,
          reason: `No free ${needsAnalog(definition, pinName, board) ? "analog" : needsPwm(definition, pinName) ? "PWM" : "digital"} pin.`
        });
        if (current && candidates.includes(current)) used.add(current);
        continue;
      }

      const nextValue = boardPinValue(next);
      nextPins[pinName] = nextValue;
      used.add(next);
      if (String(pinValue) !== String(nextValue)) {
        changes.push({
          componentId: component.id,
          componentLabel: component.label,
          pinName,
          from: pinValue,
          to: nextValue
        });
      }
    }
    componentPins.set(component.id, { ...component, pins: nextPins });
  }

  return {
    project: {
      ...project,
      components: project.components.map((component) => componentPins.get(component.id) ?? component)
    },
    changes,
    skipped
  };
}

export function collectBoardPinUsage(
  project: ProjectDocument,
  board: BoardDefinition | undefined,
  definitions: ComponentDefinition[] = defaultComponents
): BoardPinUsage[] {
  if (!board) return [];

  const definitionsById = definitionMap(definitions);
  const usage = new Map<string, string[]>();

  for (const instance of project.components) {
    const definition = definitionsById.get(instance.componentId);
    for (const [pinName, pinValue] of Object.entries(instance.pins)) {
      if (ignoredPinKeys.has(pinName)) continue;
      const pin = normalizeBoardPin(pinValue);
      if (!pin) continue;
      const label = definition?.pinLabels[pinName] ?? pinName;
      usage.set(pin, [...(usage.get(pin) ?? []), `${instance.label} ${label}`]);
    }
  }

  return [
    ...board.digitalPins.map((pin) => {
      const usedBy = usage.get(pin) ?? [];
      return {
        pin,
        label: `D${pin}`,
        kind: "digital" as const,
        reserved: serialPins.has(pin),
        usedBy,
        conflict: usedBy.length > 1
      };
    }),
    ...board.analogPins.map((pin) => {
      const usedBy = usage.get(pin) ?? [];
      return {
        pin,
        label: pin,
        kind: "analog" as const,
        reserved: false,
        usedBy,
        conflict: usedBy.length > 1
      };
    })
  ];
}
