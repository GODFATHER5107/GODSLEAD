"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Target,
  Search,
  Building2,
  Users,
  Mail,
  CalendarDays,
  BarChart3,
  Settings,
  BrainCircuit,
  ShieldCheck,
  Globe2,
  Zap,
  ArrowUpRight,
  Bell,
  Menu,
  ChevronRight,
  Sparkles,
  Activity,
  BriefcaseBusiness,
  MessageSquare,
  Clock3,
  CircleCheck,
} from "lucide-react";

const navigation = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Buyer Intent Hunter", icon: Target },
      { label: "Opportunity Verification", icon: ShieldCheck },
      { label: "Company Intelligence", icon: Building2 },
      { label: "Decision Makers", icon: Users },
    ],
  },
  {
    title: "SALES AUTOMATION",
    items: [
      { label: "AI Sales Writer", icon: BrainCircuit },
      { label: "Email Management", icon: Mail },
      { label: "Conversations", icon: MessageSquare },
      { label: "Meeting Scheduler", icon: CalendarDays },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { label: "CRM Pipeline", icon: BriefcaseBusiness },
      { label: "Analytics", icon: BarChart3 },
      { label: "Settings", icon: Settings },
    ],
  },
];

const modules = [
  {
    title: "Buyer Intent Hunter",
    description:
      "Discover organisations publicly signalling demand for software and IT development services.",
    icon: Target,
    color: "blue",
    status: "CORE MODULE",
  },
  {
    title: "Opportunity Verification",
    description:
      "Check original sources, project deadlines, relevance and opportunity validity.",
    icon: ShieldCheck,
    color: "green",
    status: "PLANNED",
  },
  {
    title: "Company Intelligence",
    description:
      "Research target organisations, business operations and technology requirements.",
    icon: Building2,
    color: "purple",
    status: "PLANNED",
  },
  {
    title: "Decision Maker Finder",
    description:
      "Identify publicly available professional contacts and relevant business roles.",
    icon: Users,
    color: "orange",
    status: "PLANNED",
  },
  {
    title: "AI Sales Writer",
    description:
      "Prepare personalised outreach messages based on verified buyer requirements.",
    icon: BrainCircuit,
    color: "blue",
    status: "PLANNED",
  },
  {
    title: "Email Management",
    description:
      "Organise prospect communication and manage incoming replies.",
    icon: Mail,
    color: "green",
    status: "PLANNED",
  },
  {
    title: "AI Sales Assistant",
    description:
      "Help qualify prospects, understand project requirements and prepare responses.",
    icon: Sparkles,
    color: "purple",
    status: "PLANNED",
  },
  {
    title: "Meeting Scheduler",
    description:
      "Coordinate virtual meetings with interested prospects.",
    icon: CalendarDays,
    color: "orange",
    status: "PLANNED",
  },
  {
    title: "CRM Pipeline",
    description:
      "Track prospects, opportunities, conversations and sales progress.",
    icon: BriefcaseBusiness,
    color: "blue",
    status: "PLANNED",
  },
];

export default function Home() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isDashboard = activePage === "Dashboard";

  return (
    <div className="dashboard">

      {/* SIDEBAR */}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>

        <div className="brand">
          GODS<span>LEAD</span>
          <small>AI SALES INTELLIGENCE</small>
        </div>

        <div className="nav-label">WORKSPACE</div>

        {navigation.map((group) => (
          <div key={group.title}>

            <div className="nav-label">{group.title}</div>

            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  className={`nav-item ${
                    activePage === item.label ? "active" : ""
                  }`}
                  onClick={() => {
                    setActivePage(item.label);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}

          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="sidebar-company">
            <div className="company-avatar">IG</div>
            <div>
              <strong>InfoDart Global</strong>
              <small>Business Workspace</small>
            </div>
          </div>
        </div>

      </aside>

      {/* MAIN AREA */}

      <main className="main-content">

        {/* TOP BAR */}

        <header className="topbar">

          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={20} />
            </button>

            <div className="topbar-title">
              Workspace / {activePage}
            </div>
          </div>

          <div className="topbar-right">

            <div className="live-indicator">
              <span></span>
              System Online
            </div>

            <button className="icon-button">
              <Bell size={18} />
            </button>

            <div className="user-avatar">IG</div>

          </div>

        </header>

        {/* DASHBOARD CONTENT */}

        <div className="content">

          {isDashboard ? (

            <>

              <section className="welcome">

                <div>
                  <div className="welcome-eyebrow">
                    <Sparkles size={14} />
                    INTELLIGENT SALES PLATFORM
                  </div>

                  <h1>Welcome to GODSLEAD</h1>

                  <p>
                    Discover genuine buying opportunities and turn them
                    into business relationships.
                  </p>

                  <div className="status">
                    <span className="status-dot"></span>
                    Your workspace is ready
                  </div>
                </div>

                <div className="welcome-date">
                  <Globe2 size={17} />
                  GLOBAL SALES INTELLIGENCE
                </div>

              </section>

              {/* STATISTICS */}

              <section className="stats-grid">

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Buyer Opportunities</span>
                    <Target className="blue" size={19} />
                  </div>
                  <div className="stat-number">—</div>
                  <div className="stat-note">
                    Awaiting buyer discovery integration
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Verified Opportunities</span>
                    <ShieldCheck className="green" size={19} />
                  </div>
                  <div className="stat-number">—</div>
                  <div className="stat-note">
                    Verification engine not connected
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Active Prospects</span>
                    <Users className="purple" size={19} />
                  </div>
                  <div className="stat-number">0</div>
                  <div className="stat-note">
                    CRM integration pending
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Meetings Booked</span>
                    <CalendarDays className="orange" size={19} />
                  </div>
                  <div className="stat-number">0</div>
                  <div className="stat-note">
                    Calendar integration pending
                  </div>
                </div>

              </section>

              {/* MAIN PANELS */}

              <section className="section-grid">

                <div className="panel">

                  <div className="panel-header">

                    <div>
                      <div className="panel-title">
                        Buyer Intelligence
                      </div>

                      <div className="panel-subtitle">
                        Your opportunity discovery workspace
                      </div>
                    </div>

                    <Target size={20} className="blue" />

                  </div>

                  <div className="intelligence-box">

                    <div className="intelligence-icon">
                      <BrainCircuit size={30} />
                    </div>

                    <h3>Find your next customer</h3>

                    <p>
                      GODSLEAD will search for organisations looking
                      for software developers, IT services, mobile
                      applications, websites and AI solutions.
                    </p>

                    <button
                      className="primary-button"
                      onClick={() =>
                        setActivePage("Buyer Intent Hunter")
                      }
                    >
                      Open Buyer Intent Hunter
                      <ArrowUpRight size={15} />
                    </button>

                  </div>

                </div>

                <div className="panel">

                  <div className="panel-header">

                    <div>
                      <div className="panel-title">
                        Platform Status
                      </div>

                      <div className="panel-subtitle">
                        Application development progress
                      </div>
                    </div>

                    <Activity size={19} className="green" />

                  </div>

                  <div className="activity-list">

                    <div className="activity-row">
                      <div className="activity-icon green-bg">
                        <CircleCheck size={16} />
                      </div>

                      <div className="activity-info">
                        <div className="activity-name">
                          Application foundation
                        </div>
                        <div className="activity-description">
                          Initial project setup
                        </div>
                      </div>

                      <span className="activity-tag">READY</span>
                    </div>

                    <div className="activity-row">
                      <div className="activity-icon green-bg">
                        <CircleCheck size={16} />
                      </div>

                      <div className="activity-info">
                        <div className="activity-name">
                          Dashboard interface
                        </div>
                        <div className="activity-description">
                          Main workspace
                        </div>
                      </div>

                      <span className="activity-tag">READY</span>
                    </div>

                    <div className="activity-row">
                      <div className="activity-icon orange-bg">
                        <Clock3 size={16} />
                      </div>

                      <div className="activity-info">
                        <div className="activity-name">
                          Buyer Intent Engine
                        </div>
                        <div className="activity-description">
                          Next development stage
                        </div>
                      </div>

                      <span className="activity-tag pending">
                        NEXT
                      </span>
                    </div>

                  </div>

                </div>

              </section>

              {/* MODULES */}

              <section className="panel">

                <div className="panel-header">

                  <div>
                    <div className="panel-title">
                      GODSLEAD Intelligence Modules
                    </div>

                    <div className="panel-subtitle">
                      Your complete AI-powered sales platform
                    </div>
                  </div>

                  <Zap size={19} className="blue" />

                </div>

                <div className="module-grid">

                  {modules.map((module) => {
                    const Icon = module.icon;

                    return (
                      <button
                        key={module.title}
                        className="module-card"
                        onClick={() => setActivePage(module.title)}
                      >

                        <div className={`module-icon ${module.color}`}>
                          <Icon size={23} />
                        </div>

                        <h3>{module.title}</h3>

                        <p>{module.description}</p>

                        <div className="module-bottom">
                          <span className={`module-status ${module.status === "CORE MODULE" ? "core" : ""}`}>
                            {module.status}
                          </span>

                          <ChevronRight size={15} />
                        </div>

                      </button>
                    );
                  })}

                </div>

              </section>

              <div className="footer">
                GODSLEAD © 2026 · Powered by InfoDart Global
              </div>

            </>

          ) : (

            <section className="panel module-page">

              <div className="module-page-icon">
                <Sparkles size={28} />
              </div>

              <div className="welcome-eyebrow">
                GODSLEAD INTELLIGENCE
              </div>

              <h1>{activePage}</h1>

              <p>
                This module is part of the GODSLEAD development
                roadmap. Its functionality will be connected in
                upcoming development stages.
              </p>

              <button
                className="secondary-button"
                onClick={() => setActivePage("Dashboard")}
              >
                Return to Dashboard
              </button>

            </section>

          )}

        </div>

      </main>

    </div>
  );
}
