import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MARKETS = [
  { name: "United States", code: "US", locale: "US:en" },
  { name: "Canada", code: "CA", locale: "CA:en" },
  { name: "United Kingdom", code: "GB", locale: "GB:en" },
  { name: "Ireland", code: "IE", locale: "IE:en" },
  { name: "Malta", code: "MT", locale: "MT:en" },
  { name: "Australia", code: "AU", locale: "AU:en" },
  { name: "New Zealand", code: "NZ", locale: "NZ:en" },
  { name: "Fiji", code: "FJ", locale: "FJ:en" },
  { name: "Papua New Guinea", code: "PG", locale: "PG:en" },
  { name: "United Arab Emirates", code: "AE", locale: "AE:en" },
  { name: "India", code: "IN", locale: "IN:en" },
  { name: "Singapore", code: "SG", locale: "SG:en" },
  { name: "Philippines", code: "PH", locale: "PH:en" },
  { name: "Malaysia", code: "MY", locale: "MY:en" },
  { name: "Jamaica", code: "JM", locale: "JM:en" },
  { name: "Trinidad and Tobago", code: "TT", locale: "TT:en" },
  { name: "Barbados", code: "BB", locale: "BB:en" },
  { name: "Bahamas", code: "BS", locale: "BS:en" },
  { name: "Belize", code: "BZ", locale: "BZ:en" },
  { name: "Guyana", code: "GY", locale: "GY:en" }
] as const;

const SEARCH_TERMS = [
  '"request for proposal" software development',
  '"software development tender"',
  '"IT services tender"',
  '"website development tender"',
  '"mobile app development tender"',
  '"looking for software development company"',
  '"seeking software development partner"',
  '"custom software development" RFP',
  '"technology vendor" procurement',
  '"web application development" tender'
];

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
  status: string;
};

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i")
  );

  return match ? decodeXml(match[1]) : "";
}

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function classifyIntent(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  const groups = [
    {
      type: "RFP_OR_TENDER",
      confidence: 95,
      terms: [
        "request for proposal",
        "request for quotation",
        "software development tender",
        "it services tender",
        "invitation to tender",
        "procurement notice",
        "request for bids"
      ]
    },
    {
      type: "VENDOR_REQUEST",
      confidence: 85,
      terms: [
        "looking for software development company",
        "seeking software development partner",
        "looking for a software developer",
        "seeking a technology vendor"
      ]
    },
    {
      type: "PROJECT_OPPORTUNITY",
      confidence: 65,
      terms: [
        "website development tender",
        "mobile app development tender",
        "custom software development",
        "digital transformation project"
      ]
    }
  ];

  for (const group of groups) {
    const matched = group.terms.filter(term => text.includes(term));

    if (matched.length) {
      return {
        type: group.type,
        confidence: group.confidence,
        matchedTerms: matched
      };
    }
  }

  return null;
}

function extractOrganisation(title: string): string | null {
  const match = title.match(
    /(?:by|from|issued by|published by)\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/
  );

  return match?.[1]?.trim() || null;
}

async function searchMarket(
  market: typeof MARKETS[number],
  term: string
): Promise<BuyerSignal[]> {
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(term)}` +
    `&hl=en&gl=${market.code}&ceid=${market.locale}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "GODSLEAD-InfoDart-Global/1.0"
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) return [];

    const xml = await response.text();

    const items =
      xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];

    const signals: BuyerSignal[] = [];

    for (const item of items) {
      const title = cleanText(getTag(item, "title"));
      const link = getTag(item, "link");
      const description = cleanText(getTag(item, "description"));

      if (!title || !link) continue;

      const intent = classifyIntent(title, description);

      if (!intent) continue;

      const published = getTag(item, "pubDate");

      signals.push({
        id: `${market.code}-${Buffer.from(link).toString("base64url").slice(0, 24)}`,
        title,
        organisation: extractOrganisation(title),
        source: cleanText(getTag(item, "source")) || "Google News",
        sourceUrl: link,
        publishedAt:
          published && !Number.isNaN(Date.parse(published))
            ? new Date(published).toISOString()
            : null,
        country: market.name,
        countryCode: market.code,
        intentType: intent.type,
        evidence: `${title}. ${description}`.slice(0, 700),
        matchedTerms: intent.matchedTerms,
        confidence: intent.confidence,
        status: "NEEDS_REVIEW"
      });
    }

    return signals;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const requestedCountry = params.get("country");
    const requestedType = params.get("type");

    const minimumConfidence = Math.max(
      0,
      Math.min(100, Number(params.get("minConfidence") || 60))
    );

    const selectedMarkets = requestedCountry
      ? MARKETS.filter(
          market => market.code === requestedCountry.toUpperCase()
        )
      : [...MARKETS];

    if (requestedCountry && selectedMarkets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Country not permitted by GODSLEAD targeting policy."
        },
        { status: 403 }
      );
    }

    const jobs = selectedMarkets.flatMap(market =>
      SEARCH_TERMS.map(term => ({ market, term }))
    );

    const allSignals: BuyerSignal[] = [];

    for (let i = 0; i < jobs.length; i += 8) {
      const batch = jobs.slice(i, i + 8);

      const results = await Promise.all(
        batch.map(({ market, term }) => searchMarket(market, term))
      );

      allSignals.push(...results.flat());
    }

    const uniqueSignals = new Map<string, BuyerSignal>();

    for (const signal of allSignals) {
      if (signal.confidence < minimumConfidence) continue;

      if (
        requestedType &&
        signal.intentType !== requestedType.toUpperCase()
      ) {
        continue;
      }

      if (!uniqueSignals.has(signal.sourceUrl)) {
        uniqueSignals.set(signal.sourceUrl, signal);
      }
    }

    const signals = [...uniqueSignals.values()].sort(
      (a, b) => b.confidence - a.confidence
    );

    return NextResponse.json({
      success: true,
      product: "GODSLEAD",
      engine: "BUYER INTENT HUNTER",
      version: "1.0.1",
      searchedMarkets: selectedMarkets.map(market => market.name),
      totalSignals: signals.length,
      filters: {
        country: requestedCountry || "ALL APPROVED COUNTRIES",
        type: requestedType || "ALL",
        minimumConfidence
      },
      signals,
      note: "These are preliminary public buying signals, not independently verified buyers. Check the original source before contacting prospects."
    });

  } catch (error) {
    console.error("GODSLEAD BUYER INTENT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Buyer Intent search failed.",
        signals: []
      },
      { status: 500 }
    );
  }
}
