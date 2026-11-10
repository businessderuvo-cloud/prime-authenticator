const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function loadApi() {
  const saved = new Map();
  const storage = {
    setItemAsync: async (k, v) => saved.set(k, v),
    getItemAsync: async (k) => saved.get(k),
    deleteItemAsync: async (k) => saved.delete(k),
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync("src/api.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === "./device-security") return { BIOMETRIC_KEY: "prime.live.biometric.v1" };
      assert.equal(name, "expo-secure-store");
      return storage;
    },
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    Error,
  });
  return { ...module.exports, saved };
}
const cookie = "a".repeat(64),
  csrf = "test-csrf";
function reply(data, status = 200, setCookie) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...(setCookie ? { "set-cookie": setCookie } : {}),
    },
  });
}
test("demo never sends saved live credentials; CSRF belongs to demo; switching plan uses public API", async () => {
  const { PrimeApi, saved } = loadApi();
  saved.set("prime.live.session.v1", "prime_session=" + "b".repeat(64));
  const calls = [];
  const api = new PrimeApi("demo", async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/demo/"))
      return reply(
        null,
        200,
        `prime_customer_demo=${cookie}; HttpOnly; Path=/demo`,
      );
    if (url.endsWith("/api/me")) return reply({ customer_demo: true, csrf });
    return reply({ ok: true });
  });
  await api.startDemo();
  await api.plan("elite");
  assert.equal(calls[0].options.headers.Cookie, undefined);
  assert.equal(
    calls[1].options.headers.Cookie,
    `prime_customer_demo=${cookie}`,
  );
  assert.equal(
    calls[2].url,
    "https://primegestionale.it/demo/api/customer-demo/plan",
  );
  assert.equal(calls[2].options.headers["X-CSRF-Token"], csrf);
  assert.equal(JSON.parse(calls[2].options.body).plan, "elite");
  assert.equal(saved.size, 1);
});
test("failed live logout clears encrypted local credentials even when network fails", async () => {
  const { PrimeApi, saved } = loadApi();
  const api = new PrimeApi("live", async (url) => {
    if (url.endsWith("/api/auth"))
      return reply(
        { ok: true },
        200,
        `prime_session=${cookie}; Path=/; HttpOnly`,
      );
    throw Error("offline");
  });
  await api.login("user@example.com", "test-only-password");
  assert.equal(saved.size, 1);
  await assert.rejects(api.logout(), /offline/);
  assert.equal(saved.size, 0);
});
test("expired live session is cleared; network errors do not erase a valid session", async () => {
  const { PrimeApi, saved } = loadApi();
  saved.set("prime.live.session.v1", `prime_session=${cookie}`);
  const api = new PrimeApi("live", async () =>
    reply({ error: "Sessione scaduta" }, 401),
  );
  assert.equal(await api.restore(), null);
  assert.equal(saved.size, 0);
  saved.set("prime.live.session.v1", `prime_session=${cookie}`);
  const offline = new PrimeApi("live", async () => {
    throw Error("offline");
  });
  await assert.rejects(offline.restore(), /offline/);
  assert.equal(saved.size, 1);
});
test("rejects a live response masquerading as demo", async () => {
  const { PrimeApi } = loadApi();
  const api = new PrimeApi("demo", async () =>
    reply({ customer_demo: false, csrf }),
  );
  await assert.rejects(api.startDemo(), /ambiente diverso/);
});
test(
  "DEMO public server round trip, plan switch and no live fallback",
  { skip: !process.env.PRIME_LIVE_SMOKE },
  async () => {
    const { PrimeApi } = loadApi();
    const api = new PrimeApi("demo");
    try {
      const me = await api.startDemo();
      assert.equal(me.customer_demo, true);
      const properties = await api.get("/api/entities/properties");
      assert.ok(Array.isArray(properties));
      const contacts = await api.get("/api/entities/contacts");
      assert.ok(Array.isArray(contacts));
      const agenda = await api.get("/api/entities/appointments");
      assert.ok(Array.isArray(agenda));
      for (const plan of ["pro", "vip", "elite", "secret", "standard"]) {
        const changed = await api.plan(plan);
        assert.equal(changed.demo_plan, plan);
      }
      await api.plan("secret");
      for (const variant of [
        "light",
        "pro",
        "vip",
        "elite",
        "secret",
        "valentine",
        "halloween",
        "christmas",
      ]) {
        await api.change("/api/preferences", "PATCH", {
          theme: variant === "light" ? "light" : "dark",
          theme_variant: variant === "light" ? "" : variant,
        });
        const state = await api.me();
        assert.equal(state.theme_variant, variant === "light" ? "" : variant);
      }
      const created = await api.post("/api/entities/streets", {
        data: {
          title: "Via test nativo",
          city: "Milano",
          census_status: "da censire",
        },
      });
      assert.ok(created.id);
      const updated = await api.change(
        "/api/entities/streets/" + created.id,
        "PUT",
        {
          version: created.version,
          data: {
            title: "Via test nativo aggiornata",
            city: "Milano",
            census_status: "da censire",
          },
        },
      );
      assert.equal(updated.title, "Via test nativo aggiornata");
      const connect = await api.get("/api/connect");
      assert.ok(Array.isArray(connect.providers));
      const accounts = await api.get("/api/connect/wallester");
      assert.equal(accounts.simulation, true);
      assert.ok(accounts.accounts.length > 0);
      const movements = await api.get("/api/connect/wallester/movements");
      assert.ok(movements.transactions.length > 0);
    } finally {
      await api.logout();
    }
  },
);
