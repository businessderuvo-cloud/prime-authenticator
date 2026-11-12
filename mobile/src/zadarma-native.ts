import { MediaStream, registerGlobals } from "@livekit/react-native-webrtc";
import { UA, WebSocketInterface } from "jssip";
import type { RTCSession } from "jssip/lib/RTCSession";

export type ZadarmaCredentials = { key: string; sip: string; domain: string };
type RemoteStream = MediaStream;

let globalsRegistered = false;
function ensureWebRtcGlobals() {
  if (globalsRegistered) return;
  registerGlobals();
  globalsRegistered = true;
}

function cleanTarget(value: string) {
  const target = value.replace(/[\s().-]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(target)) throw Error("Inserisci un numero completo in formato internazionale, per esempio +39 333 1234567.");
  return target;
}

/** Native SIP/WebRTC bridge for the same Zadarma session used by the web gestionale. */
export class ZadarmaNativeCall {
  private ua: UA | null = null;
  private session: RTCSession | null = null;
  private remote: RemoteStream | null = null;
  private stopped = false;

  constructor(private events: { status: (message: string) => void; stream: (stream: RemoteStream) => void; ended: () => void }) {}

  async start(credentials: ZadarmaCredentials, number: string) {
    ensureWebRtcGlobals();
    const target = cleanTarget(number);
    const domain = credentials.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^[a-z0-9.-]+$/i.test(domain) || !credentials.sip || !credentials.key) throw Error("Zadarma non ha restituito credenziali WebRTC valide.");
    const socket = new WebSocketInterface(`wss://${domain}:4443`);
    const ua = new UA({
      sockets: [socket],
      uri: `sip:${credentials.sip}@${domain}`,
      display_name: credentials.sip,
      register: true,
      register_expires: 580,
      authorization_user: credentials.sip,
      password: credentials.key,
      user_agent: "PRIME Mobile",
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
    });
    this.ua = ua;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { ua.stop(); reject(Error("Zadarma non ha registrato l’interno SIP.")); }, 15000);
      ua.on("registered", () => { clearTimeout(timer); resolve(); });
      ua.on("registrationFailed", () => { clearTimeout(timer); reject(Error("Zadarma ha rifiutato la registrazione WebRTC.")); });
      ua.on("disconnected", () => { if (!this.stopped) this.events.status("Collegamento WebSocket Zadarma interrotto."); });
      ua.start();
    });
    if (this.stopped) throw Error("Chiamata Zadarma annullata.");
    this.events.status("Chiamata Zadarma in avvio…");
    const session = ua.call(`sip:${target}@${domain}`, {
      mediaConstraints: { audio: true, video: false },
      pcConfig: { rtcpMuxPolicy: "require" },
      eventHandlers: {
        peerconnection: ({ peerconnection }) => {
          const attach = (event: unknown) => {
            const streams = (event as unknown as { streams?: RemoteStream[] }).streams;
            const stream = streams?.[0] || (event as unknown as { stream?: RemoteStream }).stream;
            if (stream) { this.remote = stream; this.events.stream(stream); }
          };
          peerconnection.addEventListener("track", attach);
          peerconnection.addEventListener("addstream", attach);
          const streams = (peerconnection.getRemoteStreams?.() || []) as unknown as RemoteStream[];
          if (streams[0]) { this.remote = streams[0]; this.events.stream(this.remote); }
        },
        progress: () => this.events.status("Squilla su Zadarma…"),
        accepted: () => this.events.status("Chiamata Zadarma accettata."),
        confirmed: () => this.events.status("Chiamata Zadarma attiva."),
        failed: event => { this.events.status(`Chiamata Zadarma rifiutata: ${String(event.cause || "errore")}`); this.finish(); },
        ended: () => this.finish(),
      },
    });
    this.session = session;
  }

  mute(value: boolean) {
    if (value) this.session?.mute({ audio: true });
    else this.session?.unmute({ audio: true });
  }

  dtmf(value: string) {
    if (!this.session?.isEstablished()) return;
    this.session.sendDTMF(value);
  }

  async stop() {
    this.stopped = true;
    try { this.session?.terminate(); } catch { /* sessione già terminata */ }
    this.session = null;
    try { this.ua?.unregister({ all: true }); } catch { /* UA già fermo */ }
    try { this.ua?.stop(); } catch { /* UA già fermo */ }
    this.ua = null;
    this.remote?.release?.();
    this.remote = null;
  }

  private finish() {
    if (this.stopped) return;
    this.stopped = true;
    try { this.ua?.stop(); } catch { /* UA già fermo */ }
    this.session = null;
    this.ua = null;
    this.events.ended();
  }
}
