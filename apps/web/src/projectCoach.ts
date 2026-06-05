import type { ProjectDocument } from "@abl/block-schema";
import type { UploadReadiness } from "./uploadReadiness";
import type { WiringDiagnostic } from "./wiringDiagnostics";

export type CoachStepState = "done" | "next" | "warning" | "blocked";

export type CoachStep = {
  id: string;
  label: string;
  detail: string;
  state: CoachStepState;
};

export type ProjectCoach = {
  title: string;
  detail: string;
  progressPercent: number;
  doneCount: number;
  totalCount: number;
  nextStep?: CoachStep;
  steps: CoachStep[];
};

export type ProjectCoachInput = {
  project: ProjectDocument;
  boardName: string;
  wiringDiagnostics: WiringDiagnostic[];
  generatedWarnings: string[];
  uploadReadiness: UploadReadiness;
};

function firstActionable(steps: CoachStep[]) {
  return steps.find((step) => step.state === "blocked") ?? steps.find((step) => step.state === "warning") ?? steps.find((step) => step.state === "next");
}

export function collectProjectCoach(input: ProjectCoachInput): ProjectCoach {
  const wiringErrors = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const wiringWarnings = input.wiringDiagnostics.filter((diagnostic) => diagnostic.severity === "warning");

  const steps: CoachStep[] = [
    {
      id: "board",
      label: "Choose board",
      detail: input.project.boardId ? input.boardName : "Pick an Arduino board.",
      state: input.project.boardId ? "done" : "blocked"
    },
    {
      id: "hardware",
      label: "Add hardware",
      detail:
        input.project.components.length > 0
          ? `${input.project.components.length} part${input.project.components.length === 1 ? "" : "s"} in the build.`
          : "Add at least one sensor, motor, display, or output.",
      state: input.project.components.length > 0 ? "done" : "next"
    },
    {
      id: "blocks",
      label: "Build blocks",
      detail:
        input.project.program.length > 0
          ? `${input.project.program.length} block step${input.project.program.length === 1 ? "" : "s"} generating code.`
          : "Add blocks so the hardware has behavior.",
      state: input.project.program.length > 0 ? "done" : "next"
    },
    {
      id: "wiring",
      label: "Check wiring",
      detail:
        wiringErrors.length > 0
          ? `${wiringErrors.length} wiring error${wiringErrors.length === 1 ? "" : "s"} need attention.`
          : wiringWarnings.length > 0
            ? `${wiringWarnings.length} wiring warning${wiringWarnings.length === 1 ? "" : "s"} to review.`
            : "Wiring checks are clear.",
      state: wiringErrors.length > 0 ? "blocked" : wiringWarnings.length > 0 ? "warning" : "done"
    },
    {
      id: "code",
      label: "Review code",
      detail:
        input.generatedWarnings.length > 0
          ? `${input.generatedWarnings.length} code warning${input.generatedWarnings.length === 1 ? "" : "s"} in the sketch.`
          : input.project.program.length > 0
            ? "Arduino C++ preview is ready."
            : "Code appears after blocks are added.",
      state: input.generatedWarnings.length > 0 ? "warning" : input.project.program.length > 0 ? "done" : "next"
    },
    {
      id: "upload",
      label: "Program board",
      detail: input.uploadReadiness.readyToUpload
        ? "Ready to upload to a connected board."
        : input.uploadReadiness.readyToCompile
          ? "Compile is ready; choose a USB port to upload."
          : input.uploadReadiness.detail,
      state: input.uploadReadiness.readyToUpload ? "done" : input.uploadReadiness.readyToCompile ? "warning" : "next"
    }
  ];

  const doneCount = steps.filter((step) => step.state === "done").length;
  const nextStep = firstActionable(steps);

  return {
    title: nextStep ? "Project coach" : "Ready to build",
    detail: nextStep ? `Next: ${nextStep.label}` : "Every checklist item is complete.",
    progressPercent: Math.round((doneCount / steps.length) * 100),
    doneCount,
    totalCount: steps.length,
    nextStep,
    steps
  };
}
