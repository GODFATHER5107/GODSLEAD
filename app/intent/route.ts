**GODSLEAD Buyer Intent Hunter — `app/api/intent/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ==========================================
// APPROVED COUNTRIES
// ==========================================

const MARKETS = [
  { name: "United States", code: "US", locale: "US:en" },
  { name: "Canada", code: "CA", locale: "CA:en" },
  { name: "United Kingdom", code: "GB", locale: "GB:en" },
  { name: "Ireland", code: "IE", locale: "IE:en" },
  { name: "Malta", code: "MT", locale: "MT:en" },
  { name: "Australia", code: "AU", locale: "AU:en" },
  { name: "New Zealand", code: "NZ", locale: "NZ:en" },
  { name: "Fiji", code: "FJ", locale: "FJ:en" },
  { name: "Papua New Guinea", code: "PG", locale: "PG:en" },
  { name: "United Arab Emirates", code: "AE", locale: "AE:en" },
  { name: "India", code: "IN", locale: "IN:en" },
  { name: "Singapore", code: "SG", locale: "SG:en" },
  { name: "Philippines", code: "PH", locale: "PH:en" },
  { name: "Malaysia", code: "MY", locale: "MY:en" },
  { name: "Jamaica", code: "JM", locale: "JM:en" },
  { name: "Trinidad and Tobago", code: "TT", locale: "TT:en" },
  { name: "Barbados", code: "BB", locale: "BB:en" },
  { name: "Bahamas", code: "BS", locale: "BS:en" },
  { name: "Belize", code: "BZ", locale: "BZ:en" },
  { name: "Guyana", code: "GY", locale: "GY:en" }
] as const;

// ==========================================
// BUYING INTENT SEARCH QUERIES
// ==========================================

const SEARCH_QUERIES = [
  '"request for proposal" software development',
  '"software development tender"',
  '"IT services tender"',
  '"website development tender"',
  '"mobile app development tender"',
  '"looking for software development company"',
  '"seeking software development partner"',
  '"request for quotation" software',
  '"IT outsourcing services" procurement',
  '"custom software development" RFP',
  '"web application development" procurement',
  '"technology vendor" request proposal'
];

// ==========================================
// TYPES
// ==========================================

type BuyerSignal = {
  id: string;
  title: string;
  organisation: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  country: string;
  countryCode: string;
  intentType: string;
  evidence: string;
  matchedTerms: string[];
  confidence: number;
  verificationStatus: string;
};

// ==========================================
// XML HELPERS
// ==========================================

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i")
  );

  return match ? decodeXml(match[1]) : "";
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ==========================================
// BUYER INTENT CLASSIFICATION
// ==========================================

function classifyIntent(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  const categories = [
    {
      type: "RFP_OR_TENDER",
      confidence: 95,
      terms: [
        "request for proposal",
        "request for quotation",
        "software development tender",
        "it services tender",
        "invitation to tender",
        "procurement notice",
        "request for bids"
      ]
    },
    {
      type: "VENDOR_REQUEST",
      confidence: 85,
      terms: [
        "looking for software development company",
        "seeking software development partner",
        "looking for a software developer",
        "seeking a technology vendor",
        "looking for an app developer"
      ]
    },
    {
      type: "PROJECT_OPPORTUNITY",
      confidence: 65,
      terms: [
        "website development project",
        "mobile application development",
        "custom software development",
        "digital transformation project",
        "web application development"
      ]
    }
  ];

  for (const category of categories) {
    const matched = category.terms.filter(term =>
      text.includes(term)
    );

    if (matched.length > 0) {
      return {
        type: category.type,
        confidence: category.confidence,
        matchedTerms: matched
      };
    }
  }

  return null;
}

// ==========================================
// ORGANISATION EXTRACTION
// ==========================================

function extractOrganisation(title: string): string | null {
  const match = title.match(
    /(?:by|from|issued by|published by)\s+([A-Z][A-Za-z0-9&.,' -]{2,60})/
  );

  return match?.[1]?.trim() || null;
}

// ==========================================
// SEARCH PUBLIC NEWS INDEX
// ==========================================

async function searchMarket(
  market: typeof MARKETS[number],
  query: string
): Promise<BuyerSignal[]> {

  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=en&gl=${market.code}&ceid=${market.locale}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100
