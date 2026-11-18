"use client";

import { useEffect, useState } from "react";

const COUNTRIES = [
  { name: "United States", code: "US" },
  { name: "Canada", code: "CA" },
  { name: "United Kingdom", code: "GB" },
  { name: "Ireland", code: "IE" },
  { name: "Malta", code: "MT" },
  { name: "Australia", code: "AU" },
  { name: "New Zealand", code: "NZ" },
  { name: "Fiji", code: "FJ" },
  { name: "Papua New Guinea", code: "PG" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "India", code: "IN" },
  { name: "Singapore", code: "SG" },
  { name: "Philippines", code: "PH" },
  { name: "Malaysia", code: "MY" },
  { name: "Jamaica", code: "JM" },
  { name: "Trinidad and Tobago", code: "TT" },
  { name: "Barbados", code: "BB" },
  { name: "Bahamas", code: "BS" },
  { name: "Belize", code: "BZ" },
  { name: "Guyana", code: "GY" },
];

const SERVICES = [
  { label: "All opportunities", value: "" },
  { label: "Software development tenders", value: "RFP_OR_TENDER" },
  { label: "Vendor requests", value: "VENDOR_REQUEST" },
  { label: "Project opportunities", value: "PROJECT_OPPORTUNITY" },
];

type Contact = {
  email: string | null;
  emailStatus: string;
  emailDomainMx: boolean | null;
  phone: string | null;
  phoneStatus: string;
  website: string | null;
  contactPage: string | null;
  sourceUrl: string | null;
  discoveredAt: string;
};

type Signal = {
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
  status: string;
  contact?: Contact;
  budget?: {
    minimum: number | null;
    maximum: number | null;
    currencyId: number | string | null;
    currencyVerified: boolean;
    meetsMinimumBudget: boolean;
  };
};

const styles: Record<string, React.CSSProperties> = {
  button: {
    border: "none",
    borderRadius: 7,
    padding: "11px 16px",
    background: "#0284c7",
    color: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: 12,
    border: "1px solid #334155",
    borderRadius: 7,
    background: "#0b1220",
    color: "white",
    marginTop: 8,
  },
  card: {
    background: "#111827",
    border: "1px solid #263244",
    borderRadius: 10,
    padding: 20,
  },
};

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [country, setCountry] = useState("US");
  const [service, setService] = useState("");
  const [minimumConfidence, setMinimumConfidence] = useState("60");

  const [signals, setSignals] = useState<Signal[]>([]);
  const [saved, setSaved] = useState<Signal[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("godslead-saved");
      if (stored) setSaved(JSON.parse(stored));
    } catch {
      setSaved([]);
    }
  }, []);

  function saveOpportunity(signal: Signal) {
    const updated = saved.some(item => item.id === signal.id)
      ? saved
      : [...saved, signal];

    setSaved(updated);
    localStorage.setItem("godslead-saved", JSON.stringify(updated));
  }

  function removeOpportunity(id: string) {
    const updated = saved.filter(item => item.id !== id);
    setSaved(updated);
    localStorage.setItem("godslead-saved", JSON.stringify(updated));
  }

  async function searchOpportunities() {
    setLoading(true);
    setError("");
    setSignals([]);
    setSearched(false);

    try {
      const params = new URLSearchParams({
        country,
        minConfidence: minimumConfidence,
      });

      if (service) params.set("type", service);

      const response = await fetch(
        `/intent?${params.toString()}`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "The search could not be completed."
        );
      }

      const receivedSignals =
        result?.data?.signals ?? result?.signals;

      if (!Array.isArray(receivedSignals)) {
        throw new Error("The signals list was not found.");
      }

      setSignals(receivedSignals);
      setSearched(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to GODSLEAD."
      );
    } finally {
      setLoading(false);
    }
  }

  const menu = [
    "Dashboard",
    "Buyer Intent Hunter",
    "Saved Opportunities",
    "Company Intelligence",
    "Decision Maker Finder",
    "AI Sales Writer",
    "Email Management",
    "Meeting Scheduler",
    "CRM Pipeline",
    "Analytics",
    "Settings",
  ];

  function renderContact(contact?: Contact) {
    if (!contact) {
      return (
        <div style={{ color: "#fbbf24" }}>
          Contact discovery information unavailable.
        </div>
      );
    }

    return (
      <div style={{
        background: "#0b1220",
        padding: 15,
        borderRadius: 8,
        marginTop: 15,
      }}>
        <h4 style={{ color: "#38bdf8", marginTop: 0 }}>
          Verified Contact Discovery
        </h4>

        <p>
          <strong>Business email:</strong>{" "}
          {contact.email || "Not found"}
        </p>

        <p style={{ color: "#94a3b8", fontSize: 12 }}>
          Email status: {contact.emailStatus}
        </p>

        <p>
          <strong>Business phone:</strong>{" "}
          {contact.phone || "Not found"}
        </p>

        <p style={{ color: "#94a3b8", fontSize: 12 }}>
          Phone status: {contact.phoneStatus}
        </p>

        <p>
          <strong>Company website:</strong>{" "}
          {contact.website ? (
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8" }}
            >
              Open website ↗
            </a>
          ) : (
            "Not found"
          )}
        </p>

        <p>
          <strong>Contact page:</strong>{" "}
          {contact.contactPage ? (
            <a
              href={contact.contactPage}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8" }}
            >
              Open contact page ↗
            </a>
          ) : (
            "Not found"
          )}
        </p>

        <p style={{ color: "#94a3b8", fontSize: 12 }}>
          Contact source:{" "}
          {contact.sourceUrl ? (
            <a
              href={contact.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8" }}
            >
              View evidence ↗
            </a>
          ) : (
            "Not available"
          )}
        </p>

        <p style={{ color: "#94a3b8", fontSize: 11 }}>
          Discovered: {new Date(contact.discoveredAt).toLocaleString()}
        </p>

        <p style={{ color: "#fbbf24", fontSize: 11 }}>
          MX verification checks the email domain's mail configuration,
          not the existence of an individual mailbox. Phone validation
          checks format, not whether the number is active or belongs
          to the buyer.
        </p>
      </div>
    );
  }

  function renderSignals(items: Signal[]) {
    if (!items.length) {
      return (
        <div style={{ ...styles.card, textAlign: "center", padding: 35 }}>
          <h3>No opportunities found</h3>
          <p style={{ color: "#94a3b8" }}>
            Try another country or lower the confidence filter.
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 15 }}>
        {items.map(signal => (
          <article key={signal.id} style={styles.card}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 15,
              flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <span style={{
                  color: "#38bdf8",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {signal.intentType.replaceAll("_", " ")}
                </span>

                <h3 style={{ margin: "10px 0" }}>
                  {signal.title}
                </h3>

                <p style={{ color: "#94a3b8", fontSize: 13 }}>
                  Organisation: {signal.organisation || "Not identified"}
                </p>

                <p style={{ color: "#94a3b8", fontSize: 13 }}>
                  Country: {signal.country}
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{
                  color: "#4ade80",
                  fontSize: 22,
                  fontWeight: 700,
                }}>
                  {signal.confidence}
                </div>
                <small style={{ color: "#94a3b8" }}>
                  Keyword score
                </small>
              </div>
            </div>

            <div style={{
              background: "#0b1220",
              padding: 13,
              borderRadius: 7,
              marginTop: 12,
              color: "#cbd5e1",
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              <strong>Project evidence:</strong>
              <p>{signal.evidence}</p>
            </div>

            {renderContact(signal.contact)}

            <p style={{ color: "#94a3b8", fontSize: 12 }}>
              Source: {signal.source}
            </p>

            <div style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 15,
            }}>
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.button,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                View Original Project ↗
              </a>

              <button
                style={styles.button}
                onClick={() => saveOpportunity(signal)}
              >
                {saved.some(item => item.id === signal.id)
                  ? "Saved ✓"
                  : "Save Opportunity"}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#090d16",
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      display: "flex",
    }}>
      <aside style={{
        width: 245,
        minWidth: 210,
        background: "#111827",
        padding: 18,
        borderRight: "1px solid #263244",
      }}>
        <h1 style={{ color: "#38bdf8" }}>GODSLEAD</h1>

        <small style={{ color: "#94a3b8" }}>
          AI SALES INTELLIGENCE
        </small>

        <p style={{
          color: "#64748b",
          fontSize: 11,
          marginTop: 35,
        }}>
          WORKSPACE
        </p>

        {menu.map(item => (
          <button
            key={item}
            onClick={() => setActive(item)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 12,
              marginBottom: 5,
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              color: active === item ? "#38bdf8" : "#cbd5e1",
              background: active === item ? "#1e293b" : "transparent",
            }}
          >
            {item}
          </button>
        ))}
      </aside>

      <section style={{
        flex: 1,
        minWidth: 0,
        padding: 30,
        overflowX: "auto",
      }}>
        <p style={{ color: "#38bdf8", fontSize: 12 }}>
          INFODART GLOBAL · SALES WORKSPACE
        </p>

        {active === "Dashboard" && (
          <>
            <h1>Welcome to GODSLEAD</h1>

            <p style={{ color: "#94a3b8" }}>
              Discover genuine buying opportunities and business contacts.
            </p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 15,
              marginTop: 30,
            }}>
              {[
                ["Search Results", signals.length],
                ["Saved Opportunities", saved.length],
                ["Approved Countries", COUNTRIES.length],
                ["Sales Platform", "Active"],
              ].map(([label, value]) => (
                <div key={String(label)} style={styles.card}>
                  <p style={{ color: "#94a3b8" }}>{label}</p>
                  <h2>{value}</h2>
                </div>
              ))}
            </div>

            <div style={{ ...styles.card, marginTop: 25 }}>
              <h2>Buyer Intent Hunter</h2>
              <p style={{ color: "#94a3b8" }}>
                Discover software buyers and their publicly available
                business contact information.
              </p>
              <button
                style={styles.button}
                onClick={() => setActive("Buyer Intent Hunter")}
              >
                Open Buyer Intent Hunter →
              </button>
            </div>
          </>
        )}

        {active === "Buyer Intent Hunter" && (
          <>
            <h1>Buyer Intent Hunter</h1>

            <p style={{ color: "#94a3b8" }}>
              Search opportunities and discover publicly available contacts.
            </p>

            <div style={{
              ...styles.card,
              marginTop: 25,
              marginBottom: 25,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 18,
            }}>
              <label>
                <strong>Target country</strong>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  style={styles.input}
                >
                  {COUNTRIES.map(item => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <strong>Opportunity type</strong>
                <select
                  value={service}
                  onChange={e => setService(e.target.value)}
                  style={styles.input}
                >
                  {SERVICES.map(item => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <strong>Minimum confidence score</strong>
                <select
                  value={minimumConfidence}
                  onChange={e => setMinimumConfidence(e.target.value)}
                  style={styles.input}
                >
                  <option value="40">40 - Broad search</option>
                  <option value="60">60 - Balanced</option>
                  <option value="80">80 - More specific</option>
                  <option value="90">90 - Strict</option>
                </select>
              </label>

              <div style={{ alignSelf: "end" }}>
                <button
                  onClick={searchOpportunities}
                  disabled={loading}
                  style={{
                    ...styles.button,
                    width: "100%",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? "Searching and discovering contacts..." : "Search Opportunities"}
                </button>
              </div>
            </div>

            {loading && (
              <div style={styles.card}>
                Searching projects and checking publicly available
                company contact pages. This may take some time.
              </div>
            )}

            {error && (
              <div style={{
                ...styles.card,
                borderColor: "#ef4444",
                color: "#fca5a5",
              }}>
                <strong>Search error</strong>
                <p>{error}</p>
                <p>
                  Check that the API file exists at app/intent/route.ts.
                </p>
              </div>
            )}

            {searched && (
              <>
                <h2>Search Results: {signals.length}</h2>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
                  gap: 12,
                  margin: "18px 0",
                }}>
                  {[
                    ["Email contacts", signals.filter(s => s.contact?.email).length],
                    ["Phone contacts", signals.filter(s => s.contact?.phone).length],
                    ["Both contacts", signals.filter(s => s.contact?.email && s.contact?.phone).length],
                    ["No contacts", signals.filter(s => !s.contact?.email && !s.contact?.phone).length],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={styles.card}>
                      <p style={{ color: "#94a3b8" }}>{label}</p>
                      <h2>{value}</h2>
                    </div>
                  ))}
                </div>

                {renderSignals(signals)}
              </>
            )}

            <p style={{
              color: "#64748b",
              fontSize: 12,
              marginTop: 25,
              lineHeight: 1.6,
            }}>
              Contact information is collected from publicly accessible
              project descriptions and company websites. Domain MX checks
              do not verify individual mailboxes. Phone formatting does
              not establish ownership or active status.
            </p>
          </>
        )}

        {active === "Saved Opportunities" && (
          <>
            <h1>Saved Opportunities</h1>

            <p style={{ color: "#94a3b8" }}>
              Opportunities saved in this browser.
            </p>

            <div style={{ marginTop: 25 }}>
              {saved.length === 0 ? (
                <div style={styles.card}>
                  No saved opportunities yet.
                </div>
              ) : (
                saved.map(signal => (
                  <div key={signal.id} style={{
                    ...styles.card,
                    marginBottom: 15,
                  }}>
                    <h3>{signal.title}</h3>

                    <p style={{ color: "#94a3b8" }}>
                      {signal.country} · {signal.intentType}
                    </p>

                    {renderContact(signal.contact)}

                    <a
                      href={signal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#38bdf8" }}
                    >
                      Open original source ↗
                    </a>

                    <br />

                    <button
                      onClick={() => removeOpportunity(signal.id)}
                      style={{
                        ...styles.button,
                        background: "#991b1b",
                        marginTop: 12,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {![
          "Dashboard",
          "Buyer Intent Hunter",
          "Saved Opportunities",
        ].includes(active) && (
          <div style={{ ...styles.card, marginTop: 25 }}>
            <h2>{active}</h2>
            <p style={{ color: "#94a3b8" }}>
              This module is planned for a future development stage.
            </p>
            <button
              style={styles.button}
              onClick={() => setActive("Dashboard")}
            >
              Return to Dashboard
            </button>
          </div>
        )}

        <footer style={{
          color: "#64748b",
          fontSize: 11,
          marginTop: 45,
        }}>
          GODSLEAD © 2026 · Powered by InfoDart Global
        </footer>
      </section>
    </main>
  );
}
