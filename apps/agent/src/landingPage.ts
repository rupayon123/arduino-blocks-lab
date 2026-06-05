export type AgentLandingStatus = {
  port: number;
  cli: string;
  cliAvailable: boolean;
  cliDetail?: string;
  boardCount: number;
  webAppUrl: string;
  docsUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderAgentLandingPage(status: AgentLandingStatus) {
  const cliState = status.cliAvailable ? "Ready" : "Needs setup";
  const cliTone = status.cliAvailable ? "ready" : "warning";
  const escapedCli = escapeHtml(status.cli);
  const escapedDetail = escapeHtml(status.cliDetail ?? (status.cliAvailable ? "Arduino CLI is answering." : "Install Arduino CLI, then restart this helper."));
  const escapedWebAppUrl = escapeHtml(status.webAppUrl);
  const escapedDocsUrl = escapeHtml(status.docsUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Arduino Blocks Lab Agent</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #fffefd;
        --ink: #173246;
        --muted: #5e7281;
        --line: #b7d8e8;
        --blue: #14a8e0;
        --deep-blue: #1179ba;
        --piplup: #8ad9ff;
        --green: #2fa66f;
        --amber: #ffc83d;
        --coral: #f36c52;
        --soft-blue: #dff5ff;
        --soft-green: #dff7ea;
        --soft-amber: #fff2bf;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #eaf7ff, #fffefd);
        color: var(--ink);
      }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      main {
        width: min(880px, 100%);
        display: grid;
        gap: 18px;
      }
      .hero, .panel {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--paper);
        box-shadow: 0 18px 38px rgba(17, 121, 186, 0.14);
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        align-items: center;
        padding: 26px;
        background: linear-gradient(135deg, var(--soft-blue), var(--paper));
      }
      .mark {
        width: 76px;
        height: 76px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--deep-blue), var(--blue), var(--piplup));
        color: white;
        font-size: 34px;
        font-weight: 900;
        box-shadow: 0 6px 0 rgba(17, 121, 186, 0.22);
      }
      h1, h2, p { margin: 0; }
      h1 { font-size: clamp(30px, 5vw, 48px); line-height: 1; letter-spacing: 0; }
      h2 { font-size: 16px; }
      p { color: var(--muted); line-height: 1.45; }
      .status-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .tile {
        min-width: 0;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--paper);
      }
      .tile span {
        display: block;
        margin-bottom: 5px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 760;
        text-transform: uppercase;
      }
      .tile strong {
        display: block;
        overflow-wrap: anywhere;
        font-size: 18px;
      }
      .tile.ready { background: var(--soft-green); border-color: color-mix(in srgb, var(--green) 44%, var(--line)); }
      .tile.warning { background: var(--soft-amber); border-color: color-mix(in srgb, var(--amber) 62%, var(--line)); }
      .panel {
        display: grid;
        gap: 14px;
        padding: 18px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      a, code {
        border-radius: 8px;
      }
      a {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 14px;
        border: 1px solid var(--line);
        background: var(--soft-blue);
        color: var(--deep-blue);
        font-weight: 800;
        text-decoration: none;
      }
      a.primary {
        background: var(--deep-blue);
        border-color: var(--deep-blue);
        color: white;
      }
      code {
        display: inline-block;
        padding: 2px 6px;
        background: #0d2e46;
        color: #def5ff;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 13px;
      }
      ul {
        display: grid;
        gap: 8px;
        margin: 0;
        padding-left: 20px;
        color: var(--muted);
      }
      li strong { color: var(--ink); }
      @media (max-width: 720px) {
        body { padding: 14px; }
        .hero { grid-template-columns: 1fr; }
        .mark { width: 58px; height: 58px; font-size: 26px; }
        .status-grid { grid-template-columns: 1fr; }
        .actions a { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <h1>Agent is running</h1>
          <p>This local helper lets the public Arduino Blocks Lab app detect USB boards, compile sketches, upload to Arduino, and open the serial monitor.</p>
        </div>
        <div class="mark" aria-hidden="true">A</div>
      </section>

      <section class="status-grid" aria-label="Agent status">
        <div class="tile ready">
          <span>Local helper</span>
          <strong>Port ${status.port}</strong>
        </div>
        <div class="tile ${cliTone}">
          <span>Arduino CLI</span>
          <strong>${cliState}</strong>
        </div>
        <div class="tile">
          <span>Starter boards</span>
          <strong>${status.boardCount}</strong>
        </div>
      </section>

      <section class="panel">
        <h2>Next step</h2>
        <p>Keep this terminal open, then return to the web app and click <strong>Check agent</strong> in the Board panel.</p>
        <div class="actions">
          <a class="primary" href="${escapedWebAppUrl}">Open Web App</a>
          <a href="${escapedDocsUrl}">Setup Guide</a>
          <a href="/health">Health JSON</a>
        </div>
      </section>

      <section class="panel">
        <h2>Connection details</h2>
        <ul>
          <li><strong>CLI path:</strong> <code>${escapedCli}</code></li>
          <li><strong>CLI status:</strong> ${escapedDetail}</li>
          <li><strong>Events socket:</strong> <code>ws://127.0.0.1:${status.port}/events</code></li>
          <li><strong>RPC endpoint:</strong> <code>http://127.0.0.1:${status.port}/rpc</code></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}
