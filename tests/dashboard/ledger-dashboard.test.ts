import { describe, expect, it } from "vitest";
import {
  buildLedgerDashboardData,
  type DashboardPrismaClient
} from "@/lib/dashboard/ledger-dashboard";

const asOf = new Date("2026-06-16T00:00:00.000Z");

type TestAsset = {
  id: string;
  name: string;
  symbol: string;
  type: string;
  category: {
    kind: string;
  };
  priceSnapshots: Array<{
    priceMinor: bigint;
    currency: string;
    asOf: Date;
    fetchedAt: Date;
  }>;
};

describe("ledger dashboard data", () => {
  it("returns a zero-state response for empty databases", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient(),
      asOf
    });

    expect(dashboard.accounts).toEqual([]);
    expect(dashboard.holdings).toEqual([]);
    expect(dashboard.netWorth.totalAssetsMinor).toBe(0);
    expect(dashboard.netWorth.totalLiabilitiesMinor).toBe(0);
    expect(dashboard.netWorth.netWorthMinor).toBe(0);
    expect(dashboard.netWorth.assetAllocation).toEqual([]);
    expect(dashboard.netWorthTrend).toEqual([]);
    expect(dashboard.monthlyInvestmentProgress).toEqual({
      plannedMinor: 0,
      actualMinor: 0,
      progressPercent: 0
    });
  });

  it("derives holdings and dashboard metrics for a single account", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            id: "account-zerodha",
            name: "Zerodha Kite",
            provider: "ZERODHA_KITE",
            transactions: [
              transaction({
                id: "buy-1",
                accountId: "account-zerodha",
                asset: equityAsset(),
                type: "BUY",
                quantity: "10",
                priceMinor: 10000n,
                amountMinor: 100000n,
                tradeDate: new Date("2026-06-01T00:00:00.000Z")
              }),
              transaction({
                id: "sell-1",
                accountId: "account-zerodha",
                asset: equityAsset(),
                type: "SELL",
                quantity: "4",
                priceMinor: 15000n,
                amountMinor: 60000n,
                tradeDate: new Date("2026-06-10T00:00:00.000Z")
              })
            ]
          })
        ],
        goals: [
          {
            id: "goal-1",
            name: "Emergency Fund",
            type: "EMERGENCY_FUND",
            targetAmountMinor: 200000n,
            currentAmountMinor: 100000n,
            monthlyFundingMinor: 50000n,
            targetDate: new Date("2026-12-31T00:00:00.000Z"),
            priority: "CRITICAL"
          }
        ]
      }),
      asOf
    });

    expect(dashboard.accounts).toEqual([
      { id: "account-zerodha", name: "Zerodha Kite", provider: "Zerodha Kite" }
    ]);
    expect(dashboard.holdings).toHaveLength(1);
    expect(dashboard.holdings[0]).toMatchObject({
      accountName: "Zerodha Kite",
      assetName: "Nippon India ETF Nifty BeES",
      quantity: 6,
      averageCostMinor: 10000,
      costBasisMinor: 60000,
      currentPriceMinor: 15000,
      currentValueMinor: 90000
    });
    expect(dashboard.netWorth.totalAssetsMinor).toBe(90000);
    expect(dashboard.netWorth.holdings[0].gainLossMinor).toBe(30000);
    expect(dashboard.monthlyInvestmentProgress).toEqual({
      plannedMinor: 50000,
      actualMinor: 100000,
      progressPercent: 200
    });
  });

  it("supports multiple brokers without mixing account-level holdings", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            id: "account-zerodha",
            name: "Zerodha Kite",
            provider: "ZERODHA_KITE",
            transactions: [
              transaction({
                id: "buy-equity",
                accountId: "account-zerodha",
                asset: equityAsset(),
                type: "BUY",
                quantity: "10",
                priceMinor: 10000n,
                amountMinor: 100000n
              })
            ]
          }),
          account({
            id: "account-coindcx",
            name: "CoinDCX",
            provider: "COINDCX",
            transactions: [
              transaction({
                id: "buy-crypto",
                accountId: "account-coindcx",
                asset: cryptoAsset(),
                type: "BUY",
                quantity: "2",
                priceMinor: 50000n,
                amountMinor: 100000n
              })
            ]
          })
        ]
      }),
      asOf
    });

    expect(dashboard.accounts.map((item) => item.provider)).toEqual(["CoinDCX", "Zerodha Kite"]);
    expect(dashboard.holdings).toHaveLength(2);
    expect(dashboard.holdings.map((item) => `${item.accountName}:${item.assetClass}`).sort()).toEqual([
      "CoinDCX:Crypto",
      "Zerodha Kite:Equity"
    ]);
  });

  it("calculates allocation across multiple asset classes", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            transactions: [
              transaction({
                id: "buy-equity",
                asset: equityAsset(),
                type: "BUY",
                quantity: "10",
                priceMinor: 10000n,
                amountMinor: 100000n
              }),
              transaction({
                id: "buy-gold",
                asset: goldAsset(),
                type: "BUY",
                quantity: "5",
                priceMinor: 10000n,
                amountMinor: 50000n
              }),
              transaction({
                id: "buy-crypto",
                asset: cryptoAsset(),
                type: "BUY",
                quantity: "1",
                priceMinor: 50000n,
                amountMinor: 50000n
              })
            ]
          })
        ]
      }),
      asOf
    });

    expect(dashboard.netWorth.totalAssetsMinor).toBe(200000);
    expect(dashboard.netWorth.assetAllocation).toEqual([
      { assetClass: "Equity", valueMinor: 100000, allocationPercent: 50 },
      { assetClass: "Crypto", valueMinor: 50000, allocationPercent: 25 },
      { assetClass: "Gold", valueMinor: 50000, allocationPercent: 25 }
    ]);
  });

  it("uses latest price snapshots for valuation without changing derived cost basis", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            transactions: [
              transaction({
                id: "buy-equity",
                asset: {
                  ...equityAsset(),
                  priceSnapshots: [
                    {
                      priceMinor: 30000n,
                      currency: "INR",
                      asOf: new Date("2026-06-16T00:00:00.000Z"),
                      fetchedAt: new Date("2026-06-16T00:00:00.000Z")
                    }
                  ]
                },
                type: "BUY",
                quantity: "10",
                priceMinor: 10000n,
                amountMinor: 100000n
              })
            ]
          })
        ]
      }),
      asOf
    });

    expect(dashboard.holdings[0]).toMatchObject({
      quantity: 10,
      averageCostMinor: 10000,
      costBasisMinor: 100000,
      currentPriceMinor: 30000,
      currentValueMinor: 300000
    });
    expect(dashboard.netWorth.totalAssetsMinor).toBe(300000);
    expect(dashboard.netWorth.holdings[0].gainLossMinor).toBe(200000);
  });

  it("handles portfolios with no liabilities", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            transactions: [
              transaction({
                id: "buy-equity",
                asset: equityAsset(),
                type: "BUY",
                quantity: "4",
                priceMinor: 25000n,
                amountMinor: 100000n
              })
            ]
          })
        ]
      }),
      asOf
    });

    expect(dashboard.liabilities).toEqual([]);
    expect(dashboard.netWorth.totalLiabilitiesMinor).toBe(0);
    expect(dashboard.netWorth.netWorthMinor).toBe(100000);
  });

  it("subtracts mixed liabilities from net worth", async () => {
    const dashboard = await buildLedgerDashboardData({
      userId: "user-1",
      client: fakeDashboardClient({
        accounts: [
          account({
            transactions: [
              transaction({
                id: "buy-equity",
                asset: equityAsset(),
                type: "BUY",
                quantity: "10",
                priceMinor: 20000n,
                amountMinor: 200000n
              })
            ]
          })
        ],
        liabilities: [
          {
            id: "loan-1",
            name: "Home Loan",
            type: "HOME_LOAN",
            outstandingMinor: 70000n,
            emiMinor: 5000n,
            interestRate: 0.085,
            currency: "INR"
          },
          {
            id: "card-1",
            name: "Credit Card",
            type: "CREDIT_CARD",
            outstandingMinor: 10000n,
            emiMinor: null,
            interestRate: null,
            currency: "INR"
          }
        ]
      }),
      asOf
    });

    expect(dashboard.liabilities.map((liability) => liability.type)).toEqual(["Credit Card", "Loan"]);
    expect(dashboard.netWorth.totalAssetsMinor).toBe(200000);
    expect(dashboard.netWorth.totalLiabilitiesMinor).toBe(80000);
    expect(dashboard.netWorth.netWorthMinor).toBe(120000);
  });
});

function fakeDashboardClient(data: {
  accounts?: unknown[];
  liabilities?: unknown[];
  goals?: unknown[];
  retirementProfile?: unknown | null;
  snapshots?: unknown[];
  activities?: unknown[];
  alerts?: unknown[];
  insights?: unknown[];
} = {}): DashboardPrismaClient {
  return {
    account: {
      findMany: async () => data.accounts ?? []
    },
    liability: {
      findMany: async () => data.liabilities ?? []
    },
    goal: {
      findMany: async () => data.goals ?? []
    },
    retirementProfile: {
      findFirst: async () => data.retirementProfile ?? null
    },
    netWorthSnapshot: {
      findMany: async () => data.snapshots ?? []
    },
    activityLog: {
      findMany: async () => data.activities ?? []
    },
    alert: {
      findMany: async () => data.alerts ?? []
    },
    aiInsight: {
      findMany: async () => data.insights ?? []
    }
  } as DashboardPrismaClient;
}

function account(input: {
  id?: string;
  name?: string;
  provider?: string;
  transactions?: unknown[];
} = {}) {
  return {
    id: input.id ?? "account-1",
    name: input.name ?? "Broker",
    provider: input.provider ?? "MANUAL",
    transactions: input.transactions ?? []
  };
}

function transaction(input: {
  id: string;
  accountId?: string;
  asset: TestAsset;
  type: string;
  quantity: string;
  priceMinor: bigint;
  amountMinor: bigint;
  tradeDate?: Date;
}) {
  return {
    id: input.id,
    accountId: input.accountId ?? "account-1",
    assetId: input.asset.id,
    type: input.type,
    tradeDate: input.tradeDate ?? new Date("2026-06-01T00:00:00.000Z"),
    quantity: input.quantity,
    priceMinor: input.priceMinor,
    amountMinor: input.amountMinor,
    feesMinor: 0n,
    taxesMinor: 0n,
    currency: "INR",
    asset: input.asset
  };
}

function equityAsset(): TestAsset {
  return {
    id: "asset-equity",
    name: "Nippon India ETF Nifty BeES",
    symbol: "NIFTYBEES",
    type: "ETF",
    category: {
      kind: "EQUITY"
    },
    priceSnapshots: []
  };
}

function goldAsset(): TestAsset {
  return {
    id: "asset-gold",
    name: "Digital Gold",
    symbol: "GOLD",
    type: "GOLD",
    category: {
      kind: "GOLD"
    },
    priceSnapshots: []
  };
}

function cryptoAsset(): TestAsset {
  return {
    id: "asset-crypto",
    name: "Bitcoin",
    symbol: "BTC",
    type: "CRYPTO",
    category: {
      kind: "CRYPTO"
    },
    priceSnapshots: []
  };
}
