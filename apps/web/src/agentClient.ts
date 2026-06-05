export const AGENT_URL = "http://127.0.0.1:47631";
export const AGENT_STATUS_URL = `${AGENT_URL}/`;

export type AgentResponse<T = unknown> = {
  ok: boolean;
  method?: string;
  data?: T;
  error?: string;
};

export async function agentHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AGENT_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function agentRpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<AgentResponse<T>> {
  try {
    const response = await fetch(`${AGENT_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params })
    });
    return (await response.json()) as AgentResponse<T>;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function openAgentEvents(onMessage: (message: unknown) => void) {
  const socket = new WebSocket("ws://127.0.0.1:47631/events");
  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage(event.data);
    }
  });
  return socket;
}
