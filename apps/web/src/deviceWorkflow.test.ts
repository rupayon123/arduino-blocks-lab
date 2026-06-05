import { describe, expect, it } from "vitest";
import { collectDeviceWorkflow, type DeviceWorkflowInput } from "./deviceWorkflow";

const baseInput: DeviceWorkflowInput = {
  agentOnline: true,
  cliStatus: { available: true, cli: "arduino-cli" },
  fqbn: "arduino:avr:uno",
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
