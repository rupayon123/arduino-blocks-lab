import type {
  Catalog,
  ComponentDefinition,
  ComponentInstance,
  LibraryDependency,
  PinMap,
  PinValue,
  ProgramStep,
  ProjectDocument
} from "@abl/block-schema";

export type GeneratedSketch = {
  code: string;
  libraries: LibraryDependency[];
  warnings: string[];
};

function sanitizeIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `component_${cleaned}`;
}

function pinLiteral(value: PinValue | undefined): string {
  if (value === undefined) return "0";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}

function stringLiteral(value: string): string {
  return JSON.stringify(value);
}

function interpolate(template: string, component: ComponentInstance): string {
  const id = sanitizeIdentifier(component.id);
  return template
    .replaceAll("{{id}}", id)
    .replace(/\{\{pins\.([a-zA-Z0-9_]+)\}\}/g, (_, pinName: string) => pinLiteral(component.pins[pinName]));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueLibraries(libraries: LibraryDependency[]): LibraryDependency[] {
  const map = new Map<string, LibraryDependency>();
  for (const library of libraries) {
    map.set(library.installName ?? library.name, library);
  }
  return Array.from(map.values());
}

function componentLookup(project: ProjectDocument, catalog: Catalog) {
  const instances = new Map(project.components.map((component) => [component.id, component]));
  const definitions = new Map(catalog.components.map((component) => [component.id, component]));
  const warnings: string[] = [];

  function getInstance(id: string): ComponentInstance | undefined {
    const component = instances.get(id);
    if (!component) warnings.push(`Missing component instance: ${id}`);
    return component;
  }

  function getDefinition(instance: ComponentInstance | undefined): ComponentDefinition | undefined {
    if (!instance) return undefined;
    const definition = definitions.get(instance.componentId);
    if (!definition) warnings.push(`Missing component definition: ${instance.componentId}`);
    return definition;
  }

  function pin(id: string | undefined, pinName = "signal"): string {
    if (!id) return "0";
    const instance = getInstance(id);
    return pinLiteral(instance?.pins[pinName]);
  }

  return { getInstance, getDefinition, pin, warnings };
}

function valueAsHighLow(value: "HIGH" | "LOW" | boolean): "HIGH" | "LOW" {
  if (value === true) return "HIGH";
  if (value === false) return "LOW";
  return value;
}

function emitStep(step: ProgramStep, helpers: ReturnType<typeof componentLookup>): string[] {
  switch (step.kind) {
    case "digital-write":
      return [`digitalWrite(${step.pin ? pinLiteral(step.pin) : helpers.pin(step.componentId)}, ${valueAsHighLow(step.value)});`];
    case "pin-mode":
      return [`pinMode(${pinLiteral(step.pin)}, ${step.mode});`];
    case "analog-write":
      return [`analogWrite(${step.pin ? pinLiteral(step.pin) : helpers.pin(step.componentId)}, ${step.value});`];
    case "delay":
      return [`delay(${Math.max(0, Math.round(step.ms))});`];
    case "delay-microseconds":
      return [`delayMicroseconds(${Math.max(0, Math.round(step.us))});`];
    case "serial-print":
      return [step.newline === false ? `Serial.print(${stringLiteral(step.value)});` : `Serial.println(${stringLiteral(step.value)});`];
    case "read-analog-serial": {
      const component = step.componentId ? helpers.getInstance(step.componentId) : undefined;
      const sourcePin = String(step.pin ?? component?.pins.signal ?? "0");
      const label = step.label ?? component?.label ?? "analog";
      return [
        `Serial.print(${stringLiteral(`${label}: `)});`,
        `Serial.println(analogRead(${pinLiteral(sourcePin)}));`
      ];
    }
    case "read-digital-serial": {
      const component = step.componentId ? helpers.getInstance(step.componentId) : undefined;
      const sourcePin = String(step.pin ?? component?.pins.signal ?? "0");
      const label = step.label ?? component?.label ?? "digital";
      return [
        `Serial.print(${stringLiteral(`${label}: `)});`,
        `Serial.println(digitalRead(${pinLiteral(sourcePin)}));`
      ];
    }
    case "digital-if-write":
      return [
        `if (digitalRead(${pinLiteral(step.inputPin)}) == ${step.expectedValue}) {`,
        `  digitalWrite(${pinLiteral(step.outputPin)}, ${step.outputValue});`,
        `}`
      ];
    case "button-controls-led": {
      const buttonPin = helpers.pin(step.buttonId);
      const ledPin = helpers.pin(step.ledId);
      return [
        `if (digitalRead(${buttonPin}) == LOW) {`,
        `  digitalWrite(${ledPin}, HIGH);`,
        `} else {`,
        `  digitalWrite(${ledPin}, LOW);`,
        `}`
      ];
    }
    case "potentiometer-controls-servo": {
      const potentiometer = helpers.getInstance(step.potentiometerId);
      const servo = helpers.getInstance(step.servoId);
      return [
        `int knobValue = analogRead(${pinLiteral(potentiometer?.pins.signal)});`,
        `int servoAngle = map(knobValue, 0, 1023, 0, 180);`,
        `${sanitizeIdentifier(servo?.id ?? "servo")}.write(servoAngle);`
      ];
    }
    case "servo-write": {
      const servo = helpers.getInstance(step.componentId);
      return [`${sanitizeIdentifier(servo?.id ?? "servo")}.write(${step.angle});`];
    }
    case "rgb-write": {
      const component = helpers.getInstance(step.componentId);
      return [
        `analogWrite(${pinLiteral(component?.pins.red)}, ${step.red});`,
        `analogWrite(${pinLiteral(component?.pins.green)}, ${step.green});`,
        `analogWrite(${pinLiteral(component?.pins.blue)}, ${step.blue});`
      ];
    }
    case "ultrasonic-serial": {
      const component = helpers.getInstance(step.componentId);
      const trigger = pinLiteral(component?.pins.trigger);
      const echo = pinLiteral(component?.pins.echo);
      const label = step.label ?? "distance_cm";
      return [
        `digitalWrite(${trigger}, LOW);`,
        `delayMicroseconds(2);`,
        `digitalWrite(${trigger}, HIGH);`,
        `delayMicroseconds(10);`,
        `digitalWrite(${trigger}, LOW);`,
        `long duration = pulseIn(${echo}, HIGH);`,
        `float distanceCm = duration * 0.0343 / 2.0;`,
        `Serial.print(${stringLiteral(`${label}: `)});`,
        `Serial.println(distanceCm);`
      ];
    }
    case "dht-serial": {
      const component = helpers.getInstance(step.componentId);
      const id = sanitizeIdentifier(component?.id ?? "dht");
      return [
        `float humidity = ${id}.readHumidity();`,
        `float temperatureC = ${id}.readTemperature();`,
        `Serial.print("humidity: ");`,
        `Serial.print(humidity);`,
        `Serial.print(" temperature_c: ");`,
        `Serial.println(temperatureC);`
      ];
    }
    case "lcd-print": {
      const component = helpers.getInstance(step.componentId);
      const id = sanitizeIdentifier(component?.id ?? "lcd");
      const lines = step.clear ? [`${id}.clear();`] : [];
      return [...lines, `${id}.setCursor(${step.column ?? 0}, ${step.row ?? 0});`, `${id}.print(${stringLiteral(step.text)});`];
    }
    case "oled-print": {
      const component = helpers.getInstance(step.componentId);
      const id = sanitizeIdentifier(component?.id ?? "oled");
      const lines = step.clear ? [`${id}.clearDisplay();`] : [];
      return [
        ...lines,
        `${id}.setCursor(${step.x ?? 0}, ${step.y ?? 0});`,
        `${id}.setTextSize(1);`,
        `${id}.print(${stringLiteral(step.text)});`,
        `${id}.display();`
      ];
    }
    case "neopixel-fill": {
      const component = helpers.getInstance(step.componentId);
      const id = sanitizeIdentifier(component?.id ?? "pixels");
      return [`${id}.fill(${id}.Color(${step.red}, ${step.green}, ${step.blue}));`, `${id}.show();`];
    }
    case "tone": {
      const component = helpers.getInstance(step.componentId);
      return [`tone(${pinLiteral(component?.pins.signal)}, ${step.frequency}, ${step.duration ?? 250});`];
    }
    case "relay-write":
      return [`digitalWrite(${helpers.pin(step.componentId)}, ${valueAsHighLow(step.value)});`];
    case "ir-read-serial":
      return [
        `if (IrReceiver.decode()) {`,
        `  Serial.print("ir: ");`,
        `  Serial.println(IrReceiver.decodedIRData.decodedRawData, HEX);`,
        `  IrReceiver.resume();`,
        `}`
      ];
    default:
      return [`// Unsupported block: ${(step as ProgramStep).kind}`];
  }
}

function indent(lines: string[], spaces = 2): string[] {
  const prefix = " ".repeat(spaces);
  return lines.map((line) => (line.length > 0 ? `${prefix}${line}` : line));
}

export function collectLibraries(project: ProjectDocument, catalog: Catalog): LibraryDependency[] {
  const definitions = new Map(catalog.components.map((component) => [component.id, component]));
  return uniqueLibraries(
    project.components.flatMap((component) => definitions.get(component.componentId)?.runtime?.libraries ?? [])
  );
}

export function generateSketch(project: ProjectDocument, catalog: Catalog): GeneratedSketch {
  const board = catalog.boards.find((candidate) => candidate.id === project.boardId);
  const helpers = componentLookup(project, catalog);

  const includes: string[] = [];
  const globals: string[] = [];
  const setup: string[] = [];
  const loop: string[] = [];
  const libraries: LibraryDependency[] = [];

  for (const component of project.components) {
    const definition = helpers.getDefinition(component);
    if (!definition?.runtime) continue;
    includes.push(...(definition.runtime.includes ?? []));
    globals.push(...(definition.runtime.globals ?? []).map((line) => interpolate(line, component)));
    setup.push(...(definition.runtime.setup ?? []).map((line) => interpolate(line, component)));
    loop.push(...(definition.runtime.loop ?? []).map((line) => interpolate(line, component)));
    libraries.push(...(definition.runtime.libraries ?? []));
  }

  const needsSerial = project.program.some((step) =>
    [
      "serial-print",
      "read-analog-serial",
      "read-digital-serial",
      "ultrasonic-serial",
      "dht-serial",
      "ir-read-serial"
    ].includes(step.kind)
  );
  if (needsSerial) {
    setup.unshift("Serial.begin(9600);");
  }

  for (const step of project.program) {
    loop.push(...emitStep(step, helpers));
  }

  const header = [
    `// ${project.name}`,
    `// Generated by Arduino Blocks Lab.`,
    board ? `// Target board: ${board.name} (${board.fqbn})` : `// Target board: ${project.boardId}`,
    ""
  ];

  const code = [
    ...header,
    ...unique(includes),
    unique(includes).length > 0 ? "" : undefined,
    ...unique(globals),
    unique(globals).length > 0 ? "" : undefined,
    "void setup() {",
    ...indent(setup.length > 0 ? setup : ["// No setup needed yet."]),
    "}",
    "",
    "void loop() {",
    ...indent(loop.length > 0 ? loop : ["// Add blocks to build your program."]),
    "}"
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");

  return {
    code,
    libraries: uniqueLibraries(libraries),
    warnings: helpers.warnings
  };
}
