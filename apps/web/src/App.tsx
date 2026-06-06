import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Cable,
  CheckCircle2,
  CircuitBoard,
  Clipboard,
  Code2,
  Cpu,
  Download,
  Eraser,
  ExternalLink,
  FilePlus,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  Library,
  LockKeyhole,
  Medal,
  Moon,
  PackagePlus,
  Play,
  PlugZap,
  RadioTower,
  RotateCcw,
  Save,
  Search,
  Send,
  MessageSquareText,
  Share2,
  Sparkles,
  SquareStack,
  Sun,
  Terminal,
  Trash2,
  Upload,
  X,
  AlertTriangle
} from "lucide-react";
import type { Catalog, ComponentDefinition, ComponentInstance, ExtensionManifest, ProjectDocument, ProgramStep } from "@abl/block-schema";
import {
  boards as defaultBoards,
  catalog as defaultCatalog,
  createComponentInstance,
  mergeExtensionManifest,
  parseExtensionManifest,
  starterProjects
} from "@abl/catalog";
import { generateSketch } from "@abl/codegen";
import BlocklyWorkspace from "./BlocklyWorkspace";
import LandingPage from "./LandingPage";
import { AGENT_STATUS_URL, agentHealth, agentRpc, openAgentEvents } from "./agentClient";
import { projectToBlocklyXml } from "./projectXml";
import { collectWiringDiagnostics } from "./wiringDiagnostics";
import { createWokwiDiagram, unsupportedWokwiComponents } from "./wokwiExport";
import { importedPackFromManifest, parseStoredExtensionPacks, serializeExtensionPacks, type ImportedExtensionPack } from "./extensionPacks";
import { parseStoredProject, serializeProject } from "./projectStorage";
import { collectUploadReadiness, type AgentCliStatus, type UploadChecklistState } from "./uploadReadiness";
import { appendSerialLineEnding, commonBaudRates, lineEndingLabel, normalizeBaudRate, type SerialLineEnding } from "./serialConsole";
import { autoAssignProjectPins, collectBoardPinUsage } from "./pinPlanner";
import { projectFromShareHash, projectShareHashPrefix, shareUrlForProject } from "./projectShare";
import { collectProjectCoach, type CoachStepState } from "./projectCoach";
import { describeProgramStep } from "./programDescriptions";
import { createBuildGuide } from "./buildGuide";
import { normalizePackUrl } from "./packUrls";
import { parsePackGallery, resolveGalleryPackUrl, type PackGalleryEntry } from "./packGallery";
import { createWiringCanvasModel } from "./wiringCanvas";
import { nextThemePreference, parseThemePreference, type ThemePreference } from "./theme";
import { createCircuitStudioModel } from "./circuitStudio";
import CircuitStudioPanel from "./CircuitStudioPanel";
import IconBlocksPanel from "./IconBlocksPanel";
import { coreFromFqbn } from "./arduinoCore";
import {
  packageIndexPresetForCore,
  parsePackageIndexInput,
  searchPackageIndexPresets,
  type BoardPackageIndexPreset
} from "./boardPackageIndexes";
import { createProjectIdeaMatches, type ProjectIdea } from "./ideaBuilder";
import { createLessonGuide, lessonActionLabel, lessonLevelLabel } from "./lessonGuide";
import { collectDeviceWorkflow, type DeviceWorkflowAction, type DeviceWorkflowRunState, type DeviceWorkflowStepState } from "./deviceWorkflow";
import { agentSetupDocsUrl, agentSetupPlatforms, createAgentSetupScript, getAgentSetupSteps, type AgentSetupPlatform } from "./agentSetup";
import { collectConnectionDoctor, type ConnectionDoctorAction, type ConnectionDoctorSeverity } from "./connectionDoctor";
import { collectWiringRepairPlan, type WiringRepairTone } from "./wiringRepair";
import { createMissionProgression, missionStatusLabel } from "./missionProgression";
import { createUnitPlan, createUnitPlanMarkdown, unitPlanFilename } from "./unitPlan";

type Mode = "blocks" | "code" | "circuit" | "lessons";
type CodeView = "cpp" | "python" | "javascript";
type ProjectStyle = "icon" | "blocks" | "code";

type StarterCard = {
  id: string;
  tag: string;
  goal: string;
  project: ProjectDocument;
};

type DetectedPort = {
  address: string;
  label: string;
  fqbn?: string;
};

type BoardTarget = {
  fqbn: string;
  name: string;
};

type PackageIndexResponse = {
  urls?: string[];
  added?: string[];
  alreadyConfigured?: string[];
  configured?: string[];
};

const missionProgressKey = "abl.missionProgress.v1";
const extensionPacksKey = "abl.extensionPacks.v1";
const currentProjectKey = "abl.currentProject.v1";
const themePreferenceKey = "abl.themePreference.v1";

const projectStyleOptions: Array<{
  id: ProjectStyle;
  title: string;
  kicker: string;
  detail: string;
}> = [
  {
    id: "icon",
    title: "Icon Blocks",
    kicker: "picture-first",
    detail: "Start with guided starter blocks and friendly visual cues."
  },
  {
    id: "blocks",
    title: "Blocks",
    kicker: "scratch-style",
    detail: "Build with full Blockly blocks and live Arduino C++."
  },
  {
    id: "code",
    title: "Arduino C++",
    kicker: "real code",
    detail: "Open the generated sketch as the main workspace."
  }
];

function cloneProject(project: ProjectDocument): ProjectDocument {
  const cloned = JSON.parse(JSON.stringify(project)) as ProjectDocument;
  cloned.blocksXml = cloned.blocksXml ?? projectToBlocklyXml(cloned);
  return cloned;
}

function byCategory(components: ComponentDefinition[], category: ComponentDefinition["category"]) {
  return components.filter((component) => component.category === category);
}

function componentDefinition(instance: ComponentInstance, components: ComponentDefinition[]) {
  return components.find((component) => component.id === instance.componentId);
}

function boardName(boardId: string, catalog: Catalog) {
  return catalog.boards.find((board) => board.id === boardId)?.name ?? boardId;
}

function libraryNames(project: ProjectDocument, catalog: Catalog) {
  return generateSketch(project, catalog).libraries.map((library) => library.installName ?? library.name);
}

function targetLabel(boardId: string, fqbn: string, catalog: Catalog) {
  return fqbn.trim() || catalog.boards.find((board) => board.id === boardId)?.fqbn || boardId;
}

function flattenPorts(data: unknown): DetectedPort[] {
  const root = data as { detected_ports?: unknown[] } | unknown[];
  const list = Array.isArray(root) ? root : Array.isArray(root?.detected_ports) ? root.detected_ports : [];
  const mapped: Array<DetectedPort | null> = list
    .map((entry) => {
      const item = entry as {
        address?: string;
        port?: { address?: string; label?: string };
        label?: string;
        protocol_label?: string;
        boards?: Array<{ name?: string; fqbn?: string }>;
      };
      const address = item.address ?? item.port?.address;
      if (!address) return null;
      const board = item.boards?.[0];
      const detected: DetectedPort = {
        address,
        label: board?.name ?? item.label ?? item.port?.label ?? item.protocol_label ?? address
      };
      if (board?.fqbn) detected.fqbn = board.fqbn;
      return detected;
    })
  return mapped.filter((port): port is DetectedPort => port !== null);
}

function flattenBoardTargets(data: unknown): BoardTarget[] {
  const candidates: unknown[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as { fqbn?: unknown; name?: unknown; boards?: unknown; platforms?: unknown };
    if (typeof item.fqbn === "string") {
      candidates.push(item);
    }
    if (item.boards) visit(item.boards);
    if (item.platforms) visit(item.platforms);
  };
  visit(data);
  const seen = new Set<string>();
  return candidates
    .map((candidate) => {
      const item = candidate as { fqbn?: unknown; name?: unknown };
      return typeof item.fqbn === "string"
        ? {
            fqbn: item.fqbn,
            name: typeof item.name === "string" ? item.name : item.fqbn
          }
        : null;
    })
    .filter((target): target is BoardTarget => {
      if (!target || seen.has(target.fqbn)) return false;
      seen.add(target.fqbn);
      return true;
    })
    .slice(0, 80);
}


function saveBlob(filename: string, contents: string | Blob, type: string) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function coercePinValue(value: string) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function loadMissionProgress(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(missionProgressKey);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function loadExtensionPacks(): ImportedExtensionPack[] {
  return parseStoredExtensionPacks(window.localStorage.getItem(extensionPacksKey));
}

function loadCurrentProject(): ProjectDocument | undefined {
  try {
    return parseStoredProject(window.localStorage.getItem(currentProjectKey));
  } catch {
    return undefined;
  }
}

function loadThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(themePreferenceKey));
  } catch {
    return "light";
  }
}

function loadSharedProject(): ProjectDocument | undefined {
  return projectFromShareHash(window.location.hash);
}

function loadInitialProject(): ProjectDocument {
  return loadSharedProject() ?? loadCurrentProject() ?? starterProjects.blink;
}

function shouldShowLandingPage() {
  return window.location.hash !== "#workspace" && !window.location.hash.startsWith(projectShareHashPrefix);
}

function learningPreview(project: ProjectDocument, language: Exclude<CodeView, "cpp">, catalog: Catalog): string {
  const board = boardName(project.boardId, catalog);
  const steps = project.program.map((step) =>
    describeProgramStep(step)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
  if (language === "python") {
    return [
      `# ${project.name}`,
      "# Learning preview. Upload target for V1 is generated Arduino C++.",
      `board = ArduinoBoard(${JSON.stringify(board)})`,
      "",
      "def loop():",
      ...(steps.length > 0 ? steps.map((step) => `    ${step.replaceAll(" ", "_")}()`) : ["    pass"]),
      "",
      "while True:",
      "    loop()"
    ].join("\n");
  }

  return [
    `// ${project.name}`,
    "// Learning preview. Upload target for V1 is generated Arduino C++.",
    `const board = new ArduinoBoard(${JSON.stringify(board)});`,
    "",
    "function loop() {",
    ...(steps.length > 0 ? steps.map((step) => `  ${step.replaceAll(" ", "_")}();`) : ["  // Add blocks to build your program."]),
    "}",
    "",
    "while (true) {",
    "  loop();",
    "}"
  ].join("\n");
}

const starterCards: StarterCard[] = [
  {
    id: "blink",
    tag: "First upload",
    goal: "Blink the built-in LED and see the generated C++ immediately.",
    project: starterProjects.blink
  },
  {
    id: "button-led",
    tag: "Input",
    goal: "Wire a button, read it safely, and control an LED.",
    project: starterProjects.buttonLed
  },
  {
    id: "servo-knob",
    tag: "Motion",
    goal: "Map a potentiometer to a hobby servo angle.",
    project: starterProjects.servoKnob
  },
  {
    id: "distance-meter",
    tag: "Sensor",
    goal: "Measure ultrasonic distance and stream readings over serial.",
    project: starterProjects.ultrasonicDistance
  },
  {
    id: "weather-lcd",
    tag: "Display",
    goal: "Read a DHT sensor and show status on an LCD.",
    project: starterProjects.dhtDisplay
  },
  {
    id: "neopixel-glow",
    tag: "Color",
    goal: "Animate a NeoPixel strip with a tiny color loop.",
    project: starterProjects.neopixelAnimation
  }
];

const projectIdeas: ProjectIdea[] = [
  {
    id: "blink",
    title: "Blink a light",
    tag: "First upload",
    prompt: "I want to make the board prove it is alive.",
    outcome: "Built-in LED turns on and off once per second.",
    keywords: ["blink", "led", "light", "first", "starter", "hello"],
    project: starterProjects.blink
  },
  {
    id: "button-led",
    title: "Button switch",
    tag: "Input",
    prompt: "I want a button to control a light.",
    outcome: "A pushbutton reads input and switches an LED.",
    keywords: ["button", "switch", "press", "led", "input"],
    project: starterProjects.buttonLed
  },
  {
    id: "servo-knob",
    title: "Servo knob",
    tag: "Motion",
    prompt: "I want a knob to move something.",
    outcome: "A potentiometer maps to a servo angle.",
    keywords: ["servo", "knob", "motion", "angle", "potentiometer", "robot arm"],
    project: starterProjects.servoKnob
  },
  {
    id: "distance-meter",
    title: "Distance meter",
    tag: "Sensor",
    prompt: "I want to measure how far away something is.",
    outcome: "Ultrasonic sensor prints distance in centimeters.",
    keywords: ["distance", "ultrasonic", "sensor", "measure", "robot eyes", "avoid"],
    project: starterProjects.ultrasonicDistance
  },
  {
    id: "weather-lcd",
    title: "Weather display",
    tag: "Display",
    prompt: "I want to show temperature and humidity.",
    outcome: "DHT sensor reads weather and an LCD shows status text.",
    keywords: ["weather", "temperature", "humidity", "dht", "lcd", "display", "screen"],
    project: starterProjects.dhtDisplay
  },
  {
    id: "neopixel-glow",
    title: "Color animation",
    tag: "Color",
    prompt: "I want a colorful LED animation.",
    outcome: "NeoPixel strip switches between glowing colors.",
    keywords: ["color", "neopixel", "animation", "strip", "rgb", "light"],
    project: starterProjects.neopixelAnimation
  }
];

export default function App() {
  const [extensionPacks, setExtensionPacks] = useState<ImportedExtensionPack[]>(loadExtensionPacks);
  const [project, setProject] = useState<ProjectDocument>(() => cloneProject(loadInitialProject()));
  const [projectSavedAt, setProjectSavedAt] = useState<Date | null>(null);
  const [shareStatus, setShareStatus] = useState(() => (loadSharedProject() ? "Shared link loaded" : "Share link ready"));
  const [mode, setMode] = useState<Mode>("blocks");
  const [codeView, setCodeView] = useState<CodeView>("cpp");
  const [projectStyle, setProjectStyle] = useState<ProjectStyle>("blocks");
  const [landingOpen, setLandingOpen] = useState(shouldShowLandingPage);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectStyle, setNewProjectStyle] = useState<ProjectStyle>("blocks");
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);
  const [agentSetupPlatform, setAgentSetupPlatform] = useState<AgentSetupPlatform>("mac");
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference);
  const [reloadKey, setReloadKey] = useState(() => crypto.randomUUID());
  const [agentOnline, setAgentOnline] = useState(false);
  const [cliStatus, setCliStatus] = useState<AgentCliStatus | null>(null);
  const [agentLog, setAgentLog] = useState<string[]>(["Agent not checked yet."]);
  const [ports, setPorts] = useState<DetectedPort[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [selectedFqbn, setSelectedFqbn] = useState(defaultBoards[0]?.fqbn ?? "");
  const [boardSearch, setBoardSearch] = useState("");
  const [boardTargets, setBoardTargets] = useState<BoardTarget[]>([]);
  const [configuredPackageIndexes, setConfiguredPackageIndexes] = useState<string[]>([]);
  const [packageIndexInput, setPackageIndexInput] = useState("");
  const [packageIndexState, setPackageIndexState] = useState<DeviceWorkflowRunState>("idle");
  const [packageIndexActionTarget, setPackageIndexActionTarget] = useState("");
  const [preparedCores, setPreparedCores] = useState<string[]>([]);
  const [coreActionTarget, setCoreActionTarget] = useState("");
  const [coreState, setCoreState] = useState<DeviceWorkflowRunState>("idle");
  const [librariesReady, setLibrariesReady] = useState(true);
  const [compileState, setCompileState] = useState<DeviceWorkflowRunState>("idle");
  const [uploadState, setUploadState] = useState<DeviceWorkflowRunState>("idle");
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialBaudRate, setSerialBaudRate] = useState("9600");
  const [serialLineEnding, setSerialLineEnding] = useState<SerialLineEnding>("newline");
  const [serialInput, setSerialInput] = useState("");
  const [serialTranscript, setSerialTranscript] = useState<string[]>(["Serial monitor is closed."]);
  const [selectedCategory, setSelectedCategory] = useState<ComponentDefinition["category"]>("output");
  const [componentSearch, setComponentSearch] = useState("");
  const [ideaQuery, setIdeaQuery] = useState("");
  const [missionProgress, setMissionProgress] = useState<Record<string, boolean>>(loadMissionProgress);
  const [lessonFocusId, setLessonFocusId] = useState<string | undefined>(undefined);
  const [packUrl, setPackUrl] = useState("");
  const [packUrlBusy, setPackUrlBusy] = useState(false);
  const [packGallery, setPackGallery] = useState<PackGalleryEntry[]>([]);
  const [packGalleryStatus, setPackGalleryStatus] = useState("Loading gallery");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const extensionInputRef = useRef<HTMLInputElement | null>(null);

  const activeCatalog = useMemo(() => {
    return extensionPacks.reduce((current, pack) => mergeExtensionManifest(current, pack.manifest).catalog, defaultCatalog);
  }, [extensionPacks]);
  const installedPackIds = useMemo(() => new Set(extensionPacks.map((pack) => pack.id)), [extensionPacks]);
  const generated = useMemo(() => generateSketch(project, activeCatalog), [project, activeCatalog]);
  const editorCode = codeView === "cpp" ? generated.code : learningPreview(project, codeView, activeCatalog);
  const editorLanguage = codeView === "cpp" ? "cpp" : codeView;
  const selectedBoard = activeCatalog.boards.find((board) => board.id === project.boardId) ?? activeCatalog.boards[0];
  const effectiveFqbn = targetLabel(project.boardId, selectedFqbn, activeCatalog);
  const selectedCoreTarget = useMemo(() => coreFromFqbn(effectiveFqbn), [effectiveFqbn]);
  const selectedCore = selectedCoreTarget?.core ?? "";
  const selectedPackageIndexPreset = useMemo(() => packageIndexPresetForCore(selectedCore), [selectedCore]);
  const packageIndexNeeded = Boolean(selectedPackageIndexPreset);
  const packageIndexUrl = selectedPackageIndexPreset?.url ?? "";
  const packageIndexReady = !packageIndexNeeded || configuredPackageIndexes.includes(packageIndexUrl);
  const activePackageIndexState = packageIndexUrl && packageIndexActionTarget === packageIndexUrl ? packageIndexState : "idle";
  const packageIndexSuggestions = useMemo(() => searchPackageIndexPresets(boardSearch, selectedCore, 3), [boardSearch, selectedCore]);
  const packageIndexInputUrls = useMemo(() => parsePackageIndexInput(packageIndexInput), [packageIndexInput]);
  const coreReady = Boolean(selectedCore && preparedCores.includes(selectedCore));
  const activeCoreState = selectedCore && coreActionTarget === selectedCore ? coreState : "idle";
  const externalLibraries = libraryNames(project, activeCatalog);
  const wiringDiagnostics = useMemo(() => collectWiringDiagnostics(project, selectedBoard, activeCatalog.components), [project, selectedBoard, activeCatalog.components]);
  const wiringRepairPlan = useMemo(() => collectWiringRepairPlan(project, selectedBoard, activeCatalog.components), [project, selectedBoard, activeCatalog.components]);
  const boardPinUsage = useMemo(() => collectBoardPinUsage(project, selectedBoard, activeCatalog.components), [project, selectedBoard, activeCatalog.components]);
  const wiringCanvas = useMemo(() => createWiringCanvasModel(project, selectedBoard, activeCatalog.components), [project, selectedBoard, activeCatalog.components]);
  const circuitStudio = useMemo(
    () =>
      createCircuitStudioModel({
        project,
        board: selectedBoard,
        definitions: activeCatalog.components,
        wiringCanvas,
        wiringDiagnostics
      }),
    [activeCatalog.components, project, selectedBoard, wiringCanvas, wiringDiagnostics]
  );
  const uploadReadiness = useMemo(
    () =>
      collectUploadReadiness({
        agentOnline,
        cliStatus,
        packageIndexNeeded,
        packageIndexReady,
        packageIndexLabel: selectedPackageIndexPreset?.label ?? "Arduino",
        fqbn: effectiveFqbn,
        core: selectedCore,
        coreReady,
        selectedPort,
        libraries: externalLibraries,
        wiringDiagnostics
      }),
    [
      agentOnline,
      cliStatus,
      coreReady,
      effectiveFqbn,
      externalLibraries,
      packageIndexNeeded,
      packageIndexReady,
      selectedCore,
      selectedPackageIndexPreset?.label,
      selectedPort,
      wiringDiagnostics
    ]
  );
  const deviceWorkflow = useMemo(
    () =>
      collectDeviceWorkflow({
        agentOnline,
        cliStatus,
        packageIndexNeeded,
        packageIndexReady,
        packageIndexState: activePackageIndexState,
        packageIndexLabel: selectedPackageIndexPreset?.label ?? "Arduino",
        fqbn: effectiveFqbn,
        core: selectedCore,
        coreReady,
        coreState: activeCoreState,
        selectedPort,
        libraries: externalLibraries,
        librariesReady,
        uploadReadiness,
        compileState,
        uploadState,
        serialOpen,
        wiringDiagnostics
      }),
    [
      agentOnline,
      cliStatus,
      compileState,
      coreReady,
      activePackageIndexState,
      activeCoreState,
      effectiveFqbn,
      externalLibraries,
      librariesReady,
      packageIndexNeeded,
      packageIndexReady,
      selectedCore,
      selectedPackageIndexPreset?.label,
      selectedPort,
      serialOpen,
      uploadReadiness,
      uploadState,
      wiringDiagnostics
    ]
  );
  const connectionDoctor = useMemo(
    () =>
      collectConnectionDoctor({
        agentOnline,
        cliStatus,
        packageIndexNeeded,
        packageIndexReady,
        packageIndexState: activePackageIndexState,
        packageIndexLabel: selectedPackageIndexPreset?.label ?? "Arduino",
        packageIndexUrl,
        fqbn: effectiveFqbn,
        core: selectedCore,
        coreReady,
        coreState: activeCoreState,
        selectedPort,
        libraries: externalLibraries,
        librariesReady,
        uploadReadiness,
        compileState,
        uploadState,
        serialOpen,
        wiringDiagnostics,
        recentMessages: agentLog
      }),
    [
      agentLog,
      agentOnline,
      cliStatus,
      compileState,
      coreReady,
      activePackageIndexState,
      activeCoreState,
      effectiveFqbn,
      externalLibraries,
      librariesReady,
      packageIndexNeeded,
      packageIndexReady,
      packageIndexUrl,
      selectedCore,
      selectedPackageIndexPreset?.label,
      selectedPort,
      serialOpen,
      uploadReadiness,
      uploadState,
      wiringDiagnostics
    ]
  );
  const projectCoach = useMemo(
    () =>
      collectProjectCoach({
        project,
        boardName: boardName(project.boardId, activeCatalog),
        wiringDiagnostics,
        generatedWarnings: generated.warnings,
        uploadReadiness
      }),
    [activeCatalog, generated.warnings, project, uploadReadiness, wiringDiagnostics]
  );
  const readyToMonitor = agentOnline && Boolean(cliStatus?.available) && Boolean(selectedPort.trim());
  const criticalWiringCount = wiringDiagnostics.filter((diagnostic) => diagnostic.severity !== "tip").length;
  const wiringRepairTone: WiringRepairTone = wiringRepairPlan.autoFixAvailable
    ? "fix"
    : wiringRepairPlan.items.some((item) => item.tone === "fix")
      ? "fix"
      : wiringRepairPlan.items.some((item) => item.tone === "check")
        ? "check"
        : wiringRepairPlan.items.some((item) => item.tone === "ready")
          ? "ready"
          : "info";
  const wiringCanvasSummary =
    wiringCanvas.summary.total === 0
      ? "No wires"
      : wiringCanvas.summary.error > 0
        ? `${wiringCanvas.summary.error} error${wiringCanvas.summary.error === 1 ? "" : "s"}`
        : wiringCanvas.summary.warning > 0
          ? `${wiringCanvas.summary.warning} warning${wiringCanvas.summary.warning === 1 ? "" : "s"}`
          : `${wiringCanvas.summary.total} ready`;
  const activeStyleOption = projectStyleOptions.find((option) => option.id === projectStyle) ?? {
    id: "blocks",
    title: "Blocks",
    kicker: "scratch-style",
    detail: "Build with full Blockly blocks and live Arduino C++."
  };
  const missionProgression = useMemo(() => createMissionProgression(activeCatalog.lessons, missionProgress), [activeCatalog.lessons, missionProgress]);
  const teacherUnitPlan = useMemo(() => createUnitPlan(activeCatalog.lessons, activeCatalog), [activeCatalog]);
  const nextMission = missionProgression.recommended?.lesson ?? activeCatalog.lessons[0];
  const focusedLesson =
    activeCatalog.lessons.find((lesson) => lesson.id === (lessonFocusId ?? project.lessonId)) ?? nextMission ?? activeCatalog.lessons[0];
  const focusedMissionItem = focusedLesson ? missionProgression.items.find((item) => item.lesson.id === focusedLesson.id) : undefined;
  const focusedLessonGuide = useMemo(() => (focusedLesson ? createLessonGuide(focusedLesson, activeCatalog) : undefined), [activeCatalog, focusedLesson]);
  const agentSetupSteps = getAgentSetupSteps(agentSetupPlatform);
  const agentSetupScript = createAgentSetupScript(agentSetupPlatform);
  const visibleComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    const pool = query ? activeCatalog.components : byCategory(activeCatalog.components, selectedCategory);
    if (!query) return pool;
    return pool.filter((component) =>
      [component.name, component.description, component.category, component.id].join(" ").toLowerCase().includes(query)
    );
  }, [activeCatalog.components, componentSearch, selectedCategory]);
  const ideaMatches = useMemo(() => createProjectIdeaMatches(projectIdeas, ideaQuery, activeCatalog.components, 4), [activeCatalog.components, ideaQuery]);

  const updateFromBlocks = useCallback((program: ProgramStep[], blocksXml: string) => {
    try {
      setProject((current) => ({
        ...current,
        program,
        blocksXml,
        generatedSketch: generateSketch({ ...current, program, blocksXml }, activeCatalog).code
      }));
    } catch (error) {
      console.error("Failed to generate sketch from blocks", error);
      setProject((current) => ({
        ...current,
        program,
        blocksXml,
        generatedSketch: current.generatedSketch
      }));
      setAgentLog((current) => [`Blockly sync skipped: failed to regenerate sketch.`, ...current]);
    }
  }, [activeCatalog]);

  const updateFromIconBlocks = useCallback((program: ProgramStep[]) => {
    setReloadKey(crypto.randomUUID());
    setProject((current) => {
      const nextProject = { ...current, program };
      const blocksXml = projectToBlocklyXml(nextProject);
      return {
        ...nextProject,
        blocksXml,
        generatedSketch: generateSketch({ ...nextProject, blocksXml }, activeCatalog).code
      };
    });
  }, [activeCatalog]);

  useEffect(() => {
    void refreshAgent();
  }, []);

  useEffect(() => {
    setLibrariesReady(externalLibraries.length === 0);
  }, [externalLibraries]);

  useEffect(() => {
    setCompileState("idle");
    setUploadState("idle");
  }, [effectiveFqbn, generated.code]);

  useEffect(() => {
    setUploadState("idle");
  }, [selectedPort]);

  async function refreshAgent() {
    setAgentLog((current) => ["Checking local agent and Arduino CLI.", ...current].slice(0, 80));
    const ok = await agentHealth();
    setAgentOnline(ok);
    if (!ok) {
      setAgentLog(["Agent is offline. Run npm run agent from the repo folder."]);
      return;
    }
    const status = await agentRpc<AgentCliStatus>("agent.status");
    setCliStatus(status.ok && status.data ? status.data : { available: false, cli: "arduino-cli", error: status.error });
    if (status.ok && status.data?.available) {
      const indexes = await agentRpc<PackageIndexResponse>("indexes.list");
      if (indexes.ok && indexes.data?.urls) {
        setConfiguredPackageIndexes(indexes.data.urls);
      }
    }
    setAgentLog([
      status.ok && status.data?.available
        ? `Agent connected. Arduino CLI ready at ${status.data.cli}.`
        : `Agent connected, but Arduino CLI is not ready: ${status.error ?? status.data?.error ?? "unknown error"}`
    ]);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference;
    window.localStorage.setItem(themePreferenceKey, themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (!agentOnline) return;
    const socket = openAgentEvents((message) => {
      const payload = message as { type?: string; data?: string; port?: string };
      if (payload.type?.startsWith("serial.")) {
        const line = `${payload.port ?? "serial"}: ${payload.data ?? payload.type}`.trim();
        setAgentLog((current) => [line, ...current].slice(0, 80));
        setSerialTranscript((current) => [line, ...current].slice(0, 120));
      }
    });
    return () => socket.close();
  }, [agentOnline]);

  useEffect(() => {
    window.localStorage.setItem(missionProgressKey, JSON.stringify(missionProgress));
  }, [missionProgress]);

  useEffect(() => {
    window.localStorage.setItem(extensionPacksKey, serializeExtensionPacks(extensionPacks));
  }, [extensionPacks]);

  useEffect(() => {
    let cancelled = false;
    async function loadPackGallery() {
      try {
        const response = await fetch(new URL("packs/index.json", window.location.href).toString(), { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const entries = parsePackGallery(JSON.parse(await response.text()));
        if (cancelled) return;
        setPackGallery(entries);
        setPackGalleryStatus(entries.length === 0 ? "Gallery empty" : `${entries.length} pack${entries.length === 1 ? "" : "s"}`);
      } catch (error) {
        if (!cancelled) setPackGalleryStatus(`Gallery unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    void loadPackGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === "#workspace") {
        setLandingOpen(false);
        return;
      }
      const shared = loadSharedProject();
      if (!shared) return;
      setLandingOpen(false);
      loadProject(shared);
      setShareStatus("Shared link loaded");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(currentProjectKey, serializeProject({ ...project, generatedSketch: generated.code }));
      setProjectSavedAt(new Date());
    } catch {
      setProjectSavedAt(null);
    }
  }, [generated.code, project]);

  function applyProjectStyle(nextStyle: ProjectStyle) {
    setProjectStyle(nextStyle);
    if (nextStyle === "code") {
      setMode("code");
      setCodeView("cpp");
      return;
    }
    setMode("blocks");
  }

  function loadProject(nextProject: ProjectDocument, nextStyle: ProjectStyle = projectStyle) {
    setProject(cloneProject(nextProject));
    setReloadKey(crypto.randomUUID());
    applyProjectStyle(nextStyle);
  }

  function launchLesson(lessonId: string) {
    const lesson = activeCatalog.lessons.find((candidate) => candidate.id === lessonId);
    if (!lesson) return;
    setLessonFocusId(lesson.id);
    loadProject({ ...lesson.starterProject, lessonId: lesson.id });
    setAgentLog((current) => [`Mission launched: ${lesson.title}.`, ...current]);
  }

  function createNewProject() {
    const nextProject = cloneProject({
      ...starterProjects.blink,
      name: "Project 1",
      lessonId: undefined
    });
    setProject(nextProject);
    setReloadKey(crypto.randomUUID());
    applyProjectStyle(newProjectStyle);
    setNewProjectOpen(false);
    setAgentLog((current) => [`Created Project 1 in ${projectStyleOptions.find((option) => option.id === newProjectStyle)?.title ?? "Blocks"}.`, ...current]);
  }

  function loadIdeaProject(idea: ProjectIdea) {
    const nextStyle = projectStyle === "code" ? "blocks" : projectStyle;
    loadProject(idea.project, nextStyle);
    if (mode !== "circuit") setMode("blocks");
    setAgentLog((current) => [`Idea loaded: ${idea.title}.`, ...current]);
  }

  function removeExtensionPack(packId: string) {
    setExtensionPacks((current) => current.filter((pack) => pack.id !== packId));
    setAgentLog((current) => [`Removed hardware pack ${packId}.`, ...current]);
  }

  function resetExtensionPacks() {
    setExtensionPacks([]);
    setAgentLog((current) => ["Removed all imported hardware packs.", ...current]);
  }

  function completeMission(lessonId: string) {
    setLessonFocusId(lessonId);
    setMissionProgress((current) => ({ ...current, [lessonId]: true }));
  }

  function resetMissionProgress() {
    setMissionProgress({});
  }

  function installExtensionManifest(manifest: ExtensionManifest, sourceLabel: string) {
    const replacement = extensionPacks.some((pack) => pack.id === manifest.id);
    const warnings = mergeExtensionManifest(activeCatalog, manifest).warnings;
    setExtensionPacks((current) => [
      ...current.filter((pack) => pack.id !== manifest.id),
      importedPackFromManifest(manifest)
    ]);
    setAgentLog((current) => [
      `${replacement ? "Updated" : "Imported"} hardware pack ${manifest.name} from ${sourceLabel} (${manifest.components?.length ?? 0} component${manifest.components?.length === 1 ? "" : "s"}).`,
      ...warnings,
      ...current
    ]);
  }

  function addComponent(definition: ComponentDefinition) {
    const instance = createComponentInstance(definition);
    setProject((current) => ({
      ...current,
      components: [...current.components, instance]
    }));
  }

  function removeComponent(instanceId: string) {
    setProject((current) => ({
      ...current,
      components: current.components.filter((component) => component.id !== instanceId)
    }));
  }

  function updateComponentPin(instanceId: string, pinName: string, value: string) {
    setProject((current) => ({
      ...current,
      components: current.components.map((component) =>
        component.id === instanceId ? { ...component, pins: { ...component.pins, [pinName]: coercePinValue(value) } } : component
      )
    }));
  }

  function applyAutoPins() {
    const result = autoAssignProjectPins(project, selectedBoard, activeCatalog.components);
    setProject(result.project);
    const summary =
      result.changes.length > 0
        ? `Auto pins updated ${result.changes.length} connection${result.changes.length === 1 ? "" : "s"}.`
        : "Auto pins found no changes to make.";
    setAgentLog((current) => [
      summary,
      ...result.changes.slice(0, 3).map((change) => `${change.componentLabel} ${change.pinName}: ${String(change.from)} -> ${String(change.to)}`),
      ...result.skipped.slice(0, 2).map((item) => `${item.componentLabel} ${item.pinName}: ${item.reason}`),
      ...current
    ]);
  }

  async function detectBoards() {
    const response = await agentRpc("boards.detect");
    if (!response.ok) {
      setAgentLog((current) => [`Board detection failed: ${response.error}`, ...current]);
      setAgentOnline(false);
      return;
    }
    const detected = flattenPorts(response.data);
    setPorts(detected);
    setSelectedPort((current) => current || detected[0]?.address || "");
    setSelectedFqbn((current) => current || detected[0]?.fqbn || "");
    setAgentLog((current) => [`Detected ${detected.length} board port(s).`, ...current]);
  }

  async function searchBoards() {
    const response = await agentRpc("boards.search", { query: boardSearch.trim() || undefined });
    if (!response.ok) {
      setAgentLog((current) => [`Board search failed: ${response.error}`, ...current]);
      return;
    }
    const targets = flattenBoardTargets(response.data);
    setBoardTargets(targets);
    setAgentLog((current) => [`Found ${targets.length} board target(s).`, ...current]);
  }

  async function addPackageIndexes(urls: string[], label = "custom board package") {
    if (urls.length === 0) {
      setAgentLog((current) => ["Paste a Boards Manager package JSON URL before adding an index.", ...current]);
      return;
    }

    const target = urls[0] ?? "";
    setPackageIndexState("running");
    setPackageIndexActionTarget(target);
    const response = await agentRpc<PackageIndexResponse>("indexes.add", { urls });
    setPackageIndexState(response.ok ? "success" : "error");
    if (response.ok) {
      const configured = response.data?.configured ?? urls;
      setConfiguredPackageIndexes(configured);
      setPackageIndexInput("");
      setAgentLog((current) => [
        `Added ${label}: ${urls.length} package URL${urls.length === 1 ? "" : "s"}. Arduino board indexes updated.`,
        ...current
      ]);
      return;
    }
    setAgentLog((current) => [`Package index failed for ${label}: ${response.error}`, ...current]);
  }

  function addPackageIndexPreset(preset: BoardPackageIndexPreset) {
    return addPackageIndexes([preset.url], preset.label);
  }

  async function installCore() {
    if (!selectedCore) {
      setAgentLog((current) => ["Choose a full FQBN like arduino:avr:uno before preparing the board core.", ...current]);
      return;
    }

    setCoreState("running");
    setCoreActionTarget(selectedCore);
    const response = await agentRpc("cores.install", { core: selectedCore });
    setCoreState(response.ok ? "success" : "error");
    if (response.ok) {
      setPreparedCores((current) => (current.includes(selectedCore) ? current : [...current, selectedCore]));
    }
    setAgentLog((current) => [
      response.ok ? `Prepared board core: ${selectedCore}` : `Board core install failed for ${selectedCore}: ${response.error}`,
      ...current
    ]);
  }

  async function installLibraries() {
    const names = externalLibraries;
    if (names.length === 0) {
      setLibrariesReady(true);
      setAgentLog((current) => ["No external libraries needed for this sketch.", ...current]);
      return;
    }
    const response = await agentRpc("libraries.install", { libraries: names });
    setLibrariesReady(response.ok);
    setAgentLog((current) => [response.ok ? `Installed libraries: ${names.join(", ")}` : `Library install failed: ${response.error}`, ...current]);
  }

  async function compileSketch() {
    setCompileState("running");
    setUploadState("idle");
    const response = await agentRpc("sketch.compile", {
      name: project.name,
      boardId: project.boardId,
      fqbn: effectiveFqbn,
      libraries: externalLibraries,
      code: generated.code
    });
    setCompileState(response.ok ? "success" : "error");
    if (response.ok) {
      setLibrariesReady(true);
      if (selectedCore) {
        setCoreActionTarget(selectedCore);
        setPreparedCores((current) => (current.includes(selectedCore) ? current : [...current, selectedCore]));
        setCoreState("success");
      }
      if (packageIndexUrl) {
        setConfiguredPackageIndexes((current) => (current.includes(packageIndexUrl) ? current : [...current, packageIndexUrl]));
      }
    }
    setAgentLog((current) => [response.ok ? "Compile finished." : `Compile failed: ${response.error}`, ...current]);
  }

  async function uploadSketch() {
    setUploadState("running");
    const response = await agentRpc("sketch.upload", {
      name: project.name,
      boardId: project.boardId,
      fqbn: effectiveFqbn,
      libraries: externalLibraries,
      port: selectedPort,
      code: generated.code
    });
    setUploadState(response.ok ? "success" : "error");
    if (response.ok) {
      setCompileState("success");
      setLibrariesReady(true);
      if (selectedCore) {
        setCoreActionTarget(selectedCore);
        setPreparedCores((current) => (current.includes(selectedCore) ? current : [...current, selectedCore]));
        setCoreState("success");
      }
      if (packageIndexUrl) {
        setConfiguredPackageIndexes((current) => (current.includes(packageIndexUrl) ? current : [...current, packageIndexUrl]));
      }
    }
    setAgentLog((current) => [response.ok ? `Upload finished on ${selectedPort}.` : `Upload failed: ${response.error}`, ...current]);
  }

  async function toggleSerialMonitor() {
    if (!selectedPort) return;
    const baudRate = normalizeBaudRate(serialBaudRate);
    const response = await agentRpc(serialOpen ? "serial.close" : "serial.open", {
      port: selectedPort,
      fqbn: effectiveFqbn,
      baudRate
    });
    if (response.ok) {
      const nextOpen = !serialOpen;
      setSerialOpen(nextOpen);
      setSerialTranscript((current) => [
        nextOpen ? `Opened ${selectedPort} at ${baudRate} baud.` : `Closed ${selectedPort}.`,
        ...current
      ].slice(0, 120));
    }
    setAgentLog((current) => [
      response.ok ? `${serialOpen ? "Closed" : "Opened"} serial monitor on ${selectedPort} at ${baudRate} baud.` : `Serial monitor failed: ${response.error}`,
      ...current
    ]);
  }

  async function sendSerialMessage() {
    const message = serialInput;
    if (!serialOpen || !message) return;
    const response = await agentRpc("serial.write", {
      port: selectedPort,
      data: appendSerialLineEnding(message, serialLineEnding)
    });
    if (response.ok) {
      setSerialInput("");
      setSerialTranscript((current) => [`> ${message}`, ...current].slice(0, 120));
    }
    setAgentLog((current) => [
      response.ok ? `Sent serial message using ${lineEndingLabel(serialLineEnding).toLowerCase()}.` : `Serial send failed: ${response.error}`,
      ...current
    ]);
  }

  function readinessIcon(state: UploadChecklistState) {
    if (state === "ready") return <CheckCircle2 size={15} />;
    if (state === "warning" || state === "blocked") return <AlertTriangle size={15} />;
    return <Sparkles size={15} />;
  }

  function workflowIcon(state: DeviceWorkflowStepState) {
    if (state === "done") return <CheckCircle2 size={15} />;
    if (state === "blocked" || state === "warning") return <AlertTriangle size={15} />;
    if (state === "current") return <Play size={15} />;
    return <Sparkles size={15} />;
  }

  function doctorIcon(severity: ConnectionDoctorSeverity) {
    if (severity === "ready") return <CheckCircle2 size={16} />;
    if (severity === "blocked" || severity === "warning") return <AlertTriangle size={16} />;
    return <Sparkles size={16} />;
  }

  function workflowActionDisabled(action: DeviceWorkflowAction) {
    if (activePackageIndexState === "running" || activeCoreState === "running" || compileState === "running" || uploadState === "running") return true;
    if (action === "none") return true;
    if (action === "add-package-index") return !agentOnline || !cliStatus?.available || !packageIndexUrl || packageIndexReady;
    if (action === "detect") return !agentOnline || !cliStatus?.available;
    if (action === "search-target") return !agentOnline || !cliStatus?.available;
    if (action === "install-core") return !agentOnline || !cliStatus?.available || !selectedCore || coreReady;
    if (action === "install-libraries") return !agentOnline || !cliStatus?.available || externalLibraries.length === 0;
    if (action === "compile") return !uploadReadiness.readyToCompile;
    if (action === "upload") return !uploadReadiness.readyToUpload || compileState !== "success";
    if (action === "monitor") return !readyToMonitor && !serialOpen;
    return false;
  }

  function runWorkflowAction(action: DeviceWorkflowAction) {
    if (action === "check-agent") return void refreshAgent();
    if (action === "add-package-index" && selectedPackageIndexPreset) return void addPackageIndexPreset(selectedPackageIndexPreset);
    if (action === "detect") return void detectBoards();
    if (action === "search-target") return void searchBoards();
    if (action === "install-core") return void installCore();
    if (action === "install-libraries") return void installLibraries();
    if (action === "compile") return void compileSketch();
    if (action === "upload") return void uploadSketch();
    if (action === "monitor") return void toggleSerialMonitor();
  }

  function doctorActionDisabled(action: ConnectionDoctorAction) {
    if (action === "open-setup" || action === "open-code") return false;
    return workflowActionDisabled(action);
  }

  function runDoctorAction(action: ConnectionDoctorAction) {
    if (action === "open-setup") {
      setAgentSetupOpen(true);
      return;
    }
    if (action === "open-code") {
      setMode("code");
      setCodeView("cpp");
      return;
    }
    return runWorkflowAction(action);
  }

  async function copyAgentSetupText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setAgentLog((current) => [`Copied ${label}.`, ...current].slice(0, 80));
    } catch {
      setAgentLog((current) => [`Copy failed for ${label}. Select the command text and copy it manually.`, ...current].slice(0, 80));
    }
  }

  function coachIcon(state: CoachStepState) {
    if (state === "done") return <CheckCircle2 size={15} />;
    if (state === "warning" || state === "blocked") return <AlertTriangle size={15} />;
    return <Sparkles size={15} />;
  }

  function wiringRepairIcon(tone: WiringRepairTone) {
    if (tone === "ready") return <CheckCircle2 size={15} />;
    if (tone === "fix") return <AlertTriangle size={15} />;
    if (tone === "check") return <Cable size={15} />;
    return <Sparkles size={15} />;
  }

  function exportProject() {
    saveBlob(
      `${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.ablk.json`,
      JSON.stringify({ ...project, generatedSketch: generated.code }, null, 2),
      "application/json"
    );
  }

  function exportSketch() {
    saveBlob(`${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.ino`, generated.code, "text/x-arduino");
  }

  function exportBuildGuide() {
    const guide = createBuildGuide({ ...project, generatedSketch: generated.code }, activeCatalog);
    saveBlob(`${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-build-guide.md`, guide, "text/markdown");
    setAgentLog((current) => ["Build guide exported with parts, wiring, checks, and generated sketch.", ...current]);
  }

  function exportLessonBuildGuide(lessonId: string) {
    const lesson = activeCatalog.lessons.find((candidate) => candidate.id === lessonId);
    if (!lesson) return;
    const lessonProject = { ...lesson.starterProject, lessonId: lesson.id };
    const guide = createBuildGuide(lessonProject, activeCatalog);
    saveBlob(`${lesson.title.replace(/[^a-zA-Z0-9_-]/g, "_")}-lesson-guide.md`, guide, "text/markdown");
    setLessonFocusId(lesson.id);
    setAgentLog((current) => [`Exported lesson guide: ${lesson.title}.`, ...current]);
  }

  function exportUnitPlan() {
    saveBlob(unitPlanFilename(teacherUnitPlan), createUnitPlanMarkdown(teacherUnitPlan), "text/markdown");
    setAgentLog((current) => ["Exported teacher unit plan with pacing, materials, libraries, and lesson path.", ...current]);
  }

  async function copyShareLink() {
    const url = shareUrlForProject({ ...project, generatedSketch: generated.code }, window.location.href);
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("Share link copied");
      setAgentLog((current) => ["Copied project share link.", ...current]);
    } catch {
      setShareStatus("Share link in address bar");
      setAgentLog((current) => ["Share link is ready in the address bar.", ...current]);
    }
  }

  async function exportWokwiProject() {
    const zip = new JSZip();
    const unsupported = unsupportedWokwiComponents(project, activeCatalog.components);
    zip.file("sketch.ino", generated.code);
    zip.file("diagram.json", JSON.stringify(createWokwiDiagram(project), null, 2));
    zip.file("BUILD_GUIDE.md", createBuildGuide({ ...project, generatedSketch: generated.code }, activeCatalog, { includeSketch: false }));
    const libraries = externalLibraries;
    if (libraries.length) zip.file("libraries.txt", `${libraries.join("\n")}\n`);
    zip.file(
      "README.md",
      [
        `# ${project.name}`,
        "",
        "Generated by Arduino Blocks Lab.",
        "",
        "Open these files in Wokwi or use the diagram as a simulator starting point.",
        "",
        unsupported.length ? `Unsupported in the Wokwi diagram helper: ${unsupported.join(", ")}.` : "All components in this project have Wokwi diagram hints."
      ].join("\n")
    );
    const blob = await zip.generateAsync({ type: "blob" });
    saveBlob(`${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-wokwi.zip`, blob, "application/zip");
    setAgentLog((current) => [
      unsupported.length ? `Wokwi export created; add manually: ${unsupported.join(", ")}.` : "Wokwi project export created.",
      ...current
    ]);
  }

  async function importProject(file: File) {
    const contents = await file.text();
    const parsed = JSON.parse(contents) as ProjectDocument;
    loadProject(parsed);
  }

  async function importExtensionPack(file: File) {
    try {
      const result = parseExtensionManifest(JSON.parse(await file.text()));
      if (!result.manifest) {
        setAgentLog((current) => [`Hardware pack import failed: ${result.errors.join(" ")}`, ...current]);
        return;
      }
      installExtensionManifest(result.manifest, file.name);
    } catch (error) {
      setAgentLog((current) => [`Hardware pack import failed: ${error instanceof Error ? error.message : "invalid JSON"}`, ...current]);
    }
  }

  async function importExtensionPackFromUrl(urlInput = packUrl) {
    let normalized: string;
    try {
      normalized = normalizePackUrl(urlInput, window.location.href);
    } catch (error) {
      setAgentLog((current) => [`Hardware pack URL failed: ${error instanceof Error ? error.message : String(error)}`, ...current]);
      return;
    }

    setPackUrlBusy(true);
    try {
      const response = await fetch(normalized, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const result = parseExtensionManifest(JSON.parse(await response.text()));
      if (!result.manifest) {
        setAgentLog((current) => [`Hardware pack URL failed: ${result.errors.join(" ")}`, ...current]);
        return;
      }
      installExtensionManifest(result.manifest, normalized);
      setPackUrl("");
    } catch (error) {
      setAgentLog((current) => [`Hardware pack URL failed: ${error instanceof Error ? error.message : String(error)}`, ...current]);
    } finally {
      setPackUrlBusy(false);
    }
  }

  function importGalleryPack(entry: PackGalleryEntry) {
    const url = resolveGalleryPackUrl(entry, window.location.href);
    setPackUrl(url);
    void importExtensionPackFromUrl(url);
  }

  function enterWorkspace(nextMode: Mode = "blocks") {
    setLandingOpen(false);
    if (!window.location.hash.startsWith(projectShareHashPrefix)) {
      window.history.replaceState(null, "", "#workspace");
    }
    if (nextMode === "code") {
      setProjectStyle("code");
      setCodeView("cpp");
      setMode("code");
      return;
    }
    if (nextMode === "blocks" && projectStyle === "code") {
      setProjectStyle("blocks");
    }
    setMode(nextMode);
  }

  if (landingOpen) {
    return (
      <LandingPage
        boardCount={activeCatalog.boards.length}
        componentCount={activeCatalog.components.length}
        lessonCount={activeCatalog.lessons.length}
        onStart={() => enterWorkspace("blocks")}
        onOpenCircuit={() => enterWorkspace("circuit")}
        onOpenCode={() => enterWorkspace("code")}
        onOpenLessons={() => enterWorkspace("lessons")}
      />
    );
  }

  return (
    <main className={`app-shell style-${projectStyle}`} data-theme={themePreference}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Cpu size={24} aria-hidden="true" />
          </div>
          <div>
            <h1>Arduino Blocks Lab</h1>
            <span>{project.name}</span>
          </div>
        </div>

        <div className="mode-stack">
          <div className="mode-tabs" role="tablist" aria-label="Editor modes">
            <button
              className={mode === "blocks" ? "active" : ""}
              onClick={() => {
                setMode("blocks");
                if (projectStyle === "code") setProjectStyle("blocks");
              }}
            >
              <SquareStack size={18} />
              Blocks
            </button>
            <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}>
              <Code2 size={18} />
              Arduino C++
            </button>
            <button className={mode === "circuit" ? "active" : ""} onClick={() => setMode("circuit")}>
              <CircuitBoard size={18} />
              Circuit
            </button>
            <button className={mode === "lessons" ? "active" : ""} onClick={() => setMode("lessons")}>
              <Gauge size={18} />
              Lessons
            </button>
          </div>
        </div>

        <div className="toolbar">
          <button title="New project" onClick={() => setNewProjectOpen(true)}>
            <FilePlus size={18} />
          </button>
          <select
            aria-label="Board"
            value={project.boardId}
            onChange={(event) => {
              const boardId = event.target.value;
              setProject((current) => ({ ...current, boardId }));
              setSelectedFqbn(activeCatalog.boards.find((board) => board.id === boardId)?.fqbn ?? "");
            }}
          >
            {activeCatalog.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
          <button title="Open project" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen size={18} />
          </button>
          <button title="Save project" onClick={exportProject}>
            <Save size={18} />
          </button>
          <button title="Copy share link" onClick={() => void copyShareLink()}>
            <Share2 size={18} />
          </button>
          <button title="Download sketch" onClick={exportSketch}>
            <Download size={18} />
          </button>
          <button title="Download build guide" onClick={exportBuildGuide}>
            <FileText size={18} />
          </button>
          <button title="Download Wokwi project" onClick={() => void exportWokwiProject()}>
            <Globe2 size={18} />
          </button>
          <button title="Import hardware pack" onClick={() => extensionInputRef.current?.click()}>
            <PackagePlus size={18} />
          </button>
          <button
            title={themePreference === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setThemePreference((current) => nextThemePreference(current))}
          >
            {themePreference === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ablk.json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importProject(file);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={extensionInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importExtensionPack(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <section className="status-strip">
        <div className="style-switch" role="group" aria-label="Coding style">
          {projectStyleOptions.map((option) => (
            <button
              className={projectStyle === option.id ? "active" : ""}
              key={option.id}
              onClick={() => applyProjectStyle(option.id)}
              title={option.title}
            >
              {option.id === "code" ? <Code2 size={15} /> : <SquareStack size={15} />}
              <span>{option.id === "icon" ? "Icon" : option.id === "blocks" ? "Blocks" : "Code"}</span>
            </button>
          ))}
        </div>
        <span>
          {projectStyle === "code" ? <Code2 size={16} /> : <SquareStack size={16} />}
          {activeStyleOption.title}
        </span>
        <span>
          <CheckCircle2 size={16} />
          {boardName(project.boardId, activeCatalog)}
        </span>
        <span>
          <Globe2 size={16} />
          Target {effectiveFqbn}
        </span>
        <span>
          <Library size={16} />
          {generated.libraries.length === 0 ? "No libraries" : generated.libraries.map((library) => library.name).join(", ")}
        </span>
        <span className={agentOnline ? "online" : "offline"}>
          <Cable size={16} />
          {agentOnline ? (cliStatus ? (cliStatus.available ? "Agent + CLI ready" : "CLI not ready") : "Agent online") : "Agent offline"}
        </span>
        <span className={criticalWiringCount > 0 ? "warning" : "online"}>
          {criticalWiringCount > 0 ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
          {criticalWiringCount > 0 ? `${criticalWiringCount} wiring note${criticalWiringCount === 1 ? "" : "s"}` : "Wiring clear"}
        </span>
        <span>
          <PackagePlus size={16} />
          {extensionPacks.length === 0 ? "Built-in pack" : `${extensionPacks.length + 1} packs`}
        </span>
        <span>
          <Save size={16} />
          {projectSavedAt ? `Autosaved ${projectSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Autosave ready"}
        </span>
        <span>
          <Share2 size={16} />
          {shareStatus}
        </span>
        {generated.warnings.map((warning) => (
          <span className="warning" key={warning}>
            {warning}
          </span>
        ))}
      </section>

      <div className={`workspace-grid mode-${mode} style-${projectStyle}`}>
        <aside className="left-panel">
          <section className="panel-section idea-section">
            <div className="section-heading">
              <h2>Make</h2>
              <span>{ideaMatches.length}</span>
            </div>
            <label className="idea-search">
              <Sparkles size={15} />
              <input
                aria-label="Describe what you want to build"
                value={ideaQuery}
                onChange={(event) => setIdeaQuery(event.target.value)}
                placeholder="Try distance, weather, button"
              />
            </label>
            <div className="idea-list">
              {ideaMatches.map((idea) => (
                <button
                  className="idea-card"
                  key={idea.id}
                  onClick={() => loadIdeaProject(idea)}
                  title={`Build ${idea.title}`}
                >
                  <span className="idea-topline">
                    <span>{idea.tag}</span>
                    <span>{idea.partNames.length} parts</span>
                  </span>
                  <strong>{idea.title}</strong>
                  <p>{idea.prompt}</p>
                  <span className="idea-outcome">{idea.outcome}</span>
                  <span className="idea-meta">
                    <span>{idea.blockCount} blocks</span>
                    <span>{idea.wiringCount} wires</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section starter-section">
            <div className="section-heading">
              <h2>Starters</h2>
              <span>{starterCards.length}</span>
            </div>
            <div className="starter-list">
              {starterCards.map((starter) => {
                const active = project.name === starter.project.name;
                return (
                  <button
                    className={`starter-card ${active ? "active" : ""}`}
                    key={starter.id}
                    onClick={() => loadProject(starter.project)}
                    title={`Load ${starter.project.name}`}
                  >
                    <span className="starter-topline">
                      <span>{starter.tag}</span>
                      <span>{starter.project.components.length} parts</span>
                    </span>
                    <strong>{starter.project.name}</strong>
                    <p>{starter.goal}</p>
                    <span className="starter-foot">
                      <Play size={14} />
                      Load
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>Hardware</h2>
              <span>{visibleComponents.length}</span>
            </div>
            <label className="component-search">
              <Search size={15} />
              <input
                aria-label="Search hardware"
                value={componentSearch}
                onChange={(event) => setComponentSearch(event.target.value)}
                placeholder="Search sensors, motors, displays"
              />
            </label>
            <div className="category-tabs" role="tablist" aria-label="Hardware categories">
              {(["output", "input", "sensor", "motion", "display", "power", "communication"] as const).map((category) => (
                <button
                  key={category}
                  className={selectedCategory === category ? "active" : ""}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="catalog-list">
              {visibleComponents.length === 0 ? (
                <div className="empty-row">No hardware matches.</div>
              ) : (
                visibleComponents.map((definition) => (
                  <button className="catalog-row" key={definition.id} onClick={() => addComponent(definition)}>
                    <span>{definition.name}</span>
                    <small>{definition.category}</small>
                    <Upload size={16} />
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>Build</h2>
              <span>{project.components.length}</span>
            </div>
            <div className="component-list">
              {project.components.map((instance) => {
                const definition = componentDefinition(instance, activeCatalog.components);
                return (
                  <div className="component-row" key={instance.id}>
                    <div>
                      <strong>{instance.label}</strong>
                      <span>{definition?.name ?? instance.componentId}</span>
                    </div>
                    <button title="Remove component" onClick={() => removeComponent(instance.id)}>
                      <Trash2 size={16} />
                    </button>
                    {definition && (
                      <div className="pin-grid">
                        {Object.entries(instance.pins).map(([pinName, pinValue]) => (
                          <label key={`${instance.id}-${pinName}`}>
                            <span>{definition.pinLabels[pinName] ?? pinName}</span>
                            <input value={String(pinValue)} onChange={(event) => updateComponentPin(instance.id, pinName, event.target.value)} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="main-panel">
          {mode === "blocks" && (
            projectStyle === "icon" ? (
              <IconBlocksPanel
                project={project}
                componentDefinitions={activeCatalog.components}
                onProgramChange={updateFromIconBlocks}
                onOpenCircuit={() => setMode("circuit")}
                onOpenCode={() => {
                  setProjectStyle("code");
                  setMode("code");
                  setCodeView("cpp");
                }}
              />
            ) : (
              <BlocklyWorkspace
                components={project.components}
                componentDefinitions={activeCatalog.components}
                xml={project.blocksXml ?? projectToBlocklyXml(project)}
                reloadKey={reloadKey}
                themePreference={themePreference}
                onChange={updateFromBlocks}
              />
            )
          )}

          {mode === "code" && (
            <div className="code-panel">
              <div className="code-view-tabs" role="tablist" aria-label="Code language views">
                <button className={codeView === "cpp" ? "active" : ""} onClick={() => setCodeView("cpp")}>
                  Arduino C++
                </button>
                <button className={codeView === "python" ? "active" : ""} onClick={() => setCodeView("python")}>
                  Python Preview
                </button>
                <button className={codeView === "javascript" ? "active" : ""} onClick={() => setCodeView("javascript")}>
                  JavaScript Preview
                </button>
              </div>
              <Editor
                height="calc(100% - 46px)"
                language={editorLanguage}
                value={editorCode}
                theme={themePreference === "dark" ? "vs-dark" : "vs-light"}
                options={{
                  minimap: { enabled: false },
                  readOnly: true,
                  fontSize: 14,
                  lineNumbersMinChars: 3,
                  scrollBeyondLastLine: false
                }}
              />
            </div>
          )}

          {mode === "circuit" && (
            <CircuitStudioPanel
              model={circuitStudio}
              generatedCode={generated.code}
              onExportWokwiProject={() => void exportWokwiProject()}
              onOpenCode={() => {
                setCodeView("cpp");
                setMode("code");
              }}
            />
          )}

          {mode === "lessons" && (
            <div className="lessons-panel mission-panel">
              <div className="mission-hero">
                <div>
                  <span>Mission path</span>
                  <strong>
                    {missionProgression.completedCount}/{missionProgression.totalCount} complete
                  </strong>
                </div>
                <div className="mission-progress" aria-label="Mission progress">
                  <span style={{ width: `${missionProgression.progressPercent}%` }} />
                </div>
                <div className="mission-pacing" aria-label="Class pacing">
                  <span>
                    <strong>{missionProgression.remainingMinutes}</strong>
                    min left
                  </span>
                  <span>
                    <strong>{missionProgression.recommended?.lesson.title ?? "Path complete"}</strong>
                    next mission
                  </span>
                </div>
                <div className="mission-actions">
                  <button disabled={!missionProgression.recommended} onClick={() => missionProgression.recommended && launchLesson(missionProgression.recommended.lesson.id)}>
                    <Play size={16} />
                    Next
                  </button>
                  <button onClick={resetMissionProgress}>
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </div>
              </div>

              <section className="unit-plan-card">
                <div className="unit-plan-copy">
                  <span>Teacher unit plan</span>
                  <strong>
                    {teacherUnitPlan.sessionCount} class period{teacherUnitPlan.sessionCount === 1 ? "" : "s"} · {teacherUnitPlan.totalMinutes} min
                  </strong>
                  <p>
                    {teacherUnitPlan.totalLessons} missions with {teacherUnitPlan.totalParts} parts, {teacherUnitPlan.totalWires} wires, and {teacherUnitPlan.totalBlocks} blocks.
                  </p>
                </div>
                <div className="unit-plan-metrics">
                  <span>
                    <strong>{teacherUnitPlan.materials.length}</strong>
                    materials
                  </span>
                  <span>
                    <strong>{teacherUnitPlan.concepts.length}</strong>
                    concepts
                  </span>
                  <span>
                    <strong>{teacherUnitPlan.libraries.length}</strong>
                    libraries
                  </span>
                </div>
                <div className="unit-plan-chip-row" aria-label="Unit plan highlights">
                  {teacherUnitPlan.materials.slice(0, 3).map((material) => (
                    <span key={material}>{material}</span>
                  ))}
                  {teacherUnitPlan.concepts.slice(0, 3).map((concept) => (
                    <span key={concept}>{concept}</span>
                  ))}
                </div>
                <button onClick={exportUnitPlan}>
                  <FileText size={16} />
                  Export plan
                </button>
              </section>

              <div className="mission-workbench">
                <div className="mission-track">
                  {missionProgression.items.map((item) => {
                    const lesson = item.lesson;
                    const complete = item.status === "complete";
                    const locked = item.status === "locked";
                    const active = focusedLesson?.id === lesson.id;
                    const loaded = project.lessonId === lesson.id;
                    return (
                      <div className={`mission-card ${item.status} ${active ? "active" : ""}`} key={lesson.id}>
                        <button className="mission-node" onClick={() => setLessonFocusId(lesson.id)} title={`Preview ${lesson.title}`}>
                          {complete ? <Medal size={20} /> : locked ? <LockKeyhole size={18} /> : <span>{item.index + 1}</span>}
                        </button>
                        <div className="mission-copy">
                          <span>
                            {lessonLevelLabel(lesson.level)}
                            {" · "}
                            {missionStatusLabel(item.status)}
                            {loaded ? " · loaded" : ""}
                          </span>
                          <strong>{lesson.title}</strong>
                          <p>{lesson.goal}</p>
                          {locked && item.lockedBy && <small>Finish {item.lockedBy.title} to unlock.</small>}
                        </div>
                        <div className="mission-card-actions">
                          <button disabled={locked} onClick={() => launchLesson(lesson.id)}>
                            {locked ? <LockKeyhole size={16} /> : <Play size={16} />}
                            {locked ? "Locked" : "Launch"}
                          </button>
                          <button onClick={() => exportLessonBuildGuide(lesson.id)}>
                            <FileText size={16} />
                            Guide
                          </button>
                          <button disabled={complete || locked} onClick={() => completeMission(lesson.id)}>
                            <CheckCircle2 size={16} />
                            {complete ? "Done" : "Mark"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {focusedLessonGuide && (
                  <aside className="mission-guide">
                    <div className="mission-guide-heading">
                      <span>{lessonLevelLabel(focusedLessonGuide.lesson.level)}</span>
                      <strong>{focusedLessonGuide.lesson.title}</strong>
                      <p>{focusedLessonGuide.lesson.goal}</p>
                    </div>
                    {focusedMissionItem?.status === "locked" && focusedMissionItem.lockedBy && (
                      <div className="mission-unlock-note">
                        <LockKeyhole size={16} />
                        <span>
                          <strong>Locked in the student path</strong>
                          Finish {focusedMissionItem.lockedBy.title} before launching this mission.
                        </span>
                      </div>
                    )}
                    <div className="mission-guide-stats">
                      <span>
                        <strong>{focusedLessonGuide.minutes}</strong>
                        min
                      </span>
                      <span>
                        <strong>{focusedLessonGuide.partCount}</strong>
                        parts
                      </span>
                      <span>
                        <strong>{focusedLessonGuide.wiringCount}</strong>
                        wires
                      </span>
                      <span>
                        <strong>{focusedLessonGuide.blockCount}</strong>
                        blocks
                      </span>
                    </div>
                    <div className="mission-guide-actions">
                      <button disabled={focusedMissionItem?.status === "locked"} onClick={() => launchLesson(focusedLessonGuide.lesson.id)}>
                        {focusedMissionItem?.status === "locked" ? <LockKeyhole size={16} /> : <Play size={16} />}
                        {focusedMissionItem?.status === "locked" ? "Locked" : "Launch"}
                      </button>
                      <button onClick={() => exportLessonBuildGuide(focusedLessonGuide.lesson.id)}>
                        <FileText size={16} />
                        Build guide
                      </button>
                    </div>
                    <div className="mission-guide-grid">
                      <section>
                        <h3>Materials</h3>
                        <ul>
                          {focusedLessonGuide.materials.map((material) => (
                            <li key={material}>{material}</li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h3>Concepts</h3>
                        <div className="mission-chip-list">
                          {focusedLessonGuide.concepts.map((concept) => (
                            <span key={concept}>{concept}</span>
                          ))}
                        </div>
                      </section>
                    </div>
                    {focusedLessonGuide.libraries.length > 0 && (
                      <section className="mission-guide-section">
                        <h3>Libraries</h3>
                        <div className="mission-chip-list">
                          {focusedLessonGuide.libraries.map((library) => (
                            <span key={library}>{library}</span>
                          ))}
                        </div>
                      </section>
                    )}
                    <section className="mission-guide-section">
                      <h3>Activity Steps</h3>
                      <div className="mission-step-list">
                        {focusedLessonGuide.steps.map((step, index) => (
                          <article className={`mission-step ${step.action ?? "step"}`} key={`${step.title}-${index}`}>
                            <span>{lessonActionLabel(step.action)}</span>
                            <strong>{step.title}</strong>
                            <p>{step.detail}</p>
                            {step.checklist && step.checklist.length > 0 && (
                              <ul>
                                {step.checklist.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    </section>
                    <section className="mission-guide-section">
                      <h3>Success Looks Like</h3>
                      <ul>
                        {focusedLessonGuide.success.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    {focusedLessonGuide.teacherNotes.length > 0 && (
                      <section className="mission-guide-section teacher-note">
                        <h3>Teacher Notes</h3>
                        <ul>
                          {focusedLessonGuide.teacherNotes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </aside>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="right-panel">
          {mode === "blocks" && (
            <section className="panel-section launchpad-panel">
              <button className="launchpad-help" onClick={() => setMode("lessons")}>
                <span className="launchpad-play">
                  <Play size={17} />
                </span>
                <span>
                  <strong>New to Arduino Blocks?</strong>
                  <small>Open the first guided build and make the board do something real.</small>
                </span>
              </button>
              <div className="example-heading">
                <strong>Example projects</strong>
                <span>{starterCards.length}</span>
              </div>
              <div className="example-project-list">
                {starterCards.slice(0, 6).map((starter, index) => {
                  const active = project.name === starter.project.name;
                  return (
                    <button
                      className={`example-project-card ${active ? "active" : ""}`}
                      key={`example-${starter.id}`}
                      onClick={() => loadProject(starter.project)}
                    >
                      <span className="example-swatch">{index + 1}</span>
                      <span>
                        <strong>{starter.project.name}</strong>
                        <small>{starter.goal}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="panel-section coach-panel">
            <div className="section-heading">
              <h2>{projectCoach.title}</h2>
              <span>
                {projectCoach.doneCount}/{projectCoach.totalCount}
              </span>
            </div>
            <div className="coach-summary">
              <strong>{projectCoach.detail}</strong>
              <div className="coach-progress" aria-label="Project coach progress">
                <span style={{ width: `${projectCoach.progressPercent}%` }} />
              </div>
            </div>
            <div className="coach-steps">
              {projectCoach.steps.map((step) => (
                <div className={`coach-step ${step.state}`} key={step.id}>
                  {coachIcon(step.state)}
                  <span>
                    <strong>{step.label}</strong>
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-section wiring">
            <div className="section-heading wiring-heading">
              <h2>Wiring</h2>
              <div className="heading-actions">
                <button className="mini-action" disabled={!selectedBoard || project.components.length === 0} onClick={applyAutoPins}>
                  <Sparkles size={14} />
                  Auto pins
                </button>
                <span>{selectedBoard?.name}</span>
              </div>
            </div>
            <div className={`repair-card ${wiringRepairTone}`}>
              <div className="repair-card-heading">
                <span className="repair-badge">{wiringRepairIcon(wiringRepairTone)}</span>
                <span className="repair-title">
                  <strong>{wiringRepairPlan.title}</strong>
                  {wiringRepairPlan.detail}
                </span>
                {wiringRepairPlan.autoFixAvailable && (
                  <button className="mini-action repair-action" onClick={applyAutoPins}>
                    <Sparkles size={14} />
                    Repair pins
                  </button>
                )}
              </div>
              <div className="repair-items">
                {wiringRepairPlan.items.slice(0, 4).map((item) => (
                  <div className={`repair-item ${item.tone}`} key={item.id}>
                    {wiringRepairIcon(item.tone)}
                    <span>
                      <strong>{item.title}</strong>
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`diagnostics-block ${criticalWiringCount > 0 ? "has-warnings" : ""}`}>
              <div className="diagnostics-heading">
                <strong>Checks</strong>
                <span>{criticalWiringCount > 0 ? `${criticalWiringCount} note${criticalWiringCount === 1 ? "" : "s"}` : "ready"}</span>
              </div>
              {wiringDiagnostics.length === 0 ? (
                <div className="diagnostic-row ok">
                  <Sparkles size={16} />
                  <span>Pin map ready.</span>
                </div>
              ) : (
                wiringDiagnostics.slice(0, 5).map((diagnostic) => (
                  <div className={`diagnostic-row ${diagnostic.severity}`} key={`${diagnostic.title}-${diagnostic.message}`}>
                    {diagnostic.severity === "tip" ? <Sparkles size={16} /> : <AlertTriangle size={16} />}
                    <span>
                      <strong>{diagnostic.title}</strong>
                      {diagnostic.message}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="wiring-canvas-card" aria-label="Visual wiring canvas">
              <div className="canvas-heading">
                <strong>Wire view</strong>
                <span>{wiringCanvasSummary}</span>
              </div>
              {wiringCanvas.connections.length === 0 ? (
                <div className="empty-row">No wires yet.</div>
              ) : (
                <div className="wire-rows">
                  {wiringCanvas.connections.map((connection) => (
                    <div
                      className={`wire-row ${connection.status} ${connection.boardPinKind}`}
                      key={connection.id}
                      title={`${connection.boardPinLabel} -> ${connection.componentLabel} ${connection.wireLabel}${connection.note ? `: ${connection.note}` : ""}`}
                    >
                      <span className={`board-terminal ${connection.boardPinKind}`}>{connection.boardPinLabel}</span>
                      <span className="wire-line" aria-hidden="true">
                        <span />
                      </span>
                      <span className="component-terminal">
                        <strong>{connection.componentLabel}</strong>
                        <small>
                          {connection.wireLabel}: {connection.wireFrom}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pin-map" aria-label="Board pin usage">
              {boardPinUsage.map((pin) => (
                <span
                  className={`pin-chip ${pin.kind} ${pin.usedBy.length > 0 ? "used" : ""} ${pin.conflict ? "conflict" : ""} ${pin.reserved ? "reserved" : ""}`}
                  key={`${pin.kind}-${pin.pin}`}
                  title={pin.usedBy.length > 0 ? pin.usedBy.join(", ") : pin.reserved ? "Serial pin; avoid when possible." : "Free pin"}
                >
                  <strong>{pin.label}</strong>
                  {pin.usedBy.length > 0 && <small>{pin.usedBy.length}</small>}
                </span>
              ))}
            </div>
            {project.components.map((instance) => {
              const definition = componentDefinition(instance, activeCatalog.components);
              return (
                <div className="wiring-block" key={instance.id}>
                  <strong>{instance.label}</strong>
                  {(definition?.wiring ?? []).slice(0, 4).map((wire) => (
                    <span key={`${instance.id}-${wire.label}`}>
                      {wire.label}: {wire.to.replace(/\{\{pins\.([a-zA-Z0-9_]+)\}\}/g, (_, pin: string) => String(instance.pins[pin] ?? ""))}
                    </span>
                  ))}
                </div>
              );
            })}
          </section>

          <section className="panel-section pack-panel">
            <div className="section-heading">
              <h2>Packs</h2>
              <span>{extensionPacks.length + 1}</span>
            </div>
            <div className="pack-list">
              <div className="pack-row builtin">
                <div>
                  <strong>Built-in Starter Kit</strong>
                  <span>Uno, Nano, Mega · {defaultCatalog.components.length} parts</span>
                </div>
              </div>
              {extensionPacks.map((pack) => (
                <div className="pack-row" key={pack.id}>
                  <div>
                    <strong>{pack.name}</strong>
                    <span>
                      {pack.version} · {pack.manifest.components?.length ?? 0} parts
                    </span>
                  </div>
                  <button title={`Remove ${pack.name}`} onClick={() => removeExtensionPack(pack.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="gallery-block">
              <div className="gallery-heading">
                <strong>Gallery</strong>
                <span>{packGalleryStatus}</span>
              </div>
              <div className="gallery-list">
                {packGallery.length === 0 ? (
                  <div className="empty-row">{packGalleryStatus}</div>
                ) : (
                  packGallery.map((entry) => {
                    const installed = installedPackIds.has(entry.id);
                    return (
                      <div className={`gallery-card ${installed ? "installed" : ""}`} key={entry.id}>
                        <div>
                          <strong>{entry.name}</strong>
                          <p>{entry.description}</p>
                          <span>
                            {entry.componentCount ?? 0} parts · {entry.lessonCount ?? 0} lessons
                          </span>
                          {entry.tags.length > 0 && (
                            <div className="gallery-tags">
                              {entry.tags.slice(0, 3).map((tag) => (
                                <small key={`${entry.id}-${tag}`}>{tag}</small>
                              ))}
                            </div>
                          )}
                        </div>
                        <button disabled={packUrlBusy || installed} onClick={() => importGalleryPack(entry)} title={`Install ${entry.name}`}>
                          {installed ? <CheckCircle2 size={15} /> : <PackagePlus size={15} />}
                          {installed ? "Installed" : "Install"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <label className="pack-url-field">
              <span>Pack URL</span>
              <div className="pack-url-row">
                <input
                  aria-label="Hardware pack URL"
                  value={packUrl}
                  disabled={packUrlBusy}
                  onChange={(event) => setPackUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void importExtensionPackFromUrl();
                  }}
                  placeholder="GitHub or raw JSON URL"
                />
                <button title="Install pack from URL" disabled={packUrlBusy || !packUrl.trim()} onClick={() => void importExtensionPackFromUrl()}>
                  <PackagePlus size={15} />
                </button>
              </div>
            </label>
            <div className="pack-actions">
              <button onClick={() => extensionInputRef.current?.click()}>
                <PackagePlus size={16} />
                Import
              </button>
              <button disabled={extensionPacks.length === 0} onClick={resetExtensionPacks}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </section>

          <section className="panel-section agent">
            <div className="section-heading">
              <h2>Board</h2>
              <span>{agentOnline ? "ready" : "local"}</span>
            </div>
            <div className="agent-setup-card">
              <span>
                <strong>Local agent setup</strong>
                Compile, upload, detect USB boards, and read serial from the public site.
              </span>
              <div className="agent-setup-actions">
                <button onClick={() => setAgentSetupOpen(true)}>
                  <Cable size={15} />
                  Setup
                </button>
                <a href={AGENT_STATUS_URL} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  Status
                </a>
              </div>
            </div>
            <div className={`upload-readiness ${uploadReadiness.readyToUpload ? "ready" : uploadReadiness.readyToCompile ? "compile" : "blocked"}`}>
              <div className="readiness-summary">
                <strong>{uploadReadiness.title}</strong>
                <span>{uploadReadiness.detail}</span>
              </div>
              <div className="readiness-list">
                {uploadReadiness.items.map((item) => (
                  <div className={`readiness-item ${item.state}`} key={item.id}>
                    {readinessIcon(item.state)}
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="device-flow">
              <div className="device-flow-heading">
                <span>
                  <strong>{deviceWorkflow.title}</strong>
                  {deviceWorkflow.detail}
                </span>
                <button disabled={workflowActionDisabled(deviceWorkflow.nextAction)} onClick={() => runWorkflowAction(deviceWorkflow.nextAction)}>
                  <Play size={15} />
                  {deviceWorkflow.nextLabel}
                </button>
              </div>
              <div className="device-flow-progress" aria-label="Real board setup progress">
                <span style={{ width: `${deviceWorkflow.progress}%` }} />
              </div>
              <div className="device-flow-steps">
                {deviceWorkflow.steps.map((step) => (
                  <div className={`device-flow-step ${step.state}`} key={step.id}>
                    {workflowIcon(step.state)}
                    <span>
                      <strong>{step.label}</strong>
                      {step.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`connection-doctor ${connectionDoctor.severity}`}>
              <div className="connection-doctor-heading">
                <span className="doctor-badge">{doctorIcon(connectionDoctor.severity)}</span>
                <span>
                  <strong>Connection Doctor</strong>
                  {connectionDoctor.title}
                </span>
                <button disabled={doctorActionDisabled(connectionDoctor.action)} onClick={() => runDoctorAction(connectionDoctor.action)}>
                  <Play size={15} />
                  {connectionDoctor.actionLabel}
                </button>
              </div>
              <p>{connectionDoctor.summary}</p>
              <div className="doctor-fix">
                <Sparkles size={14} />
                <span>{connectionDoctor.fix}</span>
              </div>
              {connectionDoctor.evidence && <code>{connectionDoctor.evidence}</code>}
            </div>
            <label className="fqbn-field">
              <span>Upload target FQBN</span>
              <input value={selectedFqbn} onChange={(event) => setSelectedFqbn(event.target.value)} placeholder="arduino:avr:uno" />
            </label>
            <div className={`board-core-note ${coreReady ? "ready" : selectedCore ? "pending" : "blocked"}`}>
              <Cpu size={16} />
              <span>
                <strong>{selectedCore || "Board core"}</strong>
                {selectedCore
                  ? coreReady
                    ? "Prepared for this computer."
                    : "Prepare before class, or let compile install it automatically."
                  : "Use a full target like arduino:avr:uno."}
              </span>
            </div>
            <div className="package-index-panel">
              <div className="package-index-heading">
                <span>
                  <strong>Board package indexes</strong>
                  {packageIndexNeeded
                    ? packageIndexReady
                      ? `${selectedPackageIndexPreset?.label} is configured.`
                      : `${selectedPackageIndexPreset?.label} needs an extra Boards Manager URL.`
                    : "Add ESP32, Pico, Adafruit, or other board families."}
                </span>
                <span>{configuredPackageIndexes.length}</span>
              </div>
              {packageIndexSuggestions.length > 0 && (
                <div className="package-index-presets">
                  {packageIndexSuggestions.map((preset) => {
                    const configured = configuredPackageIndexes.includes(preset.url);
                    const running = activePackageIndexState === "running" && packageIndexActionTarget === preset.url;
                    return (
                      <button
                        className={configured ? "ready" : ""}
                        disabled={!agentOnline || !cliStatus?.available || configured || activePackageIndexState === "running"}
                        key={preset.id}
                        onClick={() => void addPackageIndexPreset(preset)}
                        title={preset.url}
                      >
                        <Globe2 size={15} />
                        <span>
                          <strong>{preset.label}</strong>
                          {preset.maker}
                        </span>
                        <small>{configured ? "Ready" : running ? "Adding" : "Add"}</small>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="package-index-custom">
                <input
                  aria-label="Custom Boards Manager package URL"
                  value={packageIndexInput}
                  onChange={(event) => setPackageIndexInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void addPackageIndexes(packageIndexInputUrls);
                  }}
                  placeholder="Paste package JSON URL"
                />
                <button
                  disabled={!agentOnline || !cliStatus?.available || packageIndexInputUrls.length === 0 || activePackageIndexState === "running"}
                  onClick={() => void addPackageIndexes(packageIndexInputUrls)}
                  title="Add custom Boards Manager URL"
                >
                  <PackagePlus size={15} />
                </button>
              </div>
            </div>
            <div className="board-search">
              <input value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} placeholder="Search boards, e.g. nano esp32 mega" />
              <button disabled={workflowActionDisabled("search-target")} title="Search all Arduino CLI boards" onClick={searchBoards}>
                <Search size={16} />
              </button>
            </div>
            {boardTargets.length > 0 && (
              <select aria-label="Board target search results" value="" onChange={(event) => setSelectedFqbn(event.target.value)}>
                <option value="">Use searched board target</option>
                {boardTargets.map((target) => (
                  <option value={target.fqbn} key={target.fqbn}>
                    {target.name} · {target.fqbn}
                  </option>
                ))}
              </select>
            )}
            <div className="agent-actions">
              <button disabled={workflowActionDisabled("detect")} onClick={detectBoards}>
                <PlugZap size={16} />
                Detect
              </button>
              <button disabled={workflowActionDisabled("install-core")} title={selectedCore ? `Prepare ${selectedCore}` : "Choose a full FQBN first"} onClick={installCore}>
                <Cpu size={16} />
                {coreReady ? "Core ready" : activeCoreState === "running" ? "Preparing" : "Core"}
              </button>
              <button disabled={workflowActionDisabled("install-libraries")} onClick={installLibraries}>
                <Library size={16} />
                Libraries
              </button>
              <button disabled={workflowActionDisabled("compile")} onClick={compileSketch}>
                <Terminal size={16} />
                Compile
              </button>
              <button disabled={workflowActionDisabled("upload")} onClick={uploadSketch}>
                <Send size={16} />
                Upload
              </button>
              <button disabled={workflowActionDisabled("monitor")} onClick={toggleSerialMonitor}>
                <RadioTower size={16} />
                {serialOpen ? "Close" : "Monitor"}
              </button>
            </div>
            <select
              aria-label="Detected port"
              value={selectedPort}
              onChange={(event) => {
                const nextPort = event.target.value;
                setSelectedPort(nextPort);
                const match = ports.find((port) => port.address === nextPort);
                if (match?.fqbn) setSelectedFqbn(match.fqbn);
              }}
            >
              <option value="">Select port</option>
              {ports.map((port) => (
                <option value={port.address} key={port.address}>
                  {port.address} · {port.label}
                </option>
              ))}
            </select>
            <div className="serial-console">
              <div className="serial-console-heading">
                <strong>
                  <MessageSquareText size={15} />
                  Serial console
                </strong>
                <span>{serialOpen ? "open" : "closed"}</span>
              </div>
              <div className="serial-settings">
                <label>
                  <span>Baud</span>
                  <input
                    list="serial-baud-rates"
                    inputMode="numeric"
                    value={serialBaudRate}
                    onChange={(event) => setSerialBaudRate(event.target.value)}
                    disabled={serialOpen}
                  />
                </label>
                <datalist id="serial-baud-rates">
                  {commonBaudRates.map((rate) => (
                    <option value={rate} key={rate} />
                  ))}
                </datalist>
                <label>
                  <span>Ending</span>
                  <select value={serialLineEnding} onChange={(event) => setSerialLineEnding(event.target.value as SerialLineEnding)}>
                    <option value="newline">Newline</option>
                    <option value="both">Both NL + CR</option>
                    <option value="carriage-return">Carriage return</option>
                    <option value="none">No ending</option>
                  </select>
                </label>
              </div>
              <div className="serial-send-row">
                <input
                  aria-label="Serial message"
                  value={serialInput}
                  onChange={(event) => setSerialInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void sendSerialMessage();
                  }}
                  placeholder="Send command"
                  disabled={!serialOpen}
                />
                <button title="Send serial message" disabled={!serialOpen || !serialInput} onClick={() => void sendSerialMessage()}>
                  <Send size={15} />
                </button>
                <button title="Clear serial transcript" onClick={() => setSerialTranscript([])}>
                  <Eraser size={15} />
                </button>
              </div>
              <div className="serial-transcript" aria-label="Serial transcript">
                {serialTranscript.length === 0 ? (
                  <span>No serial messages yet.</span>
                ) : (
                  serialTranscript.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)
                )}
              </div>
            </div>
            <div className="agent-log">
              {agentLog.map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {newProjectOpen && (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setNewProjectOpen(false)}>
          <section className="new-project-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close new project" onClick={() => setNewProjectOpen(false)}>
              <X size={24} />
            </button>
            <span className="modal-kicker">New Project</span>
            <h2 id="new-project-title">Project 1</h2>
            <div className="project-style-cards" role="radiogroup" aria-label="Choose coding style">
              {projectStyleOptions.map((option) => (
                <button
                  className={`project-style-card ${newProjectStyle === option.id ? "active" : ""}`}
                  key={option.id}
                  onClick={() => setNewProjectStyle(option.id)}
                  role="radio"
                  aria-checked={newProjectStyle === option.id}
                >
                  <span className="project-style-icon">
                    {option.id === "code" ? <Code2 size={30} /> : <SquareStack size={30} />}
                  </span>
                  <strong>{option.title}</strong>
                  <small>{option.kicker}</small>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
            <button className="create-project-button" onClick={createNewProject}>
              Create
            </button>
          </section>
        </div>
      )}

      {agentSetupOpen && (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setAgentSetupOpen(false)}>
          <section className="agent-setup-modal" role="dialog" aria-modal="true" aria-labelledby="agent-setup-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close agent setup" onClick={() => setAgentSetupOpen(false)}>
              <X size={24} />
            </button>
            <span className="modal-kicker">Local Agent</span>
            <h2 id="agent-setup-title">Program real Arduino boards</h2>
            <p>
              The public web app talks to a tiny localhost helper. Keep the helper running while you detect boards, compile, upload, or use the serial monitor.
            </p>
            <div className="agent-platform-tabs" role="tablist" aria-label="Choose setup platform">
              {agentSetupPlatforms.map((platform) => (
                <button
                  className={agentSetupPlatform === platform.id ? "active" : ""}
                  key={platform.id}
                  role="tab"
                  aria-selected={agentSetupPlatform === platform.id}
                  onClick={() => setAgentSetupPlatform(platform.id)}
                >
                  {platform.label}
                </button>
              ))}
            </div>
            <div className="agent-copy-all">
              <button onClick={() => void copyAgentSetupText(agentSetupScript, `${agentSetupPlatform} setup commands`)}>
                <Clipboard size={15} />
                Copy all commands
              </button>
              <a href={agentSetupDocsUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={15} />
                Full setup doc
              </a>
            </div>
            <div className="agent-setup-steps">
              {agentSetupSteps.map((step, index) => (
                <article className="agent-setup-step" key={step.id}>
                  <em>{index + 1}</em>
                  <span>
                    <strong>{step.title}</strong>
                    {step.detail}
                    {step.command && <code>{step.command}</code>}
                  </span>
                  {step.command && (
                    <button title={`Copy ${step.title}`} onClick={() => void copyAgentSetupText(step.command!, step.title)}>
                      <Clipboard size={15} />
                    </button>
                  )}
                </article>
              ))}
            </div>
            <div className="agent-setup-check">
              <strong>When it is running</strong>
              <span>Return to the Board panel and click Check agent. The status should move from offline to Agent + CLI ready.</span>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
