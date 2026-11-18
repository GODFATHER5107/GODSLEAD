export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const COUNTRIES = [
  { name: "United States", code: "US", aliases: ["United States", "USA"] },
  { name: "Canada", code: "CA", aliases: ["Canada"] },
  { name: "United Kingdom", code: "GB", aliases: ["United Kingdom", "UK", "Britain"] },
  { name: "Ireland", code: "IE", aliases: ["Ireland"] },
  { name: "Malta", code: "MT", aliases: ["Malta"] },
  { name: "Australia", code: "AU", aliases: ["Australia"] },
  { name: "New Zealand", code: "NZ", aliases: ["New Zealand"] },
  { name: "Fiji", code: "FJ", aliases: ["Fiji"] },
  { name: "Papua New Guinea", code: "PG", aliases: ["Papua New Guinea"] },
  { name: "United Arab Emirates", code: "AE", aliases: ["United Arab Emirates", "UAE"] },
  { name: "India", code: "IN", aliases: ["India"] },
  { name: "Singapore", code: "SG", aliases: ["Singapore"] },
  { name: "Philippines", code: "PH", aliases: ["Philippines"] },
  { name: "Malaysia", code: "MY", aliases: ["Malaysia"] },
  { name: "Jamaica", code: "JM", aliases: ["Jamaica"] },
  { name: "Trinidad and Tobago", code: "TT", aliases: ["Trinidad and Tobago"] },
  { name: "Barbados", code: "BB", aliases: ["Barbados"] },
  { name: "Bahamas", code: "BS", aliases: ["Bahamas"] },
  { name: "Belize", code: "BZ", aliases: ["Belize"] },
  { name: "Guyana", code: "GY", aliases: ["Guyana"] },
];

const DIRECT_INTENT =
  /\b(looking for a developer|looking for developers|need a developer|need developers|looking for a development agency|need a development team|looking for a software company|need a software company|seeking a development partner|need someone to build|looking to hire a developer|request for proposal|RFP|seeking software development services|looking for an app developer)\b/i;

const SERVICE_TERMS =
  /\b(software development|software developer|web development|website development|mobile app development|app development|android development|ios development|MVP development|custom software|custom application|AI development|machine learning|automation development|blockchain development|SaaS development|e-commerce development|development agency|development team|development partner)\b/i;

const EXCLUDED =
  /\b(hire me|looking for a job|seeking employment|open to work|available for work|my portfolio|my services|we provide software|we offer development|our development services|SEO services|digital marketing agency|job vacancy|job opening|salary|internship|tutorial|homework|student project|open source contribution|volunteer|unpaid work|course|training)\b/i;

const QUERIES = [
  "looking for a software developer",
  "need a software development company",
  "looking for an app development team",
  "need a website development agency",
  "looking for an MVP development partner",
  "seeking custom software development",
];

function identifyCountry(text: string) {
  const matches = COUNTRIES.filter(country =>
    country.aliases.some(alias =>
      new RegExp(
        `\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i"
      ).test(text)
    )
  );

  return matches.length === 1 ? matches[0] : null;
}

function extractBudget(text: string) {
  const match = text.match(
    /(?:budget|project cost|project value|development budget)[^.\n]{0,50}?\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i
  );

  if (!match) {
    return {
      amount: null,
      currency: null,
      status: "UNKNOWN",
      meetsMinimum: false,
    };
  }

  let amount = Number(match[1].replace(/,/g, ""));

  if (match[2]?.toLowerCase() === "k") amount *= 1000;
  if (match[2]?.toLowerCase() === "m") amount *= 1000000;

  return {
    amount,
    currency: "USD",
    status: "EXPLICITLY_STATED",
    meetsMinimum: amount >= 5000,
  };
}

function classifyType(text: string) {
  if (/\b(RFP|request for proposal|tender|RFQ)\b/i.test(text)) {
    return "RFP_OR_TENDER";
  }

  if (/\b(vendor|supplier|agency|development partner|service provider)\b/i.test(text)) {
    return "VENDOR_REQUEST";
  }

  return "PROJECT_OPPORTUNITY";
}

function makeSignal(input: {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  date: string | null;
  countryCode: string;
  category: "DIRECT" | "BUSINESS";
  organisation?: string | null;
}) {
  const text = `${input.title}\n${input.description}`;

  if (EXCLUDED.test(text)) return null;
  if (!SERVICE_TERMS.test(text)) return null;

  const direct = DIRECT_INTENT.test(text);

  if (input.category === "DIRECT" && !direct) return null;

  if (input.category === "BUSINESS" && direct) {
    input.category = "DIRECT";
  }

  const country = identifyCountry(text);

  if (!country || country.code !== input.countryCode) return null;

  let confidence = 35;

  if (direct) confidence += 30;
  if (SERVICE_TERMS.test(text)) confidence += 15;
  if (input.organisation) confidence += 5;
  if (extractBudget(text).meetsMinimum) confidence += 15;

  confidence = Math.min(confidence, 95);

  const budget = extractBudget(text);

  return {
    id: input.id,
    title: input.title,
    organisation: input.organisation || null,
    source: input.source,
    sourceUrl: input.url,
    publishedAt: input.date,
    country: country.name,
    countryCode: country.code,
    intentType: classifyType(text),
    evidence: input.description.slice(0, 2500),
    matchedTerms: [
      ...new Set(
        text.match(
          /\b(software|developer|development|agency|vendor|mobile app|website|MVP|AI|automation|blockchain)\b/gi
        ) || []
      ),
    ],
    confidence,
    status: direct ? "DIRECT_BUYING_SIGNAL" : "BUSINESS_OPPORTUNITY",
    budget,
    buyerClassification: "POTENTIAL_BUYER",
    verificationStatus: "NOT_VERIFIED",
    decisionMakerStatus: "NOT_VERIFIED",
    category: direct ? "DIRECT_BUYER" : "BUSINESS_OPPORTUNITY",
  };
}

async function searchHackerNews(countryCode: string) {
  const country = COUNTRIES.find(item => item.code === countryCode)!;
  const results: any[] = [];
  const errors: string[] = [];

  for (const query of QUERIES) {
    const params = new URLSearchParams({
      query: `${query} ${country.name}`,
      tags: "story",
      hitsPerPage: "30",
    });

    try {
      const response = await fetch(
        `https://hn.algolia.com/api/v1/search_by_date?${params}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!response.ok) {
        errors.push(`Hacker News HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      for (const hit of data.hits || []) {
        const title = hit.title || "";
        const description = hit.story_text || "";
        const url = hit.url ||
          `https://news.ycombinator.com/item?id=${hit.objectID}`;

        const signal = makeSignal({
          id: `hn-${hit.objectID}`,
          title,
          description,
          url,
          source: "Hacker News Algolia",
          date: hit.created_at,
          countryCode,
          category: "DIRECT",
          organisation: hit.author || null,
        });

        if (signal) results.push(signal);
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Hacker News search failed"
      );
    }
  }

  return { results, errors };
}

async function searchGDELT(countryCode: string) {
  const country = COUNTRIES.find(item => item.code === countryCode)!;
  const results: any[] = [];
  const errors: string[] = [];

  const queries = [
    `"${country.name}" software development project`,
    `"${country.name}" digital transformation application`,
  ];

  for (const query of queries) {
    const params = new URLSearchParams({
      query,
      mode: "ArtList",
      format: "json",
      maxrecords: "50",
      sort: "DateDesc",
    });

    try {
      const response = await fetch(
        `https://api.gdeltproject.org/api/v2/doc/doc?${params}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!response.ok) {
        errors.push(`GDELT HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      for (const article of data.articles || []) {
        const title = article.title || "";
        const description = article.seendate || "";

        const signal = makeSignal({
          id: `gdelt-${article.url}`,
          title,
          description,
          url: article.url,
          source: "GDELT Global News",
          date: article.seendate || null,
          countryCode,
          category: "BUSINESS",
          organisation: article.domain || null,
        });

        if (signal) results.push(signal);
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "GDELT search failed"
      );
    }
  }

  return { results, errors };
}

async function searchGitHub(countryCode: string) {
  const country = COUNTRIES.find(item => item.code === countryCode)!;
  const results: any[] = [];
  const errors: string[] = [];

  const query = `"looking for a developer" ${country.name}`;

  const params = new URLSearchParams({
    q: `${query} is:issue is:open created:>=2026-05-18`,
    per_page: "50",
    sort: "created",
    order: "desc",
  });

  try {
    const response = await fetch(
      `https://api.github.com/search/issues?${params}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "GODSLEAD",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!response.ok) {
      errors.push(`GitHub HTTP ${response.status}`);
      return { results, errors };
    }

    const data = await response.json();

    for (const issue of data.items || []) {
      const signal = makeSignal({
        id: `gh-${issue.id}`,
        title: issue.title || "",
        description: issue.body || "",
        url: issue.html_url,
        source: "GitHub Public Issues",
        date: issue.created_at,
        countryCode,
        category: "DIRECT",
        organisation: issue.user?.login || null,
      });

      if (signal) results.push(signal);
    }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "GitHub search failed"
    );
  }

  return { results, errors };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const countryCode = searchParams.get("country") || "US";
    const requestedType = searchParams.get("type") || "";
    const minConfidence = Number(searchParams.get("minConfidence") || 60);

    const country = COUNTRIES.find(item => item.code === countryCode);

    if (!country) {
      return NextResponse.json(
        {
          success: false,
          error: "Country is not approved.",
          approvedCountries: COUNTRIES,
        },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "",
      "RFP_OR_TENDER",
      "VENDOR_REQUEST",
      "PROJECT_OPPORTUNITY",
    ];

    if (!allowedTypes.includes(requestedType)) {
      return NextResponse.json(
        { success: false, error: "Invalid opportunity type." },
        { status: 400 }
      );
    }

    const [hn, gdelt, github] = await Promise.all([
      searchHackerNews(countryCode),
      searchGDELT(countryCode),
      searchGitHub(countryCode),
    ]);

    const all = [
      ...hn.results,
      ...gdelt.results,
      ...github.results,
    ];

    const unique = new Map<string, any>();

    for (const signal of all) {
      if (signal.confidence < minConfidence) continue;

      if (
        requestedType &&
        signal.intentType !== requestedType
      ) continue;

      unique.set(signal.id, signal);
    }

    const signals = Array.from(unique.values()).sort(
      (a, b) =>
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
    );

    return NextResponse.json({
      success: true,
      platform: "GODSLEAD",
      engine: "INTERNATIONAL MULTI-SOURCE DISCOVERY",
      version: "5.0.0",
      generatedAt: new Date().toISOString(),

      configuration: {
        country: country.name,
        countryCode,
        minimumBudgetUSD: 5000,
        minimumConfidence: minConfidence,
        approvedCountries: COUNTRIES,
      },

      sources: [
        {
          name: "Hacker News Algolia",
          access: "Public API",
          results: hn.results.length,
        },
        {
          name: "GDELT",
          access: "Public API",
          results: gdelt.results.length,
        },
        {
          name: "GitHub",
          access: "Public API",
          results: github.results.length,
        },
      ],

      summary: {
        totalSignals: signals.length,
        directBuyerSignals: signals.filter(
          item => item.category === "DIRECT_BUYER"
        ).length,
        businessOpportunities: signals.filter(
          item => item.category === "BUSINESS_OPPORTUNITY"
        ).length,
        budgetConfirmed: signals.filter(
          item => item.budget.meetsMinimum
        ).length,
        budgetUnknown: signals.filter(
          item => item.budget.status === "UNKNOWN"
        ).length,
        verifiedBuyers: 0,
      },

      signals,

      diagnostics: {
        errors: [
          ...hn.errors,
          ...gdelt.errors,
          ...github.errors,
        ],
      },

      message:
        "Public discovery signals only. These sources do not independently verify purchasing authority, active requirements or budgets. Verify every opportunity before outreach.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        platform: "GODSLEAD",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
