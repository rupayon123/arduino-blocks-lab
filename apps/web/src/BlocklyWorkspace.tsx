import { useCallback, useEffect, useRef, useState } from "react";
import * as Blockly from "blockly/core";
import type { ComponentDefinition, ComponentInstance, ProgramStep } from "@abl/block-schema";
import { registerArduinoBlocks, setBlocklyComponentDefinitionProvider, setBlocklyComponentProvider, toolbox } from "./blocklyBlocks";
import { workspaceToProgram } from "./workspaceToProgram";
import type { ThemePreference } from "./theme";

type Props = {
  components: ComponentInstance[];
  componentDefinitions: ComponentDefinition[];
  xml: string;
  reloadKey: string;
  themePreference: ThemePreference;
  onChange: (program: ProgramStep[], blocksXml: string) => void;
};

const lightBlocklyTheme = Blockly.Theme.defineTheme("ablLight", {
  name: "ablLight",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#fbfdff",
    toolboxBackgroundColour: "#fffefd",
    toolboxForegroundColour: "#193142",
    flyoutBackgroundColour: "#fffefd",
    flyoutForegroundColour: "#193142",
    scrollbarColour: "#8ad9ff",
    insertionMarkerColour: "#14a8e0",
    insertionMarkerOpacity: 0.36,
    cursorColour: "#1179ba",
    selectedGlowColour: "#14a8e0"
  }
});

const darkBlocklyTheme = Blockly.Theme.defineTheme("ablDark", {
  name: "ablDark",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#0c1c2b",
    toolboxBackgroundColour: "#102133",
    toolboxForegroundColour: "#eef9ff",
    flyoutBackgroundColour: "#14283b",
    flyoutForegroundColour: "#eef9ff",
    flyoutOpacity: 1,
    scrollbarColour: "#46c7f4",
    insertionMarkerColour: "#8ad9ff",
    insertionMarkerOpacity: 0.42,
    cursorColour: "#ffd56b",
    selectedGlowColour: "#8ad9ff"
  }
});

const emptyBlocklyXml = "<xml xmlns=\"https://developers.google.com/blockly/xml\"/>";
const visibleStackPosition = { x: "540", y: "56" };

function getKnownBlockTypes() {
  return new Set(
    Object.keys(Blockly.Blocks)
      .map((type) => ({
        type,
        spec: Blockly.Blocks[type]
      }))
      .filter((entry) => typeof entry.spec?.init === "function")
      .map((entry) => entry.type)
  );
}

function ensureVisibleTopBlock(dom: Element) {
  const topBlock = Array.from(dom.children).find((node) => node.tagName.toLowerCase() === "block");
  if (!topBlock) return false;

  let updated = false;
  if (!topBlock.hasAttribute("x")) {
    topBlock.setAttribute("x", visibleStackPosition.x);
    updated = true;
  }
  if (!topBlock.hasAttribute("y")) {
    topBlock.setAttribute("y", visibleStackPosition.y);
    updated = true;
  }
  return updated;
}

function sanitizeBlocklyXml(rawXml: string) {
  const trimmed = rawXml.trim();
  if (!trimmed) {
    return {
      xml: emptyBlocklyXml,
      warnings: [] as string[]
    };
  }

  let dom: Element;
  try {
    dom = Blockly.utils.xml.textToDom(trimmed);
  } catch {
    return {
      xml: emptyBlocklyXml,
      warnings: ["Blockly XML is invalid. Loading a blank workspace instead."]
    };
  }

  const knownBlockTypes = getKnownBlockTypes();
  const blockNodes = Array.from(dom.querySelectorAll("block"));
  if (blockNodes.length === 0) {
    return {
      xml: trimmed,
      warnings: []
    };
  }

  let removed = 0;
  ensureVisibleTopBlock(dom);
  for (const block of blockNodes) {
    const type = block.getAttribute("type");
    if (!type || knownBlockTypes.has(type)) continue;

    removed += 1;
    const nextBlock = block.querySelector("> next > block") as Element | null;

    if (nextBlock && block.parentNode) {
      block.parentNode.replaceChild(nextBlock, block);
      continue;
    }

    block.remove();
  }
  ensureVisibleTopBlock(dom);

  return {
    xml: Blockly.Xml.domToText(dom),
    warnings: removed > 0 ? [`Recovered from ${removed} unknown block${removed === 1 ? "" : "s"} in saved project.`] : []
  };
}

function blocklyThemeFor(themePreference: ThemePreference) {
  return themePreference === "dark" ? darkBlocklyTheme : lightBlocklyTheme;
}

function safeToolboxDefinition(): Blockly.utils.toolbox.ToolboxDefinition {
  const filteredCategories = toolbox.contents
    .map((category) => ({
      ...category,
      contents: category.contents.filter((entry) => entry.kind !== "block" || Boolean(Blockly.Blocks[entry.type]))
    }))
    .filter((category) => category.contents.length > 0)
    .map((category) => ({
      kind: "category",
      name: category.name,
      colour: category.colour,
      contents: category.contents
    }));

  if (filteredCategories.length === 0) {
    return {
      kind: "categoryToolbox",
      contents: [
        {
          kind: "category",
          name: "Blocks",
          colour: "#12a988",
          contents: [{ kind: "block", type: "abl_delay" }]
        }
      ]
    };
  }

  return {
    kind: "categoryToolbox",
    contents: filteredCategories
  } as Blockly.utils.toolbox.ToolboxDefinition;
}

export default function BlocklyWorkspace({ components, componentDefinitions, xml, reloadKey, themePreference, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  const syncFrameRef = useRef<number | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const lastWorkspaceXml = useRef<string>("");
  const lastLoadedXml = useRef<string>("");
  const lastReloadKey = useRef<string>("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const componentsRef = useRef(components);
  const componentDefinitionsRef = useRef(componentDefinitions);
  componentsRef.current = components;
  componentDefinitionsRef.current = componentDefinitions;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
        syncFrameRef.current = null;
      }
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  const syncProjectFromWorkspace = useCallback((workspace: Blockly.WorkspaceSvg) => {
    if (!mountedRef.current || loadingRef.current) return;
    try {
      const dom = Blockly.Xml.workspaceToDom(workspace);
      const blocksXml = Blockly.Xml.domToText(dom);
      if (blocksXml === lastWorkspaceXml.current) return;
      const nextProgram = workspaceToProgram(workspace, componentsRef.current);
      lastWorkspaceXml.current = blocksXml;
      lastLoadedXml.current = blocksXml;
      try {
        onChangeRef.current(nextProgram, blocksXml);
        setWorkspaceError(null);
      } catch (error) {
        console.error("Unable to sync blocks with project state.", error);
        setWorkspaceError("Blockly sync was interrupted and this project edit is being preserved.");
      }
    } catch (error) {
      console.error("Unable to sync workspace changes", error);
      setWorkspaceError("Blockly sync failed for this change. Try Recover blocks to keep going.");
    }
  }, []);

  const scheduleSync = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      if (!mountedRef.current) return;
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
      }
      syncFrameRef.current = window.requestAnimationFrame(() => {
        syncFrameRef.current = null;
        if (!mountedRef.current || workspaceRef.current !== workspace) return;
        syncProjectFromWorkspace(workspace);
      });
    },
    [syncProjectFromWorkspace]
  );

  const clearWorkspace = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    loadingRef.current = true;
    try {
      workspace.clear();
      lastWorkspaceXml.current = "";
      syncProjectFromWorkspace(workspace);
      setWorkspaceError(null);
    } finally {
      loadingRef.current = false;
    }
  }, [syncProjectFromWorkspace]);

  const syncWorkspaceRender = useCallback((workspace: Blockly.WorkspaceSvg) => {
    try {
      Blockly.svgResize(workspace);
    } catch (error) {
      console.error("Failed to resize Blockly workspace.", error);
    }
  }, []);

  const scheduleWorkspaceResize = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      if (!mountedRef.current) return;
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (!mountedRef.current || workspaceRef.current !== workspace) return;
        syncWorkspaceRender(workspace);
      });
    },
    [syncWorkspaceRender]
  );

  const focusLoadedStack = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      const firstBlock = workspace.getTopBlocks(false)[0];
      if (!firstBlock) return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!mountedRef.current || workspaceRef.current !== workspace) return;
          syncWorkspaceRender(workspace);
          workspace.centerOnBlock(firstBlock.id, true);
        });
      });
    },
    [syncWorkspaceRender]
  );

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
    registerArduinoBlocks();
    if (workspaceRef.current) {
      workspaceRef.current.dispose();
      workspaceRef.current = null;
    }
    lastWorkspaceXml.current = "";
    lastLoadedXml.current = "";
    lastReloadKey.current = "";

    if (!containerRef.current) return;
    const compactWorkspace = window.matchMedia("(max-width: 620px)").matches;
    try {
      const workspace = Blockly.inject(containerRef.current, {
        toolbox: safeToolboxDefinition(),
        trashcan: true,
        scrollbars: true,
        theme: blocklyThemeFor(themePreference),
        grid: {
          spacing: 24,
          length: 2,
          colour: themePreference === "dark" ? "#335875" : "#cddfe9",
          snap: false
        },
        zoom: {
          controls: true,
          wheel: true,
          startScale: compactWorkspace ? 0.6 : 0.92,
          maxScale: 1.6,
          minScale: 0.45
        },
        renderer: "zelos"
      });

      workspaceRef.current = workspace;
      const listener = (event: Blockly.Events.Abstract) => {
        if (loadingRef.current || event.isUiEvent) return;
        scheduleSync(workspace);
      };
      const resizeListener = () => scheduleWorkspaceResize(workspace);
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              scheduleWorkspaceResize(workspace);
            });
      workspace.addChangeListener(listener);
      window.addEventListener("resize", resizeListener);
      if (resizeObserver && containerRef.current) {
        resizeObserver.observe(containerRef.current);
        if (containerRef.current.parentElement) {
          resizeObserver.observe(containerRef.current.parentElement);
        }
      }
      syncWorkspaceRender(workspace);
      scheduleWorkspaceResize(workspace);
      setWorkspaceError(null);

      return () => {
        workspace.removeChangeListener(listener);
        window.removeEventListener("resize", resizeListener);
        resizeObserver?.disconnect();
        if (resizeFrameRef.current !== null) {
          window.cancelAnimationFrame(resizeFrameRef.current);
          resizeFrameRef.current = null;
        }
        workspace.dispose();
        workspaceRef.current = null;
        lastWorkspaceXml.current = "";
        lastLoadedXml.current = "";
        lastReloadKey.current = "";
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create Blockly workspace.";
      setWorkspaceError(message);
      console.error("Unable to initialize Blockly", error);
      workspaceRef.current = null;
    }
  }, [themePreference, scheduleSync, scheduleWorkspaceResize, syncWorkspaceRender]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !mountedRef.current) return;
    if (syncFrameRef.current !== null) {
      window.cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }

    const prepared = sanitizeBlocklyXml(xml);
    const shouldReload = lastReloadKey.current !== reloadKey;
    const sameState = !shouldReload && prepared.xml === lastLoadedXml.current;

    loadingRef.current = true;
    try {
      if (sameState) {
        if (prepared.warnings.length > 0) {
          setWorkspaceError(prepared.warnings.join(" "));
        }
        scheduleWorkspaceResize(workspace);
        loadingRef.current = false;
        return;
      }

      const dom = Blockly.utils.xml.textToDom(prepared.xml);
      lastWorkspaceXml.current = "";
      lastLoadedXml.current = prepared.xml;
      lastReloadKey.current = reloadKey;
      Blockly.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
      syncProjectFromWorkspace(workspace);
      if (prepared.warnings.length > 0) {
        setWorkspaceError(prepared.warnings.join(" "));
      } else {
        setWorkspaceError(null);
      }
      workspace.refreshToolboxSelection();
      syncWorkspaceRender(workspace);
      scheduleWorkspaceResize(workspace);
      focusLoadedStack(workspace);
    } catch (error) {
      if (!mountedRef.current) return;
      console.error("Failed to load Blockly XML. Falling back to empty canvas.", error);
      workspace.clear();
      lastLoadedXml.current = emptyBlocklyXml;
      lastReloadKey.current = reloadKey;
      syncProjectFromWorkspace(workspace);
      syncWorkspaceRender(workspace);
      scheduleWorkspaceResize(workspace);
      setWorkspaceError("Loaded an older/invalid blocks XML. Your project was restored as an empty canvas.");
    } finally {
      loadingRef.current = false;
    }
  }, [focusLoadedStack, reloadKey, scheduleWorkspaceResize, syncProjectFromWorkspace, syncWorkspaceRender, xml]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!mountedRef.current) return;
    workspace?.setTheme(blocklyThemeFor(themePreference));
    workspace?.refreshToolboxSelection();
    if (workspace) scheduleWorkspaceResize(workspace);
  }, [themePreference, scheduleWorkspaceResize]);

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
  }, [components, componentDefinitions]);

  return (
    <div className="block-studio">
        <div className="block-studio-header">
          <div>
            <span>Blocks</span>
            <strong>Arduino canvas</strong>
          </div>
        <div className="block-studio-pills" aria-label="Block editor status">
          {workspaceError ? <span className="block-studio-warning">{workspaceError}</span> : null}
          <span>{components.length} part{components.length === 1 ? "" : "s"}</span>
          <span>{componentDefinitions.length} catalog items</span>
          {workspaceError ? (
            <button className="mini-action" onClick={clearWorkspace} title="Clear the Blockly workspace and continue">
              Recover blocks
            </button>
          ) : null}
        </div>
      </div>
      <div className="block-studio-canvas">
        <div className="blockly-host" ref={containerRef} />
      </div>
    </div>
  );
}
