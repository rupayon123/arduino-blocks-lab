export type PinValue = string | number | boolean;

export type PinMap = Record<string, PinValue>;

export type BoardDefinition = {
  id: string;
  name: string;
  fqbn: string;
  family: "avr" | "megaavr" | "renesas" | "esp32" | "other";
  digitalPins: string[];
  analogPins: string[];
  pwmPins: string[];
  i2cPins?: { sda: string; scl: string };
  spiPins?: { mosi: string; miso: string; sck: string };
};

export type LibraryDependency = {
  name: string;
  installName?: string;
  version?: string;
};

export type WiringHint = {
  label: string;
  from: string;
  to: string;
  note?: string;
};

export type RuntimeTemplate = {
  includes?: string[];
  globals?: string[];
  setup?: string[];
  loop?: string[];
  libraries?: LibraryDependency[];
};

export type ComponentCategory =
  | "output"
  | "input"
  | "sensor"
  | "display"
  | "motion"
  | "communication"
  | "power";

export type ComponentDefinition = {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  defaultPins: PinMap;
  pinLabels: Record<string, string>;
  wiring: WiringHint[];
  runtime?: RuntimeTemplate;
  simulatorHints?: string[];
};

export type ComponentInstance = {
  id: string;
  componentId: string;
  label: string;
  pins: PinMap;
};

export type BlockValueType = "boolean" | "number" | "string" | "color" | "component" | "pin";

export type BlockInputDefinition = {
  id: string;
  label: string;
  type: BlockValueType;
  defaultValue?: PinValue;
  componentCategory?: ComponentCategory;
};

export type BlockDefinition = {
  id: string;
  label: string;
  category: "logic" | "input" | "output" | "display" | "timing" | "serial" | "motion" | "communication";
  kind: ProgramStep["kind"];
  inputs: BlockInputDefinition[];
  description: string;
};

export type ProgramStep =
  | { kind: "digital-write"; componentId?: string; pin?: PinValue; value: "HIGH" | "LOW" | boolean }
  | { kind: "digital-if-write"; inputPin: PinValue; expectedValue: "HIGH" | "LOW"; outputPin: PinValue; outputValue: "HIGH" | "LOW" }
  | { kind: "pin-mode"; pin: PinValue; mode: "INPUT" | "OUTPUT" | "INPUT_PULLUP"; }
  | { kind: "analog-write"; componentId?: string; pin?: PinValue; value: number | string }
  | { kind: "delay"; ms: number }
  | { kind: "delay-microseconds"; us: number }
  | { kind: "serial-print"; value: string; newline?: boolean }
  | { kind: "read-analog-serial"; componentId?: string; pin?: PinValue; label?: string }
  | { kind: "read-digital-serial"; componentId?: string; pin?: PinValue; label?: string }
  | { kind: "button-controls-led"; buttonId: string; ledId: string }
  | { kind: "potentiometer-controls-servo"; potentiometerId: string; servoId: string }
  | { kind: "servo-write"; componentId: string; angle: number | string }
  | { kind: "rgb-write"; componentId: string; red: number; green: number; blue: number }
  | { kind: "ultrasonic-serial"; componentId: string; label?: string }
  | { kind: "dht-serial"; componentId: string }
  | { kind: "lcd-print"; componentId: string; text: string; column?: number; row?: number; clear?: boolean }
  | { kind: "oled-print"; componentId: string; text: string; x?: number; y?: number; clear?: boolean }
  | { kind: "neopixel-fill"; componentId: string; red: number; green: number; blue: number }
  | { kind: "tone"; componentId: string; frequency: number; duration?: number }
  | { kind: "relay-write"; componentId: string; value: "HIGH" | "LOW" | boolean }
  | { kind: "ir-read-serial"; componentId: string };

export type ProjectSchemaVersion = "1.0.0" | "1.1.0";

export type ProjectDocument = {
  schemaVersion: ProjectSchemaVersion;
  name: string;
  boardId: string;
  components: ComponentInstance[];
  program: ProgramStep[];
  blocksXml?: string;
  generatedSketch?: string;
  lessonId?: string;
  dependencies?: string[];
  pinAssignments?: PinAssignment[];
  componentPlacement?: ComponentPlacement[];
  connections?: CircuitConnection[];
  simulationState?: SimulationState;
};

export type PinAssignment = {
  id: string;
  componentId: string;
  pin: string;
  boardPin: string;
};

export type ComponentPlacement = {
  componentId: string;
  x: number;
  y: number;
  rotation?: number;
  layer?: "board" | "breadboard" | "three-d";
};

export type CircuitConnection = {
  id: string;
  componentId: string;
  pin: string;
  boardPin: string;
};

export type SimulationState = {
  pinValues?: Record<string, PinValue>;
  componentState?: Record<string, Record<string, PinValue>>;
  serialLog?: string[];
  running?: boolean;
  stepIndex?: number;
  delayRemainingMs?: number;
};

export type LessonStepAction = "build" | "wire" | "code" | "test" | "upload" | "reflect";

export type LessonStep = {
  title: string;
  detail: string;
  action?: LessonStepAction;
  checklist?: string[];
};

export type LessonDefinition = {
  id: string;
  title: string;
  level: "icon" | "word" | "text";
  goal: string;
  minutes?: number;
  concepts?: string[];
  materials?: string[];
  steps?: LessonStep[];
  success?: string[];
  teacherNotes?: string[];
  starterProject: ProjectDocument;
};

export type ExtensionManifest = {
  formatVersion: "1.0.0";
  id: string;
  name: string;
  version: string;
  boards?: BoardDefinition[];
  components?: ComponentDefinition[];
  blocks?: BlockDefinition[];
  lessons?: LessonDefinition[];
};

export type Catalog = {
  boards: BoardDefinition[];
  components: ComponentDefinition[];
  blocks: BlockDefinition[];
  lessons: LessonDefinition[];
};
