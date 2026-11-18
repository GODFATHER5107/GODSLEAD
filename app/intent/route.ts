import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MARKETS = [
  { name: "United States", code: "US", aliases: ["united states", "usa", "u.s.", "america"] },
  { name: "Canada", code: "CA", aliases: ["canada"] },
  { name: "United Kingdom", code: "GB", aliases: ["united kingdom", "uk", "britain"] },
  { name: "Ireland", code: "IE", aliases: ["ireland"] },
  { name: "Malta", code: "MT", aliases: ["malta"] },
  { name: "Australia", code: "AU", aliases: ["australia"] },
  { name: "New Zealand", code: "NZ", aliases: ["new zealand"] },
  { name: "Fiji", code: "FJ", aliases: ["fiji"] },
  { name: "Papua New Guinea", code: "PG", aliases: ["papua new guinea"] },
  { name: "United Arab Emirates", code: "AE", aliases: ["united arab emirates", "uae", "dubai", "abu dhabi"] },
  { name: "India", code: "IN", aliases: ["india"] },
  { name: "Singapore", code: "SG", aliases: ["singapore"] },
  { name: "Philippines", code: "PH", aliases: ["philippines"] },
  { name: "Malaysia", code: "MY", aliases: ["malaysia"] },
  { name: "Jamaica", code: "JM", aliases: ["jamaica"] },
  { name: "Trinidad and Tobago", code: "TT", aliases: ["trinidad and tobago"] },
  { name: "Barbados", code: "BB", aliases: ["barbados"] },
  { name: "Bahamas", code: "BS", aliases: ["bahamas"] },
  { name: "Belize", code: "BZ", aliases: ["belize"] },
  { name: "Guyana", code: "GY", aliases: ["guyana"] },
] as const;

const SEARCH_TERMS = [
  '"looking for a developer"',
  '"looking for software developers"',
  '"need a development team"',
  '"looking for an agency" software',
  '"need an MVP developer"',
  '"seeking technical cofounder" development',
  '"hire a software development company"',
  '"looking for mobile app developers"',
  '"need help building a SaaS"',
  '"looking for web developers"',
];

const MINIMUM_BUDGET_USD = 5000;

type BuyerSignal = {
  id: string;
  title: string;
  organisation: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  country: string;
  countryCode: string;
  intentType: string;
  evidence: string;
  matchedTerms: string[];
  confidence: number;
  budget: number | null;
  budgetCurrency: string | null;
  budgetStatus: string;
  buyerStatus: string;
};

type AlgoliaHit = {
  objectID?: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  comment_text?: string;
  story_text?: string;
  author?: string;
  created_at?: string;
};

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function identifyCountry(text: string) {
  const normalised = ` ${text.toLowerCase()} `;

  for (const market of MARKETS) {
    const found = market.aliases.some(alias => {
      return normalised.includes(` ${alias} `);
    });

    if (found) {
      return {
        name: market.name,
        code: market.code,
      };
    }
  }

  return null;
}

function extractBudget(text: string) {
  const patterns = [
    /(?:USD|US\$|\$)\s?([\d,]+(?:\.\d+)?)\s?(k)?/i,
    /([\d,]+(?:\.\d+)?)\s?(k)?\s?(?:USD|US dollars)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    let amount = Number(match[1].replace(/,/g, ""));

    if (match[2]?.toLowerCase() === "k") {
      amount *= 1000;
    }

    if (Number.isFinite(amount)) {
      return {
        amount,
        currency: "USD",
      };
    }
  }

  return {
    amount: null,
    currency: null,
  };
}

function classifyRequirement(text: string) {
  const rules = [
    {
      type: "MVP_DEVELOPMENT",
      terms: ["mvp developer", "build an mvp", "mvp development"],
    },
    {
      type: "MOBILE_APP",
      terms: ["mobile app developer", "mobile application", "ios app", "android app"],
    },
    {
      type: "WEB_DEVELOPMENT",
      terms: ["web developer", "website development", "web application"],
    },
    {
      type: "AI_DEVELOPMENT",
      terms: ["ai development", "machine learning", "ai automation"],
    },
    {
      type: "SOFTWARE_DEVELOPMENT",
      terms: [
        "software developer",
        "software development company",
        "development team",
        "build a saas",
        "looking for a developer",
        "hire a developer",
      ],
    },
  ];

  const lower = text.toLowerCase();

  for (const rule of rules) {
    const matched = rule.terms.filter(term => lower.includes(term));

    if (matched.length > 0) {
      return {
        type: rule.type,
        matched,
      };
    }
  }

  return null;
}

async function searchSource(term: string): Promise<BuyerSignal[]> {
  const url = new URL(
    "https://hn.algolia.com/api/v1/search"
  );

  url.searchParams.set("query", term);
  url.searchParams.set("tags", "story,comment");
  url.searchParams.set("hitsPerPage", "50");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "GODSLEAD-InfoDart/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const hits: AlgoliaHit[] = data.hits || [];

    const signals: BuyerSignal[] = [];

    for (const hit of hits) {
      const title = cleanText(
        hit.title || hit.story_title || ""
      );

      const description = cleanText(
        hit.comment_text || hit.story_text || ""
      );

      const combined = `${title} ${description}`;

      if (!combined.trim()) continue;

      const requirement = classifyRequirement(combined);

      if (!requirement) continue;

      const country = identifyCountry(combined);

      // Never guess a buyer's country.
      if (!country) continue;

      const budget = extractBudget(combined);

      let buyerStatus = "POTENTIAL_BUYER";

      if (
        budget.amount !== null &&
        budget.amount < MINIMUM_BUDGET_USD
      ) {
        buyerStatus = "REJECTED";
      }

      if (
        budget.amount !== null &&
        budget.amount >= MINIMUM_BUDGET_USD
      ) {
        buyerStatus = "VERIFIED_BUYER";
      }

      const id = hit.objectID || "";

      if (!id) continue;

      const sourceUrl = `https://news.ycombinator.com/item?id=${id}`;

      const evidence = `${title}. ${description}`.slice(0, 1000);

      signals.push({
        id: `HN-${id}`,
        title: title || "Software development requirement",
        organisation: null,
        source: "Hacker News",
        sourceUrl,
        publishedAt: hit.created_at
          ? new Date(hit.created_at).toISOString()
          : null,
        country: country.name,
        countryCode: country.code,
        intentType: requirement.type,
        evidence,
        matchedTerms: requirement.matched,
        confidence: 60,
        budget: budget.amount,
        budgetCurrency: budget.currency,
        budgetStatus:
          budget.amount === null
            ? "UNKNOWN"
            : "STATED",
        buyerStatus,
      });
    }

    return signals;
  } catch (error) {
    console.error("GODSLEAD source error:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const requestedCountry = params.get("country")?.toUpperCase();
    const requestedType = params.get("type")?.toUpperCase();

    const allowedMarket = requestedCountry
      ? MARKETS.find(market => market.code === requestedCountry)
      : null;

    if (requestedCountry && !allowedMarket) {
      return NextResponse.json(
        {
          success: false,
          error: "Country is not permitted by GODSLEAD.",
          signals: [],
        },
        { status: 403 }
      );
    }

    const results = await Promise.all(
      SEARCH_TERMS.map(term => searchSource(term))
    );

    const unique = new Map<string, BuyerSignal>();

    for (const signal of results.flat()) {
      if (
        requestedCountry &&
        signal.countryCode !== requestedCountry
      ) {
        continue;
      }

      if (
        requestedType &&
        signal.intentType !== requestedType
      ) {
        continue;
      }

      if (!unique.has(signal.id)) {
        unique.set(signal.id, signal);
      }
    }

    const signals = [...unique.values()].filter(
      signal => signal.buyerStatus !== "REJECTED"
    );

    return NextResponse.json({
      success: true,
      product: "GODSLEAD",
      engine: "PRIVATE BUYER DISCOVERY",
      version: "2.0.0",
      source: "Hacker News Algolia Public API",
      searchedMarkets: requestedCountry
        ? [allowedMarket!.name]
        : MARKETS.map(market => market.name),
      totalSignals: signals.length,
      minimumBudgetUSD: MINIMUM_BUDGET_USD,
      signals,
      note:
        "These are preliminary public buying signals. Country and budget information require independent verification. A stated budget alone does not establish a verified buyer.",
    });
  } catch (error) {
    console.error("GODSLEAD API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Buyer discovery could not be completed.",
        signals: [],
      },
      { status: 500 }
    );
  }
}
