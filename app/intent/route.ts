export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API_URL =
  "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";

const APPROVED_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Ireland",
  "Malta",
  "Australia",
  "New Zealand",
  "Fiji",
  "Papua New Guinea",
  "United Arab Emirates",
  "India",
  "Singapore",
  "Philippines",
  "Malaysia",
  "Jamaica",
  "Trinidad and Tobago",
  "Barbados",
  "Bahamas",
  "Belize",
  "Guyana",
];

const COUNTRY_PATTERNS: Record<string, RegExp> = {
  "United States": /\b(USA|United States|United States of America|US-based)\b/i,
  Canada: /\bCanada\b/i,
  "United Kingdom": /\b(United Kingdom|UK|Britain|England|Scotland|Wales)\b/i,
  Ireland: /\bIreland\b/i,
  Malta: /\bMalta\b/i,
  Australia: /\bAustralia\b/i,
  "New Zealand": /\bNew Zealand\b/i,
  Fiji: /\bFiji\b/i,
  "Papua New Guinea": /\bPapua New Guinea\b/i,
  "United Arab Emirates": /\b(UAE|United Arab Emirates|Dubai|Abu Dhabi)\b/i,
  India: /\bIndia\b/i,
  Singapore: /\bSingapore\b/i,
  Philippines: /\bPhilippines\b/i,
  Malaysia: /\bMalaysia\b/i,
  Jamaica: /\bJamaica\b/i,
  "Trinidad and Tobago": /\b(Trinidad and Tobago|Trinidad)\b/i,
  Barbados: /\bBarbados\b/i,
  Bahamas: /\b(Bahamas|The Bahamas)\b/i,
  Belize: /\bBelize\b/i,
  Guyana: /\bGuyana\b/i,
};

const EXCLUDED_COUNTRIES =
  /\b(Pakistan|Bangladesh|Sri Lanka|Nigeria|Kenya|South Africa|Ghana|Egypt|Ethiopia|Tanzania|Uganda|Morocco|Algeria|Tunisia|Zimbabwe|Rwanda|Senegal|Cameroon|Zambia|Botswana|Namibia|Angola|Sudan|Libya)\b/i;

const SEARCH_QUERIES = [
  '"looking for a software developer"',
  '"looking for an app developer"',
  '"need a development team"',
  '"looking for a development agency"',
  '"need an MVP developer"',
  '"looking for a web development company"',
  '"need an AI development company"',
  '"looking for a software development company"',
];

const BUYING_INTENT =
  /\b(looking for|seeking|need|we need|want to hire|searching for|recommend a|can anyone recommend|hiring a|hire an|find a|looking to engage|looking to outsource|requesting proposals|seeking proposals|need help finding)\b/i;

const SERVICE_INTENT =
  /\b(software development|software developer|software company|development company|development agency|development team|web developer|web development|website development|mobile app|app developer|app development|android app|ios app|MVP development|MVP developer|product development|AI development|AI developer|machine learning development|automation development|blockchain development|blockchain developer|IT outsourcing|dedicated development team|custom application|custom software|SaaS development)\b/i;

const EXCLUDED_INTENT =
  /\b(looking for a job|seeking employment|open to work|my resume|my portfolio|hire me|available for work|freelance jobs|job vacancy|job opening|salary|internship|tutorial|course|homework|student project|open source contribution|free volunteer|unpaid work|crypto giveaway)\b/i;

function identifyCountry(text: string) {
  if (EXCLUDED_COUNTRIES.test(text)) {
    return {
      country: "EXCLUDED",
      approved: false,
    };
  }

  const matches = APPROVED_COUNTRIES.filter((country) =>
    COUNTRY_PATTERNS[country].test(text)
  );

  if (matches.length !== 1) {
    return {
      country: "UNKNOWN",
      approved: false,
    };
  }

  return {
    country: matches[0],
    approved: true,
  };
}

function extractBudget(text: string) {
  const patterns = [
    /(?:budget|budgeted|spend|spending|cost|project value|investment|price)[^.\n]{0,50}?\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\bUSD\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      let amount = Number(match[1].replace(/,/g, ""));

      if (match[2]?.toLowerCase() === "k") amount *= 1000;
      if (match[2]?.toLowerCase() === "m") amount *= 1000000;

      return {
        amount,
        currency: "USD",
        meetsMinimum: amount >= 5000,
        status: "EXPLICITLY_STATED",
      };
    }
  }

  return {
    amount: null,
    currency: null,
    meetsMinimum: false,
    status: "UNKNOWN",
  };
}

function getPostUrl(uri: string, handle: string) {
  const postId = uri.split("/").pop();

  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

function analysePost(post: any) {
  const text = post.record?.text || post.text || "";
  const author = post.author || {};
  const handle = author.handle || "unknown";
  const uri = post.uri || "";

  if (!text || !uri) return null;

  if (EXCLUDED_INTENT.test(text)) return null;

  if (!BUYING_INTENT.test(text)) return null;

  if (!SERVICE_INTENT.test(text)) return null;

  const location = identifyCountry(text);

  const budget = extractBudget(text);

  const date =
    post.record?.createdAt ||
    post.indexedAt ||
    null;

  return {
    id: uri,
    source: "Bluesky",
    author: {
      handle,
      displayName: author.displayName || handle,
      profileUrl: `https://bsky.app/profile/${handle}`,
    },
    requirement: text,
    country: location.country,
    approvedMarket: location.approved,
    buyerClassification: "POTENTIAL_BUYER",
    qualificationStatus: location.approved
      ? "APPROVED_MARKET_POTENTIAL"
      : "UNQUALIFIED_LOCATION",
    budget,
    decisionMakerStatus: "NOT_VERIFIED",
    organisationStatus: "NOT_VERIFIED",
    contactStatus: "PUBLIC_PROFILE_ONLY",
    publishedAt: date,
    postUrl: getPostUrl(uri, handle),
    verificationNotes: [
      "Public buying-intent language detected.",
      "Organisation identity has not been independently verified.",
      "Decision-maker status has not been independently verified.",
      budget.status === "UNKNOWN"
        ? "Budget has not been explicitly stated."
        : "Budget extracted from public post text.",
      location.approved
        ? "An approved country was explicitly identified in the post."
        : "Approved country has not been established.",
    ],
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedCountry = searchParams.get("country");
    const requestedLimit = Number(searchParams.get("limit") || 50);

    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1),
      100
    );

    if (
      requestedCountry &&
      requestedCountry !== "ALL" &&
      !APPROVED_COUNTRIES.includes(requestedCountry)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Country is not in the approved market list.",
          approvedCountries: APPROVED_COUNTRIES,
        },
        { status: 400 }
      );
    }

    const collected = new Map<string, any>();

    const errors: string[] = [];

    for (const query of SEARCH_QUERIES) {
      const params = new URLSearchParams({
        q: query,
        limit: "100",
        sort: "latest",
      });

      const endpoint = `${API_URL}?${params.toString()}`;

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "GODSLEAD/1.0",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          errors.push(
            `Bluesky returned HTTP ${response.status} for query: ${query}`
          );
          continue;
        }

        const data = await response.json();

        for (const post of data.posts || []) {
          const lead = analysePost(post);

          if (lead) {
            collected.set(lead.id, lead);
          }
        }
      } catch (error) {
        errors.push(
          `Search failed for "${query}": ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    const allSignals = Array.from(collected.values());

    const approvedMarketLeads = allSignals.filter(
      (lead) => lead.approvedMarket
    );

    const unknownLocationLeads = allSignals.filter(
      (lead) => !lead.approvedMarket
    );

    const filteredLeads =
      requestedCountry && requestedCountry !== "ALL"
        ? approvedMarketLeads.filter(
            (lead) => lead.country === requestedCountry
          )
        : approvedMarketLeads;

    filteredLeads.sort((a, b) => {
      return (
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
      );
    });

    const results = filteredLeads.slice(0, limit);

    const budgetConfirmed = results.filter(
      (lead) => lead.budget.meetsMinimum
    ).length;

    const budgetUnknown = results.filter(
      (lead) => lead.budget.status === "UNKNOWN"
    ).length;

    return NextResponse.json({
      success: true,
      platform: "GODSLEAD",
      engine: "BLUESKY INTERNATIONAL BUYER DISCOVERY",
      version: "1.0.0",
      source: "Bluesky Public Search API",
      sourceWebsite: "https://bsky.app/",
      generatedAt: new Date().toISOString(),

      configuration: {
        minimumBudgetUSD: 5000,
        approvedCountries: APPROVED_COUNTRIES,
        excludedCountries:
          "All African countries, Pakistan, Bangladesh and Sri Lanka",
        searchQueries: SEARCH_QUERIES,
        resultLimit: limit,
      },

      summary: {
        totalSignals: results.length,
        approvedMarketSignals: approvedMarketLeads.length,
        unknownLocationSignals: unknownLocationLeads.length,
        budgetConfirmedAtOrAbove5000: budgetConfirmed,
        budgetUnknown,
        verifiedBuyers: 0,
        potentialBuyers: results.length,
      },

      qualificationRules: {
        verifiedBuyer:
          "Requires independent organisation verification and explicitly confirmed budget of at least USD 5,000. This API does not independently verify either requirement.",
        potentialBuyer:
          "Public buying intent and relevant software service language detected.",
        unknownLocation:
          "Not included in approved-market results.",
        budget:
          "Never assumed. Only explicitly stated amounts are extracted.",
      },

      leads: results,

      diagnostics: {
        queriesAttempted: SEARCH_QUERIES.length,
        uniqueMatchingSignals: allSignals.length,
        apiErrors: errors,
      },

      message:
        "Public posts are discovery signals, not independently verified buyers. Human verification is required before outreach.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        platform: "GODSLEAD",
        engine: "BLUESKY INTERNATIONAL BUYER DISCOVERY",
        error:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}
