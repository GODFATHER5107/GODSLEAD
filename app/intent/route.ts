import { NextRequest, NextResponse } from "next/server";
import { resolveMx } from "node:dns/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = "8.1.0";
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

type RecordObject = Record<string, unknown>;

type Project = {
  id?: number | string;
  title?: string;
  description?: string;
  preview_description?: string;
  seo_url?: string;
  time_submitted?: number | string;
  owner_id?: number | string;
  owner_info?: RecordObject;
  user_details?: RecordObject;
  owner?: RecordObject;
  user?: RecordObject;
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

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function objectValue(value: unknown): RecordObject | null {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as RecordObject;
  }

  return null;
}

function firstText(
  object: RecordObject | null,
  keys: string[]
): string | null {
  if (!object) return null;

  for (const key of keys) {
    const value = textValue(object[key]);
    if (value) return value;
  }

  return null;
}

function extractProjects(data: unknown): Project[] {
  const projects: Project[] = [];
  const seen = new Set<string>();

  function visit(value: unknown, depth: number): void {
    if (depth > 8 || value == null) return;

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

function getOwner(project: Project): RecordObject | null {
  return (
    objectValue(project.owner_info) ||
    objectValue(project.user_details) ||
    objectValue(project.owner) ||
    objectValue(project.user)
  );
}

function getCountryCode(project: Project): string | null {
  const code = textValue(
    project.location?.country?.code
  ).toUpperCase();

  if (code && COUNTRIES[code]) return code;

  const name = textValue(
    project.location?.country?.name
  ).toUpperCase();

  return COUNTRY_NAMES[name] || null;
}

function getProjectUrl(project: Project): string {
  const slug = textValue(project.seo_url);

  if (
    slug.startsWith("https://") ||
    slug.startsWith("http://")
  ) {
    try {
      const url = new URL(slug);

      if (
        url.hostname === "www.freelancer.com" ||
        url.hostname === "freelancer.com"
      ) {
        return url.toString();
      }
    } catch {
      // Use the fallback URL.
    }
  }

  if (slug) {
    return (
      "https://www.freelancer.com/projects/" +
      encodeURIComponent(slug)
    );
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
  const submitted = numberValue(project.time_submitted);

  if (submitted && submitted > 0) {
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

function getMatches(project: Project) {
  const title = textValue(project.title).toLowerCase();

  const description = (
    textValue(project.description) ||
    textValue(project.preview_description)
  ).toLowerCase();

  const combined = title + " " + description;

  return {
    services: SERVICE_TERMS.filter(term =>
      combined.includes(term.toLowerCase())
    ),
    actions: ACTION_TERMS.filter(term =>
      combined.includes(term.toLowerCase())
    ),
  };
}

function isRelevantProject(
  project: Project,
  matches: { services: string[]; actions: string[] }
): boolean {
  if (!matches.services.length || !matches.actions.length) {
    return false;
  }

  const title = textValue(project.title).toLowerCase();

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

  return !excludedTerms.some(term => title.includes(term));
}

function extractEmails(value: string): string[] {
  const matches =
    value.match(
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g
    ) || [];

  const blocked = [
    "example.com",
    "domain.com",
    "email.com",
    "sentry.io",
    "wixpress.com",
  ];

  return Array.from(
    new Set(
      matches
        .map(email => email.toLowerCase())
        .filter(email => {
          const domain = email.split("@")[1];

          return (
            !blocked.includes(domain) &&
            !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)
          );
        })
    )
  ).slice(0, 10);
}

function extractPhones(value: string): string[] {
  const matches =
    value.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];

  return Array.from(
    new Set(
      matches
        .map(phone => phone.trim())
        .filter(phone => {
          const digits = phone.replace(/\D/g, "");
          return digits.length >= 8 && digits.length <= 15;
        })
    )
  ).slice(0, 10);
}

function isFreelancerUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "freelancer.com" ||
      hostname.endsWith(".freelancer.com")
    );
  } catch {
    return false;
  }
}

function extractCompanyWebsite(value: string): string | null {
  const matches =
    value.match(/https?:\/\/[^\s<>"']+/gi) || [];

  for (const match of matches) {
    const cleaned = match.replace(/[),.;!?]+$/, "");

    try {
      const url = new URL(cleaned);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        isFreelancerUrl(cleaned)
      ) {
        continue;
      }

      if (
        url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") ||
        url.hostname.endsWith(".local") ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1" ||
        url.hostname.startsWith("10.") ||
        url.hostname.startsWith("192.168.") ||
        url.hostname.startsWith("169.254.")
      ) {
        continue;
      }

      return url.origin;
    } catch {
      // Ignore malformed URLs.
    }
  }

  return null;
}

async function checkEmailDomain(email: string): Promise<{
  status: string;
  mx: boolean | null;
}> {
  const domain = email.split("@")[1];

  if (!domain) {
    return {
      status: "INVALID_FORMAT",
      mx: false,
    };
  }

  try {
    const records = await resolveMx(domain);

    if (records.length > 0) {
      return {
        status: "DOMAIN_MX_FOUND_MAILBOX_NOT_CONFIRMED",
        mx: true,
      };
    }

    return {
      status: "NO_MX_RECORD_FOUND",
      mx: false,
    };
  } catch {
    return {
      status: "MX_CHECK_UNAVAILABLE",
      mx: null,
    };
  }
}

function getBuyerInformation(project: Project) {
  const owner = getOwner(project);

  const name = firstText(owner, [
    "display_name",
    "displayName",
    "name",
    "full_name",
    "fullName",
  ]);

  const companyName = firstText(owner, [
    "company_name",
    "companyName",
    "business_name",
    "businessName",
  ]);

  const companyWebsiteRaw = firstText(owner, [
    "company_website",
    "companyWebsite",
    "website",
    "website_url",
  ]);

  const companyWebsite =
    companyWebsiteRaw &&
    !isFreelancerUrl(companyWebsiteRaw) &&
    extractCompanyWebsite(companyWebsiteRaw)
      ? extractCompanyWebsite(companyWebsiteRaw)
      : null;

  const ownerId =
    project.owner_id !== undefined &&
    String(project.owner_id) !== "null" &&
    String(project.owner_id) !== "0"
      ? String(project.owner_id)
      : null;

  const username = firstText(owner, [
    "username",
    "user_name",
    "userName",
  ]);

  const companyIdentified = Boolean(
    companyName && companyWebsite
  );

  return {
    ownerId,
    name,
    username,

    profileUrl: firstText(owner, [
      "profile_url",
      "profileUrl",
      "public_profile_url",
    ]),

    companyName,
    companyWebsite,

    identificationStatus: companyIdentified
      ? "COMPANY_DETAILS_RETURNED_NOT_INDEPENDENTLY_VERIFIED"
      : "COMPANY_NOT_IDENTIFIED",
  };
}

async function discoverContacts(project: Project) {
  const description =
    textValue(project.description) ||
    textValue(project.preview_description);

  const emails = extractEmails(description);
  const phones = extractPhones(description);
  const buyer = getBuyerInformation(project);

  const email = emails[0] || null;
  const phone = phones[0] || null;

  let emailStatus = "NOT_FOUND";
  let emailDomainMx: boolean | null = null;

  if (email) {
    const result = await checkEmailDomain(email);
    emailStatus = result.status;
    emailDomainMx = result.mx;
  }

  return {
    email,
    emailStatus,
    emailDomainMx,

    emailVerificationStatus: email
      ? "SYNTAX_CHECKED_DOMAIN_CHECKED_MAILBOX_NOT_CONFIRMED"
      : "NO_EMAIL_FOUND",

    phone,
    phoneStatus: phone
      ? "FORMAT_VALID_NOT_CALL_VERIFIED"
      : "NOT_FOUND",

    website: buyer.companyWebsite,

    contactPage: null,

    sourceUrl:
      email || phone
        ? getProjectUrl(project)
        : null,

    discoveryMethod:
      email || phone
        ? "PROJECT_DESCRIPTION"
        : "NO_PUBLIC_CONTACT_DETAILS_RETURNED",

    discoveredAt: new Date().toISOString(),
  };
}

async function createSignal(
  project: Project,
  countryCode: string,
  matches: { services: string[]; actions: string[] }
) {
  const description =
    textValue(project.description) ||
    textValue(project.preview_description);

  const minimum = numberValue(project.budget?.minimum);
  const maximum = numberValue(project.budget?.maximum);

  let confidence = 65;

  if (matches.services.length >= 2) confidence += 5;
  if (matches.actions.length >= 2) confidence += 5;
  if (description.length > 200) confidence += 5;

  confidence = Math.min(confidence, 80);

  const buyer = getBuyerInformation(project);
  const contact = await discoverContacts(project);

  return {
    id: "freelancer-" + String(project.id),

    title: textValue(project.title),

    organisation:
      buyer.companyName ||
      buyer.name ||
      "Organisation not identified",

    buyer: {
      ...buyer,
      verificationStatus: "NOT_INDEPENDENTLY_VERIFIED",
    },

    contact,

    source: "Freelancer",
    sourceUrl: getProjectUrl(project),
    publishedAt: getPublishedDate(project),

    country: COUNTRIES[countryCode],
    countryCode,

    countryEvidence:
      "Returned by Freelancer using its country-specific project search filter. Individual owner location may not be available.",

    intentType: "PROJECT_OPPORTUNITY",

    evidence: description || "No project description provided.",

    matchedTerms: [
      ...matches.services,
      ...matches.actions,
    ],

    confidence,

    status: "POTENTIAL_BUYER",

    budget: {
      minimum,
      maximum,
      currencyId: project.budget?.currency_id ?? null,
      currencyVerified: false,
      meetsMinimumBudget: false,
      qualificationStatus:
        "CURRENCY_NOT_VERIFIED_BUDGET_NOT_QUALIFIED",
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
        data: { signals: [] },
      },
      { status: 400 }
    );
  }

  const requestedConfidence = Number(
    request.nextUrl.searchParams.get("minConfidence") || 0
  );

  const minConfidence = Number.isFinite(requestedConfidence)
    ? Math.max(0, Math.min(100, requestedConfidence))
    : 0;

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

  const signals = [];

  const diagnostics = {
    searchesAttempted: SEARCH_TERMS.length,
    searchesSuccessful: successfulSearches,
    projectsReceived: allProjects.length,
    uniqueProjects: projects.length,
    missingCountry: 0,
    countryMismatch: 0,
    matchingServiceProjects: 0,
    rejectedProjects: 0,

    companiesIdentified: 0,
    companiesNotIdentified: 0,

    contactsWithEmail: 0,
    contactsWithPhone: 0,
    contactsWithBoth: 0,
    contactsWithoutDetails: 0,

    emailDomainsWithMx: 0,
    emailMailboxesConfirmed: 0,
    phoneNumbersCallVerified: 0,

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

    const signal = await createSignal(
      project,
      countryCode,
      matches
    );

    if (signal.confidence < minConfidence) continue;

    if (signal.buyer.companyName) {
      diagnostics.companiesIdentified++;
    } else {
      diagnostics.companiesNotIdentified++;
    }

    if (signal.contact.email) {
      diagnostics.contactsWithEmail++;
    }

    if (signal.contact.phone) {
      diagnostics.contactsWithPhone++;
    }

    if (
      signal.contact.email &&
      signal.contact.phone
    ) {
      diagnostics.contactsWithBoth++;
    }

    if (
      !signal.contact.email &&
      !signal.contact.phone
    ) {
      diagnostics.contactsWithoutDetails++;
    }

    if (signal.contact.emailDomainMx === true) {
      diagnostics.emailDomainsWithMx++;
    }

    signals.push(signal);
  }

  signals.sort((a, b) =>
    new Date(b.publishedAt).getTime() -
    new Date(a.publishedAt).getTime()
  );

  return NextResponse.json({
    success: true,
    version: VERSION,

    source: "Freelancer API with conservative contact extraction",

    capabilities: {
      freelancerProjectSearch: true,
      companyDiscovery: false,
      independentCompanyVerification: false,
      publicWebsiteCrawling: false,
      emailSyntaxExtraction: true,
      emailDomainMxCheck: true,
      mailboxVerification: false,
      phoneFormatExtraction: true,
      phoneCallVerification: false,
    },

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

      companiesIdentified: diagnostics.companiesIdentified,
      companiesNotIdentified: diagnostics.companiesNotIdentified,

      contactsWithEmail: diagnostics.contactsWithEmail,
      contactsWithPhone: diagnostics.contactsWithPhone,
      contactsWithBoth: diagnostics.contactsWithBoth,
      contactsWithoutDetails: diagnostics.contactsWithoutDetails,

      emailDomainsWithMx: diagnostics.emailDomainsWithMx,

      emailMailboxesConfirmed: 0,
      phoneNumbersCallVerified: 0,
    },

    data: {
      signals,
    },
  });
}
