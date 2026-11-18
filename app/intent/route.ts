import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL =
  "https://www.freelancer.com/api/projects/0.1/projects/active/";

const VERSION = "7.1.0";

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

type Project = {
  id?: number | string;
  title?: string;
  description?: string;
  preview_description?: string;
  seo_url?: string;
  time_submitted?: number | string;
  budget?: {
    minimum?: number | string;
    maximum?: number | string;
    currency_id?: number | string;
  };
  location?: {
    country?: {
      code?: string;
      name?: string;
    };
  };
};

function getText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractProjects(data: unknown): Project[] {
  const projects: Project[] = [];
  const seen = new Set<string>();

  function visit(value: unknown, depth: number): void {
    if (depth > 8 || value === null || value === undefined) return;

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    if (typeof value !== "object") return;

    const object = value as Record<string, unknown>;

    if (
      object.id !== undefined &&
      typeof object.title === "string"
    ) {
      const id = String(object.id);

      if (!seen.has(id)) {
        seen.add(id);
        projects.push(object as Project);
      }

      return;
    }

    for (const child of Object.values(object)) {
      visit(child, depth + 1);
    }
  }

  visit(data, 0);
  return projects;
}

function getMatchedTerms(project: Project): string[] {
  const text = (
    getText(project.title) +
    " " +
    getText(project.description) +
    " " +
    getText(project.preview_description)
  ).toLowerCase();

  return SERVICE_TERMS.filter((term) =>
    text.includes(term.toLowerCase())
  );
}

function getProjectUrl(project: Project): string {
  const slug = getText(project.seo_url).trim();

  if (slug.startsWith("https://") || slug.startsWith("http://")) {
    return slug;
  }

  if (slug) {
    return `https://www.freelancer.com/projects/${slug}`;
  }

  return `https://www.freelancer.com/projects/${project.id}`;
}

function makeSignal(
  project: Project,
  countryCode: string,
  matchedTerms: string[]
) {
  const title = getText(project.title).trim();

  const description =
    getText(project.description) ||
    getText(project.preview_description);

  const submitted = Number(project.time_submitted);

  const publishedAt =
    Number.isFinite(submitted) && submitted > 0
      ? new Date(
          submitted > 10_000_000_000
            ? submitted
            : submitted * 1000
        ).toISOString()
      : new Date().toISOString();

  return {
    id: `freelancer-${project.id}`,
    title,
    organisation: "Freelancer project owner (not independently verified)",
    source: "Freelancer",
    sourceUrl: getProjectUrl(project),
    publishedAt,
    country: COUNTRIES[countryCode],
    countryCode,
    intentType: "PROJECT_OPPORTUNITY",
    evidence: description,
    matchedTerms,
    confidence: 65,
    status: "POTENTIAL_BUYER",
  };
}

async function searchFreelancer(
  token: string,
  countryCode: string,
  searchTerm: string
): Promise<{
  projects: Project[];
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

  try {
    const response = await fetch(
      `${API_URL}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Freelancer-OAuth-V1": token,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) {
      return {
        projects: [],
        error: `Freelancer HTTP ${response.status}`,
      };
    }

    const data: unknown = await response.json();

    return {
      projects: extractProjects(data),
    };
  } catch (error) {
    return {
      projects: [],
      error:
        error instanceof Error
          ? error.message
          : "Unknown request error",
    };
  }
}

export async function GET(request: NextRequest) {
  const token = process.env.FREELANCER_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Freelancer token is missing.",
      },
      { status: 503 }
    );
  }

  const countryCode = (
    request.nextUrl.searchParams.get("country") || "US"
  ).toUpperCase();

  if (!COUNTRIES[countryCode]) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported country.",
        supportedCountries: Object.keys(COUNTRIES),
      },
      { status: 400 }
    );
  }

  const allProjects: Project[] = [];
  const errors: string[] = [];
  let successfulSearches = 0;

  for (const term of SEARCH_TERMS) {
    const result = await searchFreelancer(
      token,
      countryCode,
      term
    );

    if (result.error) {
      errors.push(`${term}: ${result.error}`);
    } else {
      successfulSearches++;
      allProjects.push(...result.projects);
    }
  }

  const uniqueProjects = new Map<string, Project>();

  for (const project of allProjects) {
    if (project.id !== undefined) {
      uniqueProjects.set(String(project.id), project);
    }
  }

  const projects = Array.from(uniqueProjects.values());

  let missingCountry = 0;
  let differentCountry = 0;
  let noServiceMatch = 0;
  let matchingProjects = 0;

  const countryValues: Record<string, number> = {};
  const sampleProjects: Array<Record<string, unknown>> = [];
  const signals = [];

  for (const project of projects) {
    const actualCountryCode = getText(
      project.location?.country?.code
    ).toUpperCase();

    const actualCountryName = getText(
      project.location?.country?.name
    );

    const matchedTerms = getMatchedTerms(project);

    const combinedText =
      getText(project.title) +
      " " +
      getText(project.description) +
      " " +
      getText(project.preview_description);

    let rejectionReason = "MATCHED";

    if (!actualCountryCode) {
      missingCountry++;
      rejectionReason = "COUNTRY_MISSING";
    } else if (actualCountryCode !== countryCode) {
      differentCountry++;
      rejectionReason = "COUNTRY_MISMATCH";
    } else if (matchedTerms.length === 0) {
      noServiceMatch++;
      rejectionReason = "NO_SERVICE_KEYWORD_MATCH";
    } else {
      matchingProjects++;
      signals.push(
        makeSignal(project, countryCode, matchedTerms)
      );
    }

    const countryLabel =
      actualCountryCode || actualCountryName || "UNKNOWN";

    countryValues[countryLabel] =
      (countryValues[countryLabel] || 0) + 1;

    if (sampleProjects.length < 30) {
      sampleProjects.push({
        id: project.id,
        title: getText(project.title),
        countryCode: actualCountryCode || null,
        countryName: actualCountryName || null,
        matchedTerms,
        rejectionReason,
        descriptionPreview: combinedText.slice(0, 350),
      });
    }
  }

  return NextResponse.json({
    success: true,
    version: VERSION,
    source: "Freelancer API",
    requestedCountry: {
      code: countryCode,
      name: COUNTRIES[countryCode],
    },
    diagnostics: {
      searchesAttempted: SEARCH_TERMS.length,
      searchesSuccessful: successfulSearches,
      projectsReceived: allProjects.length,
      uniqueProjects: projects.length,
      matchingProjects,
      missingCountry,
      differentCountry,
      noServiceMatch,
      countryValues,
      errors,
    },
    sampleProjects,
    summary: {
      totalSignals: signals.length,
      verifiedBuyers: 0,
      potentialBuyers: signals.length,
    },
    data: {
      signals,
    },
  });
}
