import { describe, expect, it } from "vitest";
import { renderAgentLandingPage, type AgentLandingStatus } from "./landingPage";

function status(overrides: Partial<AgentLandingStatus> = {}): AgentLandingStatus {
  return {
    port: 47631,
    cli: "arduino-cli",
    cliAvailable: true,
    cliDetail: "Version: 1.2.3",
    boardCount: 3,
    webAppUrl: "https://pisces123.github.io/arduino-blocks-lab/",
    docsUrl: "https://github.com/pisces123/arduino-blocks-lab/blob/main/docs/agent-setup.md",
    ...overrides
  };
}

describe("renderAgentLandingPage", () => {
  it("renders a friendly running status with app and health links", () => {
    const html = renderAgentLandingPage(status());

    expect(html).toContain("Agent is running");
    expect(html).toContain("Open Web App");
    expect(html).toContain("Health JSON");
    expect(html).toContain("Port 47631");
    expect(html).toContain("Ready");
  });

  it("shows Arduino CLI setup state when CLI is unavailable", () => {
    const html = renderAgentLandingPage(
      status({
        cliAvailable: false,
        cliDetail: "spawn arduino-cli ENOENT"
      })
    );

    expect(html).toContain("Needs setup");
    expect(html).toContain("spawn arduino-cli ENOENT");
  });

  it("escapes dynamic strings", () => {
    const html = renderAgentLandingPage(
      status({
        cli: "<script>alert(1)</script>",
        cliDetail: "bad <b>detail</b>",
        webAppUrl: "https://example.com/?x=<tag>",
        docsUrl: "https://example.com/docs?x=<tag>"
      })
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("bad <b>detail</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("bad &lt;b&gt;detail&lt;/b&gt;");
    expect(html).toContain("https://example.com/?x=&lt;tag&gt;");
  });
});
