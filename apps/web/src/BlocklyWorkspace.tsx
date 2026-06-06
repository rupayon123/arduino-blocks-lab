import { useEffect, useRef, useState } from "react";
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

export default function BlocklyWorkspace({ components, componentDefinitions, xml, reloadKey, themePreference, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const componentsRef = useRef(components);
  const componentDefinitionsRef = useRef(componentDefinitions);
  componentsRef.current = components;
  componentDefinitionsRef.current = componentDefinitions;

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
    registerArduinoBlocks();
    if (!containerRef.current) return;
    const compactWorkspace = window.matchMedia("(max-width: 620px)").matches;
    try {
      const workspace = Blockly.inject(containerRef.current, {
        toolbox: toolbox as Blockly.utils.toolbox.ToolboxDefinition,
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
        try {
          const dom = Blockly.Xml.workspaceToDom(workspace);
          const blocksXml = Blockly.Xml.domToText(dom);
          onChange(workspaceToProgram(workspace, componentsRef.current), blocksXml);
        } catch (error) {
          console.error("Unable to sync workspace changes", error);
        }
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
  }, [onChange]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    loadingRef.current = true;
    workspace.clear();
    try {
      const dom = Blockly.utils.xml.textToDom(sanitizeBlocklyXml(xml));
      Blockly.Xml.domToWorkspace(dom, workspace);
      onChange(workspaceToProgram(workspace, componentsRef.current), Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)));
    } catch (error) {
      console.error("Failed to load Blockly XML. Falling back to empty canvas.", error);
      workspace.clear();
      onChange([], emptyBlocklyXml);
    } finally {
      loadingRef.current = false;
    }
  }, [reloadKey, onChange]);

  useEffect(() => {
    workspaceRef.current?.refreshToolboxSelection();
  }, [components, componentDefinitions]);

  useEffect(() => {
    workspaceRef.current?.setTheme(blocklyThemeFor(themePreference));
  }, [themePreference]);

  if (workspaceError) {
    return (
      <section className="block-studio block-studio-error" aria-live="polite">
        <div className="block-studio-header">
          <div>
            <span>Blockly</span>
            <strong>Workspace temporarily unavailable</strong>
          </div>
        </div>
        <div className="block-studio-canvas blockly-workspace-error">{workspaceError}</div>
      </section>
    );
  }

  return (
    <div className="block-studio">
      <div className="block-studio-header">
        <div>
          <span>Blocks</span>
          <strong>Arduino canvas</strong>
        </div>
        <div className="block-studio-pills" aria-label="Block editor status">
          <span>{components.length} part{components.length === 1 ? "" : "s"}</span>
          <span>{componentDefinitions.length} catalog items</span>
        </div>
      </div>
      <div className="block-studio-canvas">
        <div className="blockly-host" ref={containerRef} />
      </div>
    </div>
  );
}
