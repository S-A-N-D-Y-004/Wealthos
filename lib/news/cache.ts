import type { NewsProviderArticle } from "@/lib/news/types";

export class NewsArticleCache {
  private readonly articles = new Map<string, { fetchedAt: Date; articles: NewsProviderArticle[] }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, asOf: Date) {
    const cached = this.articles.get(key);

    if (!cached) {
      return undefined;
    }

    if (asOf.getTime() - cached.fetchedAt.getTime() > this.ttlMs) {
      return undefined;
    }

    return cached.articles;
  }

  set(key: string, asOf: Date, articles: NewsProviderArticle[]) {
    this.articles.set(key, {
      fetchedAt: asOf,
      articles
    });
  }
}
