export type MarketPriceProviderName = "YAHOO_FINANCE" | "COINGECKO" | "AMFI" | "GOLD_MANUAL" | "MANUAL";

export type PricedAsset = {
  id: string;
  name: string;
  symbol?: string | null;
  isin?: string | null;
  exchange?: string | null;
  type: string;
  currency: string;
  metadata?: Record<string, unknown> | null;
};

export type MarketPriceQuote = {
  assetId: string;
  provider: MarketPriceProviderName;
  sourceSymbol?: string;
  priceMinor: number;
  currency: string;
  asOf: Date;
  fetchedAt: Date;
  isStale?: boolean;
  metadata?: Record<string, unknown>;
};

export type MarketPriceProviderContext = {
  asOf: Date;
  fetch: typeof fetch;
};

export type MarketPriceProvider = {
  name: MarketPriceProviderName;
  supports(asset: PricedAsset): boolean;
  fetchLatestPrice(asset: PricedAsset, context: MarketPriceProviderContext): Promise<MarketPriceQuote | null>;
};

export type PriceSnapshotRecord = {
  id?: string;
  assetId: string;
  provider: MarketPriceProviderName | string;
  sourceSymbol?: string | null;
  priceMinor: bigint | number;
  currency: string;
  asOf: Date;
  fetchedAt: Date;
  isStale?: boolean;
  metadata?: unknown;
};
