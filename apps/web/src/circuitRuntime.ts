import type { ComponentDefinition, ComponentInstance, PinValue, ProjectDocument, SimulationState } from "@abl/block-schema";
import type { ProgramStep } from "@abl/block-schema";

export type CircuitRuntimeSnapshot = {
  pinValues: Record<string, PinValue>;
  componentState: Record<string, Record<string, PinValue>>;
  serialLog: string[];
  running: boolean;
  stepIndex: number;
  delayRemainingMs: number;
  halted?: "done" | "blocked";
  warnings: string[];
};

type PinInput = PinValue | undefined;

type RuntimePinBinding =
  | {
      kind: "component";
      componentId: string;
      pin: string;
    }
  | { kind: "floating" };

type RuntimeFrameRoot = {
  type: "root";
  steps: ProgramStep[];
  index: number;
};

type RuntimeFrameRepeat = {
  type: "repeat";
  steps: ProgramStep[];
  index: number;
  remaining: number;
};

type RuntimeFrameWhile = {
  type: "while";
  steps: ProgramStep[];
  index: number;
  pin: string;
  expected: "HIGH" | "LOW";
  iterations: number;
  maxIterations: number;
};

type RuntimeFrame = RuntimeFrameRoot | RuntimeFrameRepeat | RuntimeFrameWhile;

type RuntimeConfig = {
  project: Pick<ProjectDocument, "components" | "program" | "pinAssignments" | "connections" | "simulationState">;
  definitions: ComponentDefinition[];
  initialState?: SimulationState;
};

export type CircuitRuntimeController = {
  run: (maxOperations?: number, elapsedMs?: number) => CircuitRuntimeSnapshot;
  step: () => CircuitRuntimeSnapshot;
  reset: (state?: SimulationState) => void;
  pause: () => void;
  setInput: (target: string, value: PinValue) => void;
  setInputs: (inputs: Record<string, PinValue>) => void;
  setComponentState: (componentId: string, key: string, value: PinValue) => void;
  getSnapshot: () => CircuitRuntimeSnapshot;
  getPersistedState: () => SimulationState;
  isStopped: () => boolean;
};

type RuntimeState = {
  pinValues: Record<string, PinValue>;
  pinModes: Record<string, "INPUT" | "OUTPUT" | "INPUT_PULLUP">;
  componentState: Record<string, Record<string, PinValue>>;
  serialLog: string[];
  running: boolean;
  stepIndex: number;
  delayRemainingMs: number;
  warnings: string[];
  halted: undefined | "done" | "blocked";
};

const MAX_WHILE_ITERATIONS = 200;
const MAX_RUN_STEPS = 220;

function normalizePinToken(value: unknown): string {
  if (value === undefined || value === null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^d(\d+)$/i.test(trimmed)) return trimmed.replace(/^d/i, "").toUpperCase();
  return trimmed.toUpperCase();
}

function normalizePinValue(value: unknown): PinValue {
  if (value === undefined || value === null) return "LOW";
  if (typeof value === "boolean") return value ? "HIGH" : "LOW";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "LOW";
    return Math.round(value);
  }
  return String(value).trim();
}

function toPinToken(value: PinInput): string {
  return normalizePinToken(value);
}

function parseBooleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizePinValue(value).toString().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "high" || normalized === "on";
}

function asLogicState(value: PinValue): "HIGH" | "LOW" {
  if (typeof value === "number") return value ? "HIGH" : "LOW";
  if (typeof value === "boolean") return value ? "HIGH" : "LOW";
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "high" || normalized === "true" || normalized === "on" ? "HIGH" : "LOW";
}

function clampDelay(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPinValue(value: unknown): value is PinValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function resolveConnections(project: Pick<ProjectDocument, "pinAssignments" | "connections" | "components">) {
  return project.connections && project.connections.length > 0 ? project.connections : project.pinAssignments ?? [];
}

function createPinMaps(
  project: Pick<ProjectDocument, "components" | "pinAssignments" | "connections">,
  componentInstances: ComponentInstance[]
) {
  const connections = resolveConnections(project);
  const boardToComponent = new Map<string, RuntimePinBinding>();
  const componentToBoardPins = new Map<string, Map<string, string>>();
  const warnings: string[] = [];

  for (const connection of connections) {
    const boardPin = normalizePinToken(connection.boardPin);
    const componentId = String(connection.componentId);
    const pinName = normalizePinToken(connection.pin);
    if (!boardPin || !componentId || !pinName) continue;

    const byPin = componentToBoardPins.get(componentId) ?? new Map<string, string>();
    byPin.set(pinName, boardPin);
    componentToBoardPins.set(componentId, byPin);

    const existing = boardToComponent.get(boardPin);
    if (existing?.kind === "component") {
      warnings.push(`Board pin ${boardPin} is connected by multiple signals.`);
    }

    boardToComponent.set(boardPin, {
      kind: "component",
      componentId,
      pin: pinName
    });
  }

  for (const component of componentInstances) {
    const byPin = componentToBoardPins.get(component.id) ?? new Map<string, string>();
    for (const [pinName, pinValue] of Object.entries(component.pins)) {
      if (!isPinValue(pinValue) || typeof pinValue === "boolean") continue;
      const boardPin = normalizePinToken(pinValue);
      if (!boardPin) continue;
      const normalizedPinName = normalizePinToken(pinName);
      if (!normalizedPinName) continue;
      if (!byPin.has(normalizedPinName)) {
        byPin.set(normalizedPinName, boardPin);
      }
    }
    componentToBoardPins.set(component.id, byPin);
  }

  for (const [componentId, pins] of componentToBoardPins) {
    if (pins.size === 0) {
      componentToBoardPins.set(componentId, new Map<string, string>());
    }
  }

  return { boardToComponent, componentToBoardPins, warnings };
}

function createRuntimeState(
  initialState: SimulationState | undefined,
  componentsById: Map<string, ComponentInstance>
): RuntimeState {
  return {
    pinValues: {
      ...(initialState?.pinValues ?? {})
    },
    pinModes: {
      ...(typeof initialState?.pinValues === "object" && initialState?.pinValues ? {} : {})
    },
    componentState: Object.fromEntries(
      Array.from(componentsById.values()).map((component) => [
        component.id,
        {
          ...component.pins,
          ...(initialState?.componentState?.[component.id] ?? {})
        }
      ])
    ) as Record<string, Record<string, PinValue>>,
    serialLog: [...(initialState?.serialLog ?? [])],
    running: false,
    stepIndex: Number.isFinite(initialState?.stepIndex ?? 0) ? (initialState?.stepIndex ?? 0) : 0,
    delayRemainingMs: Number.isFinite(initialState?.delayRemainingMs ?? 0) ? (initialState?.delayRemainingMs ?? 0) : 0,
    warnings: [],
    halted: undefined
  };
}

function makePinFinder(componentToBoardPins: Map<string, Map<string, string>>, pinPreferences: string[]) {
  return (componentId: string | undefined) => {
    if (!componentId) return "";
    const byPin = componentToBoardPins.get(componentId);
    if (!byPin || byPin.size === 0) return "";

    for (const pin of pinPreferences) {
      const normalizedPreference = normalizePinToken(pin);
      const mapped = byPin.get(normalizedPreference);
      if (mapped) return mapped;
    }

    return Array.from(byPin.values())[0] ?? "";
  };
}

function makePinFinderAny(componentToBoardPins: Map<string, Map<string, string>>) {
  return (componentId: string | undefined, exactPins: string[] = []) => {
    if (!componentId) return "";
    const byPin = componentToBoardPins.get(componentId);
    if (!byPin || byPin.size === 0) return "";

    for (const pin of exactPins) {
      const normalized = normalizePinToken(pin);
      if (!normalized) continue;
      const mapped = byPin.get(normalized);
      if (mapped) return mapped;
    }

    for (const fallback of [
      "SIGNAL",
      "PIN",
      "DATA",
      "TRIG",
      "ECHO",
      "OUT",
      "IN",
      "D0",
      "D1",
      "D2",
      "D3",
      "D4",
      "D5",
      "D6",
      "D7",
      "D8",
      "D9",
      "D10",
      "D11",
      "D12",
      "D13"
    ] as const) {
      const mapped = byPin.get(fallback);
      if (mapped) return mapped;
    }

    return Array.from(byPin.values())[0] ?? "";
  };
}

export function createCircuitRuntime(config: RuntimeConfig): CircuitRuntimeController {
  const componentsById = new Map(config.project.components.map((instance) => [instance.id, instance] as const));
  const callStack: RuntimeFrame[] = [];

  const { boardToComponent, componentToBoardPins, warnings } = createPinMaps(config.project, config.project.components);
  const state = createRuntimeState(config.initialState, componentsById);

  const findTargetPin = (componentId: string | undefined, pinPreferences: string[]) => {
    return makePinFinder(componentToBoardPins, pinPreferences)(componentId);
  };
  const findInputTargetPin = (componentId: string | undefined, exactPins: string[] = []) => {
    return makePinFinderAny(componentToBoardPins)(componentId, exactPins);
  };

  const rootWarnings = [...warnings];
  const initialFrame: RuntimeFrame = {
    type: "root",
    steps: config.project.program,
    index: 0
  };
  callStack.push(initialFrame);

  function appendSerialLine(line: string) {
    state.serialLog.push(String(line));
    if (state.serialLog.length > 160) {
      state.serialLog.splice(0, state.serialLog.length - 160);
    }
  }

  function setPinValue(pin: string, value: PinValue) {
    const normalizedPin = normalizePinToken(pin);
    if (!normalizedPin) return;
    const normalizedValue = normalizePinValue(value);
    state.pinValues[normalizedPin] = normalizedValue;

    const binding = boardToComponent.get(normalizedPin);
    if (binding && binding.kind === "component") {
      const componentState = (state.componentState[binding.componentId] = state.componentState[binding.componentId] ?? {});
      componentState[binding.pin] = normalizedValue;
    }
  }

  function getPinValue(pin: string): PinValue {
    const normalizedPin = normalizePinToken(pin);
    if (!normalizedPin) return "LOW";
    return state.pinValues[normalizedPin] ?? "LOW";
  }

  function setComponentStateValue(componentId: string, key: string, value: PinValue) {
    const normalizedKey = normalizePinToken(key) || key;
    if (!normalizedKey) return;

    state.componentState[componentId] = state.componentState[componentId] ?? {};
    const normalizedValue = normalizePinValue(value);
    state.componentState[componentId][normalizedKey] = normalizedValue;

    const boardPin = getComponentBoardPin(componentId, normalizedKey);
    if (boardPin) {
      state.pinValues[boardPin] = normalizedValue;
    }
  }

  function getComponentPinValue(componentId: string, pinName: string, fallback: PinValue = "LOW") {
    const bindingPin = normalizePinToken(pinName);
    const byComponent = state.componentState[componentId];
    if (!bindingPin || !byComponent) return fallback;
    return byComponent[bindingPin] ?? fallback;
  }

  function getComponentBoardPin(componentId: string, pinName: string) {
    const byPin = componentToBoardPins.get(componentId);
    if (!byPin) return "";
    const normalizedPinName = normalizePinToken(pinName);
    return byPin.get(normalizedPinName) ?? "";
  }

  function resetState(nextState?: SimulationState) {
    const restored = createRuntimeState(nextState, componentsById);
    state.pinValues = restored.pinValues;
    state.pinModes = restored.pinModes;
    state.componentState = restored.componentState;
    state.serialLog = restored.serialLog;
    state.running = false;
    state.stepIndex = restored.stepIndex;
    state.delayRemainingMs = restored.delayRemainingMs;
    state.warnings = [...rootWarnings];
    state.halted = undefined;

    callStack.length = 0;
    callStack.push({
      type: "root",
      steps: config.project.program,
      index: 0
    });
  }

  function resolveInputPin(componentId: string | undefined, pinPreferences: string[], fallbackStateKey = "value") {
    if (!componentId) return "";
    const boardPin = findInputTargetPin(componentId, pinPreferences);
    if (boardPin) return boardPin;
    const fallback = getComponentPinValue(componentId, fallbackStateKey, "LOW");
    if (fallback === "LOW") {
      return "";
    }
    return normalizePinToken(fallback);
  }

  function nextActiveFrame(): RuntimeFrame | null {
    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1]!;

      if (frame.type === "root" && frame.steps.length === 0) {
        state.running = false;
        state.halted = "done";
        return null;
      }

      if (frame.index < frame.steps.length) {
        return frame;
      }

      if (frame.type === "root") {
        if (state.halted === "blocked") return null;
        frame.index = 0;
        return frame;
      }

      if (frame.type === "repeat") {
        frame.remaining -= 1;
        if (frame.remaining <= 0) {
          callStack.pop();
          continue;
        }
        frame.index = 0;
        continue;
      }

      if (frame.type !== "while") {
        callStack.pop();
        continue;
      }

      const whileFrame = frame;
      const conditionMet = resolveCondition(getPinValue(whileFrame.pin), whileFrame.expected);
      if (!conditionMet) {
        callStack.pop();
        continue;
      }

      if (whileFrame.iterations >= whileFrame.maxIterations) {
        warn("while-pin reached safety limit and was stopped.");
        state.halted = "blocked";
        state.running = false;
        callStack.length = 0;
        return null;
      }

      whileFrame.iterations += 1;
      whileFrame.index = 0;
    }

    state.running = false;
    if (!state.halted) {
      state.halted = "done";
    }
    return null;
  }

  function appendWarning(message: string) {
    state.warnings.push(message);
  }

  function warn(message: string) {
    appendWarning(message);
  }

  function resolveCondition(pinValue: PinValue, expected: "HIGH" | "LOW") {
    return asLogicState(pinValue) === expected;
  }

  function readInputState(step: { componentId?: string; pin?: PinValue }) {
    const pin = toPinToken(step.pin);
    if (pin) {
      return getPinValue(pin);
    }
    const inputPin = step.componentId ? findInputTargetPin(step.componentId, ["SIGNAL", "PIN", "DATA", "IN", "OUT", "VALUE"]) : "";
    if (inputPin) {
      return getPinValue(inputPin);
    }
    if (step.componentId) {
      return getComponentPinValue(step.componentId, "value", "LOW");
    }
    return "LOW";
  }

  function executeStep(step: ProgramStep) {
    switch (step.kind) {
      case "digital-write": {
        const target = step.componentId ? findTargetPin(step.componentId, ["SIGNAL", "PIN", "OUT", "LED", "DOUT", "VALUE"]) : normalizePinToken(step.pin);
        if (!target) {
          warn("Missing target pin for digital-write.");
          return;
        }

        const value = normalizePinValue(step.value);
        setPinValue(target, value);
        appendSerialLine(`digital ${target} = ${String(value)}`);
        break;
      }

      case "pin-mode": {
        const target = normalizePinToken(step.pin);
        if (!target) {
          warn("Missing pin for pin-mode.");
          return;
        }
        state.pinModes[target] = step.mode;
        appendSerialLine(`pinMode ${target} = ${step.mode}`);
        break;
      }

      case "digital-toggle": {
        const target = normalizePinToken(step.pin);
        if (!target) {
          warn("Missing pin for digital-toggle.");
          return;
        }
        const next = asLogicState(getPinValue(target)) === "HIGH" ? "LOW" : "HIGH";
        setPinValue(target, next);
        appendSerialLine(`digital ${target} toggled`);
        break;
      }

      case "analog-write": {
        const target = step.componentId
          ? findTargetPin(step.componentId, ["PWM", "SIGNAL", "PIN", "ANALOG", "LED", "SDA", "SCL"])
          : normalizePinToken(step.pin);
        if (!target) {
          warn("Missing target pin for analog-write.");
          return;
        }

        const level = clamp(asNumber(step.value), 0, 255);
        setPinValue(target, level);
        appendSerialLine(`analog ${target} = ${level}`);
        break;
      }

      case "delay": {
        state.delayRemainingMs += clampDelay(step.ms);
        break;
      }

      case "delay-microseconds": {
        state.delayRemainingMs += clampDelay(step.us / 1000);
        break;
      }

      case "serial-print": {
        appendSerialLine(`${step.value}${step.newline === false ? "" : "\n"}`);
        break;
      }

      case "digital-if-write": {
        const outputPin = normalizePinToken(step.outputPin);
        const inputPin = normalizePinToken(step.inputPin);
        const outputValue = normalizePinValue(step.outputValue);
        if (!outputPin || !inputPin) {
          warn("digital-if-write has incomplete pins.");
          return;
        }

        const resolvedInput = getPinValue(inputPin);
        const value = resolveCondition(resolvedInput, step.expectedValue) ? outputValue : "LOW";
        setPinValue(outputPin, value);
        break;
      }

      case "if-pin": {
        const input = resolveCondition(readInputState(step), step.expectedValue);
        if (input) {
          callStack.push({
            type: "repeat",
            steps: step.then,
            index: 0,
            remaining: 1
          });
        }
        break;
      }

      case "if-pin-else": {
        const input = resolveCondition(readInputState(step), step.expectedValue);
        const branch = input ? step.then : (step.else ?? []);
        if (branch.length > 0) {
          callStack.push({
            type: "repeat",
            steps: branch,
            index: 0,
            remaining: 1
          });
        }
        break;
      }

    case "while-pin": {
        const pin = toPinToken(step.pin);
        if (!pin) {
          warn("while-pin has missing pin.");
          return;
        }

        if (!resolveCondition(getPinValue(pin), step.expectedValue)) {
          return;
        }

        if (getExistingWhileFrame(pin, step.expectedValue)) {
          return;
        }

        callStack.push({
          type: "while",
          steps: step.body,
          index: 0,
          pin,
          expected: step.expectedValue,
          iterations: 0,
          maxIterations: MAX_WHILE_ITERATIONS
        });
        break;
      }

      case "repeat": {
        const count = clampDelay(asNumber(step.count));
        if (count <= 0) return;
        callStack.push({
          type: "repeat",
          steps: step.body,
          index: 0,
          remaining: count
        });
        break;
      }

      case "button-controls-led": {
        const buttonPin = findInputTargetPin(step.buttonId, ["BUTTON", "SIGNAL", "IN", "PIN", "BTN"]);
        const ledPin = findTargetPin(step.ledId, ["LED", "SIGNAL", "PIN"]);

        const pressed = buttonPin
          ? asLogicState(getPinValue(buttonPin)) === "LOW"
          : asLogicState(getComponentPinValue(step.buttonId, "state", "HIGH")) === "LOW";

        if (!ledPin) {
          warn("button-controls-led missing LED mapping.");
          return;
        }

        const ledValue: PinValue = pressed ? "HIGH" : "LOW";
        setPinValue(ledPin, ledValue);
        if (buttonPin) {
          const boardPin = getComponentBoardPin(step.buttonId, "BUTTON") ?? getComponentBoardPin(step.buttonId, "SIGNAL") ?? "";
          if (boardPin) {
            state.pinValues[boardPin] = pressed ? "LOW" : "HIGH";
          }
        } else {
          setComponentStateValue(step.buttonId, "state", pressed ? "LOW" : "HIGH");
        }
        setComponentStateValue(step.ledId, "value", ledValue);
        appendSerialLine(`${step.buttonId}: ${pressed ? "pressed" : "released"}`);
        break;
      }

      case "potentiometer-controls-servo": {
        const potentiometerPin = findInputTargetPin(step.potentiometerId, ["SIGNAL", "ANALOG", "POT", "OUT", "DATA"]);
        const servoPin = findTargetPin(step.servoId, ["SERVO", "PWM", "SIGNAL", "PIN"]);

        if (!potentiometerPin || !servoPin) {
          warn("potentiometer-controls-servo missing pin mapping.");
          return;
        }

        const raw = asNumber(
          potentiometerPin
            ? getPinValue(potentiometerPin)
            : getComponentPinValue(step.potentiometerId, "value", 512)
        );
        const angle = Math.round(clamp((raw / 1023) * 180, 0, 180));
        setPinValue(servoPin, angle);
        setComponentStateValue(step.servoId, "angle", angle);
        appendSerialLine(`${step.servoId}: ${angle} deg`);
        break;
      }

      case "servo-write": {
        const pin = findTargetPin(step.componentId, ["SERVO", "PWM", "SIGNAL", "PIN"]);
        if (!pin) {
          warn("servo-write missing servo pin mapping.");
          return;
        }

        const angle = clamp(asNumber(step.angle), 0, 180);
        setPinValue(pin, angle);
        setComponentStateValue(step.componentId, "angle", angle);
        appendSerialLine(`${step.componentId}: ${angle} deg`);
        break;
      }

      case "dc-motor-write": {
        const in1 = findTargetPin(step.componentId, ["IN1"]);
        const in2 = findTargetPin(step.componentId, ["IN2"]);
        const enable = findTargetPin(step.componentId, ["ENABLE", "PWM"]);
        const speed = step.direction === "stop" ? 0 : clamp(asNumber(step.speed), 0, 255);
        const in1Value: PinValue = step.direction === "forward" ? "HIGH" : "LOW";
        const in2Value: PinValue = step.direction === "reverse" ? "HIGH" : "LOW";

        if (!in1 || !in2 || !enable) {
          warn("dc-motor-write missing motor driver pin mapping.");
          return;
        }

        setPinValue(in1, in1Value);
        setPinValue(in2, in2Value);
        setPinValue(enable, speed);
        setComponentStateValue(step.componentId, "direction", step.direction);
        setComponentStateValue(step.componentId, "speed", speed);
        appendSerialLine(`${step.componentId}: ${step.direction} ${speed}`);
        break;
      }

      case "joystick-serial": {
        const xPin = findInputTargetPin(step.componentId, ["X"]);
        const yPin = findInputTargetPin(step.componentId, ["Y"]);
        const buttonPin = findInputTargetPin(step.componentId, ["BUTTON", "SW"]);
        const x = clamp(asNumber(xPin ? getPinValue(xPin) : getComponentPinValue(step.componentId, "x", 512)), 0, 1023);
        const y = clamp(asNumber(yPin ? getPinValue(yPin) : getComponentPinValue(step.componentId, "y", 512)), 0, 1023);
        const button = asLogicState(buttonPin ? getPinValue(buttonPin) : getComponentPinValue(step.componentId, "button", "HIGH"));

        setComponentStateValue(step.componentId, "x", x);
        setComponentStateValue(step.componentId, "y", y);
        setComponentStateValue(step.componentId, "button", button);
        appendSerialLine(`${step.componentId}: x ${Math.round(x)} y ${Math.round(y)} button ${button}`);
        break;
      }

      case "rgb-write": {
        const pin = findTargetPin(step.componentId, ["RGB", "SIGNAL", "PIN"]);
        const red = clamp(asNumber(step.red), 0, 255);
        const green = clamp(asNumber(step.green), 0, 255);
        const blue = clamp(asNumber(step.blue), 0, 255);
        const value = `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;

        if (pin) {
          setPinValue(pin, value);
        }
        setComponentStateValue(step.componentId, "rgb", value);
        appendSerialLine(`${step.componentId}: rgb ${value}`);
        break;
      }

      case "ultrasonic-serial": {
        const distance = clamp(asNumber(getComponentPinValue(step.componentId, "distanceCm", 42)), 2, 400);
        setComponentStateValue(step.componentId, "distanceCm", distance);
        appendSerialLine(`${step.label ?? step.componentId}: ${Math.round(distance)}`);
        break;
      }

      case "dht-serial": {
        const tempC = clamp(asNumber(getComponentPinValue(step.componentId, "tempC", 22)), -40, 125);
        const humidity = clamp(asNumber(getComponentPinValue(step.componentId, "humidity", 45)), 0, 100);
        appendSerialLine(`${step.componentId}_temp: ${Math.round(tempC)}`);
        appendSerialLine(`${step.componentId}_humidity: ${Math.round(humidity)}%`);
        break;
      }

      case "lcd-print":
      case "oled-print": {
        setComponentStateValue(step.componentId, "lastText", step.text);
        appendSerialLine(`${step.componentId}: ${step.text}`);
        break;
      }

      case "neopixel-fill": {
        const pin = findTargetPin(step.componentId, ["PIN", "DOUT", "DIN", "PIXEL", "DATA", "SIGNAL"]);
        const red = clamp(asNumber(step.red), 0, 255);
        const green = clamp(asNumber(step.green), 0, 255);
        const blue = clamp(asNumber(step.blue), 0, 255);
        const value = `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
        if (pin) {
          setPinValue(pin, value);
        }
        setComponentStateValue(step.componentId, "neopixel", value);
        appendSerialLine(`${step.componentId}: ${value}`);
        break;
      }

      case "tone": {
        const frequency = clamp(asNumber(getComponentPinValue(step.componentId, "toneFrequency", step.frequency)), 31, 20000);
        const duration = clamp(asNumber(getComponentPinValue(step.componentId, "toneDuration", step.duration ?? 250)), 0, 200000);
        setComponentStateValue(step.componentId, "toneFrequency", frequency);
        setComponentStateValue(step.componentId, "toneDuration", duration);
        appendSerialLine(`tone ${step.componentId}: ${frequency}Hz for ${duration}ms`);
        break;
      }

      case "tone-stop": {
        setComponentStateValue(step.componentId, "toneFrequency", 0);
        setComponentStateValue(step.componentId, "toneDuration", 0);
        break;
      }

      case "relay-write": {
        const pin = findTargetPin(step.componentId, ["RELAY", "PIN", "SIGNAL"]);
        const value = normalizePinValue(step.value);
        if (pin) setPinValue(pin, value);
        setComponentStateValue(step.componentId, "relay", value);
        appendSerialLine(`${step.componentId}: relay ${value}`);
        break;
      }

      case "ir-read-serial": {
        const code = normalizePinValue(getComponentPinValue(step.componentId, "irCode", "0xFFA25D"));
        appendSerialLine(`${step.componentId}: ${String(code)}`);
        break;
      }

      case "read-analog-serial": {
        const raw = readInputState(step);
        const value = clamp(asNumber(raw), 0, 1023);
        appendSerialLine(`${step.label ?? step.componentId ?? "Analog"}: ${Math.round(value)}`);
        break;
      }

      case "read-digital-serial": {
        const input = readInputState(step);
        appendSerialLine(`${step.label ?? step.componentId ?? "Digital"}: ${asLogicState(input)}`);
        break;
      }

      default:
        warn(`Unsupported block ${(step as { kind: string }).kind}; it was skipped in simulation.`);
        break;
    }
  }

  function getExistingWhileFrame(pin: string, expected: "HIGH" | "LOW") {
    for (const frame of callStack) {
      if (frame.type === "while" && frame.pin === pin && frame.expected === expected) {
        return frame;
      }
    }
    return null;
  }

  function runStep(maxOperations: number, elapsedMs = 0) {
    if (state.halted === "blocked") return getSnapshot();
    if (!state.running) {
      state.running = true;
      if (state.halted) state.halted = undefined;
    }

    let operations = 0;
    let budgetMs = Math.max(0, Number(elapsedMs) || 0);
    while (operations < maxOperations && !state.halted) {
      if (!state.running) break;

      if (state.delayRemainingMs > 0) {
        if (budgetMs > 0) {
          const consumedMs = Math.min(state.delayRemainingMs, budgetMs);
          state.delayRemainingMs = Math.max(0, state.delayRemainingMs - consumedMs);
          budgetMs = Math.max(0, budgetMs - consumedMs);
          state.stepIndex += 1;
          operations += 1;
          if (state.delayRemainingMs === 0) {
            appendSerialLine("delay complete");
          }
          if (state.delayRemainingMs > 0) {
            break;
          }
          continue;
        }

        state.delayRemainingMs = Math.max(0, state.delayRemainingMs - 1);
        state.stepIndex += 1;
        operations += 1;
        if (state.delayRemainingMs === 0) {
          appendSerialLine("delay complete");
        }
        continue;
      }

      const frame = nextActiveFrame();
      if (!frame) break;

      const step = frame.steps[frame.index];
      frame.index += 1;
      state.stepIndex += 1;
      operations += 1;

      if (!step) {
        warn("Runtime hit an empty program block slot.");
        continue;
      }

      executeStep(step);
    }

    return getSnapshot();
  }

  function pause() {
    state.running = false;
  }

  function getSnapshot(): CircuitRuntimeSnapshot {
    return {
      pinValues: { ...state.pinValues },
      componentState: Object.fromEntries(
        Object.entries(state.componentState).map(([componentId, values]) => [componentId, { ...values }])
      ) as Record<string, Record<string, PinValue>>,
      serialLog: [...state.serialLog],
      running: state.running,
      stepIndex: state.stepIndex,
      delayRemainingMs: state.delayRemainingMs,
      halted: state.halted,
      warnings: [...state.warnings]
    };
  }

  function isStopped() {
    return !state.running || state.halted === "done" || state.halted === "blocked";
  }

  function getPersistedState(): SimulationState {
    return {
      pinValues: { ...state.pinValues },
      componentState: Object.fromEntries(
        Object.entries(state.componentState).map(([componentId, values]) => [componentId, { ...values }])
      ) as Record<string, Record<string, PinValue>>,
      serialLog: [...state.serialLog],
      running: state.running,
      stepIndex: state.stepIndex,
      delayRemainingMs: state.delayRemainingMs
    };
  }

  function setInput(target: string, value: PinValue) {
    const pin = normalizePinToken(target);
    if (!pin) return;
    setPinValue(pin, value);
  }

  function setInputs(inputs: Record<string, PinValue>) {
    for (const [target, value] of Object.entries(inputs)) {
      setInput(target, value);
    }
  }

  function setComponentState(componentId: string, key: string, value: PinValue) {
    setComponentStateValue(componentId, key, value);
  }

  resetState(config.initialState);

  return {
    run: (maxOperations = MAX_RUN_STEPS, elapsedMs = 0) => runStep(maxOperations, elapsedMs),
    step: () => runStep(1),
    reset: (nextState) => resetState(nextState),
    pause,
    setInput,
    setInputs,
    setComponentState,
    getSnapshot,
    getPersistedState,
    isStopped
  };
}
