import type { MarketPriceQuote, PricedAsset } from "@/lib/pricing/types";

export class MarketPriceCache {
  private readonly quotes = new Map<string, MarketPriceQuote>();

  constructor(private readonly ttlMs: number) {}

  get(asset: PricedAsset, asOf: Date) {
    const quote = this.quotes.get(asset.id);

    if (!quote) {
      return undefined;
    }

    if (asOf.getTime() - quote.fetchedAt.getTime() > this.ttlMs) {
      return undefined;
    }

    return quote;
  }

  set(quote: MarketPriceQuote) {
    this.quotes.set(quote.assetId, quote);
  }
}

export class RateLimiter {
  private nextAvailableAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async run<T>(task: () => Promise<T>) {
    const waitMs = Math.max(this.nextAvailableAt - Date.now(), 0);

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.nextAvailableAt = Date.now() + this.minIntervalMs;
    return task();
  }
}
