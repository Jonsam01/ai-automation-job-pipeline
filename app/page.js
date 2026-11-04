
"use client";

import { useEffect, useMemo, useState } from "react";
import { linkedinLinks } from "../lib/linkedin.js";

const STATUS_COLOR = {
  "Awaiting Your Approval": "var(--status-awaiting)",
  Approved: "var(--status-approved)",
  Applied: "var(--status-applied)",
  "Applied (Auto)": "var(--status-applied)",
  "Needs Manual Apply": "var(--status-manual)",
  Interview: "var(--status-interview)",
  Rejected: "var(--status-rejected)",
  "No Response": "var(--status-none)",
  "Follow-up Sent": "var(--status-approved)",
};

const CV_LABEL = {
  ai_automation: "AI Automation CV",
};

const DEFAULT_CV_KEY = "ai_automation";

const TABS = [
  { key: "all", label: "All", match: () => true },
  {
    key: "awaiting",
    label: "Awaiting approval",
    match: (job) => job.Status === "Awaiting Your Approval",
  },
  {
    key: "approved",
    label: "Approved",
    match: (job) => job.Status === "Approved",
  },
  {
    key: "manual",
    label: "Needs manual apply",
    match: (job) => job.Status === "Needs Manual Apply",
  },
  {
    key: "applied",
    label: "Applied",
    match: (job) => String(job.Status || "").startsWith("Applied"),
  },
  {
    key: "interview",
    label: "Interview",
    match: (job) => job.Status === "Interview",
  },
  {
    key: "rejected",
    label: "Rejected",
    match: (job) => job.Status === "Rejected",
  },
  {
    key: "review",
    label: "Needs review",
    match: (job) => hasAnyReview(job),
  },
];

const KIT_STATUSES = [
  "Awaiting Your Approval",
  "Needs Manual Apply",
  "Approved",
];

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

// --------------------------------------------------
// CELL VALUE HELPERS
// --------------------------------------------------

function cellIsTrue(value) {
  if (value === true || value === 1) return true;

  return ["true", "yes", "1"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

// Missing review values are deliberately treated as unresolved.
// This also catches old spreadsheet rows created before the new columns.
function reviewIsRequired(value) {
  if (
    value === false ||
    value === 0 ||
    ["false", "no", "0"].includes(
      String(value ?? "").trim().toLowerCase(),
    )
  ) {
    return false;
  }

  return true;
}

function getReviewFlags(job) {
  const candidateCountry = String(
    job["Candidate Country"] || "",
  ).trim();

  const eligibilityStatus = String(
    job["Location Eligibility Status"] || "",
  ).trim();

  const locationRestricted = cellIsTrue(
    job["Location Restricted"],
  );

  const location =
    !candidateCountry ||
    !eligibilityStatus ||
    reviewIsRequired(job["Location Review Required"]) ||
    locationRestricted;

  const workAuthorization = reviewIsRequired(
    job["Work Authorisation Review Required"],
  );

  const cv = reviewIsRequired(
    job["CV Selection Review Required"],
  );

  return {
    location,
    locationRestricted,
    workAuthorization,
    cv,
    any: location || workAuthorization || cv,
  };
}

function hasAnyReview(job) {
  return getReviewFlags(job).any;
}

function eligibilityLabel(status) {
  const labels = {
    candidate_country_listed: "Nigeria listed",
    open_region: "Open region — verify",
    country_specific_unverified: "Country-specific — verify",
    remote_unverified: "Remote — verify",
    missing_location: "Location missing",
    restricted_region: "Restricted region",
    unknown_location: "Unknown location",
  };

  return labels[String(status || "").trim()] || "Not assessed";
}

// --------------------------------------------------
// APPLICATION EMAIL
// --------------------------------------------------

function applyEmailOf(job) {
  const method = String(
    job["Submission Method"] || "",
  ).trim().toLowerCase();

  if (method !== "email") return null;

  const match = String(job.Notes || "").match(EMAIL_RE);

  return match ? match[0] : null;
}

// --------------------------------------------------
// APPLICATION KIT
// --------------------------------------------------

function KitPanel({ job, kit, copied, onCopy }) {
  const cvKey = job["CV Version Used"] || DEFAULT_CV_KEY;
  const cvLabel = CV_LABEL[cvKey] || "AI Automation CV";

  const summary = kit.summaries?.[cvKey] || null;
  const summaryKey = `${job._row}-summary`;

  const profile = Array.isArray(kit.profile) ? kit.profile : [];
  const answers = Array.isArray(kit.answers) ? kit.answers : [];

  return (
    <div className="kitPanel">
      <div className="kitTitle">Your details</div>

      <div className="kitChips">
        {profile.map((field) => {
          const key = `${job._row}-p-${field.label}`;
          const needsEdit =
            typeof field.value === "string" &&
            field.value.startsWith("EDIT ME");

          return (
            <button
              type="button"
              key={key}
              className="chip"
              title={
                needsEdit
                  ? "Replace this placeholder first"
                  : field.label
              }
              onClick={() => onCopy(field.value, key)}
            >
              {copied === key
                ? "Copied"
                : `Copy ${field.label}${needsEdit ? " (edit me)" : ""}`}
            </button>
          );
        })}
      </div>

      <div className="kitTitle">Saved answers</div>

      {answers.map((answer) => {
        const key = `${job._row}-a-${answer.label}`;
        const value = answer.value ?? "";

        const needsEdit =
          typeof value === "string" &&
          value.startsWith("EDIT ME");

        return (
          <div className="answerRow" key={key}>
            <div
              className={needsEdit ? "answerText needsEdit" : "answerText"}
            >
              <span className="answerLabel">{answer.label}</span>
              <span>{value}</span>
            </div>

            <button
              type="button"
              className="actionBtn"
              onClick={() => onCopy(value, key)}
            >
              {copied === key ? "Copied" : "Copy"}
            </button>
          </div>
        );
      })}

      {summary && (
        <>
          <div className="kitTitle">
            Short summary ({cvLabel})
          </div>

          <div className="answerRow">
            <div className="answerText">
              <span>{summary}</span>
            </div>

            <button
              type="button"
              className="actionBtn"
              onClick={() => onCopy(summary, summaryKey)}
            >
              {copied === summaryKey ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}

      <div className="kitLinks">
        <a
          className="actionBtn primary"
          href={`/api/resume?cv=${encodeURIComponent(cvKey)}`}
        >
          Download {cvLabel}
        </a>

        <a
          className="actionBtn"
          href={job.Link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open application
        </a>
      </div>
    </div>
  );
}

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [search, setSearch] = useState("");
  const [minimumScore, setMinimumScore] = useState("");
  const [reviewFilter, setReviewFilter] = useState("all");

  const [busyRow, setBusyRow] = useState(null);
  const [kit, setKit] = useState(null);
  const [openKit, setOpenKit] = useState(null);
  const [copied, setCopied] = useState(null);

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  async function loadJobs() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/jobs", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load jobs.");
      }

      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (error) {
      console.error("Failed to load jobs:", error);

      setLoadError(
        "Could not load jobs. Check your Google Sheets connection and try refreshing.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadKit() {
    try {
      const response = await fetch("/api/kit", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Could not load the application kit.",
        );
      }

      setKit(data.kit);
    } catch (error) {
      console.error("Failed to load application kit:", error);
    }
  }

  useEffect(() => {
    loadJobs();
    loadKit();
  }, []);

  // --------------------------------------------------
  // COPY APPLICATION MATERIAL
  // --------------------------------------------------

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(
        String(text ?? ""),
      );

      setCopied(key);

      window.setTimeout(() => {
        setCopied((current) =>
          current === key ? null : current,
        );
      }, 1200);
    } catch (error) {
      window.alert(
        "Could not copy. Select the text and copy it manually.",
      );
    }
  }

  // --------------------------------------------------
  // UPDATE APPLICATION STATUS
  // --------------------------------------------------

  async function updateStatus(row, status) {
    setBusyRow(row);

    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ row, status }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const reviewDetails = Array.isArray(data.reviewReasons)
          ? `\n\n${data.reviewReasons.join("\n")}`
          : "";

        window.alert(
          `${data.error || "Could not update the job."}${reviewDetails}`,
        );

        return null;
      }

      await loadJobs();

      return data;
    } catch (error) {
      console.error("Failed to update status:", error);

      window.alert(
        "The status update failed. Please try again.",
      );

      return null;
    } finally {
      setBusyRow(null);
    }
  }

  async function approve(job) {
    const flags = getReviewFlags(job);

    if (flags.any) {
      window.alert(
        "This job still has unresolved eligibility or CV reviews. Resolve those items in the tracker before approval.",
      );
      return;
    }

    const email = applyEmailOf(job);

    if (
      email &&
      !window.confirm(
        `This is an email-based application to ${email}. Approving it may send your CV immediately if both email-sending controls are enabled. Continue?`,
      )
    ) {
      return;
    }

    const data = await updateStatus(
      job._row,
      "Approved",
    );

    if (email && data && data.sent === false) {
      window.alert(
        "The application email was not sent. Check the email settings before retrying.",
      );
    }
  }

  // --------------------------------------------------
  // CLEAR TRACKER
  // --------------------------------------------------

  async function clearAll() {
    const confirmed = window.confirm(
      "Delete every job row from the sheet? The header stays.",
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/clear", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        window.alert(
          data.error || "Could not clear the sheet.",
        );
        return;
      }

      await loadJobs();
    } catch (error) {
      console.error("Failed to clear jobs:", error);

      window.alert(
        "Could not clear the sheet. Please try again.",
      );
    }
  }

  // --------------------------------------------------
  // DASHBOARD COUNTS
  // --------------------------------------------------

  const counts = useMemo(() => {
    const result = {};

    for (const tab of TABS) {
      result[tab.key] = jobs.filter((job) =>
        tab.match(job),
      ).length;
    }

    const locationReviews = jobs.filter(
      (job) => getReviewFlags(job).location,
    ).length;

    const workAuthorizationReviews = jobs.filter(
      (job) => getReviewFlags(job).workAuthorization,
    ).length;

    const cvReviews = jobs.filter(
      (job) => getReviewFlags(job).cv,
    ).length;

    return {
      ...result,
      locationReviews,
      workAuthorizationReviews,
      cvReviews,
    };
  }, [jobs]);

  // --------------------------------------------------
  // SEARCH AND FILTER
  // --------------------------------------------------

  const visible = useMemo(() => {
    const tab =
      TABS.find((item) => item.key === activeTab) || TABS[0];

    const query = search.trim().toLowerCase();

    const scoreThreshold =
      minimumScore.trim() === ""
        ? null
        : Number(minimumScore);

    return jobs
      .filter((job) => tab.match(job))
      .filter((job) => {
        if (!query) return true;

        const searchable = [
          job.Company,
          job["Role Title"],
          job["Country/Remote"],
          job["Eligibility Reason"],
          job.Status,
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .filter((job) => {
        if (
          scoreThreshold === null ||
          !Number.isFinite(scoreThreshold)
        ) {
          return true;
        }

        return Number(job["Match Score"] || 0) >= scoreThreshold;
      })
      .filter((job) => {
        const flags = getReviewFlags(job);

        switch (reviewFilter) {
          case "location":
            return flags.location;

          case "restricted":
            return flags.locationRestricted;

          case "work":
            return flags.workAuthorization;

          case "cv":
            return flags.cv;

          case "none":
            return !flags.any;

          default:
            return true;
        }
      })
      .sort(
        (a, b) =>
          Number(b["Match Score"] || 0) -
          Number(a["Match Score"] || 0),
      );
  }, [
    jobs,
    activeTab,
    search,
    minimumScore,
    reviewFilter,
  ]);

  function resetFilters() {
    setSearch("");
    setMinimumScore("");
    setReviewFilter("all");
    setActiveTab("all");
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <main className="wrap">
      <header className="pageHead">
        <div>
          <h1 className="wordmark">Job Pipeline</h1>
          <div className="tagline">
            AI automation &amp; engineering job tracker
          </div>
        </div>

        <div className="headActions">
          <button
            type="button"
            className="ghostBtn"
            onClick={loadJobs}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="ghostBtn danger"
            onClick={clearAll}
            disabled={loading || jobs.length === 0}
          >
            Clear all
          </button>
        </div>
      </header>

      {/* OVERVIEW */}

      <section className="overviewSection">
        <div className="sectionEyebrow">Pipeline overview</div>

        <div className="statRow">
          <div className="stat">
            <span className="statNumber">
              {counts.all || 0}
            </span>
            <span className="statLabel">Total tracked</span>
          </div>

          <div className="stat">
            <span className="statNumber">
              {counts.awaiting || 0}
            </span>
            <span className="statLabel">Awaiting approval</span>
          </div>

          <div className="stat">
            <span className="statNumber">
              {counts.approved || 0}
            </span>
            <span className="statLabel">Approved</span>
          </div>

          <div className="stat">
            <span className="statNumber">
              {counts.applied || 0}
            </span>
            <span className="statLabel">Applied</span>
          </div>

          <div className="stat">
            <span className="statNumber">
              {counts.interview || 0}
            </span>
            <span className="statLabel">Interviews</span>
          </div>
        </div>
      </section>

      {/* ELIGIBILITY REVIEW SUMMARY */}

      <section className="reviewOverview">
        <div className="reviewOverviewHead">
          <div>
            <div className="sectionEyebrow">
              Eligibility and quality checks
            </div>
            <h2>Review queue</h2>
            <p>
              Jobs with unresolved information are held for review
              before automatic application.
            </p>
          </div>

          <button
            type="button"
            className="reviewQueueLink"
            onClick={() => {
              setActiveTab("review");
              setReviewFilter("all");
            }}
          >
            View review queue ({counts.review || 0})
          </button>
        </div>

        <div className="reviewStats">
          <button
            type="button"
            className={`reviewStat ${reviewFilter === "location" ? "selected" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setReviewFilter(
                reviewFilter === "location" ? "all" : "location",
              );
            }}
          >
            <span className="reviewStatNumber">
              {counts.locationReviews || 0}
            </span>
            <span className="reviewStatLabel">
              Location reviews
            </span>
          </button>

          <button
            type="button"
            className={`reviewStat ${reviewFilter === "work" ? "selected" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setReviewFilter(
                reviewFilter === "work" ? "all" : "work",
              );
            }}
          >
            <span className="reviewStatNumber">
              {counts.workAuthorizationReviews || 0}
            </span>
            <span className="reviewStatLabel">
              Work authorisation
            </span>
          </button>

          <button
            type="button"
            className={`reviewStat ${reviewFilter === "cv" ? "selected" : ""}`}
            onClick={() => {
              setActiveTab("all");
              setReviewFilter(
                reviewFilter === "cv" ? "all" : "cv",
              );
            }}
          >
            <span className="reviewStatNumber">
              {counts.cvReviews || 0}
            </span>
            <span className="reviewStatLabel">
              CV reviews
            </span>
          </button>
        </div>
      </section>

      {/* STATUS TABS */}

      <nav className="tabs" aria-label="Job status filters">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            className={`tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="tabCount">
              {counts[tab.key] || 0}
            </span>
          </button>
        ))}
      </nav>

      {/* SEARCH AND FILTERS */}

      <section className="filterBar">
        <div className="searchField">
          <label htmlFor="job-search">Search jobs</label>
          <input
            id="job-search"
            type="search"
            placeholder="Company, job title or location..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="filterField scoreFilter">
          <label htmlFor="minimum-score">Minimum match score</label>
          <input
            id="minimum-score"
            type="number"
            min="0"
            max="100"
            placeholder="Any score"
            value={minimumScore}
            onChange={(event) =>
              setMinimumScore(event.target.value)
            }
          />
        </div>

        <div className="filterField reviewFilter">
          <label htmlFor="review-filter">Review requirement</label>
          <select
            id="review-filter"
            value={reviewFilter}
            onChange={(event) =>
              setReviewFilter(event.target.value)
            }
          >
            <option value="all">All jobs</option>
            <option value="location">Location review</option>
            <option value="restricted">Explicitly restricted location</option>
            <option value="work">Work authorisation review</option>
            <option value="cv">CV selection review</option>
            <option value="none">No outstanding reviews</option>
          </select>
        </div>

        <button
          type="button"
          className="resetFilters"
          onClick={resetFilters}
        >
          Reset
        </button>
      </section>

      {/* JOB RESULTS */}

      {loading ? (
        <div className="loading">Loading jobs...</div>
      ) : loadError ? (
        <div className="errorPanel">
          <p>{loadError}</p>
          <button
            type="button"
            className="actionBtn"
            onClick={loadJobs}
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <strong>No jobs match this view.</strong>
          <span>
            Try changing the status tab or clearing your filters.
          </span>
          <button
            type="button"
            className="actionBtn"
            onClick={resetFilters}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <section className="panel" aria-label="Job listings">
          <div className="resultsHeader">
            <span>
              Showing <strong>{visible.length}</strong> of{" "}
              <strong>{jobs.length}</strong> jobs
            </span>
            <span>Sorted by match score</span>
          </div>

          {visible.map((job) => {
            const applyEmail = applyEmailOf(job);
            const links = linkedinLinks(job.Company);

            const kitOpen = openKit === job._row;
            const flags = getReviewFlags(job);

            const cvKey =
              job["CV Version Used"] || DEFAULT_CV_KEY;

            const cvLabel =
              CV_LABEL[cvKey] || "AI Automation CV";

            const canApprove =
              !flags.any &&
              job.Status === "Awaiting Your Approval";

            return (
              <article className="jobRow" key={job._row}>
                <div className="jobMain">
                  <div className="jobTopLine">
                    <p className="jobTitle">
                      <a
                        href={job.Link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {job["Role Title"] || "Untitled role"}
                      </a>
                    </p>

                    {job["Match Score"] !== undefined &&
                      job["Match Score"] !== "" && (
                        <span className="scoreTag">
                          {job["Match Score"]}/100
                        </span>
                      )}
                  </div>

                  <div className="jobCompany">
                    <span className="company">
                      {job.Company || "Unknown company"}
                    </span>

                    {job["Country/Remote"] && (
                      <span className="location">
                        {job["Country/Remote"]}
                      </span>
                    )}

                    {job["Employment Type"] &&
                      job["Employment Type"] !== "Not specified" && (
                        <span className="location">
                          {job["Employment Type"]}
                        </span>
                      )}
                  </div>

                  <div className="jobMetaLine">
                    <span className="cvTag">{cvLabel}</span>

                    <span
                      className="statusPill"
                      style={{
                        color:
                          STATUS_COLOR[job.Status] ||
                          "var(--status-none)",
                      }}
                    >
                      {job.Status || "Status unknown"}
                    </span>

                    <span className="eligibilityPill">
                      {eligibilityLabel(
                        job["Location Eligibility Status"],
                      )}
                    </span>
                  </div>

                  {/* ELIGIBILITY DETAILS */}

                  <div className="eligibilityPanel">
                    <div className="eligibilityHeading">
                      Eligibility checks
                    </div>

                    <div className="eligibilityBadges">
                      <span
                        className={
                          flags.location
                            ? "reviewBadge warning"
                            : "reviewBadge clear"
                        }
                      >
                        {flags.location
                          ? "Location review required"
                          : "Location review cleared"}
                      </span>

                      <span
                        className={
                          flags.workAuthorization
                            ? "reviewBadge warning"
                            : "reviewBadge clear"
                        }
                      >
                        {flags.workAuthorization
                          ? "Work authorisation review"
                          : "Work authorisation clear"}
                      </span>

                      <span
                        className={
                          flags.cv
                            ? "reviewBadge warning"
                            : "reviewBadge clear"
                        }
                      >
                        {flags.cv
                          ? "CV review required"
                          : "CV review cleared"}
                      </span>

                      {flags.locationRestricted && (
                        <span className="reviewBadge restricted">
                          Location restricted
                        </span>
                      )}
                    </div>

                    {job["Eligibility Reason"] && (
                      <p className="eligibilityReason">
                        {job["Eligibility Reason"]}
                      </p>
                    )}

                    {flags.any && (
                      <p className="approvalNotice">
                        Resolve the outstanding review fields in your
                        Google Sheet, then refresh this dashboard before
                        approving this job.
                      </p>
                    )}
                  </div>

                  {applyEmail && (
                    <div className="applyEmail">
                      Application email:{" "}
                      <a href={`mailto:${applyEmail}`}>
                        {applyEmail}
                      </a>
                    </div>
                  )}

                  <div className="liLinks">
                    <a
                      href={links.company}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Company on LinkedIn
                    </a>

                    <a
                      href={links.recruiters}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Find recruiters
                    </a>

                    <a
                      href={links.engineers}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Find engineers
                    </a>
                  </div>

                  {kitOpen && kit && (
                    <KitPanel
                      job={job}
                      kit={kit}
                      copied={copied}
                      onCopy={copy}
                    />
                  )}
                </div>

                {/* JOB ACTIONS */}

                <div className="jobActions">
                  {job.Status === "Awaiting Your Approval" && (
                    <>
                      {canApprove ? (
                        <button
                          type="button"
                          className="actionBtn primary"
                          disabled={busyRow === job._row}
                          onClick={() => approve(job)}
                        >
                          {busyRow === job._row
                            ? "Working..."
                            : "Approve"}
                        </button>
                      ) : (
                        <span
                          className="actionHint"
                          title="Resolve the outstanding reviews before approval"
                        >
                          Review first
                        </span>
                      )}

                      <button
                        type="button"
                        className="actionBtn"
                        disabled={busyRow === job._row}
                        onClick={() =>
                          updateStatus(job._row, "Rejected")
                        }
                      >
                        Dismiss
                      </button>
                    </>
                  )}

                  {job.Status === "Needs Manual Apply" && (
                    <button
                      type="button"
                      className="actionBtn primary"
                      disabled={busyRow === job._row}
                      onClick={() =>
                        updateStatus(job._row, "Applied")
                      }
                    >
                      Mark applied
                    </button>
                  )}

                  {(job.Status === "Applied" ||
                    job.Status === "Applied (Auto)") && (
                      <button
                        type="button"
                        className="actionBtn"
                        disabled={busyRow === job._row}
                        onClick={() =>
                          updateStatus(job._row, "Interview")
                        }
                      >
                        Got interview
                      </button>
                    )}

                  {KIT_STATUSES.includes(job.Status) && (
                    <button
                      type="button"
                      className="actionBtn"
                      onClick={() =>
                        setOpenKit(
                          kitOpen ? null : job._row,
                        )
                      }
                    >
                      {kitOpen ? "Hide kit" : "Apply kit"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
