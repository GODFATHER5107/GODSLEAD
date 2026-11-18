**File:** `app/intent/route.ts`

```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const FREELANCER_API =
  "https://www.freelancer.com/api/projects/0.1/projects/active/";

const MINIMUM_BUDGET_USD = 5000;

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

const SEARCH_TERMS = [
  "software development",
  "website development",
  "mobile app development",
  "AI automation",
  "blockchain development",
  "MVP SaaS",
];

const SERVICE_TERMS =
  /\b(software|website|web application|web development|mobile app|mobile application|android|ios|MVP|SaaS|AI development|artificial intelligence|machine learning|automation|blockchain|web3|custom application|enterprise software|IT outsourcing|dedicated development team|e-commerce platform|application development)\b/i;

const BUYING_TERMS =
  /\b(looking for|need|require|required|seeking|want to build|want to develop|hire|hiring|build me|develop for us|development partner|development company|development team|project requirement|project scope|new application|new website|new platform)\b/i;

const EXCLUDED_TERMS =
  /\b(hire me|looking for a job|seeking employment|open to work|available for work|my portfolio|my services|we provide software|we offer development|our development services|SEO services|digital marketing agency|job vacancy|job opening|salary|internship|tutorial|homework|student project|volunteer|unpaid work|course|training)\b/i;

function classifyType(text: string) {
  if (/\b(RFP|request for proposal|tender|RFQ)\b/i.test(text)) {
    return "RFP_OR_TENDER";
  }

  if (/\b(vendor|supplier|agency|development partner|service provider)\b/i.test(text)) {
    return "VENDOR_REQUEST";
  }

  return "PROJECT_OPPORTUNITY";
}

function extractBudget(project: any) {
  const budget = project?.budget;

  if (!budget || typeof budget.minimum !== "number") {
    return {
      amount: null,
      minimum: null,
      maximum: null,
      currency: null,
      currencyId: null,
      status: "UNKNOWN",
      meetsMinimum: false,
    };
  }

  const currencyId =
    typeof budget.currency_id === "number"
      ? budget.currency_id
      : null;

  return {
    amount: budget.minimum,
    minimum: budget.minimum,
    maximum:
      typeof budget.maximum === "number"
        ? budget.maximum
        : null,
    currency: null,
    currencyId,
    status: "EXPLICIT_AMOUNT_CURRENCY_UNVERIFIED",
    meetsMinimum: false,
  };
}

function identifyCountry(project: any) {
  const code = String(
    project?.location?.country?.code || ""
  ).toUpperCase();

  if (!code) return null;

  return COUNTRIES.find(country => country.code === code) || null;
}

function getProjectUrl(project: any) {
  if (project.seo_url) {
    return `https://www.freelancer.com/projects/${project.seo_url}`;
  }

  return `https://www.freelancer.com/projects/${project.id}`;
}

function makeSignal(project: any, selectedCountry: string) {
  const title = String(project?.title || "");
  const description = String(
    project?.description ||
    project?.preview_description ||
    ""
  );

  const text = `${title}\n${description}`;

  if (!project?.id || !title || !description) {
    return null;
  }

  if (project.status !== "active") {
    return null;
  }

  if (EXCLUDED_TERMS.test(text)) {
    return null;
  }

  if (!SERVICE_TERMS.test(text)) {
    return null;
  }

  const country = identifyCountry(project);

  // Never guess the project country.
  if (!country || country.code !== selectedCountry) {
    return null;
  }

  const budget = extractBudget(project);

  const directBuyingIntent = BUYING_TERMS.test(text);

  let confidence = 70;

  if (SERVICE_TERMS.test(title)) {
    confidence += 10;
  }

  if (directBuyingIntent) {
    confidence += 5;
  }

  if (budget.status !== "UNKNOWN") {
    confidence += 5;
  }

  confidence = Math.min(confidence, 90);

  const organisation =
    project.owner_info?.username ||
    project.owner_info?.public_name ||
    null;

  const publishedAt = project.time_submitted
    ? new Date(project.time_submitted * 1000).toISOString()
    : null;

  return {
    id: `freelancer-${project.id}`,

    title,

    organisation,

    source: "Freelancer",

    sourceUrl: getProjectUrl(project),

    publishedAt,

    country: country.name,

    countryCode: country.code,

    intentType: classifyType(text),

    evidence: description.slice(0, 2500),

    matchedTerms: [
      ...new Set(
        text.match(
          /\b(software|website|developer|development|mobile app|android|ios|MVP|SaaS|AI|automation|blockchain|web3)\b/gi
        ) || []
      ),
    ],

    confidence,

    status: "ACTIVE_FREELANCER_PROJECT",

    budget,

    buyerClassification: "POTENTIAL_BUYER",

    verificationStatus: "NOT_VERIFIED",

    decisionMakerStatus: "NOT_VERIFIED",

    category: "DIRECT_BUYER",

    marketplace: {
      projectId: project.id,
      projectStatus: project.status,
      projectType: project.type || null,
      bidCount: project.bid_stats?.bid_count ?? null,
      averageBid: project.bid_stats?.bid_avg ?? null,
      ownerId: project.owner_id ?? null,
      ownerCountry:
        project.owner_info?.country?.name ?? null,
    },
  };
}

async function searchFreelancer(
  countryCode: string
) {
  const token = process.env.FREELANCER_ACCESS_TOKEN;

  if (!token) {
    return {
      results: [],
      errors: ["FREELANCER_ACCESS_TOKEN is not configured."],
      requestCount: 0,
    };
  }

  const results: any[] = [];
  const errors: string[] = [];

  const country = COUNTRIES.find(
    item => item.code === countryCode
  );

  if (!country) {
    return {
      results,
      errors: ["Unsupported country."],
      requestCount: 0,
    };
  }

  // One authenticated request for each targeted search term.
  // Requests are sequential to reduce rate-limit pressure.
  for (const query of SEARCH_TERMS) {
    const params = new URLSearchParams();

    params.set("query", query);

    params.append(
      "countries[]",
      countryCode.toLowerCase()
    );

    params.set("project_types[]", "fixed");
    params.append("project_types[]", "hourly");

    params.set("full_description", "true");
    params.set("job_details", "true");
    params.set("user_details", "true");
    params.set("location_details", "true");

    params.set("limit", "30");
    params.set("offset", "0");

    const url = `${FREELANCER_API}?${params.toString()}`;

    try {
      const response = await fetch(url, {
        method: "GET",

        headers: {
          "freelancer-oauth-v1": token,
          Accept: "application/json",
        },

        // Cache responses for five minutes.
        next: {
          revalidate: 300,
        },

        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        errors.push(
          `Freelancer "${query}" HTTP ${response.status}`
        );

        continue;
      }

      const data = await response.json();

      if (data.status !== "success") {
        errors.push(
          `Freelancer "${query}" returned an unsuccessful response.`
        );

        continue;
      }

      const projects =
        data.result?.projects ||
        data.result?.items ||
        (Array.isArray(data.result)
          ? data.result
          : []);

      for (const project of projects) {
        const signal = makeSignal(
          project,
          countryCode
        );

        if (signal) {
          results.push(signal);
        }
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `Freelancer "${query}": ${error.message}`
          : `Freelancer "${query}" search failed.`
      );
    }
  }

  return {
    results,
    errors,
    requestCount: SEARCH_TERMS.length,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const countryCode = (
      searchParams.get("country") || "US"
    ).toUpperCase();

    const requestedType =
      searchParams.get("type") || "";

    const minConfidence = Math.max(
      0,
      Math.min(
        100,
        Number(searchParams.get("minConfidence") || 60)
      )
    );

    const country = COUNTRIES.find(
      item => item.code === countryCode
    );

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
        {
          success: false,
          error: "Invalid opportunity type.",
        },
        { status: 400 }
      );
    }

    const freelancer = await searchFreelancer(
      countryCode
    );

    const unique = new Map<string, any>();

    for (const signal of freelancer.results) {
      if (signal.confidence < minConfidence) {
        continue;
      }

      if (
        requestedType &&
        signal.intentType !== requestedType
      ) {
        continue;
      }

      unique.set(signal.id, signal);
    }

    const signals = Array.from(
      unique.values()
    ).sort((a, b) => {
      return (
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
      );
    });

    return NextResponse.json({
      success: true,

      platform: "GODSLEAD",

      engine: "FREELANCER OFFICIAL PROJECT DISCOVERY",

      version: "6.0.0",

      generatedAt: new Date().toISOString(),

      configuration: {
        country: country.name,
        countryCode,

        minimumBudgetUSD: MINIMUM_BUDGET_USD,

        minimumConfidence: minConfidence,

        approvedCountries: COUNTRIES,

        services: [
          "Software development",
          "Website development",
          "Web applications",
          "Android and iOS applications",
          "AI and machine learning",
          "Automation",
          "Blockchain and Web3",
          "MVP and SaaS development",
          "Enterprise software",
          "IT outsourcing",
        ],
      },

      sources: [
        {
          name: "Freelancer",
          access: "Authenticated Official API",
          endpoint:
            "/projects/0.1/projects/active/",
          results: signals.length,
          requests: freelancer.requestCount,
        },
      ],

      summary: {
        totalSignals: signals.length,

        directBuyerSignals: signals.length,

        businessOpportunities: 0,

        budgetConfirmed: signals.filter(
          item =>
            item.budget.meetsMinimum
        ).length,

        budgetUnknown: signals.filter(
          item =>
            item.budget.status === "UNKNOWN" ||
            item.budget.status ===
              "EXPLICIT_AMOUNT_CURRENCY_UNVERIFIED"
        ).length,

        verifiedBuyers: 0,

        potentialBuyers: signals.length,
      },

      signals,

      diagnostics: {
        errors: freelancer.errors,
      },

      message:
        "Freelancer active projects are genuine marketplace project listings. They are potential buying opportunities, not independently verified organisations, budgets or decision-makers. Currency must be verified before treating a budget as USD 5,000 or more.",
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
```
