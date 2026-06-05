# Local Agent Setup

The public web app can generate and autosave projects by itself, but real USB upload needs the local agent because browsers cannot directly compile arbitrary Arduino sketches and upload them to serial boards.

The simplest path after cloning this repo is:

```bash
npm run agent
```

The launcher installs missing workspace packages on first run, checks whether Arduino CLI is available, and starts the localhost helper. Keep that terminal open while using the public web app. You can also open `http://127.0.0.1:47631/` to see the local helper status page.

## macOS

```bash
brew install arduino-cli
git clone https://github.com/pisces123/arduino-blocks-lab.git
cd arduino-blocks-lab
npm run agent
```

## Windows

1. Install Node.js 20.19 or newer.
2. Install Arduino CLI from the official Arduino CLI releases or with a package manager.
3. Run:

```powershell
winget install ArduinoSA.CLI
git clone https://github.com/pisces123/arduino-blocks-lab.git
cd arduino-blocks-lab
npm run agent
```

## Linux

1. Install Node.js 20.19 or newer.
2. Install Arduino CLI.
3. Add your user to the serial port group if needed, usually `dialout`.
4. Run:

```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
git clone https://github.com/pisces123/arduino-blocks-lab.git
cd arduino-blocks-lab
sudo usermod -a -G dialout $USER
npm run agent
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

The Board panel in the web app shows an upload readiness checklist before compile/upload. It checks the local agent, Arduino CLI, FQBN target, USB port, required libraries, and wiring diagnostics so beginners can fix setup issues before seeing raw compiler output.

The same panel includes Connection Doctor. It watches the current setup state and recent compile/upload messages, then turns common failures into a likely cause and a next action:

- Missing headers or library errors point learners to the Libraries button.
- Invalid FQBN or missing core errors point learners back to board target search.
- USB permission, access denied, or busy-port errors point learners to port setup help.
- `avrdude`, sync, timeout, or no-device upload errors point learners to board target, port, cable, and reset checks.
- Generic compile errors point learners to the Arduino C++ view so the generated sketch stays visible.

The same panel also includes a serial console. Choose a baud rate, open Monitor, then send commands with no ending, newline, carriage return, or both NL + CR. The agent passes the baud rate to Arduino CLI monitor with `--config baudrate=<value>`.

## Local Status Page

When the agent is running, `http://127.0.0.1:47631/` shows a friendly status page with:

- the helper port,
- Arduino CLI readiness,
- links back to the public web app and setup guide,
- the health JSON endpoint,
- the RPC and events endpoints used by the web app.

## Troubleshooting

- If the app says the agent is offline, run `npm run agent` from the repo folder.
- If the app says Arduino CLI is not ready, install `arduino-cli` and make sure it is on your `PATH`.
- If a board is not detected, try another USB cable and confirm the board appears in Arduino IDE or `arduino-cli board list`.
- If upload fails on Linux, check serial permissions.
- If a library fails to install, confirm the library name is available through Arduino Library Manager.
- If Connection Doctor shows an `avrdude` sync issue, confirm the board target and port match the actual board, reconnect USB, then try reset right before upload.
