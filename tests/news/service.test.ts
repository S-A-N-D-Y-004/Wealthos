import { describe, expect, it } from "vitest";
import {
  refreshNewsForUser,
  type NewsAsset,
  type NewsPrismaClient,
  type NewsProvider,
  type NewsProviderArticle,
  type PersistedNewsArticle
} from "@/lib/news";
import { refreshNewsJob } from "@/trigger/jobs/news";

const asOf = new Date("2026-06-25T00:00:00.000Z");

describe("news refresh service", () => {
  it("persists fetched articles, links them to holdings, and creates sentiment alerts", async () => {
    const client = new FakeNewsClient({
      assets: [stockAsset()]
    });
    const provider = fakeProvider([
      {
        provider: "TEST_NEWS",
        sourceId: "article-1",
        url: "https://example.com/article-1",
        title: "Nifty BeES faces regulatory investigation and penalty",
        summary: "The ETF sponsor disclosed a probe.",
        sourceName: "Example News",
        publishedAt: asOf,
        symbols: ["NIFTYBEES"]
      }
    ]);

    const result = await refreshNewsForUser({
      userId: "user-1",
      client,
      providers: [provider],
      asOf,
      rateLimitMs: 0
    });

    expect(result).toMatchObject({
      assetsScanned: 1,
      fetched: 1,
      failed: 0,
      articlesPersisted: 1,
      linksPersisted: 1,
      alertsPersisted: 2
    });
    expect(client.articles[0]).toMatchObject({
      title: "Nifty BeES faces regulatory investigation and penalty",
      sentiment: "NEGATIVE",
      sentimentScore: -1
    });
    expect(client.links[0]).toMatchObject({
      assetId: "asset-stock",
      symbol: "NIFTYBEES"
    });
    expect(client.alerts.map((alert) => metadata(alert).ruleId).sort()).toEqual([
      "news-negative-sentiment",
      "news-significant-event"
    ]);
    expect(client.alerts.every((alert) => !/buy|sell|target price/i.test(String(alert.message)))).toBe(true);
  });

  it("prevents duplicate articles, links, and alerts across refreshes", async () => {
    const client = new FakeNewsClient({
      assets: [cryptoAsset()]
    });
    const provider = fakeProvider([
      {
        provider: "TEST_NEWS",
        sourceId: "btc-1",
        title: "Bitcoin exchange hack triggers investigation",
        publishedAt: asOf,
        symbols: ["BTC"]
      }
    ]);

    const first = await refreshNewsForUser({
      userId: "user-1",
      client,
      providers: [provider],
      asOf,
      rateLimitMs: 0
    });
    const second = await refreshNewsForUser({
      userId: "user-1",
      client,
      providers: [provider],
      asOf,
      rateLimitMs: 0
    });

    expect(first.articlesPersisted).toBe(1);
    expect(second.articlesPersisted).toBe(0);
    expect(second.linksPersisted).toBe(0);
    expect(second.alertsPersisted).toBe(0);
    expect(client.articles).toHaveLength(1);
    expect(client.alerts).toHaveLength(2);
  });

  it("uses the in-run cache for duplicate provider requests", async () => {
    let calls = 0;
    const client = new FakeNewsClient({
      assets: [stockAsset()]
    });
    const provider = fakeProvider([
      {
        provider: "TEST_NEWS",
        sourceId: "article-cache",
        title: "Nifty BeES publishes neutral update",
        publishedAt: asOf,
        symbols: ["NIFTYBEES"]
      }
    ], () => {
      calls += 1;
    });

    const result = await refreshNewsForUser({
      userId: "user-1",
      client,
      providers: [provider, provider],
      asOf,
      rateLimitMs: 0
    });

    expect(calls).toBe(1);
    expect(result.fetched).toBe(1);
    expect(result.cached).toBe(1);
    expect(client.articles).toHaveLength(1);
  });

  it("handles provider failures and empty portfolios gracefully", async () => {
    const empty = new FakeNewsClient();
    const emptyResult = await refreshNewsForUser({
      userId: "user-1",
      client: empty,
      providers: [failingProvider()],
      asOf,
      rateLimitMs: 0
    });

    expect(emptyResult.assetsScanned).toBe(0);
    expect(emptyResult.failed).toBe(0);
    expect(empty.alerts).toEqual([]);

    const client = new FakeNewsClient({
      assets: [stockAsset()]
    });
    const failed = await refreshNewsForUser({
      userId: "user-1",
      client,
      providers: [failingProvider()],
      asOf,
      rateLimitMs: 0
    });

    expect(failed.failed).toBe(1);
    expect(failed.results[0]).toMatchObject({
      status: "failed",
      error: "provider unavailable"
    });
    expect(client.articles).toEqual([]);
  });

  it("wires the scheduled news job to the refresh service", async () => {
    const client = new FakeNewsClient({
      assets: [stockAsset()]
    });
    const result = await refreshNewsJob(
      {
        userId: "user-1",
        asOf,
        rateLimitMs: 0
      },
      client,
      [
        fakeProvider([
          {
            provider: "TEST_NEWS",
            sourceId: "job-article",
            title: "Nifty BeES earnings update",
            publishedAt: asOf,
            symbols: ["NIFTYBEES"]
          }
        ])
      ]
    );

    expect(result.articlesPersisted).toBe(1);
    expect(client.links).toHaveLength(1);
  });
});

class FakeNewsClient implements NewsPrismaClient {
  articles: Array<PersistedNewsArticle & { provider: string; sourceId?: string | null }> = [];
  links: Array<Record<string, unknown>> = [];
  alerts: Array<Record<string, unknown>> = [];

  constructor(private readonly data: { assets?: NewsAsset[] } = {}) {}

  asset = {
    findMany: async () => this.data.assets ?? []
  };

  newsArticle = {
    createMany: async (args: unknown) => {
      const rows = (args as { data: Array<Record<string, unknown>> }).data;
      let count = 0;

      for (const row of rows) {
        if (this.articles.some((article) => article.id === row.id)) {
          continue;
        }

        this.articles.push(row as PersistedNewsArticle & { provider: string; sourceId?: string | null });
        count += 1;
      }

      return { count };
    },
    findMany: async () => this.articles
  };

  newsArticleAsset = {
    createMany: async (args: unknown) => {
      const rows = (args as { data: Array<Record<string, unknown>> }).data;
      let count = 0;

      for (const row of rows) {
        const duplicate = this.links.some(
          (link) => link.articleId === row.articleId && link.assetId === row.assetId
        );

        if (!duplicate) {
          this.links.push(row);
          count += 1;
        }
      }

      return { count };
    }
  };

  alert = {
    createMany: async (args: unknown) => {
      const rows = (args as { data: Array<Record<string, unknown>> }).data;
      let count = 0;

      for (const row of rows) {
        if (this.alerts.some((alert) => alert.id === row.id)) {
          continue;
        }

        this.alerts.push(row);
        count += 1;
      }

      return { count };
    }
  };
}

function fakeProvider(articles: NewsProviderArticle[], onCall?: () => void): NewsProvider {
  return {
    name: "TEST_NEWS",
    supports: (asset) => ["STOCK", "ETF", "CRYPTO"].includes(asset.type),
    async fetchNews() {
      onCall?.();
      return articles;
    }
  };
}

function failingProvider(): NewsProvider {
  return {
    name: "FAIL_NEWS",
    supports: () => true,
    async fetchNews() {
      throw new Error("provider unavailable");
    }
  };
}

function stockAsset(): NewsAsset {
  return {
    id: "asset-stock",
    name: "Nifty BeES",
    symbol: "NIFTYBEES",
    type: "ETF",
    currency: "INR"
  };
}

function cryptoAsset(): NewsAsset {
  return {
    id: "asset-crypto",
    name: "Bitcoin",
    symbol: "BTC",
    type: "CRYPTO",
    currency: "INR"
  };
}

function metadata(row: Record<string, unknown>) {
  return row.metadata as Record<string, unknown>;
}
