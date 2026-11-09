const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sources = {
  google: "googlecalendar.svg",
  apple: "apple.svg",
  calendly: "calendly.svg",
  whatsapp: "whatsapp.svg",
  drive: "googledrive.svg",
  onedrive: "onedrive.svg",
  dropbox: "dropbox.svg",
  gmail: "gmail.svg",
  outlook: "outlook.svg",
  zoho: "zoho.svg",
  wallester: "wallester.svg",
  stripe: "stripe.svg",
  datagma: "datagma.svg",
};

const logos = Object.fromEntries(
  Object.entries(sources).map(([provider, file]) => {
    const svg = fs
      .readFileSync(path.join(root, "assets", "providers", file), "utf8")
      .replace(/<\?xml[^>]*\?>/g, "")
      .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
      .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, "");
    return [provider, svg];
  }),
);

fs.writeFileSync(
  path.join(root, "src", "provider-logos.json"),
  `${JSON.stringify(logos, null, 2)}\n`,
);
