const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const moduleContext = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/site-metrics.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { module: moduleContext, exports: moduleContext.exports },
);
const { metricValue } = moduleContext.exports;
test("dashboard collections use actual collected amounts including partial payments", () => {
  assert.equal(
    metricValue("commissions", [
      { amount: 1000, collected_amount: 250 },
      { amount: 2000, collected_amount: 0 },
      { amount: 400, collected_amount: 400 },
    ]),
    650,
  );
});
test("dashboard open and active counters match the site business rules", () => {
  assert.equal(
    metricValue("activities", [
      { status: "completata" },
      { status: "non completata" },
      { status: "annullata" },
      { status: "aperta" },
    ]),
    1,
  );
  assert.equal(
    metricValue("leases", [
      { status: "bozza" },
      { status: "attiva" },
      { status: "conclusa" },
    ]),
    1,
  );
  assert.equal(
    metricValue("deals", [
      { status: "aperta" },
      { status: "in attesa" },
      { status: "vinta" },
    ]),
    2,
  );
  assert.equal(
    metricValue("offers", [
      { status: "bozza" },
      { status: "presentata" },
      { status: "rifiutata" },
    ]),
    2,
  );
});
