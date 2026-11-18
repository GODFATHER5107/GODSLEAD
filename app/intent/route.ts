import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = "7.3.0";

const API_URL =
  "https://www.freelancer.com/api/projects/0.1/projects/active/";

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

const COUNTRY_NAMES: Record<string, string> = {
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  USA: "US",
  CANADA: "CA",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  IRELAND: "IE",
  MALTA: "MT",
  AUSTRALIA: "AU",
  "NEW ZEALAND": "NZ",
  FIJI: "FJ",
  "PAPUA NEW GUINEA": "PG",
  "UNITED ARAB EMIRATES": "AE",
  UAE: "AE",
  INDIA: "IN",
  SINGAPORE: "SG",
  PHILIPPINES: "PH",
  MALAYSIA: "MY",
  JAMAICA: "JM",
  "TRINIDAD AND TOBAGO": "TT",
  BARBADOS: "BB",
  BAHAMAS: "BS",
  BELIZE: "BZ",
  GUYANA: "GY",
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
  "software development",
  "custom software",
  "website development",
  "web development",
  "web application",
  "web app",
  "website",
  "mobile app",
  "android app",
  "ios app",
  "application development",
  "app development",
  "API development",
  "backend development",
  "frontend development",
  "full stack",
  "SaaS platform",
  "MVP",
  "blockchain development",
  "web3 development",
  "AI automation",
  "artificial intelligence",
  "machine learning",
  "automation development",
  "IT outsourcing",
  "dedicated development team",
];

const ACTION_TERMS = [
  "build",
  "building",
  "develop",
  "developing",
  "development",
  "create",
  "creating",
  "redesign",
  "fix",
  "improve",
  "integrate",
  "implement",
  "maintain",
  "upgrade",
  "migrate",
  "launch",
  "deploy",
  "program",
  "coding",
  "engineering",
  "hire",
  "looking for",
  "need a developer",
  "seeking a developer",
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
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }

  return null;
}

function extractProjects(data: unknown): Project[] {
  const projects: Project[] = [];
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

function getCountryCode(project: Project): string | null {
  const code = getText(
    project.location?.country?.code
  ).toUpperCase();

  if (code && COUNTRIES[code]) {
    return code;
  }

  const name = getText(
    project.location?.country?.name
  ).toUpperCase();

  return COUNTRY_NAMES[name] || null;
}

function getProjectUrl(project: Project): string {
  const slug = getText(project.seo_url);

  if (
    slug.startsWith("https://") ||
    slug.startsWith("http://")
  ) {
    return slug;
  }

  if (slug) {
    return "https://www.freelancer.com/projects/" + slug;
  }

  if (project.id !== undefined) {
    return (
      "https://www.freelancer.com/projects/" +
      String(project.id)
    );
  }

  return "https://www.freelancer.com/search/projects";
}

function getPublishedDate(project: Project): string {
  const submitted = getNumber(project.time_submitted);

  if (submitted !== null && submitted > 0) {
    const milliseconds =
      submitted > 10000000000
        ? submitted
        : submitted * 1000;

    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function getMatches(project: Project): {
  services: string[];
  actions: string[];
} {
  const title = getText(project.title).toLowerCase();

  const description = (
    getText(project.description) ||
    getText(project.preview_description)
  ).toLowerCase();

  const combined = title + " " + description;

  return {
    services: SERVICE_TERMS.filter((term) =>
      combined.includes(term.toLowerCase())
    ),
    actions: ACTION_TERMS.filter((term) =>
      combined.includes(term.toLowerCase())
    ),
  };
}

function isRelevantProject(
  project: Project,
  matches: { services: string[]; actions: string[] }
): boolean {
  if (matches.services.length === 0) {
    return false;
  }

  if (matches.actions.length === 0) {
    return false;
  }

  const title = getText(project.title).toLowerCase();

  const excludedTerms = [
    "logo design",
    "tax filing",
    "house plans",
    "construction drawings",
    "video editing",
    "portrait retouching",
    "virtual assistant",
    "job application assistant",
    "cold calling",
    "screenplay",
  ];

  if (excludedTerms.some((term) => title.includes(term))) {
    return false;
  }

  return true;
}

function createSignal(
  project: Project,
  countryCode: string,
  matches: { services: string[]; actions: string[] }
) {
  const description =
    getText(project.description) ||
    getText(project.preview_description);

  const minimum = getNumber(project.budget?.minimum);
  const maximum = getNumber(project.budget?.maximum);

  let confidence = 65;

  if (matches.services.length >= 2) confidence += 5;
  if (matches.actions.length >= 2) confidence += 5;
  if (description.length > 200) confidence += 5;

  confidence = Math.min(confidence, 80);

  return {
    id: "freelancer-" + String(project.id),
    title: getText(project.title),
    organisation:
      "Freelancer project owner (organisation not independently verified)",
    source: "Freelancer",
    sourceUrl: getProjectUrl(project),
    publishedAt: getPublishedDate(project),
    country: COUNTRIES[countryCode],
    countryCode,
    countryEvidence:
      "Returned by Freelancer using its country-specific search filter. Individual owner location was not provided.",
    intentType: "PROJECT_OPPORTUNITY",
    evidence:
      description || "No project description provided.",
    matchedTerms: [
      ...matches.services,
      ...matches.actions,
    ],
    confidence,
    status: "POTENTIAL_BUYER",
    budget: {
      minimum,
      maximum,
      currencyVerified: false,
      meetsMinimumBudget: false,
    },
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
      API_URL + "?" + params.toString(),
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
        error: "Freelancer HTTP " + response.status,
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

  if (!token || !token.trim()) {
    return NextResponse.json(
      {
        success: false,
        version: VERSION,
        error: "Freelancer access token is missing.",
        data: { signals: [] },
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
        version: VERSION,
        error: "Unsupported country code.",
        supportedCountries: Object.keys(COUNTRIES),
        data: { signals: [] },
      },
      { status: 400 }
    );
  }

  const minConfidence = Math.max(
    0,
    Math.min(
      100,
      Number(
        request.nextUrl.searchParams.get("minConfidence") || 0
      )
    )
  );

  const allProjects: Project[] = [];
  const errors: string[] = [];

  let successfulSearches = 0;

  for (const searchTerm of SEARCH_TERMS) {
    const result = await searchFreelancer(
      token,
      countryCode,
      searchTerm
    );

    if (result.error) {
      errors.push(searchTerm + ": " + result.error);
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

  const signals: ReturnType<typeof createSignal>[] = [];

  const diagnostics = {
    searchesAttempted: SEARCH_TERMS.length,
    searchesSuccessful: successfulSearches,
    projectsReceived: allProjects.length,
    uniqueProjects: projects.length,
    missingCountry: 0,
    countryMismatch: 0,
    matchingServiceProjects: 0,
    rejectedProjects: 0,
    countryFilterUsed: countryCode.toLowerCase(),
    errors,
  };

  for (const project of projects) {
    const actualCountry = getCountryCode(project);

    if (actualCountry && actualCountry !== countryCode) {
      diagnostics.countryMismatch++;
      diagnostics.rejectedProjects++;
      continue;
    }

    if (!actualCountry) {
      diagnostics.missingCountry++;
    }

    const matches = getMatches(project);

    if (!isRelevantProject(project, matches)) {
      diagnostics.rejectedProjects++;
      continue;
    }

    diagnostics.matchingServiceProjects++;

    const signal = createSignal(
      project,
      countryCode,
      matches
    );

    if (signal.confidence >= minConfidence) {
      signals.push(signal);
    }
  }

  signals.sort((a, b) => {
    return (
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
    );
  });

  return NextResponse.json({
    success: true,
    version: VERSION,
    source: "Freelancer API",
    country: {
      code: countryCode,
      name: COUNTRIES[countryCode],
    },
    diagnostics,
    summary: {
      totalSignals: signals.length,
      verifiedBuyers: 0,
      potentialBuyers: signals.length,
      rejectedBuyers: diagnostics.rejectedProjects,
    },
    data: {
      signals,
    },
  });
}
