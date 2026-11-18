import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL =
  "https://www.freelancer.com/api/projects/0.1/projects/active/";

const VERSION = "7.0.0";

const COUNTRIES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  MT: "Malta",
  AU: "Australia",
  NZ: "New Zealand",
  FJ: "Fiji",
  PG: "Papua New Guinea",
  AE: "United Arab Emirates",
  IN: "India",
  SG: "Singapore",
  PH: "Philippines",
  MY: "Malaysia",
  JM: "Jamaica",
  TT: "Trinidad and Tobago",
  BB: "Barbados",
  BS: "Bahamas",
  BZ: "Belize",
  GY: "Guyana",
};

const SEARCH_TERMS = [
  "software development",
  "website development",
  "mobile app development",
  "AI automation",
  "blockchain development",
  "MVP SaaS",
];

const SERVICE_TERMS = [
  "software",
  "website",
  "web development",
  "web application",
  "mobile app",
  "android",
  "ios",
  "blockchain",
  "web3",
  "artificial intelligence",
  "AI automation",
  "machine learning",
  "MVP",
  "SaaS",
  "application development",
  "app development",
  "custom development",
  "IT outsourcing",
  "dedicated developer",
];

type FreelancerProject = {
  id?: number | string;
  title?: string;
  description?: string;
  preview_description?: string;
  seo_url?: string;
  status?: string;
  time_submitted?: number | string;
  time_updated?: number | string;
  currency?: {
    id?: number | string;
    code?: string;
    sign?: string;
  };
  budget?: {
    minimum?: number | string;
    maximum?: number | string;
    name?: string;
    project_type?: string;
    currency_id?: number | string;
  };
  location?: {
    country?: {
      code?: string;
      name?: string;
    };
  };
};

type Signal = {
  id: string;
  title: string;
  organisation: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  country: string;
  countryCode: string;
  intentType: string;
  evidence: string;
  matchedTerms: string[];
  confidence: number;
  status: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function extractProjects(data: unknown): FreelancerProject[] {
  const found: FreelancerProject[] = [];
  const seen = new Set<string>();

  function visit(value: unknown, depth: number): void {
    if (depth > 8 || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
      }

      return;
    }

    if (typeof value !== "object") {
      return;
    }

    const object = value as Record<string, unknown>;

    const looksLikeProject =
      object.id !== undefined &&
      typeof object.title === "string" &&
      (object.budget !== undefined ||
        object.description !== undefined ||
        object.preview_description !== undefined);

    if (looksLikeProject) {
      const project = object as FreelancerProject;
      const id = String(project.id);

      if (!seen.has(id)) {
        seen.add(id);
        found.push(project);
      }

      return;
    }

    for (const child of Object.values(object)) {
      visit(child, depth + 1);
    }
  }

  visit(data, 0);

  return found;
}

function getProjectUrl(project: FreelancerProject): string {
  const id = project.id ? String(project.id) : "";

  const slug = asText(project.seo_url).trim();

  if (slug.startsWith("https://") || slug.startsWith("http://")) {
    return slug;
  }

  if (slug) {
    return `https://www.freelancer.com/projects/${slug}`;
  }

  if (id) {
    return `https://www.freelancer.com/projects/${id}`;
  }

  return "https://www.freelancer.com/search/projects";
}

function getPublishedDate(project: FreelancerProject): string {
  const submitted = asNumber(project.time_submitted);

  if (submitted !== null) {
    const milliseconds = submitted > 10_000_000_000
      ? submitted
      : submitted * 1000;

    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function findMatchedTerms(text: string): string[] {
  const lowerText = text.toLowerCase();

  return SERVICE_TERMS.filter((term) =>
    lowerText.includes(term.toLowerCase())
  );
}

function makeSignal(
  project: FreelancerProject,
  requestedCountryCode: string
): Signal | null {
  const title = asText(project.title).trim();

  const description =
    asText(project.description).trim() ||
    asText(project.preview_description).trim();

  if (!title) {
    return null;
  }

  const projectCountryCode = asText(
    project.location?.country?.code
  ).toUpperCase();

  // Never assign a country when the API has not identified it.
  // Never accept a project from a different country.
  if (projectCountryCode !== requestedCountryCode) {
    return null;
  }

  const combinedText = `${title} ${description}`;
  const matchedTerms = findMatchedTerms(combinedText);

  if (matchedTerms.length === 0) {
    return null;
  }

  const minimum = asNumber(project.budget?.minimum);
  const maximum = asNumber(project.budget?.maximum);

  const hasBudget = minimum !== null || maximum !== null;

  let confidence = 60;

  if (matchedTerms.length >= 2) {
    confidence += 10;
  }

  if (description.length > 100) {
    confidence += 5;
  }

  if (hasBudget) {
    confidence += 5;
  }

  confidence = Math.min(confidence, 80);

  const budgetEvidence = hasBudget
    ? `Budget listed by Freelancer: minimum ${minimum ?? "not specified"}, maximum ${maximum ?? "not specified"}. Currency has not been independently verified.`
    : "No explicit budget amount was identified.";

  const evidence = [
    `Freelancer project listing: ${title}.`,
    description,
    budgetEvidence,
  ]
    .filter(Boolean)
    .join(" ");

  const projectId = String(project.id ?? title);

  return {
    id: `freelancer-${projectId}`,
    title,
    organisation: "Freelancer project owner (organisation not independently verified)",
    source: "Freelancer",
    sourceUrl: getProjectUrl(project),
    publishedAt: getPublishedDate(project),
    country: COUNTRIES[requestedCountryCode],
    countryCode: requestedCountryCode,
    intentType: "PROJECT_OPPORTUNITY",
    evidence,
    matchedTerms,
    confidence,
    status: "POTENTIAL_BUYER",
  };
}

async function searchFreelancer(
  token: string,
  countryCode: string,
  searchTerm: string
): Promise<{
  projects: FreelancerProject[];
  error?: string;
}> {
  const params = new URLSearchParams();

  params.set("query", searchTerm);
  params.append("countries[]", countryCode.toLowerCase());
  params.append("project_types[]", "fixed");
  params.append("project_types[]", "hourly");
  params.set("full_description", "true");
  params.set("job_details", "true");
  params.set("user_details", "true");
  params.set("location_details", "true");
  params.set("limit", "30");
  params.set("offset", "0");

  const url = `${API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Freelancer-OAuth-V1": token,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return {
        projects: [],
        error: `Freelancer returned HTTP ${response.status}.`,
      };
    }

    const data: unknown = await response.json();

    return {
      projects: extractProjects(data),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown request error";

    return {
      projects: [],
      error: message,
    };
  }
}

export async function GET(request: NextRequest) {
  const token = process.env.FREELANCER_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        version: VERSION,
        error: "FREELANCER_ACCESS_TOKEN is not configured.",
        instructions:
          "Add FREELANCER_ACCESS_TOKEN to the Vercel Production environment variables and redeploy.",
        data: {
          signals: [],
        },
      },
      { status: 503 }
    );
  }

  const requestedCountry = (
    request.nextUrl.searchParams.get("country") || "US"
  ).toUpperCase();

  if (!COUNTRIES[requestedCountry]) {
    return NextResponse.json(
      {
        success: false,
        version: VERSION,
        error: `Unsupported country code: ${requestedCountry}`,
        supportedCountries: Object.keys(COUNTRIES),
        data: {
          signals: [],
        },
      },
      { status: 400 }
    );
  }

  const minConfidence = Math.max(
    0,
    Math.min(
      100,
      Number(request.nextUrl.searchParams.get("minConfidence") || 0)
    )
  );

  const allProjects: FreelancerProject[] = [];
  const errors: string[] = [];
  const successfulSearches: string[] = [];

  for (const searchTerm of SEARCH_TERMS) {
    const result = await searchFreelancer(
      token,
      requestedCountry,
      searchTerm
    );

    if (result.error) {
      errors.push(`${searchTerm}: ${result.error}`);
      continue;
    }

    successfulSearches.push(searchTerm);
    allProjects.push(...result.projects);
  }

  const uniqueProjects = new Map<string, FreelancerProject>();

  for (const project of allProjects) {
    if (project.id !== undefined) {
      uniqueProjects.set(String(project.id), project);
    }
  }

  const signals = Array.from(uniqueProjects.values())
    .map((project) => makeSignal(project, requestedCountry))
    .filter((signal): signal is Signal => signal !== null)
    .filter((signal) => signal.confidence >= minConfidence)
    .sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();

      return dateB - dateA;
    });

  return NextResponse.json({
    success: true,
    version: VERSION,
    source: "Freelancer API",
    country: {
      code: requestedCountry,
      name: COUNTRIES[requestedCountry],
    },
    diagnostics: {
      searchesAttempted: SEARCH_TERMS.length,
      searchesSuccessful: successfulSearches.length,
      projectsReceived: allProjects.length,
      uniqueProjects: uniqueProjects.size,
      matchingSignals: signals.length,
      errors,
    },
    summary: {
      totalSignals: signals.length,
      verifiedBuyers: 0,
      potentialBuyers: signals.length,
      rejectedBuyers: 0,
    },
    data: {
      signals,
    },
  });
}
