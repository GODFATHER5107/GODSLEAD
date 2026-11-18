import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MINIMUM_BUDGET_USD = 5000;

const MARKETS = [
  { name: "United States", code: "US", aliases: ["united states", "usa"] },
  { name: "Canada", code: "CA", aliases: ["canada"] },
  { name: "United Kingdom", code: "GB", aliases: ["united kingdom", "uk", "britain"] },
  { name: "Ireland", code: "IE", aliases: ["ireland"] },
  { name: "Malta", code: "MT", aliases: ["malta"] },
  { name: "Australia", code: "AU", aliases: ["australia"] },
  { name: "New Zealand", code: "NZ", aliases: ["new zealand"] },
  { name: "Fiji", code: "FJ", aliases: ["fiji"] },
  { name: "Papua New Guinea", code: "PG", aliases: ["papua new guinea"] },
  { name: "United Arab Emirates", code: "AE", aliases: ["united arab emirates", "uae", "dubai"] },
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
  "looking for software developer",
  "need software development agency",
  "looking for development team",
  "need MVP development",
  "looking for mobile app developer",
  "need web application development",
  "looking for SaaS developer",
  "seeking software development partner",
  "need AI development company",
  "looking for freelance developer",
  "hire software development company",
  "need custom software",
];

type Market = (typeof MARKETS)[number];

type Signal = {
  id: string;
  title: string;
  organisation: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  country: string;
  countryCode: string;
  locationVerified: boolean;
  intentType: string;
  evidence: string;
  matchedTerms: string[];
  confidence: number;
  budget: number | null;
  budgetCurrency: string | null;
  budgetStatus: string;
  buyerStatus: string;
};

type HNHit = {
  objectID?: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  comment_text?: string;
  story_text?: string;
  author?: string;
  created_at?: string;
  created_at_i?: number;
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

function identifyCountry(text: string): Market | null {
  const lower = text.toLowerCase();

  for (const market of MARKETS) {
    if (
      market.aliases.some(alias =>
        lower.includes(alias)
      )
    ) {
      return market;
    }
  }

  return null;
}

function classifyRequirement(text: string) {
  const lower = text.toLowerCase();

  const groups = [
    {
      type: "MVP_DEVELOPMENT",
      terms: [
        "looking for mvp developer",
        "need an mvp",
        "build an mvp",
        "mvp development",
        "build my startup",
      ],
    },
    {
      type: "MOBILE_APP",
      terms: [
        "mobile app developer",
        "mobile application development",
        "ios app developer",
        "android app developer",
      ],
    },
    {
      type: "AI_DEVELOPMENT",
      terms: [
        "ai development company",
        "ai developer",
        "machine learning developer",
        "ai automation",
      ],
    },
    {
      type: "WEB_DEVELOPMENT",
      terms: [
        "website development",
        "web application development",
        "web developer",
        "build a website",
      ],
    },
    {
      type: "SOFTWARE_DEVELOPMENT",
      terms: [
        "software developer",
        "software development company",
        "development agency",
        "development team",
        "custom software",
        "software development partner",
        "looking for a developer",
        "need a developer",
        "hire developers",
        "build a saas",
      ],
    },
  ];

  for (const group of groups) {
    const matched = group.terms.filter(term =>
      lower.includes(term)
    );

    if (matched.length > 0) {
      return {
        type: group.type,
        matched,
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

function extractOrganisation(text: string): string | null {
  const match = text.match(
    /(?:company|startup|business)\s+(?:called|named)\s+([A-Z][A-Za-z0-9&.-]+)/i
  );

  return match?.[1] || null;
}

async function searchHackerNews(
  term: string
): Promise<Signal[]> {
  const url = new URL(
    "https://hn.algolia.com/api/v1/search"
  );

  url.searchParams.set("query", term);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "30");

  // Only search recent public discussions.
  const sixMonthsAgo =
    Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;

  url.searchParams.set(
    "numericFilters",
    `created_at_i>${sixMonthsAgo}`
  );

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error("Hacker News returned:", response.status);
      return [];
    }

    const data = await response.json();
    const hits: HNHit[] = data.hits || [];

    const signals: Signal[] = [];

    for (const hit of hits) {
      const title = cleanText(
        hit.title || hit.story_title || ""
      );

      const description = cleanText(
        hit.story_text || ""
      );

      const combined = `${title} ${description}`;

      if (!combined.trim()) continue;

      const requirement = classifyRequirement(combined);

      if (!requirement) continue;

      const identifiedCountry = identifyCountry(combined);

      const budget = extractBudget(combined);

      // A stated budget below $5,000 is rejected.
      if (
        budget.amount !== null &&
        budget.amount < MINIMUM_BUDGET_USD
      ) {
        continue;
      }

      const id = hit.objectID;

      if (!id) continue;

      const publishedAt = hit.created_at
        ? new Date(hit.created_at).toISOString()
        : null;

      signals.push({
        id: `HN-${id}`,
        title,
        organisation: extractOrganisation(combined),
        source: "Hacker News",
        sourceUrl: `https://news.ycombinator.com/item?id=${id}`,
        publishedAt,

        country:
          identifiedCountry?.name || "Location not identified",

        countryCode:
          identifiedCountry?.code || "UNKNOWN",

        locationVerified: Boolean(identifiedCountry),

        intentType: requirement.type,

        evidence: combined.slice(0, 1000),

        matchedTerms: requirement.matched,

        confidence: 60,

        budget: budget.amount,
        budgetCurrency: budget.currency,

        budgetStatus:
          budget.amount === null ? "UNKNOWN" : "STATED",

        // Public discussions are not independently verified buyers.
        buyerStatus: "POTENTIAL_BUYER",
      });
    }

    return signals;
  } catch (error) {
    console.error("Hacker News search failed:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const requestedCountry =
      params.get("country")?.toUpperCase();

    const requestedType =
      params.get("type")?.toUpperCase();

    const allowedMarket = requestedCountry
      ? MARKETS.find(
          market => market.code === requestedCountry
        )
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

    // Search all terms concurrently.
    const results = await Promise.all(
      SEARCH_TERMS.map(searchHackerNews)
    );

    const unique = new Map<string, Signal>();

    for (const signal of results.flat()) {
      // Do not falsely assign an unknown location
      // to the selected country.
      if (
        requestedCountry &&
        signal.locationVerified &&
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

    const signals = [...unique.values()].sort(
      (a, b) => {
        return (
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
        );
      }
    );

    return NextResponse.json({
      success: true,

      product: "GODSLEAD",

      engine: "PRIVATE BUYER DISCOVERY",

      version: "3.0.0",

      source: "Hacker News Public Search API",

      totalSignals: signals.length,

      minimumBudgetUSD: MINIMUM_BUDGET_USD,

      requestedCountry:
        requestedCountry || "ALL APPROVED MARKETS",

      signals,

      note:
        "These are preliminary public project signals, not verified buyers. Unknown locations are not assigned to a selected country. Budget and buyer identity must be independently confirmed. Hacker News is one discovery source, not a complete global buyer database.",
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
