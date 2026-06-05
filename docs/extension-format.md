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

The web app can now import JSON hardware packs from the toolbar button with the package icon. Imported packs are merged into the running catalog for the current browser session:

- `boards` appear in the board picker and provide pin maps for wiring diagnostics.
- `components` appear in hardware search/categories and can be added to projects.
- component `runtime` snippets feed generated Arduino C++ includes, globals, setup, loop, and library dependencies.
- `lessons` appear in the mission path if their starter projects use components from the merged catalog.

V1 imported packs can reuse the built-in block operations such as analog serial, digital serial, relay write, tone, and display print. Fully custom Blockly block rendering is still a future extension-pack milestone.

See `examples/extensions/soil-moisture-pack.json` for a minimal community sensor pack.

The authoritative JSON Schema lives in `docs/extension.schema.json`.
