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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Path, SvgXml } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { Me, PrimeApi, Row, Mode } from "./api";
import icons from "./site-icons.json";
import definitions from "./site-schema.json";
import brand from "./brand.json";
import providerLogos from "./provider-logos.json";
import NativeMap from "./NativeMap";
import Vanessa from "./Vanessa";
import { metricValue } from "./site-metrics";
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
    bg: "#505050",
    panel: "#606060",
    line: "#888888",
    text: "#f5f5f5",
    muted: "#e0e0e0",
    accent: "#f1f1ee",
  },
  vip: {
    bg: "#0b1d2e",
    panel: "#10283d",
    line: "#29445c",
    text: "#eef4f8",
    muted: "#a7b9c8",
    accent: "#b6d1e3",
  },
  elite: {
    bg: "#101112",
    panel: "#171819",
    line: "#303233",
    text: "#f1f1ee",
    muted: "#a3a5a5",
    accent: "#e2e2dc",
  },
  secret: {
    bg: "#050505",
    panel: "#0a0a0a",
    line: "#292929",
    text: "#f0f0f0",
    muted: "#9b9b9b",
    accent: "#c7a979",
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
    bg: "#080606",
    panel: "#1b0808",
    line: "#8a2020",
    text: "#fff0ed",
    muted: "#ddbab6",
    accent: "#ff5757",
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
const themeDetails: Record<string, string> = {
  light: "Tema chiaro",
  pro: "Grigio medio",
  vip: "Blu PRIME",
  elite: "Nero e argento",
  secret: "Nero e oro",
  valentine: "Nero e viola · 14 febbraio",
  halloween: "Nero e arancione · 31 ottobre",
  christmas: "Nero e rosso scuro · 21–30 dicembre",
};
const monthNames = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const weekNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const appointmentDate = (row: Row) => {
  const value = row.starts_at || row.date || row.start_at || row.datetime;
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};
const menuGroups = [
  {
    title: "WORKSPACE",
    items: [
      { id: "dashboard", label: "Panoramica" },
      { id: "territory", label: "Vie e territorio" },
      { id: "map", label: "Mappa immobiliare" },
      { id: "agents", label: "Agenti" },
      { id: "contacts", label: "CRM · Persone" },
      { id: "contact_methods", label: "Recapiti CRM" },
      { id: "contact_interactions", label: "Interazioni CRM" },
      { id: "unit_contacts", label: "Relazioni e ruoli" },
      { id: "properties", label: "Immobili in gestione" },
      { id: "activities", label: "WPS" },
      { id: "appointments", label: "Agenda appuntamenti" },
    ],
  },
  {
    title: "COMMERCIALE",
    items: [
      { id: "buyer_profiles", label: "Esigenze acquirenti" },
      { id: "viewing_feedback", label: "Feedback visite" },
      { id: "deals", label: "Trattative" },
      { id: "offers", label: "Proposte e offerte" },
      { id: "valuations", label: "Valutazioni" },
      { id: "leases", label: "Locazioni" },
      { id: "commissions", label: "Provvigioni" },
      { id: "portals", label: "Portali immobiliari" },
      { id: "documents", label: "Documenti" },
      { id: "signature_requests", label: "Firme elettroniche" },
    ],
  },
  {
    title: "CONNESSIONI",
    items: [
      { id: "connect", label: "PRIME Connect" },
      { section: "PAGAMENTI" },
      { id: "stripe", label: "Stripe" },
      { id: "wallester", label: "Wallester" },
      { section: "INDAGINI" },
      { id: "datagma", label: "Datagma" },
      { id: "contactout", label: "ContactOut" },
      { section: "ARCHIVIAZIONE" },
      { id: "storage_drive", label: "Google Drive" },
      { id: "storage_onedrive", label: "OneDrive" },
      { id: "storage_dropbox", label: "Dropbox" },
      { section: "CALENDARI" },
      { id: "calendly", label: "Calendly" },
      { section: "COMUNICAZIONI" },
      { id: "voip", label: "Telefonia VoIP" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { id: "mail", label: "Email" },
      { id: "assistant", label: "Vanessa" },
      { id: "upgrade", label: "Piano e upgrade" },
      { id: "security", label: "Sicurezza account" },
      { id: "audit", label: "Registro attività" },
      { id: "roadmap", label: "Stato sviluppo" },
    ],
  },
];
const sections = menuGroups.flatMap((group) =>
  group.items.flatMap((item) =>
    "id" in item ? [[item.id, item.label] as [string, string]] : [],
  ),
);
const providerPages = [
  "calendly",
  "voip",
  "storage_drive",
  "storage_onedrive",
  "storage_dropbox",
  "stripe",
  "contactout",
  "datagma",
];
const providers = [
  ["google", "Google Calendar", "google"],
  ["apple", "iCloud", "apple"],
  ["calendly", "Calendly", "calendly"],
  ["whatsapp", "WhatsApp Business", "whatsapp"],
  ["drive", "Google Drive", "drive"],
  ["onedrive", "OneDrive", "onedrive"],
  ["dropbox", "Dropbox", "dropbox"],
  ["gmail", "Gmail", "gmail"],
  ["outlook", "Outlook", "outlook"],
  ["zoho", "Zoho Mail", "zoho"],
  ["wallester", "Wallester", "wallester"],
  ["stripe", "Stripe", "stripe"],
  ["voip", "Telefonia VoIP", "voipstudio"],
  ["contactout", "ContactOut", "contactout"],
  ["datagma", "Datagma", "datagma"],
];
const providerCategories: [string, string[]][] = [
  ["PAGAMENTI", ["stripe", "wallester"]],
  ["INDAGINI", ["datagma", "contactout"]],
  ["ARCHIVIAZIONE", ["drive", "onedrive", "dropbox"]],
  ["CALENDARI", ["google", "apple", "calendly"]],
  ["COMUNICAZIONI", ["whatsapp", "gmail", "outlook", "zoho", "voip"]],
];
const providerLogoSizes: Record<string, [number, number]> = {
  google: [30, 30],
  apple: [28, 28],
  calendly: [30, 30],
  whatsapp: [30, 30],
  drive: [30, 30],
  onedrive: [30, 30],
  dropbox: [30, 30],
  gmail: [30, 30],
  outlook: [32, 30],
  zoho: [38, 30],
  wallester: [42, 30],
  stripe: [74, 30],
  voip: [124, 28],
  contactout: [38, 38],
  datagma: [124, 28],
};
const providerPageService: Record<string, string> = {
  stripe: "stripe",
  wallester: "wallester",
  datagma: "datagma",
  contactout: "contactout",
  calendly: "calendly",
  voip: "voip",
  storage_drive: "drive",
  storage_onedrive: "onedrive",
  storage_dropbox: "dropbox",
};
const providerServicePage = Object.fromEntries(
  Object.entries(providerPageService).map(([page, service]) => [service, page]),
) as Record<string, string>;
const demoProviderSamples: Record<
  string,
  { title: string; rows: string[] }
> = {
  datagma: {
    title: "Esempio di ricerca contatti",
    rows: [
      "Luca Ferri · amministratore · luca.ferri@example.test",
      "Sara Moretti · consulente · sara.moretti@example.test",
    ],
  },
  contactout: {
    title: "Esempio di arricchimento contatto",
    rows: [
      "Giulia Riva · responsabile commerciale · giulia.riva@example.test",
      "Recapito e profilo professionale di esempio",
    ],
  },
  calendly: {
    title: "Prossimi appuntamenti di esempio",
    rows: [
      "10 nov · 10:30 · Visita immobile · Cliente demo",
      "11 nov · 15:00 · Valutazione · Proprietario demo",
    ],
  },
  voip: {
    title: "Registro chiamate di esempio",
    rows: [
      "Oggi · 09:42 · Chiamata in entrata · 04:18",
      "Ieri · 16:20 · Chiamata in uscita · 02:56",
    ],
  },
  drive: {
    title: "File di esempio",
    rows: ["Incarico vendita.pdf · Demo", "Scheda immobile.docx · Demo"],
  },
  onedrive: {
    title: "File di esempio",
    rows: ["Proposta di acquisto.pdf · Demo", "Visura catastale.pdf · Demo"],
  },
  dropbox: {
    title: "File di esempio",
    rows: ["Planimetria immobile.pdf · Demo", "Documenti cliente.zip · Demo"],
  },
};
const stripeDemoPayments = [
  {
    date: "09 nov 2026",
    customer: "Agenzia Aurora · Demo",
    reason: "Canone gestionale",
    amount: 149,
    status: "Riuscito",
  },
  {
    date: "08 nov 2026",
    customer: "Cliente Casa Verde · Demo",
    reason: "Consulenza immobiliare",
    amount: 390,
    status: "Riuscito",
  },
  {
    date: "07 nov 2026",
    customer: "Studio Centro · Demo",
    reason: "Servizio di valutazione",
    amount: 220,
    status: "In attesa",
  },
];
const referenceLabel = (rows: Row[], id: unknown) => {
  const row = rows.find((r) => r.id === id);
  return String(row?.title || row?.email || "Seleziona…");
};
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
  const [demoServices, setDemoServices] = useState<string[]>([]);
  const [pendingDemoPage, setPendingDemoPage] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarSelected, setCalendarSelected] = useState(dayKey(new Date()));
  const [liveServiceReady, setLiveServiceReady] = useState<
    Record<string, boolean>
  >({});
  const [connectionLoadedMode, setConnectionLoadedMode] =
    useState<Mode | null>(null);
  const connectionLoading = connectionLoadedMode !== mode;
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
    } else if (page === "connect" || providerPages.includes(page))
      setConnection(await api.get("/api/connect"));
    else if (
      page === "wallester" &&
      (mode === "live" || demoServices.includes("wallester"))
    ) {
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
    if (page === "portals") setConnection(await api.get("/api/portals"));
    if (page === "audit") {
      const rows = await api.get<Row[]>("/api/audit");
      setData((old) => ({ ...old, audit: rows }));
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
        const values = await api.get<Row[]>(
          id === "members" ? "/api/members" : "/api/entities/" + id,
        );
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
        value =
          value === "" || value == null
            ? null
            : Number(String(value).replace(",", "."));
      if (f.type === "number" && value !== null && !Number.isFinite(value))
        throw Error(f.label + ": inserisci un numero valido.");
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
  const [found, setFound] = useState<
    (Row & { entity: string; context: string })[]
  >([]);
  useEffect(() => {
    let active = true;
    const task = setTimeout(() => {
      if (query.length < 2) {
        setFound([]);
        return;
      }
      void api
        .get<(Row & { entity: string; context: string })[]>(
          "/api/search?q=" + encodeURIComponent(query),
        )
        .then((rows) => {
          if (active) setFound(rows);
        })
        .catch(() => {
          if (active) setFound([]);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(task);
    };
  }, [query, api]);
  const demo = mode === "demo";
  const connectionRows = [
    ...((connection.providers as {
      provider: string;
      configured?: boolean;
      connected?: boolean;
      status?: string;
    }[]) || []),
    ...((connection.storageProviders as {
      provider: string;
      configured?: boolean;
      connected?: boolean;
      status?: string;
    }[]) || []),
    ...((connection.mailProviders as {
      provider: string;
      configured?: boolean;
      connected?: boolean;
      status?: string;
    }[]) || []),
  ];
  const canUseDemoProvider = (id: string) => {
    if (id === "stripe") return rank >= 3;
    if (id === "wallester") return rank >= 1;
    if (["drive", "onedrive", "dropbox"].includes(id)) return rank >= 4;
    if (id === "voip") return rank >= 2;
    return rank >= 1;
  };
  const pageIsAvailable = (id: string) => {
    const service = providerPageService[id];
    if (!service) {
      if (["agents", "upgrade"].includes(id) && me.role !== "owner")
        return false;
      if (id === "audit" && !["owner", "manager"].includes(me.role))
        return false;
      if (id === "security" && demo) return false;
      return true;
    }
    if (demo)
      return canUseDemoProvider(service) && demoServices.includes(service);
    return connectionLoadedMode === mode && liveServiceReady[service] === true;
  };
  const liveStripeEnabled =
    (me as Me & { stripe_enabled?: boolean }).stripe_enabled === true &&
    ["owner", "manager"].includes(me.role);
  const pageAvailability = useEffectEvent((id: string) => pageIsAvailable(id));
  const toggleDemoService = (id: string, enabled: boolean) => {
    setDemoServices((current) =>
      enabled
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((service) => service !== id),
    );
    const target = providerServicePage[id];
    if (enabled && target) setPendingDemoPage(target);
    else if (!enabled && providerPageService[page] === id) nav("connect");
  };
  useEffect(() => {
    if (
      pendingDemoPage &&
      demoServices.includes(providerPageService[pendingDemoPage])
    ) {
      const target = pendingDemoPage;
      const timer = setTimeout(() => {
        nav(target);
        setPendingDemoPage("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [demoServices, pendingDemoPage]);
  useEffect(() => {
    let active = true;
    const loadConnectionStatus = async () => {
      const base = await api
        .get<Record<string, unknown>>("/api/connect")
        .catch(() => ({} as Record<string, unknown>));
      if (!active) return;
      setConnection(base);
      const rows = [
        ...((base.providers as {
          provider?: string;
          configured?: boolean;
          connected?: boolean;
          status?: string;
        }[]) || []),
        ...((base.storageProviders as {
          provider?: string;
          configured?: boolean;
          connected?: boolean;
          status?: string;
        }[]) || []),
        ...((base.storageConnections as {
          provider?: string;
          configured?: boolean;
          connected?: boolean;
          status?: string;
        }[]) || []),
      ];
      const connections = (base.connections as {
        provider?: string;
        status?: string;
      }[]) || [];
      const isReady = (id: string) =>
        rows.some(
          (item) =>
            item.provider === id &&
            (item.configured === true ||
              item.connected === true ||
              item.status === "connected"),
        );
      const next: Record<string, boolean> = {
        datagma:
          isReady("datagma") ||
          (base.datagma as { configured?: boolean } | undefined)?.configured ===
            true,
        contactout: isReady("contactout"),
        calendly: isReady("calendly") ||
          connections.some(
            (item) =>
              item.provider === "calendly" && item.status === "connected",
          ),
        drive: isReady("drive"),
        onedrive: isReady("onedrive"),
        dropbox: isReady("dropbox"),
        stripe: isReady("stripe"),
        wallester: isReady("wallester"),
        voip: isReady("voip"),
      };
      if (mode === "live") {
        const checks: [string, string][] = [
          ["contactout", "/api/contactout/settings"],
          ["voip", "/api/connect/telephony"],
          ["wallester", "/api/connect/wallester"],
          ...(liveStripeEnabled
            ? [
                ["stripe_test", "/api/stripe/status?mode=test"] as [
                  string,
                  string,
                ],
                ["stripe_live", "/api/stripe/status?mode=live"] as [
                  string,
                  string,
                ],
              ]
            : []),
        ];
        const results = await Promise.allSettled(
          checks.map(([, path]) =>
            api.get<Record<string, unknown>>(path),
          ),
        );
        results.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const [id] = checks[index];
          const value = result.value;
          if (id === "contactout")
            next.contactout =
              value.configured === true && value.mode === "live";
          if (id === "wallester")
            next.wallester =
              value.configured === true || value.connected === true;
          if (id === "voip")
            next.voip =
              (value.providers as { configured?: boolean }[] | undefined)?.some(
                (provider) => provider.configured === true,
              ) === true;
          if (id === "stripe_test" || id === "stripe_live")
            next.stripe = next.stripe || value.configured === true;
        });
      }
      if (!active) return;
      setLiveServiceReady(next);
      setConnectionLoadedMode(mode);
    };
    void loadConnectionStatus();
    return () => {
      active = false;
    };
  }, [api, mode, me.tenant_id, me.role, liveStripeEnabled]);
  useEffect(() => {
    if (
      !connectionLoading &&
      providerPageService[page] &&
      !pageAvailability(page)
    )
      router.setParams({ page: "connect" });
  }, [
    page,
    connectionLoading,
    demoServices,
    liveServiceReady,
    rank,
    mode,
    demo,
    me.role,
  ]);
  const visibleMenuGroups = menuGroups.flatMap((group) => {
    const items = group.items.filter((item, index) => {
      if ("id" in item && typeof item.id === "string")
        return pageIsAvailable(item.id);
      for (let next = index + 1; next < group.items.length; next += 1) {
        const candidate = group.items[next];
        if ("section" in candidate) return false;
        if (
          "id" in candidate &&
          typeof candidate.id === "string" &&
          pageIsAvailable(candidate.id)
        )
          return true;
      }
      return false;
    });
    return items.some((item) => "id" in item) ? [{ ...group, items }] : [];
  });
  const calendarRows = data.appointments || [];
  const calendarYear = calendarCursor.getFullYear();
  const calendarMonth = calendarCursor.getMonth();
  const calendarStartOffset =
    (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
  const calendarDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: calendarStartOffset }, () => null),
    ...Array.from({ length: calendarDays }, (_, index) => index + 1),
  ];
  while (calendarCells.length % 7) calendarCells.push(null);
  const appointmentsByDay = new Map<string, Row[]>();
  calendarRows.forEach((row) => {
    const date = appointmentDate(row);
    if (!date) return;
    const key = dayKey(date);
    appointmentsByDay.set(key, [...(appointmentsByDay.get(key) || []), row]);
  });
  const selectedAppointments = appointmentsByDay.get(calendarSelected) || [];
  const shiftCalendar = (offset: number) => {
    const next = new Date(calendarYear, calendarMonth + offset, 1);
    setCalendarCursor(next);
    setCalendarSelected(dayKey(next));
  };
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={theme === "light" ? "dark" : "light"} />
      <View style={styles.top}>
        <Pressable accessibilityLabel="Apri menu" onPress={() => setMenu(true)}>
          <Icon color={c.accent} name="menu" />
        </Pressable>
        <SvgXml
          xml={
            theme === "light"
              ? brand.light
              : brand.dark.replaceAll("#eef2f5", c.accent)
          }
          width={90}
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
        {found.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.h2}>Risultati in PRIME</Text>
            {found.map((r) => (
              <Pressable
                key={r.entity + r.id}
                onPress={() => {
                  setQuery("");
                  void run(() => openEditor(r.entity, r));
                }}
              >
                <Text style={styles.h3}>{r.title}</Text>
                <Text style={styles.muted}>{schema[r.entity]?.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
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
              ]
                .filter(([id]) => me.edition !== "base" || id !== "commissions")
                .map(([id, label]) => (
                  <Pressable
                    key={id}
                    style={styles.stat}
                    onPress={() => nav(id)}
                  >
                    <View style={styles.iconTile}>
                      <Icon color={c.accent} name={id} size={27} />
                    </View>
                    <Text style={styles.muted}>{label}</Text>
                    <Text style={styles.number}>
                      {id === "commissions"
                        ? euro(metricValue(id, data[id] || []))
                        : metricValue(id, data[id] || [])}
                    </Text>
                    <View style={styles.row}>
                      <Text style={[styles.tiny, { flex: 1 }]}>
                        Apri sezione
                      </Text>
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
        {page === "appointments" && (
          <View style={{ gap: 14 }}>
            <View style={styles.calendarHeader}>
              {button("‹", () => shiftCalendar(-1))}
              <Text style={[styles.h2, { flex: 1, textAlign: "center" }]}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              {button("›", () => shiftCalendar(1))}
            </View>
            <View style={styles.calendarWeek}>
              {weekNames.map((name) => (
                <Text key={name} style={styles.calendarWeekName}>
                  {name}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, index) => {
                const key =
                  day == null
                    ? `empty-${index}`
                    : dayKey(new Date(calendarYear, calendarMonth, day));
                const events = day == null ? [] : appointmentsByDay.get(key) || [];
                const selected = key === calendarSelected;
                return (
                  <Pressable
                    key={key}
                    disabled={day == null}
                    onPress={() => day != null && setCalendarSelected(key)}
                    style={[
                      styles.calendarDay,
                      selected && { backgroundColor: c.line },
                    ]}
                  >
                    {day != null && (
                      <Text style={styles.calendarDayNumber}>{day}</Text>
                    )}
                    {!!events.length && <View style={[styles.calendarDot, { backgroundColor: c.accent }]} />}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Text style={[styles.h3, { flex: 1 }]}>Appuntamenti del giorno</Text>
              {button(
                "+ Nuovo",
                () => void run(() => openEditor("appointments")),
                true,
              )}
            </View>
            {selectedAppointments.map((row) => {
              const starts = appointmentDate(row);
              const ends = row.ends_at ? new Date(String(row.ends_at)) : null;
              const title = text(row.title || row.appointment_type || "Appuntamento");
              const time = starts
                ? `${starts.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}${ends && !Number.isNaN(ends.getTime()) ? `–${ends.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                : "Orario da definire";
              return (
                <Pressable
                  key={row.id}
                  style={styles.calendarEvent}
                  onPress={() => void run(() => openEditor("appointments", row))}
                >
                  <View style={[styles.calendarEventBar, { backgroundColor: c.accent }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.h3}>{title}</Text>
                    <Text style={styles.muted}>
                      {time} · {text(row.status || "da confermare")}
                    </Text>
                  </View>
                  <Icon color={c.accent} name="arrow" size={17} />
                </Pressable>
              );
            })}
            {!selectedAppointments.length && (
              <Text style={styles.muted}>Nessun appuntamento per questo giorno.</Text>
            )}
          </View>
        )}
        {page !== "appointments" && schema[page] && entityList(page)}
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
        {(page === "connect" || providerPages.includes(page)) && (
          <>
            <Text style={styles.muted}>
              Collega i tuoi strumenti e prova i dati dimostrativi. Ogni
              servizio conserva le regole e i permessi del tuo piano.
            </Text>
            {providerCategories.map(([category, ids]) => {
              const group = providers.filter(
                ([id]) =>
                  ids.includes(id) &&
                  (page === "connect" ||
                    id === page.replace("storage_", "")),
              );
              if (!group.length) return null;
              return (
                <View key={category} style={{ gap: 10 }}>
                  <Text style={styles.eyebrow}>{category}</Text>
                  {group.map(([id, name, logo]) => {
                    const servicePage = providerServicePage[id];
                    const p = connectionRows.find(
                      (item) => item.provider === id,
                    );
                    const size = providerLogoSizes[id] || [32, 30];
                    const isActiveDemo =
                      demo && demoServices.includes(id) &&
                      canUseDemoProvider(id);
                    const isReadyLive =
                      !demo && liveServiceReady[id] === true;
                    const xml = (
                      providerLogos as Record<string, string>
                    )[logo];
                    const adjustedXml =
                      id === "apple"
                        ? xml.replaceAll("#000000", c.text)
                        : id === "datagma" && theme === "light"
                          ? xml.replace('fill="#fff">Datagma', 'fill="#172b3b">Datagma')
                          : xml;
                    return (
                      <View key={id} style={styles.panel}>
                        <View style={styles.row}>
                          {id === "contactout" ? (
                            <Image
                              source={require("../assets/providers/contactout.png")}
                              resizeMode="contain"
                              style={{ width: size[0], height: size[1] }}
                            />
                          ) : id === "voip" ? (
                            <Image
                              source={
                                theme === "light"
                                  ? require("../assets/providers/voipstudio-light.png")
                                  : require("../assets/providers/voipstudio-dark.png")
                              }
                              resizeMode="contain"
                              style={{ width: size[0], height: size[1] }}
                            />
                          ) : (
                            <SvgXml
                              xml={adjustedXml}
                              width={size[0]}
                              height={size[1]}
                            />
                          )}
                          {!["datagma", "voip"].includes(id) && (
                            <Text style={styles.h2}>{name}</Text>
                          )}
                          {servicePage && (isActiveDemo || isReadyLive) && (
                            <Text style={[styles.tiny, { color: c.accent }]}>
                              {isActiveDemo ? "DEMO ATTIVA" : "COLLEGATO"}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.muted}>
                          {demo
                            ? isActiveDemo
                              ? "Dati dimostrativi attivi. Nessun account reale o richiesta al provider."
                              : canUseDemoProvider(id)
                                ? "Attiva i dati fittizi per aprire la sezione dedicata."
                                : id === "stripe"
                                  ? "La simulazione Stripe è disponibile nei piani Elite e Secret."
                                  : "Passa al piano Secret per provare l’archiviazione dimostrativa."
                            : p?.configured || isReadyLive
                              ? "Servizio configurato. I dati reali si aprono solo dopo la verifica del collegamento."
                              : "Non collegato: configura e autorizza il servizio per aprire la sezione dedicata."}
                        </Text>
                        <View style={styles.row}>
                          {demo && servicePage && canUseDemoProvider(id)
                            ? button(
                                isActiveDemo
                                  ? "Disattiva dati fittizi"
                                  : "Attiva dati fittizi",
                                () =>
                                  toggleDemoService(id, !isActiveDemo),
                                !isActiveDemo,
                              )
                            : demo && servicePage
                              ? button(
                                  id === "stripe"
                                    ? "Scegli Elite o Secret"
                                    : "Scegli Secret",
                                  () => setPicker("plan"),
                                )
                              : !demo && servicePage && isReadyLive
                                ? button("Apri sezione", () => nav(servicePage))
                                : !demo
                                  ? button("Verifica stato", () =>
                                      void run(async () => {
                                        const status =
                                          await api.get<Record<string, unknown>>(
                                            "/api/connect",
                                          );
                                        const current = [
                                          ...((status.connections as {
                                            provider: string;
                                            status: string;
                                          }[]) || []),
                                          ...connectionRows,
                                        ].filter((item) => item.provider === id);
                                        setProbe({
                                          title: name,
                                          text: current.length
                                            ? current
                                                .map((item) => item.status || "Configurato")
                                                .join("\n")
                                            : p?.configured
                                              ? "Configurazione disponibile. Nessun account personale collegato."
                                              : "Non collegato: configura il servizio prima di eseguire un test reale.",
                                        });
                                      }),
                                    )
                                  : null}
                          {!demo &&
                            p?.configured &&
                            [
                              "calendly",
                              "drive",
                              "dropbox",
                              "onedrive",
                              "google",
                            ].includes(id) &&
                            button("Collega account", () =>
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
                </View>
              );
            })}
          </>
        )}
        {demo &&
          page !== "connect" &&
          page !== "wallester" &&
          providerPageService[page] &&
          demoServices.includes(providerPageService[page]) && (
            <View style={styles.panel}>
              <Text style={styles.eyebrow}>
                DEMO · {providerPageService[page].toUpperCase()} · DATI FITTIZI
              </Text>
              <Text style={styles.h2}>
                {page === "stripe"
                  ? "Pagamenti dimostrativi"
                  : demoProviderSamples[providerPageService[page]]?.title ||
                    "Esempio di integrazione"}
              </Text>
              <Text style={styles.muted}>
                Esempi creati nell’app. Non sono stati inviati dati al provider e
                non rappresentano un collegamento reale.
              </Text>
              {page === "stripe" ? (
                <>
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tiny}>Incassato · ultimi 30 giorni</Text>
                      <Text style={styles.number}>{euro(14820)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tiny}>In attesa</Text>
                      <Text style={styles.number}>{euro(1250)}</Text>
                    </View>
                  </View>
                  <FinanceChart color={c.accent} muted={c.muted} />
                  <Text style={styles.h3}>Pagamenti recenti</Text>
                  {stripeDemoPayments.map((payment) => (
                    <View key={payment.customer} style={styles.panel}>
                      <View style={styles.row}>
                        <Text style={[styles.h3, { flex: 1 }]}>
                          {payment.customer}
                        </Text>
                        <Text style={styles.h3}>{euro(payment.amount)}</Text>
                      </View>
                      <Text style={styles.muted}>
                        {payment.date} · {payment.reason} · {payment.status}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                (demoProviderSamples[providerPageService[page]]?.rows || []).map(
                  (sample) => (
                    <View key={sample} style={styles.navRow}>
                      <Icon color={c.accent} name={providerPageService[page]} />
                      <Text style={[styles.text, { flex: 1 }]}>{sample}</Text>
                    </View>
                  ),
                )
              )}
              {button("Disattiva dati fittizi", () =>
                toggleDemoService(providerPageService[page], false),
              )}
            </View>
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
            {demo && <FinanceChart color="#49a774" muted={c.muted} />}
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
            {demo &&
              button("Disattiva dati fittizi", () =>
                toggleDemoService("wallester", false),
              )}
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
        {page === "assistant" && <Vanessa api={api} colors={c} allowed={rank >= 2} />}
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
        {page === "portals" && (
          <>
            <Text style={styles.muted}>
              Prepara bozze degli annunci. La pubblicazione esterna richiede
              l’attivazione del relativo canale.
            </Text>
            {((connection.portals as Row[]) || []).map((p) => (
              <View key={text(p.id)} style={styles.panel}>
                <Text style={styles.h2}>{text(p.name)}</Text>
                <Text style={styles.muted}>{text(p.status)}</Text>
                {button("Prepara bozza", () =>
                  setChoices({
                    label: "Scegli immobile",
                    items: ((connection.properties as Row[]) || []).map(
                      (r) => ({ label: r.title, value: r.id }),
                    ),
                    choose: (id) => {
                      setChoices(null);
                      void run(async () => {
                        await api.post("/api/portals/drafts", {
                          portals: [p.id],
                          property_id: id,
                          operation: "publish",
                        });
                        await load();
                      });
                    },
                  }),
                )}
              </View>
            ))}
            {((connection.drafts as Row[]) || []).map((r, i) => (
              <View style={styles.panel} key={i}>
                <Text style={styles.text}>
                  {text(r.portal)} · {text(r.operation)}
                </Text>
                <Text style={styles.muted}>{text(r.updated_at)}</Text>
              </View>
            ))}
          </>
        )}
        {page === "audit" &&
          (data.audit || []).map((r, i) => (
            <View key={text(r.id || i)} style={styles.panel}>
              <Text style={styles.h3}>{text(r.action || r.title)}</Text>
              <Text style={styles.muted}>{text(r.created_at)}</Text>
            </View>
          ))}
        {page === "roadmap" && (
          <View style={styles.panel}>
            <Text style={styles.h2}>PRIME Mobile 0.2</Text>
            <Text style={styles.muted}>
              Workspace nativo, schede modificabili, piani, temi e dati della
              demo condivisi con il gestionale. I collegamenti esterni
              richiedono autorizzazione e una verifica reale del servizio. Gli
              acquisti dei piani attendono la configurazione degli store.
            </Text>
          </View>
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
          <ScrollView contentContainerStyle={[styles.content, { gap: 4 }]}>
            <View style={styles.row}>
              <SvgXml
                xml={
                  theme === "light"
                    ? brand.light
                    : brand.dark.replaceAll("#eef2f5", c.accent)
                }
                width={130}
                height={34}
              />
              <View style={{ flex: 1 }} />
              {button("Chiudi", () => setMenu(false))}
            </View>
            <Text style={styles.eyebrow}>
              PRIME {names[plan]?.toUpperCase()} · WORKSPACE
            </Text>
            {visibleMenuGroups.map((group) => (
              <View key={group.title} style={{ gap: 3 }}>
                <Text style={styles.eyebrow}>{group.title}</Text>
                {group.items.map((item) =>
                  "section" in item ? (
                    <Text
                      key={`${group.title}-${item.section}`}
                      style={[styles.tiny, { marginTop: 12, color: c.muted }]}
                    >
                      {item.section}
                    </Text>
                  ) : (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.navRow,
                        page === item.id && { backgroundColor: c.line },
                      ]}
                      onPress={() => nav(item.id)}
                    >
                      <Icon color={c.accent} name={item.id} />
                      <Text style={styles.text}>{item.label}</Text>
                    </Pressable>
                  ),
                )}
              </View>
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
                    ...(demo
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
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.text}>
                    {picker === "theme"
                      ? `${themeNames[id]}${theme === id ? " · Attivo" : ""}`
                      : names[id] || id.toUpperCase()}
                  </Text>
                  {picker === "theme" && !!themeDetails[id] && (
                    <Text style={styles.tiny}>{themeDetails[id]}</Text>
                  )}
                </View>
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
                          ? referenceLabel(
                              data[f.entity] || [],
                              editing.values[key],
                            )
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
            {editing?.row &&
              button("Elimina scheda", () =>
                Alert.alert(
                  "Elimina scheda",
                  "Confermi l’eliminazione di questa scheda?",
                  [
                    { text: "Annulla", style: "cancel" },
                    {
                      text: "Elimina",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          await api.change(
                            "/api/entities/" +
                              editing.entity +
                              "/" +
                              editing.row!.id,
                            "DELETE",
                            { version: editing.row!.version },
                          );
                          setEditing(null);
                          await load();
                        }),
                    },
                  ],
                ),
              )}
          </ScrollView>
          <Modal
            visible={!!choices && !!editing}
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
        visible={!!choices && !editing}
        transparent
        onRequestClose={() => setChoices(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView>
              <Text style={styles.h2}>{choices?.label}</Text>
              {choices?.items.map((item, i) => (
                <Pressable
                  style={styles.navRow}
                  key={i}
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
function FinanceChart({ color, muted }: { color: string; muted: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: muted, fontSize: 12 }}>DEMO · Andamento ultimi 30 giorni</Text>
        <Text style={{ color, fontSize: 12, fontWeight: "700" }}>↗ +12,4%</Text>
      </View>
      <Svg height={120} width="100%" viewBox="0 0 320 120" preserveAspectRatio="none">
        <Path d="M0 102H320M0 72H320M0 42H320M0 112L38 95 76 101 114 63 152 76 190 48 228 57 266 25 320 36V120H0Z" fill={color} opacity={0.12} />
        <Path d="M0 112L38 95 76 101 114 63 152 76 190 48 228 57 266 25 320 36" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {['1 nov', '8 nov', '15 nov', '22 nov', 'oggi'].map((label) => (
          <Text key={label} style={{ color: muted, fontSize: 10 }}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

function makeStyles(c: typeof palettes.light) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    top: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 8,
      borderBottomWidth: 1,
      borderColor: c.line,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    assistantHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 14,
      backgroundColor: c.panel,
    },
    assistantAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: c.accent,
    },
    calendarHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    calendarWeek: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: c.line,
      paddingBottom: 7,
    },
    calendarWeekName: {
      flex: 1,
      textAlign: "center",
      color: c.muted,
      fontSize: 11,
      fontWeight: "700",
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 4,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 12,
      backgroundColor: c.panel,
    },
    calendarDay: {
      width: "14.2857%",
      minHeight: 56,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      gap: 5,
    },
    calendarDayNumber: {
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
    },
    calendarDot: { width: 5, height: 5, borderRadius: 3 },
    calendarEvent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: c.line,
    },
    calendarEventBar: { width: 4, height: 38, borderRadius: 2 },
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
