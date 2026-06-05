#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultAgentPort = 47631;
export const minimumNodeVersion = { major: 20, minor: 19, patch: 0 };

export function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function nodeMeetsMinimum(version, minimum = minimumNodeVersion) {
  const parsed = parseNodeVersion(version);
  if (!parsed) return false;
  if (parsed.major !== minimum.major) return parsed.major > minimum.major;
  if (parsed.minor !== minimum.minor) return parsed.minor > minimum.minor;
  return parsed.patch >= minimum.patch;
}

export function npmExecutable(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function parseLauncherArgs(argv) {
  const options = {
    help: false,
    install: false,
    skipInstall: false,
    port: defaultAgentPort
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      options.help = true;
    } else if (value === "--install") {
      options.install = true;
    } else if (value === "--skip-install") {
      options.skipInstall = true;
    } else if (value === "--port") {
      const next = argv[index + 1];
      if (!next) throw new Error("Missing value after --port.");
      options.port = normalizePort(next);
      index += 1;
    } else if (value.startsWith("--port=")) {
      options.port = normalizePort(value.slice("--port=".length));
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }

  if (options.install && options.skipInstall) {
    throw new Error("Use either --install or --skip-install, not both.");
  }

  return options;
}

export function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Agent port must be an integer from 1024 to 65535.");
  }
  return port;
}

export function dependenciesInstalled(rootDir, platform = process.platform) {
  const binaryName = platform === "win32" ? "tsx.cmd" : "tsx";
  return existsSync(join(rootDir, "node_modules", ".bin", binaryName));
}

export function shouldInstallDependencies({ install, skipInstall, installed }) {
  if (install) return true;
  if (skipInstall) return false;
  return !installed;
}

export function repoRootFromScript(scriptUrl = import.meta.url) {
  return resolve(dirname(fileURLToPath(scriptUrl)), "..");
}

export function isDirectRun(metaUrl, argvPath) {
  if (!argvPath) return false;
  return pathToFileURL(resolve(argvPath)).href === metaUrl;
}

function helpText() {
  return [
    "Arduino Blocks Lab local agent launcher",
    "",
    "Usage:",
    "  npm run agent",
    "  node scripts/launch-agent.mjs [--install] [--skip-install] [--port 47631]",
    "",
    "Options:",
    "  --install       Run npm install even when dependencies already exist.",
    "  --skip-install  Start without installing missing dependencies.",
    "  --port <port>   Set the localhost agent port. Defaults to 47631.",
    "  --help          Show this help."
  ].join("\n");
}

function run(command, args, options) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit"
    });
    child.on("close", (code) => resolvePromise(code ?? 1));
    child.on("error", () => resolvePromise(1));
  });
}

async function agentAlreadyRunning(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function arduinoCliAvailable(env) {
  const cli = env.ARDUINO_CLI_PATH || "arduino-cli";
  const result = spawnSync(cli, ["version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return {
    available: result.status === 0,
    cli,
    message: (result.stdout || result.stderr || "").trim()
  };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  let options;
  try {
    options = parseLauncherArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(helpText());
    return 1;
  }

  if (options.help) {
    console.log(helpText());
    return 0;
  }

  const rootDir = repoRootFromScript();
  if (!existsSync(join(rootDir, "package.json"))) {
    console.error("Run this from the Arduino Blocks Lab repository.");
    return 1;
  }

  console.log("Arduino Blocks Lab local agent");
  console.log(`Repo: ${rootDir}`);
  console.log(`Port: ${options.port}`);

  if (!nodeMeetsMinimum(process.version)) {
    console.error(`Node.js ${minimumNodeVersion.major}.${minimumNodeVersion.minor}.0 or newer is required. Current: ${process.version}`);
    return 1;
  }

  if (await agentAlreadyRunning(options.port)) {
    console.log(`Agent is already running at http://127.0.0.1:${options.port}`);
    console.log(`Status page: http://127.0.0.1:${options.port}/`);
    return 0;
  }

  const cli = arduinoCliAvailable(env);
  if (cli.available) {
    console.log(`Arduino CLI found: ${cli.cli}`);
  } else {
    console.warn(`Arduino CLI was not found at "${cli.cli}".`);
    console.warn("The agent will still start, but compile/upload needs Arduino CLI installed.");
  }

  const npm = npmExecutable();
  const installed = dependenciesInstalled(rootDir);
  if (shouldInstallDependencies({ install: options.install, skipInstall: options.skipInstall, installed })) {
    console.log("Installing workspace dependencies. This can take a minute on the first run.");
    const installCode = await run(npm, ["install"], { cwd: rootDir, env });
    if (installCode !== 0) return installCode;
  } else if (installed) {
    console.log("Workspace dependencies are ready.");
  } else {
    console.warn("Workspace dependencies are missing because --skip-install was used.");
  }

  console.log(`Starting the localhost agent. Status page: http://127.0.0.1:${options.port}/`);
  console.log("Keep this terminal open while uploading.");
  return run(npm, ["run", "start", "-w", "@abl/agent"], {
    cwd: rootDir,
    env: {
      ...env,
      ABL_AGENT_PORT: String(options.port)
    }
  });
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
