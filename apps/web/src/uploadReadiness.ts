import type { WiringDiagnostic } from "./wiringDiagnostics";

export type AgentCliStatus = {
  available: boolean;
  cli: string;
  error?: string;
};

export type UploadChecklistState = "ready" | "warning" | "blocked" | "info";

export type UploadChecklistItem = {
  id: string;
  label: string;
  detail: string;
  state: UploadChecklistState;
};

export type UploadReadiness = {
  title: string;
  detail: string;
  readyToCompile: boolean;
  readyToUpload: boolean;
  blockedCount: number;
  warningCount: number;
  items: UploadChecklistItem[];
};

export type UploadReadinessInput = {
  agentOnline: boolean;
  cliStatus: AgentCliStatus | null;
  packageIndexNeeded: boolean;
  packageIndexReady: boolean;
  packageIndexLabel: string;
  fqbn: string;
  core: string;
  coreReady: boolean;
  selectedPort: string;
  libraries: string[];
  wiringDiagnostics: WiringDiagnostic[];
};

function trimLabel(value: string) {
  return value.trim();
}

export function collectUploadReadiness(input: UploadReadinessInput): UploadReadiness {
  const fqbn = trimLabel(input.fqbn);
  const core = trimLabel(input.core);
  const port = trimLabel(input.selectedPort);
  const wiringErrors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const wiringWarnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const wiringTips = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "tip");

  const items: UploadChecklistItem[] = [
    input.agentOnline
      ? {
          id: "agent",
          label: "Local agent",
          detail: "Connected on this computer.",
          state: "ready"
        }
      : {
          id: "agent",
          label: "Local agent",
          detail: "Start the desktop agent before compiling or uploading.",
          state: "blocked"
        },
    input.agentOnline && input.cliStatus?.available
      ? {
          id: "cli",
          label: "Arduino CLI",
          detail: `Ready through ${input.cliStatus.cli}.`,
          state: "ready"
        }
      : {
          id: "cli",
          label: "Arduino CLI",
          detail: input.agentOnline
            ? input.cliStatus?.error ?? "Checking Arduino CLI status."
            : "Waiting for the local agent.",
          state: "blocked"
        },
    fqbn
      ? {
          id: "target",
          label: "Board target",
          detail: fqbn,
          state: "ready"
        }
      : {
          id: "target",
          label: "Board target",
          detail: "Choose or search for an Arduino board target.",
          state: "blocked"
        },
    input.packageIndexNeeded
      ? {
          id: "package-index",
          label: "Package index",
          detail: input.packageIndexReady
            ? `${input.packageIndexLabel} Boards Manager URL is configured.`
            : `Add ${input.packageIndexLabel} before installing this board core.`,
          state: input.packageIndexReady ? "ready" : "blocked"
        }
      : {
          id: "package-index",
          label: "Package index",
          detail: "No extra Boards Manager URL needed.",
          state: "ready"
        },
    core
      ? {
          id: "core",
          label: "Board core",
          detail: input.coreReady ? `${core} is prepared.` : `${core} can be prepared now or automatically during compile.`,
          state: input.coreReady ? "ready" : "info"
        }
      : {
          id: "core",
          label: "Board core",
          detail: fqbn ? "Use a full FQBN like arduino:avr:uno." : "Choose a board target first.",
          state: "blocked"
        },
    port
      ? {
          id: "port",
          label: "USB port",
          detail: port,
          state: "ready"
        }
      : {
          id: "port",
          label: "USB port",
          detail: "Detect and choose the connected board port.",
          state: "blocked"
        },
    input.libraries.length > 0
      ? {
          id: "libraries",
          label: "Libraries",
          detail: input.libraries.join(", "),
          state: "info"
        }
      : {
          id: "libraries",
          label: "Libraries",
          detail: "No external libraries needed.",
          state: "ready"
        }
  ];

  if (wiringErrors.length > 0) {
    items.push({
      id: "wiring",
      label: "Wiring checks",
      detail: `${wiringErrors.length} wiring error${wiringErrors.length === 1 ? "" : "s"} need attention.`,
      state: "blocked"
    });
  } else if (wiringWarnings.length > 0) {
    items.push({
      id: "wiring",
      label: "Wiring checks",
      detail: `${wiringWarnings.length} warning${wiringWarnings.length === 1 ? "" : "s"} before upload.`,
      state: "warning"
    });
  } else if (wiringTips.length > 0) {
    items.push({
      id: "wiring",
      label: "Wiring checks",
      detail: wiringTips[0]?.message ?? "Review the wiring tips.",
      state: "info"
    });
  } else {
    items.push({
      id: "wiring",
      label: "Wiring checks",
      detail: "Pin map is ready.",
      state: "ready"
    });
  }

  const blockedCount = items.filter((item) => item.state === "blocked").length;
  const warningCount = items.filter((item) => item.state === "warning").length;
  const packageIndexReady = !input.packageIndexNeeded || input.packageIndexReady;
  const readyToCompile = input.agentOnline && Boolean(input.cliStatus?.available) && packageIndexReady && Boolean(fqbn) && Boolean(core) && wiringErrors.length === 0;
  const readyToUpload = readyToCompile && Boolean(port);

  return {
    title: readyToUpload ? "Ready to upload" : readyToCompile ? "Ready to compile" : "Setup needed",
    detail: readyToUpload
      ? warningCount > 0
        ? "Upload can run, but review the warning first."
        : "Everything needed for a real board upload is in place."
      : readyToCompile
        ? "Compile is ready; choose a USB port to upload."
        : `${blockedCount} setup item${blockedCount === 1 ? "" : "s"} left.`,
    readyToCompile,
    readyToUpload,
    blockedCount,
    warningCount,
    items
  };
}
