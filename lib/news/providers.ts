import type { NewsAsset, NewsProvider, NewsProviderArticle } from "@/lib/news/types";

type NewsApiArticle = {
  source?: {
    name?: string;
  };
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
};

export class SymbolNewsProvider implements NewsProvider {
  name = "SYMBOL_NEWS";

  constructor(
    private readonly apiKey = process.env.NEWS_API_KEY,
    private readonly baseUrl = "https://newsapi.org/v2/everything"
  ) {}

  supports(asset: NewsAsset) {
    return Boolean(this.apiKey && asset.symbol && ["STOCK", "ETF", "CRYPTO"].includes(asset.type));
  }

  async fetchNews(asset: NewsAsset, context: { asOf: Date; fetch: typeof fetch }): Promise<NewsProviderArticle[]> {
    if (!this.apiKey || !asset.symbol) {
      return [];
    }

    const query = encodeURIComponent(`${asset.symbol} OR "${asset.name}"`);
    const url = `${this.baseUrl}?q=${query}&sortBy=publishedAt&pageSize=10&apiKey=${this.apiKey}`;
    const response = await context.fetch(url);

    if (!response.ok) {
      throw new Error(`News provider failed with ${response.status}.`);
    }

    const payload = await response.json() as { articles?: NewsApiArticle[] };

    return (payload.articles ?? [])
      .filter((article) => article.title && article.publishedAt)
      .map((article) => ({
        provider: this.name,
        sourceId: article.url,
        url: article.url,
        title: article.title ?? "Untitled news",
        summary: article.description,
        sourceName: article.source?.name,
        publishedAt: new Date(article.publishedAt ?? context.asOf),
        symbols: [asset.symbol].filter(Boolean) as string[],
        metadata: {
          fetchedBy: this.name
        }
      }));
  }
}

export class ManualNewsProvider implements NewsProvider {
  name = "MANUAL_NEWS";

  supports(asset: NewsAsset) {
    const metadata = metadataObject(asset.metadata);
    return Array.isArray(metadata.newsArticles);
  }

  async fetchNews(asset: NewsAsset, context: { asOf: Date }): Promise<NewsProviderArticle[]> {
    const metadata = metadataObject(asset.metadata);
    const articles = Array.isArray(metadata.newsArticles) ? metadata.newsArticles : [];

    return articles
      .filter((article): article is Record<string, unknown> => article !== null && typeof article === "object")
      .map((article, index) => ({
        provider: this.name,
        sourceId: typeof article.sourceId === "string" ? article.sourceId : `${asset.id}:${index}`,
        url: typeof article.url === "string" ? article.url : undefined,
        title: typeof article.title === "string" ? article.title : `${asset.name} news`,
        summary: typeof article.summary === "string" ? article.summary : undefined,
        sourceName: typeof article.sourceName === "string" ? article.sourceName : "Manual",
        publishedAt: typeof article.publishedAt === "string" ? new Date(article.publishedAt) : context.asOf,
        symbols: [asset.symbol].filter(Boolean) as string[],
        metadata: {
          fetchedBy: this.name
        }
      }));
  }
}

export function defaultNewsProviders(): NewsProvider[] {
  return [new ManualNewsProvider(), new SymbolNewsProvider()];
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
