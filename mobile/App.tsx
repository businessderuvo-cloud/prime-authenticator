import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ApiError,
  Billing,
  Challenge,
  clients,
  Kyb,
  Me,
  Mode,
  Row,
} from "./src/api";
import { PrimeStore, StoreConfig, StoreItem } from "./src/store";
const gold = "#C8AD7C";
const tabs = [
  "Home",
  "Immobili",
  "Contatti",
  "Agenda",
  "Piani",
  "Account",
] as const;
type Tab = (typeof tabs)[number];
const plans = ["standard", "pro", "vip", "elite", "secret"];
const names: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  vip: "VIP",
  elite: "Elite",
  secret: "Secret",
};
const labels: Record<string, string> = {
  title: "Titolo",
  price: "Prezzo",
  marketing_status: "Stato",
  notes: "Note",
  starts_at: "Inizio",
  ends_at: "Fine",
  status: "Stato",
  phone: "Telefono",
  email: "Email",
  first_name: "Nome",
  last_name: "Cognome",
  contact_type: "Tipo contatto",
  mandate_expires_on: "Scadenza incarico",
};
const descriptions: Record<string, string> = {
  standard: "Il lavoro quotidiano della tua agenzia.",
  pro: "Più strumenti per organizzare il team.",
  vip: "Assistenti AI e funzioni avanzate.",
  elite: "Il workspace per un’operatività evoluta.",
  secret: "Soluzione su misura per la tua agenzia.",
};
const money = (v: unknown) =>
  typeof v === "number"
    ? new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v)
    : "";
const message = (e: unknown) =>
  e instanceof Error
    ? e.name === "AbortError"
      ? "La connessione sta impiegando troppo tempo. Riprova."
      : e.message
    : "Operazione non riuscita.";
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: gold }]}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  secret = false,
  email = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secret?: boolean;
  email?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secret}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={email ? "email-address" : "default"}
        style={s.input}
      />
    </View>
  );
}
function AppContent() {
  const [mode, setMode] = useState<Mode>("demo");
  const [me, setMe] = useState<Me | null>(null);
  const params = useLocalSearchParams<{tab?: string}>();
  const tab: Tab = tabs.includes(params.tab as Tab) ? params.tab as Tab : "Home";
  const setTab = (next: Tab) => router.setParams({tab: next});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agency, setAgency] = useState("");
  const [register, setRegister] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [method, setMethod] = useState("totp");
  const [code, setCode] = useState("");
  const [codeToken, setCodeToken] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [dashboard, setDashboard] = useState<{
    appointments: Row[];
    deadlines: Row[];
    recent: Row[];
  } | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [kyb, setKyb] = useState<Kyb | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [storeNotice, setStoreNotice] = useState("");
  const store = useRef<PrimeStore | null>(null);
  const generation = useRef(0);
  const api = clients[mode];
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function load(target: Tab, who = me, selectedMode = mode) {
    if (!who) return;
    const epoch = generation.current;
    const client = clients[selectedMode];
    if (["Home", "Immobili", "Contatti", "Agenda"].includes(target)) {
      const entity = {
        Immobili: "properties",
        Contatti: "contacts",
        Agenda: "appointments",
      }[target as "Immobili" | "Contatti" | "Agenda"];
      const data = await client.get(
        target === "Home" ? "/api/dashboard" : `/api/entities/${entity}`,
      );
      if (epoch !== generation.current) return;
      if (target === "Home") setDashboard(data as typeof dashboard);
      else setRows(data as Row[]);
    }
    if (
      (target === "Account" || target === "Piani") &&
      selectedMode === "live"
    ) {
      setBilling(null);
      setKyb(null);
      if (who.role === "owner") {
        const status = await client.get<Billing>("/api/billing/status");
        if (epoch !== generation.current) return;
        setBilling(status);
      }
      if (["owner", "manager"].includes(who.role)) {
        const status = await client.get<Kyb>("/api/kyb");
        if (epoch !== generation.current) return;
        setKyb(status);
      }
      if (target === "Piani") {
        await store.current?.close();
        store.current = null;
        setItems([]);
        try {
          const config = await client.get<StoreConfig>(
            `/api/mobile/store/config?platform=${Platform.OS}`,
          );
          if (epoch !== generation.current) return;
          if (!config.enabled) {
            setStoreNotice(
              config.reason ||
                "Gli acquisti negli store non sono ancora attivi.",
            );
            return;
          }
          const next = new PrimeStore(client, config, (text) =>
            Alert.alert("Abbonamento PRIME", text),
          );
          store.current = next;
          const products = await next.connect();
          if (epoch !== generation.current) {
            await next.close();
            return;
          }
          setItems(products);
          setStoreNotice(
            products.length
              ? ""
              : "Nessun abbonamento disponibile nello store.",
          );
        } catch (e) {
          if (epoch !== generation.current) return;
          if (e instanceof ApiError && e.status === 404)
            setStoreNotice(
              "Gli acquisti Apple e Google Play saranno disponibili dopo la configurazione degli account sviluppatore e del collegamento al gestionale.",
            );
          else throw e;
        }
      }
    }
  }
  useEffect(() => {
    void run(async () => {
      const restored = await clients.live.restore();
      if (restored) {
        setMode("live");
        setMe(restored);
        await load("Home", restored, "live");
      }
    });
    return () => {
      void store.current?.close();
    };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (
        state === "active" &&
        mode === "live" &&
        me &&
        ["Account", "Piani"].includes(tab)
      )
        void run(() => load(tab));
    });
    return () => listener.remove();
  }, [tab, mode, me]);
  async function switchMode(next: Mode) {
    generation.current++;
    await store.current?.close();
    store.current = null;
    setMode(next);
    setMe(null);
    setRows([]);
    setDashboard(null);
    setBilling(null);
    setKyb(null);
    setItems([]);
    setError("");
    setTab("Home");
    setChallenge(null);
    setPassword("");
    setCode("");
    setCodeToken("");
    setDetail(null);
    setQuery("");
    if (next === "live") {
      const restored = await clients.live.restore();
      if (restored) {
        setMe(restored);
        await load("Home", restored, next);
      }
    }
  }
  async function enterDemo() {
    const who = await clients.demo.startDemo();
    setMe(who);
    await load("Home", who, "demo");
  }
  async function login() {
    if (register) {
      await api.register(email, password, agency);
      setPassword("");
      setRegister(false);
      Alert.alert(
        "Verifica la tua email",
        "Apri il messaggio ricevuto da PRIME per attivare l’account, poi accedi.",
      );
      return;
    }
    const result = await api.login(email, password);
    setPassword("");
    if ("requires_two_factor" in result) {
      setChallenge(result);
      setMethod(result.methods[0]);
      return;
    }
    const who = await api.me();
    setMe(who);
    await load("Home", who);
  }
  async function verify() {
    if (!challenge) return;
    const result = await api.verifyCode(
      challenge.challenge,
      method,
      code,
      codeToken,
    );
    setCode("");
    setCodeToken("");
    if ("requires_two_factor" in result) {
      setChallenge(result);
      setMethod(
        result.methods.find((x) => !result.verified.includes(x)) ||
          result.methods[0],
      );
      return;
    }
    setChallenge(null);
    const who = await api.me();
    setMe(who);
    await load("Home", who);
  }
  async function startKyb() {
    const state = await api.post<Kyb>("/api/kyb/session");
    setKyb(state);
    if (state.session?.url) {
      const url = new URL(state.session.url);
      if (url.protocol !== "https:")
        throw Error("Link di verifica non valido.");
      await Linking.openURL(url.href);
    }
  }
  async function navigate(next: Tab) {
    setTab(next);
    setQuery("");
    setRows([]);
    await load(next);
  }
  const list = rows.filter((row) =>
    Object.values(row).some(
      (v) =>
        typeof v === "string" &&
        v.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")),
    ),
  );
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <View style={s.brand}>
            <Image
              source={require("./assets/prime-logo.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <View>
              <Text style={s.wordmark}>PRIME</Text>
              <Text style={s.eyebrow}>IL TUO WORKSPACE IMMOBILIARE</Text>
            </View>
          </View>
          <View accessibilityRole="tablist" style={s.switch}>
            {(["demo", "live"] as Mode[]).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m, disabled: busy }}
                disabled={busy || m === mode}
                onPress={() => void run(() => switchMode(m))}
                style={[s.switchItem, mode === m && s.selected]}
              >
                <Text
                  style={[s.switchText, mode === m && { color: "#15130E" }]}
                >
                  {m.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            me ? (
              <RefreshControl
                tintColor={gold}
                refreshing={busy}
                onRefresh={() => void run(() => load(tab))}
              />
            ) : undefined
          }
        >
          {busy && (
            <ActivityIndicator color={gold} accessibilityLabel="Caricamento" />
          )}
          {!!error && (
            <View accessibilityRole="alert" style={s.error}>
              <Text style={s.text}>{error}</Text>
              {mode === "demo" && me && (
                <Button
                  title="Riavvia demo"
                  secondary
                  disabled={busy}
                  onPress={() => void run(enterDemo)}
                />
              )}
            </View>
          )}
          {!me ? (
            <>
              <Text style={s.kicker}>
                {mode === "demo" ? "SCOPRI PRIME" : "BENTORNATO IN PRIME"}
              </Text>
              <Text style={s.hero}>
                {mode === "demo"
                  ? "La tua agenzia.\nSempre con te."
                  : "Il tuo gestionale,\novunque sei."}
              </Text>
              <Text style={s.subtitle}>
                {mode === "demo"
                  ? "Esplora il gestionale con la demo pubblica del sito. Nessuna registrazione, nessuna password."
                  : "Accedi alla tua agenzia con le credenziali PRIME. Ritrovi i dati e i permessi del gestionale."}
              </Text>
              {mode === "demo" ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Entra e prova PRIME</Text>
                  <Text style={s.muted}>
                    La demo usa uno spazio dimostrativo separato dai dati della
                    tua agenzia.
                  </Text>
                  <Button
                    title="Entra nella demo pubblica"
                    disabled={busy}
                    onPress={() => void run(enterDemo)}
                  />
                  <Text style={s.caption}>
                    Standard · Pro · VIP · Elite · Secret
                  </Text>
                </View>
              ) : (
                <View style={s.card}>
                  {challenge ? (
                    <>
                      <Text style={s.cardTitle}>Verifica di sicurezza</Text>
                      <Text style={s.muted}>
                        Completa i metodi richiesti dal tuo account.
                      </Text>
                      <View style={s.wrap}>
                        {challenge.methods
                          .filter((x) => !challenge.verified.includes(x))
                          .map((x) => (
                            <Button
                              key={x}
                              title={
                                x === "totp" ? "Authenticator" : x.toUpperCase()
                              }
                              secondary
                              disabled={busy}
                              onPress={() => {
                                setMethod(x);
                                setCodeToken("");
                                setCode("");
                              }}
                            />
                          ))}
                      </View>
                      <Text style={s.label}>Metodo: {method}</Text>
                      {method !== "totp" && (
                        <Button
                          title="Invia codice"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void run(async () => {
                              const data = await api.sendCode(
                                challenge.challenge,
                                method,
                              );
                              setCodeToken(data.code_token);
                            })
                          }
                        />
                      )}
                      <Field
                        label="Codice di verifica"
                        value={code}
                        onChange={setCode}
                      />
                      <Button
                        title="Conferma accesso"
                        disabled={busy || !code}
                        onPress={() => void run(verify)}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={s.cardTitle}>
                        {register
                          ? "Crea la tua agenzia"
                          : "Accedi a PRIME Live"}
                      </Text>
                      {register && (
                        <Field
                          label="Nome agenzia"
                          value={agency}
                          onChange={setAgency}
                        />
                      )}
                      <Field
                        label="Email"
                        value={email}
                        onChange={setEmail}
                        email
                      />
                      <Field
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        secret
                      />
                      <Button
                        title={register ? "Registrati" : "Accedi"}
                        disabled={
                          busy || !email || !password || (register && !agency)
                        }
                        onPress={() => void run(login)}
                      />
                      <Button
                        title={
                          register ? "Ho già un account" : "Crea un account"
                        }
                        disabled={busy}
                        secondary
                        onPress={() => setRegister(!register)}
                      />
                      <Button
                        title="Password dimenticata"
                        disabled={busy || !email}
                        secondary
                        onPress={() =>
                          void run(async () => {
                            await api.recovery(email);
                            Alert.alert(
                              "Recupero password",
                              "Se l’indirizzo è registrato riceverai un’email con le istruzioni.",
                            );
                          })
                        }
                      />
                    </>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={s.context}>
                <Text style={s.kicker}>
                  {mode === "demo"
                    ? `DEMO PUBBLICA · ${names[me.demo_plan || "standard"]}`
                    : "AREA LIVE"}
                </Text>
                <Text style={s.muted}>{me.tenant}</Text>
              </View>
              <Text style={s.title}>
                {tab === "Home" ? "La tua giornata" : tab}
              </Text>
              {tab === "Home" && dashboard && (
                <>
                  <Text style={s.subtitle}>
                    Tutto ciò che conta, a portata di mano.
                  </Text>
                  <View style={s.wrap}>
                    <View style={s.metric}>
                      <Text style={s.number}>
                        {dashboard.appointments.length}
                      </Text>
                      <Text style={s.muted}>Appuntamenti oggi</Text>
                    </View>
                    <View style={s.metric}>
                      <Text style={s.number}>{dashboard.deadlines.length}</Text>
                      <Text style={s.muted}>Scadenze da seguire</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>Immobili recenti</Text>
                  {dashboard.recent.map((row) => (
                    <Pressable
                      key={row.id}
                      style={s.card}
                      onPress={() => setDetail(row)}
                    >
                      <Text style={s.cardTitle}>{row.title}</Text>
                      <Text style={s.gold}>{money(row.price)}</Text>
                      <Text style={s.muted}>
                        {String(row.marketing_status || "")}
                      </Text>
                    </Pressable>
                  ))}
                </>
              )}
              {["Immobili", "Contatti", "Agenda"].includes(tab) && (
                <>
                  <TextInput
                    accessibilityLabel={`Cerca in ${tab}`}
                    placeholder={`Cerca in ${tab.toLowerCase()}…`}
                    placeholderTextColor="#92938F"
                    value={query}
                    onChangeText={setQuery}
                    style={s.input}
                  />
                  {list.map((row) => (
                    <Pressable
                      accessibilityRole="button"
                      key={row.id}
                      style={s.card}
                      onPress={() => setDetail(row)}
                    >
                      <Text style={s.cardTitle}>{row.title}</Text>
                      <Text style={s.gold}>
                        {tab === "Immobili"
                          ? money(row.price)
                          : String(
                              row.phone || row.starts_at || row.email || "",
                            )}
                      </Text>
                      <Text style={s.muted}>
                        {String(
                          row.marketing_status ||
                            row.status ||
                            row.contact_type ||
                            "",
                        )}
                      </Text>
                    </Pressable>
                  ))}
                  {!list.length && !busy && (
                    <Text style={s.muted}>Nessun elemento trovato.</Text>
                  )}
                </>
              )}
              {tab === "Piani" && (
                <>
                  <Text style={s.subtitle}>
                    {mode === "demo"
                      ? "Prova i diversi piani nella demo, senza acquisti."
                      : "Scegli il piano per la tua agenzia."}
                  </Text>
                  {mode === "live" && (
                    <View style={s.card}>
                      <Text style={s.cardTitle}>Acquisti nell’app</Text>
                      <Text style={s.muted}>
                        {storeNotice ||
                          "Caricamento disponibilità dello store…"}
                      </Text>
                      {billing && (
                        <Text style={s.muted}>
                          Verifica agenzia: {billing.kyb}
                        </Text>
                      )}
                      <Text style={s.caption}>
                        Gli abbonamenti prevedono il rinnovo automatico. Prezzo
                        e condizioni sono mostrati dallo store prima della
                        conferma.
                      </Text>
                    </View>
                  )}
                  {plans.map((plan) => (
                    <View style={s.card} key={plan}>
                      <Text style={s.cardTitle}>PRIME {names[plan]}</Text>
                      <Text style={s.muted}>{descriptions[plan]}</Text>
                      {mode === "demo" ? (
                        <Button
                          title={
                            me.demo_plan === plan
                              ? "Piano attuale"
                              : `Prova ${names[plan]}`
                          }
                          disabled={busy || me.demo_plan === plan}
                          secondary={me.demo_plan !== plan}
                          onPress={() =>
                            void run(async () => {
                              setMe(await api.plan(plan));
                            })
                          }
                        />
                      ) : (
                        <>
                          {items
                            .filter((x) => x.plan === plan)
                            .map((x) => (
                              <Button
                                key={x.productId}
                                title={`${x.displayPrice} / ${x.period === "annual" ? "anno" : "mese"}`}
                                disabled={
                                  busy ||
                                  !billing?.canPay ||
                                  me.role !== "owner"
                                }
                                onPress={() =>
                                  void run(async () => {
                                    await store.current!.buy(x.productId);
                                  })
                                }
                              />
                            ))}
                          {!items.some((x) => x.plan === plan) && (
                            <Text style={s.caption}>
                              {plan === "secret"
                                ? "Piano su preventivo."
                                : "Acquisto non ancora disponibile."}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  ))}
                  {mode === "live" && (
                    <Button
                      title="Ripristina acquisti"
                      secondary
                      disabled={busy || !items.length}
                      onPress={() =>
                        void run(async () => {
                          await store.current!.restore();
                          await load("Piani");
                        })
                      }
                    />
                  )}
                </>
              )}
              {tab === "Account" && (
                <>
                  <View style={s.card}>
                    <Text style={s.cardTitle}>{me.tenant}</Text>
                    <Text style={s.muted}>{me.email}</Text>
                    <Text style={s.caption}>
                      Ruolo: {me.role} · {mode.toUpperCase()}
                    </Text>
                  </View>
                  {mode === "live" && (
                    <View style={s.card}>
                      <Text style={s.cardTitle}>Verifica agenzia · KYB</Text>
                      <Text style={s.muted}>
                        {kyb
                          ? `Stato: ${kyb.session?.status || "non iniziata"}${kyb.environment === "sandbox" ? " · ambiente di prova" : ""}`
                          : "La verifica è gestita dal titolare dell’agenzia."}
                      </Text>
                      {kyb?.sandbox_verified && (
                        <Text style={s.muted}>
                          Una verifica sandbox non abilita gli acquisti Live.
                        </Text>
                      )}
                      {kyb?.configured &&
                        me.role === "owner" &&
                        !kyb.verified && (
                          <>
                            <Text style={s.caption}>
                              La raccolta dei documenti si apre nel servizio
                              sicuro di verifica. Al rientro puoi aggiornare lo
                              stato.
                            </Text>
                            <Button
                              title="Completa verifica agenzia"
                              disabled={busy}
                              onPress={() => void run(startKyb)}
                            />
                          </>
                        )}
                      {kyb?.session && (
                        <Button
                          title="Aggiorna verifica"
                          secondary
                          disabled={busy}
                          onPress={() =>
                            void run(async () => {
                              setKyb(await api.post<Kyb>("/api/kyb/refresh"));
                              await load("Account");
                            })
                          }
                        />
                      )}
                    </View>
                  )}
                  <Button
                    title={
                      mode === "demo" ? "Esci dalla demo" : "Esci dall’account"
                    }
                    secondary
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        generation.current++;
                        await store.current?.close();
                        store.current = null;
                        try {
                          await api.logout();
                        } finally {
                          setMe(null);
                          setRows([]);
                          setDashboard(null);
                          setBilling(null);
                          setKyb(null);
                          setItems([]);
                          setTab("Home");
                        }
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          <Text style={s.footer}>PRIME · Il tuo prossimo passo.</Text>
        </ScrollView>
        {me && (
          <View style={s.nav}>
            {tabs.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t, disabled: busy }}
                disabled={busy}
                onPress={() => void run(() => navigate(t))}
                style={s.navItem}
              >
                <Text style={[s.navText, tab === t && { color: gold }]}>
                  {t}
                </Text>
                <View style={[s.dot, tab === t && { backgroundColor: gold }]} />
              </Pressable>
            ))}
          </View>
        )}
        <Modal
          visible={!!detail}
          animationType="slide"
          onRequestClose={() => setDetail(null)}
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.content}>
              <Button
                title="Chiudi scheda"
                secondary
                onPress={() => setDetail(null)}
              />
              <Text style={s.title}>{detail?.title}</Text>
              {detail &&
                Object.entries(detail)
                  .filter(
                    ([key, value]) =>
                      labels[key] && value != null && value !== "",
                  )
                  .map(([key, value]) => (
                    <View key={key} style={s.card}>
                      <Text style={s.label}>{labels[key]}</Text>
                      <Text selectable style={s.text}>
                        {key === "price" ? money(value) : String(value)}
                      </Text>
                    </View>
                  ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0C0F0E" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#282D29",
    gap: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 64, height: 40 },
  wordmark: {
    fontSize: 25,
    letterSpacing: 5,
    color: "#F2EEE5",
    fontWeight: "600",
  },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, color: gold, marginTop: 3 },
  switch: {
    flexDirection: "row",
    backgroundColor: "#181D19",
    borderRadius: 12,
    padding: 4,
  },
  switchItem: { flex: 1, padding: 11, borderRadius: 9, alignItems: "center" },
  selected: { backgroundColor: gold },
  switchText: {
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 2,
    color: "#B8BDB7",
  },
  content: {
    padding: 22,
    gap: 18,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 32,
  },
  kicker: { color: gold, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  hero: {
    fontSize: 39,
    lineHeight: 46,
    color: "#F5F2EA",
    fontWeight: "600",
    marginTop: 12,
    letterSpacing: -1.2,
  },
  title: { fontSize: 31, color: "#F5F2EA", fontWeight: "600" },
  subtitle: { fontSize: 16, lineHeight: 25, color: "#AFB6AF", marginBottom: 8 },
  card: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#151B17",
    borderWidth: 1,
    borderColor: "#2B342C",
    gap: 13,
  },
  cardTitle: { fontSize: 18, color: "#F0ECE2", fontWeight: "600" },
  muted: { fontSize: 14, lineHeight: 22, color: "#B2BBB1" },
  gold: { color: gold, fontSize: 18, fontWeight: "600" },
  caption: { color: "#A1ADA0", fontSize: 12, lineHeight: 19 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 11,
    backgroundColor: gold,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#5A503B",
  },
  buttonText: { fontWeight: "700", color: "#191910", fontSize: 14 },
  label: { color: "#BEC5BA", fontSize: 12 },
  input: {
    backgroundColor: "#0D120F",
    borderWidth: 1,
    borderColor: "#465244",
    borderRadius: 10,
    padding: 15,
    color: "#F0EEE6",
    fontSize: 16,
  },
  wrap: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metric: {
    flex: 1,
    minWidth: 130,
    borderRadius: 17,
    backgroundColor: "#19251B",
    padding: 18,
    gap: 8,
  },
  number: { fontSize: 35, fontWeight: "600", color: gold },
  context: { gap: 7 },
  nav: {
    flexDirection: "row",
    paddingTop: 13,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: "#2B342C",
    backgroundColor: "#111712",
  },
  navItem: { flex: 1, alignItems: "center", gap: 8, minHeight: 44 },
  navText: { fontSize: 11, color: "#AEB7AC" },
  dot: { width: 4, height: 4, borderRadius: 2 },
  text: { fontSize: 15, color: "#F4ECE5", lineHeight: 23 },
  error: { backgroundColor: "#442C24", padding: 16, borderRadius: 12, gap: 12 },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#7F8C7E",
    marginTop: 14,
  },
});
