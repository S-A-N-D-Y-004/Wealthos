import { describe, expect, it } from "vitest";
import {
  refreshLatestMarketPrices,
  type MarketPriceProvider,
  type MarketPriceQuote,
  type PriceSnapshotPrismaClient,
  type PriceSnapshotRecord,
  type PricedAsset
} from "@/lib/pricing";
import { refreshMarketPricesJob } from "@/trigger/jobs/market-prices";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("market price refresh service", () => {
  it("persists fetched price snapshots", async () => {
    const client = new FakePriceClient([stockAsset()]);
    const provider = quoteProvider({
      assetId: "asset-stock",
      provider: "YAHOO_FINANCE",
      sourceSymbol: "NIFTYBEES.NS",
      priceMinor: 25000,
      currency: "INR",
      asOf,
      fetchedAt: asOf
    });

    const result = await refreshLatestMarketPrices({
      client,
      providers: [provider],
      asOf,
      rateLimitMs: 0
    });

    expect(result.fetched).toBe(1);
    expect(client.snapshots).toHaveLength(1);
    expect(client.snapshots[0]).toMatchObject({
      assetId: "asset-stock",
      provider: "YAHOO_FINANCE",
      priceMinor: 25000n,
      currency: "INR",
      isStale: false
    });
  });

  it("uses fresh stored snapshots as cache and skips providers", async () => {
    let calls = 0;
    const client = new FakePriceClient([stockAsset()], [
      {
        assetId: "asset-stock",
        provider: "YAHOO_FINANCE",
        sourceSymbol: "NIFTYBEES.NS",
        priceMinor: 24000n,
        currency: "INR",
        asOf,
        fetchedAt: asOf
      }
    ]);
    const provider = quoteProvider({
      assetId: "asset-stock",
      provider: "YAHOO_FINANCE",
      priceMinor: 25000,
      currency: "INR",
      asOf,
      fetchedAt: asOf
    }, () => {
      calls += 1;
    });

    const result = await refreshLatestMarketPrices({
      client,
      providers: [provider],
      asOf,
      cacheTtlMs: 60_000,
      staleAfterMs: 60_000,
      rateLimitMs: 0
    });

    expect(result.cached).toBe(1);
    expect(calls).toBe(0);
    expect(client.createManyCalls).toBe(0);
  });

  it("uses stale prices gracefully when providers fail", async () => {
    const client = new FakePriceClient([stockAsset()], [
      {
        assetId: "asset-stock",
        provider: "YAHOO_FINANCE",
        sourceSymbol: "NIFTYBEES.NS",
        priceMinor: 24000n,
        currency: "INR",
        asOf: new Date("2026-06-10T00:00:00.000Z"),
        fetchedAt: new Date("2026-06-10T00:00:00.000Z")
      }
    ]);
    const provider: MarketPriceProvider = {
      name: "YAHOO_FINANCE",
      supports: () => true,
      async fetchLatestPrice() {
        throw new Error("provider unavailable");
      }
    };

    const result = await refreshLatestMarketPrices({
      client,
      providers: [provider],
      asOf,
      staleAfterMs: 1,
      rateLimitMs: 0
    });

    expect(result.stale).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "stale",
      error: "provider unavailable",
      quote: {
        priceMinor: 24000,
        isStale: true
      }
    });
    expect(client.createManyCalls).toBe(0);
  });

  it("wires the scheduled refresh job to the pricing service", async () => {
    const client = new FakePriceClient([stockAsset()]);
    const provider = quoteProvider({
      assetId: "asset-stock",
      provider: "YAHOO_FINANCE",
      priceMinor: 25500,
      currency: "INR",
      asOf,
      fetchedAt: asOf
    });

    const result = await refreshMarketPricesJob(
      {
        asOf,
        rateLimitMs: 0
      },
      client,
      {
        providers: [provider],
        fetchImpl: async () => new Response("{}", { status: 200 })
      }
    );

    expect(result.fetched).toBe(1);
    expect(client.snapshots[0].priceMinor).toBe(25500n);
  });
});

class FakePriceClient implements PriceSnapshotPrismaClient {
  createManyCalls = 0;

  constructor(
    private readonly assets: PricedAsset[],
    readonly snapshots: PriceSnapshotRecord[] = []
  ) {}

  asset = {
    findMany: async () => this.assets
  };

  priceSnapshot = {
    findFirst: async (args: unknown) => {
      const assetId = (args as { where: { assetId: string } }).where.assetId;
      return this.snapshots
        .filter((snapshot) => snapshot.assetId === assetId)
        .sort((left, right) => right.asOf.getTime() - left.asOf.getTime())[0] ?? null;
    },
    createMany: async (args: unknown) => {
      this.createManyCalls += 1;
      const rows = (args as { data: PriceSnapshotRecord[] }).data;

      for (const row of rows) {
        const duplicate = this.snapshots.some(
          (snapshot) =>
            snapshot.assetId === row.assetId
            && snapshot.provider === row.provider
            && snapshot.asOf.getTime() === row.asOf.getTime()
        );

        if (!duplicate) {
          this.snapshots.push(row);
        }
      }

      return { count: rows.length };
    }
  };
}

function quoteProvider(quote: MarketPriceQuote, onCall?: () => void): MarketPriceProvider {
  return {
    name: quote.provider,
    supports: () => true,
    async fetchLatestPrice() {
      onCall?.();
      return quote;
    }
  };
}

function stockAsset(): PricedAsset {
  return {
    id: "asset-stock",
    name: "Nifty BeES",
    symbol: "NIFTYBEES.NS",
    type: "ETF",
    currency: "INR"
  };
}
