import { invalidateAllDashboardProjections } from "@/lib/dashboard/projections";
import { MarketPriceCache, RateLimiter } from "@/lib/pricing/cache";
import type {
  MarketPriceProvider,
  MarketPriceQuote,
  PriceSnapshotRecord,
  PricedAsset
} from "@/lib/pricing/types";

export type PriceSnapshotPrismaClient = {
  asset: {
    findMany(args: unknown): Promise<PricedAsset[]>;
  };
  priceSnapshot: {
    findFirst(args: unknown): Promise<PriceSnapshotRecord | null>;
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export type PriceRefreshResult = {
  assetId: string;
  provider?: string;
  status: "fetched" | "cached" | "stale" | "failed" | "unsupported";
  quote?: MarketPriceQuote;
  error?: string;
};

export type PriceRefreshOptions = {
  client: PriceSnapshotPrismaClient;
  providers: MarketPriceProvider[];
  asOf?: Date;
  cacheTtlMs?: number;
  staleAfterMs?: number;
  rateLimitMs?: number;
  fetchImpl?: typeof fetch;
};

export async function refreshLatestMarketPrices(options: PriceRefreshOptions) {
  const asOf = options.asOf ?? new Date();
  const cache = new MarketPriceCache(options.cacheTtlMs ?? 15 * 60 * 1000);
  const limiter = new RateLimiter(options.rateLimitMs ?? 250);
  const fetchImpl = options.fetchImpl ?? fetch;
  const assets = await options.client.asset.findMany({
    where: {
      deletedAt: null,
      type: {
        in: ["STOCK", "ETF", "MUTUAL_FUND", "CRYPTO", "GOLD"]
      }
    },
    orderBy: {
      symbol: "asc"
    }
  });
  const results: PriceRefreshResult[] = [];

  for (const asset of assets) {
    results.push(
      await refreshAssetPrice({
        asset,
        client: options.client,
        providers: options.providers,
        asOf,
        cache,
        limiter,
        staleAfterMs: options.staleAfterMs ?? 24 * 60 * 60 * 1000,
        fetchImpl
      })
    );
  }

  const summary = {
    refreshedAt: asOf,
    results,
    fetched: results.filter((result) => result.status === "fetched").length,
    cached: results.filter((result) => result.status === "cached").length,
    stale: results.filter((result) => result.status === "stale").length,
    failed: results.filter((result) => result.status === "failed").length,
    unsupported: results.filter((result) => result.status === "unsupported").length
  };

  if (summary.fetched > 0) {
    invalidateAllDashboardProjections("price-update");
  }

  return summary;
}

export async function getLatestPriceForAsset(
  client: PriceSnapshotPrismaClient,
  assetId: string
): Promise<PriceSnapshotRecord | null> {
  return client.priceSnapshot.findFirst({
    where: {
      assetId
    },
    orderBy: {
      asOf: "desc"
    }
  });
}

async function refreshAssetPrice({
  asset,
  client,
  providers,
  asOf,
  cache,
  limiter,
  staleAfterMs,
  fetchImpl
}: {
  asset: PricedAsset;
  client: PriceSnapshotPrismaClient;
  providers: MarketPriceProvider[];
  asOf: Date;
  cache: MarketPriceCache;
  limiter: RateLimiter;
  staleAfterMs: number;
  fetchImpl: typeof fetch;
}): Promise<PriceRefreshResult> {
  const cachedQuote = cache.get(asset, asOf);

  if (cachedQuote) {
    return {
      assetId: asset.id,
      provider: cachedQuote.provider,
      status: "cached",
      quote: cachedQuote
    };
  }

  const latestSnapshot = await getLatestPriceForAsset(client, asset.id);

  if (latestSnapshot && asOf.getTime() - latestSnapshot.fetchedAt.getTime() <= staleAfterMs) {
    const quote = snapshotToQuote(latestSnapshot);
    cache.set(quote);
    return {
      assetId: asset.id,
      provider: String(latestSnapshot.provider),
      status: "cached",
      quote
    };
  }

  const provider = providers.find((candidate) => candidate.supports(asset));

  if (!provider) {
    return latestSnapshot
      ? staleResult(asset.id, latestSnapshot)
      : {
          assetId: asset.id,
          status: "unsupported"
        };
  }

  try {
    const quote = await limiter.run(() =>
      provider.fetchLatestPrice(asset, {
        asOf,
        fetch: fetchImpl
      })
    );

    if (!quote) {
      return latestSnapshot ? staleResult(asset.id, latestSnapshot) : { assetId: asset.id, provider: provider.name, status: "failed" };
    }

    await client.priceSnapshot.createMany({
      data: [
        {
          assetId: quote.assetId,
          provider: quote.provider,
          sourceSymbol: quote.sourceSymbol,
          priceMinor: BigInt(quote.priceMinor),
          currency: quote.currency,
          asOf: quote.asOf,
          fetchedAt: quote.fetchedAt,
          isStale: false,
          metadata: quote.metadata
        }
      ],
      skipDuplicates: true
    });
    cache.set(quote);

    return {
      assetId: asset.id,
      provider: provider.name,
      status: "fetched",
      quote
    };
  } catch (error) {
    return latestSnapshot
      ? staleResult(asset.id, latestSnapshot, error)
      : {
          assetId: asset.id,
          provider: provider.name,
          status: "failed",
          error: error instanceof Error ? error.message : "Market price provider failed."
        };
  }
}

function staleResult(assetId: string, snapshot: PriceSnapshotRecord, error?: unknown): PriceRefreshResult {
  const quote = {
    ...snapshotToQuote(snapshot),
    isStale: true
  };

  return {
    assetId,
    provider: String(snapshot.provider),
    status: "stale",
    quote,
    error: error instanceof Error ? error.message : undefined
  };
}

function snapshotToQuote(snapshot: PriceSnapshotRecord): MarketPriceQuote {
  return {
    assetId: snapshot.assetId,
    provider: snapshot.provider as MarketPriceQuote["provider"],
    sourceSymbol: snapshot.sourceSymbol ?? undefined,
    priceMinor: toNumber(snapshot.priceMinor),
    currency: snapshot.currency,
    asOf: snapshot.asOf,
    fetchedAt: snapshot.fetchedAt,
    isStale: snapshot.isStale,
    metadata: typeof snapshot.metadata === "object" && snapshot.metadata !== null
      ? snapshot.metadata as Record<string, unknown>
      : undefined
  };
}

function toNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}
