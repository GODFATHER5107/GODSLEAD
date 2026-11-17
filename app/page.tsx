"use client";

import { useState } from "react";

const modules = [
  ["🎯", "Buyer Intent Hunter", "Find organisations actively seeking software and IT development."],
  ["🏢", "Company Intelligence", "Research companies and their technology requirements."],
  ["👥", "Decision Maker Finder", "Identify relevant business contacts."],
  ["✉️", "AI Sales Writer", "Prepare personalised sales messages."],
  ["📨", "Email Management", "Manage prospect communication."],
  ["📅", "Meeting Scheduler", "Organise virtual meetings."],
  ["📊", "Sales Analytics", "Monitor sales performance."],
  ["📁", "CRM Pipeline", "Manage prospects and opportunities."]
];

export default function Home() {
  const [active, setActive] = useState("Dashboard");

  return (
    <main style={{
      minHeight: "100vh",
      background: "#090d16",
      color: "#f8fafc",
      fontFamily: "Arial, sans-serif",
      display: "flex"
    }}>

      <aside style={{
        width: "235px",
        background: "#111827",
        padding: "25px 18px",
        borderRight: "1px solid #263244"
      }}>
        <h1 style={{ color: "#38bdf8" }}>GODSLEAD</h1>
        <p style={{ color: "#94a3b8", fontSize: "11px" }}>
          AI SALES INTELLIGENCE
        </p>

        {["Dashboard", "Buyer Intent Hunter", "Company Intelligence",
          "Decision Maker Finder", "AI Sales Writer", "Email Management",
          "Meeting Scheduler", "CRM Pipeline", "Analytics", "Settings"
        ].map(item => (
          <button
            key={item}
            onClick={() => setActive(item)}
            style={{
              display: "block",
              width: "100%",
              padding: "13px",
              marginTop: "8px",
              textAlign: "left",
              color: active === item ? "#38bdf8" : "#cbd5e1",
              background: active === item ? "#1e293b" : "transparent",
              border: "none",
              borderRadius: "7px",
              cursor: "pointer"
            }}
          >
            {item}
          </button>
        ))}
      </aside>

      <section style={{ flex: 1, padding: "35px", minWidth: 0 }}>

        <p style={{ color: "#38bdf8" }}>
          INFODART GLOBAL · SALES WORKSPACE
        </p>

        <h1 style={{ fontSize: "32px" }}>
          {active === "Dashboard" ? "Welcome to GODSLEAD" : active}
        </h1>

        <p style={{ color: "#94a3b8" }}>
          Discover genuine buying opportunities and grow your business.
        </p>

        {active === "Dashboard" ? (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: "15px",
              marginTop: "35px"
            }}>
              {[
                ["Buyer Opportunities", "0"],
                ["Verified Opportunities", "0"],
                ["Active Prospects", "0"],
                ["Meetings Booked", "0"]
              ].map(([label, number]) => (
                <div key={label} style={{
                  background: "#111827",
                  padding: "22px",
                  borderRadius: "10px",
                  border: "1px solid #263244"
                }}>
                  <p style={{ color: "#94a3b8" }}>{label}</p>
                  <h2 style={{ fontSize: "30px" }}>{number}</h2>
                </div>
              ))}
            </div>

            <h2 style={{ marginTop: "40px" }}>
              GODSLEAD Intelligence Modules
            </h2>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: "16px"
            }}>
              {modules.map(([icon, title, description]) => (
                <button
                  key={title}
                  onClick={() => setActive(title)}
                  style={{
                    textAlign: "left",
                    background: "#111827",
                    color: "white",
                    padding: "22px",
                    border: "1px solid #263244",
                    borderRadius: "10px",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontSize: "25px" }}>{icon}</div>
                  <h3>{title}</h3>
                  <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
                    {description}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            marginTop: "30px",
            padding: "30px",
            background: "#111827",
            borderRadius: "10px"
          }}>
            <h2>{active}</h2>
            <p style={{ color: "#94a3b8" }}>
              This module will be connected to the GODSLEAD
              intelligence engine during the next development stage.
            </p>
            <button
              onClick={() => setActive("Dashboard")}
              style={{
                background: "#0284c7",
                color: "white",
                padding: "12px 20px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}

        <p style={{
          color: "#64748b",
          marginTop: "50px",
          fontSize: "12px"
        }}>
          GODSLEAD © 2026 · Powered by InfoDart Global
        </p>

      </section>
    </main>
  );
}
