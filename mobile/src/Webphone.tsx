/* eslint-disable react-hooks/refs -- native audio refs are only read by event handlers and cleanup. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform, Pressable, Text, TextInput, View } from "react-native";
import { AudioContext, AudioRecorder, type AudioBufferQueueSourceNode } from "react-native-audio-api";
import { RTCView, type MediaStream } from "@livekit/react-native-webrtc";
import type { PrimeApi } from "./api";
import { ZadarmaNativeCall, type ZadarmaCredentials } from "./zadarma-native";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
type Provider = "vonage" | "zadarma";
type TelephonyProvider = { provider?: string; configured?: boolean; connected?: boolean; verified_at?: string; sip?: string; demo?: boolean };
type TelephonyStatus = { providers?: TelephonyProvider[] };

const allowedHosts = new Set(["primegestionale.it", "www.primegestionale.it", "prime-gestionale-deruvo.fly.dev"]);

function pcm16(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return bytes;
}

function decodePcm(bytes: ArrayBuffer) {
  if (bytes.byteLength < 2) return new Float32Array(0);
  const view = new DataView(bytes);
  const result = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < result.length; i += 1) result[i] = view.getInt16(i * 2, true) / 32768;
  return result;
}

export default function Webphone({ api, colors: c, demo, enabled }: { api: PrimeApi; colors: Colors; demo: boolean; enabled: boolean }) {
  const [providers, setProviders] = useState<TelephonyProvider[]>([]);
  const [provider, setProvider] = useState<Provider>("vonage");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState("");
  const [calling, setCalling] = useState(false);
  const [muted, setMuted] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const recorder = useRef<AudioRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const playback = useRef<AudioBufferQueueSourceNode | null>(null);
  const playbackStarted = useRef(false);
  const callRef = useRef("");
  const zadarma = useRef<ZadarmaNativeCall | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const refresh = useCallback(async () => {
    const result = await api.get<TelephonyStatus>("/api/connect/telephony").catch(() => ({ providers: [] }));
    const next = result.providers || [];
    setProviders(next);
    const preferred = await api.get<{ provider?: Provider }>("/api/elite/telephony/provider").catch(() => ({} as { provider?: Provider }));
    const available = next.filter(item => item.configured === true || item.connected === true || (item.provider === "vonage" && demo));
    if (preferred.provider && available.some(item => item.provider === preferred.provider)) setProvider(preferred.provider);
    else if (available.some(item => item.provider === "vonage")) setProvider("vonage");
    else if (available.some(item => item.provider === "zadarma")) setProvider("zadarma");
  }, [api, demo]);

  const available = (id: Provider) => {
    if (demo) {
      if (!enabled) return false;
      if (id === "vonage") return true;
      const item = providers.find(value => value.provider === id);
      return item?.configured === true || item?.connected === true || item?.demo === true;
    }
    const item = providers.find(value => value.provider === id);
    return item?.configured === true || item?.connected === true;
  };

  const stopCall = useCallback(async () => {
    const ref = callRef.current;
    callRef.current = "";
    await zadarma.current?.stop();
    zadarma.current = null;
    setRemoteStream(null);
    try { await recorder.current?.stop(); } catch { /* già fermo */ }
    recorder.current?.clearOnAudioReady();
    recorder.current = null;
    socket.current?.close();
    socket.current = null;
    try { playback.current?.stop(); } catch { /* già fermo */ }
    try { playback.current?.disconnect(); } catch { /* già scollegato */ }
    playback.current = null;
    playbackStarted.current = false;
    if (context.current) await context.current.close().catch(() => undefined);
    context.current = null;
    if (ref) {
      const base = demo ? "/api/vonage/voice/public/calls" : "/api/elite/vonage-calls";
      await api.post(`${base}/${encodeURIComponent(ref)}/hangup`, {}).catch(() => {});
    }
    setCalling(false);
    setMuted(false);
  }, [api, demo]);

  useEffect(() => {
    const firstRefresh = setTimeout(() => { void refresh().catch(() => {}); }, 0);
    return () => clearTimeout(firstRefresh);
  }, [refresh]);
  useEffect(() => () => { void stopCall(); }, [stopCall]);

  async function chooseProvider(next: Provider) {
    if (calling || !available(next)) return;
    setProvider(next);
    if (!demo) await api.change("/api/elite/telephony/provider", "PUT", { provider: next }).catch(error => setStatus(error instanceof Error ? error.message : "Provider non selezionabile."));
  }

  async function call() {
    if (!enabled || calling) return;
    const target = number.replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(target)) { setStatus("Inserisci un numero completo in formato internazionale, per esempio +39 333 1234567."); return; }
    if (!available(provider)) { setStatus("Collega prima Vonage o Zadarma da PRIME Connect."); return; }
    if (Platform.OS === "android") {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) { setStatus("Autorizza il microfono per effettuare la chiamata."); return; }
    }
    setCalling(true); setStatus("Avvio della chiamata Vonage…");
    try {
      if (provider === "zadarma") {
        setStatus("Collego l’interno SIP Zadarma…");
        const credentials = await api.get<ZadarmaCredentials>("/api/elite/telephony/session?mode=dial");
        const bridge = new ZadarmaNativeCall({
          status: setStatus,
          stream: setRemoteStream,
          ended: () => { zadarma.current = null; setRemoteStream(null); setCalling(false); setMuted(false); setStatus("Chiamata Zadarma terminata."); },
        });
        zadarma.current = bridge;
        await bridge.start(credentials, target);
        setStatus("Chiamata Zadarma attiva. Usa il tastierino per i menu automatici.");
        return;
      }
      setStatus("Avvio della chiamata Vonage…");
      const result = await api.post<{ callRef?: string; operatorStreamUrl?: string }>(demo ? "/api/vonage/voice/public/outbound" : "/api/elite/vonage-calls/direct", { phone: target, authorized: true, consent: true, browserAudio: true });
      if (!result.callRef || !result.operatorStreamUrl) throw Error("Il gestionale non ha restituito il collegamento audio.");
      const url = new URL(result.operatorStreamUrl);
      if (url.protocol !== "wss:" || !allowedHosts.has(url.hostname)) throw Error("Collegamento audio PRIME non valido.");
      callRef.current = result.callRef;
      const audio = new AudioContext({ sampleRate: 16000, latencyHint: "interactive", androidOutputProfile: "voiceCommunication" });
      context.current = audio;
      playback.current = audio.createBufferQueueSource();
      playback.current.connect(audio.destination);
      await audio.resume();
      const stream = new WebSocket(result.operatorStreamUrl);
      stream.binaryType = "arraybuffer";
      socket.current = stream;
      stream.onmessage = event => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const samples = decodePcm(event.data);
        if (!samples.length || !context.current || !playback.current) return;
        const buffer = context.current.createBuffer(1, samples.length, 16000);
        buffer.getChannelData(0).set(samples);
        playback.current.enqueueBuffer(buffer);
        if (!playbackStarted.current) { playback.current.start(); playbackStarted.current = true; }
      };
      stream.onerror = () => setStatus("Canale audio telefonico interrotto.");
      stream.onclose = () => { void stopCall(); };
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error("Canale telefonico non raggiungibile.")), 12000);
        stream.onopen = () => { clearTimeout(timer); resolve(); };
        stream.onerror = () => { clearTimeout(timer); reject(Error("Canale telefonico interrotto.")); };
      });
      const input = new AudioRecorder({ androidInputPreset: "voiceCommunication", iosVoiceProcessing: true });
      recorder.current = input;
      input.onAudioReady({ sampleRate: 16000, bufferLength: 1024, channelCount: 1 }, event => {
        if (!muted && stream.readyState === WebSocket.OPEN) stream.send(pcm16(event.buffer.getChannelData(0)));
      });
      const started = await input.start();
      if (started.status === "error") throw Error(started.message || "Microfono non disponibile.");
      setStatus("Chiamata in corso. Usa il tastierino per i menu automatici.");
    } catch (error) {
      await stopCall();
      setStatus(error instanceof Error ? error.message : "Chiamata non riuscita.");
    }
  }

  async function digit(value: string) {
    if (!calling) { if (value === "+" && number.length) return; setNumber(current => current + value); return; }
    if (provider === "zadarma") { zadarma.current?.dtmf(value); setStatus(`Tasto ${value} inviato alla chiamata Zadarma.`); return; }
    if (!callRef.current) return;
    const base = demo ? "/api/vonage/voice/public/calls" : "/api/elite/vonage-calls";
    await api.post(`${base}/${encodeURIComponent(callRef.current)}/dtmf`, { digits: value }).then(() => setStatus(`Tasto ${value} inviato alla chiamata.`)).catch(error => setStatus(error instanceof Error ? error.message : "Tasto non inviato."));
  }

  const panel = { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 14 } as const;
  const button = (label: string, fn: () => void, disabled = false) => <Pressable onPress={fn} disabled={disabled} style={{ borderColor: c.line, borderWidth: 1, borderRadius: 9, padding: 13, opacity: disabled ? 0.5 : 1 }}><Text style={{ color: c.accent, textAlign: "center", fontWeight: "600" }}>{label}</Text></Pressable>;
  return <View style={{ gap: 16 }}>
    <View style={panel}><Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>Webphone PRIME</Text><Text style={{ color: c.muted }}>Chiama dal telefono nativo scegliendo il provider collegato, con microfono, audio e DTMF.</Text>
      {!enabled && <Text style={{ color: c.muted }}>Il Webphone è visibile nella demo, ma le chiamate sono disponibili solo nel piano Secret o nel workspace Live.</Text>}
      <Text style={{ color: c.muted }}>Provider della chiamata</Text><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{(["vonage", "zadarma"] as Provider[]).map(id => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: provider === id }} onPress={() => void chooseProvider(id)} disabled={!available(id) || calling} style={{ borderColor: provider === id ? c.accent : c.line, borderWidth: 1, borderRadius: 9, padding: 10, opacity: available(id) ? 1 : 0.45 }}><Text style={{ color: provider === id ? c.accent : c.text }}>{id === "vonage" ? "Vonage" : "Zadarma"} · {available(id) ? "collegato" : "non disponibile"}</Text></Pressable>)}</View>
      <TextInput value={number} onChangeText={setNumber} editable={!calling && enabled} keyboardType="phone-pad" placeholder="+39…" placeholderTextColor={c.muted} style={{ color: c.text, borderColor: c.line, borderWidth: 1, borderRadius: 9, padding: 13 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>{["1","2","3","4","5","6","7","8","9","+","0","#"].map(value => <Pressable key={value} onPress={() => void digit(value)} disabled={!enabled} style={{ width: "29%", borderColor: c.line, borderWidth: 1, borderRadius: 9, padding: 14, opacity: enabled ? 1 : 0.5 }}><Text style={{ color: c.text, textAlign: "center", fontSize: 18 }}>{value}</Text></Pressable>)}</View>
      {!calling ? button("Chiama senza Copilot", () => void call(), !enabled) : <>{button(muted ? "Riattiva microfono" : "Disattiva microfono", () => setMuted(value => { const next = !value; zadarma.current?.mute(next); return next; }))}{button("Termina chiamata", () => { Alert.alert("Termina chiamata", "Vuoi terminare la chiamata?", [{ text: "Annulla", style: "cancel" }, { text: "Termina", style: "destructive", onPress: () => void stopCall() }]); })}</>}
      {!!status && <Text accessibilityRole="alert" style={{ color: c.muted }}>{status}</Text>}
    </View>
    {remoteStream && <RTCView accessibilityLabel="Audio remoto Zadarma" streamURL={remoteStream.toURL()} style={{ width: 1, height: 1, opacity: 0 }} />}
    {button("Aggiorna collegamenti", () => void refresh())}
  </View>;
}
