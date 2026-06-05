import type { DeviceWorkflowAction, DeviceWorkflowRunState } from "./deviceWorkflow";
import type { AgentCliStatus, UploadReadiness } from "./uploadReadiness";
import type { WiringDiagnostic } from "./wiringDiagnostics";

export type ConnectionDoctorSeverity = "ready" | "info" | "warning" | "blocked";
export type ConnectionDoctorAction = DeviceWorkflowAction | "open-setup" | "open-code";

export type ConnectionDoctorReport = {
  severity: ConnectionDoctorSeverity;
  title: string;
  summary: string;
  fix: string;
  action: ConnectionDoctorAction;
  actionLabel: string;
  evidence?: string;
};

export type ConnectionDoctorInput = {
  agentOnline: boolean;
  cliStatus: AgentCliStatus | null;
  packageIndexNeeded: boolean;
  packageIndexReady: boolean;
  packageIndexState: DeviceWorkflowRunState;
  packageIndexLabel: string;
  packageIndexUrl?: string;
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
  recentMessages: string[];
};

function hasValue(value: string) {
  return value.trim().length > 0;
}

function firstEvidence(value: string | undefined) {
  const line = value
    ?.split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return undefined;
  return line.length > 170 ? `${line.slice(0, 167)}...` : line;
}

function recentText(messages: string[]) {
  return messages.slice(0, 8).join("\n");
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function report(input: ConnectionDoctorReport): ConnectionDoctorReport {
  return input;
}

export function collectConnectionDoctor(input: ConnectionDoctorInput): ConnectionDoctorReport {
  const messages = recentText(input.recentMessages);
  const normalizedMessages = messages.toLowerCase();
  const wiringErrors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const wiringWarnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  const hasTarget = hasValue(input.fqbn);
  const packageIndexDone = !input.packageIndexNeeded || input.packageIndexReady;
  const hasCore = hasValue(input.core);
  const coreDone = input.coreReady || input.compileState === "success" || input.uploadState === "success";
  const hasPort = hasValue(input.selectedPort);

  if (!input.agentOnline) {
    return report({
      severity: "blocked",
      title: "Start the Arduino helper",
      summary: "The browser app is fine, but real USB upload needs the local agent running on this computer.",
      fix: "Open the setup guide, start the agent, then come back and check again.",
      action: "open-setup",
      actionLabel: "Setup agent",
      evidence: firstEvidence(messages)
    });
  }

  if (!input.cliStatus?.available) {
    return report({
      severity: "blocked",
      title: "Arduino CLI needs attention",
      summary: "The local agent answered, but it cannot use Arduino CLI yet.",
      fix: "Install Arduino CLI or set ARDUINO_CLI_PATH, then restart the agent.",
      action: "open-setup",
      actionLabel: "Setup CLI",
      evidence: firstEvidence(input.cliStatus?.error ?? messages)
    });
  }

  if (wiringErrors.length > 0) {
    return report({
      severity: "blocked",
      title: "Fix wiring before code",
      summary: `${wiringErrors.length} wiring issue${wiringErrors.length === 1 ? "" : "s"} can stop the build from matching the real circuit.`,
      fix: wiringErrors[0]?.message ?? "Review the wiring panel and correct the marked connection.",
      action: "none",
      actionLabel: "Review wiring",
      evidence: wiringErrors[0]?.title
    });
  }

  if (!hasTarget) {
    return report({
      severity: "blocked",
      title: "Pick the exact board target",
      summary: "Arduino CLI needs an FQBN like arduino:avr:uno before it can compile.",
      fix: "Search for your board, then choose the matching target.",
      action: "search-target",
      actionLabel: "Find target"
    });
  }

  if (!hasCore) {
    return report({
      severity: "blocked",
      title: "Board core needs a full target",
      summary: "Arduino CLI needs the vendor and architecture from an FQBN before it can prepare board support.",
      fix: "Use a full target like arduino:avr:uno, or search for your exact board.",
      action: "search-target",
      actionLabel: "Find target"
    });
  }

  if (input.packageIndexState === "error") {
    return report({
      severity: "blocked",
      title: "Board package index did not install",
      summary: `Arduino CLI could not add the ${input.packageIndexLabel} Boards Manager URL.`,
      fix: input.packageIndexUrl ? `Check this URL and try again: ${input.packageIndexUrl}` : "Check the package URL and try Add index again.",
      action: "add-package-index",
      actionLabel: "Add index",
      evidence: firstEvidence(messages)
    });
  }

  if (!packageIndexDone) {
    return report({
      severity: "blocked",
      title: "Add the board package index",
      summary: `${input.packageIndexLabel} boards need an extra Boards Manager URL before Arduino CLI can find the core.`,
      fix: "Add the package index, then search for the board target or prepare the core.",
      action: "add-package-index",
      actionLabel: "Add index"
    });
  }

  if (input.coreState === "error") {
    return report({
      severity: "blocked",
      title: "Board core did not install",
      summary: `Arduino CLI could not prepare ${input.core}.`,
      fix: "Update board indexes, check any third-party package URL, then try Prepare core again.",
      action: "install-core",
      actionLabel: "Prepare core",
      evidence: firstEvidence(messages)
    });
  }

  if (input.compileState === "error") {
    if (
      hasAny(normalizedMessages, [
        /fatal error: .+\.h: no such file or directory/,
        /no such file or directory/,
        /library .*not found/,
        /error resolving libraries/
      ])
    ) {
      return report({
        severity: "blocked",
        title: "Install the missing library",
        summary: "The sketch mentions a header or library that Arduino CLI could not find.",
        fix: input.libraries.length > 0 ? `Install ${input.libraries.join(", ")} from the Board panel, then compile again.` : "Use the Libraries button, then compile again.",
        action: "install-libraries",
        actionLabel: "Install libraries",
        evidence: firstEvidence(messages)
      });
    }

    if (
      hasAny(normalizedMessages, [
        /platform .* not installed/,
        /core .* not installed/,
        /unknown fqbn/,
        /invalid fqbn/,
        /error resolving fqbn/,
        /board .*not found/
      ])
    ) {
      return report({
        severity: "blocked",
        title: "Board core does not match yet",
        summary: "Arduino CLI could not prepare the selected board target.",
        fix: input.packageIndexNeeded && !input.packageIndexReady
          ? `Add the ${input.packageIndexLabel} package index, then compile once more.`
          : hasCore
            ? `Prepare ${input.core}, then compile once more.`
            : "Search for the board again or paste the correct FQBN, then compile once more.",
        action: input.packageIndexNeeded && !input.packageIndexReady ? "add-package-index" : hasCore ? "install-core" : "search-target",
        actionLabel: input.packageIndexNeeded && !input.packageIndexReady ? "Add index" : hasCore ? "Prepare core" : "Find target",
        evidence: firstEvidence(messages)
      });
    }

    return report({
      severity: "blocked",
      title: "Generated code needs a look",
      summary: "The compiler found something in the sketch that did not build.",
      fix: "Open Arduino C++ view, check the highlighted output, then compile again.",
      action: "open-code",
      actionLabel: "Open code",
      evidence: firstEvidence(messages)
    });
  }

  if (!hasPort) {
    return report({
      severity: "warning",
      title: "Find the USB board",
      summary: "Compiling can work now, but upload needs a detected serial port.",
      fix: "Plug in the board with a data USB cable, then run Detect.",
      action: "detect",
      actionLabel: "Detect board"
    });
  }

  if (input.uploadState === "error") {
    if (
      hasAny(normalizedMessages, [
        /permission denied/,
        /access is denied/,
        /resource busy/,
        /busy/,
        /cannot open.*port/,
        /serial port.*already in use/
      ])
    ) {
      return report({
        severity: "blocked",
        title: "USB port is blocked",
        summary: "Another app, monitor, or OS permission is holding the port.",
        fix: "Close other serial monitors. On Linux, add your user to the dialout group, then reconnect the board.",
        action: "open-setup",
        actionLabel: "Port help",
        evidence: firstEvidence(messages)
      });
    }

    if (
      hasAny(normalizedMessages, [
        /avrdude/,
        /programmer is not responding/,
        /not in sync/,
        /stk500/,
        /timeout/,
        /no device found/
      ])
    ) {
      return report({
        severity: "blocked",
        title: "Board did not answer upload",
        summary: "Arduino CLI reached upload, but the board did not respond like the selected target.",
        fix: "Check the board target and port, unplug/replug USB, then press reset right before Upload if your board needs it.",
        action: "detect",
        actionLabel: "Detect again",
        evidence: firstEvidence(messages)
      });
    }

    return report({
      severity: "blocked",
      title: "Upload needs another try",
      summary: "The sketch compiled, but sending it to the board failed.",
      fix: "Confirm the USB port and board target, then upload again.",
      action: "upload",
      actionLabel: "Upload again",
      evidence: firstEvidence(messages)
    });
  }

  if (!coreDone) {
    return report({
      severity: "info",
      title: "Prepare board support",
      summary: `The selected target uses the ${input.core} core.`,
      fix: "Prepare the core now for a smoother first compile, especially on shared classroom computers.",
      action: "install-core",
      actionLabel: "Prepare core"
    });
  }

  if (input.libraries.length > 0 && !input.librariesReady) {
    return report({
      severity: "info",
      title: "Install project libraries",
      summary: `This build uses ${input.libraries.length} external librar${input.libraries.length === 1 ? "y" : "ies"}.`,
      fix: `Install ${input.libraries.join(", ")} before compiling on a fresh computer.`,
      action: "install-libraries",
      actionLabel: "Libraries"
    });
  }

  if (!input.uploadReadiness.readyToCompile) {
    return report({
      severity: "info",
      title: "Follow the board checklist",
      summary: input.uploadReadiness.detail,
      fix: "Work through the blocked checklist item above.",
      action: "check-agent",
      actionLabel: "Check agent"
    });
  }

  if (input.uploadState === "success") {
    return report({
      severity: "ready",
      title: input.serialOpen ? "Watching the board" : "Sketch is on the board",
      summary: input.serialOpen ? "Serial monitor is open and ready for live readings." : "Upload succeeded. You can now watch serial output from the board.",
      fix: input.serialOpen ? "Use the console to read values or send commands." : "Open the serial monitor when your sketch prints readings.",
      action: "monitor",
      actionLabel: input.serialOpen ? "Monitor open" : "Open monitor"
    });
  }

  if (input.compileState === "success" && input.uploadReadiness.readyToUpload) {
    return report({
      severity: "ready",
      title: "Ready for upload",
      summary: "The sketch compiled and the board port is selected.",
      fix: wiringWarnings.length > 0 ? "Warnings are allowed, but give the wiring one last look before upload." : "Upload now, then watch the serial monitor if your project prints data.",
      action: "upload",
      actionLabel: "Upload"
    });
  }

  return report({
    severity: "ready",
    title: "Ready to compile",
    summary: "The project has enough setup to build real Arduino C++.",
    fix: wiringWarnings.length > 0 ? "Review the warning, then compile." : "Compile once to catch library or board-target issues before upload.",
    action: "compile",
    actionLabel: "Compile"
  });
}
