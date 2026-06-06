#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const cli = process.env.ARDUINO_CLI_PATH || "arduino-cli";
const port = Number(process.env.ABL_AGENT_PORT ?? 47631);
const agentBase = `http://127.0.0.1:${port}`;

function fail(message) {
  console.error(`FAIL: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

async function checkUrl(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function checkCliVersion() {
  const result = spawnSync(cli, ["version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5000
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "arduino-cli returned non-zero exit code");
  }

  return (result.stdout || "").split("\n")[0] || "Version available";
}

async function postRpc(method, params = {}) {
  const response = await fetch(`${agentBase}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params })
  });

  if (!response.ok) {
    throw new Error(`RPC failed ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "RPC returned ok=false");
  }
  return payload;
}

function toTableRow(left, right) {
  const cleanLeft = String(left).padEnd(30, " ");
  return `${cleanLeft} ${right}`;
}

async function run() {
  console.log(`Arduino Blocks Lab hardware preflight (port ${port})`);
  console.log("----------------------------------------");

  let cliVersion;
  try {
    cliVersion = checkCliVersion();
    ok(`arduino-cli detected at \"${cli}\"`);
    ok(`arduino-cli reports: ${cliVersion}`);
  } catch (error) {
    fail(`arduino-cli not available: ${error instanceof Error ? error.message : String(error)}`);
    console.log("Next: install Arduino CLI and rerun this command.");
    return 1;
  }

  const healthOk = await checkUrl(`${agentBase}/health`);
  if (!healthOk) {
    fail(`agent not reachable at ${agentBase}`);
    console.log("Next: start the helper with npm run agent and keep it running.");
    return 1;
  }
  ok(`agent reachable at ${agentBase}`);

  const status = await postRpc("agent.status");
  const detail = status.data;
  if (!detail?.available) {
    fail(`agent is online but Arduino CLI status is not available: ${detail?.error ?? "unknown"}`);
    console.log("Next: restart agent after installing CLI and try again.");
    return 1;
  }
  ok(`agent + CLI handshake ok (${detail.cli})`);

  const boards = await postRpc("boards.list");
  const boardList = Array.isArray(boards.data) ? boards.data : [];
  ok(`board list returned ${boardList.length} device entries`);

  const indexResult = await postRpc("indexes.list");
  const urls = indexResult.data?.urls;
  if (Array.isArray(urls)) {
    console.log(toTableRow("Board manager URLs", `${urls.length} configured`));
    if (urls.length > 0) {
      for (const indexUrl of urls) {
        console.log(`  - ${indexUrl}`);
      }
    }
  } else {
    console.log(toTableRow("Board manager URLs", "available but unreadable"));
  }

  console.log("----------------------------------------");
  console.log("Result summary:");

  const detectedPorts = boardList.filter((entry) => entry.address && entry.fqbn);
  const serialPorts = boardList.filter((entry) => entry.address);

  if (detectedPorts.length === 0) {
    console.log("INFO: No connected board detected with a ready FQBN.");
    console.log("Next: plug an Arduino board via USB and click Detect on the Board panel.");
    return 0;
  }

  console.log(`OK: ${detectedPorts.length} connected board candidate${detectedPorts.length === 1 ? "" : "s"}`);
  for (const device of detectedPorts) {
    console.log(`  - ${device.address} => ${device.fqbn} (${device.name ?? "Arduino board"})`);
  }
  if (serialPorts.length > detectedPorts.length) {
    console.log(`INFO: ${serialPorts.length - detectedPorts.length} extra serial devices found without recognized FQBN.`);
  }

  console.log("READY_FOR_REAL_UPLOAD_TEST=1");
  return 0;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    fail(`preflight crashed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
