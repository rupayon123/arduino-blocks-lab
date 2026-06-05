# Arduino Blocks Lab

Open-source Arduino block coding, inspired by the friendliness of LEGO SPIKE and styled around bright Arduino blue.

## What is included

- React + Vite web app with Blockly, live Arduino C++ output, lessons, project coach checklist, wiring hints, printable build guides, auto pin planning, shareable project links, upload readiness checks, autosave, and project save/load.
- Node local agent wrapping `arduino-cli` for board detection, all Arduino CLI FQBN targets, library/core install, compile, upload, and serial monitor.
- Shared TypeScript packages for block-pack schemas, the V1 hardware catalog, and Arduino C++ generation.
- Persistent JSON hardware-pack import for community sensors, boards, lessons, wiring hints, and Arduino C++ snippets.
- GitHub Pages deployment workflow for the public web app.

## Why this should become better than the current options

- SPIKE-style friendliness, but for real Arduino hardware and open-source sensor packs.
- Browser-based project building, with a local agent for real compile/upload instead of export-only sketches.
- Project coach turns board, hardware, blocks, wiring, code, and upload state into beginner-friendly next steps.
- Printable build guides turn each project into parts, component pins, wiring steps, library notes, checks, upload steps, and the generated sketch.
- Shareable project links let a learner send a complete blocks-and-hardware project without accounts or cloud storage.
- Board-aware pin assistant can fix duplicate, invalid, analog, and PWM pin choices while showing a live pin usage map.
- Beginner-safe upload preflight shows the agent, Arduino CLI, board target, USB port, libraries, and wiring state before compile/upload.
- Built-in serial console supports baud selection, line endings, command sending, and a focused transcript for sensor debugging.
- Arduino C++ as the trusted generated output, plus Python and JavaScript previews for learning.
- A public roadmap for wiring validation, simulator exports, mission-map lessons, and community hardware packs.

## Public web app

The web app is designed to deploy from GitHub Pages. After the first successful `main` workflow run, it will be available at:

```text
https://pisces123.github.io/arduino-blocks-lab/
```

The web app can create projects and generate Arduino C++ on its own. To program real USB boards from the public site, run the local agent below.

## Run it

```bash
npm install
npm run dev
```

The web app runs on `http://localhost:5173`, and the local agent runs on `http://127.0.0.1:47631`.

Install `arduino-cli` separately if you want compile/upload to real boards:

```bash
brew install arduino-cli
npm run dev:agent
```

The agent exposes a localhost API only. It lets the hosted web app detect boards, search Arduino CLI board targets, prepare cores and libraries, compile, upload, and open the serial monitor.

More setup detail is in `docs/agent-setup.md`.

## Test it

```bash
npm test
npm run build
```

## Open source

Arduino Blocks Lab is released under the MIT License. Contributions can add new block packs through the extension format in `docs/extension-format.md`; a starter example lives in `examples/extensions/soil-moisture-pack.json`.

See `ROADMAP.md` and `CONTRIBUTING.md` for the next build targets.
