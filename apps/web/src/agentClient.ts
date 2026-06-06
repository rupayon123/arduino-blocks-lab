export const AGENT_URL = "http://127.0.0.1:47631";
export const AGENT_STATUS_URL = `${AGENT_URL}/`;

const AGENT_REQUEST_TIMEOUT_MS = 9000;
const AGENT_RETRY_COUNT = 2;

type AgentRetryableResult = {
  retriable: boolean;
  message: string;
};

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error === "string") return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("failed to fetch") || message.includes("network") || message.includes("timeout") || message.includes("aborted");
  }
  return true;
}

function agentRequestError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = AGENT_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAgentRpc<T>(method: string, params?: Record<string, unknown>): Promise<AgentRetryableResult & { response?: AgentResponse<T> }> {
  try {
    const response = await fetchWithTimeout(`${AGENT_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params })
    });
    const body = (await response.json()) as AgentResponse<T>;

    if (!response.ok || typeof body?.ok !== "boolean") {
      const reason = body?.error ?? `${response.status} ${response.statusText}`;
      return { retriable: response.status >= 500, message: reason, response: { ...(body ?? { ok: false }), ok: Boolean(body?.ok) } };
    }

    return { retriable: false, message: "", response: body };
  } catch (error) {
    return {
      retriable: isRetryableError(error),
      message: agentRequestError(error)
    };
  }
}

export type AgentResponse<T = unknown> = {
  ok: boolean;
  method?: string;
  data?: T;
  error?: string;
};

export async function agentHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${AGENT_URL}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function agentRpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<AgentResponse<T>> {
  for (let attempt = 0; attempt < AGENT_RETRY_COUNT; attempt += 1) {
    const outcome = await fetchAgentRpc<T>(method, params);
    if (!outcome.retriable) {
      return outcome.response ?? { ok: false, error: outcome.message };
    }

    if (attempt + 1 >= AGENT_RETRY_COUNT) {
      return { ok: false, error: outcome.message };
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 240 + attempt * 260);
    });
  }

  return { ok: false, error: "Agent request failed after retries." };
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
