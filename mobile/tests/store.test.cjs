const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function loadStore() {
  const calls = [];
  let updated;
  const sdk = {
    purchaseUpdatedListener: (listener) => {
      updated = listener;
      return { remove() {} };
    },
    purchaseErrorListener: () => ({ remove() {} }),
    initConnection: async () => calls.push("connect"),
    endConnection: async () => {},
    fetchProducts: async () => [
      { id: "store.test.month", displayPrice: "10,00 €" },
    ],
    requestPurchase: async () => calls.push("charge"),
    finishTransaction: async () => calls.push("finish"),
    getAvailablePurchases: async () => [],
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync("src/store.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === "react-native") return { Platform: { OS: "ios" } };
      if (name === "expo-iap") return sdk;
      throw Error(name);
    },
    Error,
    Set,
  });
  return { ...module.exports, calls, emit: (p) => updated(p) };
}
const config = {
  enabled: true,
  accountToken: "agency-account-uuid",
  products: [
    {
      plan: "standard",
      productId: "store.test.month",
      period: "monthly",
      name: "Standard",
    },
  ],
};
test("demo and disabled store configuration cannot connect or charge", async () => {
  const { PrimeStore, calls } = loadStore();
  const demo = new PrimeStore({ mode: "demo" }, config, () => {});
  assert.equal((await demo.connect()).length, 0);
  await assert.rejects(demo.buy("store.test.month"), /non ancora disponibili/);
  const disabled = new PrimeStore(
    { mode: "live" },
    { ...config, enabled: false },
    () => {},
  );
  await disabled.connect();
  assert.equal(calls.length, 0);
});
test("backend denial or cross-agency token never starts store payment", async () => {
  const { PrimeStore, calls } = loadStore();
  const client = {
    mode: "live",
    post: async () => ({ allowed: false, accountToken: config.accountToken }),
  };
  const store = new PrimeStore(client, config, () => {});
  await store.connect();
  await assert.rejects(store.buy("store.test.month"), /non autorizzato/);
  client.post = async () => ({
    allowed: true,
    accountToken: "different-agency",
  });
  await assert.rejects(store.buy("store.test.month"), /non autorizzato/);
  assert.equal(calls.includes("charge"), false);
});
test("unverified purchase is never acknowledged or treated as activated", async () => {
  const { PrimeStore, calls, emit } = loadStore();
  const messages = [];
  const store = new PrimeStore(
    { mode: "live", post: async () => ({ verified: false, active: false }) },
    config,
    (text) => messages.push(text),
  );
  await store.connect();
  emit({ id: "pending-transaction" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.includes("finish"), false);
  assert.match(messages[0], /in verifica/);
  await store.close();
});
