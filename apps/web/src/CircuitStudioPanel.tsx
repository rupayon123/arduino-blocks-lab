import type { CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Cpu, RadioTower, Sparkles, Zap } from "lucide-react";
import type { CircuitStudioBenchTestTone, CircuitStudioEventTone, CircuitStudioModel, CircuitStudioStepState } from "./circuitStudio";

type Props = {
  model: CircuitStudioModel;
};

function stepIcon(state: CircuitStudioStepState) {
  if (state === "done") return <CheckCircle2 size={16} />;
  if (state === "warning" || state === "blocked") return <AlertTriangle size={16} />;
  return <Sparkles size={16} />;
}

function eventIcon(tone: CircuitStudioEventTone) {
  if (tone === "wait") return <Clock3 size={15} />;
  if (tone === "serial") return <RadioTower size={15} />;
  if (tone === "input") return <Cpu size={15} />;
  return <Zap size={15} />;
}

function benchIcon(tone: CircuitStudioBenchTestTone) {
  if (tone === "serial") return <RadioTower size={15} />;
  if (tone === "input") return <Cpu size={15} />;
  if (tone === "motion") return <Sparkles size={15} />;
  return <Zap size={15} />;
}

function wirePath(wire: CircuitStudioModel["wires"][number]) {
  return `M ${wire.x1} ${wire.y1} C ${wire.c1x} ${wire.c1y}, ${wire.c2x} ${wire.c2y}, ${wire.x2} ${wire.y2}`;
}

export default function CircuitStudioPanel({ model }: Props) {
  const readyLabel =
    model.stats.errors > 0
      ? `${model.stats.errors} fix${model.stats.errors === 1 ? "" : "es"}`
      : model.stats.warnings > 0
        ? `${model.stats.warnings} review`
        : "Ready";

  return (
    <div className="circuit-panel">
      <div className="circuit-hero">
        <div>
          <span>Circuit Studio</span>
          <strong>{model.projectName}</strong>
        </div>
        <div className="circuit-stats" aria-label="Circuit summary">
          <span>
            <strong>{model.stats.components}</strong>
            parts
          </span>
          <span>
            <strong>{model.stats.wires}</strong>
            wires
          </span>
          <span className={model.stats.errors > 0 ? "blocked" : model.stats.warnings > 0 ? "warning" : "ready"}>
            <strong>{readyLabel}</strong>
            checks
          </span>
        </div>
      </div>

      <div className="circuit-workbench">
        <section className="circuit-stage" aria-label="3D circuit planning view">
          <div className="circuit-floor" />
          <svg className="circuit-wire-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {model.wires.map((wire) => (
              <path className={`circuit-wire ${wire.kind} ${wire.status}`} d={wirePath(wire)} key={wire.id} />
            ))}
          </svg>

          <div className="arduino-model">
            <span className="usb-port" />
            <strong>{model.boardName}</strong>
            <span className="pin-bank top" />
            <span className="pin-bank bottom" />
            <span className="chip" />
            <span className="power-jack" />
          </div>

          <div className="breadboard-model">
            <span className="rail positive" />
            <span className="rail negative" />
            <span className="breadboard-dots" />
            <strong>Breadboard</strong>
          </div>

          {model.placements.map((placement) => (
            <div
              className={`component-model ${placement.category}`}
              key={placement.id}
              style={
                {
                  "--x": `${placement.x}%`,
                  "--y": `${placement.y}%`,
                  "--accent": placement.accent
                } as CSSProperties
              }
              title={`${placement.label}: ${placement.name}`}
            >
              <span />
              <strong>{placement.label}</strong>
              <small>
                {placement.name} · {placement.pinCount} pins
              </small>
            </div>
          ))}
        </section>

        <aside className="circuit-guidance">
          <section className="circuit-card">
            <div className="circuit-card-heading">
              <strong>Build Check</strong>
              <span>
                {model.stats.signalWires} signal · {model.stats.powerWires} power
              </span>
            </div>
            <div className="circuit-step-list">
              {model.steps.map((step) => (
                <div className={`circuit-step ${step.state}`} key={step.id}>
                  {stepIcon(step.state)}
                  <span>
                    <strong>{step.label}</strong>
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="circuit-card">
            <div className="circuit-card-heading">
              <strong>Bench Test</strong>
              <span>{model.benchTests.length} checks</span>
            </div>
            <div className="circuit-bench-list">
              {model.benchTests.length === 0 ? (
                <div className="empty-row">Add a behavior block to get a bench test.</div>
              ) : (
                model.benchTests.map((test) => (
                  <div className={`circuit-bench-test ${test.tone}`} key={test.id}>
                    {benchIcon(test.tone)}
                    <span>
                      <strong>{test.title}</strong>
                      <small>{test.setup}</small>
                      {test.expected}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="circuit-card">
            <div className="circuit-card-heading">
              <strong>Run Preview</strong>
              <span>{model.events.length} beats</span>
            </div>
            <div className="circuit-event-list">
              {model.events.length === 0 ? (
                <div className="empty-row">No code behavior yet.</div>
              ) : (
                model.events.map((event, index) => (
                  <div className={`circuit-event ${event.tone}`} key={event.id}>
                    <em>{index + 1}</em>
                    {eventIcon(event.tone)}
                    <span>
                      <strong>{event.title}</strong>
                      {event.detail}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
