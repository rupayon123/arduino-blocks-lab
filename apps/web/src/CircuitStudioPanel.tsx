import { useEffect, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Cpu,
  ExternalLink,
  Globe2,
  Play,
  RadioTower,
  Sparkles,
  TabletSmartphone,
  Wrench,
  Zap
} from "lucide-react";
import {
  defaultBenchControlValues,
  simulateBenchReadings,
  type CircuitStudioBreadboardTone,
  type CircuitStudioBenchControl,
  type CircuitStudioBenchControlValue,
  type CircuitStudioBenchReading,
  type CircuitStudioBenchTest,
  type CircuitStudioBenchTestTone,
  type CircuitStudioEventTone,
  type CircuitStudioModel,
  type CircuitStudioSimulatorTone,
  type CircuitStudioStepState
} from "./circuitStudio";

type Props = {
  model: CircuitStudioModel;
  generatedCode?: string;
  onExportWokwiProject?: () => void;
  onOpenCode?: () => void;
};

type CircuitStudioView = "board" | "breadboard" | "bench";

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

function simulatorIcon(tone: CircuitStudioSimulatorTone) {
  if (tone === "ready") return <CheckCircle2 size={15} />;
  if (tone === "blocked") return <AlertTriangle size={15} />;
  return <Globe2 size={15} />;
}

function breadboardIcon(tone: CircuitStudioBreadboardTone) {
  if (tone === "ready") return <CheckCircle2 size={15} />;
  if (tone === "blocked") return <AlertTriangle size={15} />;
  return <Cpu size={15} />;
}

function wirePath(wire: CircuitStudioModel["wires"][number]) {
  return `M ${wire.x1} ${wire.y1} C ${wire.c1x} ${wire.c1y}, ${wire.c2x} ${wire.c2y}, ${wire.x2} ${wire.y2}`;
}

type BenchControlState = Record<string, CircuitStudioBenchControlValue>;

function controlKey(testId: string, controlId: string) {
  return `${testId}:${controlId}`;
}

function valuesForTest(test: CircuitStudioBenchTest, controlState: BenchControlState) {
  const values = defaultBenchControlValues(test);
  test.simulation.controls.forEach((control) => {
    const key = controlKey(test.id, control.id);
    const value = controlState[key];
    if (value !== undefined) values[control.id] = value;
  });
  return values;
}

function formattedControlValue(control: CircuitStudioBenchControl, value: CircuitStudioBenchControlValue) {
  if (control.kind === "toggle") return value ? control.onLabel : control.offLabel;
  if (control.kind === "choice") return control.options.find((option) => option.value === value)?.label ?? String(value);
  return `${value}${control.unit ? ` ${control.unit}` : ""}`;
}

function nextRangeValue(control: Extract<CircuitStudioBenchControl, { kind: "range" }>, value: number, direction: -1 | 1) {
  const next = Math.max(control.min, Math.min(control.max, value + control.step * direction));
  return Number(next.toFixed(4));
}

function BenchControl({
  control,
  value,
  onChange
}: { control: CircuitStudioBenchControl; value: CircuitStudioBenchControlValue; onChange: (value: CircuitStudioBenchControlValue) => void }) {
  if (control.kind === "toggle") {
    const pressed = Boolean(value);
    return (
      <button className={`bench-toggle ${pressed ? "active" : ""}`} type="button" aria-pressed={pressed} onClick={() => onChange(!pressed)}>
        <span>{control.label}</span>
        <strong>{pressed ? control.onLabel : control.offLabel}</strong>
      </button>
    );
  }

  if (control.kind === "choice") {
    return (
      <div className="bench-choice" role="group" aria-label={control.label}>
        <span>{control.label}</span>
        <div>
          {control.options.map((option) => (
            <button
              className={value === option.value ? "active" : ""}
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const numericValue = typeof value === "number" ? value : control.defaultValue;
  return (
    <label className="bench-range">
      <span>
        {control.label}
        <output>{formattedControlValue(control, numericValue)}</output>
      </span>
      <div className="bench-range-row">
        <button type="button" aria-label={`Decrease ${control.label}`} onClick={() => onChange(nextRangeValue(control, numericValue, -1))}>
          -
        </button>
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={numericValue}
          onInput={(event) => onChange(Number(event.currentTarget.value))}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <button type="button" aria-label={`Increase ${control.label}`} onClick={() => onChange(nextRangeValue(control, numericValue, 1))}>
          +
        </button>
      </div>
      {(control.lowLabel || control.highLabel) && (
        <small>
          <span>{control.lowLabel}</span>
          <span>{control.highLabel}</span>
        </small>
      )}
    </label>
  );
}

function BenchReadout({ reading }: { reading: CircuitStudioBenchReading }) {
  return (
    <div className={`bench-readout ${reading.tone}`}>
      <span>{reading.label}</span>
      <strong>{reading.value}</strong>
    </div>
  );
}

export default function CircuitStudioPanel({ model, generatedCode, onExportWokwiProject, onOpenCode }: Props) {
  const [controlState, setControlState] = useState<BenchControlState>({});
  const [studioView, setStudioView] = useState<CircuitStudioView>("board");
  const [selectedBenchTestId, setSelectedBenchTestId] = useState<string>(model.benchTests[0]?.id ?? "");
  const [showProgramTrace, setShowProgramTrace] = useState(true);
  const readyLabel =
    model.stats.errors > 0 ? `${model.stats.errors} fix${model.stats.errors === 1 ? "" : "es"}` : model.stats.warnings > 0 ? `${model.stats.warnings} review` : "Ready";

  useEffect(() => {
    if (!model.benchTests.some((test) => test.id === selectedBenchTestId)) {
      setSelectedBenchTestId(model.benchTests[0]?.id ?? "");
    }
  }, [selectedBenchTestId, model.benchTests]);

  const selectedBenchTest =
    model.benchTests.find((test) => test.id === selectedBenchTestId) ?? model.benchTests[0] ?? null;
  const selectedValues = selectedBenchTest ? valuesForTest(selectedBenchTest, controlState) : {};
  const selectedReadings = selectedBenchTest ? simulateBenchReadings(selectedBenchTest, selectedValues) : [];
  const serialEvents = model.events.filter((event) => event.tone === "serial");

  return (
    <div className="circuit-panel">
      <div className="circuit-view-tabs" role="tablist" aria-label="Circuit workspace mode">
        <button className={studioView === "board" ? "active" : ""} type="button" onClick={() => setStudioView("board")}>
          <Cpu size={15} />
          Arduino Board
        </button>
        <button className={studioView === "breadboard" ? "active" : ""} type="button" onClick={() => setStudioView("breadboard")}>
          <TabletSmartphone size={15} />
          Breadboard
        </button>
        <button className={studioView === "bench" ? "active" : ""} type="button" onClick={() => setStudioView("bench")}>
          <Wrench size={15} />
          Virtual Bench
        </button>
      </div>

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
        <section className={`circuit-stage ${studioView}`} aria-label="Circuit planning view">
          <div className="circuit-floor" />
          <svg className="circuit-wire-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {model.wires.map((wire) => (
              <path className={`circuit-wire ${wire.kind} ${wire.status}`} d={wirePath(wire)} key={wire.id} />
            ))}
          </svg>

          {studioView === "board" && (
            <div className="arduino-model">
              <span className="usb-port" />
              <strong>{model.boardName}</strong>
              <span className="pin-bank top" />
              <span className="pin-bank bottom" />
              <span className="chip" />
              <span className="power-jack" />
            </div>
          )}

          {studioView === "breadboard" && (
            <div className="circuit-floor-label" aria-hidden="true">
              Breadboard planning
            </div>
          )}

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
          <section className={`circuit-card simulator-card ${model.simulatorPlan.tone}`}>
            <div className="circuit-card-heading">
              <strong>Simulator Readiness</strong>
              <span>{model.simulatorPlan.coveragePercent}% covered</span>
            </div>
            <div className="simulator-summary">
              <span>{simulatorIcon(model.simulatorPlan.tone)}</span>
              <div>
                <strong>{model.simulatorPlan.title}</strong>
                <p>{model.simulatorPlan.detail}</p>
              </div>
              {onExportWokwiProject && (
                <button disabled={model.stats.components === 0} onClick={onExportWokwiProject}>
                  <Globe2 size={14} />
                  Export sim
                </button>
              )}
            </div>
            <div className="simulator-meter" aria-label="Simulator coverage">
              <span style={{ width: `${model.simulatorPlan.coveragePercent}%` }} />
            </div>
            <div className="simulator-stats">
              <span>
                <strong>{model.simulatorPlan.supportedParts}</strong>
                exportable
              </span>
              <span>
                <strong>{model.simulatorPlan.virtualTests}</strong>
                bench tests
              </span>
              <span className={model.simulatorPlan.unsupportedParts.length > 0 ? "warning" : ""}>
                <strong>{model.simulatorPlan.unsupportedParts.length}</strong>
                manual
              </span>
            </div>
            <div className="simulator-item-list">
              {model.simulatorPlan.items.slice(0, 4).map((item) => (
                <div className={`simulator-item ${item.tone}`} key={item.id}>
                  {simulatorIcon(item.tone)}
                  <span>
                    <strong>{item.title}</strong>
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={`circuit-card breadboard-card ${model.breadboardPlan.tone}`}>
            <div className="circuit-card-heading">
              <strong>Breadboard Preflight</strong>
              <span>
                {model.breadboardPlan.signalWires + model.breadboardPlan.busWires} signal · {model.breadboardPlan.groundWires} ground
              </span>
            </div>
            <div className="breadboard-summary">
              <span>{breadboardIcon(model.breadboardPlan.tone)}</span>
              <div>
                <strong>{model.breadboardPlan.title}</strong>
                <p>{model.breadboardPlan.detail}</p>
              </div>
            </div>
            <div className="breadboard-stats">
              <span>
                <strong>{model.breadboardPlan.powerWires}</strong>
                power
              </span>
              <span>
                <strong>{model.breadboardPlan.signalWires}</strong>
                signal
              </span>
              <span>
                <strong>{model.breadboardPlan.busWires}</strong>
                bus
              </span>
            </div>
            <div className="breadboard-item-list">
              {model.breadboardPlan.items.slice(0, 5).map((item) => (
                <div className={`breadboard-item ${item.tone}`} key={item.id}>
                  {breadboardIcon(item.tone)}
                  <span>
                    <strong>{item.title}</strong>
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
            {model.breadboardPlan.simulatorHints.length > 0 && (
              <div className="breadboard-hints" aria-label="Simulator hints">
                {model.breadboardPlan.simulatorHints.map((hint) => (
                  <span key={hint}>{hint}</span>
                ))}
              </div>
            )}
          </section>

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
              <strong>Run Preview</strong>
              <span>{studioView === "bench" ? "Simulation controls" : `${model.events.length} beats`}</span>
            </div>
            {studioView === "bench" ? (
              <div className="virtual-bench-console">
                <button type="button" onClick={() => setShowProgramTrace((current) => !current)}>
                  <Play size={14} />
                  {showProgramTrace ? "Show code block" : "Show program trace"}
                </button>
                <button type="button" onClick={onOpenCode} disabled={!onOpenCode}>
                  <ExternalLink size={14} />
                  Open Arduino code view
                </button>
              </div>
            ) : (
              <div className="circuit-event-list">
                {model.events.length === 0 ? (
                  <div className="empty-row">No code behavior yet.</div>
                ) : (
                  model.events.slice(0, 8).map((event, index) => (
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
            )}
            {studioView === "bench" && (
              <div className="code-trace-block">
                <div className="circuit-card-heading">
                  <strong>Program Trace</strong>
                  <span>{serialEvents.length} serial output event{serialEvents.length === 1 ? "" : "s"}</span>
                </div>
                {showProgramTrace ? (
                  <div className="virtual-event-list">
                    {model.events.map((event) => (
                      <div className="virtual-event-line" key={event.id}>
                        {eventIcon(event.tone)}
                        <p>
                          <strong>{event.title}:</strong> {event.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="circuit-code-snippet">
                    <code>{generatedCode ? `${generatedCode.split("\n").slice(0, 12).join("\n")}\n...` : "// Arduino C++ preview unavailable."}</code>
                  </pre>
                )}
              </div>
            )}
          </section>

          {selectedBenchTest ? (
            <section className="circuit-card circuit-card--bench-single">
              <div className="circuit-card-heading">
                <strong>Bench Test</strong>
                <span>{model.benchTests.length} checks</span>
              </div>
              <div className="circuit-bench-list">
                <div className={`circuit-bench-test ${selectedBenchTest.tone}`} key={selectedBenchTest.id}>
                  {benchIcon(selectedBenchTest.tone)}
                  <div className="bench-test-body">
                    <strong>{selectedBenchTest.title}</strong>
                    <small>{selectedBenchTest.setup}</small>
                    <p>{selectedBenchTest.expected}</p>
                    {selectedBenchTest.simulation.controls.length > 0 && (
                      <div className="bench-control-grid">
                        {selectedBenchTest.simulation.controls.map((control) => (
                          <BenchControl
                            control={control}
                            key={control.id}
                            value={selectedValues[control.id] ?? control.defaultValue}
                            onChange={(value) =>
                              setControlState((current) => ({
                                ...current,
                                [controlKey(selectedBenchTest.id, control.id)]: value
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                    <div className="bench-readout-grid">
                      {(selectedReadings.length > 0 ? selectedReadings : selectedBenchTest.readings).map((reading) => (
                        <BenchReadout key={reading.id} reading={reading} />
                      ))}
                    </div>
                  </div>
                  <small className="bench-test-hint">
                    <ArrowRight size={12} />
                    Pick another behavior to test from the list below.
                  </small>
                </div>
              </div>
              <div className="circuit-bench-picker">
                {model.benchTests.map((test) => (
                  <button
                    type="button"
                    className={selectedBenchTest.id === test.id ? "active" : ""}
                    key={test.id}
                    onClick={() => {
                      setSelectedBenchTestId(test.id);
                    }}
                  >
                    {test.title}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="circuit-card">
              <div className="circuit-card-heading">
                <strong>Bench Test</strong>
                <span>0 checks</span>
              </div>
              <div className="empty-row">Add a behavior block to get a bench test.</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
