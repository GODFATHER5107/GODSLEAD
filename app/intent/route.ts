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

const COUNTRIES: Record<string, RegExp> = {
  "United States": /\b(USA|United States|United States of America)\b/i,
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
  Bahamas: /\bBahamas\b/i,
  Belize: /\bBelize\b/i,
  Guyana: /\bGuyana\b/i,
};

const BUYING_INTENT =
  /\b(looking for|need|seeking|want to hire|hire a|hire an|looking to hire|looking to build|need someone to build|seeking a development|request for proposal|RFP|looking for an agency|need a development team|looking for a company)\b/i;

const SERVICE_INTENT =
  /\b(software|web application|web development|website development|mobile app|app development|android|iOS|MVP|AI development|machine learning|automation|blockchain|SaaS|custom application|custom software|development agency|development company|development team|Telegram bot|e-commerce platform)\b/i;

const EXCLUDED =
  /\b(looking for a job|seeking employment|open to work|hire me|available for work|my portfolio|my services|freelancer available|developer available|looking for contributors|open source contribution|good first issue|internship|student project|homework|tutorial|course|collaboration only|work together for equity|unpaid|volunteer)\b/i;

const QUERIES = [
  '"looking for a developer"',
  '"need a development team"',
  '"looking for a software development company"',
  '"need someone to build"',
];

function findCountry(text: string) {
  const matches = APPROVED_COUNTRIES.filter((country) =>
    COUNTRIES[country].test(text)
  );

  if (matches.length !== 1) {
    return "UNKNOWN";
  }

  return matches[0];
}

function findBudget(text: string) {
  const patterns = [
    /(?:budget|project value|investment|cost|spend)[^.\n]{0,50}?\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?\b/i,
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

function analyseIssue(issue: any) {
  const title = issue.title || "";
  const body = issue.body || "";
  const text = `${title}\n${body}`;

  if (!BUYING_INTENT.test(text)) return null;
  if (!SERVICE_INTENT.test(text)) return null;
  if (EXCLUDED.test(text)) return null;

  const country = findCountry(text);

  if (country === "UNKNOWN") return null;

  const budget = findBudget(text);

  return {
    id: issue.id,
    source: "GitHub",
    title,
    requirement: body.slice(0, 5000),
    organisation: issue.repository_url
      ?.replace("https://api.github.com/repos/", "")
      .split("/")[0] || "Unknown",
    country,
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

    const requestedCountry = searchParams.get("country") || "ALL";

    const requestedLimit = Number(searchParams.get("limit") || 50);

    const limit = Math.min(
      Math.max(requestedLimit || 50, 1),
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

    const since = new Date();

    since.setDate(since.getDate() - 180);

    const dateFilter = since.toISOString().slice(0, 10);

    const collected = new Map<number, any>();

    const errors: string[] = [];

    for (const query of QUERIES) {
      const githubQuery =
        `${query} is:issue is:open created:>=${dateFilter}`;

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
            `GitHub HTTP ${response.status}: ${query}`
          );
          continue;
        }

        const data = await response.json();

        for (const issue of data.items || []) {
          const lead = analyseIssue(issue);

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

    return NextResponse.json({
      success: true,

      platform: "GODSLEAD",

      engine: "GITHUB INTERNATIONAL BUYER DISCOVERY",

      version: "2.0.0",

      source: "GitHub Public Issues API",

      generatedAt: new Date().toISOString(),

      configuration: {
        minimumBudgetUSD: 5000,
        maximumAgeDays: 180,
        approvedCountries: APPROVED_COUNTRIES,
        queries: QUERIES,
      },

      summary: {
        totalSignals: results.length,
        potentialBuyers: results.length,

        budgetConfirmed: results.filter(
          (lead) => lead.budget.meetsMinimum
        ).length,

        budgetUnknown: results.filter(
          (lead) => lead.budget.status === "UNKNOWN"
        ).length,

        verifiedBuyers: 0,
      },

      leads: results,

      diagnostics: {
        queriesAttempted: QUERIES.length,
        uniqueMatchingSignals: collected.size,
        errors,
      },

      message:
        "These are public project-discovery signals. Organisation identity, buyer authority and budget require independent verification.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        platform: "GODSLEAD",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
