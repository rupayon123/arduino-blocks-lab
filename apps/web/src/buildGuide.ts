import type { Catalog, ComponentDefinition, ComponentInstance, PinValue, ProjectDocument } from "@abl/block-schema";
import { generateSketch, type GeneratedSketch } from "@abl/codegen";
import { describeProgramStep } from "./programDescriptions";
import { collectWiringDiagnostics } from "./wiringDiagnostics";

export type BuildGuideOptions = {
  includeSketch?: boolean;
};

function pinValue(value: PinValue | undefined): string {
  if (value === undefined) return "not set";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function renderPinTemplate(template: string, instance: ComponentInstance): string {
  return template.replace(/\{\{pins\.([a-zA-Z0-9_]+)\}\}/g, (_, pinName: string) => pinValue(instance.pins[pinName]));
}

function definitionFor(instance: ComponentInstance, definitions: Map<string, ComponentDefinition>) {
  return definitions.get(instance.componentId);
}

function summarizePins(instance: ComponentInstance, definition: ComponentDefinition | undefined): string {
  const entries = Object.entries(instance.pins).map(([pinName, value]) => {
    const label = definition?.pinLabels[pinName] ?? pinName;
    return `${label}: ${pinValue(value)}`;
  });
  return entries.length > 0 ? entries.join("; ") : "No configurable pins";
}

function componentName(instance: ComponentInstance, definition: ComponentDefinition | undefined): string {
  return definition?.name ?? instance.componentId;
}

function partsList(project: ProjectDocument, definitions: Map<string, ComponentDefinition>): string[] {
  const counts = new Map<string, number>();
  for (const instance of project.components) {
    const name = componentName(instance, definitionFor(instance, definitions));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => `- ${name} x${count}`);
}

function componentPinLines(project: ProjectDocument, definitions: Map<string, ComponentDefinition>): string[] {
  if (project.components.length === 0) return ["- No extra components yet."];
  return project.components.map((instance) => {
    const definition = definitionFor(instance, definitions);
    return `- ${instance.label} (${componentName(instance, definition)}): ${summarizePins(instance, definition)}`;
  });
}

function wiringLines(project: ProjectDocument, definitions: Map<string, ComponentDefinition>): string[] {
  if (project.components.length === 0) return ["- Add hardware to generate wiring steps."];

  return project.components.flatMap((instance) => {
    const definition = definitionFor(instance, definitions);
    if (!definition) return [`### ${instance.label}`, `- Missing component definition: ${instance.componentId}`];
    if (definition.wiring.length === 0) return [`### ${instance.label}`, "- No wiring hints defined for this component."];
    return [
      `### ${instance.label}`,
      ...definition.wiring.map((wire) => {
        const note = wire.note ? ` (${wire.note})` : "";
        return `- ${wire.label}: ${wire.from} -> ${renderPinTemplate(wire.to, instance)}${note}`;
      })
    ];
  });
}

function programLines(project: ProjectDocument): string[] {
  if (project.program.length === 0) return ["- No blocks yet. Add behavior before uploading."];
  return project.program.map((step, index) => `${index + 1}. ${describeProgramStep(step)}`);
}

function libraryLines(generated: GeneratedSketch): string[] {
  const libraries = generated.libraries;
  if (libraries.length === 0) return ["- No external libraries."];
  return libraries.map((library) => {
    const install = library.installName && library.installName !== library.name ? ` (install: ${library.installName})` : "";
    const version = library.version ? ` @ ${library.version}` : "";
    return `- ${library.name}${install}${version}`;
  });
}

function checkLines(project: ProjectDocument, catalog: Catalog, generated: GeneratedSketch): string[] {
  const board = catalog.boards.find((candidate) => candidate.id === project.boardId);
  const wiringDiagnostics = collectWiringDiagnostics(project, board, catalog.components);
  const lines: string[] = [];

  if (wiringDiagnostics.length === 0) {
    lines.push("- Wiring checks clear.");
  } else {
    lines.push(
      ...wiringDiagnostics.map((diagnostic) => `- [${diagnostic.severity.toUpperCase()}] ${diagnostic.title}: ${diagnostic.message}`)
    );
  }

  if (generated.warnings.length === 0) {
    lines.push("- Code generation checks clear.");
  } else {
    lines.push(...generated.warnings.map((warning) => `- [CODE] ${warning}`));
  }

  return lines;
}

export function createBuildGuide(project: ProjectDocument, catalog: Catalog, options: BuildGuideOptions = {}): string {
  const includeSketch = options.includeSketch ?? true;
  const board = catalog.boards.find((candidate) => candidate.id === project.boardId);
  const definitions = new Map(catalog.components.map((definition) => [definition.id, definition]));
  const generated = generateSketch(project, catalog);
  const lines = [
    `# ${project.name}`,
    "",
    "Generated by Arduino Blocks Lab.",
    "",
    "## Board",
    `- ${board ? `${board.name} (${board.fqbn})` : project.boardId}`,
    "",
    "## Parts",
    `- ${board?.name ?? project.boardId} x1`,
    ...(project.components.length === 0 ? ["- No extra components yet."] : partsList(project, definitions)),
    "",
    "## Component Pins",
    ...componentPinLines(project, definitions),
    "",
    "## Wiring Checklist",
    ...wiringLines(project, definitions),
    "",
    "## Program Flow",
    ...programLines(project),
    "",
    "## Libraries",
    ...libraryLines(generated),
    "",
    "## Checks",
    ...checkLines(project, catalog, generated),
    "",
    "## Upload Steps",
    "- Run the local Arduino Blocks Lab agent.",
    "- Connect the Arduino over USB.",
    "- Click Detect, install any listed libraries, then Compile.",
    "- Upload only after the board target, USB port, and wiring checks look right."
  ];

  if (includeSketch) {
    lines.push("", "## Generated Sketch", "```cpp", generated.code, "```");
  }

  return `${lines.join("\n")}\n`;
}
