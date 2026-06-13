import type { Catalog, ComponentDefinition, ComponentInstance, LessonDefinition, LessonStep } from "@abl/block-schema";
import { generateSketch } from "@abl/codegen";
import { describeProgramStep } from "./programDescriptions";

export type LessonGuide = {
  lesson: LessonDefinition;
  boardName: string;
  minutes: number;
  concepts: string[];
  materials: string[];
  steps: LessonStep[];
  success: string[];
  teacherNotes: string[];
  partCount: number;
  wiringCount: number;
  blockCount: number;
  libraries: string[];
};

export function lessonLevelLabel(level: LessonDefinition["level"]) {
  const normalized = String(level).toLowerCase();
  if (normalized === "icon") return "Icon blocks";
  if (normalized === "word" || normalized === "blocks") return "Blocks";
  return "Arduino C++";
}

export function lessonActionLabel(action: LessonStep["action"] | undefined) {
  if (action === "build") return "Build";
  if (action === "wire") return "Wire";
  if (action === "code") return "Code";
  if (action === "test") return "Test";
  if (action === "upload") return "Upload";
  if (action === "reflect") return "Reflect";
  return "Step";
}

function componentDefinition(instance: ComponentInstance, definitions: Map<string, ComponentDefinition>) {
  return definitions.get(instance.componentId);
}

function componentName(instance: ComponentInstance, definitions: Map<string, ComponentDefinition>) {
  return componentDefinition(instance, definitions)?.name ?? instance.label;
}

function inferredMaterials(lesson: LessonDefinition, catalog: Catalog, definitions: Map<string, ComponentDefinition>) {
  const board = catalog.boards.find((candidate) => candidate.id === lesson.starterProject.boardId);
  return [
    board?.name ?? lesson.starterProject.boardId,
    ...lesson.starterProject.components.map((component) => componentName(component, definitions))
  ];
}

function inferredSteps(lesson: LessonDefinition, catalog: Catalog, definitions: Map<string, ComponentDefinition>): LessonStep[] {
  const partNames = lesson.starterProject.components.map((component) => componentName(component, definitions));
  const program = lesson.starterProject.program;
  const hasWiring = lesson.starterProject.components.some((component) => (componentDefinition(component, definitions)?.wiring.length ?? 0) > 0);

  return [
    {
      title: "Open the starter",
      detail: `Launch ${lesson.starterProject.name} and confirm the selected board before changing blocks.`,
      action: "build",
      checklist: [`Board is ${catalog.boards.find((board) => board.id === lesson.starterProject.boardId)?.name ?? lesson.starterProject.boardId}`]
    },
    {
      title: hasWiring ? "Wire the parts" : "Check the built-in hardware",
      detail: hasWiring ? `Add ${partNames.join(", ")} and follow the wiring checklist.` : "This lesson uses built-in board hardware, so no breadboard is needed.",
      action: "wire",
      checklist: hasWiring ? ["Every signal wire matches the pin map", "Power and ground are connected"] : ["USB cable is connected"]
    },
    {
      title: "Read the program",
      detail: program.length > 0 ? program.map(describeProgramStep).join(" Then ") : "Add blocks before uploading.",
      action: "code",
      checklist: ["Generated Arduino C++ is visible", "No code generation warnings are showing"]
    },
    {
      title: "Test on the board",
      detail: "Use the Board panel to check the agent, compile, upload, and confirm the result on real hardware.",
      action: "test",
      checklist: ["Compile finishes", "Upload finishes", "The physical behavior matches the goal"]
    }
  ];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function createLessonGuide(lesson: LessonDefinition, catalog: Catalog): LessonGuide {
  const definitions = new Map(catalog.components.map((definition) => [definition.id, definition]));
  const generated = generateSketch(lesson.starterProject, catalog);
  const wiringCount = lesson.starterProject.components.reduce(
    (count, component) => count + (componentDefinition(component, definitions)?.wiring.length ?? 0),
    0
  );
  const libraries = generated.libraries.map((library) => library.installName ?? library.name);

  return {
    lesson,
    boardName: catalog.boards.find((board) => board.id === lesson.starterProject.boardId)?.name ?? lesson.starterProject.boardId,
    minutes: lesson.minutes ?? Math.max(15, 10 + lesson.starterProject.components.length * 5 + lesson.starterProject.program.length * 3),
    concepts: lesson.concepts ?? unique(lesson.starterProject.program.map((step) => step.kind.replaceAll("-", " "))).slice(0, 4),
    materials: lesson.materials ?? inferredMaterials(lesson, catalog, definitions),
    steps: lesson.steps && lesson.steps.length > 0 ? lesson.steps : inferredSteps(lesson, catalog, definitions),
    success:
      lesson.success && lesson.success.length > 0
        ? lesson.success
        : [`${lesson.goal}`, "The project compiles and the real board behavior can be observed."],
    teacherNotes: lesson.teacherNotes ?? [],
    partCount: lesson.starterProject.components.length,
    wiringCount,
    blockCount: lesson.starterProject.program.length,
    libraries
  };
}
