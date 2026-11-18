export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const API = "https://api.github.com/search/issues";

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
  "United States": /\b(USA|U\.S\.A\.|United States|United States of America)\b/i,
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
  "Trinidad and Tobago": /\bTrinidad and Tobago\b/i,
  Barbados: /\bBarbados\b/i,
  Bahamas: /\b(Bahamas|The Bahamas)\b/i,
  Belize: /\bBelize\b/i,
  Guyana: /\bGuyana\b/i,
};

const DIRECT_INTENT =
  /\b(looking for|seeking|need|we need|want to hire|looking to hire|hire a|hire an|need someone to build|requesting proposals|request for proposal|RFP|recommend a|recommend an|searching for a|searching for an|looking for an agency|need a development team|seeking a development partner|looking for a development partner)\b/i;

const SERVICE_TERMS =
  /\b(software development|software developer|software company|custom software|web development|website development|web application|mobile app development|mobile application|app developer|app development|android app|ios app|MVP development|MVP developer|product development|AI development|AI developer|machine learning|automation development|blockchain development|blockchain developer|IT outsourcing|dedicated development team|SaaS development|e-commerce development|Telegram bot|custom application|development agency|development company|development team)\b/i;

const OPPORTUNITY_INTENT =
  /\b(launching|launch|building|developing|development of|planning to build|plan to develop|digital transformation|new digital product|new application|new mobile app|new platform|expanding our|expansion into|product launch|building a platform|develop a platform|develop an application|developing an application|building an application|investing in technology)\b/i;

const BUSINESS_CONTEXT =
  /\b(company|business|startup|founder|co-founder|CEO|owner|enterprise|organisation|organization|customers|clients|product|customers|revenue|business operations|our company|our business|our platform)\b/i;

const EXCLUDED =
  /\b(looking for a job|seeking employment|open to work|hire me|available for work|my portfolio|my services|freelancer available|developer available|I am a developer|I am an experienced developer|we provide software|we offer development|our development services|SEO services|digital marketing services|website design services|contact us for|hire our team|job vacancy|job opening|full.time position|internship|salary|good first issue|open source contribution|looking for contributors|student project|homework|tutorial|course|volunteer|unpaid work|work together for equity|seeking employment)\b/i;

const QUERIES = [
  {
    type: "DIRECT_BUYER",
    query: '"looking for a developer"',
  },
  {
    type: "DIRECT_BUYER",
    query: '"need a development team"',
  },
  {
    type: "DIRECT_BUYER",
    query: '"looking for a software development company"',
  },
  {
    type: "DIRECT_BUYER",
    query: '"need someone to build"',
  },
  {
    type: "BUSINESS_OPPORTUNITY",
    query: '"launching a new platform"',
  },
  {
    type: "BUSINESS_OPPORTUNITY",
    query: '"digital transformation" software',
  },
];

function identifyCountry(text: string) {
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
    /(?:budget|project value|investment|estimated cost|project cost|spend)[^.\n]{0,70}?\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
    /\bUSD\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    let amount = Number(match[1].replace(/,/g, ""));

    if (match[2]?.toLowerCase() === "k") {
      amount *= 1000;
    }

    if (match[2]?.toLowerCase() === "m") {
      amount *= 1000000;
    }

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

function analyseIssue(issue: any, queryType: string) {
  const title = issue.title || "";
  const body = issue.body || "";
  const text = `${title}\n${body}`;

  if (!text.trim()) return null;

  if (EXCLUDED.test(text)) return null;

  if (!SERVICE_TERMS.test(text)) return null;

  const isDirectBuyer =
    DIRECT_INTENT.test(text);

  const isBusinessOpportunity =
    OPPORTUNITY_INTENT.test(text) &&
    BUSINESS_CONTEXT.test(text);

  let classification = "";

  if (queryType === "DIRECT_BUYER" && isDirectBuyer) {
    classification = "DIRECT_BUYER_SIGNAL";
  } else if (
    queryType === "BUSINESS_OPPORTUNITY" &&
    isBusinessOpportunity
  ) {
    classification = "BUSINESS_OPPORTUNITY";
  } else {
    return null;
  }

  const location = identifyCountry(text);

  if (!location.approved) return null;

  const budget = extractBudget(text);

  return {
    id: issue.id,
    source: "GitHub",
    sourceCategory: classification,
    title,
    requirement: body.slice(0, 5000),

    organisation: issue.repository_url
      ?.replace("https://api.github.com/repos/", "")
      .split("/")[0] || "Unknown",

    country: location.country,
    approvedMarket: true,

    budget,

    buyerClassification: "POTENTIAL_BUYER",

    verificationStatus: "NOT_INDEPENDENTLY_VERIFIED",

    decisionMakerStatus: "NOT_VERIFIED",

    contactStatus: "PUBLIC_GITHUB_PROFILE",

    author: issue.user?.login || "Unknown",

    profileUrl: issue.user?.html_url || null,

    publishedAt: issue.created_at,

    updatedAt: issue.updated_at,

    projectUrl: issue.html_url,

    repositoryUrl: issue.repository_url,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedCountry =
      searchParams.get("country") || "ALL";

    const requestedType =
      searchParams.get("type") || "ALL";

    const requestedLimit =
      Number(searchParams.get("limit") || 50);

    const limit = Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : 50,
        1
      ),
      100
    );

    if (
      requestedCountry !== "ALL" &&
      !APPROVED_COUNTRIES.includes(requestedCountry)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Country is not approved.",
          approvedCountries: APPROVED_COUNTRIES,
        },
        { status: 400 }
      );
    }

    if (
      !["ALL", "DIRECT_BUYER", "BUSINESS_OPPORTUNITY"].includes(
        requestedType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid lead category.",
          allowedTypes: [
            "ALL",
            "DIRECT_BUYER",
            "BUSINESS_OPPORTUNITY",
          ],
        },
        { status: 400 }
      );
    }

    const since = new Date();

    since.setDate(since.getDate() - 180);

    const dateFilter =
      since.toISOString().slice(0, 10);

    const collected = new Map<number, any>();

    const errors: string[] = [];

    for (const item of QUERIES) {
      if (
        requestedType !== "ALL" &&
        requestedType !== item.type
      ) {
        continue;
      }

      const githubQuery =
        `${item.query} is:issue is:open created:>=${dateFilter}`;

      const params = new URLSearchParams({
        q: githubQuery,
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
          errors.push(
            `GitHub HTTP ${response.status}: ${item.query}`
          );

          continue;
        }

        const data = await response.json();

        for (const issue of data.items || []) {
          const lead = analyseIssue(
            issue,
            item.type
          );

          if (lead) {
            collected.set(lead.id, lead);
          }
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : "Unknown API error"
        );
      }
    }

    let leads = Array.from(collected.values());

    if (requestedCountry !== "ALL") {
      leads = leads.filter(
        (lead) => lead.country === requestedCountry
      );
    }

    leads.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );

    const results = leads.slice(0, limit);

    const directBuyers = results.filter(
      (lead) =>
        lead.sourceCategory === "DIRECT_BUYER_SIGNAL"
    );

    const opportunities = results.filter(
      (lead) =>
        lead.sourceCategory === "BUSINESS_OPPORTUNITY"
    );

    return NextResponse.json({
      success: true,

      platform: "GODSLEAD",

      engine: "INTERNATIONAL BUYER AND OPPORTUNITY DISCOVERY",

      version: "3.0.0",

      source: "GitHub Public Issues API",

      generatedAt: new Date().toISOString(),

      configuration: {
        minimumBudgetUSD: 5000,
        maximumAgeDays: 180,
        approvedCountries: APPROVED_COUNTRIES,
        searchCategories: [
          "DIRECT_BUYER",
          "BUSINESS_OPPORTUNITY",
        ],
      },

      summary: {
        totalSignals: results.length,
        directBuyerSignals: directBuyers.length,
        businessOpportunities: opportunities.length,

        budgetConfirmedAtOrAbove5000:
          results.filter(
            (lead) => lead.budget.meetsMinimum
          ).length,

        budgetUnknown:
          results.filter(
            (lead) => lead.budget.status === "UNKNOWN"
          ).length,

        verifiedBuyers: 0,
        potentialBuyers: results.length,
      },

      leads: results,

      diagnostics: {
        queriesAttempted: QUERIES.filter(
          (item) =>
            requestedType === "ALL" ||
            requestedType === item.type
        ).length,

        uniqueMatchingSignals: collected.size,

        errors,
      },

      qualificationRules: {
        verifiedBuyer:
          "Requires independent organisation verification, genuine active requirement and explicitly confirmed budget of at least USD 5,000.",

        potentialBuyer:
          "Public requirement or business opportunity detected, but independent buyer verification is incomplete.",

        unknownLocation:
          "Excluded from approved-market results.",

        unknownBudget:
          "Never assumed or estimated.",
      },

      message:
        "Discovery signals require human verification. GitHub does not independently verify buyer identity, purchasing authority or project budgets.",
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
