import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, Switch, Text, TextInput, View } from "react-native";
import type { PrimeApi } from "./api";
import type { AssistantAgentId } from "./Vanessa";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
type Settings = { outbound_greeting: string; inbound_greeting: string; instructions: string; address_style: string; auto_queue: number };
type QueueItem = { id: string; contact_name: string; phone: string; state: string; instructions: string; transcript?: { role?: string; message?: string }[] };
type Usage = { lines: { kind: string; used: number; included: number; remaining: number; extra: number; extraEur: number }[]; totalExtraEur: number; cycle: { start: string; end: string }; events: { kind: string; units: number; agentId: string; date: string }[] };
type Transcript = { id?: string; conversation_id?: string; agent_id?: string; mode?: string; created_at?: string; downloadUrl?: string; download_url?: string; title?: string };
type Agent = { id: string; name?: string; description?: string; included?: boolean };
const usageNames: Record<string, string> = { minutes: "Minuti vocali", simple: "Operazioni semplici", medium: "Ricerche medie", complex: "Ricerche complesse" };

export default function VanessaOperations({ api, colors: c, owner, agentId = "vanessa", elite = false }: { api: PrimeApi; colors: Colors; owner: boolean; agentId?: AssistantAgentId; elite?: boolean }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [numbers, setNumbers] = useState<{ contactId: string; name: string; phone: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const refresh = useCallback(async () => {
    const [nextQueue, nextUsage, nextTranscripts] = await Promise.all([
      api.get<QueueItem[]>("/api/elite/queue"),
      api.get<Usage>("/api/elite/usage"),
      api.get<Transcript[]>("/api/elite/transcripts").catch(() => []),
    ]);
    setQueue(nextQueue); setUsage(nextUsage); setTranscripts(nextTranscripts);
  }, [api]);
  useEffect(() => {
    let active = true;
    void api.get<{ settings: Settings; agentsAvailable?: Agent[]; agents?: Agent[] }>("/api/elite/status").then(result => { if (active) { setSettings(result.settings); setAgents([...(result.agentsAvailable || []), ...(result.agents || [])]); } }).catch(error => { if (active) setStatus(error.message); });
    void refresh().catch(error => { if (active) setStatus(error.message); });
    const timer = setInterval(() => void refresh().catch(() => {}), 20000);
    return () => { active = false; clearInterval(timer); };
  }, [api, refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setStatus("");
    try { await action(); } catch (error) { setStatus(error instanceof Error ? error.message : "Operazione non riuscita."); } finally { setBusy(false); }
  }
  async function saveSettings(next: Settings) {
    await api.change("/api/elite/settings", "PUT", { outboundGreeting: next.outbound_greeting, inboundGreeting: next.inbound_greeting, instructions: next.instructions, addressStyle: next.address_style, autoQueue: Boolean(next.auto_queue) });
    setSettings(next); setStatus("Impostazioni salvate.");
  }
  async function createAgent() {
    const name = customName.trim();
    if (!name || !customInstructions.trim()) throw Error("Inserisci nome e istruzioni dell’agente.");
    await api.post("/api/elite/agents", { name, personality: customInstructions.trim() });
    setCustomName(""); setCustomInstructions("");
    const result = await api.get<{ agents?: Agent[] }>("/api/elite/status");
    setAgents(result.agents || []);
    setStatus("Agente personalizzato creato.");
  }
  const panel = { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 16, gap: 12 } as const;
  const input = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 9, padding: 12, minHeight: 48 } as const;
  const heading = { color: c.text, fontSize: 20, fontWeight: "600" } as const;
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable onPress={onPress} disabled={busy || disabled} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 9, padding: 12, opacity: busy || disabled ? 0.5 : 1 }}><Text style={{ color: c.accent }}>{label}</Text></Pressable>;
  return <View style={{ gap: 16 }}>
    <View style={panel}>
      <Text style={heading}>Coda chiamate</Text>
      <Text style={{ color: c.muted }}>Seleziona i contatti e scrivi le istruzioni. Ogni avvio richiede conferma.</Text>
      {owner && settings && <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={Boolean(settings.auto_queue)} disabled={busy} onValueChange={value => void run(() => saveSettings({ ...settings, auto_queue: value ? 1 : 0 }))} /><Text style={{ color: c.text, flex: 1 }}>Avvia automaticamente la chiamata successiva</Text></View>}
      {button("Aggiorna coda", () => void run(refresh))}
      {button(`Avvia la prossima · ${agentId === "vittoria" ? "Vittoria" : "Vanessa"}`, () => Alert.alert("Avvia chiamata", `Autorizzi ${agentId === "vittoria" ? "Vittoria" : "Vanessa"} ad avviare la prossima chiamata in coda?`, [{ text: "Annulla", style: "cancel" }, { text: "Avvia", onPress: () => void run(async () => { await api.post("/api/elite/queue/start", { authorized: true, agentId }); await refresh(); }) }]))}
      {queue.length === 0 && <Text style={{ color: c.muted }}>Nessuna chiamata in coda.</Text>}
      {queue.map(item => <View key={item.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 12, gap: 8 }}><Text style={{ color: c.text }}>{item.contact_name || item.phone} · {item.state}</Text><Text style={{ color: c.muted }}>{item.instructions}</Text>{item.transcript?.map((line, i) => <Text key={i} style={{ color: c.text }}>{line.role}: {line.message}</Text>)}{item.state === "queued" && button("Annulla chiamata in coda", () => void run(async () => { await api.post(`/api/elite/queue/${encodeURIComponent(item.id)}/cancel`, {}); await refresh(); }))}</View>)}
      {button("Seleziona contatti da chiamare", () => void run(async () => { setNumbers(await api.get("/api/elite/numbers")); setExpanded(true); }))}
      {expanded && <View style={{ gap: 10 }}>{numbers.map(item => { const key = `${item.contactId}:${item.phone}`; return <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(key) }} onPress={() => setPicked(old => old.includes(key) ? old.filter(value => value !== key) : [...old, key])} style={{ paddingVertical: 10 }}><Text style={{ color: picked.includes(key) ? c.accent : c.text }}>{picked.includes(key) ? "✓ " : ""}{item.name} · {item.phone}</Text></Pressable>; })}<TextInput multiline value={instructions} onChangeText={setInstructions} placeholder={`Motivo della chiamata e istruzioni per ${agentId === "vittoria" ? "Vittoria" : "Vanessa"}`} placeholderTextColor={c.muted} style={input} /><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Switch value={authorized} onValueChange={setAuthorized} /><Text style={{ color: c.text, flex: 1 }}>Confermo che l’agenzia è autorizzata a contattare i numeri selezionati</Text></View>{button("Aggiungi alla coda", () => void run(async () => { const targets = numbers.filter(item => picked.includes(`${item.contactId}:${item.phone}`)).map(({ contactId, phone }) => ({ contactId, phone })); await api.post("/api/elite/queue", { authorized: true, targets, instructions: instructions.trim(), agentId, requestKey: `mobile_${Date.now()}_${Math.random().toString(36).slice(2)}` }); setPicked([]); setExpanded(false); setInstructions(""); setAuthorized(false); await refresh(); }), !authorized || !picked.length || !instructions.trim() || picked.length > 50)}</View>}
    </View>
    <View style={panel}><Text style={heading}>Quote e utilizzo</Text>{button("Aggiorna consumi", () => void run(refresh))}{usage && <><Text style={{ color: c.muted }}>Ciclo {new Date(usage.cycle.start).toLocaleDateString("it-IT")} – {new Date(usage.cycle.end).toLocaleDateString("it-IT")}</Text>{usage.lines.map(line => <View key={line.kind} style={{ gap: 5 }}><Text style={{ color: c.text }}>{usageNames[line.kind] || line.kind} · {line.used.toFixed(2)} / {line.included}</Text><Text style={{ color: c.muted }}>{line.extra > 0 ? `Extra ${line.extra.toFixed(2)} · € ${line.extraEur.toFixed(2)}` : `Restano ${line.remaining.toFixed(2)}`}</Text></View>)}<Text style={{ color: c.text }}>Extra registrati: € {usage.totalExtraEur.toFixed(2)}</Text>{usage.events.map((event, i) => <Text key={i} style={{ color: c.muted }}>{usageNames[event.kind] || event.kind} · {event.units.toFixed(2)} · {event.agentId} · {new Date(event.date).toLocaleString("it-IT")}</Text>)}</>}</View>
    <View style={panel}><Text style={heading}>Archivio conversazioni</Text>{button("Aggiorna trascrizioni", () => void run(refresh))}{!transcripts.length && <Text style={{ color: c.muted }}>Nessuna trascrizione disponibile.</Text>}{transcripts.map((item, index) => <View key={item.id || item.conversation_id || String(index)} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 10, gap: 5 }}><Text style={{ color: c.text }}>{item.title || item.conversation_id || "Conversazione"}</Text><Text style={{ color: c.muted }}>{item.agent_id || "vanessa"} · {item.mode || "workspace"}{item.created_at ? ` · ${new Date(item.created_at).toLocaleString("it-IT")}` : ""}</Text>{(item.downloadUrl || item.download_url) && button("Scarica trascrizione", () => { const target = item.downloadUrl || item.download_url || ""; const url = target.startsWith("https://") ? target : `https://primegestionale.it${target.startsWith("/") ? target : `/${target}`}`; void Linking.openURL(url); })}</View>)}</View>
    {elite && owner && <View style={panel}><Text style={heading}>Agenti aggiuntivi personalizzabili</Text><Text style={{ color: c.muted }}>Crea un agente per il tuo workspace Elite o Secret. Vanessa e Vittoria restano disponibili separatamente.</Text>{agents.filter(item => !item.included).map(item => <Text key={item.id} style={{ color: c.text }}>{item.name || item.id}</Text>)}<TextInput value={customName} onChangeText={setCustomName} placeholder="Nome agente" placeholderTextColor={c.muted} style={input} /><TextInput multiline value={customInstructions} onChangeText={setCustomInstructions} placeholder="Personalità e istruzioni" placeholderTextColor={c.muted} style={input} />{button("Crea agente personalizzato", () => void run(createAgent), !customName.trim() || !customInstructions.trim())}</View>}
    {owner && settings && <View style={panel}><Text style={heading}>Impostazioni assistente e chiamate</Text>{(["outbound_greeting", "inbound_greeting", "instructions"] as const).map(key => <View key={key} style={{ gap: 6 }}><Text style={{ color: c.text }}>{key === "outbound_greeting" ? "Saluto per chiamate in uscita" : key === "inbound_greeting" ? "Saluto per chiamate in entrata" : "Istruzioni per Vanessa"}</Text><TextInput multiline value={settings[key]} onChangeText={value => setSettings({ ...settings, [key]: value })} maxLength={key === "instructions" ? 4000 : 800} style={input} /></View>)}<View style={{ flexDirection: "row", gap: 10 }}>{button("Dare del Lei", () => setSettings({ ...settings, address_style: "lei" }), settings.address_style === "lei")}{button("Dare del tu", () => setSettings({ ...settings, address_style: "tu" }), settings.address_style === "tu")}</View>{button("Salva impostazioni", () => void run(() => saveSettings(settings)))}</View>}
    {!!status && <Text accessibilityRole="alert" style={{ color: c.muted }}>{status}</Text>}
  </View>;
}
