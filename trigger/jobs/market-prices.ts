import { prisma } from "@/lib/db";
import {
  defaultMarketPriceProviders,
  refreshLatestMarketPrices,
  type PriceRefreshOptions,
  type PriceSnapshotPrismaClient
} from "@/lib/pricing";

export type MarketPriceRefreshJobInput = {
  asOf?: Date;
  cacheTtlMs?: number;
  staleAfterMs?: number;
  rateLimitMs?: number;
};

export async function refreshMarketPricesJob(
  input: MarketPriceRefreshJobInput = {},
  client: PriceSnapshotPrismaClient = prisma as unknown as PriceSnapshotPrismaClient,
  options: Partial<Pick<PriceRefreshOptions, "providers" | "fetchImpl">> = {}
) {
  return refreshLatestMarketPrices({
    client,
    providers: options.providers ?? defaultMarketPriceProviders(),
    asOf: input.asOf,
    cacheTtlMs: input.cacheTtlMs,
    staleAfterMs: input.staleAfterMs,
    rateLimitMs: input.rateLimitMs,
    fetchImpl: options.fetchImpl
  });
}
