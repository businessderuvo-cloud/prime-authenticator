import { useEffect, useRef, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { SvgXml } from "react-native-svg";
import type { PrimeApi } from "./api";
import { BIOMETRIC_KEY } from "./device-security";

type Colors = { text: string; muted: string; panel: string; line: string; accent: string };

function SecurityAction({
  label,
  onPress,
  disabled = false,
  busy = false,
  colors: c,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  colors: Colors;
}) {
  return (
    <Pressable disabled={busy || disabled} onPress={onPress} style={{ padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 9, opacity: busy || disabled ? 0.48 : 1 }}>
      <Text style={{ color: c.accent, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

type SecurityState = {
  email_verified: boolean;
  methods: string[];
  policy: "any" | "all";
  email_provider_configured: boolean;
  sms_provider_configured: boolean;
  voice_call_configured: boolean;
  sms_phone: string;
  voice_phone: string;
};
type Challenge = {
  requires_two_factor: true;
  challenge: string;
  methods: string[];
  policy: "any" | "all";
  verified: string[];
};
type Enrollment = {
  method: string;
  token: string;
  secret?: string;
  qr?: string;
};

const labels: Record<string, string> = {
  totp: "Authenticator",
  email: "Email",
  sms: "SMS",
  voice: "Chiamata vocale",
};

export default function SecuritySettings({
  api,
  mode,
  colors: c,
}: {
  api: PrimeApi;
  mode: "demo" | "live";
  colors: Colors;
}) {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [biometric, setBiometric] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeMethod, setChallengeMethod] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const pendingAction = useRef<((authorization: string) => Promise<void>) | null>(null);

  async function refresh() {
    const result = await api.get<SecurityState>("/api/account/security");
    setSecurity(result);
  }
  useEffect(() => {
    let active = true;
    void Promise.all([
      api.get<SecurityState>("/api/account/security"),
      SecureStore.getItemAsync(BIOMETRIC_KEY),
    ]).then(([result, enabled]) => {
      if (!active) return;
      setSecurity(result);
      setBiometric(enabled === "enabled");
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof Error ? error.message : "Caricamento sicurezza non riuscito.");
    });
    return () => { active = false; };
  }, [api]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Operazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function withAuthorization(action: (authorization: string) => Promise<void>) {
    await run(async () => {
      if (!password) throw Error("Inserisci la password attuale per continuare.");
      const result = await api.post<{ ok?: boolean; grant?: string } | Challenge>(
        "/api/account/security/challenge",
        { password },
      );
      if ("requires_two_factor" in result) {
        pendingAction.current = action;
        setChallenge(result);
        setChallengeMethod(result.methods.find((item) => !result.verified.includes(item)) || result.methods[0] || "");
        setChallengeToken("");
        setCode("");
        return;
      }
      const authorization = result.grant || "";
      await action(authorization);
    });
  }

  async function finishChallenge(nextChallenge: Challenge) {
    setChallenge(nextChallenge);
    setChallengeMethod(nextChallenge.methods.find((item) => !nextChallenge.verified.includes(item)) || nextChallenge.methods[0] || "");
    setCode("");
    setChallengeToken("");
  }

  async function verifyChallenge() {
    if (!challenge) return;
    await run(async () => {
      const result = await api.post<{ ok: boolean; grant?: string } | Challenge>(
        "/api/auth/2fa/verify",
        { challenge: challenge.challenge, method: challengeMethod, code: code.trim(), code_token: challengeToken },
      );
      if ("requires_two_factor" in result) {
        await finishChallenge(result);
        return;
      }
      const authorization = result.grant || "";
      setChallenge(null);
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) await action(authorization);
    });
  }

  async function sendChallengeCode() {
    if (!challenge || challengeMethod === "totp") return;
    await run(async () => {
      const sent = await api.post<{ code_token: string }>("/api/auth/2fa/send", {
        challenge: challenge.challenge,
        method: challengeMethod,
      });
      setChallengeToken(sent.code_token);
      if (challengeMethod !== "voice") {
        setStatus(challengeMethod === "sms" ? "Codice SMS inviato." : "Codice inviato.");
        return;
      }
      setStatus("Chiamata avviata: rispondi e premi 1.");
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const result = await api.post<{ state: string }>("/api/auth/2fa/voice-status", {
          challenge: challenge.challenge,
          code_token: sent.code_token,
        });
        if (result.state === "confirmed") {
          const verified = await api.post<{ ok: boolean; grant?: string } | Challenge>(
            "/api/auth/2fa/verify",
            { challenge: challenge.challenge, method: "voice", code: "", code_token: sent.code_token },
          );
          if ("requires_two_factor" in verified) await finishChallenge(verified);
          else {
            setChallenge(null);
            const action = pendingAction.current;
            pendingAction.current = null;
            const authorization = verified.grant || "";
            if (action) await action(authorization);
          }
          return;
        }
        if (["failed", "expired"].includes(result.state)) throw Error("Chiamata non completata. Riprova.");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      throw Error("Tempo scaduto. Avvia una nuova chiamata.");
    });
  }

  async function startEnrollment(method: string) {
    await withAuthorization(async (authorization) => {
      const body = { password, grant: authorization, method, ...(method === "sms" || method === "voice" ? { phone: phone.trim() } : {}) };
      if (method === "totp") {
        const setup = await api.post<{ secret: string }>("/api/account/security/totp/setup", body);
        const qr = await api.getText("/api/account/security/totp/qr");
        setEnrollment({ method, token: "", secret: setup.secret, qr });
        setCode("");
        return;
      }
      const setup = await api.post<{ token: string }>("/api/account/security/factors/setup", body);
      if (method === "voice") {
        setStatus("Chiamata avviata: rispondi e premi 1.");
        const deadline = Date.now() + 90000;
        while (Date.now() < deadline) {
          const state = await api.post<{ state: string }>("/api/account/security/factors/voice-status", { token: setup.token });
          if (state.state === "confirmed") {
            await api.post("/api/account/security/factors/enable", { password, grant: authorization, method, token: setup.token, code: "" });
            setStatus("Chiamata vocale attivata.");
            await refresh();
            return;
          }
          if (["failed", "expired"].includes(state.state)) throw Error("Chiamata non completata. Riprova.");
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        throw Error("Tempo scaduto. Avvia una nuova chiamata.");
      }
      setEnrollment({ method, token: setup.token });
      setCode("");
    });
  }

  async function confirmEnrollment() {
    if (!enrollment) return;
    const selected = enrollment;
    await withAuthorization(async (authorization) => {
      const body = { password, grant: authorization, method: selected.method, token: selected.token, code: code.trim() };
      if (selected.method === "totp") await api.post("/api/account/security/totp/enable", body);
      else await api.post("/api/account/security/factors/enable", body);
      setEnrollment(null);
      setCode("");
      setStatus(`${labels[selected.method]} attivato.`);
      await refresh();
    });
  }

  async function savePolicy(policy: "any" | "all") {
    await withAuthorization(async (authorization) => {
      await api.post("/api/account/security/policy", { password, grant: authorization, policy });
      setStatus("Preferenza di verifica salvata.");
      await refresh();
    });
  }

  async function toggleBiometric(value: boolean) {
    if (!value) {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      setBiometric(false);
      setStatus("Accesso biometrico disattivato su questo dispositivo.");
      return;
    }
    const available = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!available || !enrolled) throw Error("Configura Face ID o impronta sul dispositivo prima di attivare questa opzione.");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Attiva accesso biometrico PRIME",
      cancelLabel: "Annulla",
      disableDeviceFallback: true,
    });
    if (!result.success) throw Error("Verifica biometrica annullata.");
    await SecureStore.setItemAsync(BIOMETRIC_KEY, "enabled");
    setBiometric(true);
    setStatus("Accesso biometrico attivato su questo dispositivo.");
  }

  const card = { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 15, gap: 10 } as const;
  const title = { color: c.text, fontSize: 17, fontWeight: "600" as const };
  const muted = { color: c.muted, lineHeight: 21 } as const;
  const inputStyle = { color: c.text, borderWidth: 1, borderColor: c.line, borderRadius: 9, padding: 12 } as const;

  if (mode === "demo") return <View style={card}><Text style={title}>Sicurezza account</Text><Text style={muted}>Biometria e verifica in due passaggi sono disponibili per gli account live. La demo non modifica impostazioni di sicurezza reali.</Text></View>;
  if (!security) return <View style={card}><Text style={title}>Sicurezza account</Text><Text style={muted}>{status || "Caricamento impostazioni…"}</Text></View>;

  const methods = new Set(security.methods);
  const available: Record<string, boolean> = {
    totp: true,
    email: security.email_provider_configured && security.email_verified,
    sms: security.sms_provider_configured,
    voice: security.voice_call_configured,
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={card}>
        <Text style={title}>Accesso biometrico · questo dispositivo</Text>
        <Text style={muted}>Usa Face ID o l’impronta per sbloccare la sessione PRIME salvata in modo sicuro. Questa opzione non sostituisce la 2FA dell’account.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: c.text }}>Richiedi biometria all’apertura</Text>
          <Switch value={biometric} disabled={busy} onValueChange={(value) => void run(() => toggleBiometric(value))} />
        </View>
      </View>
      <View style={card}>
        <Text style={title}>Verifica in due passaggi · facoltativa</Text>
        <Text style={muted}>{security.methods.length ? `Metodi attivi: ${security.methods.map((item) => labels[item] || item).join(", ")}.` : "Disattivata. Attiva uno o più metodi per aggiungere una verifica al login."}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>I metodi SMS, chiamata e Authenticator possono essere attivi insieme.</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password attuale per modificare la sicurezza" placeholderTextColor={c.muted} autoCapitalize="none" style={inputStyle} />
      </View>

      {(["totp", "sms", "voice", "email"] as const).map((method) => (
        <View key={method} style={card}>
          <Text style={title}>{method === "totp" ? "PRIME Authenticator" : labels[method]}</Text>
          <Text style={muted}>
            {methods.has(method) ? `Attivo${method === "sms" ? ` · ${security.sms_phone}` : method === "voice" ? ` · ${security.voice_phone}` : ""}.` : method === "totp" ? "Usa PRIME Authenticator, Google Authenticator o un’app TOTP compatibile." : method === "email" ? security.email_verified ? "Codice all’indirizzo email verificato dell’account." : "Verifica prima l’indirizzo email dell’account." : method === "sms" ? security.sms_provider_configured ? "Ricevi un codice monouso via SMS." : "Il servizio SMS di sicurezza non è configurato sul server." : security.voice_call_configured ? "Ricevi una chiamata e premi 1 per confermare." : "Il servizio chiamate di sicurezza non è configurato sul server."}
          </Text>
          {!methods.has(method) && (method === "sms" || method === "voice") && (
            <TextInput value={phone} onChangeText={setPhone} placeholder="Cellulare con prefisso internazionale · +39…" placeholderTextColor={c.muted} keyboardType="phone-pad" style={inputStyle} />
          )}
          {methods.has(method)
            ? <>
                {method === "totp" && <TextInput value={code} onChangeText={setCode} placeholder="Codice Authenticator" placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={6} style={inputStyle} />}
                <SecurityAction label={`Disattiva ${labels[method]}`} onPress={() => void withAuthorization((authorization) => disableAuthorized(method, authorization))} disabled={method === "totp" && code.trim().length !== 6} busy={busy} colors={c} />
              </>
            : <SecurityAction label={`Configura ${labels[method]}`} onPress={() => void startEnrollment(method)} disabled={!available[method] || ((method === "sms" || method === "voice") && !/^\+[1-9]\d{7,14}$/.test(phone.trim()))} busy={busy} colors={c} />}
          {enrollment?.method === method && (
            <View style={{ gap: 10 }}>
              {enrollment.qr && <View style={{ alignSelf: "center", backgroundColor: "#fff", padding: 10, borderRadius: 8 }}><SvgXml xml={enrollment.qr} width={230} height={230} /></View>}
              {enrollment.secret && <Text selectable style={{ color: c.text }}>Chiave manuale: {enrollment.secret}</Text>}
              <TextInput value={code} onChangeText={setCode} placeholder={method === "totp" ? "Codice a 6 cifre" : method === "sms" ? "Codice SMS a 5 cifre" : "Codice ricevuto"} placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={method === "sms" ? 5 : 6} style={inputStyle} />
              <SecurityAction label="Conferma e attiva" onPress={() => void confirmEnrollment()} disabled={code.trim().length !== (method === "sms" ? 5 : 6)} busy={busy} colors={c} />
              <SecurityAction label="Annulla configurazione" onPress={() => { setEnrollment(null); setCode(""); }} busy={busy} colors={c} />
            </View>
          )}
        </View>
      ))}

      <View style={card}>
        <Text style={title}>Combinazione dei metodi</Text>
        <Text style={muted}>Scegli se il login richiede un metodo attivo oppure tutti quelli attivi.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecurityAction label="Uno qualsiasi" onPress={() => void savePolicy("any")} disabled={!methods.size || security.policy === "any"} busy={busy} colors={c} />
          <SecurityAction label="Tutti i metodi" onPress={() => void savePolicy("all")} disabled={!methods.size || security.policy === "all"} busy={busy} colors={c} />
        </View>
      </View>

      {challenge && (
        <View style={card}>
          <Text style={title}>Conferma la tua identità</Text>
          <Text style={muted}>{challenge.policy === "all" ? "Completa tutti i metodi richiesti prima di modificare le impostazioni." : "Scegli uno dei metodi attivi per autorizzare la modifica."}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {challenge.methods.map((method) => <Pressable key={method} onPress={() => { setChallengeMethod(method); setChallengeToken(""); setCode(""); }} style={{ padding: 9, borderRadius: 8, borderWidth: 1, borderColor: challengeMethod === method ? c.accent : c.line }}><Text style={{ color: c.text }}>{challenge.verified.includes(method) ? "✓ " : ""}{labels[method] || method}</Text></Pressable>)}
          </View>
          {challengeMethod !== "totp" && challengeMethod !== "voice" && <SecurityAction label="Invia codice" onPress={() => void sendChallengeCode()} busy={busy} colors={c} />}
          {challengeMethod === "voice" && <SecurityAction label="Avvia chiamata di verifica" onPress={() => void sendChallengeCode()} busy={busy} colors={c} />}
          {challengeMethod !== "voice" && <TextInput value={code} onChangeText={setCode} placeholder={challengeMethod === "totp" ? "Codice Authenticator · 6 cifre" : challengeMethod === "sms" ? "Codice SMS · 5 cifre" : "Codice email · 6 cifre"} placeholderTextColor={c.muted} keyboardType="number-pad" maxLength={challengeMethod === "sms" ? 5 : 6} style={inputStyle} />}
          {challengeMethod !== "voice" && <SecurityAction label="Conferma identità" onPress={() => void verifyChallenge()} disabled={code.trim().length !== (challengeMethod === "sms" ? 5 : 6) || (challengeMethod !== "totp" && !challengeToken)} busy={busy} colors={c} />}
          <SecurityAction label="Annulla" onPress={() => { setChallenge(null); pendingAction.current = null; setCode(""); }} busy={busy} colors={c} />
        </View>
      )}
      {!!status && <Text accessibilityRole="alert" style={{ color: c.muted }}>{status}</Text>}
      {!security.methods.length && <Text style={muted}>Con nessun metodo attivo, il login usa la password. Puoi attivare SMS, chiamata e Authenticator senza escluderne altri.</Text>}
    </View>
  );

  async function disableAuthorized(method: string, authorization: string) {
    const body = { password, grant: authorization, method, ...(method === "totp" ? { code: code.trim() } : {}) };
    if (method === "totp") await api.post("/api/account/security/totp/disable", body);
    else await api.post("/api/account/security/factors/disable", body);
    setCode("");
    setStatus(`${labels[method]} disattivato.`);
    await refresh();
  }
}
