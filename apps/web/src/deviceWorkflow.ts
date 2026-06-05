import type { AgentCliStatus, UploadReadiness } from "./uploadReadiness";
import type { WiringDiagnostic } from "./wiringDiagnostics";

export type DeviceWorkflowAction =
  | "check-agent"
  | "add-package-index"
  | "detect"
  | "search-target"
  | "install-core"
  | "install-libraries"
  | "compile"
  | "upload"
  | "monitor"
  | "none";
export type DeviceWorkflowStepState = "done" | "current" | "waiting" | "warning" | "blocked";
export type DeviceWorkflowRunState = "idle" | "running" | "success" | "error";

export type DeviceWorkflowStep = {
  id: string;
  label: string;
  detail: string;
  state: DeviceWorkflowStepState;
  action: DeviceWorkflowAction;
};

export type DeviceWorkflow = {
  title: string;
  detail: string;
  progress: number;
  nextAction: DeviceWorkflowAction;
  nextLabel: string;
  steps: DeviceWorkflowStep[];
};

export type DeviceWorkflowInput = {
  agentOnline: boolean;
  cliStatus: AgentCliStatus | null;
  packageIndexNeeded: boolean;
  packageIndexReady: boolean;
  packageIndexState: DeviceWorkflowRunState;
  packageIndexLabel: string;
  fqbn: string;
  core: string;
  coreReady: boolean;
  coreState: DeviceWorkflowRunState;
  selectedPort: string;
  libraries: string[];
  librariesReady: boolean;
  uploadReadiness: UploadReadiness;
  compileState: DeviceWorkflowRunState;
  uploadState: DeviceWorkflowRunState;
  serialOpen: boolean;
  wiringDiagnostics: WiringDiagnostic[];
};

function hasValue(value: string) {
  return value.trim().length > 0;
}

function firstCurrentStep(steps: DeviceWorkflowStep[]) {
  return steps.find((step) => step.state === "current" || step.state === "blocked") ?? steps.find((step) => step.state === "warning");
}

function actionLabel(action: DeviceWorkflowAction) {
  switch (action) {
    case "check-agent":
      return "Check agent";
    case "add-package-index":
      return "Add index";
    case "detect":
      return "Detect board";
    case "search-target":
      return "Find target";
    case "install-core":
      return "Prepare core";
    case "install-libraries":
      return "Install libraries";
    case "compile":
      return "Compile";
    case "upload":
      return "Upload";
    case "monitor":
      return "Open monitor";
    default:
      return "Ready";
  }
}

export function collectDeviceWorkflow(input: DeviceWorkflowInput): DeviceWorkflow {
  const agentReady = input.agentOnline && Boolean(input.cliStatus?.available);
  const packageIndexDone = !input.packageIndexNeeded || input.packageIndexReady;
  const hasTarget = hasValue(input.fqbn);
  const hasCore = hasValue(input.core);
  const hasPort = hasValue(input.selectedPort);
  const libraryCount = input.libraries.length;
  const librariesDone = libraryCount === 0 || input.librariesReady || input.compileState === "success" || input.uploadState === "success";
  const coreDone = input.coreReady || input.compileState === "success" || input.uploadState === "success";
  const hasWiringErrors = input.wiringDiagnostics.some((diagnostic) => diagnostic.severity === "error");
  const hasWiringWarnings = input.wiringDiagnostics.some((diagnostic) => diagnostic.severity === "warning");
  const compileDone = input.compileState === "success" || input.uploadState === "success";
  const uploadDone = input.uploadState === "success";

  const steps: DeviceWorkflowStep[] = [
    {
      id: "agent",
      label: "Agent + CLI",
      detail: agentReady
        ? `Ready through ${input.cliStatus?.cli ?? "arduino-cli"}.`
        : input.agentOnline
          ? input.cliStatus?.error ?? "Arduino CLI needs attention."
          : "Start the local agent, then check again.",
      state: agentReady ? "done" : "blocked",
      action: "check-agent"
    },
    {
      id: "package-index",
      label: "Package index",
      detail: input.packageIndexNeeded
        ? packageIndexDone
          ? `${input.packageIndexLabel} Boards Manager URL is configured.`
          : input.packageIndexState === "running"
            ? `Adding ${input.packageIndexLabel} to Arduino CLI.`
            : input.packageIndexState === "error"
              ? `Could not add ${input.packageIndexLabel}. Check the package URL.`
              : `Add ${input.packageIndexLabel} before searching or preparing this board family.`
        : "Default Arduino board indexes are enough for this target.",
      state: packageIndexDone
        ? "done"
        : input.packageIndexState === "running"
          ? "current"
          : input.packageIndexState === "error"
            ? "blocked"
            : agentReady
              ? "current"
              : "waiting",
      action: input.packageIndexNeeded ? "add-package-index" : "none"
    },
    {
      id: "port",
      label: "USB board",
      detail: hasPort ? input.selectedPort : agentReady ? "Detect the board plugged into USB." : "Waiting for the agent.",
      state: hasPort ? "done" : agentReady ? "current" : "waiting",
      action: "detect"
    },
    {
      id: "target",
      label: "Board target",
      detail: hasTarget ? input.fqbn : "Choose or search for the Arduino target.",
      state: hasTarget ? "done" : agentReady ? "current" : "waiting",
      action: "search-target"
    },
    {
      id: "core",
      label: "Board core",
      detail: hasCore
        ? coreDone
          ? `${input.core} is prepared.`
          : input.coreState === "running"
            ? `Installing ${input.core}.`
            : input.coreState === "error"
              ? `Could not install ${input.core}. Check package indexes.`
              : `Prepare ${input.core} now, or let compile install it automatically.`
        : hasTarget
          ? "Use a full FQBN with vendor and architecture, like arduino:avr:uno."
          : "Choose a board target first.",
      state: coreDone
        ? "done"
        : input.coreState === "running"
          ? "current"
          : input.coreState === "error"
            ? "blocked"
            : hasCore && agentReady
              ? "current"
              : hasTarget
                ? "blocked"
                : "waiting",
      action: hasCore ? "install-core" : "search-target"
    },
    {
      id: "libraries",
      label: "Libraries",
      detail: libraryCount > 0 ? `${libraryCount} external librar${libraryCount === 1 ? "y" : "ies"}: ${input.libraries.join(", ")}` : "No external libraries needed.",
      state: librariesDone ? "done" : agentReady ? "current" : "waiting",
      action: "install-libraries"
    },
    {
      id: "wiring",
      label: "Wiring",
      detail: hasWiringErrors
        ? "Fix wiring errors before compiling."
        : hasWiringWarnings
          ? "Warnings are allowed, but review them before uploading."
          : "Pin map is ready.",
      state: hasWiringErrors ? "blocked" : hasWiringWarnings ? "warning" : "done",
      action: "none"
    },
    {
      id: "compile",
      label: "Compile",
      detail:
        input.compileState === "running"
          ? "Compiling with Arduino CLI."
          : input.compileState === "error"
            ? "Compile failed. Check the log and generated code."
            : compileDone
              ? "Sketch compiles for the selected target."
              : input.uploadReadiness.readyToCompile
                ? "Build the sketch before upload."
                : "Waiting for setup items.",
      state: compileDone ? "done" : input.compileState === "running" ? "current" : input.compileState === "error" ? "blocked" : input.uploadReadiness.readyToCompile ? "current" : "waiting",
      action: "compile"
    },
    {
      id: "upload",
      label: "Upload",
      detail:
        input.uploadState === "running"
          ? `Uploading to ${input.selectedPort}.`
          : input.uploadState === "error"
            ? "Upload failed. Check port, bootloader, and board target."
            : uploadDone
              ? `Uploaded to ${input.selectedPort}.`
              : input.uploadReadiness.readyToUpload && compileDone
                ? "Send the sketch to the connected Arduino."
                : input.uploadReadiness.readyToUpload
                  ? "Compile first, then upload."
                  : "Waiting for USB port and compile readiness.",
      state: uploadDone ? "done" : input.uploadState === "running" ? "current" : input.uploadState === "error" ? "blocked" : input.uploadReadiness.readyToUpload && compileDone ? "current" : "waiting",
      action: "upload"
    },
    {
      id: "monitor",
      label: "Serial monitor",
      detail: input.serialOpen ? "Serial monitor is open." : uploadDone && hasPort ? "Open serial output after upload." : "Available after upload.",
      state: input.serialOpen ? "done" : uploadDone && hasPort ? "current" : "waiting",
      action: "monitor"
    }
  ];

  const doneCount = steps.filter((step) => step.state === "done").length;
  const nextStep = firstCurrentStep(steps);

  return {
    title: nextStep ? `Next: ${nextStep.label}` : "Board flow complete",
    detail: nextStep?.detail ?? "Your board is programmed and ready to watch.",
    progress: Math.round((doneCount / steps.length) * 100),
    nextAction: nextStep?.action ?? "none",
    nextLabel: actionLabel(nextStep?.action ?? "none"),
    steps
  };
}
