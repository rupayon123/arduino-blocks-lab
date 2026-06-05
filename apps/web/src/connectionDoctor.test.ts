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
  fqbn: "arduino:avr:uno",
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
