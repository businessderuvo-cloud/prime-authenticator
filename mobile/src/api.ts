import * as SecureStore from "expo-secure-store";
export type Mode = "demo" | "live";
export type Me = {
  id: string;
  tenant_id: string;
  email: string;
  tenant: string;
  role: string;
  csrf: string;
  demo_plan?: string;
  edition: string;
  customer_demo?: boolean;
  theme?: string;
  theme_variant?: string;
};
export type Row = { id: string; title: string; [key: string]: unknown };
export type Challenge = {
  requires_two_factor: true;
  challenge: string;
  methods: string[];
  verified: string[];
  policy: string;
};
export type Billing = { kyb: string; canPay: boolean };
export type Kyb = {
  configured: boolean;
  verified: boolean;
  sandbox_verified: boolean;
  environment: string;
  session: { status: string; url: string } | null;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const ORIGIN = "https://www.primegestionale.it";
const KEY = "prime.live.session.v1";
export class PrimeApi {
  private cookie = "";
  private csrf = "";
  constructor(
    public readonly mode: Mode,
    private transport: typeof fetch = fetch,
  ) {}
  private async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await this.transport(
        `${ORIGIN}${this.mode === "demo" ? "/demo" : ""}${path}`,
        {
          method,
          credentials: "omit",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...(this.cookie ? { Cookie: this.cookie } : {}),
            ...(this.csrf ? { "X-CSRF-Token": this.csrf } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
      );
      const name =
        this.mode === "demo" ? "prime_customer_demo" : "prime_session";
      const cookie = response.headers
        .get("set-cookie")
        ?.match(new RegExp(`(?:^|,\\s*)(${name}=[a-f0-9]{64})(?:;|$)`))?.[1];
      if (cookie) {
        this.cookie = cookie;
        if (this.mode === "live") await SecureStore.setItemAsync(KEY, cookie);
      }
      const data = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok)
        throw new ApiError(
          data?.error ||
            data?.message ||
            `Richiesta non riuscita (${response.status}).`,
          response.status,
        );
      // GET /demo/ creates the existing demo session. Its HTML is never rendered.
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
  async startDemo() {
    if (this.mode !== "demo") throw Error("Ambiente non valido.");
    this.cookie = "";
    this.csrf = "";
    await this.request("/");
    return this.me();
  }
  async restore() {
    if (this.mode === "live")
      this.cookie = (await SecureStore.getItemAsync(KEY)) || "";
    if (!this.cookie) return null;
    try {
      return await this.me();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 410].includes(e.status)) {
        await this.clear();
        return null;
      }
      throw e;
    }
  }
  async me() {
    const me = await this.request<Me>("/api/me");
    if ((this.mode === "demo") !== (me.customer_demo === true))
      throw Error("Sessione di un ambiente diverso. Accedi nuovamente.");
    this.csrf = me.csrf;
    return me;
  }
  login(email: string, password: string) {
    if (this.mode !== "live") throw Error("La demo non richiede credenziali.");
    return this.request<{ ok: boolean } | Challenge>("/api/auth", "POST", {
      mode: "login",
      email,
      password,
    });
  }
  register(email: string, password: string, agency: string) {
    return this.request("/api/auth", "POST", {
      mode: "register",
      email,
      password,
      agency,
    });
  }
  recovery(email: string) {
    return this.request("/api/auth/recovery", "POST", { email });
  }
  sendCode(challenge: string, method: string) {
    return this.request<{ code_token: string }>("/api/auth/2fa/send", "POST", {
      challenge,
      method,
    });
  }
  verifyCode(
    challenge: string,
    method: string,
    code: string,
    code_token: string,
  ) {
    return this.request<{ ok: boolean } | Challenge>(
      "/api/auth/2fa/verify",
      "POST",
      { challenge, method, code, code_token },
    );
  }
  get<T>(path: string) {
    return this.request<T>(path);
  }
  post<T>(path: string, body: unknown = {}) {
    return this.request<T>(path, "POST", body);
  }
  change<T>(path: string, method: string, body: unknown = {}) {
    return this.request<T>(path, method, body);
  }
  async plan(plan: string) {
    await this.post("/api/customer-demo/plan", { plan });
    return this.me();
  }
  async clear() {
    this.cookie = "";
    this.csrf = "";
    if (this.mode === "live") await SecureStore.deleteItemAsync(KEY);
  }
  async logout() {
    try {
      await this.post("/api/logout");
    } finally {
      await this.clear();
    }
  }
}
export const clients = {
  demo: new PrimeApi("demo"),
  live: new PrimeApi("live"),
};
