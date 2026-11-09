import { Platform } from "react-native";
import { PrimeApi } from "./api";
export type StorePlan = {
  plan: string;
  name: string;
  productId: string;
  period: "monthly" | "annual";
};
export type StoreConfig = {
  enabled: boolean;
  products: StorePlan[];
  accountToken: string;
  reason?: string;
};
export type StoreItem = StorePlan & { displayPrice: string };
// The backend must enable purchases only after store credentials and verification are configured.
export class PrimeStore {
  private sdk: typeof import("expo-iap") | null = null;
  private listeners: { remove(): void }[] = [];
  private inFlight = new Set<string>();
  constructor(
    private api: PrimeApi,
    private config: StoreConfig,
    private onMessage: (message: string) => void,
  ) {}
  async connect(): Promise<StoreItem[]> {
    if (
      this.api.mode !== "live" ||
      !this.config.enabled ||
      !this.config.accountToken ||
      !this.config.products.length
    )
      return [];
    this.sdk = await import("expo-iap");
    const sdk = this.sdk;
    this.listeners.push(
      sdk.purchaseUpdatedListener((p) => {
        void this.verify(p).catch((e) => this.onMessage(e.message));
      }),
    );
    this.listeners.push(
      sdk.purchaseErrorListener((e) => this.onMessage(e.message)),
    );
    await sdk.initConnection();
    const products = await sdk.fetchProducts({
      skus: this.config.products.map((p) => p.productId),
      type: "subs",
    });
    return this.config.products.flatMap((p) => {
      const product = products?.find((x) => x.id === p.productId);
      return product ? [{ ...p, displayPrice: product.displayPrice }] : [];
    });
  }
  async buy(productId: string) {
    if (
      !this.sdk ||
      !this.config.enabled ||
      !this.config.products.some((p) => p.productId === productId)
    )
      throw Error("Acquisti non ancora disponibili.");
    const intent = await this.api.post<{
      allowed: boolean;
      accountToken: string;
      offerToken?: string;
    }>("/api/mobile/store/intent", { platform: Platform.OS, productId });
    if (!intent.allowed || intent.accountToken !== this.config.accountToken)
      throw Error("Acquisto non autorizzato per questa agenzia.");
    await this.sdk.requestPurchase({
      type: "subs",
      request: {
        apple: { sku: productId, appAccountToken: intent.accountToken },
        google: {
          skus: [productId],
          obfuscatedAccountId: intent.accountToken,
          ...(intent.offerToken
            ? {
                subscriptionOffers: [
                  { sku: productId, offerToken: intent.offerToken },
                ],
              }
            : {}),
        },
      },
    });
  }
  private async verify(purchase: import("expo-iap").Purchase) {
    const key = purchase.id;
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    try {
      const result = await this.api.post<{
        verified: boolean;
        active: boolean;
      }>("/api/mobile/store/verify", { platform: Platform.OS, purchase });
      if (!result.verified || !result.active) {
        this.onMessage(
          "Pagamento in verifica. Il piano si aggiornerà dopo la conferma.",
        );
        return;
      }
      await this.sdk!.finishTransaction({ purchase, isConsumable: false });
      this.onMessage(
        "Abbonamento verificato e collegato alla tua agenzia PRIME.",
      );
    } finally {
      this.inFlight.delete(key);
    }
  }
  async restore() {
    if (!this.sdk) throw Error("Ripristino acquisti non ancora disponibile.");
    const purchases = await this.sdk.getAvailablePurchases();
    for (const p of purchases) await this.verify(p);
    if (!purchases.length)
      this.onMessage(
        "Nessun acquisto da ripristinare per questo account store.",
      );
  }
  async close() {
    this.listeners.forEach((l) => l.remove());
    this.listeners = [];
    if (this.sdk) await this.sdk.endConnection();
  }
}
