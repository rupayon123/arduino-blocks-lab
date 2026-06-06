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
              A playful, guided Blockly environment inspired by LEGO-style simplicity. Start with blocks, inspect generated
              C++, test ideas quickly, then flash real hardware with confidence.
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
            <div className="landing-bubble bubble-blocks">
              <SquareStack size={18} />
              <span>Blocks</span>
            </div>
            <div className="landing-bubble bubble-code">
              <Code2 size={18} />
              <span>C++</span>
            </div>
            <div className="landing-bubble bubble-usb">
              <Cable size={18} />
              <span>Upload</span>
            </div>

            <article className="landing-preview-card">
              <header>
                <span>Starter Project</span>
                <strong>Blink</strong>
              </header>
              <p>One minute to get your first LED blinking.</p>
              <ol>
                <li>Build blocks</li>
                <li>Review generated code</li>
                <li>Compile and flash</li>
              </ol>
            </article>

            <article className="landing-preview-card">
              <header>
                <span>Circuit Studio</span>
                <strong>Visual wiring</strong>
              </header>
              <p>Use guided wiring checks before touching your breadboard.</p>
              <div className="landing-orbit" aria-label="workflow">
                Block → Code → Test → Upload
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
