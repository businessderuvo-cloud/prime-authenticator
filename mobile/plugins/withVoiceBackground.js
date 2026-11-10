const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const permissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
];
const services = [
  { name: "com.supersami.foregroundservice.ForegroundService", type: "microphone" },
  { name: "com.supersami.foregroundservice.ForegroundServiceTask" },
];
const metadata = [
  ["com.supersami.foregroundservice.notification_channel_name", "PRIME"],
  ["com.supersami.foregroundservice.notification_channel_description", "Conversazione vocale Vanessa"],
];

module.exports = function withVoiceBackground(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest["uses-permission"] ||= [];
    for (const name of permissions) {
      if (!manifest["uses-permission"].some((entry) => entry.$?.["android:name"] === name)) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    }
    const app = manifest.application[0];
    app.service ||= [];
    for (const service of services) {
      app.service = app.service.filter((entry) => entry.$?.["android:name"] !== service.name);
      app.service.push({
        $: {
          "android:name": service.name,
          "android:exported": "false",
          ...(service.type ? { "android:foregroundServiceType": service.type } : {}),
        },
      });
    }
    app["meta-data"] ||= [];
    for (const [name, value] of metadata) {
      app["meta-data"] = app["meta-data"].filter((entry) => entry.$?.["android:name"] !== name);
      app["meta-data"].push({ $: { "android:name": name, "android:value": value } });
    }
    app["meta-data"] = app["meta-data"].filter((entry) => entry.$?.["android:name"] !== "com.supersami.foregroundservice.notification_color");
    app["meta-data"].push({
      $: {
        "android:name": "com.supersami.foregroundservice.notification_color",
        "android:resource": "@color/prime_voice_notification",
      },
    });
    return mod;
  });

  return withDangerousMod(config, ["android", async (mod) => {
    const values = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "values");
    await fs.mkdir(values, { recursive: true });
    await fs.writeFile(
      path.join(values, "prime_voice_colors.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="prime_voice_notification">#C8AD7C</color>\n</resources>\n`,
    );
    return mod;
  }]);
};
