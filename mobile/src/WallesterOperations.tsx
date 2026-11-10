import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import type { PrimeApi } from "./api";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
type Account = { id: string; name: string; currency_code: string };
type Field = { name: string; type: string; required?: boolean; enum?: (string | number | boolean)[]; min?: number; max?: number; maxLength?: number; minLength?: number; format?: string; items?: { type?: string } };
type Operation = { id: string; label: string; method: string; sandbox?: boolean; fields: Field[] };
type Card = { id: string; account_id: string; name: string; type: string; status: string; masked_card_number?: string; expiry_date?: string; embossing_name?: string };
type PickedFile = { name: string; type: string; data: string; size: number };
type Value = string | boolean | number | object | PickedFile;

const labels: Record<string, string> = {
  account_id: "Conto di addebito", card_id: "Carta", wire_transfer_id: "Identificativo bonifico", account_adjustment_id: "Identificativo movimento", payment_file_id: "Identificativo distinta", payment_record_id: "Identificativo disposizione", from_account_id: "Conto di origine", to_account_id: "Conto di destinazione", from_amount: "Importo da cambiare", to_amount: "Importo da ricevere", amount: "Importo", currency_code: "Valuta", receiver_iban: "IBAN beneficiario", receiver_name: "Nome beneficiario", reference: "Causale", offer_id: "Offerta di cambio", action_id: "Identificativo conferma", challenge_type: "Metodo di conferma", challenge_value: "Codice di conferma", from_record: "Dal risultato", records_count: "Numero risultati", block_type: "Motivo del blocco", type: "Tipo", name: "Nome", external_id: "Riferimento esterno", is_main: "Conto principale", order_direction: "Ordinamento", order_field: "Ordina per", beneficiary_iban: "IBAN beneficiario", beneficiary_name: "Nome beneficiario", beneficiary_type: "Tipo beneficiario", send_notification: "Invia notifica", cancellation_reason: "Motivo annullamento", limits: "Limiti", file: "File", payment_id: "Identificativo pagamento", matched_name: "Intestatario verificato", verification_result: "Esito verifica intestatario", is_from_client_portal: "Iniziato dal portale Wallester",
};
const shortcuts = [
  ["InitiateWireTransferPayout", "Nuovo bonifico", "Conto, beneficiario, importo e causale"],
  ["ValidateWireTransferPayout", "Verifica beneficiario", "Controlla intestatario e IBAN"],
  ["GetWireTransferPayout", "Stato bonifico", "Consulta una disposizione"],
  ["ConfirmWireTransferPayout", "Conferma bonifico", "Autorizza una disposizione preparata"],
  ["CancelWireTransferPayout", "Annulla bonifico", "Annulla una disposizione consentita"],
  ["GetWireTransferPayoutConfirmation", "Ricevuta bonifico", "Recupera la conferma"],
  ["CreatePaymentRecordsFromFile", "Importa distinta", "CSV, Excel o XML"],
  ["GetPaymentFiles", "Distinte e pagamenti", "Consulta pagamenti da file"],
] as const;
const cardActions = [["GetCard", "Dettagli"], ["UpdateCardLimits", "Limiti"], ["BlockCard", "Blocca"], ["UnblockCard", "Sblocca"], ["ActivateCard", "Attiva"], ["CloseCard", "Chiudi carta"]] as const;
const demoCardsSeed: Card[] = [
  { id: "demo-card-5401", account_id: "", name: "Carta operativa", type: "Virtual", status: "Active", masked_card_number: "•••• 5401", expiry_date: "2027-08-01", embossing_name: "PRIME DEMO" },
  { id: "demo-card-1884", account_id: "", name: "Carta trasferte", type: "ChipAndPin", status: "Blocked", masked_card_number: "•••• 1884", expiry_date: "2028-02-01", embossing_name: "PRIME DEMO" },
];
const sensitive = (name: string) => /(challenge_value|password|(^|[._])(pin|cvv2?|cvc|pan|api_key|private_key)($|[._]))/i.test(name);
const labelFor = (name: string) => name.split(".").slice(1).map((part) => labels[part] || part.replaceAll("_", " ")).join(" · ") || "Dati";

function Button({ title, c, onPress, disabled = false, selected = false }: { title: string; c: Colors; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={{ borderWidth: 1, borderColor: selected ? c.accent : c.line, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 11, opacity: disabled ? 0.48 : 1, backgroundColor: selected ? `${c.accent}20` : "transparent" }}><Text style={{ color: selected ? c.accent : c.text, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{title}</Text></Pressable>;
}

export default function WallesterOperations({ api, colors: c, demo, role, accounts, onChanged }: { api: PrimeApi; colors: Colors; demo: boolean; role: string; accounts: Account[]; onChanged?: () => void }) {
  const [cards, setCards] = useState<Card[]>(demo ? demoCardsSeed : []);
  const [cardOffset, setCardOffset] = useState(0);
  const [cardTotal, setCardTotal] = useState(0);
  const [selected, setSelected] = useState("");
  const [operations, setOperations] = useState<Operation[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, PickedFile>>({});
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ token: string; changes?: unknown } | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardType, setNewCardType] = useState("Virtual");
  const [newCardAccount, setNewCardAccount] = useState("");
  const [demoTransfer, setDemoTransfer] = useState(false);

  const permitted = useMemo(() => operations.filter((operation) => role === "owner" || operation.method === "GET"), [operations, role]);
  const activeOperation = permitted.find((operation) => operation.id === selected);
  const panel = { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 } as const;
  const small = { color: c.muted, fontSize: 12, lineHeight: 18 } as const;
  const input = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 10, minHeight: 42 } as const;

  const loadCards = useCallback(async () => {
    if (demo) return;
    try {
      const response = await api.get<{ cards: Card[]; total: number }>(`/api/connect/wallester/cards?offset=${cardOffset}`);
      setCards(response.cards || []); setCardTotal(response.total || 0); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Elenco carte Wallester non disponibile.");
    }
  }, [api, cardOffset, demo]);
  const load = useCallback(async () => {
    if (demo) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const response = await api.get<{ operations: Operation[] }>("/api/connect/wallester/operations");
      setOperations(Array.isArray(response.operations) ? response.operations : []);
      await loadCards();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazioni Wallester non disponibili dal gestionale.");
    } finally { setLoading(false); }
  }, [api, demo, loadCards]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const choose = (id: string, initial: Record<string, string> = {}) => {
    if (demo) { setSelected(id); setValues(initial); setReview(null); setResult(null); setMessage(""); setDemoTransfer(true); return; }
    if (!permitted.some((operation) => operation.id === id)) return;
    setSelected(id); setValues(initial); setFiles({}); setReview(null); setResult(null); setMessage("");
  };
  const pickFile = async (field: Field) => {
    try {
      const choice = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: "*/*" });
      if (choice.canceled) return;
      const asset = choice.assets[0];
      const limit = selected === "CreatePaymentRecordsFromFile" ? 3 * 1024 * 1024 : 15 * 1024 * 1024;
      if (!asset.size || asset.size > limit) throw Error("Seleziona un file entro la dimensione consentita.");
      const file = new File(asset.uri);
      const data: PickedFile = { name: asset.name, type: asset.mimeType || "application/octet-stream", data: await file.base64(), size: asset.size };
      setFiles((current) => ({ ...current, [field.name]: data })); setMessage("");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Impossibile leggere il file."); }
  };
  const parsedValues = () => {
    if (!activeOperation) return {};
    const payload: Record<string, Value> = {};
    for (const field of activeOperation.fields) {
      const raw = values[field.name] || "";
      if (field.type === "file") {
        const file = files[field.name];
        if (file) payload[field.name] = { name: file.name, type: file.type, data: file.data };
      } else if (["array", "object"].includes(field.type) && raw) {
        if (field.type === "object" || raw.trim().startsWith("[")) payload[field.name] = JSON.parse(raw);
        else payload[field.name] = raw.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => ["number", "integer"].includes(field.items?.type || "") ? Number(entry) : entry);
      } else if (raw !== "") payload[field.name] = field.type === "boolean" ? raw === "true" : ["number", "integer"].includes(field.type) ? Number(raw) : raw;
    }
    for (const field of activeOperation.fields) {
      if ((field.required || field.type === "file" || (activeOperation.id === "CreateCard" && ["body.account_id", "body.name"].includes(field.name))) && payload[field.name] === undefined) throw Error(`Completa il campo «${labelFor(field.name)}».`);
    }
    return payload;
  };
  const prepare = async () => {
    if (!activeOperation || demo) return;
    setBusy(true); setMessage(""); setResult(null); setReview(null);
    try {
      const payload = parsedValues();
      const response = await api.post<{ token: string; changes?: unknown }>("/api/connect/wallester/operations/prepare", { operation: activeOperation.id, values: payload });
      setReview(response); setMessage("Riepilogo pronto. Verifica tutti i dati prima di confermare.");
    } catch (cause) { setMessage(cause instanceof SyntaxError ? "Il contenuto JSON non è valido." : cause instanceof Error ? cause.message : "Preparazione non riuscita."); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!review || demo) return;
    setBusy(true); setMessage("");
    try {
      const response = await api.post("/api/connect/wallester/operations/execute", { token: review.token, confirmed: true });
      setResult(response); setReview(null); setMessage("Operazione completata."); await Promise.all([loadCards(), Promise.resolve(onChanged?.())]);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Operazione non completata."); }
    finally { setBusy(false); }
  };
  const updateDemoCard = (card: Card, action: string) => {
    if (action === "GetCard") { setMessage(`${card.name} · ${card.status} · carta dimostrativa senza dati di pagamento reali.`); return; }
    if (action === "UpdateCardLimits") { setMessage("Limite dimostrativo: 1.500 € giornalieri · 5.000 € mensili. Nessuna carta reale modificata."); return; }
    setCards((all) => all.map((row) => row.id !== card.id ? row : { ...row, status: action === "BlockCard" ? "Blocked" : action === "UnblockCard" || action === "ActivateCard" ? "Active" : "Closed" }));
    setMessage(`${card.name}: stato dimostrativo aggiornato. Nessuna carta reale modificata.`);
  };
  const createDemoCard = () => {
    if (!newCardName.trim()) { setMessage("Inserisci il nome della carta."); return; }
    const suffix = String(Math.floor(1000 + Math.random() * 8999));
    setCards((all) => [{ id: `demo-card-${Date.now()}`, account_id: newCardAccount, name: newCardName.trim(), type: newCardType, status: "Active", masked_card_number: `•••• ${suffix}`, expiry_date: "2028-12-01", embossing_name: "ANTEPRIMA DI TEST" }, ...all]);
    setNewCardName(""); setNewCardOpen(false); setMessage("Carta fittizia creata nella demo. Non esiste una carta o un conto reale.");
  };

  return <View style={{ gap: 12 }}>
    <View style={panel}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>Carte Wallester</Text>
      <Text style={small}>{demo ? "Anteprima privata: puoi creare e gestire carte fittizie. Nessun dato o conto reale viene modificato." : "Carte collegate, limiti e stato. I dati completi sono protetti da verifica dell’identità."}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {demo ? <Button title={newCardOpen ? "Chiudi" : "Crea carta fittizia"} c={c} onPress={() => setNewCardOpen((open) => !open)} /> : <Button title="Aggiorna carte" c={c} onPress={() => void loadCards()} disabled={busy || loading} />}
        {!demo && role === "owner" && <Button title="Nuova carta" c={c} onPress={() => choose("CreateCard", { "body.type": "Virtual" })} />}
      </View>
      {newCardOpen && demo && <View style={{ gap: 8, paddingTop: 4 }}>
        <TextInput accessibilityLabel="Nome carta dimostrativa" placeholder="Nome carta" placeholderTextColor={c.muted} value={newCardName} onChangeText={setNewCardName} style={input} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}><Button title="Virtuale" c={c} selected={newCardType === "Virtual"} onPress={() => setNewCardType("Virtual")} /><Button title="Fisica" c={c} selected={newCardType === "ChipAndPin"} onPress={() => setNewCardType("ChipAndPin")} /></View>
        {accounts.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{accounts.map((account) => <Button key={account.id} title={`${account.name} · ${account.currency_code}`} c={c} selected={newCardAccount === account.id} onPress={() => setNewCardAccount(account.id)} />)}</View>}
        <Button title="Crea anteprima" c={c} onPress={createDemoCard} />
      </View>}
      {cards.length === 0 && <Text style={small}>{loading ? "Caricamento carte…" : "Nessuna carta disponibile."}</Text>}
      {cards.map((card) => {
        const account = accounts.find((row) => row.id === card.account_id);
        const available = cardActions.filter(([id]) => (demo || role === "owner" || id === "GetCard") && !(id === "BlockCard" && ["Blocked", "Closed"].includes(card.status)) && !(id === "UnblockCard" && card.status !== "Blocked") && !(id === "ActivateCard" && ["Active", "Closed"].includes(card.status)) && !(id === "CloseCard" && card.status === "Closed"));
        return <View key={card.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 11, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={{ color: c.text, fontWeight: "600", flex: 1 }}>{card.name}</Text><Text style={{ color: card.status === "Active" ? "#32c879" : c.muted, fontSize: 11 }}>{({ Active: "Attiva", Blocked: "Bloccata", Closed: "Chiusa", Pending: "In attesa" } as Record<string, string>)[card.status] || card.status}</Text></View>
          <Text style={{ color: c.accent, fontSize: 17, letterSpacing: 1.3 }}>{card.masked_card_number || "•••• •••• ••••"}</Text>
          <Text style={small}>{card.type === "Virtual" ? "Virtuale" : "Fisica"}{card.embossing_name ? ` · ${card.embossing_name}` : ""}{account ? ` · ${account.name} (${account.currency_code})` : ""}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{available.map(([id, title]) => <Button key={id} title={title} c={c} onPress={() => demo ? updateDemoCard(card, id) : choose(id, { "path.card_id": card.id })} />)}</View>
        </View>;
      })}
      {!demo && cardTotal > 24 && <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Button title="‹ Precedenti" c={c} disabled={!cardOffset || loading} onPress={() => setCardOffset(Math.max(0, cardOffset - 24))} /><Text style={small}>{cardOffset + 1}–{Math.min(cardOffset + cards.length, cardTotal)} di {cardTotal}</Text><Button title="Successive ›" c={c} disabled={cardOffset + 24 >= cardTotal || loading} onPress={() => setCardOffset(cardOffset + 24)} /></View>}
    </View>

    <View style={panel}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>Bonifici e pagamenti</Text>
      <Text style={small}>{demo ? "Simulazioni isolate per verificare il flusso. Il saldo non viene trasferito e nessun pagamento viene inviato." : "Disposizioni, verifica beneficiario, conferma e distinte. Ogni modifica Live richiede un riepilogo e una conferma esplicita."}</Text>
      {demo ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{shortcuts.slice(0, 6).map(([id, title]) => <Button key={id} title={title} c={c} selected={selected === id} onPress={() => choose(id)} />)}</View> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{permitted.filter((operation) => shortcuts.some(([id]) => id === operation.id)).map((operation) => <Button key={operation.id} title={shortcuts.find(([id]) => id === operation.id)?.[1] || operation.label} c={c} selected={selected === operation.id} onPress={() => choose(operation.id)} />)}</View>}
      {demo && demoTransfer && selected && <View style={{ gap: 8, paddingTop: 4 }}>
        <Text style={{ color: c.text, fontWeight: "600" }}>{shortcuts.find(([id]) => id === selected)?.[1] || selected}</Text>
        {selected === "GetPaymentFiles" || selected === "GetWireTransferPayout" || selected === "GetWireTransferPayoutConfirmation" ? <Text style={small}>Nessuna disposizione dimostrativa ancora creata. Le operazioni reali richiedono Wallester collegato nel workspace Live.</Text> : <>
          {selected === "InitiateWireTransferPayout" && <>
            {accounts.length > 0 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{accounts.map((account) => <Button key={account.id} title={`${account.name} · ${account.currency_code}`} c={c} selected={values.account === account.id} onPress={() => setValues((current) => ({ ...current, account: account.id, currency: account.currency_code }))} />)}</View>}
            <TextInput accessibilityLabel="Beneficiario" placeholder="Nome beneficiario" placeholderTextColor={c.muted} value={values.receiver || ""} onChangeText={(value) => setValues((current) => ({ ...current, receiver: value }))} style={input} />
            <TextInput accessibilityLabel="IBAN" placeholder="IBAN beneficiario" placeholderTextColor={c.muted} autoCapitalize="characters" value={values.iban || ""} onChangeText={(value) => setValues((current) => ({ ...current, iban: value.toUpperCase().replace(/\s/g, "") }))} style={input} />
            <TextInput accessibilityLabel="Importo" placeholder="Importo" placeholderTextColor={c.muted} keyboardType="decimal-pad" value={values.amount || ""} onChangeText={(value) => setValues((current) => ({ ...current, amount: value.replace(",", ".") }))} style={input} />
            <TextInput accessibilityLabel="Causale" placeholder="Causale" placeholderTextColor={c.muted} value={values.reference || ""} onChangeText={(value) => setValues((current) => ({ ...current, reference: value }))} style={input} />
          </>}
          {selected === "ValidateWireTransferPayout" && <><TextInput placeholder="Nome beneficiario" placeholderTextColor={c.muted} value={values.receiver || ""} onChangeText={(value) => setValues((current) => ({ ...current, receiver: value }))} style={input} /><TextInput placeholder="IBAN beneficiario" placeholderTextColor={c.muted} autoCapitalize="characters" value={values.iban || ""} onChangeText={(value) => setValues((current) => ({ ...current, iban: value.toUpperCase().replace(/\s/g, "") }))} style={input} /></>}
          <Button title="Prepara simulazione" c={c} onPress={() => { if (selected === "InitiateWireTransferPayout" && (!values.receiver || !values.iban || !/^([A-Z]{2}[0-9A-Z]{13,32})$/.test(values.iban) || !(Number(values.amount) > 0))) { setMessage("Controlla beneficiario, IBAN e importo."); return; } setReview({ token: "demo-only" }); setMessage("Anteprima pronta: nessun dato verrà inviato a Wallester."); }} />
        </>}
      </View>}
      {!demo && loading && <Text style={small}>Caricamento operazioni Wallester…</Text>}
      {!demo && !loading && !operations.length && !error && <Text style={small}>Il gestionale non ha restituito operazioni disponibili per questo collegamento.</Text>}
      {activeOperation && !demo && <View style={{ gap: 9, borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}>
        <Text style={{ color: c.text, fontWeight: "600" }}>{shortcuts.find(([id]) => id === activeOperation.id)?.[1] || activeOperation.label}</Text>
        <Text style={small}>{activeOperation.sandbox ? "Disponibile esclusivamente in sandbox Wallester." : role === "owner" ? "Controlla il riepilogo prima di confermare." : "Consultazione in sola lettura per il tuo ruolo."}</Text>
        {activeOperation.fields.map((field) => {
          const required = !!field.required || field.type === "file" || (activeOperation.id === "CreateCard" && ["body.account_id", "body.name"].includes(field.name));
          const title = `${labelFor(field.name)}${required ? " *" : ""}`;
          if (field.type === "file") return <View key={field.name} style={{ gap: 5 }}><Text style={small}>{title} · massimo {activeOperation.id === "CreatePaymentRecordsFromFile" ? "3 MB" : "15 MB"}</Text><Button title={files[field.name]?.name || "Scegli file"} c={c} onPress={() => void pickFile(field)} disabled={busy} /></View>;
          if (field.enum || field.type === "boolean") return <View key={field.name} style={{ gap: 5 }}><Text style={small}>{title}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{(field.enum || [true, false]).map((option) => { const value = String(option); return <Button key={value} title={field.type === "boolean" ? value === "true" ? "Sì" : "No" : activeOperation.id === "CreateCard" && field.name === "body.type" ? ({ Virtual: "Virtuale", ChipAndPin: "Fisica" } as Record<string, string>)[value] || value : value} c={c} selected={values[field.name] === value} onPress={() => setValues((current) => ({ ...current, [field.name]: value }))} />; })}</View></View>;
          if (field.name.endsWith("account_id")) return <View key={field.name} style={{ gap: 5 }}><Text style={small}>{title}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{accounts.map((account) => <Button key={account.id} title={`${account.name} · ${account.currency_code}`} c={c} selected={values[field.name] === account.id} onPress={() => setValues((current) => ({ ...current, [field.name]: account.id }))} />)}</View></View>;
          const jsonField = ["array", "object"].includes(field.type);
          return <View key={field.name} style={{ gap: 4 }}><Text style={small}>{title}</Text><TextInput accessibilityLabel={title} value={values[field.name] || ""} onChangeText={(value) => setValues((current) => ({ ...current, [field.name]: value }))} placeholder={jsonField ? field.type === "array" ? "[] oppure valori separati da virgola" : "{}" : title} placeholderTextColor={c.muted} keyboardType={["number", "integer"].includes(field.type) ? "decimal-pad" : "default"} secureTextEntry={sensitive(field.name)} autoCapitalize={sensitive(field.name) ? "none" : field.name.toLowerCase().includes("iban") ? "characters" : "sentences"} multiline={jsonField} style={[input, jsonField && { minHeight: 90, textAlignVertical: "top" }]} maxLength={field.maxLength} /></View>;
        })}
        <Button title={busy ? "Preparo…" : activeOperation.sandbox ? "Operazione disabilitata in sandbox" : activeOperation.method === "GET" ? "Mostra risultati" : "Prepara riepilogo"} c={c} disabled={busy || !!activeOperation.sandbox || (role !== "owner" && activeOperation.method !== "GET")} onPress={() => void prepare()} />
      </View>}
      {review && <View style={{ borderWidth: 1, borderColor: c.accent, borderRadius: 9, padding: 11, gap: 8 }}><Text style={{ color: c.text, fontWeight: "700" }}>Riepilogo · controlla prima di continuare</Text>{activeOperation?.fields.filter((field) => values[field.name] || files[field.name]).map((field) => <Text key={field.name} style={small}>{labelFor(field.name)}: {sensitive(field.name) ? "••••••" : files[field.name]?.name || values[field.name]}</Text>)}<Button title={busy ? "Invio…" : demo ? "Conferma solo anteprima" : "Conferma operazione reale"} c={c} disabled={busy} onPress={() => demo ? (setReview(null), setMessage("Simulazione completata: nessun denaro trasferito.")) : Alert.alert("Confermare l’operazione?", "Questa richiesta sarà inviata a Wallester.", [{ text: "Annulla", style: "cancel" }, { text: "Conferma", style: "destructive", onPress: () => void execute() }])} /><Text style={small}>Il riepilogo è privato e non mostra codici di conferma, password o dati completi delle carte.</Text></View>}
      {result !== null && <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 8, gap: 5 }}><Text style={{ color: c.text, fontWeight: "600" }}>Risposta Wallester</Text><Text selectable style={small}>{JSON.stringify(result, (key, value) => sensitive(key) ? undefined : value, 2)}</Text></View>}
      {message ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{error}</Text> : null}
      {demo && role !== "external" && <Text style={small}>Carte e simulazioni restano locali a questa schermata; nessun pagamento viene inviato.</Text>}
    </View>
  </View>;
}
