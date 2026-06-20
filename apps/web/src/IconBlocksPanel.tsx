import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Cpu,
  Gauge,
  Lightbulb,
  Monitor,
  Play,
  RadioTower,
  RotateCcw,
  Sparkles,
  Trash2,
  Zap
} from "lucide-react";
import type { CSSProperties } from "react";
import type { ComponentDefinition, ProgramStep, ProjectDocument } from "@abl/block-schema";
import { createIconBlockActions, createIconBlockCards, type IconBlockTone } from "./iconBlocks";

type Props = {
  project: ProjectDocument;
  componentDefinitions: ComponentDefinition[];
  onProgramChange: (program: ProgramStep[]) => void;
  onOpenCircuit: () => void;
  onOpenCode: () => void;
};

function toneIcon(tone: IconBlockTone) {
  if (tone === "time") return <Clock3 size={24} />;
  if (tone === "input") return <Cpu size={24} />;
  if (tone === "motion") return <Gauge size={24} />;
  if (tone === "sensor" || tone === "serial") return <RadioTower size={24} />;
  if (tone === "display") return <Monitor size={24} />;
  return <Lightbulb size={24} />;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export default function IconBlocksPanel({ project, componentDefinitions, onProgramChange, onOpenCircuit, onOpenCode }: Props) {
  const actions = createIconBlockActions(project, componentDefinitions);
  const cards = createIconBlockCards(project.program, project.components);

  function appendStep(step: ProgramStep) {
    onProgramChange([...project.program, step]);
  }

  function removeStep(index: number) {
    onProgramChange(project.program.filter((_, stepIndex) => stepIndex !== index));
  }

  return (
    <div className="icon-workspace">
      <section className="icon-hero">
        <div>
          <span>Icon Blocks</span>
          <strong>{project.name}</strong>
        </div>
        <div className="icon-hero-actions">
          <button onClick={onOpenCircuit}>
            <Sparkles size={16} />
            Circuit
          </button>
          <button onClick={onOpenCode}>
            <Zap size={16} />
            Code
          </button>
        </div>
      </section>

      <div className="icon-grid">
        <section className="icon-palette" aria-label="Icon block palette">
          <div className="icon-panel-heading">
            <strong>Palette</strong>
            <span>{actions.length}</span>
          </div>
          <div className="icon-action-grid">
            {actions.map((action) => (
              <button className={`icon-action ${action.tone}`} key={action.id} onClick={() => appendStep(action.step)} title={`Add ${action.title}`}>
                <span className="icon-action-symbol">{toneIcon(action.tone)}</span>
                <strong>{action.title}</strong>
                <small>{action.detail}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="icon-program" aria-label="Icon block program">
          <div className="icon-panel-heading">
            <strong>Program</strong>
            <span>{cards.length}</span>
          </div>
          <div className="icon-sequence">
            {cards.length === 0 ? (
              <div className="empty-row">No icon blocks yet.</div>
            ) : (
              cards.map((card, index) => (
                <div className={`icon-step ${card.tone}`} key={card.id}>
                  <em>{index + 1}</em>
                  <span className="icon-step-symbol">{toneIcon(card.tone)}</span>
                  <span className="icon-step-copy">
                    <strong>{card.title}</strong>
                    {card.detail}
                  </span>
                  <span className="icon-step-actions">
                    <button title="Move up" disabled={index === 0} onClick={() => onProgramChange(move(project.program, index, index - 1))}>
                      <ArrowUp size={14} />
                    </button>
                    <button
                      title="Move down"
                      disabled={index === project.program.length - 1}
                      onClick={() => onProgramChange(move(project.program, index, index + 1))}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button title="Remove icon block" onClick={() => removeStep(index)}>
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="icon-outcome" aria-label="Icon block outcome">
          <div className="icon-panel-heading">
            <strong>Outcome</strong>
            <span>{project.components.length} parts</span>
          </div>
          <div className="icon-orbit" aria-hidden="true">
            <span className="orbit-board">
              <Cpu size={28} />
            </span>
            {project.components.slice(0, 7).map((component, index) => (
              <span className="orbit-part" style={{ "--orbit-index": index } as CSSProperties} key={component.id}>
                {component.label.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
          <div className="icon-outcome-actions">
            <button onClick={onOpenCircuit}>
              <Play size={16} />
              Preview
            </button>
            <button onClick={() => onProgramChange([])} disabled={project.program.length === 0}>
              <RotateCcw size={16} />
              Clear
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
