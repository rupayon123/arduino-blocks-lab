import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";
import type { ComponentDefinition, ComponentInstance, ProgramStep } from "@abl/block-schema";
import { registerArduinoBlocks, setBlocklyComponentDefinitionProvider, setBlocklyComponentProvider, toolbox } from "./blocklyBlocks";
import { workspaceToProgram } from "./workspaceToProgram";

type Props = {
  components: ComponentInstance[];
  componentDefinitions: ComponentDefinition[];
  xml: string;
  reloadKey: string;
  onChange: (program: ProgramStep[], blocksXml: string) => void;
};

export default function BlocklyWorkspace({ components, componentDefinitions, xml, reloadKey, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const loadingRef = useRef(false);
  const componentsRef = useRef(components);
  const componentDefinitionsRef = useRef(componentDefinitions);
  componentsRef.current = components;
  componentDefinitionsRef.current = componentDefinitions;

  useEffect(() => {
    setBlocklyComponentProvider(() => componentsRef.current);
    setBlocklyComponentDefinitionProvider(() => componentDefinitionsRef.current);
    registerArduinoBlocks();
    if (!containerRef.current) return;
    const workspace = Blockly.inject(containerRef.current, {
      toolbox,
      trashcan: true,
      scrollbars: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.92,
        maxScale: 1.6,
        minScale: 0.45
      },
      renderer: "zelos"
    });
    workspaceRef.current = workspace;
    const listener = (event: Blockly.Events.Abstract) => {
      if (loadingRef.current || event.isUiEvent) return;
      const dom = Blockly.Xml.workspaceToDom(workspace);
      const blocksXml = Blockly.Xml.domToText(dom);
      onChange(workspaceToProgram(workspace, componentsRef.current), blocksXml);
    };
    workspace.addChangeListener(listener);
    return () => {
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    loadingRef.current = true;
    workspace.clear();
    try {
      const dom = Blockly.utils.xml.textToDom(xml);
      Blockly.Xml.domToWorkspace(dom, workspace);
      onChange(workspaceToProgram(workspace, componentsRef.current), Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)));
    } finally {
      loadingRef.current = false;
    }
  }, [reloadKey, xml, onChange]);

  useEffect(() => {
    workspaceRef.current?.refreshToolboxSelection();
  }, [components, componentDefinitions]);

  return <div className="blockly-host" ref={containerRef} />;
}
