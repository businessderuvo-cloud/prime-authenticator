import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path, Rect, SvgXml } from "react-native-svg";
import type { PrimeApi } from "./api";
import providerLogos from "./provider-logos.json";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
export type StripeDemoPayout = { id: string; amount: number };
export type StripeDemoCard = { id: string; name: string; last4: string; status: "active" | "inactive"; limit: number };
export type StripeDemoLedger = { available: number; pending: number; payouts: StripeDemoPayout[] };

type StripeStatus = { configured: boolean; mode: string; accountId?: string; platformConfigured?: boolean; canManage?: boolean; webhookUrl?: string };
type Amount = { amount: number; currency: string };
type Payment = { id: string; description: string; amount: number; currency: string; state: string; createdAt: string; refunded?: number; checkoutUrl?: string };
type Payout = { id: string; amount: number; currency: string; status: string; arrival?: number };
type Invoice = { id: string; number: string; customer: string; amount: number; remaining: number; currency: string; status: string; due?: number; pdf?: string; url?: string };
type LinkRow = { id: string; description: string; amount: number | null; currency: string; active: boolean; url: string };
type SeriesRow = { month: string; income: number; pending: number; fees: number; refunds: number; payouts: number; net: number };
type Report = { seriesByCurrency?: Record<string, SeriesRow[]>; transactions?: { id: string; created: number; amount: number; net: number; currency: string; status: string; description?: string; category: string }[]; reportCapped?: boolean };
type Overview = { chargesEnabled: boolean; payoutsEnabled: boolean; payoutSchedule: string; available: Amount[]; pending: Amount[]; payouts: Payout[]; payments: Payment[] };
type Issuing = { enabled: boolean; reason?: string; error?: string; holders?: { id: string; name: string }[]; cards?: { id: string; last4: string; brand: string; status: string; name: string; type: string }[] };

const sampleSeries = [[38,16,28],[54,22,41],[46,18,35],[70,27,55],[62,24,49],[86,31,63],[58,23,45],[76,29,60],[68,26,51],[90,34,70],[73,28,57],[96,37,74]].map((row, index) => ({ month: String(index + 1).padStart(2, "0"), income: row[0] * 1000, cost: row[1] * 1000, pending: row[2] * 1000 }));
const euro = (minor: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(minor / 100);
const randomKey = () => `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
const statusLabels: Record<string, string> = { pending: "In attesa", paid: "Pagato", expired: "Scaduto", canceled: "Annullato", refunded: "Rimborsato", partially_refunded: "Rimborso parziale", open: "Da pagare", draft: "Bozza", void: "Annullata", uncollectible: "Non esigibile" };

function Panel({ children, colors: c }: { children: React.ReactNode; colors: Colors }) {
  return <View style={{ backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 16, gap: 11 }}>{children}</View>;
}
function Heading({ children, colors: c }: { children: React.ReactNode; colors: Colors }) {
  return <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>{children}</Text>;
}
function Action({ title, onPress, colors: c, disabled = false, primary = false }: { title: string; onPress: () => void; colors: Colors; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ padding: 12, minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: primary ? c.accent : c.line, backgroundColor: primary ? c.accent : "transparent", opacity: disabled ? 0.5 : 1 }}><Text style={{ color: primary ? "#101112" : c.text, fontWeight: "600", textAlign: "center" }}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, colors: c, keyboardType = "default", placeholder = "", maxLength }: { label: string; value: string; onChangeText: (value: string) => void; colors: Colors; keyboardType?: "default" | "email-address" | "decimal-pad" | "number-pad"; placeholder?: string; maxLength?: number }) {
  return <View style={{ gap: 5 }}><Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={c.muted} maxLength={maxLength} style={{ color: c.text, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 44 }} /></View>;
}
function DemoGraph({ style, colors: c }: { style: "bars" | "lines" | "pie"; colors: Colors }) {
  const colorSet = ["#53b77a", "#e5a541", "#df655b"];
  const max = Math.max(...sampleSeries.flatMap(row => [row.income, row.pending, row.cost]));
  const totals = ["income", "pending", "cost"].map(key => sampleSeries.reduce((sum, row) => sum + row[key as "income" | "pending" | "cost"], 0));
  const total = totals.reduce((sum, value) => sum + value, 0);
  const point = (value: number, index: number) => `${15 + index * 30},${126 - value / max * 102}`;
  const paths = (["income", "pending", "cost"] as const).map((key, i) => ({ key, color: colorSet[i], d: sampleSeries.map((row, index) => `${index === 0 ? "M" : "L"}${point(row[key], index)}`).join(" ") }));
  let angle = -90;
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>{["Entrate", "In attesa", "Uscite"].map((label, index) => <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorSet[index] }} /><Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text></View>)}</View>
    <Svg width="100%" height={150} viewBox="0 0 360 150" preserveAspectRatio="none">
      {[25, 59, 93, 127].map(y => <Path key={y} d={`M0 ${y}H360`} stroke={c.line} strokeWidth={1} />)}
      {style === "bars" && sampleSeries.map((row, index) => <React.Fragment key={row.month}>{([row.income, row.pending, row.cost]).map((value, series) => { const height = value / max * 100; return <Rect key={series} x={index * 30 + 4 + series * 7} y={126 - height} width={6} height={height} rx={2} fill={colorSet[series]} />; })}</React.Fragment>)}
      {style === "lines" && paths.map(series => <Path key={series.key} d={series.d} fill="none" stroke={series.color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />)}
      {style === "lines" && paths.map(series => sampleSeries.map((row, index) => <Circle key={`${series.key}-${row.month}`} cx={15 + index * 30} cy={126 - row[series.key] / max * 102} r={2.6} fill={series.color} />))}
      {style === "pie" && totals.map((value, index) => { const start = angle; const sweep = value / total * 359.9; angle += sweep; const p1 = [180 + 58 * Math.cos(start * Math.PI / 180), 75 + 58 * Math.sin(start * Math.PI / 180)]; const p2 = [180 + 58 * Math.cos((start + sweep) * Math.PI / 180), 75 + 58 * Math.sin((start + sweep) * Math.PI / 180)]; return <Path key={index} d={`M180 75 L${p1[0]} ${p1[1]} A58 58 0 ${sweep > 180 ? 1 : 0} 1 ${p2[0]} ${p2[1]} Z`} fill={colorSet[index]} stroke={c.panel} strokeWidth={2} />; })}
    </Svg>
    {style !== "pie" && <View style={{ flexDirection: "row", justifyContent: "space-between" }}>{sampleSeries.map((row, index) => <Text key={row.month} style={{ color: c.muted, fontSize: 9 }}>{index % 2 === 0 ? row.month : ""}</Text>)}</View>}
    <View style={{ gap: 5 }}>{(["Entrate", "In attesa", "Uscite"] as const).map((label, index) => <Text key={label} style={{ color: c.muted, fontSize: 12 }}>{label} · {euro(totals[index])}</Text>)}</View>
  </View>;
}

function StripeDemo({ colors: c, ledger, cards, onLedger, onCards }: { colors: Colors; ledger: StripeDemoLedger; cards: StripeDemoCard[]; onLedger: (value: StripeDemoLedger) => void; onCards: (value: StripeDemoCard[]) => void }) {
  const [chartStyle, setChartStyle] = useState<"bars" | "lines" | "pie">("bars");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("1000");
  const [feedback, setFeedback] = useState("");
  const logo = (providerLogos as Record<string, string>).stripe;
  const payout = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(cents) || cents < 100 || cents > ledger.available || !confirmed) {
      setFeedback(!confirmed ? "Conferma prima la simulazione." : "Inserisci un importo valido entro il saldo disponibile.");
      return;
    }
    Alert.alert("Simula accredito Stripe", `Trasferire ${euro(cents)} al conto collegato? È un’operazione dimostrativa.`, [
      { text: "Annulla", style: "cancel" },
      { text: "Conferma", onPress: () => { onLedger({ ...ledger, available: ledger.available - cents, payouts: [{ id: randomKey(), amount: cents }, ...ledger.payouts] }); setAmount(""); setConfirmed(false); setFeedback(`Accredito simulato di ${euro(cents)}. Saldo aggiornato.`); } },
    ]);
  };
  const createCard = () => {
    const monthly = Number(limit);
    if (!name.trim() || name.trim().length > 24 || !Number.isFinite(monthly) || monthly < 100 || monthly > 10000) {
      setFeedback("Inserisci nome e limite mensile validi. Il nome può contenere al massimo 24 caratteri.");
      return;
    }
    onCards([{ id: randomKey(), name: name.trim(), last4: String(Math.floor(1000 + Math.random() * 9000)), status: "inactive", limit: monthly }, ...cards]);
    setName(""); setLimit("1000"); setFeedback("Carta virtuale simulata creata come inattiva.");
  };
  return <View style={{ gap: 14 }}>
    <Panel colors={c}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}><SvgXml xml={logo} width={112} height={48} /><Text style={{ color: c.accent, fontSize: 11, fontWeight: "700" }}>DATI DIMOSTRATIVI</Text></View><Text style={{ color: c.muted, lineHeight: 21 }}>Anteprima Stripe con saldi, pagamenti, accrediti, grafici e carte virtuali fittizi. Nessun pagamento reale viene creato.</Text></Panel>
    <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>ANDAMENTO · ULTIMI 12 MESI</Text><Heading colors={c}>Entrate, in attesa e uscite</Heading><View style={{ flexDirection: "row", gap: 8 }}>{([['bars', 'Barre'], ['lines', 'Linee'], ['pie', 'Torta']] as const).map(([value, label]) => <Action key={value} title={label} colors={c} primary={chartStyle === value} onPress={() => setChartStyle(value)} />)}</View><DemoGraph style={chartStyle} colors={c} /><Text style={{ color: c.muted, fontSize: 12 }}>Dati dimostrativi: entrate in verde, importi in attesa in arancione e uscite in rosso.</Text></Panel>
    <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>RIEPILOGO</Text><Heading colors={c}>Saldo Stripe e accrediti</Heading><View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}><View style={{ flex: 1 }}><Text style={{ color: c.muted }}>Disponibile</Text><Text style={{ color: "#53b77a", fontSize: 23, fontWeight: "700" }}>{euro(ledger.available)}</Text></View><View style={{ flex: 1 }}><Text style={{ color: c.muted }}>In sospeso</Text><Text style={{ color: "#e5a541", fontSize: 23, fontWeight: "700" }}>{euro(ledger.pending)}</Text></View></View><Text style={{ color: c.text, fontWeight: "600" }}>Ultimi accrediti al conto collegato</Text><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.muted }}>{euro(75000)}</Text><Text style={{ color: "#53b77a" }}>Accreditato</Text></View><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.muted }}>{euro(49000)}</Text><Text style={{ color: "#e5a541" }}>In transito</Text></View>{ledger.payouts.map(item => <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.muted }}>{euro(item.amount)}</Text><Text style={{ color: "#e5a541" }}>In transito · simulato</Text></View>)}</Panel>
    <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>PAGAMENTI</Text><Heading colors={c}>Attività recente</Heading>{[{ label: "Provvigione · Via Roma 10", amount: 85000, status: "Pagato", color: "#53b77a" }, { label: "Consulenza immobiliare", amount: 25000, status: "In attesa", color: "#e5a541" }, { label: "Servizio di valutazione", amount: 12000, status: "Rimborsato", color: "#df655b" }, ...ledger.payouts.map(item => ({ label: "Accredito al conto collegato · simulato", amount: item.amount, status: "In transito", color: "#e5a541" }))].map((item, index) => <View key={`${item.label}-${index}`} style={{ borderTopWidth: index ? 1 : 0, borderColor: c.line, paddingTop: 9, gap: 5 }}><Text style={{ color: c.text }}>{item.label}</Text><Text style={{ color: item.color, fontWeight: "600" }}>{euro(item.amount)} · {item.status}</Text></View>)}</Panel>
    <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>ACCREDITO BANCARIO · DEMO</Text><Heading colors={c}>Trasferisci al conto collegato</Heading><Text style={{ color: c.muted }}>Simulazione di accredito dal saldo Stripe al conto bancario collegato.</Text><Field label="Importo (€)" value={amount} onChangeText={setAmount} colors={c} keyboardType="decimal-pad" placeholder={`Massimo ${euro(ledger.available)}`} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed(value => !value)} style={{ paddingVertical: 5 }}><Text style={{ color: c.text }}>{confirmed ? "☑" : "□"} Confermo la simulazione</Text></Pressable><Action title="Simula accredito" colors={c} primary onPress={payout} disabled={ledger.available < 100} />{!!feedback && <Text accessibilityRole="alert" style={{ color: c.muted }}>{feedback}</Text>}</Panel>
    <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>CARTE AZIENDALI · DEMO</Text><Heading colors={c}>Gestisci le carte Stripe</Heading><Text style={{ color: c.muted }}>Carte virtuali di esempio, limiti mensili e stato operativo. Non vengono generate carte reali.</Text>{cards.map(card => <View key={card.id} style={{ gap: 8, borderTopWidth: 1, borderColor: c.line, paddingTop: 10 }}><Text style={{ color: c.text, fontWeight: "600" }}>{card.name} · •••• {card.last4}</Text><Text style={{ color: card.status === "active" ? "#53b77a" : "#e5a541" }}>{card.status === "active" ? "Attiva" : "Inattiva"} · {euro(card.limit * 100)}/mese · Virtuale</Text><Action title={card.status === "active" ? "Blocca" : "Attiva"} colors={c} onPress={() => onCards(cards.map(item => item.id === card.id ? { ...item, status: item.status === "active" ? "inactive" : "active" } : item))} /></View>)}<Field label="Nome carta" value={name} onChangeText={setName} colors={c} maxLength={24} placeholder="Carta collaboratore" /><Field label="Limite mensile (€)" value={limit} onChangeText={setLimit} colors={c} keyboardType="decimal-pad" /><Action title="Crea carta virtuale" colors={c} primary onPress={createCard} />{!!feedback && <Text style={{ color: c.muted }}>{feedback}</Text>}</Panel>
  </View>;
}

export default function StripeWorkspace({ api, colors: c, plan, role, demo, ledger, cards, onLedger, onCards }: { api: PrimeApi; colors: Colors; plan: string; role: string; demo: boolean; ledger: StripeDemoLedger; cards: StripeDemoCard[]; onLedger: (value: StripeDemoLedger) => void; onCards: (value: StripeDemoCard[]) => void }) {
  if (demo) return <StripeDemo colors={c} ledger={ledger} cards={cards} onLedger={onLedger} onCards={onCards} />;
  return <StripeLive api={api} colors={c} plan={plan} role={role} />;
}

function StripeLive({ api, colors: c, plan, role }: { api: PrimeApi; colors: Colors; plan: string; role: string }) {
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [issuing, setIssuing] = useState<Issuing | null>(null);
  const [currency, setCurrency] = useState("eur");
  const [chartStyle, setChartStyle] = useState<"bars" | "lines" | "pie">("bars");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutConfirmed, setPayoutConfirmed] = useState(false);
  const [invoice, setInvoice] = useState({ name: "", email: "", description: "", amount: "", daysUntilDue: "30" });
  const [link, setLink] = useState({ description: "", amount: "" });
  const [cardLimit, setCardLimit] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const owner = role === "owner";
  const canLive = plan === "secret";
  const base = `/api/stripe`;
  const path = useCallback((route: string) => `${base}${route}${route.includes("?") ? "&" : "?"}mode=${environment}`, [base, environment]);
  const load = useCallback(async () => {
    try {
      const current = await api.get<StripeStatus>(path("/status"));
      setStatus(current);
      if (!current.configured) {
        setOverview(null); setReport(null); setInvoices([]); setLinks([]); setIssuing(null);
        return;
      }
      const results = await Promise.allSettled([
        api.get<Overview>(path("/overview")), api.get<Report>(path("/reports")), api.get<Invoice[]>(path("/invoices")), api.get<LinkRow[]>(path("/payment-links")), api.get<Issuing>(path("/issuing")),
      ]);
      if (results[0].status === "fulfilled") setOverview(results[0].value);
      if (results[1].status === "fulfilled") {
        const next = results[1].value; setReport(next);
        const currencies = Object.keys(next.seriesByCurrency || {});
        if (currencies.length && !currencies.includes(currency)) setCurrency(currencies.includes("eur") ? "eur" : currencies[0]);
      }
      if (results[2].status === "fulfilled") setInvoices(results[2].value);
      if (results[3].status === "fulfilled") setLinks(results[3].value);
      if (results[4].status === "fulfilled") setIssuing(results[4].value);
      const failure = results.find(item => item.status === "rejected");
      if (failure?.status === "rejected") setMessage(failure.reason instanceof Error ? failure.reason.message : "Alcuni dati Stripe non sono disponibili.");
    } catch (error) {
      setStatus(null); setMessage(error instanceof Error ? error.message : "Collegamento Stripe non disponibile.");
    }
  }, [api, path, currency]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void load();
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [load]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Operazione Stripe non riuscita."); }
    finally { setBusy(false); }
  };
  const request = <T,>(route: string, method = "GET", body?: unknown) => api.change<T>(path(route), method, body);
  const external = async (url?: string) => {
    if (!url || !url.startsWith("https://")) { setMessage("Link Stripe non valido."); return; }
    await Linking.openURL(url);
  };
  const connect = () => void run(async () => {
    const result = await request<{ url: string }>("/connect", "POST", {});
    const target = new URL(result.url);
    if (target.protocol !== "https:" || !["connect.stripe.com", "onboarding.stripe.com"].includes(target.hostname)) throw Error("Indirizzo di collegamento Stripe non valido.");
    await Linking.openURL(target.href);
    setMessage("Completa il collegamento su Stripe, poi torna qui e aggiorna lo stato.");
  });
  const series = useMemo(() => report?.seriesByCurrency?.[currency] || [], [report?.seriesByCurrency, currency]);
  const currencies = Object.keys(report?.seriesByCurrency || {});
  const format = (amount: number, currencyCode: string) => {
    const digits = new Intl.NumberFormat("it-IT", { style: "currency", currency: currencyCode.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: currencyCode.toUpperCase() }).format(amount / (10 ** digits));
  };
  const amountInput = (label: string, value: string, change: (value: string) => void) => <Field label={label} value={value} onChangeText={change} colors={c} keyboardType="decimal-pad" />;
  const chartRows = useMemo(() => series.map((row, index) => ({ month: row.month, income: row.income, pending: row.pending, cost: row.fees + row.refunds, index })), [series]);

  return <View style={{ gap: 14 }}>
    <Panel colors={c}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}><SvgXml xml={(providerLogos as Record<string, string>).stripe} width={112} height={48} /><Text style={{ color: status?.configured ? "#53b77a" : c.accent, fontWeight: "700" }}>{status?.configured ? `ACCOUNT ${status.accountId || "COLLEGATO"}` : "STRIPE CONNECT"}</Text></View><Text style={{ color: c.muted, lineHeight: 21 }}>Saldo, incassi, fatture, accrediti e link sono letti dall’account Stripe selezionato. Le carte restano nei sistemi Stripe.</Text><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Action title="Test" colors={c} primary={environment === "test"} onPress={() => { setEnvironment("test"); }} /><Action title={canLive ? "Produzione" : "Produzione · Secret"} colors={c} primary={environment === "live"} disabled={!canLive} onPress={() => setEnvironment("live")} /><Action title="Aggiorna dati Stripe" colors={c} disabled={busy} onPress={() => void run(load)} /></View>{!status?.configured && <><Text style={{ color: c.muted }}>{status?.platformConfigured ? "Collega l’account Stripe della tua agenzia. L’autorizzazione avviene sul sito sicuro Stripe." : "Stripe Connect deve essere configurato sul server PRIME prima di collegare un account."}</Text>{owner && <Action title="Collega account Stripe esistente" colors={c} primary disabled={busy || !status?.platformConfigured} onPress={connect} />}</>}{status?.configured && <Action title="Apri Dashboard Stripe" colors={c} onPress={() => void external(`https://dashboard.stripe.com/${encodeURIComponent(status.accountId || "")}${environment === "test" ? "/test" : ""}`)} />}</Panel>
    {message ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{message}</Text> : null}
    {status?.configured && overview && <>
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>RIEPILOGO {environment === "test" ? "TEST" : "PRODUZIONE"}</Text><Heading colors={c}>Saldo Stripe e accrediti</Heading><Text style={{ color: c.muted }}>Disponibile su Stripe · {overview.available.map(item => format(item.amount, item.currency)).join(" · ") || euro(0)}</Text><Text style={{ color: c.muted }}>In sospeso su Stripe · {overview.pending.map(item => format(item.amount, item.currency)).join(" · ") || euro(0)}</Text><Text style={{ color: c.muted }}>Incassi {overview.chargesEnabled ? "attivi" : "non attivi"} · Accrediti {overview.payoutsEnabled ? "attivi" : "non attivi"} · Frequenza {overview.payoutSchedule}</Text><Text style={{ color: c.text, fontWeight: "600" }}>Ultimi accrediti al conto collegato</Text>{overview.payouts.map(item => <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: c.text }}>{format(item.amount, item.currency)}</Text><Text style={{ color: c.muted }}>{item.status}{item.arrival ? ` · ${new Date(item.arrival * 1000).toLocaleDateString("it-IT")}` : ""}</Text></View>)}</Panel>
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>ANDAMENTO · 12 MESI</Text><Heading colors={c}>Entrate, in attesa e uscite</Heading>{currencies.length > 1 && <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{currencies.map(code => <Action key={code} title={code.toUpperCase()} colors={c} primary={currency === code} onPress={() => setCurrency(code)} />)}</View>}<View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{([['bars','Barre'],['lines','Linee'],['pie','Torta']] as const).map(([value, label]) => <Action key={value} title={label} colors={c} primary={chartStyle === value} onPress={() => setChartStyle(value)} />)}</View><ReportGraph rows={chartRows} colors={c} style={chartStyle} format={value => format(value, currency)} /><Text style={{ color: c.muted, fontSize: 12 }}>Il grafico include incassi, pagamenti in attesa, commissioni e rimborsi. PRIME non legge i movimenti del conto bancario esterno.</Text>{report?.reportCapped && <Text style={{ color: c.muted }}>Report limitato alle 2.000 transazioni più recenti.</Text>}<Heading colors={c}>Riepilogo mensile</Heading>{series.map(row => <View key={row.month} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 7, gap: 3 }}><Text style={{ color: c.text, fontWeight: "600" }}>{row.month}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Incassi {format(row.income, currency)} · Commissioni {format(row.fees, currency)} · Rimborsi {format(row.refunds, currency)} · Accrediti {format(row.payouts, currency)} · Netto {format(row.net, currency)}</Text></View>)}</Panel>
      {!!report?.transactions?.length && <Panel colors={c}><Heading colors={c}>Movimenti Stripe</Heading>{report.transactions.slice(0, 20).map(tx => <View key={tx.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 9, gap: 3 }}><Text style={{ color: c.text, fontWeight: "600" }}>{tx.description || tx.category}</Text><Text style={{ color: c.muted }}>{new Date(tx.created * 1000).toLocaleDateString("it-IT")} · {format(tx.amount, tx.currency)} · Netto {format(tx.net, tx.currency)} · {tx.status === "available" ? "Disponibile" : "In attesa"}</Text></View>)}</Panel>}
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>ACCREDITO BANCARIO</Text><Heading colors={c}>Trasferisci al conto collegato</Heading><Text style={{ color: c.muted }}>Il trasferimento usa il saldo Stripe disponibile e il conto collegato all’account.</Text>{overview.payoutSchedule === "manual" && owner ? <>{amountInput("Importo (€)", payoutAmount, setPayoutAmount)}<Pressable accessibilityRole="checkbox" accessibilityState={{ checked: payoutConfirmed }} onPress={() => setPayoutConfirmed(value => !value)}><Text style={{ color: c.text }}>{payoutConfirmed ? "☑" : "□"} Confermo il trasferimento</Text></Pressable><Action title="Invia al conto collegato" colors={c} primary disabled={busy} onPress={() => { const cents = Math.round(Number(payoutAmount) * 100); if (!payoutConfirmed || !Number.isSafeInteger(cents) || cents < 100) { setMessage("Inserisci almeno 1 € e conferma il trasferimento."); return; } Alert.alert("Conferma accredito", `Inviare ${euro(cents)} al conto collegato?`, [{ text: "Annulla", style: "cancel" }, { text: "Conferma", onPress: () => void run(async () => { await request("/payouts", "POST", { amount: cents, confirmed: true, requestKey: randomKey() }); setPayoutAmount(""); setPayoutConfirmed(false); await load(); }) }]); }} /></> : <Text style={{ color: c.muted }}>{overview.payoutSchedule !== "manual" ? "Per richiedere un accredito manuale, imposta prima la frequenza su manuale nel Dashboard Stripe." : "Solo il titolare può richiedere un accredito."}</Text>}</Panel>
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>FATTURAZIONE STRIPE</Text><Heading colors={c}>Crea e invia una fattura</Heading>{owner ? <><Field label="Cliente" value={invoice.name} onChangeText={value => setInvoice(old => ({ ...old, name: value }))} colors={c} maxLength={120} /><Field label="Email cliente" value={invoice.email} onChangeText={value => setInvoice(old => ({ ...old, email: value }))} colors={c} keyboardType="email-address" maxLength={254} /><Field label="Descrizione" value={invoice.description} onChangeText={value => setInvoice(old => ({ ...old, description: value }))} colors={c} maxLength={200} /><Field label="Importo (€)" value={invoice.amount} onChangeText={value => setInvoice(old => ({ ...old, amount: value }))} colors={c} keyboardType="decimal-pad" /><Field label="Scadenza in giorni (7, 14, 30 o 60)" value={invoice.daysUntilDue} onChangeText={value => setInvoice(old => ({ ...old, daysUntilDue: value }))} colors={c} keyboardType="number-pad" /><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Action title="Salva bozza" colors={c} disabled={busy || !status.configured} onPress={() => void submitInvoice(false)} /><Action title="Crea e invia fattura" colors={c} primary disabled={busy || !status.configured} onPress={() => void submitInvoice(true)} /></View></> : <Text style={{ color: c.muted }}>Solo il titolare può creare e inviare fatture.</Text>}<Heading colors={c}>Fatture recenti</Heading>{invoices.map(item => <View key={item.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 9, gap: 6 }}><Text style={{ color: c.text, fontWeight: "600" }}>{item.number} · {item.customer || "Cliente"}</Text><Text style={{ color: c.muted }}>{format(item.amount, item.currency)} · {statusLabels[item.status] || item.status}</Text><View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}>{item.url && <Action title="Apri fattura" colors={c} onPress={() => void external(item.url)} />}{item.pdf && <Action title="PDF" colors={c} onPress={() => void external(item.pdf)} />}{owner && ["draft", "open"].includes(item.status) && <Action title={item.status === "draft" ? "Invia" : "Reinvia"} colors={c} onPress={() => confirmInvoiceAction(item, "send")} />}{owner && ["open", "uncollectible"].includes(item.status) && <Action title="Annulla fattura" colors={c} onPress={() => confirmInvoiceAction(item, "void")} />}</View></View>)}</Panel>
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>RICHIESTE DI PAGAMENTO</Text><Heading colors={c}>Crea un link di pagamento</Heading>{owner ? <><Field label="Descrizione" value={link.description} onChangeText={value => setLink(old => ({ ...old, description: value }))} colors={c} maxLength={200} /><Field label="Importo (€)" value={link.amount} onChangeText={value => setLink(old => ({ ...old, amount: value }))} colors={c} keyboardType="decimal-pad" /><Action title="Crea link Stripe" colors={c} primary disabled={busy || !status.configured} onPress={() => void createPaymentLink()} /></> : <Text style={{ color: c.muted }}>Solo il titolare può creare link di pagamento.</Text>}<Heading colors={c}>Link Stripe</Heading>{links.map(item => <View key={item.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 9, gap: 6 }}><Text style={{ color: c.text, fontWeight: "600" }}>{item.description || "Link Stripe"}{item.amount === null ? "" : ` · ${format(item.amount, item.currency)}`}</Text><Text style={{ color: c.muted }}>{item.active ? "Attivo" : "Disattivato"}</Text><View style={{ flexDirection: "row", gap: 7, flexWrap: "wrap" }}><Action title="Apri" colors={c} onPress={() => void external(item.url)} /><Action title="Condividi" colors={c} onPress={() => void Share.share({ message: item.url })} />{owner && <Action title={item.active ? "Disattiva" : "Riattiva"} colors={c} onPress={() => confirmLink(item)} />}</View></View>)}<Heading colors={c}>Pagamenti recenti</Heading>{overview.payments.map(item => <View key={item.id} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 9, gap: 5 }}><Text style={{ color: c.text, fontWeight: "600" }}>{item.description}</Text><Text style={{ color: c.muted }}>{format(item.amount, item.currency)} · {statusLabels[item.state] || item.state} · {new Date(item.createdAt).toLocaleString("it-IT")}</Text><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{item.checkoutUrl && <Action title="Apri checkout" colors={c} onPress={() => void external(item.checkoutUrl)} />}{owner && <Action title="Aggiorna stato" colors={c} disabled={busy} onPress={() => void run(async () => { await request(`/payments/${item.id}/sync`, "POST", {}); await load(); })} />}{owner && ["paid", "partially_refunded"].includes(item.state) && <Action title="Rimborso totale" colors={c} disabled={busy} onPress={() => confirmRefund(item)} />}</View></View>)}</Panel>
      <Panel colors={c}><Text style={{ color: c.accent, fontSize: 10, fontWeight: "700" }}>CARTE AZIENDALI</Text><Heading colors={c}>Stripe Issuing</Heading>{issuing?.enabled ? <>{(issuing.cards || []).map(card => <View key={card.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderColor: c.line, paddingTop: 9 }}><Text style={{ color: c.text, flex: 1 }}>•••• {card.last4} · {card.name || card.brand} · {card.status}</Text>{owner && <Action title={card.status === "active" ? "Blocca" : "Attiva"} colors={c} onPress={() => void run(async () => { await request(`/issuing/cards/${card.id}`, "PUT", { status: card.status === "active" ? "inactive" : "active", confirmed: true }); await load(); })} />}</View>)}{owner && issuing.holders?.length ? <><Text style={{ color: c.muted }}>Titolare: {issuing.holders.find(holder => holder.id === cardHolder)?.name || "Seleziona"}</Text><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{issuing.holders.map(holder => <Action key={holder.id} title={holder.name} colors={c} primary={holder.id === cardHolder} onPress={() => setCardHolder(holder.id)} />)}</View><Field label="Limite mensile (€)" value={cardLimit} onChangeText={setCardLimit} colors={c} keyboardType="decimal-pad" /><Action title="Crea carta virtuale" colors={c} primary disabled={busy || !cardHolder} onPress={() => void run(async () => { const cents = Math.round(Number(cardLimit) * 100); await request("/issuing/cards", "POST", { cardholder: cardHolder, monthlyLimit: cents, confirmed: true, requestKey: randomKey() }); setCardLimit(""); await load(); })} /></> : !issuing.holders?.length ? <Text style={{ color: c.muted }}>Nessun titolare verificato. Gestisci i titolari nel Dashboard Stripe.</Text> : null}</> : <Text style={{ color: c.muted }}>{issuing?.reason || issuing?.error || "Stripe Issuing richiede l’attivazione e l’approvazione sul conto."}</Text>}</Panel>
    </>}
  </View>;

  async function submitInvoice(send: boolean) {
    const amount = Math.round(Number(invoice.amount) * 100);
    const daysUntilDue = Number(invoice.daysUntilDue);
    if (!invoice.name.trim() || !/^\S+@\S+\.\S+$/.test(invoice.email) || !invoice.description.trim() || !Number.isSafeInteger(amount) || amount < 50 || ![7, 14, 30, 60].includes(daysUntilDue)) { setMessage("Completa cliente, email, descrizione, importo e scadenza validi."); return; }
    const submit = () => void run(async () => { await request("/invoices", "POST", { ...invoice, amount, daysUntilDue, send, requestKey: randomKey() }); setInvoice({ name: "", email: "", description: "", amount: "", daysUntilDue: "30" }); await load(); });
    if (send) Alert.alert("Invia fattura", `Stripe invierà la fattura a ${invoice.email}.`, [{ text: "Annulla", style: "cancel" }, { text: "Invia", onPress: submit }]);
    else submit();
  }
  function confirmInvoiceAction(item: Invoice, action: "send" | "void") {
    Alert.alert(action === "send" ? "Inviare fattura" : "Annullare fattura", `${item.number} · ${item.customer}`, [{ text: "Annulla", style: "cancel" }, { text: "Conferma", onPress: () => void run(async () => { await request(`/invoices/${item.id}/${action}`, "POST", { confirmed: true, requestKey: randomKey() }); await load(); }) }]);
  }
  function confirmLink(item: LinkRow) {
    Alert.alert(item.active ? "Disattivare link" : "Riattivare link", item.description, [{ text: "Annulla", style: "cancel" }, { text: "Conferma", onPress: () => void run(async () => { await request(`/payment-links/${item.id}`, "PUT", { active: !item.active, confirmed: true, requestKey: randomKey() }); await load(); }) }]);
  }
  function confirmRefund(item: Payment) {
    Alert.alert("Rimborso Stripe", `Confermi il rimborso totale di ${format(item.amount, item.currency)}?`, [{ text: "Annulla", style: "cancel" }, { text: "Rimborsa", style: "destructive", onPress: () => void run(async () => { await request(`/payments/${item.id}/refund`, "POST", { confirmed: true, requestKey: randomKey() }); await load(); }) }]);
  }
  function createPaymentLink() {
    const amount = Math.round(Number(link.amount) * 100);
    if (!link.description.trim() || !Number.isSafeInteger(amount) || amount < 50) { setMessage("Indica una descrizione e un importo valido da 0,50 €."); return; }
    void run(async () => { const created = await request<LinkRow>("/payment-links", "POST", { description: link.description, amount, requestKey: randomKey() }); setLink({ description: "", amount: "" }); await load(); if (created.url) await Share.share({ message: created.url }); });
  }
}

function ReportGraph({ rows, colors: c, style, format }: { rows: { month: string; income: number; pending: number; cost: number; index: number }[]; colors: Colors; style: "bars" | "lines" | "pie"; format: (amount: number) => string }) {
  const shades = ["#53b77a", "#e5a541", "#df655b"];
  const max = Math.max(1, ...rows.flatMap(row => [row.income, row.pending, row.cost]));
  const series = ["income", "pending", "cost"] as const;
  const point = (value: number, index: number) => `${18 + index * (324 / Math.max(rows.length - 1, 1))},${126 - value / max * 100}`;
  return <View style={{ gap: 8 }}><Svg width="100%" height={144} viewBox="0 0 360 144" preserveAspectRatio="none">{[26,59,92,125].map(y => <Path key={y} d={`M0 ${y}H360`} stroke={c.line} strokeWidth={1} />)}{style === "bars" && rows.map((row, index) => <React.Fragment key={row.month}>{series.map((key, seriesIndex) => { const height = row[key] / max * 96; const barWidth = Math.min(8, 54 / rows.length); const group = 270 / rows.length; return <Rect key={key} x={index * group + 4 + seriesIndex * (barWidth + 1)} y={126 - height} width={barWidth} height={height} rx={2} fill={shades[seriesIndex]} />; })}</React.Fragment>)}{style === "lines" && series.map((key, index) => <Path key={key} d={rows.map((row, rowIndex) => `${rowIndex ? "L" : "M"}${point(row[key], rowIndex)}`).join(" ")} fill="none" stroke={shades[index]} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />)}</Svg><View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>{series.map((key, index) => <Text key={key} style={{ color: shades[index], fontSize: 11 }}>{key === "income" ? "Incassi" : key === "pending" ? "In attesa" : "Costi"} · {format(rows.reduce((sum, row) => sum + row[key], 0))}</Text>)}</View></View>;
}
