import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  Cable,
  CheckCircle2,
  Code2,
  Cpu,
  Download,
  FolderOpen,
  Gauge,
  Globe2,
  Library,
  Medal,
  PackagePlus,
  Play,
  PlugZap,
  RadioTower,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  SquareStack,
  Terminal,
  Trash2,
  Upload,
  AlertTriangle
} from "lucide-react";
import type { Catalog, ComponentDefinition, ComponentInstance, ProjectDocument, ProgramStep } from "@abl/block-schema";
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
import { agentHealth, agentRpc, openAgentEvents } from "./agentClient";
import { projectToBlocklyXml } from "./projectXml";
import { collectWiringDiagnostics } from "./wiringDiagnostics";
import { createWokwiDiagram, unsupportedWokwiComponents } from "./wokwiExport";
import { importedPackFromManifest, parseStoredExtensionPacks, serializeExtensionPacks, type ImportedExtensionPack } from "./extensionPacks";

type Mode = "blocks" | "code" | "lessons";
type CodeView = "cpp" | "python" | "javascript";

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

type AgentCliStatus = {
  available: boolean;
  cli: string;
  error?: string;
};

const missionProgressKey = "abl.missionProgress.v1";
const extensionPacksKey = "abl.extensionPacks.v1";

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
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

function describeStep(step: ProgramStep): string {
  switch (step.kind) {
    case "digital-write":
      return `set digital output ${step.componentId ?? step.pin} to ${step.value}`;
    case "analog-write":
      return `set PWM output ${step.componentId ?? step.pin} to ${step.value}`;
    case "delay":
      return `wait ${step.ms} ms`;
    case "serial-print":
      return `print ${JSON.stringify(step.value)}`;
    case "button-controls-led":
      return "button controls LED";
    case "potentiometer-controls-servo":
      return "map knob value to servo angle";
    case "servo-write":
      return `set servo angle to ${step.angle}`;
    case "rgb-write":
      return `set RGB color to ${step.red}, ${step.green}, ${step.blue}`;
    case "ultrasonic-serial":
      return "measure distance and print centimeters";
    case "dht-serial":
      return "read temperature and humidity";
    case "lcd-print":
      return `print ${JSON.stringify(step.text)} on LCD`;
    case "oled-print":
      return `print ${JSON.stringify(step.text)} on OLED`;
    case "neopixel-fill":
      return `fill NeoPixels with ${step.red}, ${step.green}, ${step.blue}`;
    case "tone":
      return `play ${step.frequency} Hz tone`;
    case "relay-write":
      return `set relay to ${step.value}`;
    case "read-analog-serial":
      return "read analog value and print it";
    case "read-digital-serial":
      return "read digital value and print it";
    case "ir-read-serial":
      return "read IR code and print it";
    default:
      return "run block";
  }
}

function learningPreview(project: ProjectDocument, language: Exclude<CodeView, "cpp">, catalog: Catalog): string {
  const board = boardName(project.boardId, catalog);
  const steps = project.program.map((step) =>
    describeStep(step)
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

export default function App() {
  const [extensionPacks, setExtensionPacks] = useState<ImportedExtensionPack[]>(loadExtensionPacks);
  const [project, setProject] = useState<ProjectDocument>(() => cloneProject(starterProjects.blink));
  const [mode, setMode] = useState<Mode>("blocks");
  const [codeView, setCodeView] = useState<CodeView>("cpp");
  const [reloadKey, setReloadKey] = useState(() => crypto.randomUUID());
  const [agentOnline, setAgentOnline] = useState(false);
  const [cliStatus, setCliStatus] = useState<AgentCliStatus | null>(null);
  const [agentLog, setAgentLog] = useState<string[]>(["Agent not checked yet."]);
  const [ports, setPorts] = useState<DetectedPort[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [selectedFqbn, setSelectedFqbn] = useState(defaultBoards[0]?.fqbn ?? "");
  const [boardSearch, setBoardSearch] = useState("");
  const [boardTargets, setBoardTargets] = useState<BoardTarget[]>([]);
  const [serialOpen, setSerialOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ComponentDefinition["category"]>("output");
  const [componentSearch, setComponentSearch] = useState("");
  const [missionProgress, setMissionProgress] = useState<Record<string, boolean>>(loadMissionProgress);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const extensionInputRef = useRef<HTMLInputElement | null>(null);

  const activeCatalog = useMemo(() => {
    return extensionPacks.reduce((current, pack) => mergeExtensionManifest(current, pack.manifest).catalog, defaultCatalog);
  }, [extensionPacks]);
  const generated = useMemo(() => generateSketch(project, activeCatalog), [project, activeCatalog]);
  const editorCode = codeView === "cpp" ? generated.code : learningPreview(project, codeView, activeCatalog);
  const editorLanguage = codeView === "cpp" ? "cpp" : codeView;
  const selectedBoard = activeCatalog.boards.find((board) => board.id === project.boardId) ?? activeCatalog.boards[0];
  const effectiveFqbn = targetLabel(project.boardId, selectedFqbn, activeCatalog);
  const externalLibraries = libraryNames(project, activeCatalog);
  const wiringDiagnostics = useMemo(() => collectWiringDiagnostics(project, selectedBoard, activeCatalog.components), [project, selectedBoard, activeCatalog.components]);
  const criticalWiringCount = wiringDiagnostics.filter((diagnostic) => diagnostic.severity !== "tip").length;
  const completedMissionCount = activeCatalog.lessons.filter((lesson) => missionProgress[lesson.id]).length;
  const nextMission = activeCatalog.lessons.find((lesson) => !missionProgress[lesson.id]) ?? activeCatalog.lessons[0];
  const visibleComponents = useMemo(() => {
    const query = componentSearch.trim().toLowerCase();
    const pool = query ? activeCatalog.components : byCategory(activeCatalog.components, selectedCategory);
    if (!query) return pool;
    return pool.filter((component) =>
      [component.name, component.description, component.category, component.id].join(" ").toLowerCase().includes(query)
    );
  }, [activeCatalog.components, componentSearch, selectedCategory]);

  const updateFromBlocks = useCallback((program: ProgramStep[], blocksXml: string) => {
    setProject((current) => ({
      ...current,
      program,
      blocksXml,
      generatedSketch: generateSketch({ ...current, program, blocksXml }, activeCatalog).code
    }));
  }, [activeCatalog]);

  useEffect(() => {
    agentHealth().then(async (ok) => {
      setAgentOnline(ok);
      if (!ok) {
        setAgentLog(["Agent is offline. Run npm run dev:agent or npm run dev."]);
        return;
      }
      const status = await agentRpc<AgentCliStatus>("agent.status");
      setCliStatus(status.ok && status.data ? status.data : { available: false, cli: "arduino-cli", error: status.error });
      setAgentLog([
        status.ok && status.data?.available
          ? `Agent connected. Arduino CLI ready at ${status.data.cli}.`
          : `Agent connected, but Arduino CLI is not ready: ${status.error ?? status.data?.error ?? "unknown error"}`
      ]);
    });
  }, []);

  useEffect(() => {
    if (!agentOnline) return;
    const socket = openAgentEvents((message) => {
      const payload = message as { type?: string; data?: string; port?: string };
      if (payload.type?.startsWith("serial.")) {
        setAgentLog((current) => [`${payload.port ?? "serial"}: ${payload.data ?? payload.type}`, ...current].slice(0, 80));
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

  function loadProject(nextProject: ProjectDocument) {
    setProject(cloneProject(nextProject));
    setReloadKey(crypto.randomUUID());
    setMode("blocks");
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
    setMissionProgress((current) => ({ ...current, [lessonId]: true }));
  }

  function resetMissionProgress() {
    setMissionProgress({});
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

  async function installLibraries() {
    const names = externalLibraries;
    if (names.length === 0) {
      setAgentLog((current) => ["No external libraries needed for this sketch.", ...current]);
      return;
    }
    const response = await agentRpc("libraries.install", { libraries: names });
    setAgentLog((current) => [response.ok ? `Installed libraries: ${names.join(", ")}` : `Library install failed: ${response.error}`, ...current]);
  }

  async function compileSketch() {
    const response = await agentRpc("sketch.compile", {
      name: project.name,
      boardId: project.boardId,
      fqbn: effectiveFqbn,
      libraries: externalLibraries,
      code: generated.code
    });
    setAgentLog((current) => [response.ok ? "Compile finished." : `Compile failed: ${response.error}`, ...current]);
  }

  async function uploadSketch() {
    const response = await agentRpc("sketch.upload", {
      name: project.name,
      boardId: project.boardId,
      fqbn: effectiveFqbn,
      libraries: externalLibraries,
      port: selectedPort,
      code: generated.code
    });
    setAgentLog((current) => [response.ok ? `Upload finished on ${selectedPort}.` : `Upload failed: ${response.error}`, ...current]);
  }

  async function toggleSerialMonitor() {
    if (!selectedPort) return;
    const response = await agentRpc(serialOpen ? "serial.close" : "serial.open", {
      port: selectedPort,
      fqbn: effectiveFqbn
    });
    if (response.ok) setSerialOpen(!serialOpen);
    setAgentLog((current) => [
      response.ok ? `${serialOpen ? "Closed" : "Opened"} serial monitor on ${selectedPort}.` : `Serial monitor failed: ${response.error}`,
      ...current
    ]);
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

  async function exportWokwiProject() {
    const zip = new JSZip();
    const unsupported = unsupportedWokwiComponents(project, activeCatalog.components);
    zip.file("sketch.ino", generated.code);
    zip.file("diagram.json", JSON.stringify(createWokwiDiagram(project), null, 2));
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
      const manifest = result.manifest;

      const replacement = extensionPacks.some((pack) => pack.id === manifest.id);
      const warnings = mergeExtensionManifest(activeCatalog, manifest).warnings;
      setExtensionPacks((current) => [
        ...current.filter((pack) => pack.id !== manifest.id),
        importedPackFromManifest(manifest)
      ]);
      setAgentLog((current) => [
        `${replacement ? "Updated" : "Imported"} hardware pack ${manifest.name} (${manifest.components?.length ?? 0} component${manifest.components?.length === 1 ? "" : "s"}).`,
        ...warnings,
        ...current
      ]);
    } catch (error) {
      setAgentLog((current) => [`Hardware pack import failed: ${error instanceof Error ? error.message : "invalid JSON"}`, ...current]);
    }
  }

  return (
    <main className="app-shell">
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

        <div className="mode-tabs" role="tablist" aria-label="Editor modes">
          <button className={mode === "blocks" ? "active" : ""} onClick={() => setMode("blocks")}>
            <SquareStack size={18} />
            Blocks
          </button>
          <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}>
            <Code2 size={18} />
            Arduino C++
          </button>
          <button className={mode === "lessons" ? "active" : ""} onClick={() => setMode("lessons")}>
            <Gauge size={18} />
            Lessons
          </button>
        </div>

        <div className="toolbar">
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
          <button title="Download sketch" onClick={exportSketch}>
            <Download size={18} />
          </button>
          <button title="Download Wokwi project" onClick={() => void exportWokwiProject()}>
            <Globe2 size={18} />
          </button>
          <button title="Import hardware pack" onClick={() => extensionInputRef.current?.click()}>
            <PackagePlus size={18} />
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
        {generated.warnings.map((warning) => (
          <span className="warning" key={warning}>
            {warning}
          </span>
        ))}
      </section>

      <div className="workspace-grid">
        <aside className="left-panel">
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
            <BlocklyWorkspace
              components={project.components}
              componentDefinitions={activeCatalog.components}
              xml={project.blocksXml ?? projectToBlocklyXml(project)}
              reloadKey={reloadKey}
              onChange={updateFromBlocks}
            />
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
                theme="vs-light"
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

          {mode === "lessons" && (
            <div className="lessons-panel mission-panel">
              <div className="mission-hero">
                <div>
                  <span>Mission path</span>
                  <strong>
                    {completedMissionCount}/{activeCatalog.lessons.length} complete
                  </strong>
                </div>
                <div className="mission-progress" aria-label="Mission progress">
                  <span style={{ width: `${(completedMissionCount / Math.max(activeCatalog.lessons.length, 1)) * 100}%` }} />
                </div>
                <div className="mission-actions">
                  <button onClick={() => nextMission && loadProject({ ...nextMission.starterProject, lessonId: nextMission.id })}>
                    <Play size={16} />
                    Next
                  </button>
                  <button onClick={resetMissionProgress}>
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </div>
              </div>

              <div className="mission-track">
                {activeCatalog.lessons.map((lesson, index) => {
                  const complete = Boolean(missionProgress[lesson.id]);
                  const active = project.lessonId === lesson.id;
                  return (
                    <div className={`mission-card ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={lesson.id}>
                      <div className="mission-node">
                        {complete ? <Medal size={20} /> : <span>{index + 1}</span>}
                      </div>
                      <div className="mission-copy">
                        <span>{lesson.level}</span>
                        <strong>{lesson.title}</strong>
                        <p>{lesson.goal}</p>
                      </div>
                      <div className="mission-card-actions">
                        <button onClick={() => loadProject({ ...lesson.starterProject, lessonId: lesson.id })}>
                          <Play size={16} />
                          Launch
                        </button>
                        <button disabled={complete} onClick={() => completeMission(lesson.id)}>
                          <CheckCircle2 size={16} />
                          {complete ? "Done" : "Mark"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <aside className="right-panel">
          <section className="panel-section wiring">
            <div className="section-heading">
              <h2>Wiring</h2>
              <span>{selectedBoard?.name}</span>
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
            <label className="fqbn-field">
              <span>Upload target FQBN</span>
              <input value={selectedFqbn} onChange={(event) => setSelectedFqbn(event.target.value)} placeholder="arduino:avr:uno" />
            </label>
            <div className="board-search">
              <input value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} placeholder="Search boards, e.g. nano esp32 mega" />
              <button title="Search all Arduino CLI boards" onClick={searchBoards}>
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
              <button onClick={detectBoards}>
                <PlugZap size={16} />
                Detect
              </button>
              <button onClick={installLibraries}>
                <Library size={16} />
                Libraries
              </button>
              <button onClick={compileSketch}>
                <Terminal size={16} />
                Compile
              </button>
              <button disabled={!selectedPort} onClick={uploadSketch}>
                <Send size={16} />
                Upload
              </button>
              <button disabled={!selectedPort} onClick={toggleSerialMonitor}>
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
            <div className="agent-log">
              {agentLog.map((line, index) => (
                <span key={`${line}-${index}`}>{line}</span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
