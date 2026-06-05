import { describe, expect, it } from "vitest";
import { AGENT_STATUS_URL, AGENT_URL } from "./agentClient";

describe("agent client URLs", () => {
  it("points the web app at the localhost helper and its status page", () => {
    expect(AGENT_URL).toBe("http://127.0.0.1:47631");
    expect(AGENT_STATUS_URL).toBe("http://127.0.0.1:47631/");
  });
});
