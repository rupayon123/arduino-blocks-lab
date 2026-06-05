import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { WebSocketServer, type WebSocket } from "ws";
import { z } from "zod";
import { boards } from "@abl/catalog";
import { renderAgentLandingPage } from "./landingPage";

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.ABL_AGENT_PORT ?? 47631);
const CLI = process.env.ARDUINO_CLI_PATH ?? "arduino-cli";
const WEB_APP_URL = process.env.ABL_WEB_APP_URL ?? "https://pisces123.github.io/arduino-blocks-lab/";
const SETUP_DOCS_URL = "https://github.com/pisces123/arduino-blocks-lab/blob/main/docs/agent-setup.md";

const rpcSchema = z.object({
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional()
});

type RpcResult = {
  ok: boolean;
  method: string;
  data?: unknown;
  error?: string;
  stdout?: string;
  stderr?: string;
};

type MonitorSession = {
  process: ChildProcessWithoutNullStreams;
  port: string;
  fqbn?: string;
  baudRate?: number;
};

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/events" });
const sockets = new Set<WebSocket>();
const monitors = new Map<string, MonitorSession>();

app.use((_request, response, next) => {
  response.header("Access-Control-Allow-Private-Network", "true");
  next();
});
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false
  })
);
app.use(express.json({ limit: "2mb" }));

function broadcast(payload: unknown) {
  const message = JSON.stringify(payload);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(message);
  }
}

wss.on("connection", (socket) => {
  sockets.add(socket);
  socket.send(JSON.stringify({ type: "agent.ready", port: PORT }));
  socket.on("close", () => sockets.delete(socket));
});

async function runCli(args: string[], options: { timeout?: number } = {}) {
  try {
    const result = await execFileAsync(CLI, args, {
      timeout: options.timeout ?? 60_000,
      maxBuffer: 1024 * 1024 * 8
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string; code?: number };
    throw new Error(`${err.message}\n${err.stderr ?? ""}\n${err.stdout ?? ""}`.trim());
  }
}

async function runCliJson(args: string[]) {
  const { stdout } = await runCli([...args, "--format", "json"]);
  if (!stdout.trim()) return null;
  return JSON.parse(stdout);
}

async function cliStatus() {
  try {
    const version = await runCliJson(["version"]);
    return { available: true, cli: CLI, version };
  } catch (error) {
    return {
      available: false,
      cli: CLI,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function boardById(boardId?: unknown) {
  if (typeof boardId !== "string") return undefined;
  return boards.find((board) => board.id === boardId);
}

function coreFromFqbn(fqbn: string) {
  const [vendor, architecture] = fqbn.split(":");
  return vendor && architecture ? `${vendor}:${architecture}` : undefined;
}

async function ensureCore(fqbn: string) {
  const core = coreFromFqbn(fqbn);
  if (!core) return undefined;
  try {
    return await runCli(["core", "install", core], { timeout: 180_000 });
  } catch (error) {
    throw new Error(`Could not prepare board core ${core}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function withSketchFile(sketchName: string, code: string, callback: (sketchDir: string) => Promise<unknown>) {
  const dir = await mkdtemp(join(tmpdir(), "abl-sketch-"));
  const sketchDir = join(dir, sketchName.replace(/[^a-zA-Z0-9_]/g, "_") || "Sketch");
  await writeFile(join(dir, ".keep"), "");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(sketchDir, { recursive: true }));
  await writeFile(join(sketchDir, `${sketchName.replace(/[^a-zA-Z0-9_]/g, "_") || "Sketch"}.ino`), code, "utf8");
  try {
    return await callback(sketchDir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function installLibraries(libraries: unknown) {
  const names = z.array(z.string()).parse(libraries ?? []);
  const results = [];
  for (const name of names) {
    results.push(await runCli(["lib", "install", name], { timeout: 120_000 }));
  }
  return results;
}

async function handleRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  switch (method) {
    case "agent.health":
      return { port: PORT, cli: CLI, boards };
    case "agent.status":
      return cliStatus();
    case "boards.list":
      return runCliJson(["board", "list"]);
    case "boards.detect":
      return runCliJson(["board", "list"]);
    case "boards.search": {
      const query = z.string().optional().parse(params.query);
      await runCli(["core", "update-index"], { timeout: 180_000 });
      return runCliJson(query ? ["board", "listall", query] : ["board", "listall"]);
    }
    case "indexes.update":
      return runCli(["core", "update-index"], { timeout: 180_000 });
    case "cores.install": {
      const core = z.string().parse(params.core);
      return runCli(["core", "install", core], { timeout: 180_000 });
    }
    case "libraries.install":
      return installLibraries(params.libraries);
    case "sketch.compile": {
      const code = z.string().parse(params.code);
      const board = boardById(params.boardId);
      const fqbn = z.string().optional().parse(params.fqbn) ?? board?.fqbn;
      if (!fqbn) throw new Error("Missing boardId or fqbn for compile.");
      const libraries = z.array(z.string()).optional().parse(params.libraries);
      if (params.installCore !== false) await ensureCore(fqbn);
      if (libraries?.length) await installLibraries(libraries);
      return withSketchFile(z.string().optional().parse(params.name) ?? "ArduinoBlocksLab", code, async (sketchDir) =>
        runCli(["compile", "--fqbn", fqbn, sketchDir], { timeout: 180_000 })
      );
    }
    case "sketch.upload": {
      const code = z.string().parse(params.code);
      const port = z.string().parse(params.port);
      const board = boardById(params.boardId);
      const fqbn = z.string().optional().parse(params.fqbn) ?? board?.fqbn;
      if (!fqbn) throw new Error("Missing boardId or fqbn for upload.");
      const libraries = z.array(z.string()).optional().parse(params.libraries);
      if (params.installCore !== false) await ensureCore(fqbn);
      if (libraries?.length) await installLibraries(libraries);
      return withSketchFile(z.string().optional().parse(params.name) ?? "ArduinoBlocksLab", code, async (sketchDir) => {
        await runCli(["compile", "--fqbn", fqbn, sketchDir], { timeout: 180_000 });
        return runCli(["upload", "-p", port, "--fqbn", fqbn, sketchDir], { timeout: 180_000 });
      });
    }
    case "serial.open": {
      const port = z.string().parse(params.port);
      const fqbn = z.string().optional().parse(params.fqbn);
      const baudRate = z.coerce.number().int().positive().optional().parse(params.baudRate);
      if (monitors.has(port)) return { port, alreadyOpen: true };
      const args = ["monitor", "-p", port];
      if (fqbn) args.push("--fqbn", fqbn);
      if (baudRate) args.push("--config", `baudrate=${baudRate}`);
      const child = spawn(CLI, args, { stdio: "pipe" });
      const session: MonitorSession = { process: child, port, fqbn, baudRate };
      monitors.set(port, session);
      child.stdout.on("data", (chunk) => broadcast({ type: "serial.data", port, data: chunk.toString() }));
      child.stderr.on("data", (chunk) => broadcast({ type: "serial.error", port, data: chunk.toString() }));
      child.on("close", (code) => {
        monitors.delete(port);
        broadcast({ type: "serial.closed", port, code });
      });
      return { port, opened: true };
    }
    case "serial.write": {
      const port = z.string().parse(params.port);
      const data = z.string().parse(params.data);
      const session = monitors.get(port);
      if (!session) throw new Error(`Serial monitor is not open for ${port}`);
      session.process.stdin.write(data);
      return { port, written: data.length };
    }
    case "serial.close": {
      const port = z.string().parse(params.port);
      const session = monitors.get(port);
      if (!session) return { port, closed: false };
      session.process.kill();
      monitors.delete(port);
      return { port, closed: true };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, port: PORT, cli: CLI });
});

app.get("/", async (_request, response) => {
  const status = await cliStatus();
  response.type("html").send(
    renderAgentLandingPage({
      port: PORT,
      cli: status.cli,
      cliAvailable: status.available,
      cliDetail: status.available ? "Arduino CLI is answering." : status.error,
      boardCount: boards.length,
      webAppUrl: WEB_APP_URL,
      docsUrl: SETUP_DOCS_URL
    })
  );
});

app.post("/rpc", async (request, response) => {
  const parsed = rpcSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }

  const { method, params } = parsed.data;
  try {
    const data = await handleRpc(method, params);
    response.json({ ok: true, method, data } satisfies RpcResult);
  } catch (error) {
    response.status(500).json({ ok: false, method, error: error instanceof Error ? error.message : String(error) } satisfies RpcResult);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Arduino Blocks Lab agent listening on http://127.0.0.1:${PORT}`);
});
