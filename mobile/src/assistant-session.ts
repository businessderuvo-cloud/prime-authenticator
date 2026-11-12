import type { PrimeApi } from "./api";

export type AssistantMode = "workspace" | "voice" | "copilot" | "copilot_text";

type SessionOptions = {
  mode: Exclude<AssistantMode, "copilot_text">;
  native?: boolean;
  copilotInput?: "text" | "audio";
  copilotOutput?: "text" | "voice" | "both";
};

type SessionCredentials = {
  sessionLease?: string;
  conversationToken?: string;
  signedUrl?: string;
  dynamicVariables: Record<string, string>;
  firstMessage: string;
};

export class AssistantSession {
  private lease: string | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private registrations = new Map<string, Promise<unknown>>();
  private opening: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(private api: PrimeApi, private agentId: string) {}

  async open(options: SessionOptions) {
    const previous = this.opening;
    let unlock!: () => void;
    this.opening = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    try {
      if (this.closed) throw Error("Sessione annullata.");
      const credentials = await this.api.post<SessionCredentials>("/api/elite/session", {
        ...options,
        agentId: this.agentId,
        language: "it",
        sessionLease: this.lease,
      });
      if (this.closed) throw Error("Sessione annullata.");
      this.lease = credentials.sessionLease || this.lease;
      if (this.lease && !this.heartbeat) {
        this.heartbeat = setInterval(() => {
          void this.api.post("/api/elite/session/heartbeat", { sessionLease: this.lease }).catch(() => {});
        }, 30000);
      }
      return credentials;
    } finally {
      unlock();
    }
  }

  track(conversationId: string, mode: AssistantMode) {
    if (!conversationId || this.registrations.has(conversationId)) return;
    const registration = this.api.post("/api/elite/conversations", {
      conversationId,
      mode,
      agentId: this.agentId,
      sessionLease: this.lease,
    }).catch(() => {});
    this.registrations.set(conversationId, registration);
    if (this.closed) void this.finish(conversationId);
  }

  async finish(conversationId: string) {
    const registration = this.registrations.get(conversationId);
    if (!registration) return;
    this.registrations.delete(conversationId);
    await registration;
    await this.api.post("/api/elite/conversations/finish", {
      conversationId,
      sessionLease: this.lease,
    }).catch(() => {});
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    await Promise.all([...this.registrations.keys()].map(id => this.finish(id)));
  }
}

export function signedAssistantSocket(address?: string) {
  const url = address ? new URL(address) : null;
  if (!url || url.protocol !== "wss:" || url.hostname !== "api.elevenlabs.io" || url.username || url.password) {
    throw Error("Collegamento con l’assistente non disponibile.");
  }
  return new WebSocket(url.toString());
}
