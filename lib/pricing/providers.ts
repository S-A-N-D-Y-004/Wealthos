import type { MarketPriceProvider, MarketPriceProviderContext, MarketPriceQuote, PricedAsset } from "@/lib/pricing/types";

export class YahooFinancePriceProvider implements MarketPriceProvider {
  readonly name = "YAHOO_FINANCE" as const;

  constructor(private readonly baseUrl = "https://query1.finance.yahoo.com/v7/finance/quote") {}

  supports(asset: PricedAsset) {
    return Boolean(asset.symbol) && (asset.type === "STOCK" || asset.type === "ETF");
  }

  async fetchLatestPrice(asset: PricedAsset, context: MarketPriceProviderContext): Promise<MarketPriceQuote | null> {
    const symbol = asset.symbol?.trim();

    if (!symbol) {
      return null;
    }

    const url = new URL(this.baseUrl);
    url.searchParams.set("symbols", symbol);
    const response = await context.fetch(url);

    if (!response.ok) {
      throw new Error(`Yahoo Finance price request failed with ${response.status}.`);
    }

    const payload = await response.json() as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          regularMarketPrice?: number;
          currency?: string;
          regularMarketTime?: number;
        }>;
      };
    };
    const result = payload.quoteResponse?.result?.[0];

    if (!result?.regularMarketPrice) {
      return null;
    }

    return {
      assetId: asset.id,
      provider: this.name,
      sourceSymbol: result.symbol ?? symbol,
      priceMinor: majorToMinor(result.regularMarketPrice),
      currency: result.currency ?? asset.currency,
      asOf: result.regularMarketTime ? new Date(result.regularMarketTime * 1000) : context.asOf,
      fetchedAt: context.asOf,
      metadata: {
        source: "yahoo-finance"
      }
    };
  }
}

export class CoinGeckoPriceProvider implements MarketPriceProvider {
  readonly name = "COINGECKO" as const;

  constructor(private readonly baseUrl = "https://api.coingecko.com/api/v3/simple/price") {}

  supports(asset: PricedAsset) {
    return asset.type === "CRYPTO" && Boolean(coinGeckoId(asset));
  }

  async fetchLatestPrice(asset: PricedAsset, context: MarketPriceProviderContext): Promise<MarketPriceQuote | null> {
    const id = coinGeckoId(asset);

    if (!id) {
      return null;
    }

    const currency = asset.currency.toLowerCase();
    const url = new URL(this.baseUrl);
    url.searchParams.set("ids", id);
    url.searchParams.set("vs_currencies", currency);
    url.searchParams.set("include_last_updated_at", "true");
    const response = await context.fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko price request failed with ${response.status}.`);
    }

    const payload = await response.json() as Record<string, Record<string, number | undefined>>;
    const price = payload[id]?.[currency];

    if (!price) {
      return null;
    }

    const lastUpdated = payload[id]?.last_updated_at;

    return {
      assetId: asset.id,
      provider: this.name,
      sourceSymbol: id,
      priceMinor: majorToMinor(price),
      currency: asset.currency,
      asOf: lastUpdated ? new Date(lastUpdated * 1000) : context.asOf,
      fetchedAt: context.asOf,
      metadata: {
        source: "coingecko"
      }
    };
  }
}

export class AmfiPriceProvider implements MarketPriceProvider {
  readonly name = "AMFI" as const;

  constructor(private readonly navUrl = "https://portal.amfiindia.com/spages/NAVAll.txt") {}

  supports(asset: PricedAsset) {
    return asset.type === "MUTUAL_FUND" && Boolean(asset.isin ?? asset.name);
  }

  async fetchLatestPrice(asset: PricedAsset, context: MarketPriceProviderContext): Promise<MarketPriceQuote | null> {
    const response = await context.fetch(this.navUrl);

    if (!response.ok) {
      throw new Error(`AMFI NAV request failed with ${response.status}.`);
    }

    const text = await response.text();
    const match = findAmfiNavLine(text, asset);

    if (!match) {
      return null;
    }

    return {
      assetId: asset.id,
      provider: this.name,
      sourceSymbol: asset.isin ?? asset.symbol ?? asset.name,
      priceMinor: majorToMinor(match.nav),
      currency: asset.currency,
      asOf: parseAmfiDate(match.date) ?? context.asOf,
      fetchedAt: context.asOf,
      metadata: {
        source: "amfi",
        schemeCode: match.schemeCode,
        schemeName: match.schemeName
      }
    };
  }
}

export class ManualPriceProvider implements MarketPriceProvider {
  readonly name = "MANUAL" as const;

  supports(asset: PricedAsset) {
    return manualPriceMinor(asset) !== undefined;
  }

  async fetchLatestPrice(asset: PricedAsset, context: MarketPriceProviderContext): Promise<MarketPriceQuote | null> {
    const priceMinor = manualPriceMinor(asset);

    if (priceMinor === undefined) {
      return null;
    }

    return {
      assetId: asset.id,
      provider: asset.type === "GOLD" ? "GOLD_MANUAL" : this.name,
      sourceSymbol: asset.symbol ?? asset.name,
      priceMinor,
      currency: asset.currency,
      asOf: context.asOf,
      fetchedAt: context.asOf,
      metadata: {
        source: "manual"
      }
    };
  }
}

export function defaultMarketPriceProviders(): MarketPriceProvider[] {
  return [
    new ManualPriceProvider(),
    new YahooFinancePriceProvider(),
    new CoinGeckoPriceProvider(),
    new AmfiPriceProvider()
  ];
}

function coinGeckoId(asset: PricedAsset) {
  const metadataId = metadataString(asset.metadata, "coingeckoId");

  if (metadataId) {
    return metadataId.toLowerCase();
  }

  return asset.symbol?.toLowerCase();
}

function manualPriceMinor(asset: PricedAsset) {
  return metadataNumber(asset.metadata, "manualPriceMinor")
    ?? metadataNumber(asset.metadata, "goldPriceMinor")
    ?? metadataNumber(asset.metadata, "currentPriceMinor");
}

function metadataString(metadata: PricedAsset["metadata"], key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataNumber(metadata: PricedAsset["metadata"], key: string) {
  const value = metadata?.[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function findAmfiNavLine(text: string, asset: PricedAsset) {
  const lines = text.split(/\r?\n/);
  const assetIsin = asset.isin?.trim().toUpperCase();
  const assetName = normalizeText(asset.name);

  for (const line of lines) {
    const parts = line.split(";");

    if (parts.length < 6 || parts[4] === "Net Asset Value") {
      continue;
    }

    const [schemeCode, isinPayout, isinReinvestment, schemeName, nav, date] = parts;
    const isinMatch = assetIsin && [isinPayout, isinReinvestment].some((isin) => isin.trim().toUpperCase() === assetIsin);
    const nameMatch = assetName && normalizeText(schemeName).includes(assetName);

    if (isinMatch || nameMatch) {
      return {
        schemeCode,
        schemeName,
        nav: Number(nav),
        date
      };
    }
  }

  return undefined;
}

function parseAmfiDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);

  if (!match) {
    return undefined;
  }

  const monthIndex = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
    match[2].toLowerCase()
  );

  if (monthIndex < 0) {
    return undefined;
  }

  return new Date(Date.UTC(Number(match[3]), monthIndex, Number(match[1])));
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function majorToMinor(value: number) {
  return Math.round(value * 100);
}
