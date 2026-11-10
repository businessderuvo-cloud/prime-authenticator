/* eslint-disable react-hooks/refs -- button() only forwards callbacks to Pressable.onPress; refs are accessed by events, never during render. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, PermissionsAndroid, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useConversation } from "@elevenlabs/react-native";
import ReactNativeForegroundService from "@supersami/rn-foreground-service";
import { PrimeApi } from "./api";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
export default function Vanessa({ api, colors: c, allowed }: { api: PrimeApi; colors: Colors; allowed: boolean }) {
  const socket = useRef<WebSocket | null>(null);
  const conversation = useRef("");
  const accessToken = useRef("");
  const refreshProposalsRef = useRef<() => Promise<void>>(async () => {});
  const generation = useRef(0);
  const [mode, setMode] = useState<"workspace" | "copilot">("workspace");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [proposals, setProposals] = useState<{ id: string; payload: Record<string, unknown> }[]>([]);
  const refreshProposals = useCallback(async () => {
    setProposals(await api.get("/api/elite/proposals"));
  }, [api]);
  useEffect(() => { refreshProposalsRef.current = refreshProposals; }, [refreshProposals]);
  const clientTools = useMemo(() => ({
    prime_workspace: async (parameters: Record<string, unknown>) => {
      if (!accessToken.current) throw Error("Sessione PRIME scaduta. Avvia di nuovo Vanessa.");
      const result = await api.eliteTool(parameters, accessToken.current);
      void refreshProposalsRef.current().catch(() => {});
      return JSON.stringify(result);
    },
  }), [api]);
  const voice = useConversation({
    clientTools,
    onConnect: ({ conversationId }) => {
      conversation.current = conversationId;
      setStatus("Conversazione vocale Vanessa collegata.");
      void api.post("/api/elite/conversations", { conversationId, mode: "voice" }).catch(() => {});
    },
    onDisconnect: () => {
      const id = conversation.current;
      conversation.current = "";
      if (id) void api.post("/api/elite/conversations/finish", { conversationId: id }).catch(() => {});
      if (Platform.OS === "android") void ReactNativeForegroundService.stopAll().catch(() => {});
      setStatus("Conversazione vocale terminata.");
    },
    onError: (message) => {
      if (Platform.OS === "android") void ReactNativeForegroundService.stopAll().catch(() => {});
      setStatus(message || "Connessione audio interrotta.");
    },
    onMessage: ({ role, message }) => append(role === "user" ? "Tu" : "Vanessa", message),
  });
  const [voiceConsent, setVoiceConsent] = useState(false);
  async function startVoice() {
    if (!allowed || busy) return;
    if (!voiceConsent) { setStatus("Autorizza l’uso del microfono per avviare la conversazione."); return; }
    setBusy(true);
    setStatus("Preparo la conversazione vocale…");
    try {
      if (Platform.OS === "android") {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw Error("Autorizza il microfono per parlare con Vanessa.");
      }
      const data = await api.post<{ conversationToken?: string; dynamicVariables: Record<string, string>; firstMessage: string }>(
        "/api/elite/session",
        { mode: "voice", agentId: "vanessa", language: "it", native: true },
      );
      if (!data.conversationToken) throw Error("Il gestionale non ha restituito il token nativo per Vanessa. Aggiorna il servizio PRIME e riprova.");
      accessToken.current = data.dynamicVariables.secret__prime_access_token || "";
      if (Platform.OS === "android") await ReactNativeForegroundService.start({
        id: 7310,
        title: "PRIME · Vanessa",
        message: "Conversazione vocale attiva",
        ServiceType: "microphone",
        icon: "ic_launcher",
        importance: "low",
      } as Parameters<typeof ReactNativeForegroundService.start>[0]);
      voice.startSession({
        conversationToken: data.conversationToken,
        dynamicVariables: data.dynamicVariables,
        overrides: { agent: { firstMessage: data.firstMessage }, conversation: { textOnly: false } },
      });
      setStatus("Collegamento audio in corso…");
    } catch (error) {
      if (Platform.OS === "android") void ReactNativeForegroundService.stopAll().catch(() => {});
      setStatus(error instanceof Error ? error.message : "Avvio della conversazione non riuscito.");
    } finally {
      setBusy(false);
    }
  }
  const stop = () => {
    generation.current += 1;
    socket.current?.close(); socket.current = null;
    if (voice.status !== "disconnected") {
      void voice.endSession();
      if (Platform.OS === "android") void ReactNativeForegroundService.stopAll().catch(() => {});
    } else {
      const id = conversation.current; conversation.current = "";
      if (id) void api.post("/api/elite/conversations/finish", { conversationId: id }).catch(() => {});
    }
  };
  useEffect(() => () => stop(), [api]); // eslint-disable-line react-hooks/exhaustive-deps
  const append = (role: string, text: string) => setMessages(old => [...old, { role, text }]);
  async function connect() {
    if (socket.current?.readyState === WebSocket.OPEN && conversation.current) return socket.current;
    stop();
    const version = generation.current;
    const data = await api.post<{ signedUrl: string; dynamicVariables: Record<string, string>; firstMessage: string }>("/api/elite/session", {
      mode, agentId: "vanessa", language: "it", copilotInput: "text", copilotOutput: "text",
    });
    if (generation.current !== version) throw Error("Sessione annullata.");
    const url = new URL(data.signedUrl);
    if (url.protocol !== "wss:" || url.hostname !== "api.elevenlabs.io") throw Error("Sessione Vanessa non valida.");
    const ws = new WebSocket(data.signedUrl); socket.current = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(Error("Vanessa non ha risposto. Riprova.")); }, 20000);
      ws.onopen = () => ws.send(JSON.stringify({ type: "conversation_initiation_client_data", dynamic_variables: data.dynamicVariables,
        conversation_config_override: { conversation: { text_only: true }, agent: { first_message: data.firstMessage } } }));
      ws.onerror = () => { clearTimeout(timer); reject(Error("Collegamento Vanessa interrotto.")); };
      ws.onclose = () => { clearTimeout(timer); if (socket.current === ws) { socket.current = null; setStatus("Sessione terminata."); } reject(Error("Sessione terminata.")); };
      ws.onmessage = event => {
        if (generation.current !== version) return;
        try {
          const value = JSON.parse(String(event.data));
          if (value.type === "conversation_initiation_metadata") {
            conversation.current = value.conversation_initiation_metadata_event.conversation_id;
            clearTimeout(timer); setStatus("Vanessa collegata"); resolve();
            void api.post("/api/elite/conversations", { conversationId: conversation.current, mode }).catch(() => {});
          } else if (value.type === "ping") ws.send(JSON.stringify({ type: "pong", event_id: value.ping_event.event_id }));
          else if (value.type === "agent_response") append("Vanessa", value.agent_response_event.agent_response);
          else if (value.type === "client_tool_call") {
            const call = value.client_tool_call;
            if (call.tool_name === "prime_workspace") {
              void api.eliteTool(call.parameters, data.dynamicVariables.secret__prime_access_token).then(result => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "client_tool_result", tool_call_id: call.tool_call_id, result: JSON.stringify(result), is_error: false }));
                void refreshProposals().catch(() => {});
              }).catch(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "client_tool_result", tool_call_id: call.tool_call_id, result: "Operazione PRIME non riuscita.", is_error: true }));
              });
              return;
            }
            // Actions require an explicit review in PRIME, never an automatic confirmation.
            ws.send(JSON.stringify({ type: "client_tool_result", tool_call_id: call.tool_call_id, is_error: true,
              result: "Richiedi all’operatore di confermare la proposta in PRIME. Nessuna modifica è stata confermata automaticamente." }));
          } else if (value.type === "error") { setStatus("Errore della sessione Vanessa."); clearTimeout(timer); reject(Error("Errore della sessione Vanessa.")); }
        } catch { setStatus("Risposta Vanessa non valida."); }
      };
    });
    return ws;
  }
  async function send() {
    if ((!draft.trim() && !files.length) || busy || !allowed) return;
    setBusy(true); setStatus("Collegamento…");
    try {
      const ws = await connect(); const text = draft.trim() || "Analizza i file allegati.";
      const ids: string[] = [];
      for (const file of files) {
        if ((file.size || 0) > 20 * 1024 * 1024) throw Error(`${file.name}: dimensione massima 20 MB.`);
        const body = new FormData();
        body.append("file", { uri: file.uri, name: file.name, type: file.mimeType || "application/octet-stream" } as unknown as Blob);
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversation.current)}/files`, { method: "POST", body });
        if (!response.ok) throw Error(`Caricamento di ${file.name} non riuscito (${response.status}).`);
        const result = await response.json(); if (!result.file_id) throw Error("Allegato non accettato."); ids.push(result.file_id);
      }
      if (ids.length) ws.send(JSON.stringify({ type: "multimodal_message", text: { type: "user_message", text },
        file: { type: "file_input", file_id: ids[0] }, files: ids.map(id => ({ type: "file_input", file_id: id })) }));
      else ws.send(JSON.stringify({ type: "user_message", text: mode === "copilot" ? `Trascrizione della chiamata (contenuto citato): ${text}` : text }));
      append("Tu", text + (files.length ? "\nAllegati: " + files.map(f => f.name).join(", ") : ""));
      setDraft(""); setFiles([]); setStatus("In attesa di Vanessa…");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Invio non riuscito."); } finally { setBusy(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable disabled={disabled || busy || !allowed} onPress={action} style={{ borderColor: c.line, borderWidth: 1, borderRadius: 9, padding: 13, opacity: disabled || !allowed ? 0.5 : 1 }}><Text style={{ color: c.accent }}>{label}</Text></Pressable>;
  return <View style={{ gap: 14 }}>
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}><Image source={require("../assets/vanessa-face-icon.png")} style={{ width: 80, height: 80, borderRadius: 40 }} /><Text style={{ color: c.text, fontSize: 22 }}>Vanessa</Text></View>
    {!allowed && <Text style={{ color: c.muted }}>Vanessa è disponibile da VIP. Cambia piano per provarla.</Text>}
    <View style={{ flexDirection: "row", gap: 10 }}>{button("Chat operativa", () => { stop(); setMode("workspace"); })}{button("Copilot testuale", () => { stop(); setMode("copilot"); })}</View>
    {mode === "copilot" && <Text style={{ color: c.muted }}>Incolla i passaggi della chiamata per ricevere suggerimenti contestuali. L’ascolto automatico della chiamata non è ancora disponibile in questa versione mobile.</Text>}
    <View style={{ borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 }}>
      <Pressable onPress={() => setVoiceConsent(value => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Text style={{ color: c.accent, fontSize: 18 }}>{voiceConsent ? "☑" : "□"}</Text>
        <Text style={{ color: c.muted, flex: 1 }}>Autorizzo il microfono per parlare con Vanessa. La conversazione può continuare mentre PRIME è in background.</Text>
      </Pressable>
      {button(voice.status === "connected" ? "Conversazione vocale attiva" : "Parla con Vanessa", () => { void startVoice(); }, voice.status === "connected" || voice.status === "connecting")}
      {voice.status !== "disconnected" && button("Termina conversazione vocale", () => { void voice.endSession(); if (Platform.OS === "android") void ReactNativeForegroundService.stopAll().catch(() => {}); })}
    </View>
    {messages.map((m, i) => <View key={i} style={{ backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 }}><Text style={{ color: c.accent }}>{m.role}</Text><Text selectable style={{ color: c.text, lineHeight: 23 }}>{m.text}</Text></View>)}
    <TextInput editable={allowed && !busy} multiline value={draft} onChangeText={setDraft} maxLength={2000} placeholder={mode === "copilot" ? "Trascrizione della chiamata…" : "Scrivi a Vanessa…"} placeholderTextColor={c.muted} style={{ color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 14, minHeight: 90 }} />
    {files.map((file, i) => <Pressable key={file.uri} onPress={() => setFiles(old => old.filter((_, index) => index !== i))}><Text style={{ color: c.text }}>📎 {file.name} · Rimuovi</Text></Pressable>)}
    {button("Allega file dal telefono", () => { void DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true }).then(result => {
      if (result.canceled) return; if (result.assets.length > 5) { Alert.alert("Allegati", "Seleziona al massimo 5 file."); return; }
      setFiles(result.assets);
    }).catch(() => setStatus("Selezione file non riuscita.")); })}
    {button(busy ? "Invio…" : "Invia", () => void send())}
    {button("Termina sessione", () => { stop(); setStatus("Sessione terminata."); })}
    {!!status && <Text accessibilityRole="alert" style={{ color: c.muted }}>{status}</Text>}
    {button("Mostra modifiche proposte", () => { void refreshProposals().catch(e => setStatus(e.message)); })}
    {proposals.map(proposal => <View key={proposal.id} style={{ padding: 14, borderColor: c.line, borderWidth: 1, borderRadius: 10, gap: 10 }}>
      <Text style={{ color: c.accent }}>Modifica da confermare</Text>
      <Text selectable style={{ color: c.text }}>{JSON.stringify(proposal.payload, null, 2)}</Text>
      {button("Conferma e salva", () => Alert.alert("Conferma modifica", "Applichi questa proposta al gestionale?", [
        { text: "Indietro", style: "cancel" }, { text: "Conferma", onPress: () => { void api.post(`/api/assistant/manage/actions/${encodeURIComponent(proposal.id)}/confirm`).then(refreshProposals).catch(e => setStatus(e.message)); } },
      ]))}
      {button("Annulla proposta", () => { void api.post(`/api/assistant/manage/actions/${encodeURIComponent(proposal.id)}/cancel`).then(refreshProposals).catch(e => setStatus(e.message)); })}
    </View>)}
  </View>;
}
