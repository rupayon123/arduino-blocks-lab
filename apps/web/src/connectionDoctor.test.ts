import { describe, expect, it } from "vitest";
import { collectConnectionDoctor, type ConnectionDoctorInput } from "./connectionDoctor";

const readyChecklist: ConnectionDoctorInput["uploadReadiness"] = {
  title: "Ready to upload",
  detail: "Everything needed for a real board upload is in place.",
  readyToCompile: true,
  readyToUpload: true,
  blockedCount: 0,
  warningCount: 0,
  items: []
};

const baseInput: ConnectionDoctorInput = {
  agentOnline: true,
  cliStatus: { available: true, cli: "arduino-cli" },
  packageIndexNeeded: false,
  packageIndexReady: true,
  packageIndexState: "idle",
  packageIndexLabel: "Arduino",
  fqbn: "arduino:avr:uno",
  core: "arduino:avr",
  coreReady: true,
  coreState: "idle",
  selectedPort: "/dev/cu.usbmodem101",
  libraries: [],
  librariesReady: true,
  uploadReadiness: readyChecklist,
  compileState: "idle",
  uploadState: "idle",
  serialOpen: false,
  wiringDiagnostics: [],
  recentMessages: ["Agent connected. Arduino CLI ready at arduino-cli."]
};

describe("collectConnectionDoctor", () => {
  it("opens setup guidance when the local agent is offline", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      agentOnline: false,
      cliStatus: null,
      uploadReadiness: { ...readyChecklist, readyToCompile: false, readyToUpload: false }
    });

    expect(result.severity).toBe("blocked");
    expect(result.action).toBe("open-setup");
    expect(result.title).toContain("helper");
  });

  it("points missing header compile errors to library installation", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      libraries: ["DHT sensor library"],
      librariesReady: false,
      compileState: "error",
      recentMessages: ["Compile failed: fatal error: DHT.h: No such file or directory"]
    });

    expect(result.action).toBe("install-libraries");
    expect(result.fix).toContain("DHT sensor library");
  });

  it("prompts for core preparation before first compile on a fresh machine", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      coreReady: false
    });

    expect(result.action).toBe("install-core");
    expect(result.title).toBe("Prepare board support");
  });

  it("asks for the package index before a third-party core install", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      packageIndexNeeded: true,
      packageIndexReady: false,
      packageIndexLabel: "ESP32",
      packageIndexUrl: "https://espressif.github.io/arduino-esp32/package_esp32_index.json",
      fqbn: "esp32:esp32:esp32",
      core: "esp32:esp32",
      coreReady: false
    });

    expect(result.action).toBe("add-package-index");
    expect(result.title).toContain("package index");
  });

  it("offers core preparation when Arduino CLI reports a missing platform", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      coreReady: false,
      compileState: "error",
      recentMessages: ["Compile failed: platform arduino:avr is not installed"]
    });

    expect(result.action).toBe("install-core");
    expect(result.fix).toContain("arduino:avr");
  });

  it("blocks incomplete FQBNs before Arduino CLI sees them", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      fqbn: "uno",
      core: "",
      coreReady: false
    });

    expect(result.action).toBe("search-target");
    expect(result.title).toContain("full target");
  });

  it("diagnoses blocked serial ports during upload", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      compileState: "success",
      uploadState: "error",
      recentMessages: ["Upload failed: avrdude: ser_open(): can't open device /dev/cu.usbmodem101: Resource busy"]
    });

    expect(result.title).toBe("USB port is blocked");
    expect(result.action).toBe("open-setup");
  });

  it("diagnoses avrdude sync failures as target or port mismatch", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      compileState: "success",
      uploadState: "error",
      recentMessages: ["Upload failed: avrdude: stk500_getsync() attempt 1 of 10: not in sync"]
    });

    expect(result.title).toBe("Board did not answer upload");
    expect(result.action).toBe("detect");
  });

  it("moves from successful compile to upload", () => {
    const result = collectConnectionDoctor({
      ...baseInput,
      compileState: "success"
    });

    expect(result.severity).toBe("ready");
    expect(result.action).toBe("upload");
  });
});
