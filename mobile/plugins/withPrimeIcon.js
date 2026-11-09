const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");
// Package the supplied bitmap unchanged. Android centers it without cropping the houses.
module.exports = function withPrimeIcon(config) {
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0].$;
    app["android:icon"] = "@drawable/prime_launcher";
    app["android:roundIcon"] = "@drawable/prime_launcher";
    return c;
  });
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const res = path.join(
        c.modRequest.platformProjectRoot,
        "app/src/main/res",
      );
      await fs.mkdir(path.join(res, "drawable-mdpi"), { recursive: true });
      await fs.mkdir(path.join(res, "drawable"), { recursive: true });
      await fs.copyFile(
        path.join(c.modRequest.projectRoot, "assets/prime-logo.png"),
        path.join(res, "drawable-mdpi/prime_original_logo.png"),
      );
      await fs.writeFile(
        path.join(res, "drawable/prime_launcher.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item><shape android:shape="rectangle"><size android:width="108dp" android:height="108dp"/><solid android:color="#080909"/></shape></item>
  <item android:width="64dp" android:height="38dp" android:gravity="center"><bitmap android:src="@drawable/prime_original_logo" android:gravity="fill" android:filter="true"/></item>
</layer-list>`,
      );
      return c;
    },
  ]);
};
