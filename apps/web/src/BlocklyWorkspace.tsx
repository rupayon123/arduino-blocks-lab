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
      contents: category.contents.filter((entry) => entry.kind !== "block" || Boolean(Blockly.Blocks[entry.type])
      )
    }))
    .filter((category) => category.contents.length > 0)
    .map((category) => ({
      kind: "category",
      name: category.name,
      colour: category.colour,
      contents: category.contents
    }));

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
  const onChangeRef = useRef(onChange);
  const lastWorkspaceXml = useRef<string>("");
  const lastLoadedXml = useRef<string>("");
  const lastReloadKey = useRef<string>("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const componentsRef = useRef(components);
  const componentDefinitionsRef = useRef(componentDefinitions);
  componentsRef.current = components;
  componentDefinitionsRef.current = componentDefinitions;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const syncProjectFromWorkspace = useCallback((workspace: Blockly.WorkspaceSvg) => {
    if (loadingRef.current) return;
    try {
      const dom = Blockly.Xml.workspaceToDom(workspace);
      const blocksXml = Blockly.Xml.domToText(dom);
      if (blocksXml === lastWorkspaceXml.current) return;
      const nextProgram = workspaceToProgram(workspace, componentsRef.current);
      lastWorkspaceXml.current = blocksXml;
      try {
        onChangeRef.current(nextProgram, blocksXml);
        setWorkspaceError(null);
      } catch (error) {
        console.error("Unable to sync blocks with project state.", error);
        setWorkspaceError("Blockly sync was interrupted and this project edit is being preserved.");
      }
    } catch (error) {
      console.error("Unable to sync workspace changes", error);
      setWorkspaceError("Blockly sync failed for this change. The workspace will keep running, but code generation may pause until recovered.");
    }
  }, []);

  const scheduleSync = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
      }
      syncFrameRef.current = window.requestAnimationFrame(() => {
        syncFrameRef.current = null;
        syncProjectFromWorkspace(workspace);
      });
    },
    [syncProjectFromWorkspace]
  );

  const clearWorkspace = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    loadingRef.current = true;
    workspace.clear();
    lastWorkspaceXml.current = "";
    loadingRef.current = false;
    syncProjectFromWorkspace(workspace);
    setWorkspaceError(null);
  }, [syncProjectFromWorkspace]);

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
    registerArduinoBlocks();

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
      workspace.addChangeListener(listener);
      setWorkspaceError(null);

      return () => {
        workspace.removeChangeListener(listener);
        workspace.dispose();
        workspaceRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create Blockly workspace.";
      setWorkspaceError(message);
      console.error("Unable to initialize Blockly", error);
      workspaceRef.current = null;
    }
  }, [themePreference, scheduleSync]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
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
        loadingRef.current = false;
        return;
      }

      const dom = Blockly.utils.xml.textToDom(prepared.xml);
      workspace.clear();
      lastWorkspaceXml.current = "";
      lastLoadedXml.current = prepared.xml;
      lastReloadKey.current = reloadKey;
      Blockly.Xml.domToWorkspace(dom, workspace);
      syncProjectFromWorkspace(workspace);
      if (prepared.warnings.length > 0) {
        setWorkspaceError(prepared.warnings.join(" "));
      } else {
        setWorkspaceError(null);
      }
      workspace.refreshToolboxSelection();
    } catch (error) {
      console.error("Failed to load Blockly XML. Falling back to empty canvas.", error);
      workspace.clear();
      lastLoadedXml.current = emptyBlocklyXml;
      lastReloadKey.current = reloadKey;
      syncProjectFromWorkspace(workspace);
      setWorkspaceError("Loaded an older/invalid blocks XML. Your project was restored as an empty canvas.");
    } finally {
      loadingRef.current = false;
    }
  }, [reloadKey, xml, syncProjectFromWorkspace]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    workspace?.setTheme(blocklyThemeFor(themePreference));
    workspace?.refreshToolboxSelection();
  }, [themePreference]);

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
  }, [components, componentDefinitions]);

  useEffect(() => {
    return () => {
      if (syncFrameRef.current !== null) {
        window.cancelAnimationFrame(syncFrameRef.current);
      }
    };
  }, []);

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
