import React, { useState, useEffect, useEffectEvent } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, SvgXml, SvgUri } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { Me, PrimeApi, Row, Mode } from "./api";
import icons from "./site-icons.json";
import definitions from "./site-schema.json";
import brand from "./brand.json";
import NativeMap from "./NativeMap";
type Field = {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  entity?: string;
  max?: number;
};
type Schema = {
  label: string;
  singular: string;
  fields: Record<string, Field>;
};
const schema = definitions as unknown as Record<string, Schema>;
const ranks = ["standard", "pro", "vip", "elite", "secret"];
const names: Record<string, string> = {
  standard: "Standard",
  pro: "Pro",
  vip: "VIP",
  elite: "Elite",
  secret: "Secret Plan",
};
const palettes: Record<
  string,
  {
    bg: string;
    panel: string;
    line: string;
    text: string;
    muted: string;
    accent: string;
  }
> = {
  light: {
    bg: "#f6f6f3",
    panel: "#ffffff",
    line: "#e2e3de",
    text: "#202323",
    muted: "#686e6c",
    accent: "#292d2b",
  },
  pro: {
    bg: "#101112",
    panel: "#171819",
    line: "#303233",
    text: "#f1f1ee",
    muted: "#a3a5a5",
    accent: "#e2e2dc",
  },
  vip: {
    bg: "#081426",
    panel: "#10213b",
    line: "#273c5a",
    text: "#f0f5ff",
    muted: "#a8b8ce",
    accent: "#86baff",
  },
  elite: {
    bg: "#08090b",
    panel: "#131518",
    line: "#30343b",
    text: "#f5f6f7",
    muted: "#a9b0b8",
    accent: "#d4dce3",
  },
  secret: {
    bg: "#080909",
    panel: "#11120f",
    line: "#2c2b25",
    text: "#f3f1eb",
    muted: "#aaa99e",
    accent: "#c8ad7c",
  },
  valentine: {
    bg: "#110b15",
    panel: "#1e1327",
    line: "#43294d",
    text: "#faf1ff",
    muted: "#bba4c4",
    accent: "#d596e8",
  },
  halloween: {
    bg: "#100c09",
    panel: "#20160f",
    line: "#4a3021",
    text: "#fff5eb",
    muted: "#c2ab97",
    accent: "#f5a04f",
  },
  christmas: {
    bg: "#12090b",
    panel: "#241014",
    line: "#4b252b",
    text: "#fff1f3",
    muted: "#c9a4ab",
    accent: "#e88e9c",
  },
};
const themeNames: Record<string, string> = {
  light: "Bianco",
  pro: "Pro",
  vip: "Blu VIP",
  elite: "Elite",
  secret: "Secret",
  valentine: "San Valentino",
  halloween: "Halloween",
  christmas: "Natale",
};
const sections = [
  ["dashboard", "Panoramica"],
  ["territory", "Vie e territorio"],
  ["map", "Mappa immobiliare"],
  ["agents", "Agenti"],
  ["contacts", "CRM · Persone"],
  ["properties", "Immobili in gestione"],
  ["activities", "WPS"],
  ["appointments", "Agenda appuntamenti"],
  ["buyer_profiles", "Esigenze acquirenti"],
  ["viewing_feedback", "Feedback visite"],
  ["deals", "Trattative"],
  ["offers", "Proposte e offerte"],
  ["valuations", "Valutazioni"],
  ["leases", "Locazioni"],
  ["commissions", "Provvigioni"],
  ["documents", "Documenti"],
  ["signature_requests", "Firme elettroniche"],
  ["connect", "PRIME Connect"],
  ["wallester", "Wallester · Finanze"],
  ["mail", "Email"],
  ["assistant", "Vanessa"],
  ["upgrade", "Piano e upgrade"],
  ["security", "Sicurezza account"],
];
const providers = [
  ["google", "Google Calendar", "/brands/providers/googlecalendar.svg"],
  ["apple", "iCloud", ""],
  ["calendly", "Calendly", "/brands/providers/calendly.svg"],
  ["whatsapp", "WhatsApp Business", ""],
  ["drive", "Google Drive", "/brands/providers/googledrive-nav-color.svg"],
  ["onedrive", "OneDrive", "/brands/providers/microsoftonedrive.svg"],
  ["dropbox", "Dropbox", "/brands/providers/dropbox.svg"],
  ["gmail", "Gmail", ""],
  ["outlook", "Outlook", ""],
  ["zoho", "Zoho Mail", ""],
  ["wallester", "Wallester", "/assets/wallester-nav-symbol.svg"],
  ["stripe", "Stripe", "/assets/stripe-connect-color.svg"],
  ["voip", "Telefonia VoIP", "/assets/voipstudio-connect-color.svg"],
  ["contactout", "ContactOut", "/brands/providers/contactout.png"],
  ["datagma", "Datagma", ""],
];
const euro = (v: unknown) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);
const Icon = ({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color: string;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d={(icons as Record<string, string>)[name] || icons.connect} />
  </Svg>
);

export default function Workspace({
  me,
  api,
  mode,
  onMe,
  onMode,
  onLegacy,
  onLogout,
}: {
  me: Me;
  api: PrimeApi;
  mode: Mode;
  onMe: (m: Me) => void;
  onMode: (m: Mode) => Promise<void>;
  onLegacy: (tab: "Piani" | "Account") => void;
  onLogout: () => Promise<void>;
}) {
  const params = useLocalSearchParams<{ page?: string }>();
  const page = params.page || "dashboard";
  const plan =
    me.demo_plan || { base: "standard", full: "pro" }[me.edition] || me.edition;
  const rank = Math.max(0, ranks.indexOf(plan));
  const theme = me.theme === "light" ? "light" : me.theme_variant || plan;
  const c = palettes[theme] || palettes.pro;
  const styles = makeStyles(c);
  const [menu, setMenu] = useState(false),
    [picker, setPicker] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const [data, setData] = useState<Record<string, Row[]>>({}),
    [dashboard, setDashboard] = useState<Record<string, unknown>>({}),
    [connection, setConnection] = useState<Record<string, unknown>>({});
  const [finance, setFinance] = useState<Row[]>([]),
    [movements, setMovements] = useState<Row[]>([]),
    [editing, setEditing] = useState<{
      entity: string;
      row?: Row;
      values: Record<string, unknown>;
    } | null>(null);
  const [choices, setChoices] = useState<{
    label: string;
    items: { label: string; value: unknown }[];
    choose: (value: unknown) => void;
  } | null>(null);
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]),
    [draft, setDraft] = useState("");
  const [probe, setProbe] = useState<{ title: string; text: string } | null>(
    null,
  );
  const nav = (id: string) => {
    router.setParams({ page: id });
    setMenu(false);
    setQuery("");
    setError("");
  };
  const button = (
    title: string,
    fn: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={fn}
      style={[
        styles.button,
        primary && { backgroundColor: c.accent },
        (busy || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text
        style={{
          color: primary ? (theme === "light" ? "#fff" : "#101112") : c.text,
          fontWeight: "600",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
  const text = (value: unknown) => String(value ?? "");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    if (page === "dashboard") {
      const result = await api.get<Record<string, unknown>>("/api/dashboard");
      setDashboard(result);
      const entities = [
        "properties",
        "units",
        "activities",
        "contacts",
        "deals",
        "offers",
        "leases",
        "commissions",
      ];
      const all = await Promise.allSettled(
        entities.map((x) => api.get<Row[]>("/api/entities/" + x)),
      );
      setData((old) => ({
        ...old,
        ...Object.fromEntries(
          all.flatMap((r, i) =>
            r.status === "fulfilled" ? [[entities[i], r.value]] : [],
          ),
        ),
      }));
    } else if (schema[page] || ["territory", "map"].includes(page)) {
      const entities =
        page === "territory"
          ? ["streets", "buildings", "units"]
          : page === "map"
            ? ["properties", "streets", "buildings", "units"]
            : [page];
      const all = await Promise.all(
        entities.map((x) => api.get<Row[]>("/api/entities/" + x)),
      );
      setData((old) => ({
        ...old,
        ...Object.fromEntries(entities.map((x, i) => [x, all[i]])),
      }));
    } else if (page === "connect") setConnection(await api.get("/api/connect"));
    else if (page === "wallester") {
      const state = await api.get<{ accounts: Row[] }>(
        "/api/connect/wallester",
      );
      const rows = await api.get<{ transactions: Row[] }>(
        "/api/connect/wallester/movements?limit=50",
      );
      setFinance(state.accounts || []);
      setMovements(rows.transactions || []);
    } else if (page === "agents") setData((old) => ({ ...old, agents: [] }));
    if (page === "agents") {
      const rows = await api.get<Row[]>("/api/agents");
      setData((old) => ({ ...old, agents: rows }));
    }
    if (page === "mail") {
      const result = await api.get<{ mail?: Row[] }>("/api/connect");
      setData((old) => ({ ...old, mail: result.mail || [] }));
    }
  }
  const refreshPage = useEffectEvent(async () => {
    setData({});
    setConnection({});
    setDashboard({});
    setFinance([]);
    setMovements([]);
    setChat([]);
    await run(load);
  });
  useEffect(() => {
    const task = setTimeout(() => {
      void refreshPage();
    }, 0);
    return () => clearTimeout(task);
  }, [page, me.demo_plan]);
  async function openEditor(entity: string, row?: Row) {
    if (row) row = await api.get<Row>("/api/entities/" + entity + "/" + row.id);
    const fields = schema[entity].fields;
    const refs = [
      ...new Set(
        Object.values(fields)
          .filter((x) => x.type === "ref" && x.entity)
          .map((x) => x.entity!),
      ),
    ];
    await Promise.all(
      refs.map(async (id) => {
        const values = await api.get<Row[]>(id==='members'?'/api/members':"/api/entities/" + id);
        setData((old) => ({ ...old, [id]: values }));
      }),
    );
    setEditing({
      entity,
      row,
      values: row
        ? { ...row }
        : Object.fromEntries(
            Object.entries(fields).map(([key, f]) => [
              key,
              f.type === "checkbox" ? false : f.options?.[0] || "",
            ]),
          ),
    });
  }
  async function save() {
    if (!editing) return;
    const { entity, row, values } = editing;
    const body: Record<string, unknown> = {};
    for (const [key, f] of Object.entries(schema[entity].fields)) {
      let value = values[key];
      if (f.type === "number")
        value = value === "" || value == null ? null : Number(value);
      if (f.type === "checkbox") value = Boolean(value);
      if (f.type === "ref" && value === "") value = null;
      body[key] = value;
    }
    await api.change(
      "/api/entities/" + entity + (row ? "/" + row.id : ""),
      row ? "PUT" : "POST",
      { data: body, ...(row ? { version: row.version } : {}) },
    );
    setEditing(null);
    await load();
  }
  function rowCard(entity: string, row: Row) {
    return (
      <Pressable
        key={row.id}
        style={styles.panel}
        onPress={() => void run(() => openEditor(entity, row))}
      >
        <View style={styles.row}>
          <Icon color={c.accent} name={entity} />
          <Text style={[styles.h3, { flex: 1 }]}>
            {row.title || text(row.email || row.name)}
          </Text>
          <Icon color={c.accent} name="arrow" size={18} />
        </View>
        <Text style={styles.muted}>
          {[
            row.marketing_status,
            row.status,
            row.starts_at,
            row.phone,
            row.email,
          ]
            .filter(Boolean)
            .map(text)
            .join(" · ")}
        </Text>
        {row.price != null && <Text style={styles.h3}>{euro(row.price)}</Text>}
      </Pressable>
    );
  }
  function entityList(entity: string) {
    const rows = (data[entity] || []).filter(
      (r) =>
        !query ||
        Object.values(r).some(
          (v) =>
            typeof v === "string" &&
            v.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")),
        ),
    );
    return (
      <View style={{ gap: 12 }} key={entity}>
        <View style={styles.row}>
          <Text style={[styles.h3, { flex: 1 }]}>
            {schema[entity]?.label || entity} · {rows.length}
          </Text>
          {schema[entity] &&
            button("+ Nuovo", () => void run(() => openEditor(entity)), true)}
        </View>
        {rows.map((r) => rowCard(entity, r))}
        {!rows.length && !busy && (
          <Text style={styles.muted}>Nessun elemento.</Text>
        )}
      </View>
    );
  }
  const demo = mode === "demo";
  const connectionRows = [
    ...((connection.providers as {
      provider: string;
      configured?: boolean;
    }[]) || []),
    ...((connection.storageProviders as {
      provider: string;
      configured?: boolean;
    }[]) || []),
    ...((connection.mailProviders as {
      provider: string;
      configured?: boolean;
    }[]) || []),
  ];
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <View style={styles.top}>
        <Pressable accessibilityLabel="Apri menu" onPress={() => setMenu(true)}>
          <Icon color={c.accent} name="menu" />
        </Pressable>
        <SvgXml
          xml={theme === "light" ? brand.light : brand.dark}
          width={106}
          height={30}
        />
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityLabel="Scegli tema"
          onPress={() => setPicker("theme")}
        >
          <Icon color={c.accent} name="sun" />
        </Pressable>
        <Pressable onPress={() => setPicker("mode")} style={styles.badge}>
          <Text style={styles.small}>{mode.toUpperCase()}</Text>
        </Pressable>
      </View>
      <View style={[styles.row, { paddingHorizontal: 16, paddingBottom: 10 }]}>
        <Icon color={c.accent} name="search" size={18} />
        <TextInput
          placeholder="Cerca in PRIME…"
          placeholderTextColor={c.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
        />
      </View>
      {demo && (
        <View style={styles.demo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.small}>{names[plan]} · Demo pubblica</Text>
            <Text style={styles.tiny}>
              Dati fittizi · modifiche private nella sessione
            </Text>
          </View>
          <Pressable onPress={() => setPicker("plan")} style={styles.badge}>
            <Text style={styles.small}>Cambia piano ▾</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={c.accent}
            refreshing={busy}
            onRefresh={() => void run(load)}
          />
        }
      >
        {!!error && (
          <View accessibilityRole="alert" style={styles.panel}>
            <Text style={{ color: "#e36c6c" }}>{error}</Text>
            {demo &&
              button(
                "Riavvia demo",
                () =>
                  void run(async () => {
                    onMe(await api.startDemo());
                    nav("dashboard");
                  }),
              )}
          </View>
        )}
        {busy && <ActivityIndicator color={c.accent} />}
        <Text style={styles.eyebrow}>
          {page === "dashboard"
            ? "IL TUO WORKSPACE"
            : page === "connect"
              ? "UNO SPAZIO, TUTTE LE CONNESSIONI."
              : me.tenant.toUpperCase()}
        </Text>
        <Text style={styles.h1}>
          {page === "dashboard"
            ? "Ogni connessione conta."
            : sections.find((x) => x[0] === page)?.[1] ||
              schema[page]?.label ||
              page}
        </Text>
        {page === "dashboard" && (
          <>
            <Text style={styles.muted}>La tua agenzia, vista da vicino.</Text>
            {button(
              "+ Nuova attività",
              () => void run(() => openEditor("activities")),
              true,
            )}
            <View style={styles.grid}>
              {[
                ["properties", "Immobili in gestione"],
                ["units", "Appartamenti censiti"],
                ["activities", "Attività WPS aperte"],
                ["contacts", "Contatti in rubrica"],
                ["deals", "Trattative aperte"],
                ["offers", "Proposte in attesa"],
                ["leases", "Locazioni attive"],
                ["commissions", "Provvigioni incassate"],
              ].map(([id, label]) => (
                <Pressable key={id} style={styles.stat} onPress={() => nav(id)}>
                  <View style={styles.iconTile}>
                    <Icon color={c.accent} name={id} size={27} />
                  </View>
                  <Text style={styles.muted}>{label}</Text>
                  <Text style={styles.number}>
                    {id === "commissions"
                      ? euro(
                          (data[id] || [])
                            .filter((r) => r.status === "incassata")
                            .reduce((n, r) => n + Number(r.amount || 0), 0),
                        )
                      : (data[id] || []).length}
                  </Text>
                  <View style={styles.row}>
                    <Text style={[styles.tiny, { flex: 1 }]}>Apri sezione</Text>
                    <Icon color={c.accent} name="arrow" size={16} />
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={styles.panel}>
              <Text style={styles.eyebrow}>OPERATIVITÀ</Text>
              <Text style={styles.h2}>Le prossime azioni</Text>
              {(data.activities || []).map((r) => rowCard("activities", r))}
              {button("Apri WPS →", () => nav("activities"))}
            </View>
            <View style={styles.panel}>
              <Text style={styles.eyebrow}>UN PASSO ALLA VOLTA</Text>
              <Text style={styles.h2}>Costruisci il tuo territorio.</Text>
              <Text style={styles.muted}>
                Parti dalle vie. Collega i civici, censisci gli interni e
                trasforma le informazioni in nuove relazioni.
              </Text>
              {["streets", "buildings", "units"].map((id, i) => (
                <Pressable style={styles.row} key={id} onPress={() => nav(id)}>
                  <Text style={{ color: c.accent }}>0{i + 1}</Text>
                  <Text style={styles.text}>{schema[id].label}</Text>
                  <Icon color={c.accent} name="arrow" size={16} />
                </Pressable>
              ))}
            </View>
            {[
              ["appointments", "Appuntamenti di oggi"],
              ["deadlines", "Incarichi e locazioni · entro 30 giorni"],
              ["recent", "Ultimi immobili inseriti o modificati"],
              ["quality", "Qualità schede e annunci"],
            ].map(([id, title]) => (
              <View key={id} style={styles.panel}>
                <Text style={styles.h2}>{title}</Text>
                {((dashboard[id] as Row[]) || []).map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() =>
                      void run(() =>
                        openEditor(
                          id === "appointments" ? "appointments" : "properties",
                          r,
                        ),
                      )
                    }
                  >
                    <Text style={styles.text}>{r.title}</Text>
                    <Text style={styles.muted}>
                      {Array.isArray(r.issues)
                        ? r.issues.join(" · ")
                        : text(r.starts_at || r.date || "")}
                    </Text>
                  </Pressable>
                ))}
                {!(dashboard[id] as Row[])?.length && (
                  <Text style={styles.muted}>Nessun elemento.</Text>
                )}
              </View>
            ))}
          </>
        )}
        {schema[page] && entityList(page)}
        {page === "territory" &&
          ["streets", "buildings", "units"].map(entityList)}
        {page === "map" && (
          <>
            <NativeMap
              rows={data.properties || []}
              onSelect={(r) => void run(() => openEditor("properties", r))}
            />
            <Text style={styles.muted}>
              Immobili e indirizzi del territorio. Apri un punto nella mappa del
              telefono.
            </Text>
            {(data.properties || []).map((r) => (
              <View style={styles.panel} key={r.id}>
                <Text style={styles.h3}>{r.title}</Text>
                <Text style={styles.muted}>
                  {text(r.latitude)} · {text(r.longitude)}
                </Text>
                {r.latitude != null &&
                  r.longitude != null &&
                  button(
                    "Apri posizione",
                    () =>
                      void Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`,
                      ),
                  )}
              </View>
            ))}
          </>
        )}
        {page === "agents" &&
          (data.agents || []).map((r) => (
            <View key={r.id} style={styles.panel}>
              <Icon color={c.accent} name="agents" />
              <Text style={styles.h3}>{text(r.email || r.title)}</Text>
              <Text style={styles.muted}>{text(r.role)}</Text>
            </View>
          ))}
        {page === "connect" && (
          <>
            <Text style={styles.muted}>
              Collega i tuoi strumenti e prova i dati dimostrativi. Ogni
              servizio conserva le regole e i permessi del tuo piano.
            </Text>
            {providers.map(([id, name, logo]) => {
              const p = connectionRows.find((p) => p.provider === id);
              return (
                <View key={id} style={styles.panel}>
                  <View style={styles.row}>
                    {logo.endsWith(".svg") ? (
                      <SvgUri
                        uri={"https://www.primegestionale.it" + logo}
                        width={35}
                        height={26}
                      />
                    ) : logo ? (
                      <Image
                        source={{
                          uri: "https://www.primegestionale.it" + logo,
                        }}
                        style={{ width: 30, height: 30 }}
                      />
                    ) : (
                      <Icon color={c.accent} name={id} />
                    )}
                    <Text style={styles.h2}>{name}</Text>
                  </View>
                  <Text style={styles.muted}>
                    {id === "wallester" && demo
                      ? "Conti, movimenti e saldi fittizi. Nessun conto reale viene collegato."
                      : p?.configured
                        ? "Servizio configurato sulla piattaforma. Autorizza il tuo account per collegarlo."
                        : "Configurazione o disponibilità soggetta al piano e al server PRIME."}
                  </Text>
                  <View style={styles.row}>
                    {button(
                      id === "wallester" && demo
                        ? "Attiva dati fittizi"
                        : "Verifica stato",
                      () =>
                        void run(async () => {
                          if (id === "wallester") {
                            nav("wallester");
                            return;
                          }
                          const status =
                            await api.get<Record<string, unknown>>(
                              "/api/connect",
                            );
                          const connections = (
                            (status.connections as {
                              provider: string;
                              status: string;
                            }[]) || []
                          ).filter((x) => x.provider === id);
                          setProbe({
                            title: name,
                            text: connections.length
                              ? connections.map((x) => x.status).join("\n")
                              : p?.configured
                                ? "Configurazione disponibile. Nessun account personale collegato. La configurazione non costituisce un test riuscito del servizio."
                                : "Non collegato: configura il servizio prima di eseguire un test reale.",
                          });
                        }),
                    )}
                    {p?.configured &&
                      [
                        "calendly",
                        "drive",
                        "dropbox",
                        "onedrive",
                        "google",
                      ].includes(id) &&
                      button(
                        "Collega account",
                        () =>
                          void run(async () => {
                            const result = await api.post<{ url?: string }>(
                              "/api/connect/authorize/" + id,
                            );
                            if (
                              !result.url ||
                              !result.url.startsWith("https://")
                            )
                              throw Error("Autorizzazione non disponibile.");
                            await Linking.openURL(result.url);
                          }),
                      )}
                  </View>
                </View>
              );
            })}
          </>
        )}
        {page === "wallester" && (
          <>
            <Text style={styles.muted}>
              {demo
                ? "DEMO · Dati interamente fittizi del gestionale."
                : "Conti e movimenti dell’agenzia."}
            </Text>
            {finance.map((r) => (
              <View key={text(r.id)} style={styles.panel}>
                <Text style={styles.h3}>{text(r.name)}</Text>
                <Text style={styles.number}>{euro(r.balance)}</Text>
                <Text style={styles.muted}>
                  Disponibile {euro(r.available_amount)} ·{" "}
                  {text(r.currency_code)}
                </Text>
              </View>
            ))}
            <Text style={styles.h2}>Movimenti</Text>
            {movements.map((r, i) => (
              <View style={styles.panel} key={text(r.record_id || i)}>
                <Text style={styles.h3}>{text(r.description)}</Text>
                <Text
                  style={{
                    color: Number(r.account_amount) > 0 ? "#49a774" : c.text,
                  }}
                >
                  {euro(r.account_amount)}
                </Text>
                <Text style={styles.muted}>
                  {text(r.record_date)} · {text(r.record_status)}
                </Text>
              </View>
            ))}
          </>
        )}
        {page === "mail" && (
          <>
            <Text style={styles.muted}>
              Gli account email si collegano da PRIME Connect.
            </Text>
            {button("Apri PRIME Connect", () => nav("connect"))}
            {(data.mail || []).map((r) => (
              <View key={r.id} style={styles.panel}>
                <Text style={styles.h3}>{text(r.subject || r.title)}</Text>
                <Text style={styles.muted}>{text(r.from)}</Text>
              </View>
            ))}
          </>
        )}
        {page === "assistant" && (
          <>
            <Text style={styles.muted}>
              {rank >= 2
                ? "Vanessa · Chat collegata al workspace e ai dati consentiti."
                : "Vanessa è inclusa da VIP in poi. Cambia piano nella demo per provarla."}
            </Text>
            {chat.map((m, i) => (
              <View style={styles.panel} key={i}>
                <Text style={styles.eyebrow}>
                  {m.role === "user" ? "TU" : "VANESSA"}
                </Text>
                <Text selectable style={styles.text}>
                  {m.text}
                </Text>
              </View>
            ))}
            <TextInput
              multiline
              placeholder="Scrivi a Vanessa…"
              placeholderTextColor={c.muted}
              value={draft}
              onChangeText={setDraft}
              style={styles.input}
            />
            {button(
              "Invia",
              () =>
                void run(async () => {
                  const message = draft.trim();
                  if (!message) return;
                  setDraft("");
                  setChat((old) => [...old, { role: "user", text: message }]);
                  const result = await api.post<{
                    reply?: string;
                    message?: string;
                  }>("/api/assistant/chat", {
                    messages: [
                      ...chat.map((m) => ({ role: m.role, content: m.text })),
                      { role: "user", content: message },
                    ],
                  });
                  setChat((old) => [
                    ...old,
                    {
                      role: "assistant",
                      text:
                        result.reply ||
                        result.message ||
                        "Nessuna risposta testuale restituita.",
                    },
                  ]);
                }),
              true,
              rank < 2,
            )}
          </>
        )}
        {page === "upgrade" && (
          <>
            <Text style={styles.muted}>
              Esplora tutte le funzionalità con i cinque piani PRIME.
            </Text>
            {ranks.map((id) => (
              <View key={id} style={styles.panel}>
                <Text style={styles.h2}>PRIME {names[id]}</Text>
                <Text style={styles.muted}>
                  {id === plan ? "Piano selezionato" : ""}
                </Text>
                {button(
                  demo ? "Esplora " + names[id] : "Gestisci abbonamento",
                  () =>
                    demo
                      ? void run(async () => {
                          onMe(await api.plan(id));
                          nav("dashboard");
                        })
                      : onLegacy("Piani"),
                  id === plan,
                )}
              </View>
            ))}
          </>
        )}
        {page === "security" && (
          <>
            <Text style={styles.muted}>
              {me.email} · {me.role}
            </Text>
            {button("Sicurezza e verifica agenzia", () => onLegacy("Account"))}
          </>
        )}
        <Text
          style={[styles.tiny, { textAlign: "center", marginVertical: 20 }]}
        >
          PRIME · Uno spazio, tutte le connessioni.
        </Text>
      </ScrollView>
      <View style={styles.bottom}>
        {[
          ["dashboard", "Panoramica"],
          ["activities", "WPS"],
          ["appointments", "Agenda"],
          ["connect", "Connect"],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            style={{ alignItems: "center", gap: 5, flex: 1 }}
            onPress={() => nav(id)}
          >
            <Icon color={c.accent} name={id} />
            <Text style={[styles.tiny, page === id && { color: c.accent }]}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityLabel="Tutte le sezioni"
          onPress={() => setMenu(true)}
        >
          <Icon color={c.accent} name="menu" />
          <Text style={styles.tiny}>Menu</Text>
        </Pressable>
      </View>
      <Modal
        visible={menu}
        animationType="slide"
        onRequestClose={() => setMenu(false)}
      >
        <SafeAreaView style={styles.root}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.row}>
              <SvgXml xml={brand.dark} width={130} height={34} />
              <View style={{ flex: 1 }} />
              {button("Chiudi", () => setMenu(false))}
            </View>
            <Text style={styles.eyebrow}>
              PRIME {names[plan]?.toUpperCase()} · WORKSPACE
            </Text>
            {sections.map(([id, label]) => (
              <Pressable
                key={id}
                style={[
                  styles.navRow,
                  page === id && { backgroundColor: c.line },
                ]}
                onPress={() => nav(id)}
              >
                <Icon color={c.accent} name={id} />
                <Text style={styles.text}>{label}</Text>
              </Pressable>
            ))}
            <Text style={styles.h3}>{me.tenant}</Text>
            <Text style={styles.muted}>{me.email}</Text>
            {button("Esci", () => void run(onLogout))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker("")}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.h2}>
                {picker === "theme"
                  ? "Scegli un tema"
                  : picker === "plan"
                    ? "Esplora il piano"
                    : "Ambiente"}
              </Text>
              {(picker === "theme"
                ? [
                    "light",
                    ...ranks.slice(1, rank + 1),
                    ...(demo && rank > 0
                      ? ["valentine", "halloween", "christmas"]
                      : []),
                  ]
                : picker === "plan"
                  ? ranks
                  : ["demo", "live"]
              ).map((id) => (
                <Pressable
                  key={id}
                  style={styles.navRow}
                  onPress={() =>
                    void run(async () => {
                      setPicker("");
                      if (picker === "theme") {
                        await api.change("/api/preferences", "PATCH", {
                          theme: id === "light" ? "light" : "dark",
                          theme_variant: id === "light" ? "" : id,
                        });
                        onMe(await api.me());
                      } else if (picker === "plan") {
                        onMe(await api.plan(id));
                        nav("dashboard");
                      } else await onMode(id as Mode);
                    })
                  }
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: palettes[id]?.accent || c.accent,
                    }}
                  />
                  <Text style={styles.text}>
                    {picker === "theme"
                      ? themeNames[id]
                      : names[id] || id.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
              {button("Chiudi", () => setPicker(""))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!editing}
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <SafeAreaView style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.row}>
              <Text style={[styles.h2, { flex: 1 }]}>
                {editing?.row ? "Modifica" : "Nuova scheda"} ·{" "}
                {editing && schema[editing.entity].singular}
              </Text>
              {button("Chiudi", () => setEditing(null))}
            </View>
            {editing &&
              Object.entries(schema[editing.entity].fields).map(([key, f]) => (
                <View key={key} style={{ gap: 8 }}>
                  <Text style={styles.small}>
                    {f.label}
                    {f.required ? " *" : ""}
                  </Text>
                  {f.type === "checkbox" ? (
                    <Switch
                      value={Boolean(editing.values[key])}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          values: { ...editing.values, [key]: v },
                        })
                      }
                    />
                  ) : f.options || f.entity ? (
                    <Pressable
                      style={styles.input}
                      onPress={() =>
                        setChoices({
                          label: f.label,
                          items: [
                            ...(!f.required
                              ? [{ label: "Nessuno", value: "" }]
                              : []),
                            ...(f.options
                              ? f.options.map((v) => ({ label: v, value: v }))
                              : (data[f.entity!] || []).map((r) => ({
                                  label: r.title || text(r.email),
                                  value: r.id,
                                }))),
                          ],
                          choose: (v) =>
                            setEditing({
                              ...editing,
                              values: { ...editing.values, [key]: v },
                            }),
                        })
                      }
                    >
                      <Text style={styles.text}>
                        {f.entity
                          ? (data[f.entity] || []).find(
                              (r) => r.id === editing.values[key],
                            )?.title || "Seleziona…"
                          : text(editing.values[key]) || "Seleziona…"}
                      </Text>
                    </Pressable>
                  ) : (
                    <TextInput
                      accessibilityLabel={f.label}
                      placeholder={
                        f.type === "date"
                          ? "AAAA-MM-GG"
                          : f.type === "datetime-local"
                            ? "AAAA-MM-GGThh:mm"
                            : ""
                      }
                      placeholderTextColor={c.muted}
                      value={text(editing.values[key])}
                      onChangeText={(v) =>
                        setEditing({
                          ...editing,
                          values: { ...editing.values, [key]: v },
                        })
                      }
                      keyboardType={
                        f.type === "number"
                          ? "decimal-pad"
                          : f.type === "email"
                            ? "email-address"
                            : "default"
                      }
                      multiline={f.type === "textarea"}
                      maxLength={f.max}
                      style={styles.input}
                    />
                  )}
                </View>
              ))}
            {error && <Text style={{ color: "#e36c6c" }}>{error}</Text>}
            {button("Salva scheda", () => void run(save), true)}
          </ScrollView>
          <Modal
            visible={!!choices}
            transparent
            onRequestClose={() => setChoices(null)}
          >
            <View style={styles.overlay}>
              <View style={styles.sheet}>
                <ScrollView>
                  <Text style={styles.h2}>{choices?.label}</Text>
                  {choices?.items.map((item, i) => (
                    <Pressable
                      key={i}
                      style={styles.navRow}
                      onPress={() => {
                        choices.choose(item.value);
                        setChoices(null);
                      }}
                    >
                      <Text style={styles.text}>{item.label}</Text>
                    </Pressable>
                  ))}
                  {button("Chiudi", () => setChoices(null))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!probe}
        transparent
        onRequestClose={() => setProbe(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.h2}>{probe?.title}</Text>
            <Text style={styles.muted}>{probe?.text}</Text>
            {button("Chiudi", () => setProbe(null))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function makeStyles(c: typeof palettes.light) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 18,
      borderBottomWidth: 1,
      borderColor: c.line,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    content: {
      padding: 16,
      gap: 18,
      maxWidth: 900,
      width: "100%",
      alignSelf: "center",
      paddingBottom: 28,
    },
    text: { color: c.text, fontSize: 15, lineHeight: 23 },
    small: { color: c.text, fontSize: 12, fontWeight: "600" },
    tiny: { color: c.muted, fontSize: 11, lineHeight: 17 },
    muted: { color: c.muted, fontSize: 14, lineHeight: 22 },
    h1: { color: c.text, fontSize: 28, fontWeight: "600", letterSpacing: -1 },
    h2: { color: c.text, fontSize: 19, fontWeight: "600" },
    h3: { color: c.text, fontSize: 16, fontWeight: "600" },
    eyebrow: {
      color: c.accent,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.5,
    },
    panel: {
      backgroundColor: c.panel,
      borderColor: c.line,
      borderWidth: 1,
      borderRadius: 12,
      padding: 18,
      gap: 12,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    stat: {
      flexGrow: 1,
      flexBasis: "45%",
      padding: 17,
      gap: 14,
      minHeight: 190,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 12,
      backgroundColor: c.panel,
    },
    number: { fontSize: 31, fontWeight: "600", color: c.accent },
    iconTile: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.line,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.bg,
    },
    button: {
      minHeight: 44,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: { borderWidth: 1, borderColor: c.line, padding: 9, borderRadius: 8 },
    input: {
      padding: 13,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 8,
      color: c.text,
      fontSize: 15,
      backgroundColor: c.bg,
      minHeight: 44,
    },
    demo: {
      padding: 12,
      borderBottomWidth: 1,
      borderColor: c.line,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.panel,
    },
    bottom: {
      padding: 12,
      borderTopWidth: 1,
      borderColor: c.line,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.panel,
    },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 15,
      padding: 14,
      borderRadius: 8,
      minHeight: 48,
    },
    overlay: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.panel,
      padding: 24,
      gap: 18,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "85%",
      paddingBottom: 40,
    },
  });
}
