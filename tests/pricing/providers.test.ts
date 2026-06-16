import { describe, expect, it } from "vitest";
import {
  AmfiPriceProvider,
  CoinGeckoPriceProvider,
  ManualPriceProvider,
  YahooFinancePriceProvider
} from "@/lib/pricing";
import type { PricedAsset } from "@/lib/pricing";

const asOf = new Date("2026-06-16T00:00:00.000Z");

describe("market price providers", () => {
  it("maps Yahoo Finance quote responses for stocks and ETFs", async () => {
    const provider = new YahooFinancePriceProvider("https://prices.test/yahoo");
    const quote = await provider.fetchLatestPrice(stockAsset(), {
      asOf,
      fetch: fakeJsonFetch({
        quoteResponse: {
          result: [
            {
              symbol: "NIFTYBEES.NS",
              regularMarketPrice: 250.45,
              currency: "INR",
              regularMarketTime: 1781568000
            }
          ]
        }
      })
    });

    expect(quote).toMatchObject({
      assetId: "asset-stock",
      provider: "YAHOO_FINANCE",
      sourceSymbol: "NIFTYBEES.NS",
      priceMinor: 25045,
      currency: "INR",
      asOf: new Date("2026-06-16T00:00:00.000Z")
    });
  });

  it("maps CoinGecko simple price responses for crypto", async () => {
    const provider = new CoinGeckoPriceProvider("https://prices.test/coingecko");
    const quote = await provider.fetchLatestPrice(cryptoAsset(), {
      asOf,
      fetch: fakeJsonFetch({
        bitcoin: {
          inr: 5120000,
          last_updated_at: 1781577600
        }
      })
    });

    expect(quote).toMatchObject({
      assetId: "asset-crypto",
      provider: "COINGECKO",
      sourceSymbol: "bitcoin",
      priceMinor: 512000000,
      currency: "INR"
    });
  });

  it("maps AMFI NAV text files for mutual funds", async () => {
    const provider = new AmfiPriceProvider("https://prices.test/amfi");
    const quote = await provider.fetchLatestPrice(mutualFundAsset(), {
      asOf,
      fetch: async () =>
        new Response(
          [
            "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
            "12345;INF123;INF124;Flexi Cap Fund Growth;42.1234;16-Jun-2026"
          ].join("\n"),
          { status: 200 }
        )
    });

    expect(quote).toMatchObject({
      assetId: "asset-mf",
      provider: "AMFI",
      sourceSymbol: "INF123",
      priceMinor: 4212,
      currency: "INR",
      asOf: new Date("2026-06-16T00:00:00.000Z")
    });
  });

  it("uses manual fallback prices for gold and unsupported external assets", async () => {
    const provider = new ManualPriceProvider();
    const quote = await provider.fetchLatestPrice(goldAsset(), {
      asOf,
      fetch: fakeJsonFetch({})
    });

    expect(quote).toMatchObject({
      assetId: "asset-gold",
      provider: "GOLD_MANUAL",
      sourceSymbol: "GOLD",
      priceMinor: 720000,
      currency: "INR",
      asOf
    });
  });
});

function stockAsset(): PricedAsset {
  return {
    id: "asset-stock",
    name: "Nifty BeES",
    symbol: "NIFTYBEES.NS",
    type: "ETF",
    currency: "INR"
  };
}

function cryptoAsset(): PricedAsset {
  return {
    id: "asset-crypto",
    name: "Bitcoin",
    symbol: "BTC",
    type: "CRYPTO",
    currency: "INR",
    metadata: {
      coingeckoId: "bitcoin"
    }
  };
}

function mutualFundAsset(): PricedAsset {
  return {
    id: "asset-mf",
    name: "Flexi Cap Fund Growth",
    isin: "INF123",
    type: "MUTUAL_FUND",
    currency: "INR"
  };
}

function goldAsset(): PricedAsset {
  return {
    id: "asset-gold",
    name: "Digital Gold",
    symbol: "GOLD",
    type: "GOLD",
    currency: "INR",
    metadata: {
      goldPriceMinor: 720000
    }
  };
}

function fakeJsonFetch(payload: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(payload), { status: 200 });
}
