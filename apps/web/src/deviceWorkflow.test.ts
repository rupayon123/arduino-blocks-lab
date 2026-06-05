import { describe, expect, it } from "vitest";
import { collectDeviceWorkflow, type DeviceWorkflowInput } from "./deviceWorkflow";

const baseInput: DeviceWorkflowInput = {
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
  uploadReadiness: {
    title: "Ready to upload",
    detail: "Everything needed for a real board upload is in place.",
    readyToCompile: true,
    readyToUpload: true,
    blockedCount: 0,
    warningCount: 0,
    items: []
  },
  compileState: "idle",
  uploadState: "idle",
  serialOpen: false,
  wiringDiagnostics: []
};

describe("collectDeviceWorkflow", () => {
  it("starts with checking the agent when the local helper is offline", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      agentOnline: false,
      cliStatus: null,
      uploadReadiness: { ...baseInput.uploadReadiness, readyToCompile: false, readyToUpload: false }
    });

    expect(workflow.title).toBe("Next: Agent + CLI");
    expect(workflow.nextAction).toBe("check-agent");
    expect(workflow.steps.find((step) => step.id === "agent")?.state).toBe("blocked");
  });

  it("asks for USB detection when compile is ready but no port is selected", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      selectedPort: "",
      uploadReadiness: { ...baseInput.uploadReadiness, readyToCompile: true, readyToUpload: false }
    });

    expect(workflow.nextAction).toBe("detect");
    expect(workflow.steps.find((step) => step.id === "compile")?.state).toBe("current");
    expect(workflow.steps.find((step) => step.id === "upload")?.state).toBe("waiting");
  });

  it("prompts teachers to prepare a valid board core before libraries and compile", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      coreReady: false
    });

    expect(workflow.nextAction).toBe("install-core");
    expect(workflow.steps.find((step) => step.id === "core")?.state).toBe("current");
  });

  it("adds a third-party package index before preparing a matching core", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      packageIndexNeeded: true,
      packageIndexReady: false,
      packageIndexLabel: "ESP32",
      fqbn: "esp32:esp32:esp32",
      core: "esp32:esp32",
      coreReady: false,
      uploadReadiness: { ...baseInput.uploadReadiness, readyToCompile: false, readyToUpload: false }
    });

    expect(workflow.nextAction).toBe("add-package-index");
    expect(workflow.steps.find((step) => step.id === "package-index")?.state).toBe("current");
  });

  it("sends incomplete board targets back to target search", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      fqbn: "uno",
      core: "",
      coreReady: false,
      uploadReadiness: { ...baseInput.uploadReadiness, readyToCompile: false, readyToUpload: false }
    });

    expect(workflow.nextAction).toBe("search-target");
    expect(workflow.steps.find((step) => step.id === "core")?.state).toBe("blocked");
  });

  it("moves to upload after a successful compile", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      compileState: "success"
    });

    expect(workflow.nextAction).toBe("upload");
    expect(workflow.steps.find((step) => step.id === "compile")?.state).toBe("done");
    expect(workflow.steps.find((step) => step.id === "upload")?.state).toBe("current");
  });

  it("keeps wiring warnings visible without taking over the next upload action", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      compileState: "success",
      wiringDiagnostics: [{ severity: "warning", title: "Pin warning", message: "Review this pin." }]
    });

    expect(workflow.nextAction).toBe("upload");
    expect(workflow.steps.find((step) => step.id === "wiring")?.state).toBe("warning");
  });

  it("moves to the monitor after upload succeeds", () => {
    const workflow = collectDeviceWorkflow({
      ...baseInput,
      compileState: "success",
      uploadState: "success"
    });

    expect(workflow.nextAction).toBe("monitor");
    expect(workflow.steps.find((step) => step.id === "upload")?.state).toBe("done");
    expect(workflow.steps.find((step) => step.id === "monitor")?.state).toBe("current");
  });
});
