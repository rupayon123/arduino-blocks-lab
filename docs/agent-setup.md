# Local Agent Setup

The public web app can generate and autosave projects by itself, but real USB upload needs the local agent because browsers cannot directly compile arbitrary Arduino sketches and upload them to serial boards.

## macOS

```bash
brew install arduino-cli
npm install
npm run dev:agent
```

## Windows

1. Install Node.js 22 or newer.
2. Install Arduino CLI from the official Arduino CLI releases or with a package manager.
3. Run:

```powershell
npm install
npm run dev:agent
```

## Linux

1. Install Node.js 22 or newer.
2. Install Arduino CLI.
3. Add your user to the serial port group if needed, usually `dialout`.
4. Run:

```bash
npm install
npm run dev:agent
```

## How Board Support Works

Arduino Blocks Lab compiles and uploads using Arduino CLI FQBNs, such as:

```text
arduino:avr:uno
arduino:avr:nano
arduino:avr:mega
```

When you compile or upload, the agent prepares the matching core and project libraries before running `arduino-cli compile` or `arduino-cli upload`.

For third-party boards, install or configure their Arduino CLI package index first, then paste the board FQBN into the app.

## Troubleshooting

- If the app says the agent is offline, run `npm run dev:agent`.
- If the app says Arduino CLI is not ready, install `arduino-cli` and make sure it is on your `PATH`.
- If a board is not detected, try another USB cable and confirm the board appears in Arduino IDE or `arduino-cli board list`.
- If upload fails on Linux, check serial permissions.
- If a library fails to install, confirm the library name is available through Arduino Library Manager.
