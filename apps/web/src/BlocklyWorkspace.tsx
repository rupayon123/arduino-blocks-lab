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

function sanitizeBlocklyXml(rawXml: string): string {
  return rawXml.trim() ? rawXml : emptyBlocklyXml;
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
    .filter((category) => category.contents.length > 0);

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
      onChangeRef.current(nextProgram, blocksXml);
      setWorkspaceError(null);
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
    syncProjectFromWorkspace(workspace);
    loadingRef.current = false;
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
    loadingRef.current = true;
    workspace.clear();
    lastWorkspaceXml.current = "";
    try {
      const dom = Blockly.utils.xml.textToDom(sanitizeBlocklyXml(xml));
      Blockly.Xml.domToWorkspace(dom, workspace);
      syncProjectFromWorkspace(workspace);
      workspace.refreshToolboxSelection();
    } catch (error) {
      console.error("Failed to load Blockly XML. Falling back to empty canvas.", error);
      workspace.clear();
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
