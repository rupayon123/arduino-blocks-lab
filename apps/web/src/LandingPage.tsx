import { Cable, CircuitBoard, Code2, Cpu, Gauge, Play, SquareStack } from "lucide-react";

type Props = {
  boardCount: number;
  componentCount: number;
  lessonCount: number;
  onStart: () => void;
  onOpenCircuit: () => void;
  onOpenCode: () => void;
  onOpenLessons: () => void;
};

export default function LandingPage({ boardCount, componentCount, lessonCount, onStart, onOpenCircuit, onOpenCode, onOpenLessons }: Props) {
  return (
    <main className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <nav className="landing-nav" aria-label="Landing navigation">
          <div className="landing-brand">
            <span className="landing-brand-mark">
              <Cpu size={22} />
            </span>
            <strong>Arduino Blocks Lab</strong>
          </div>
          <button onClick={onStart}>Open workspace</button>
        </nav>

        <div className="landing-hero-layout">
          <div className="landing-hero-copy">
            <span className="landing-kicker">
              <CircuitBoard size={16} />
              Classroom-ready Arduino blocks, code, and upload
            </span>
            <h1 id="landing-title">Arduino Blocks Lab</h1>
            <p>
              Start with blocks, read the Arduino C++ beside them, check the wiring, then flash a real Uno, Nano, or Mega from
              the local agent.
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={onStart}>
                <Play size={18} />
                Start building
              </button>
              <button className="landing-secondary" onClick={onOpenCode}>
                <Code2 size={18} />
                View Arduino C++
              </button>
            </div>
            <ul className="landing-trust-line">
              <li>
                <Cable size={16} />
                Real USB upload path through Arduino CLI
              </li>
              <li>
                <CircuitBoard size={16} />
                Pin and wiring checks before class hardware
              </li>
              <li>
                <SquareStack size={16} />
                Icon blocks, Blockly blocks, and Arduino C++
              </li>
            </ul>
          </div>

          <div className="landing-workbench" aria-hidden="true">
            <div className="bench-topline">
              <span>Blocks</span>
              <span>Wiring</span>
              <span>C++</span>
              <span>Upload</span>
            </div>

            <div className="bench-surface">
              <div className="bench-wire wire-a" />
              <div className="bench-wire wire-b" />
              <div className="bench-wire wire-c" />

              <div className="bench-board">
                <div className="bench-usb" />
                <div className="bench-chip" />
                <div className="bench-pins top" />
                <div className="bench-pins bottom" />
                <strong>UNO</strong>
                <small>Port ready</small>
              </div>

              <div className="bench-blocks">
                <span className="block-chip blue">when loop runs</span>
                <span className="block-chip green">set LED 13 high</span>
                <span className="block-chip amber">wait 500 ms</span>
                <span className="block-chip coral">set LED 13 low</span>
              </div>

              <pre className="bench-code">
                <span>void loop() {"{"}</span>
                <span>  digitalWrite(13, HIGH);</span>
                <span>  delay(500);</span>
                <span>  digitalWrite(13, LOW);</span>
                <span>{"}"}</span>
              </pre>

              <div className="bench-breadboard">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <strong>LED + resistor</strong>
              </div>
            </div>

            <div className="bench-checks">
              <span>Pin 13 mapped</span>
              <span>No missing libraries</span>
              <span>Ready to compile</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-band" aria-label="Project entry points">
        <div className="landing-band-heading">
          <span>Choose a station</span>
          <strong>Move from first lesson to real upload without losing the thread.</strong>
        </div>
        <div className="landing-stat-row">
          <span>
            <strong>{boardCount}</strong>
            boards
          </span>
          <span>
            <strong>{componentCount}</strong>
            parts
          </span>
          <span>
            <strong>{lessonCount}</strong>
            lessons
          </span>
        </div>
        <div className="landing-entry-grid">
          <button onClick={onStart}>
            <SquareStack size={22} />
            <strong>Blocks</strong>
            <span>Build with beginner-friendly programming blocks.</span>
          </button>
          <button onClick={onOpenCode}>
            <Code2 size={22} />
            <strong>Arduino C++</strong>
            <span>Inspect and copy live generated code for uploads.</span>
          </button>
          <button onClick={onOpenCircuit}>
            <CircuitBoard size={22} />
            <strong>Circuit Studio</strong>
            <span>View wiring, detect issues, and get setup guidance.</span>
          </button>
          <button onClick={onOpenLessons}>
            <Gauge size={22} />
            <strong>Lessons</strong>
            <span>Follow guided missions from beginner to advanced.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
