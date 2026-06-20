# Arduino Blocks Lab Block Pack Format

Block packs are JSON documents, and may be authored as YAML if converted to the same shape before publishing.

```json
{
  "formatVersion": "1.0.0",
  "id": "vendor.sensor-pack",
  "name": "Vendor Sensor Pack",
  "version": "0.1.0",
  "boards": [],
  "components": [],
  "blocks": [],
  "lessons": []
}
```

Each component describes wiring, required Arduino libraries, and code snippets for `include`, global declarations, setup, and loop snippets. Blocks reference those components through typed inputs and emit operations that the code generator can turn into Arduino C++.

The V1 app ships one built-in pack for Uno/Nano/Mega starter hardware. Future packs should be installable without changing the editor source.

## Importing Packs

The web app can import JSON hardware packs from the built-in gallery, from the toolbar button with the package icon, from a local file in the Packs panel, or from a URL. Imported packs are saved in browser storage and merged into the running catalog when the app opens:

- `boards` appear in the board picker and provide pin maps for wiring diagnostics.
- `components` appear in hardware search/categories and can be added to projects.
- component `runtime` snippets feed generated Arduino C++ includes, globals, setup, loop, and library dependencies.
- `lessons` appear in the mission path if their starter projects use components from the merged catalog.

The `Packs` panel shows installed packs, lets you remove one pack, and can reset back to the built-in catalog.

## Gallery Index

The public gallery is a JSON index at `apps/web/public/packs/index.json`. Each entry points to an extension manifest:

```json
{
  "id": "community.soil-moisture",
  "name": "Community Soil Moisture Pack",
  "description": "Adds a capacitive soil moisture sensor and a Plant Probe lesson.",
  "url": "packs/soil-moisture-pack.json",
  "tags": ["sensor", "plants", "serial"],
  "componentCount": 1,
  "lessonCount": 1
}
```

Use same-origin URLs for packs bundled with the app, or public HTTPS URLs for community packs hosted elsewhere. A gallery entry can point to one tiny component pack or to a larger classroom pack with several sensors and lessons.

The URL installer accepts direct JSON URLs and common GitHub links such as:

```text
https://github.com/rupayon123/arduino-blocks-lab/blob/main/examples/extensions/soil-moisture-pack.json
```

GitHub `blob` links are converted to raw content URLs before fetching. Third-party hosts must allow browser CORS requests.

V1 imported packs can reuse built-in block operations such as analog serial, digital serial, joystick serial, motor drive, relay write, tone, and display print. Fully custom Blockly block rendering is still a future extension-pack milestone.

## Guided Lessons

Lessons can be simple starter projects, or they can include a classroom guide. The guide fields are optional; if they are absent, the app derives materials, wiring count, block count, and a basic four-step guide from the starter project.

```json
{
  "id": "vendor.distance-lesson",
  "title": "Distance Alert",
  "level": "word",
  "goal": "Measure distance and react when an object is close.",
  "minutes": 30,
  "concepts": ["sensor timing", "serial monitor"],
  "materials": ["Arduino Uno", "HC-SR04 ultrasonic sensor", "jumper wires"],
  "steps": [
    {
      "title": "Wire the sensor",
      "detail": "Connect trigger, echo, VCC, and GND to the pins in the starter project.",
      "action": "wire",
      "checklist": ["Trig pin matches", "Echo pin matches", "Ground is connected"]
    },
    {
      "title": "Test readings",
      "detail": "Upload, open the serial monitor, and move an object closer to the sensor.",
      "action": "test",
      "checklist": ["Serial monitor opens", "Numbers change with distance"]
    }
  ],
  "success": ["Distance values change when an object moves."],
  "teacherNotes": ["Use a flat object for more stable first readings."],
  "starterProject": { "schemaVersion": "1.0.0", "name": "Distance Alert", "boardId": "arduino-uno", "components": [], "program": [] }
}
```

Step `action` may be `build`, `wire`, `code`, `test`, `upload`, or `reflect`.

See `examples/extensions/soil-moisture-pack.json` for a minimal community sensor pack, and `examples/extensions/classroom-sensors-pack.json` for a multi-sensor classroom pack with four guided lessons.

The authoritative JSON Schema lives in `docs/extension.schema.json`.
