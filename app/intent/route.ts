import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MINIMUM_BUDGET_USD = 5000;

const MARKETS = [
  { name: "United States", code: "US", aliases: ["united states", "usa"] },
  { name: "Canada", code: "CA", aliases: ["canada"] },
  { name: "United Kingdom", code: "GB", aliases: ["united kingdom", "uk"] },
  { name: "Ireland", code: "IE", aliases: ["ireland"] },
  { name: "Malta", code: "MT", aliases: ["malta"] },
  { name: "Australia", code: "AU", aliases: ["australia"] },
  { name: "New Zealand", code: "NZ", aliases: ["new zealand"] },
  { name: "Fiji", code: "FJ", aliases: ["fiji"] },
  { name: "Papua New Guinea", code: "PG", aliases: ["papua new guinea"] },
  { name: "United Arab Emirates", code: "AE", aliases: ["uae", "dubai"] },
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
  '"looking to hire" "software developer"',
  '"looking for a software development agency"',
  '"need a development agency"',
  '"seeking a software development company"',
  '"looking for an MVP development partner"',
  '"need an MVP development team"',
  '"looking to hire" "app developers"',
  '"seeking mobile app development company"',
  '"need a company to build" software',
  '"looking for an AI development agency"',
  '"looking for outsourced software development"',
  '"requesting proposals" software development',
];

const BUYING_PHRASES = [
  "looking to hire",
  "looking for a software development agency",
  "need a development agency",
  "seeking a software development company",
  "looking for an mvp development partner",
  "need an mvp development team",
  "looking to hire",
  "seeking mobile app development company",
  "need a company to build",
  "looking for an ai development agency",
  "looking for outsourced software development",
  "requesting proposals",
  "seeking developers for our project",
  "looking for a development partner",
];

const EXCLUDED_PHRASES = [
  "looking for a job",
  "seeking employment",
  "job seeker",
  "resume",
  "cv ",
  "my portfolio",
  "learn programming",
  "tutorial",
  "how to code",
  "programming discussion",
  "open source project",
  "technical interview",
  "salary",
  "internship",
  "hiring software engineer",
  "we are hiring developers",
];

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
  const lower = text.toLowerCase();

  for (const market of MARKETS) {
    if (market.aliases.some(alias => lower.includes(alias))) {
      return market;
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
      return { amount, currency: "USD" };
    }
  }

  return { amount: null, currency: null };
}

function classifyRequirement(text: string) {
  const lower = text.toLowerCase();

  if (EXCLUDED_PHRASES.some(term => lower.includes(term))) {
    return null;
  }

  const matched = BUYING_PHRASES.filter(term =>
    lower.includes(term)
  );

  if (matched.length === 0) {
    return null;
  }

  let type = "SOFTWARE_DEVELOPMENT";

  if (/mvp|startup product/.test(lower)) {
    type = "MVP_DEVELOPMENT";
  } else if (/mobile app|ios app|android app/.test(lower)) {
    type = "MOBILE_APP";
  } else if (/artificial intelligence|ai development/.test(lower)) {
    type = "AI_DEVELOPMENT";
  } else if (/website|web application/.test(lower)) {
    type = "WEB_DEVELOPMENT";
  }

  return { type, matched };
}

async function searchHackerNews(term: string): Promise<Signal[]> {
  const url = new URL("https://hn.algolia.com/api/v1/search");

  url.searchParams.set("query", term);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "30");

  const sixMonthsAgo =
    Math.floor(Date.now() / 1000) - 180 * 24 * 60 * 60;

  url.searchParams.set(
    "numericFilters",
    `created_at_i>${sixMonthsAgo}`
  );

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const signals: Signal[] = [];

    for (const hit of data.hits || []) {
      const title = cleanText(hit.title || "");
      const description = cleanText(hit.story_text || "");
      const combined = `${title} ${description}`;

      const requirement = classifyRequirement(combined);

      if (!requirement || !hit.objectID) continue;

      const country = identifyCountry(combined);
      const budget = extractBudget(combined);

      if (
        budget.amount !== null &&
        budget.amount < MINIMUM_BUDGET_USD
      ) {
        continue;
      }

      signals.push({
        id: `HN-${hit.objectID}`,
        title,
        organisation: null,
        source: "Hacker News",
        sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        publishedAt: hit.created_at
          ? new Date(hit.created_at).toISOString()
          : null,
        country: country?.name || "Location not identified",
        countryCode: country?.code || "UNKNOWN",
        locationVerified: Boolean(country),
        intentType: requirement.type,
        evidence: combined.slice(0, 1000),
        matchedTerms: requirement.matched,
        confidence: 60,
        budget: budget.amount,
        budgetCurrency: budget.currency,
        budgetStatus: budget.amount === null ? "UNKNOWN" : "STATED",
        buyerStatus: "POTENTIAL_BUYER",
      });
    }

    return signals;
  } catch (error) {
    console.error("Hacker News search error:", error);
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
        { success: false, error: "Country not permitted.", signals: [] },
        { status: 403 }
      );
    }

    const results = await Promise.all(
      SEARCH_TERMS.map(searchHackerNews)
    );

    const unique = new Map<string, Signal>();

    for (const signal of results.flat()) {
      if (
        requestedCountry &&
        signal.locationVerified &&
        signal.countryCode !== requestedCountry
      ) {
        continue;
      }

      if (requestedType && signal.intentType !== requestedType) {
        continue;
      }

      if (!unique.has(signal.id)) {
        unique.set(signal.id, signal);
      }
    }

    const signals = [...unique.values()].sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
    );

    return NextResponse.json({
      success: true,
      product: "GODSLEAD",
      engine: "EXPLICIT BUYING INTENT",
      version: "4.0.0",
      source: "Hacker News Public API",
      totalSignals: signals.length,
      minimumBudgetUSD: MINIMUM_BUDGET_USD,
      requestedCountry: requestedCountry || "ALL APPROVED MARKETS",
      signals,
      note:
        "Only explicit hiring or agency-seeking phrases are considered. Results remain preliminary until the buyer, requirement, geography and budget are independently verified.",
    });
  } catch (error) {
    console.error("GODSLEAD ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Buyer discovery failed.",
        signals: [],
      },
      { status: 500 }
    );
  }
}
