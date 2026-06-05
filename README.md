# Arduino Blocks Lab

Open-source Arduino block coding, inspired by the friendliness of LEGO SPIKE and styled around bright Arduino blue.

## What is included

- React + Vite web app with Blockly, live Arduino C++ output, guided lesson sheets, teacher unit plans, project coach checklist, visual wiring canvas, printable build guides, auto pin planning, shareable project links, upload readiness checks, autosave, and project save/load.
- Node local agent wrapping `arduino-cli` for board detection, all Arduino CLI FQBN targets, library/core install, compile, upload, and serial monitor.
- Shared TypeScript packages for block-pack schemas, the V1 hardware catalog, and Arduino C++ generation.
- Persistent JSON hardware-pack gallery and import from files or URLs for community sensors, boards, lessons, wiring hints, and Arduino C++ snippets.
- Built-in gallery packs for plant probes and common classroom sensors show how the catalog grows toward broader Arduino hardware coverage.
- GitHub Pages deployment workflow for the public web app.
- One-command local agent launcher that installs missing workspace packages, checks Arduino CLI, and starts the upload helper.

## Why this should become better than the current options

- SPIKE-style friendliness, but for real Arduino hardware and open-source sensor packs.
- Browser-based project building, with a local agent for real compile/upload instead of export-only sketches.
- Project coach turns board, hardware, blocks, wiring, code, and upload state into beginner-friendly next steps.
- Guided lesson sheets turn each mission into materials, concepts, activity steps, success checks, teacher notes, and a downloadable build guide.
- Teacher unit plans summarize mission pacing, materials, concepts, libraries, prep notes, and lesson load into an exportable handout.
- Mission path unlocks lessons in order, recommends the next activity, and shows remaining classroom pacing time.
- Printable build guides turn each project into parts, component pins, wiring steps, library notes, checks, upload steps, and the generated sketch.
- Shareable project links let a learner send a complete blocks-and-hardware project without accounts or cloud storage.
- Hardware pack gallery plus URL install supports raw JSON URLs and common GitHub pack links so new sensors can be shared from public repos.
- Visual wiring canvas turns board pins, power rails, buses, and components into readable wire rows with conflict/error states.
- Board-aware pin assistant can fix duplicate, invalid, analog, and PWM pin choices while showing a live pin usage map.
- Wiring repair assistant translates pin conflicts into exact student-friendly repair steps and safe one-click pin moves.
- Circuit Studio now grades simulator readiness, shows what Wokwi can export, adds breadboard preflight checks, and keeps virtual bench tests next to the 3D circuit plan.
- Beginner-safe upload preflight shows the agent, Arduino CLI, board target, USB port, libraries, and wiring state before compile/upload.
- Connection Doctor turns common Arduino CLI, library, USB permission, and avrdude upload failures into a likely cause and next action.
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
npm run agent
```

The launcher installs missing npm packages on first run, checks for Arduino CLI, and starts the agent. Open `http://127.0.0.1:47631/` to see the local status page. The agent exposes a localhost API only. It lets the hosted web app detect boards, search Arduino CLI board targets, prepare cores and libraries, compile, upload, and open the serial monitor.

More setup detail is in `docs/agent-setup.md`.

## Test it

```bash
npm test
npm run build
```

## Open source

Arduino Blocks Lab is released under the MIT License. Contributions can add new block packs through the extension format in `docs/extension-format.md`; examples live in `examples/extensions/soil-moisture-pack.json` and `examples/extensions/classroom-sensors-pack.json`.

See `ROADMAP.md` and `CONTRIBUTING.md` for the next build targets.
