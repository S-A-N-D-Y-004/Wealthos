export type NewsSentimentLabel = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type NewsAsset = {
  id: string;
  name: string;
  symbol?: string | null;
  type: string;
  currency?: string;
  metadata?: unknown;
};

export type NewsProviderArticle = {
  provider: string;
  sourceId?: string;
  url?: string;
  title: string;
  summary?: string;
  sourceName?: string;
  publishedAt: Date;
  symbols?: string[];
  metadata?: Record<string, unknown>;
};

export type PersistedNewsArticle = {
  id: string;
  provider: string;
  sourceId?: string | null;
  url?: string | null;
  title: string;
  summary?: string | null;
  sourceName?: string | null;
  publishedAt: Date;
  sentiment: NewsSentimentLabel | string;
  sentimentScore: number | bigint | unknown;
  metadata?: unknown;
  assets?: Array<{
    assetId: string;
    symbol?: string | null;
    asset?: {
      id: string;
      name: string;
      symbol?: string | null;
      type: string;
    };
  }>;
  createdAt?: Date;
};

export type NewsSentimentResult = {
  label: NewsSentimentLabel;
  score: number;
  positiveMatches: string[];
  negativeMatches: string[];
  significantEvents: string[];
};

export type NewsProviderContext = {
  asOf: Date;
  fetch: typeof fetch;
};

export type NewsProvider = {
  name: string;
  supports(asset: NewsAsset): boolean;
  fetchNews(asset: NewsAsset, context: NewsProviderContext): Promise<NewsProviderArticle[]>;
};

export type NewsRefreshStatus = "fetched" | "cached" | "failed" | "unsupported";

export type NewsRefreshAssetResult = {
  assetId: string;
  symbol?: string;
  provider?: string;
  status: NewsRefreshStatus;
  articles: NewsProviderArticle[];
  error?: string;
};
