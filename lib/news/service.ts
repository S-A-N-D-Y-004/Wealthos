import { createHash } from "node:crypto";
import { stableAlertId } from "@/lib/alerts/rules";
import { invalidateDashboardProjection } from "@/lib/dashboard/projections";
import { RateLimiter } from "@/lib/pricing/cache";
import { NewsArticleCache } from "@/lib/news/cache";
import {
  analyzeNewsSentiment,
  isSignificantNewsEvent,
  isStrongNegativeSentiment
} from "@/lib/news/sentiment";
import type {
  NewsAsset,
  NewsProvider,
  NewsProviderArticle,
  NewsRefreshAssetResult,
  NewsSentimentResult,
  PersistedNewsArticle
} from "@/lib/news/types";

export type NewsPrismaClient = {
  asset: {
    findMany(args: unknown): Promise<NewsAsset[]>;
  };
  newsArticle: {
    createMany(args: unknown): Promise<{ count: number }>;
    findMany(args: unknown): Promise<PersistedNewsArticle[]>;
  };
  newsArticleAsset: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
  alert: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export type NewsRefreshOptions = {
  userId: string;
  client: NewsPrismaClient;
  providers: NewsProvider[];
  asOf?: Date;
  fetchImpl?: typeof fetch;
  cacheTtlMs?: number;
  rateLimitMs?: number;
};

export type NormalizedNewsArticle = {
  id: string;
  assetId: string;
  symbol?: string;
  provider: string;
  sourceId?: string;
  url?: string;
  title: string;
  summary?: string;
  sourceName?: string;
  publishedAt: Date;
  sentiment: NewsSentimentResult;
  metadata: Record<string, unknown>;
};

export async function refreshNewsForUser(options: NewsRefreshOptions) {
  const asOf = options.asOf ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new NewsArticleCache(options.cacheTtlMs ?? 30 * 60 * 1000);
  const limiter = new RateLimiter(options.rateLimitMs ?? 250);
  const assets = await loadNewsAssets(options.client, options.userId);
  const results: NewsRefreshAssetResult[] = [];
  const normalized: NormalizedNewsArticle[] = [];

  for (const asset of assets) {
    const supportedProviders = options.providers.filter((provider) => provider.supports(asset));

    if (supportedProviders.length === 0) {
      results.push({
        assetId: asset.id,
        symbol: asset.symbol ?? undefined,
        status: "unsupported",
        articles: []
      });
      continue;
    }

    for (const provider of supportedProviders) {
      const cacheKey = `${provider.name}:${asset.id}`;
      const cached = cache.get(cacheKey, asOf);

      if (cached) {
        results.push({
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          provider: provider.name,
          status: "cached",
          articles: cached
        });
        normalized.push(...cached.map((article) => normalizeArticle(asset, article, asOf)));
        continue;
      }

      try {
        const articles = await limiter.run(() =>
          provider.fetchNews(asset, {
            asOf,
            fetch: fetchImpl
          })
        );
        cache.set(cacheKey, asOf, articles);
        results.push({
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          provider: provider.name,
          status: "fetched",
          articles
        });
        normalized.push(...articles.map((article) => normalizeArticle(asset, article, asOf)));
      } catch (error) {
        results.push({
          assetId: asset.id,
          symbol: asset.symbol ?? undefined,
          provider: provider.name,
          status: "failed",
          articles: [],
          error: error instanceof Error ? error.message : "News provider failed."
        });
      }
    }
  }

  const uniqueArticles = dedupeNormalizedArticles(normalized);
  const articlesPersisted = await persistNewsArticles(options.client, uniqueArticles);
  const linksPersisted = await persistNewsLinks(options.client, uniqueArticles);
  const alertsPersisted = await persistNewsAlerts(options.client, options.userId, uniqueArticles, asOf);
  const persistedCount = articlesPersisted + linksPersisted + alertsPersisted;

  if (persistedCount > 0) {
    invalidateDashboardProjection(options.userId, "news-update");
  }

  return {
    refreshedAt: asOf,
    assetsScanned: assets.length,
    fetched: results.filter((result) => result.status === "fetched").length,
    cached: results.filter((result) => result.status === "cached").length,
    failed: results.filter((result) => result.status === "failed").length,
    unsupported: results.filter((result) => result.status === "unsupported").length,
    articlesPersisted,
    linksPersisted,
    alertsPersisted,
    results
  };
}

export async function getNewsForUser({
  userId,
  client,
  limit = 20
}: {
  userId: string;
  client: NewsPrismaClient;
  limit?: number;
}) {
  return client.newsArticle.findMany({
    where: {
      assets: {
        some: {
          asset: {
            transactions: {
              some: {
                userId,
                deletedAt: null
              }
            }
          }
        }
      }
    },
    include: {
      assets: {
        include: {
          asset: true
        }
      }
    },
    orderBy: {
      publishedAt: "desc"
    },
    take: limit
  });
}

function loadNewsAssets(client: NewsPrismaClient, userId: string) {
  return client.asset.findMany({
    where: {
      deletedAt: null,
      type: {
        in: ["STOCK", "ETF", "CRYPTO"]
      },
      transactions: {
        some: {
          userId,
          deletedAt: null
        }
      }
    },
    orderBy: {
      symbol: "asc"
    }
  });
}

function normalizeArticle(asset: NewsAsset, article: NewsProviderArticle, asOf: Date): NormalizedNewsArticle {
  const sentiment = analyzeNewsSentiment(article);
  const sourceId = article.sourceId ?? article.url ?? `${article.title}:${article.publishedAt.toISOString()}`;
  const id = stableNewsArticleId(article.provider, sourceId);
  const symbols = article.symbols && article.symbols.length > 0
    ? article.symbols
    : [asset.symbol].filter(Boolean) as string[];

  return {
    id,
    assetId: asset.id,
    symbol: asset.symbol ?? symbols[0],
    provider: article.provider,
    sourceId,
    url: article.url,
    title: article.title,
    summary: article.summary,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    sentiment,
    metadata: {
      fetchedAt: asOf.toISOString(),
      symbols,
      sentimentTerms: {
        positive: sentiment.positiveMatches,
        negative: sentiment.negativeMatches,
        significantEvents: sentiment.significantEvents
      },
      providerMetadata: article.metadata
    }
  };
}

function dedupeNormalizedArticles(articles: NormalizedNewsArticle[]) {
  const byLink = new Map<string, NormalizedNewsArticle>();

  for (const article of articles) {
    byLink.set(`${article.id}:${article.assetId}`, article);
  }

  return [...byLink.values()].sort(
    (left, right) =>
      right.publishedAt.getTime() - left.publishedAt.getTime()
      || left.title.localeCompare(right.title)
      || left.assetId.localeCompare(right.assetId)
  );
}

async function persistNewsArticles(client: NewsPrismaClient, articles: NormalizedNewsArticle[]) {
  if (articles.length === 0) {
    return 0;
  }

  const byArticleId = new Map<string, NormalizedNewsArticle>();

  for (const article of articles) {
    byArticleId.set(article.id, article);
  }

  const result = await client.newsArticle.createMany({
    data: [...byArticleId.values()].map((article) => ({
      id: article.id,
      provider: article.provider,
      sourceId: article.sourceId,
      url: article.url,
      title: article.title,
      summary: article.summary,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt,
      sentiment: article.sentiment.label,
      sentimentScore: article.sentiment.score,
      metadata: article.metadata
    })),
    skipDuplicates: true
  });

  return result.count;
}

async function persistNewsLinks(client: NewsPrismaClient, articles: NormalizedNewsArticle[]) {
  if (articles.length === 0) {
    return 0;
  }

  const result = await client.newsArticleAsset.createMany({
    data: articles.map((article) => ({
      id: stableNewsLinkId(article.id, article.assetId),
      articleId: article.id,
      assetId: article.assetId,
      symbol: article.symbol,
      relevance: 1
    })),
    skipDuplicates: true
  });

  return result.count;
}

async function persistNewsAlerts(
  client: NewsPrismaClient,
  userId: string,
  articles: NormalizedNewsArticle[],
  asOf: Date
) {
  const alerts = articles.flatMap((article) => newsAlertsForArticle(userId, article, asOf));

  if (alerts.length === 0) {
    return 0;
  }

  const result = await client.alert.createMany({
    data: alerts,
    skipDuplicates: true
  });

  return result.count;
}

function newsAlertsForArticle(userId: string, article: NormalizedNewsArticle, asOf: Date) {
  const alerts: Array<Record<string, unknown>> = [];
  const baseMetadata = {
    articleId: article.id,
    assetId: article.assetId,
    symbol: article.symbol,
    newsTitle: article.title,
    url: article.url,
    sentiment: article.sentiment.label,
    sentimentScore: article.sentiment.score,
    significantEvents: article.sentiment.significantEvents,
    publishedAt: article.publishedAt.toISOString(),
    evaluatedAt: asOf.toISOString()
  };

  if (isStrongNegativeSentiment(article.sentiment)) {
    alerts.push({
      id: stableAlertId(userId, `news-negative-sentiment:${article.id}:${article.assetId}`),
      userId,
      type: "PORTFOLIO",
      channel: "IN_APP",
      severity: "CRITICAL",
      title: `Strong negative news sentiment for ${article.symbol ?? "a holding"}`,
      message: `${article.title} was classified as negative sentiment for a portfolio holding.`,
      metadata: {
        ruleId: "news-negative-sentiment",
        ...baseMetadata
      }
    });
  }

  if (isSignificantNewsEvent(article.sentiment)) {
    alerts.push({
      id: stableAlertId(userId, `news-significant-event:${article.id}:${article.assetId}`),
      userId,
      type: "PORTFOLIO",
      channel: "IN_APP",
      severity: article.sentiment.label === "NEGATIVE" ? "WARNING" : "INFO",
      title: `Significant news event for ${article.symbol ?? "a holding"}`,
      message: `${article.title} contains notable event terms: ${article.sentiment.significantEvents.join(", ")}.`,
      metadata: {
        ruleId: "news-significant-event",
        ...baseMetadata
      }
    });
  }

  return alerts;
}

function stableNewsArticleId(provider: string, sourceId: string) {
  return `news_${digest(`${provider}:${sourceId}`).slice(0, 24)}`;
}

function stableNewsLinkId(articleId: string, assetId: string) {
  return `news_link_${digest(`${articleId}:${assetId}`).slice(0, 24)}`;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
