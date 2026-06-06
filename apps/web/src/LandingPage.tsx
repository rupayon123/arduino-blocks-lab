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
              Kid-first block coding for real Arduino boards
            </span>
            <h1 id="landing-title">Learn by building. Build by coding. Code by uploading.</h1>
            <p>
              A playful, guided Blockly environment inspired by LEGO-style learning. Start with blocks, inspect generated
              C++, validate wiring fast, then flash real hardware with confidence.
            </p>
            <div className="landing-actions">
              <button className="landing-primary" onClick={onStart}>
                <Play size={18} />
                Start building
              </button>
              <button className="landing-secondary" onClick={onOpenCode}>
                <Code2 size={18} />
                See Arduino C++
              </button>
            </div>
            <ul className="landing-trust-line">
              <li>
                <Cable size={16} />
                Connect and upload to Uno / Nano / Mega
              </li>
              <li>
                <CircuitBoard size={16} />
                Visual wiring and project checks before hardware
              </li>
              <li>
                <Sparkles size={16} />
                Learn faster with lessons, templates, and live hints
              </li>
            </ul>
          </div>

          <div className="landing-scene" aria-hidden="true">
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
                <span> {"}"} </span>
                <span>void loop() {"{"}</span>
                <span>  digitalWrite(13, HIGH);</span>
                <span>  delay(500);</span>
                <span>  digitalWrite(13, LOW);</span>
                <span>  delay(500);</span>
                <span>{"}"}</span>
              </pre>
              <div className="landing-orbit">Preview is editable before flashing.</div>
            </article>

            <article className="landing-preview-card">
              <header>
                <span>Wiring Safety</span>
                <strong>Visual checks</strong>
              </header>
              <p>We catch floating inputs, pin conflicts, and missing parts before upload.</p>
              <div className="landing-orbit" aria-label="workflow">
                Block → Wire → Validate → Upload
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
