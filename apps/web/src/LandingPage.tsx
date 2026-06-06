import { Cable, CircuitBoard, Code2, Cpu, Gauge, Play, Sparkles, SquareStack } from "lucide-react";

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
        <div className="landing-glowfield" aria-hidden="true">
          <span className="landing-glow b1" />
          <span className="landing-glow b2" />
          <span className="landing-glow b3" />
          <span className="landing-glow b4" />
        </div>

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
              <Sparkles size={16} />
              Beginner-first Arduino Blockly + code experience
            </span>
            <h1 id="landing-title">Build ideas fast, understand code, and flash real Arduino boards.</h1>
            <p>
              A playful workflow inspired by LEGO-style learning. Start with blocks, inspect generated C++, check wiring, and
              upload only when your project is ready.
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
                Connect Uno, Nano, and Mega boards
              </li>
              <li>
                <CircuitBoard size={16} />
                Visual wiring checks before hardware upload
              </li>
              <li>
                <Sparkles size={16} />
                Beginner missions and playful live previews
              </li>
            </ul>
          </div>

          <div className="landing-scene" aria-hidden="true">
            <div className="landing-flow-band">
              <article className="landing-flow-card">
                <span>🧩</span>
                <strong>Build with blocks</strong>
                <p>Drag a few blocks and watch live C++ fill in line by line.</p>
              </article>
              <article className="landing-flow-card">
                <span>🔌</span>
                <strong>Sim and wire first</strong>
                <p>Check pin wiring, dependencies, and warnings before hardware.</p>
              </article>
              <article className="landing-flow-card">
                <span>⚡</span>
                <strong>Flash the board</strong>
                <p>Compile and upload to Uno, Nano, and Mega when ready.</p>
              </article>
            </div>

            <article className="landing-preview-card">
              <header>
                <span>Starter Flow</span>
                <strong>From blocks to hardware</strong>
              </header>
              <p>Learn with guided missions and instant checks.</p>
              <ol>
                <li>Build behavior with blocks</li>
                <li>Review generated Arduino C++</li>
                <li>Check wiring and dependencies</li>
                <li>Compile, upload, and test</li>
              </ol>
            </article>

            <article className="landing-preview-card landing-code-card">
              <header>
                <span>Generated C++</span>
                <strong>Blink in one minute</strong>
              </header>
              <pre>
                <span>void setup() {"{"}</span>
                <span>  pinMode(13, OUTPUT);</span>
                <span>{"}"}</span>
                <span>void loop() {"{"}</span>
                <span>  digitalWrite(13, HIGH);</span>
                <span>  delay(500);</span>
                <span>  digitalWrite(13, LOW);</span>
                <span>  delay(500);</span>
                <span>{"}"}</span>
              </pre>
              <div className="landing-orbit">Editable, readable, and upload-ready.</div>
            </article>

            <article className="landing-preview-card">
              <header>
                <span>Wiring Safety</span>
                <strong>Project confidence</strong>
              </header>
              <p>We catch floating inputs, pin conflicts, and missing parts before you touch hardware.</p>
              <div className="landing-orbit" aria-label="workflow">
                Check → Fix → Build → Upload
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-band" aria-label="Project entry points">
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
