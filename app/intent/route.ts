export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API = "https://api.github.com/search/issues";

const COUNTRIES = [
  { name: "United States", code: "US", pattern: /\b(USA|U\.S\.A\.|United States|United States of America)\b/i },
  { name: "Canada", code: "CA", pattern: /\bCanada\b/i },
  { name: "United Kingdom", code: "GB", pattern: /\b(United Kingdom|UK|Britain|England|Scotland|Wales)\b/i },
  { name: "Ireland", code: "IE", pattern: /\bIreland\b/i },
  { name: "Malta", code: "MT", pattern: /\bMalta\b/i },
  { name: "Australia", code: "AU", pattern: /\bAustralia\b/i },
  { name: "New Zealand", code: "NZ", pattern: /\bNew Zealand\b/i },
  { name: "Fiji", code: "FJ", pattern: /\bFiji\b/i },
  { name: "Papua New Guinea", code: "PG", pattern: /\bPapua New Guinea\b/i },
  { name: "United Arab Emirates", code: "AE", pattern: /\b(UAE|United Arab Emirates|Dubai|Abu Dhabi)\b/i },
  { name: "India", code: "IN", pattern: /\bIndia\b/i },
  { name: "Singapore", code: "SG", pattern: /\bSingapore\b/i },
  { name: "Philippines", code: "PH", pattern: /\bPhilippines\b/i },
  { name: "Malaysia", code: "MY", pattern: /\bMalaysia\b/i },
  { name: "Jamaica", code: "JM", pattern: /\bJamaica\b/i },
  { name: "Trinidad and Tobago", code: "TT", pattern: /\bTrinidad and Tobago\b/i },
  { name: "Barbados", code: "BB", pattern: /\bBarbados\b/i },
  { name: "Bahamas", code: "BS", pattern: /\b(Bahamas|The Bahamas)\b/i },
  { name: "Belize", code: "BZ", pattern: /\bBelize\b/i },
  { name: "Guyana", code: "GY", pattern: /\bGuyana\b/i },
];

const DIRECT_QUERIES = [
  '"looking for a software developer"',
  '"need a development team"',
  '"looking for a development agency"',
  '"need someone to build" software',
];

const OPPORTUNITY_QUERIES = [
  '"request for proposal" software',
  '"seeking software development company"',
  '"looking for a vendor" software',
  '"need a software development partner"',
];

const EXCLUDED =
  /\b(looking for a job|seeking employment|open to work|hire me|available for work|my portfolio|my services|freelancer available|developer available|we provide software|we offer development|our development services|SEO services|digital marketing services|job vacancy|job opening|internship|salary|good first issue|open source contribution|student project|homework|tutorial|course|volunteer|unpaid work)\b/i;

const SERVICE =
  /\b(software|web application|web development|website development|mobile app|app development|android|iOS|MVP|AI development|machine learning|automation|blockchain|SaaS|custom application|custom software|development agency|development company|development team|e-commerce platform)\b/i;

const BUYING =
  /\b(looking for|seeking|need|we need|want to hire|looking to hire|hire a|hire an|need someone to build|request for proposal|RFP|recommend a|searching for a|looking for an agency|development partner|vendor request)\b/i;

const TYPE_MAP: Record<string, string> = {
  RFP_OR_TENDER: "RFP_OR_TENDER",
  VENDOR_REQUEST: "VENDOR_REQUEST",
  PROJECT_OPPORTUNITY: "PROJECT_OPPORTUNITY",
};

function identifyCountry(text: string) {
  const matches = COUNTRIES.filter(item =>
    item.pattern.test(text)
  );

  if (matches.length !== 1) return null;

  return matches[0];
}

function extractBudget(text: string) {
  const patterns = [
    /(?:budget|project cost|project value|investment)[^.\n]{0,60}?\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\bUSD\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

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

  return {
    amount: null,
    currency: null,
    status: "UNKNOWN",
    meetsMinimum: false,
  };
}

function analyseIssue(issue: any, requestedType: string) {
  const title = issue.title || "";
  const body = issue.body || "";
  const text = `${title}\n${body}`;

  if (!text.trim()) return null;
  if (EXCLUDED.test(text)) return null;
  if (!SERVICE.test(text)) return null;
  if (!BUYING.test(text)) return null;

  const country = identifyCountry(text);

  if (!country) return null;

  let intentType = "PROJECT_OPPORTUNITY";

  if (/\b(RFP|request for proposal|tender|request for quotation|RFQ)\b/i.test(text)) {
    intentType = "RFP_OR_TENDER";
  } else if (/\b(vendor|supplier|agency|development partner|service provider)\b/i.test(text)) {
    intentType = "VENDOR_REQUEST";
  }

  if (requestedType && intentType !== requestedType) {
    return null;
  }

  const matchedTerms = [
    ...new Set(
      text.match(
        /\b(software|developer|development|agency|vendor|mobile app|website|MVP|AI|automation|blockchain|RFP|tender)\b/gi
      ) || []
    ),
  ];

  let confidence = 40;

  if (BUYING.test(text)) confidence += 20;
  if (SERVICE.test(text)) confidence += 15;
  if (/\b(company|business|startup|founder|organisation|organization)\b/i.test(text)) confidence += 10;
  if (/\$\s?[\d,]+/.test(text)) confidence += 10;

  confidence = Math.min(confidence, 95);

  const budget = extractBudget(text);

  const organisation =
    issue.repository_url
      ?.replace("https://api.github.com/repos/", "")
      .split("/")[0] || null;

  return {
    id: String(issue.id),
    title,
    organisation,
    source: "GitHub Public Issues",
    sourceUrl: issue.html_url,
    publishedAt: issue.created_at,
    country: country.name,
    countryCode: country.code,
    intentType,
    evidence: body.slice(0, 3000) || title,
    matchedTerms,
    confidence,
    status: "PRELIMINARY_SIGNAL",
    budget,
    buyerClassification: "POTENTIAL_BUYER",
    verificationStatus: "NOT_VERIFIED",
    author: issue.user?.login || "Unknown",
    profileUrl: issue.user?.html_url || null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const countryCode = searchParams.get("country") || "US";
    const requestedType = searchParams.get("type") || "";
    const minConfidence = Number(
      searchParams.get("minConfidence") || 60
    );

    const country = COUNTRIES.find(
      item => item.code === countryCode
    );

    if (!country) {
      return NextResponse.json(
        {
          success: false,
          error: "Country is not approved.",
          approvedCountries: COUNTRIES.map(item => ({
            name: item.name,
            code: item.code,
          })),
        },
        { status: 400 }
      );
    }

    if (
      requestedType &&
      !Object.keys(TYPE_MAP).includes(requestedType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid opportunity type.",
        },
        { status: 400 }
      );
    }

    const queries = [
      ...DIRECT_QUERIES,
      ...OPPORTUNITY_QUERIES,
    ];

    const collected = new Map<string, any>();
    const errors: string[] = [];

    for (const query of queries) {
      const params = new URLSearchParams({
        q: `${query} is:issue is:open created:>=2026-05-18`,
        per_page: "100",
        sort: "created",
        order: "desc",
      });

      try {
        const response = await fetch(
          `${API}?${params.toString()}`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "GODSLEAD",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!response.ok) {
          errors.push(`GitHub HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();

        for (const issue of data.items || []) {
          const signal = analyseIssue(
            issue,
            requestedType
          );

          if (!signal) continue;
          if (signal.countryCode !== countryCode) continue;
          if (signal.confidence < minConfidence) continue;

          collected.set(signal.id, signal);
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Search request failed"
        );
      }
    }

    const signals = Array.from(collected.values()).sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      platform: "GODSLEAD",
      engine: "BUYER INTENT HUNTER",
      version: "4.0.0",
      source: "GitHub Public Issues API",
      generatedAt: new Date().toISOString(),

      filters: {
        country: country.name,
        countryCode,
        opportunityType: requestedType || "ALL",
        minimumConfidence: minConfidence,
      },

      summary: {
        totalSignals: signals.length,
        potentialBuyers: signals.length,
        verifiedBuyers: 0,
        sourceVerified: false,
      },

      signals,

      diagnostics: {
        queriesAttempted: queries.length,
        errors,
      },

      message:
        "These are preliminary public signals. GitHub issues do not independently establish a commercial buying requirement, organisation identity, purchasing authority or project budget.",
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
