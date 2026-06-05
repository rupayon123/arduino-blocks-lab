import type { ComponentInstance, PinMap, PinValue, ProgramStep, ProjectDocument } from "@abl/block-schema";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function pinValue(value: unknown): value is PinValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function pinMap(value: unknown): value is PinMap {
  const candidate = record(value);
  return Boolean(candidate && Object.values(candidate).every(pinValue));
}

function componentInstance(value: unknown): value is ComponentInstance {
  const candidate = record(value);
  return Boolean(
    candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.componentId === "string" &&
      typeof candidate.label === "string" &&
      pinMap(candidate.pins)
  );
}

function programStep(value: unknown): value is ProgramStep {
  const candidate = record(value);
  return Boolean(candidate && typeof candidate.kind === "string");
}

export function isProjectDocument(value: unknown): value is ProjectDocument {
  const candidate = record(value);
  return Boolean(
    candidate &&
      candidate.schemaVersion === "1.0.0" &&
      typeof candidate.name === "string" &&
      typeof candidate.boardId === "string" &&
      Array.isArray(candidate.components) &&
      candidate.components.every(componentInstance) &&
      Array.isArray(candidate.program) &&
      candidate.program.every(programStep) &&
      (candidate.blocksXml === undefined || typeof candidate.blocksXml === "string") &&
      (candidate.generatedSketch === undefined || typeof candidate.generatedSketch === "string") &&
      (candidate.lessonId === undefined || typeof candidate.lessonId === "string")
  );
}

export function parseStoredProject(raw: string | null): ProjectDocument | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isProjectDocument(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function serializeProject(project: ProjectDocument): string {
  return JSON.stringify(project);
}
