import type {
  BlockDefinition,
  BoardDefinition,
  Catalog,
  ComponentDefinition,
  ComponentInstance,
  ExtensionManifest,
  LessonDefinition,
  LibraryDependency,
  PinMap,
  ProjectDocument
} from "@abl/block-schema";

export const boards: BoardDefinition[] = [
  {
    id: "arduino-uno",
    name: "Arduino Uno",
    fqbn: "arduino:avr:uno",
    family: "avr",
    digitalPins: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
    analogPins: ["A0", "A1", "A2", "A3", "A4", "A5"],
    pwmPins: ["3", "5", "6", "9", "10", "11"],
    i2cPins: { sda: "A4", scl: "A5" },
    spiPins: { mosi: "11", miso: "12", sck: "13" }
  },
  {
    id: "arduino-nano",
    name: "Arduino Nano",
    fqbn: "arduino:avr:nano",
    family: "avr",
    digitalPins: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
    analogPins: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
    pwmPins: ["3", "5", "6", "9", "10", "11"],
    i2cPins: { sda: "A4", scl: "A5" },
    spiPins: { mosi: "11", miso: "12", sck: "13" }
  },
  {
    id: "arduino-mega",
    name: "Arduino Mega 2560",
    fqbn: "arduino:avr:mega",
    family: "avr",
    digitalPins: Array.from({ length: 54 }, (_, index) => String(index)),
    analogPins: Array.from({ length: 16 }, (_, index) => `A${index}`),
    pwmPins: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "44", "45", "46"],
    i2cPins: { sda: "20", scl: "21" },
    spiPins: { mosi: "51", miso: "50", sck: "52" }
  }
];

const c = (definition: ComponentDefinition) => definition;

export const components: ComponentDefinition[] = [
  c({
    id: "led",
    name: "LED",
    category: "output",
    description: "Single digital LED output.",
    defaultPins: { signal: 13 },
    pinLabels: { signal: "Digital pin", ground: "GND" },
    wiring: [
      { label: "Signal", from: "long LED leg through 220 ohm resistor", to: "D{{pins.signal}}" },
      { label: "Ground", from: "short LED leg", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.signal}}, OUTPUT);"]
    },
    simulatorHints: ["Use Wokwi LED or a real 5mm LED with a resistor."]
  }),
  c({
    id: "rgb-led",
    name: "RGB LED",
    category: "output",
    description: "Three PWM pins control red, green, and blue.",
    defaultPins: { red: 9, green: 10, blue: 11 },
    pinLabels: { red: "Red PWM", green: "Green PWM", blue: "Blue PWM", ground: "GND" },
    wiring: [
      { label: "Red", from: "red leg through resistor", to: "D{{pins.red}}" },
      { label: "Green", from: "green leg through resistor", to: "D{{pins.green}}" },
      { label: "Blue", from: "blue leg through resistor", to: "D{{pins.blue}}" },
      { label: "Ground", from: "common cathode", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.red}}, OUTPUT);", "pinMode({{pins.green}}, OUTPUT);", "pinMode({{pins.blue}}, OUTPUT);"]
    }
  }),
  c({
    id: "button",
    name: "Button",
    category: "input",
    description: "Momentary pushbutton using the internal pull-up resistor.",
    defaultPins: { signal: 2 },
    pinLabels: { signal: "Digital pin", ground: "GND" },
    wiring: [
      { label: "Signal", from: "one side of button", to: "D{{pins.signal}}" },
      { label: "Ground", from: "opposite side", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.signal}}, INPUT_PULLUP);"]
    }
  }),
  c({
    id: "potentiometer",
    name: "Potentiometer",
    category: "input",
    description: "Analog knob value from 0 to 1023.",
    defaultPins: { signal: "A0", power: "5V", ground: "GND" },
    pinLabels: { signal: "Analog pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "middle pin", to: "{{pins.signal}}" },
      { label: "Power", from: "outer pin", to: "5V" },
      { label: "Ground", from: "outer pin", to: "GND" }
    ]
  }),
  c({
    id: "buzzer",
    name: "Buzzer",
    category: "output",
    description: "Piezo buzzer tone output.",
    defaultPins: { signal: 8 },
    pinLabels: { signal: "Digital pin", ground: "GND" },
    wiring: [
      { label: "Signal", from: "positive buzzer pin", to: "D{{pins.signal}}" },
      { label: "Ground", from: "negative buzzer pin", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.signal}}, OUTPUT);"]
    }
  }),
  c({
    id: "servo",
    name: "Servo",
    category: "motion",
    description: "Standard hobby servo angle control.",
    defaultPins: { signal: 9, power: "5V", ground: "GND" },
    pinLabels: { signal: "PWM pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "orange/yellow wire", to: "D{{pins.signal}}" },
      { label: "Power", from: "red wire", to: "5V" },
      { label: "Ground", from: "brown/black wire", to: "GND" }
    ],
    runtime: {
      includes: ["#include <Servo.h>"],
      globals: ["Servo {{id}};"],
      setup: ["{{id}}.attach({{pins.signal}});"],
      libraries: [{ name: "Servo" }]
    }
  }),
  c({
    id: "dc-motor-driver",
    name: "DC Motor Driver",
    category: "motion",
    description: "Simple two-direction motor driver channel.",
    defaultPins: { in1: 5, in2: 6, enable: 3 },
    pinLabels: { in1: "IN1", in2: "IN2", enable: "PWM enable" },
    wiring: [
      { label: "IN1", from: "driver IN1", to: "D{{pins.in1}}" },
      { label: "IN2", from: "driver IN2", to: "D{{pins.in2}}" },
      { label: "Enable", from: "driver ENA", to: "D{{pins.enable}}" }
    ],
    runtime: {
      setup: ["pinMode({{pins.in1}}, OUTPUT);", "pinMode({{pins.in2}}, OUTPUT);", "pinMode({{pins.enable}}, OUTPUT);"]
    }
  }),
  c({
    id: "ultrasonic-hcsr04",
    name: "Ultrasonic HC-SR04",
    category: "sensor",
    description: "Distance sensor with trigger and echo pins.",
    defaultPins: { trigger: 6, echo: 7 },
    pinLabels: { trigger: "Trigger", echo: "Echo", power: "5V", ground: "GND" },
    wiring: [
      { label: "Trig", from: "TRIG", to: "D{{pins.trigger}}" },
      { label: "Echo", from: "ECHO", to: "D{{pins.echo}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.trigger}}, OUTPUT);", "pinMode({{pins.echo}}, INPUT);"]
    }
  }),
  c({
    id: "dht11",
    name: "DHT11",
    category: "sensor",
    description: "Basic temperature and humidity sensor.",
    defaultPins: { signal: 4, type: "DHT11" },
    pinLabels: { signal: "Digital pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "DATA", to: "D{{pins.signal}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      includes: ["#include <DHT.h>"],
      globals: ["DHT {{id}}({{pins.signal}}, {{pins.type}});"],
      setup: ["{{id}}.begin();"],
      libraries: [{ name: "DHT sensor library", installName: "DHT sensor library" }]
    }
  }),
  c({
    id: "dht22",
    name: "DHT22",
    category: "sensor",
    description: "More accurate temperature and humidity sensor.",
    defaultPins: { signal: 4, type: "DHT22" },
    pinLabels: { signal: "Digital pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "DATA", to: "D{{pins.signal}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      includes: ["#include <DHT.h>"],
      globals: ["DHT {{id}}({{pins.signal}}, {{pins.type}});"],
      setup: ["{{id}}.begin();"],
      libraries: [{ name: "DHT sensor library", installName: "DHT sensor library" }]
    }
  }),
  c({
    id: "ldr",
    name: "Photoresistor",
    category: "sensor",
    description: "Analog light level sensor.",
    defaultPins: { signal: "A1", power: "5V", ground: "GND" },
    pinLabels: { signal: "Analog pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "voltage divider middle", to: "{{pins.signal}}" },
      { label: "Power", from: "one side", to: "5V" },
      { label: "Ground", from: "resistor side", to: "GND" }
    ]
  }),
  c({
    id: "pir",
    name: "PIR Motion Sensor",
    category: "sensor",
    description: "Digital motion detection sensor.",
    defaultPins: { signal: 3 },
    pinLabels: { signal: "Digital pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "OUT", to: "D{{pins.signal}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.signal}}, INPUT);"]
    }
  }),
  c({
    id: "joystick",
    name: "Analog Joystick",
    category: "input",
    description: "Two analog axes plus a button.",
    defaultPins: { x: "A2", y: "A3", button: 12 },
    pinLabels: { x: "X axis", y: "Y axis", button: "Button" },
    wiring: [
      { label: "X", from: "VRx", to: "{{pins.x}}" },
      { label: "Y", from: "VRy", to: "{{pins.y}}" },
      { label: "Button", from: "SW", to: "D{{pins.button}}" }
    ],
    runtime: {
      setup: ["pinMode({{pins.button}}, INPUT_PULLUP);"]
    }
  }),
  c({
    id: "lcd-1602-i2c",
    name: "LCD 1602 I2C",
    category: "display",
    description: "Two-line character display over I2C.",
    defaultPins: { address: "0x27", columns: 16, rows: 2 },
    pinLabels: { address: "I2C address", sda: "SDA", scl: "SCL" },
    wiring: [
      { label: "SDA", from: "SDA", to: "board SDA" },
      { label: "SCL", from: "SCL", to: "board SCL" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      includes: ["#include <Wire.h>", "#include <LiquidCrystal_I2C.h>"],
      globals: ["LiquidCrystal_I2C {{id}}({{pins.address}}, {{pins.columns}}, {{pins.rows}});"],
      setup: ["{{id}}.init();", "{{id}}.backlight();"],
      libraries: [{ name: "LiquidCrystal I2C", installName: "LiquidCrystal I2C" }]
    }
  }),
  c({
    id: "oled-ssd1306",
    name: "OLED SSD1306",
    category: "display",
    description: "128x64 OLED display over I2C.",
    defaultPins: { address: "0x3C", width: 128, height: 64 },
    pinLabels: { address: "I2C address", sda: "SDA", scl: "SCL" },
    wiring: [
      { label: "SDA", from: "SDA", to: "board SDA" },
      { label: "SCL", from: "SCL", to: "board SCL" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      includes: ["#include <Wire.h>", "#include <Adafruit_GFX.h>", "#include <Adafruit_SSD1306.h>"],
      globals: ["Adafruit_SSD1306 {{id}}({{pins.width}}, {{pins.height}}, &Wire, -1);"],
      setup: ["{{id}}.begin(SSD1306_SWITCHCAPVCC, {{pins.address}});", "{{id}}.clearDisplay();", "{{id}}.setTextColor(SSD1306_WHITE);"],
      libraries: [
        { name: "Adafruit GFX Library", installName: "Adafruit GFX Library" },
        { name: "Adafruit SSD1306", installName: "Adafruit SSD1306" }
      ]
    }
  }),
  c({
    id: "neopixel-strip",
    name: "NeoPixel Strip",
    category: "output",
    description: "WS2812/NeoPixel LEDs.",
    defaultPins: { signal: 5, count: 8 },
    pinLabels: { signal: "Digital pin", count: "LED count", power: "5V", ground: "GND" },
    wiring: [
      { label: "Data", from: "DIN", to: "D{{pins.signal}}" },
      { label: "Power", from: "5V", to: "external 5V" },
      { label: "Ground", from: "GND", to: "shared GND" }
    ],
    runtime: {
      includes: ["#include <Adafruit_NeoPixel.h>"],
      globals: ["Adafruit_NeoPixel {{id}}({{pins.count}}, {{pins.signal}}, NEO_GRB + NEO_KHZ800);"],
      setup: ["{{id}}.begin();", "{{id}}.show();"],
      libraries: [{ name: "Adafruit NeoPixel", installName: "Adafruit NeoPixel" }]
    }
  }),
  c({
    id: "relay",
    name: "Relay Module",
    category: "power",
    description: "Digital relay module output.",
    defaultPins: { signal: 7 },
    pinLabels: { signal: "Digital pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "IN", to: "D{{pins.signal}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      setup: ["pinMode({{pins.signal}}, OUTPUT);"]
    }
  }),
  c({
    id: "ir-receiver",
    name: "IR Receiver",
    category: "communication",
    description: "Infrared remote receiver.",
    defaultPins: { signal: 11 },
    pinLabels: { signal: "Digital pin", power: "5V", ground: "GND" },
    wiring: [
      { label: "Signal", from: "OUT", to: "D{{pins.signal}}" },
      { label: "Power", from: "VCC", to: "5V" },
      { label: "Ground", from: "GND", to: "GND" }
    ],
    runtime: {
      includes: ["#include <IRremote.hpp>"],
      setup: ["IrReceiver.begin({{pins.signal}}, ENABLE_LED_FEEDBACK);"],
      libraries: [{ name: "IRremote", installName: "IRremote" }]
    }
  })
];

export const blocks: BlockDefinition[] = [
  { id: "digital-write", label: "set digital output", category: "output", kind: "digital-write", inputs: [], description: "Turn a digital output on or off." },
  { id: "analog-write", label: "set PWM output", category: "output", kind: "analog-write", inputs: [], description: "Write a PWM value to a pin." },
  { id: "delay", label: "wait", category: "timing", kind: "delay", inputs: [], description: "Pause the program." },
  { id: "serial-print", label: "print", category: "serial", kind: "serial-print", inputs: [], description: "Print to the serial monitor." },
  { id: "button-controls-led", label: "button controls LED", category: "logic", kind: "button-controls-led", inputs: [], description: "Use a button to switch an LED." },
  { id: "potentiometer-controls-servo", label: "knob controls servo", category: "motion", kind: "potentiometer-controls-servo", inputs: [], description: "Map a knob to a servo angle." },
  { id: "servo-write", label: "servo angle", category: "motion", kind: "servo-write", inputs: [], description: "Move a servo to an angle." },
  { id: "rgb-write", label: "RGB color", category: "output", kind: "rgb-write", inputs: [], description: "Set an RGB LED color." },
  { id: "ultrasonic-serial", label: "print distance", category: "input", kind: "ultrasonic-serial", inputs: [], description: "Measure distance and print it." },
  { id: "dht-serial", label: "print temperature", category: "input", kind: "dht-serial", inputs: [], description: "Read temperature and humidity." },
  { id: "lcd-print", label: "LCD text", category: "display", kind: "lcd-print", inputs: [], description: "Write text to an LCD." },
  { id: "oled-print", label: "OLED text", category: "display", kind: "oled-print", inputs: [], description: "Write text to an OLED." },
  { id: "neopixel-fill", label: "NeoPixel color", category: "output", kind: "neopixel-fill", inputs: [], description: "Fill a NeoPixel strip." },
  { id: "tone", label: "play tone", category: "output", kind: "tone", inputs: [], description: "Play a buzzer tone." },
  { id: "relay-write", label: "set relay", category: "output", kind: "relay-write", inputs: [], description: "Switch a relay module." },
  { id: "read-analog-serial", label: "print analog sensor", category: "input", kind: "read-analog-serial", inputs: [], description: "Read an analog component and print it." },
  { id: "read-digital-serial", label: "print digital sensor", category: "input", kind: "read-digital-serial", inputs: [], description: "Read a digital component and print it." },
  { id: "ir-read-serial", label: "print IR code", category: "communication", kind: "ir-read-serial", inputs: [], description: "Read IR remote codes." }
];

let instanceCounter = 0;

export function createComponentInstance(component: ComponentDefinition, label = component.name): ComponentInstance {
  instanceCounter += 1;
  return {
    id: `${component.id.replaceAll("-", "_")}_${instanceCounter}`,
    componentId: component.id,
    label,
    pins: { ...component.defaultPins }
  };
}

function instance(componentId: string, label?: string, pins?: PinMap): ComponentInstance {
  const definition = components.find((component) => component.id === componentId);
  if (!definition) {
    throw new Error(`Unknown component ${componentId}`);
  }
  const created = createComponentInstance(definition, label ?? definition.name);
  return { ...created, pins: { ...created.pins, ...pins } };
}

const blinkLed = instance("led", "Built-in LED", { signal: 13 });
const button = instance("button", "Start Button", { signal: 2 });
const servo = instance("servo", "Arm Servo", { signal: 9 });
const pot = instance("potentiometer", "Control Knob", { signal: "A0" });
const ultrasonic = instance("ultrasonic-hcsr04", "Distance Sensor", { trigger: 6, echo: 7 });
const dht = instance("dht22", "Weather Sensor", { signal: 4, type: "DHT22" });
const lcd = instance("lcd-1602-i2c", "Status LCD");
const strip = instance("neopixel-strip", "Light Strip", { signal: 5, count: 8 });

function project(base: Omit<ProjectDocument, "schemaVersion" | "boardId"> & Partial<Pick<ProjectDocument, "boardId">>): ProjectDocument {
  return {
    schemaVersion: "1.0.0",
    boardId: base.boardId ?? "arduino-uno",
    ...base
  };
}

export const starterProjects = {
  blink: project({
    name: "Blink",
    components: [blinkLed],
    program: [
      { kind: "digital-write", componentId: blinkLed.id, value: "HIGH" },
      { kind: "delay", ms: 1000 },
      { kind: "digital-write", componentId: blinkLed.id, value: "LOW" },
      { kind: "delay", ms: 1000 }
    ]
  }),
  buttonLed: project({
    name: "Button LED",
    components: [button, blinkLed],
    program: [{ kind: "button-controls-led", buttonId: button.id, ledId: blinkLed.id }]
  }),
  servoKnob: project({
    name: "Servo Knob",
    components: [pot, servo],
    program: [{ kind: "potentiometer-controls-servo", potentiometerId: pot.id, servoId: servo.id }]
  }),
  ultrasonicDistance: project({
    name: "Distance Meter",
    components: [ultrasonic],
    program: [{ kind: "ultrasonic-serial", componentId: ultrasonic.id, label: "distance_cm" }, { kind: "delay", ms: 250 }]
  }),
  dhtDisplay: project({
    name: "Weather LCD",
    components: [dht, lcd],
    program: [
      { kind: "dht-serial", componentId: dht.id },
      { kind: "lcd-print", componentId: lcd.id, text: "Temp + humidity", clear: true },
      { kind: "delay", ms: 1500 }
    ]
  }),
  neopixelAnimation: project({
    name: "NeoPixel Glow",
    components: [strip],
    program: [
      { kind: "neopixel-fill", componentId: strip.id, red: 24, green: 160, blue: 120 },
      { kind: "delay", ms: 500 },
      { kind: "neopixel-fill", componentId: strip.id, red: 255, green: 80, blue: 64 },
      { kind: "delay", ms: 500 }
    ]
  })
} satisfies Record<string, ProjectDocument>;

export const lessons: LessonDefinition[] = [
  {
    id: "lesson-blink",
    title: "First Blink",
    level: "icon",
    goal: "Make the built-in LED blink once per second.",
    starterProject: starterProjects.blink
  },
  {
    id: "lesson-button-led",
    title: "Button Switch",
    level: "word",
    goal: "Use a button input to control an LED output.",
    starterProject: starterProjects.buttonLed
  },
  {
    id: "lesson-servo-knob",
    title: "Servo Knob",
    level: "word",
    goal: "Turn a knob and move a servo through the matching angle.",
    starterProject: starterProjects.servoKnob
  },
  {
    id: "lesson-distance",
    title: "Distance Meter",
    level: "word",
    goal: "Print ultrasonic distance readings to the serial monitor.",
    starterProject: starterProjects.ultrasonicDistance
  },
  {
    id: "lesson-weather",
    title: "Weather Readout",
    level: "text",
    goal: "Read a DHT sensor and show status text on an LCD.",
    starterProject: starterProjects.dhtDisplay
  }
];

export const catalog: Catalog = {
  boards,
  components,
  blocks,
  lessons
};

export function getComponentDefinition(componentId: string): ComponentDefinition | undefined {
  return components.find((component) => component.id === componentId);
}

export type ExtensionParseResult = {
  manifest?: ExtensionManifest;
  errors: string[];
};

export type CatalogMergeResult = {
  catalog: Catalog;
  warnings: string[];
};

const boardFamilies: Array<BoardDefinition["family"]> = ["avr", "megaavr", "renesas", "esp32", "other"];
const componentCategories: Array<ComponentDefinition["category"]> = [
  "output",
  "input",
  "sensor",
  "display",
  "motion",
  "communication",
  "power"
];
const blockCategories: Array<BlockDefinition["category"]> = ["logic", "input", "output", "display", "timing", "serial", "motion", "communication"];
const blockKinds = new Set(blocks.map((block) => block.kind));

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function pinMap(value: unknown): PinMap | undefined {
  const candidate = record(value);
  if (!candidate) return undefined;
  return Object.values(candidate).every((item) => ["string", "number", "boolean"].includes(typeof item)) ? (candidate as PinMap) : undefined;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  const candidate = record(value);
  if (!candidate) return undefined;
  return Object.values(candidate).every((item) => typeof item === "string") ? (candidate as Record<string, string>) : undefined;
}

function runtimeTemplate(value: unknown): ComponentDefinition["runtime"] | undefined {
  if (value === undefined) return undefined;
  const candidate = record(value);
  if (!candidate) return undefined;
  const runtime: ComponentDefinition["runtime"] = {};
  for (const key of ["includes", "globals", "setup", "loop"] as const) {
    const lines = stringArray(candidate[key]);
    if (candidate[key] !== undefined && !lines) return undefined;
    if (lines) runtime[key] = lines;
  }
  if (candidate.libraries !== undefined) {
    if (!Array.isArray(candidate.libraries)) return undefined;
    const parsedLibraries: Array<LibraryDependency | undefined> = candidate.libraries.map((library) => {
      const item = record(library);
      if (!item || typeof item.name !== "string") return undefined;
      return {
        name: item.name,
        ...(typeof item.installName === "string" ? { installName: item.installName } : {}),
        ...(typeof item.version === "string" ? { version: item.version } : {})
      };
    });
    if (parsedLibraries.some((library) => !library)) return undefined;
    runtime.libraries = parsedLibraries as LibraryDependency[];
  }
  return runtime;
}

function wiring(value: unknown): ComponentDefinition["wiring"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.map((wire) => {
    const item = record(wire);
    if (!item || typeof item.label !== "string" || typeof item.from !== "string" || typeof item.to !== "string") return undefined;
    return {
      label: item.label,
      from: item.from,
      to: item.to,
      ...(typeof item.note === "string" ? { note: item.note } : {})
    };
  });
  return parsed.some((wire) => !wire) ? undefined : (parsed as ComponentDefinition["wiring"]);
}

function parseBoard(value: unknown, errors: string[], path: string): BoardDefinition | undefined {
  const item = record(value);
  if (!item) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const family = item.family;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.fqbn !== "string" ||
    typeof family !== "string" ||
    !boardFamilies.includes(family as BoardDefinition["family"])
  ) {
    errors.push(`${path} is missing required board fields.`);
    return undefined;
  }
  const digitalPins = stringArray(item.digitalPins);
  const analogPins = stringArray(item.analogPins);
  const pwmPins = stringArray(item.pwmPins);
  if (!digitalPins || !analogPins || !pwmPins) {
    errors.push(`${path} pins must be string arrays.`);
    return undefined;
  }
  return {
    id: item.id,
    name: item.name,
    fqbn: item.fqbn,
    family: family as BoardDefinition["family"],
    digitalPins,
    analogPins,
    pwmPins,
    ...(record(item.i2cPins)?.sda && record(item.i2cPins)?.scl
      ? { i2cPins: { sda: String(record(item.i2cPins)?.sda), scl: String(record(item.i2cPins)?.scl) } }
      : {}),
    ...(record(item.spiPins)?.mosi && record(item.spiPins)?.miso && record(item.spiPins)?.sck
      ? {
          spiPins: {
            mosi: String(record(item.spiPins)?.mosi),
            miso: String(record(item.spiPins)?.miso),
            sck: String(record(item.spiPins)?.sck)
          }
        }
      : {})
  };
}

function parseComponent(value: unknown, errors: string[], path: string): ComponentDefinition | undefined {
  const item = record(value);
  if (!item) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const category = item.category;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.description !== "string" ||
    typeof category !== "string" ||
    !componentCategories.includes(category as ComponentDefinition["category"])
  ) {
    errors.push(`${path} is missing required component fields.`);
    return undefined;
  }
  const defaultPins = pinMap(item.defaultPins);
  const pinLabels = stringRecord(item.pinLabels);
  const wiringHints = wiring(item.wiring);
  const runtime = runtimeTemplate(item.runtime);
  const simulatorHints = stringArray(item.simulatorHints);
  if (!defaultPins || !pinLabels || !wiringHints || (item.runtime !== undefined && !runtime) || (item.simulatorHints !== undefined && !simulatorHints)) {
    errors.push(`${path} has invalid pins, wiring, runtime, or simulator hints.`);
    return undefined;
  }
  return {
    id: item.id,
    name: item.name,
    category: category as ComponentDefinition["category"],
    description: item.description,
    defaultPins,
    pinLabels,
    wiring: wiringHints,
    ...(runtime ? { runtime } : {}),
    ...(simulatorHints ? { simulatorHints } : {})
  };
}

function parseBlock(value: unknown, errors: string[], path: string): BlockDefinition | undefined {
  const item = record(value);
  if (!item) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  if (
    typeof item.id !== "string" ||
    typeof item.label !== "string" ||
    typeof item.description !== "string" ||
    typeof item.category !== "string" ||
    !blockCategories.includes(item.category as BlockDefinition["category"]) ||
    typeof item.kind !== "string" ||
    !blockKinds.has(item.kind as BlockDefinition["kind"]) ||
    !Array.isArray(item.inputs)
  ) {
    errors.push(`${path} is missing required block fields or uses an unsupported block kind.`);
    return undefined;
  }
  return {
    id: item.id,
    label: item.label,
    category: item.category as BlockDefinition["category"],
    kind: item.kind as BlockDefinition["kind"],
    inputs: item.inputs as BlockDefinition["inputs"],
    description: item.description
  };
}

function parseLesson(value: unknown, errors: string[], path: string): LessonDefinition | undefined {
  const item = record(value);
  const starterProject = record(item?.starterProject);
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.goal !== "string" ||
    !["icon", "word", "text"].includes(String(item.level)) ||
    !starterProject ||
    starterProject.schemaVersion !== "1.0.0" ||
    typeof starterProject.name !== "string" ||
    typeof starterProject.boardId !== "string" ||
    !Array.isArray(starterProject.components) ||
    !Array.isArray(starterProject.program)
  ) {
    errors.push(`${path} is missing required lesson or starter project fields.`);
    return undefined;
  }
  return {
    id: item.id,
    title: item.title,
    level: item.level as LessonDefinition["level"],
    goal: item.goal,
    starterProject: starterProject as ProjectDocument
  };
}

function parseArray<T>(
  value: unknown,
  errors: string[],
  path: string,
  parser: (item: unknown, errors: string[], path: string) => T | undefined
): T[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return undefined;
  }
  return value.map((item, index) => parser(item, errors, `${path}[${index}]`)).filter(Boolean) as T[];
}

export function parseExtensionManifest(value: unknown): ExtensionParseResult {
  const errors: string[] = [];
  const item = record(value);
  if (!item) return { errors: ["Extension manifest must be a JSON object."] };
  if (item.formatVersion !== "1.0.0") errors.push("formatVersion must be 1.0.0.");
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9._-]+$/.test(item.id)) errors.push("id must use lowercase pack id syntax.");
  if (typeof item.name !== "string" || !item.name.trim()) errors.push("name is required.");
  if (typeof item.version !== "string" || !item.version.trim()) errors.push("version is required.");

  const parsedBoards = parseArray(item.boards, errors, "boards", parseBoard);
  const parsedComponents = parseArray(item.components, errors, "components", parseComponent);
  const parsedBlocks = parseArray(item.blocks, errors, "blocks", parseBlock);
  const parsedLessons = parseArray(item.lessons, errors, "lessons", parseLesson);

  if (errors.length > 0 || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.version !== "string") {
    return { errors };
  }

  return {
    errors: [],
    manifest: {
      formatVersion: "1.0.0",
      id: item.id,
      name: item.name,
      version: item.version,
      boards: parsedBoards ?? [],
      components: parsedComponents ?? [],
      blocks: parsedBlocks ?? [],
      lessons: parsedLessons ?? []
    }
  };
}

function mergeById<T extends { id: string }>(base: T[], additions: T[] | undefined, label: string, warnings: string[]): T[] {
  const next = new Map(base.map((item) => [item.id, item]));
  for (const item of additions ?? []) {
    if (next.has(item.id)) warnings.push(`${label} ${item.id} replaced an existing definition.`);
    next.set(item.id, item);
  }
  return Array.from(next.values());
}

export function mergeExtensionManifest(base: Catalog, manifest: ExtensionManifest): CatalogMergeResult {
  const warnings: string[] = [];
  return {
    catalog: {
      boards: mergeById(base.boards, manifest.boards, "Board", warnings),
      components: mergeById(base.components, manifest.components, "Component", warnings),
      blocks: mergeById(base.blocks, manifest.blocks, "Block", warnings),
      lessons: mergeById(base.lessons, manifest.lessons, "Lesson", warnings)
    },
    warnings
  };
}
