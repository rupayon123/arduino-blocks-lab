import { describe, expect, it } from "vitest";
import { collectUploadReadiness } from "./uploadReadiness";
import type { WiringDiagnostic } from "./wiringDiagnostics";

const cliStatus = { available: true, cli: "arduino-cli" };

function readiness(overrides: Partial<Parameters<typeof collectUploadReadiness>[0]> = {}) {
  return collectUploadReadiness({
    agentOnline: true,
    cliStatus,
    packageIndexNeeded: false,
    packageIndexReady: true,
    packageIndexLabel: "Arduino",
    fqbn: "arduino:avr:uno",
    core: "arduino:avr",
    coreReady: false,
    selectedPort: "/dev/cu.usbmodem101",
    libraries: [],
    wiringDiagnostics: [],
    ...overrides
  });
}

function diagnostic(severity: WiringDiagnostic["severity"]): WiringDiagnostic {
  return {
    severity,
    title: `${severity} test`,
    message: "Test diagnostic"
  };
}

describe("collectUploadReadiness", () => {
  it("blocks compile and upload when the local agent is offline", () => {
    const result = readiness({ agentOnline: false, cliStatus: null });

    expect(result.title).toBe("Setup needed");
    expect(result.readyToCompile).toBe(false);
    expect(result.readyToUpload).toBe(false);
    expect(result.items.find((item) => item.id === "agent")?.state).toBe("blocked");
  });

  it("allows compile but blocks upload when no port is selected", () => {
    const result = readiness({ selectedPort: "" });

    expect(result.title).toBe("Ready to compile");
    expect(result.readyToCompile).toBe(true);
    expect(result.readyToUpload).toBe(false);
    expect(result.items.find((item) => item.id === "port")?.state).toBe("blocked");
  });

  it("shows an unprepared board core without blocking compile", () => {
    const result = readiness({ coreReady: false });

    expect(result.readyToCompile).toBe(true);
    expect(result.items.find((item) => item.id === "core")?.state).toBe("info");
  });

  it("blocks compile until a required third-party package index is configured", () => {
    const result = readiness({
      packageIndexNeeded: true,
      packageIndexReady: false,
      packageIndexLabel: "ESP32",
      fqbn: "esp32:esp32:esp32",
      core: "esp32:esp32"
    });

    expect(result.readyToCompile).toBe(false);
    expect(result.items.find((item) => item.id === "package-index")?.state).toBe("blocked");
  });

  it("blocks compile when the FQBN cannot resolve to a core", () => {
    const result = readiness({ fqbn: "uno", core: "" });

    expect(result.readyToCompile).toBe(false);
    expect(result.items.find((item) => item.id === "core")?.state).toBe("blocked");
  });

  it("keeps wiring warnings visible without blocking upload", () => {
    const result = readiness({ wiringDiagnostics: [diagnostic("warning")] });

    expect(result.readyToUpload).toBe(true);
    expect(result.warningCount).toBe(1);
    expect(result.items.find((item) => item.id === "wiring")?.state).toBe("warning");
  });

  it("blocks compile and upload for wiring errors", () => {
    const result = readiness({ wiringDiagnostics: [diagnostic("error")] });

    expect(result.readyToCompile).toBe(false);
    expect(result.readyToUpload).toBe(false);
    expect(result.items.find((item) => item.id === "wiring")?.state).toBe("blocked");
  });
});
