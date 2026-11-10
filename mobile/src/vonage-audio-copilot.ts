import { AudioContext, type AudioBufferQueueSourceNode } from "react-native-audio-api";
import type { PrimeApi } from "./api";

type Mode = "voice" | "interpreter";
type Call = { ref: string; state: string };
type CallInfo = { streamUrl?: string; customerStreamUrl?: string; agentStreamUrl?: string };
type VoiceSessionControl = {
  sendUserMessage: (text: string) => void;
  setOutputMuted: (muted: boolean) => void;
};
type Events = {
  status: (text: string) => void;
  transcript: (speaker: string, text: string) => void;
  response: (text: string) => void;
  conversation: (id: string) => void;
  ended: () => void;
};

const allowedAudioHosts = new Set([
  "primegestionale.it",
  "www.primegestionale.it",
  "prime-gestionale-deruvo.fly.dev",
]);

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function resample(input: Int16Array, fromRate: number, toRate: number) {
  if (!Number.isFinite(fromRate) || fromRate < 8000 || fromRate > 96000 || !Number.isFinite(toRate) || toRate < 8000 || toRate > 96000) {
    throw Error("Formato audio Vanessa non supportato.");
  }
  if (fromRate === toRate) return input;
  const output = new Int16Array(Math.floor((input.length * toRate) / fromRate));
  for (let index = 0; index < output.length; index++) {
    const position = (index * fromRate) / toRate;
    const left = Math.floor(position);
    const blend = position - left;
    output[index] = Math.round(
      input[left] * (1 - blend) + input[Math.min(left + 1, input.length - 1)] * blend,
    );
  }
  return output;
}

function audioRate(format: string) {
  const match = /^(pcm|ulaw)_(\d+)$/.exec(format);
  if (!match) throw Error("Formato audio Vanessa non supportato.");
  const rate = Number(match[2]);
  if (rate < 8000 || rate > 96000 || (match[1] === "ulaw" && rate !== 8000)) {
    throw Error("Frequenza audio Vanessa non supportata.");
  }
  return { encoding: match[1], rate };
}

function encodeInput(input: Int16Array, format: string) {
  const { encoding, rate } = audioRate(format);
  const samples = resample(input, 16000, rate);
  if (encoding === "pcm") {
    const bytes = new Uint8Array(samples.length * 2);
    const view = new DataView(bytes.buffer);
    for (let index = 0; index < samples.length; index++) view.setInt16(index * 2, samples[index], true);
    return encodeBase64(bytes);
  }
  const bytes = new Uint8Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    const signed = samples[index];
    const sign = signed < 0 ? 128 : 0;
    const magnitude = Math.min(32635, Math.abs(signed)) + 132;
    let exponent = 7;
    for (let mask = 16384; (magnitude & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
    const mantissa = (magnitude >> (exponent + 3)) & 15;
    bytes[index] = (~(sign | (exponent << 4) | mantissa)) & 255;
  }
  return encodeBase64(bytes);
}

function decodeOutput(encoded: string, format: string) {
  const bytes = decodeBase64(encoded);
  let pcm: Int16Array;
  let sampleRate: number;
  if (format === "ulaw_8000") {
    pcm = new Int16Array(bytes.length);
    sampleRate = 8000;
    for (let index = 0; index < bytes.length; index++) {
      const value = (~bytes[index]) & 255;
      const magnitude = (((value & 15) << 3) + 132) << ((value >> 4) & 7);
      pcm[index] = (value & 128) ? 132 - magnitude : magnitude - 132;
    }
  } else {
    const match = /^pcm_(\d+)$/.exec(format);
    if (!match || bytes.byteLength % 2 !== 0) {
      throw Error("Formato audio Vanessa non supportato.");
    }
    sampleRate = Number(match[1]);
    if (sampleRate < 8000 || sampleRate > 96000) {
      throw Error("Frequenza audio Vanessa non supportata.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    pcm = new Int16Array(bytes.byteLength / 2);
    for (let index = 0; index < pcm.length; index++) pcm[index] = view.getInt16(index * 2, true);
  }
  const normalized = resample(pcm, sampleRate, 16000);
  const floats = new Float32Array(normalized.length);
  for (let index = 0; index < normalized.length; index++) floats[index] = normalized[index] / 32768;
  return floats;
}

/** Native Vonage call audio bridge for Vanessa's Copilot and interpreter. */
export class VonageAudioCopilot {
  private stopped = false;
  private callRef = "";
  private mode: Mode = "voice";
  private sockets = new Set<WebSocket>();
  private opening = new Set<(error: Error) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelDelay: (() => void) | undefined;
  private audioContext: AudioContext | null = null;
  private playback: AudioBufferQueueSourceNode | null = null;
  private latestCustomerSpeech = "";
  private agentSpeechObserved = false;

  constructor(private api: PrimeApi, private events: Events) {}

  private active() {
    if (this.stopped) throw Error("Collegamento Copilot annullato.");
  }

  private pause() {
    return new Promise<void>((resolve) => {
      this.cancelDelay = resolve;
      this.timer = setTimeout(resolve, 1500);
    }).then(() => {
      this.cancelDelay = undefined;
      this.active();
    });
  }

  private async preparePlayback() {
    this.audioContext = new AudioContext({
      sampleRate: 16000,
      latencyHint: "interactive",
      androidOutputProfile: "voiceCommunication",
    });
    this.playback = this.audioContext.createBufferQueueSource();
    this.playback.connect(this.audioContext.destination);
    await this.audioContext.resume();
    this.active();
  }

  private enqueueLocalAudio(encoded: string, format: string) {
    if (!this.audioContext || !this.playback) return;
    const samples = decodeOutput(encoded, format);
    if (!samples.length) return;
    const buffer = this.audioContext.createBuffer(1, samples.length, 16000);
    buffer.getChannelData(0).set(samples);
    this.playback.enqueueBuffer(buffer);
    if (this.playbackStarted) return;
    this.playback.start();
    this.playbackStarted = true;
  }

  private playbackStarted = false;

  private openStream(url: string) {
    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" || !allowedAudioHosts.has(parsed.hostname)) {
      throw Error("Indirizzo audio PRIME non valido.");
    }
    const stream = new WebSocket(url);
    stream.binaryType = "arraybuffer";
    this.sockets.add(stream);
    return stream;
  }

  private waitOpen(stream: WebSocket) {
    return new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        clearTimeout(timeout);
        this.opening.delete(fail);
        reject(error);
      };
      this.opening.add(fail);
      const timeout = setTimeout(() => fail(Error("Canale telefonico non raggiungibile.")), 12000);
      stream.onopen = () => {
        clearTimeout(timeout);
        this.opening.delete(fail);
        if (this.stopped) reject(Error("Collegamento annullato."));
        else resolve();
      };
      stream.onerror = () => fail(Error("Canale telefonico interrotto."));
      stream.onclose = () => {
        clearTimeout(timeout);
        this.opening.delete(fail);
        if (!this.stopped) {
          reject(Error("La chiamata telefonica è terminata."));
          void this.stop("La chiamata telefonica è terminata.");
        }
      };
    });
  }

  private async createVoiceSession(instructions?: string, outputMode: "both" | "text" | "voice" = "both") {
    const session = await this.api.post<{
      signedUrl: string;
      dynamicVariables: Record<string, string>;
      firstMessage?: string;
    }>("/api/elite/session", {
      mode: "copilot",
      agentId: "vanessa",
      language: "it",
      copilotInput: "audio",
      copilotOutput: outputMode,
    });
    return {
      signedUrl: session.signedUrl,
      firstMessage: session.firstMessage || "",
      variables: {
        ...session.dynamicVariables,
        ...(instructions ? { call_instructions: instructions } : {}),
      },
    };
  }

  private connectVoice(
    signedUrl: string,
    firstMessage: string,
    variables: Record<string, string>,
    stream: WebSocket,
    options: {
      speaker: string;
      outputToCall: boolean;
      outputToDevice: boolean;
      onTranscript?: (text: string) => void;
      onResponse?: (text: string) => void;
    },
  ) {
    return new Promise<VoiceSessionControl>((resolve, reject) => {
      const socket = new WebSocket(signedUrl);
      socket.binaryType = "arraybuffer";
      this.sockets.add(socket);
      let ready = false;
      let outputMuted = false;
      let inputFormat = "pcm_16000";
      let outputFormat = "pcm_16000";
      const timeout = setTimeout(() => fail(Error("Vanessa non ha confermato la sessione vocale.")), 15000);
      const fail = (error: Error) => {
        clearTimeout(timeout);
        this.opening.delete(fail);
        reject(error);
        if (!this.stopped) void this.stop("Sessione audio Vanessa interrotta.");
      };
      this.opening.add(fail);

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "conversation_initiation_client_data",
          dynamic_variables: variables,
          conversation_config_override: {
            agent: { first_message: firstMessage },
            conversation: { text_only: false },
          },
        }));
      };
      socket.onerror = () => fail(Error("Sessione audio Vanessa interrotta."));
      socket.onclose = () => {
        clearTimeout(timeout);
        this.opening.delete(fail);
        if (!this.stopped) {
          if (!ready) reject(Error("Vanessa ha chiuso la sessione vocale."));
          void this.stop("Sessione audio Vanessa terminata.");
        }
      };
      socket.onmessage = (event) => {
        if (this.stopped) return;
        try {
          const message = JSON.parse(String(event.data));
          if (message.type === "conversation_initiation_metadata") {
            const metadata = message.conversation_initiation_metadata_event || {};
            inputFormat = metadata.user_input_audio_format || "pcm_16000";
            outputFormat = metadata.agent_output_audio_format || "pcm_16000";
            audioRate(inputFormat);
            audioRate(outputFormat);
            if (metadata.conversation_id) this.events.conversation(metadata.conversation_id);
            ready = true;
            clearTimeout(timeout);
            this.opening.delete(fail);
            resolve({
              sendUserMessage: (text) => {
                if (!this.stopped && ready && socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({ type: "user_message", text }));
                }
              },
              setOutputMuted: (muted) => { outputMuted = muted; },
            });
          } else if (message.type === "ping") {
            socket.send(JSON.stringify({ type: "pong", event_id: message.ping_event?.event_id }));
          } else if (message.type === "user_transcript") {
            const transcript = String(message.user_transcription_event?.user_transcript || "").trim();
            if (transcript) {
              if (options.onTranscript) options.onTranscript(transcript);
              else this.events.transcript(options.speaker, transcript);
            }
          } else if (message.type === "agent_response" || message.type === "agent_response_correction") {
            const response = String(
              message.agent_response_event?.agent_response ||
                message.agent_response_correction_event?.corrected_agent_response ||
                "",
            ).trim();
            if (response) {
              if (options.onResponse) options.onResponse(response);
              else this.events.response(response);
            }
          } else if (message.type === "audio") {
            const encoded = message.audio_event?.audio_base_64;
            if (!encoded) return;
            const samples = decodeOutput(encoded, outputFormat);
            if (options.outputToCall && !outputMuted && stream.readyState === WebSocket.OPEN && samples.length) {
              const pcm = new Int16Array(samples.length);
              for (let index = 0; index < samples.length; index++) {
                pcm[index] = Math.max(-32768, Math.min(32767, Math.round(samples[index] * 32768)));
              }
              stream.send(new Uint8Array(pcm.buffer));
            }
            if (options.outputToDevice) this.enqueueLocalAudio(encoded, outputFormat);
          } else if (message.type === "interruption") {
            this.playback?.clearBuffers();
          } else if (["error", "client_error"].includes(message.type)) {
            fail(Error("ElevenLabs non ha accettato la sessione Copilot."));
          }
        } catch {
          fail(Error("Risposta audio di Vanessa non valida."));
        }
      };

      const onAudio = (event: MessageEvent) => {
        if (this.stopped || !ready || typeof event.data === "string" || socket.readyState !== WebSocket.OPEN) return;
        if (!(event.data instanceof ArrayBuffer) || event.data.byteLength < 2) return;
        const view = new DataView(event.data);
        const pcm = new Int16Array(Math.floor(event.data.byteLength / 2));
        for (let index = 0; index < pcm.length; index++) pcm[index] = view.getInt16(index * 2, true);
        socket.send(JSON.stringify({ user_audio_chunk: encodeInput(pcm, inputFormat) }));
      };
      stream.addEventListener("message", onAudio);
      stream.addEventListener("close", () => {
        stream.removeEventListener("message", onAudio);
        if (!this.stopped) void this.stop("La chiamata telefonica è terminata.");
      }, { once: true });
    });
  }

  async start(mode: Mode, outputMode: "both" | "text" | "voice" = "both") {
    this.mode = mode;
    try {
      this.events.status("Collego Vanessa alla chiamata Vonage…");
      let call: Call | undefined;
      let demoStreamUrl = "";
      if (this.api.mode === "demo") {
        if (mode === "interpreter") throw Error("L’interprete richiede una chiamata in uscita con i due canali Vonage separati; nella demo pubblica è disponibile solo il Copilot vocale in ingresso.");
        const status = await this.api.get<{ configured?: boolean; number?: string }>("/api/vonage/voice/public/status");
        this.active();
        if (!status.configured) throw Error("La linea Vonage non è disponibile nella demo Secret.");
        this.events.status(`Ascolto attivo. Chiama ${status.number || "il numero Vonage della demo Secret"}; collego Vanessa appena risponde.`);
        while (!call && !this.stopped) {
          const incoming = await this.api.post<{ state: string; callRef?: string; streamUrl?: string }>("/api/vonage/voice/public/incoming", { consent: true });
          if (this.stopped) {
            if (incoming.callRef) await this.api.change(`/api/vonage/voice/public/calls/${encodeURIComponent(incoming.callRef)}/monitor`, "DELETE", {}).catch(() => {});
            await this.api.change("/api/vonage/voice/public/incoming", "DELETE", {}).catch(() => {});
            throw Error("Collegamento annullato.");
          }
          this.active();
          if (incoming.state === "connected" && incoming.callRef && incoming.streamUrl) {
            call = { ref: incoming.callRef, state: incoming.state }; demoStreamUrl = incoming.streamUrl;
          } else if (incoming.state === "listening") throw Error("Copilot è già collegato a questa chiamata in un’altra sessione.");
          else await this.pause();
        }
      } else {
        while (!call && !this.stopped) {
          const active = await this.api.get<{ multiple?: boolean; call?: Call }>("/api/vonage/voice/active-call");
          this.active();
          if (active.multiple) throw Error("Sono attive più chiamate Vonage. Lasciane una sola per avviare Copilot.");
          if (active.call?.state === "connected") call = active.call;
          else await this.pause();
        }
      }
      this.active();
      if (!call) throw Error("Chiamata Vonage non disponibile.");
      this.callRef = call.ref;

      if (mode === "voice") {
        const monitor = this.api.mode === "demo"
          ? { streamUrl: demoStreamUrl }
          : await this.api.post<CallInfo>(`/api/elite/vonage-calls/${encodeURIComponent(this.callRef)}/monitor`, {});
        if (this.stopped) {
          await this.api.change(this.api.mode === "demo"
            ? `/api/vonage/voice/public/calls/${encodeURIComponent(this.callRef)}/monitor`
            : `/api/elite/vonage-calls/${encodeURIComponent(this.callRef)}/monitor`, "DELETE", {}).catch(() => {});
          throw Error("Collegamento annullato.");
        }
        this.active();
        if (!monitor.streamUrl) throw Error("Vonage non ha fornito l’audio della chiamata.");
        const stream = this.openStream(monitor.streamUrl);
        await this.waitOpen(stream);
        await this.preparePlayback();
        const agent = await this.createVoiceSession(undefined, outputMode);
        this.active();
        await this.connectVoice(agent.signedUrl, agent.firstMessage, agent.variables, stream, {
          speaker: "Chiamata · trascrizione live",
          outputToCall: false,
          outputToDevice: outputMode !== "text",
          onResponse: outputMode === "voice" ? () => {} : (text) => this.events.response(`Suggerimento · ${text}`),
        });
      } else {
        const legs = await this.api.post<CallInfo>(`/api/elite/vonage-calls/${encodeURIComponent(this.callRef)}/interpreter`, {});
        this.active();
        if (!legs.customerStreamUrl || !legs.agentStreamUrl) {
          throw Error("Vonage non ha fornito entrambi i canali della chiamata.");
        }
        const customer = this.openStream(legs.customerStreamUrl);
        const agent = this.openStream(legs.agentStreamUrl);
        await Promise.all([this.waitOpen(customer), this.waitOpen(agent)]);
        await this.preparePlayback();
        const [clientSession, operatorSession] = await Promise.all([
          this.createVoiceSession(
            "Modalità Copilot interprete vocale: ricevi solo l’audio del cliente. Traduci ogni battuta in italiano per l’agente e pronuncia la traduzione in italiano. Subito dopo, fornisci all’agente un suggerimento breve e concreto su come rispondere. Non rispondere autonomamente al cliente e non inventare contenuti.",
          ),
          this.createVoiceSession(
            "Modalità Copilot interprete vocale: ricevi solo l’audio dell’agente umano. I messaggi testuali che iniziano con Riferimento lingua cliente servono soltanto a identificare la lingua di destinazione: non rispondere a quei messaggi. Quando senti la battuta audio dell’agente, traducila fedelmente nella lingua usata dal cliente e pronuncia al cliente soltanto la traduzione. Non aggiungere risposte, suggerimenti o commenti.",
          ),
        ]);
        this.active();
        let operatorControl: VoiceSessionControl | null = null;
        const [customerControl, connectedOperator] = await Promise.all([
          this.connectVoice(clientSession.signedUrl, clientSession.firstMessage, clientSession.variables, customer, {
            speaker: "Cliente",
            outputToCall: true,
            outputToDevice: true,
            onTranscript: (text) => {
              this.latestCustomerSpeech = text;
              this.agentSpeechObserved = false;
              operatorControl?.setOutputMuted(true);
              this.events.transcript("Cliente", text);
              operatorControl?.sendUserMessage(`Riferimento lingua cliente, non rispondere a questo messaggio: il cliente ha detto «${text}». Rileva la lingua usata e conservala come lingua di destinazione. Attendi la successiva battuta audio dell’agente; solo allora pronuncia la traduzione in quella lingua.`);
            },
            onResponse: (text) => this.events.response(`Traduzione e suggerimento · ${text}`),
          }),
          this.connectVoice(operatorSession.signedUrl, operatorSession.firstMessage, operatorSession.variables, agent, {
            speaker: "Agente",
            outputToCall: true,
            outputToDevice: false,
            onTranscript: (text) => {
              this.agentSpeechObserved = true;
              operatorControl?.setOutputMuted(false);
              this.events.transcript("Agente", text);
            },
            onResponse: (text) => {
              if (this.agentSpeechObserved) this.events.response(`Traduzione al cliente · ${text}`);
            },
          }),
        ]);
        operatorControl = connectedOperator;
        if (this.latestCustomerSpeech) {
          operatorControl.setOutputMuted(!this.agentSpeechObserved);
          operatorControl.sendUserMessage(`Riferimento lingua cliente, non rispondere a questo messaggio: il cliente ha detto «${this.latestCustomerSpeech}». Rileva la lingua usata e conservala come lingua di destinazione. Attendi la successiva battuta audio dell’agente; solo allora pronuncia la traduzione in quella lingua.`);
        }
        void customerControl;
      }
      this.active();
      this.events.status(mode === "voice" ? "Copilot vocale attivo sulla chiamata Vonage." : "Interprete attivo sui due canali Vonage.");
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(message?: string) {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    this.cancelDelay?.();
    for (const reject of this.opening) reject(Error("Collegamento annullato."));
    this.opening.clear();
    for (const socket of this.sockets) {
      try {
        socket.close();
      } catch {
        // Socket già chiuso.
      }
    }
    this.sockets.clear();
    try { this.playback?.stop(); } catch { /* Audio source non ancora avviata. */ }
    try { this.playback?.disconnect(); } catch { /* Grafo già scollegato. */ }
    this.playback = null;
    if (this.audioContext) await this.audioContext.close().catch(() => undefined);
    this.audioContext = null;
    this.playbackStarted = false;
    if (this.callRef) {
      await this.api
        .change(this.api.mode === "demo"
          ? `/api/vonage/voice/public/calls/${encodeURIComponent(this.callRef)}/${this.mode === "interpreter" ? "interpreter" : "monitor"}`
          : `/api/elite/vonage-calls/${encodeURIComponent(this.callRef)}/${this.mode === "interpreter" ? "interpreter" : "monitor"}`,
          "DELETE", {})
        .catch(() => {});
    }
    if (this.api.mode === "demo") await this.api.change("/api/vonage/voice/public/incoming", "DELETE", {}).catch(() => {});
    if (message) this.events.status(message);
    this.events.ended();
  }
}
