import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Circle, Path, Rect, Text as SvgText, SvgXml } from "react-native-svg";
import type { PrimeApi } from "./api";
import providerLogos from "./provider-logos.json";
import WallesterOperations from "./WallesterOperations";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };
type Account = { id: string; name: string; currency_code: string; balance: number; available_amount: number; blocked_amount: number; status?: string; is_main?: boolean };
type Category = "income" | "payments" | "pending" | "fees" | "transfers" | "adjustments";
type Series = { month: string } & Record<Category, number>;
type Analytics = { accounts: Account[]; currencies: string[]; currency: string; series: Series[]; last_synced_at?: string; sync_status?: string; notice: string };
type Movement = { account_id: string; account_name: string; record_id: string; record_date: string; record_type: string; record_status: string; description: string; merchant_name?: string; account_amount: number; account_currency_code: string; transaction_amount?: number; transaction_currency_code?: string; details?: Record<string, unknown>; receipt?: { available: boolean; label?: string; reason?: string } };
type MovementPage = { transactions: Movement[]; total: number; limit: number; offset: number; next_offset: number | null };
type ChartStyle = "bars" | "line" | "pie";

const categories: { key: Category; label: string; color: string }[] = [
  { key: "income", label: "Entrate", color: "#22c55e" },
  { key: "payments", label: "Pagamenti", color: "#ef4444" },
  { key: "pending", label: "Autorizzazioni e attese", color: "#facc15" },
  { key: "fees", label: "Commissioni", color: "#c084fc" },
  { key: "transfers", label: "Disposizioni di bonifico", color: "#3b82f6" },
  { key: "adjustments", label: "Rettifiche in uscita", color: "#f97316" },
];
const euro = (value: number, currency: string) => {
  try { return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(value); }
  catch { return `${value.toFixed(2)} ${currency}`; }
};
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("it-IT");
};
const monthLabel = (value: string) => {
  const date = new Date(`${value}-01T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" });
};

function Panel({ children, colors: c }: { children: React.ReactNode; colors: Colors }) {
  return <View style={{ backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 15, gap: 11 }}>{children}</View>;
}
function Button({ title, colors: c, onPress, disabled = false, selected = false }: { title: string; colors: Colors; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled} style={{ borderWidth: 1, borderColor: selected ? c.accent : c.line, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 11, opacity: disabled ? 0.5 : 1, backgroundColor: selected ? `${c.accent}20` : "transparent" }}><Text style={{ color: selected ? c.accent : c.text, fontSize: 12, fontWeight: selected ? "700" : "500" }}>{title}</Text></Pressable>;
}

function FinanceGraph({ rows, currency, style, selected, colors: c, onSelect }: { rows: Series[]; currency: string; style: ChartStyle; selected: Category | ""; colors: Colors; onSelect: (key: Category | "") => void }) {
  const totals = categories.map(category => rows.reduce((sum, row) => sum + Number(row[category.key] || 0), 0));
  const volume = totals.reduce((sum, value) => sum + value, 0);
  const max = Math.max(1, ...rows.flatMap(row => categories.map(category => Number(row[category.key] || 0))));
  const x = (index: number) => 38 + (index + 0.5) * 324 / Math.max(rows.length, 1);
  const y = (value: number) => 126 - value / max * 102;
  let consumed = -90;
  return <View style={{ gap: 10 }}>
    <Svg width="100%" height={style === "pie" ? 210 : 160} viewBox={style === "pie" ? "0 0 360 220" : "0 0 360 160"} preserveAspectRatio="none" accessibilityLabel={`Andamento finanziario Wallester in ${currency}`}>
      {style !== "pie" && [24, 58, 92, 126].map(value => <Path key={value} d={`M30 ${value}H355`} stroke={c.line} strokeWidth={1} />)}
      {style === "bars" && rows.map((row, index) => <React.Fragment key={row.month}>{categories.map((category, catIndex) => { const amount = Number(row[category.key] || 0); const width = Math.max(0.8, Math.min(6, 42 / Math.max(rows.length, 1))); const groupWidth = 320 / Math.max(rows.length, 1); return <Rect key={category.key} x={x(index) - groupWidth / 2 + catIndex * width} y={y(amount)} width={Math.max(0.6, width - 0.7)} height={Math.max(0, 126 - y(amount))} rx={1} fill={category.color} opacity={selected && selected !== category.key ? 0.22 : 1} />; })}</React.Fragment>)}
      {style === "line" && categories.map(category => <React.Fragment key={category.key}><Path d={rows.map((row, index) => `${index ? "L" : "M"}${x(index)},${y(Number(row[category.key] || 0))}`).join(" ")} fill="none" stroke={category.color} strokeWidth={2.5} opacity={selected && selected !== category.key ? 0.2 : 1} />{rows.map((row, index) => <Circle key={`${row.month}-${category.key}`} cx={x(index)} cy={y(Number(row[category.key] || 0))} r={2.3} fill={category.color} opacity={selected && selected !== category.key ? 0.2 : 1} />)}</React.Fragment>)}
      {style === "pie" && <>
        <Circle cx={180} cy={106} r={72} fill="none" stroke={c.line} strokeWidth={22} />
        {volume > 0 && categories.map((category, index) => { const start = consumed; const sweep = totals[index] / volume * 359.8; consumed += sweep; const a1 = start * Math.PI / 180; const a2 = (start + sweep) * Math.PI / 180; const radius = 72; const p1 = [180 + radius * Math.cos(a1), 106 + radius * Math.sin(a1)]; const p2 = [180 + radius * Math.cos(a2), 106 + radius * Math.sin(a2)]; return <Path key={category.key} d={`M${p1[0]} ${p1[1]} A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} 1 ${p2[0]} ${p2[1]}`} fill="none" stroke={category.color} strokeWidth={22} opacity={selected && selected !== category.key ? 0.2 : 1} />; })}
        <SvgText x={180} y={103} fill={c.muted} textAnchor="middle" fontSize={11}>{selected ? categories.find(item => item.key === selected)?.label : "Totale movimenti"}</SvgText>
        <SvgText x={180} y={123} fill={c.text} textAnchor="middle" fontSize={12} fontWeight="700">{euro(selected ? totals[categories.findIndex(item => item.key === selected)] : volume, currency)}</SvgText>
      </>}
    </Svg>
    {style !== "pie" && <View style={{ flexDirection: "row", justifyContent: "space-between" }}>{rows.map((row, index) => <Text key={row.month} style={{ color: c.muted, fontSize: 8 }}>{index % Math.max(1, Math.ceil(rows.length / 6)) === 0 ? monthLabel(row.month) : ""}</Text>)}</View>}
    <View style={{ gap: 6 }}><Text style={{ color: c.text, fontWeight: "600" }}>Legenda · {rows.length} mesi · {currency}</Text>{categories.map((category, index) => { const percent = volume > 0 ? totals[index] / volume * 100 : 0; const active = selected === category.key; return <Pressable key={category.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(active ? "" : category.key)} style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4, opacity: selected && !active ? 0.5 : 1 }}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: category.color }} /><Text style={{ color: c.text, flex: 1, fontSize: 11 }}>{category.label}</Text><Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>{euro(totals[index], currency)}</Text><Text style={{ color: c.muted, width: 42, textAlign: "right", fontSize: 10 }}>{percent.toFixed(1).replace(".", ",")}%</Text></Pressable>; })}</View>
  </View>;
}

export default function WallesterWorkspace({ api, colors: c, demo, role, onAnalyze, onManageConnection }: { api: PrimeApi; colors: Colors; demo: boolean; role: string; onAnalyze?: () => void; onManageConnection?: () => void }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [movements, setMovements] = useState<MovementPage | null>(null);
  const [account, setAccount] = useState("");
  const [currency, setCurrency] = useState("");
  const [months, setMonths] = useState(12);
  const [offset, setOffset] = useState(0);
  const [style, setStyle] = useState<ChartStyle>("bars");
  const [selectedCategory, setSelectedCategory] = useState<Category | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [receiptBusy, setReceiptBusy] = useState("");
  const generation = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const requestId = ++generation.current;
    setBusy(true); setMessage("");
    try {
      if (refresh && !demo) await api.post("/api/connect/wallester/sync", {});
      const query = new URLSearchParams({ months: String(months), ...(account ? { account } : {}), ...(currency ? { currency } : {}) }).toString();
      const [summary, page] = await Promise.all([
        api.get<Analytics>(`/api/connect/wallester/analytics?${query}`),
        api.get<MovementPage>(`/api/connect/wallester/movements?limit=50&offset=${offset}&${query}`),
      ]);
      if (requestId !== generation.current) return;
      setAnalytics(summary); setMovements(page);
      if (summary.currency && summary.currency !== currency) setCurrency(summary.currency);
    } catch (error) {
      if (requestId === generation.current) setMessage(error instanceof Error ? error.message : "Dati Wallester non disponibili.");
    } finally {
      if (requestId === generation.current) setBusy(false);
    }
  }, [api, account, currency, demo, months, offset]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { if (active) void load(); }, 0);
    return () => { active = false; clearTimeout(timer); generation.current += 1; };
  }, [load]);
  useEffect(() => {
    if (analytics?.sync_status !== "running") return;
    const timer = setTimeout(() => { void load(); }, 2500);
    return () => clearTimeout(timer);
  }, [analytics?.sync_status, load]);
  const accounts = useMemo(() => analytics?.accounts || [], [analytics?.accounts]);
  const currencies = useMemo(() => analytics?.currencies || [], [analytics?.currencies]);
  const visibleAccounts = useMemo(() => accounts.filter(item => item.currency_code === (currency || analytics?.currency)), [accounts, analytics?.currency, currency]);
  const openReceipt = async (item: Movement) => {
    const key = `${item.account_id}:${item.record_id}`;
    setReceiptBusy(key); setMessage("");
    try {
      const response = await api.get<{ url: string }>(`/api/connect/wallester/movements/receipt?${new URLSearchParams({ account: item.account_id, record: item.record_id })}`);
      const target = new URL(response.url);
      if (target.protocol !== "https:" || target.username || target.password) throw Error("Collegamento al documento non valido.");
      await Linking.openURL(target.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Documento Wallester non disponibile."); }
    finally { setReceiptBusy(""); }
  };
  const panel = { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 9 } as const;
  const small = { color: c.muted, fontSize: 12, lineHeight: 18 } as const;
  return <View style={{ gap: 14 }}>
    <Panel colors={c}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 9 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><SvgXml xml={(providerLogos as Record<string, string>).wallester} width={50} height={28} /><Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Wallester Business</Text></View><Text style={{ color: demo ? "#e6af54" : "#32c879", fontSize: 11, fontWeight: "700" }}>{demo ? "DATI DIMOSTRATIVI" : "CONTO COLLEGATO"}</Text></View>
      <Text style={small}>{demo ? analytics?.notice || "Dati interamente fittizi della demo pubblica PRIME. Nessun conto reale è collegato." : analytics?.notice || "Saldi e movimenti sincronizzati da Wallester Business."}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button title={demo ? "Aggiorna esempio" : "Aggiorna da Wallester"} colors={c} onPress={() => void load(true)} disabled={busy} />{onAnalyze && <Button title="Analizza con Vanessa" colors={c} onPress={onAnalyze} />}{!demo && onManageConnection && <Button title="Gestisci collegamento" colors={c} onPress={onManageConnection} />}</View>
      {analytics?.last_synced_at ? <Text style={small}>{demo ? "Esempio aggiornato" : "Ultima sincronizzazione"}: {new Date(analytics.last_synced_at).toLocaleString("it-IT")}{analytics.sync_status === "running" ? " · aggiornamento in corso" : ""}</Text> : null}
    </Panel>
    <Panel colors={c}>
      <Text style={{ color: c.text, fontWeight: "600" }}>Filtri</Text>
      <Text style={small}>Conto</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}><Button title="Tutti i conti" colors={c} selected={!account} onPress={() => { setAccount(""); setOffset(0); }} disabled={busy} />{accounts.map(item => <Button key={item.id} title={`${item.name} · ${item.currency_code}`} colors={c} selected={account === item.id} onPress={() => { setAccount(item.id); setCurrency(item.currency_code); setOffset(0); }} disabled={busy} />)}</View>
      <Text style={small}>Valuta</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{currencies.map(code => <Button key={code} title={code} colors={c} selected={(currency || analytics?.currency) === code} onPress={() => { setCurrency(code); setOffset(0); }} disabled={busy} />)}</View>
      <Text style={small}>Periodo</Text><View style={{ flexDirection: "row", gap: 7 }}>{[3, 6, 12, 24].map(value => <Button key={value} title={`${value} mesi`} colors={c} selected={months === value} onPress={() => { setMonths(value); setOffset(0); }} disabled={busy} />)}</View>
    </Panel>
    <View style={{ gap: 9 }}>
      {visibleAccounts.map(item => <View key={item.id} style={panel}><Text style={{ color: c.text, fontWeight: "600" }}>{item.name} · {item.currency_code}</Text><Text style={{ color: item.balance > 0 ? "#32c879" : c.text, fontSize: 23, fontWeight: "700" }}>{euro(item.balance, item.currency_code)}</Text><Text style={small}>Disponibile {euro(item.available_amount, item.currency_code)} · Bloccato {euro(item.blocked_amount, item.currency_code)}</Text></View>)}
    </View>
    <Panel colors={c}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>Andamento finanziario</Text>
      <View style={{ flexDirection: "row", gap: 7 }}>{([ ["bars", "Barre"], ["line", "Linee"], ["pie", "Torta"] ] as const).map(([key, title]) => <Button key={key} title={title} colors={c} selected={style === key} onPress={() => setStyle(key)} />)}</View>
      {analytics ? <FinanceGraph rows={analytics.series} currency={analytics.currency} style={style} selected={selectedCategory} colors={c} onSelect={setSelectedCategory} /> : <Text style={small}>Caricamento del report finanziario…</Text>}
      {analytics?.notice ? <Text style={small}>{analytics.notice}</Text> : null}
    </Panel>
    <Panel colors={c}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>Movimenti</Text>
      <Text style={small}>Storico sincronizzato · autorizzazioni e disposizioni non costituiscono ulteriori pagamenti contabilizzati.</Text>
      {movements?.transactions.map(item => <View key={`${item.account_id}-${item.record_id}`} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: 9, gap: 4 }}>
        <Text style={{ color: c.text, fontWeight: "600" }}>{item.description || item.merchant_name || item.record_type}</Text>
        <Text style={small}>{dateLabel(item.record_date)} · {item.account_name} · {item.record_type} · {item.record_status}</Text>
        <Text style={{ color: item.account_amount > 0 ? "#32c879" : c.text, fontWeight: "600" }}>{euro(item.account_amount, item.account_currency_code)}</Text>
        {item.receipt?.available ? <Button title={receiptBusy === `${item.account_id}:${item.record_id}` ? "Recupero documento…" : item.receipt.label || "Documento ufficiale"} colors={c} onPress={() => void openReceipt(item)} disabled={!!receiptBusy} /> : <Text style={small}>{item.receipt?.reason || "Ricevuta non disponibile per questo movimento."}</Text>}
      </View>)}
      {!movements?.transactions.length && <Text style={small}>{busy ? "Caricamento movimenti…" : "Nessun movimento nel periodo selezionato."}</Text>}
      {movements && <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}><Button title="‹ Precedenti" colors={c} onPress={() => setOffset(Math.max(0, offset - 50))} disabled={!offset || busy} /><Text style={small}>{movements.total ? `${offset + 1}–${Math.min(offset + movements.transactions.length, movements.total)} di ${movements.total}` : "0 movimenti"}</Text><Button title="Successivi ›" colors={c} onPress={() => setOffset(movements.next_offset ?? offset)} disabled={movements.next_offset === null || busy} /></View>}
    </Panel>
    <WallesterOperations api={api} colors={c} demo={demo} role={role} accounts={accounts} onChanged={() => { void load(); }} />
    {message ? <Text accessibilityRole="alert" style={{ color: c.muted }}>{message}</Text> : null}
    {role === "external" && <Text style={small}>L’accesso è in sola lettura per questo ruolo.</Text>}
  </View>;
}

