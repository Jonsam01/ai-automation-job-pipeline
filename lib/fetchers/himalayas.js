import { safeGet, makeJob } from "./base.js";

const API_URL = "https://himalayas.app/jobs/api/search";

// Broad searches preserve general role discovery.
const SEARCH_TERMS = [
  "automation",
  "n8n",
  "workflow automation",
  "AI agent",
  "LLM",
  "API integration",
  "AI integration",
  "AI intern",
  "automation intern",
  "LangChain",
  "Zapier",
  "generative AI",
  "AI specialist",
];

// Additional searches use Himalayas' own filters to find
// entry-level positions and internships more directly.
const EARLY_CAREER_SEARCHES = [
  { q: "automation", seniority: "Entry-level" },
  { q: "workflow automation", seniority: "Entry-level" },
  { q: "AI agent", seniority: "Entry-level" },
  { q: "LLM", seniority: "Entry-level" },
  { q: "n8n", seniority: "Entry-level" },
  { q: "AI", employment_type: "Intern" },
  { q: "AI automation", employment_type: "Intern" },
  { q: "automation", employment_type: "Intern" },
  { q: "developer", employment_type: "Intern" },
];

// Keep additional requests controlled.
// Early-career searches can retrieve up to two pages each.
const EARLY_CAREER_MAX_PAGES = 2;

// Convert HTML descriptions into searchable plain text.
function toPlainText(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|li|div|h[1-6]|tr)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLocations(locationRestrictions) {
  // Himalayas uses an empty locationRestrictions array for worldwide jobs.
  if (
    !Array.isArray(locationRestrictions) ||
    locationRestrictions.length === 0
  ) {
    return "Worldwide";
  }

  const locations = locationRestrictions
    .map((location) => {
      if (typeof location === "string") {
        return location;
      }

      return (
        location?.name ||
        location?.alpha2 ||
        location?.slug ||
        ""
      );
    })
    .filter(Boolean);

  return locations.length > 0
    ? locations.join(", ")
    : "Worldwide";
}

// Use both the GUID and application link for deduplication.
// Keep the original applicationLink unchanged when creating the job.
function isDuplicate(item, applicationLink, seen) {
  const keys = [];

  if (typeof item.guid === "string" && item.guid.trim()) {
    keys.push(`guid:${item.guid.trim()}`);
  }

  if (applicationLink.trim()) {
    keys.push(`url:${applicationLink.trim()}`);
  }

  if (keys.some((key) => seen.has(key))) {
    return true;
  }

  keys.forEach((key) => seen.add(key));

  return false;
}

async function runSearch({
  search,
  label,
  maxPages,
  seen,
  jobs,
}) {
  let pagesFetched = 0;
  let jobsAdded = 0;

  for (let page = 1; page <= maxPages; page++) {
    const params = {
      q: search.q,
      page,
    };

    if (search.seniority) {
      params.seniority = search.seniority;
    }

    if (search.employment_type) {
      params.employment_type = search.employment_type;
    }

    try {
      const response = await safeGet(API_URL, params);

      if (!response) {
        console.warn(
          `[himalayas] No response for "${label}", page ${page}.`,
        );
        break;
      }

      if (!response.ok) {
        console.warn(
          `[himalayas] "${label}", page ${page}: HTTP ${response.status}.`,
        );
        break;
      }

      const data = await response.json();

      if (!Array.isArray(data.jobs)) {
        console.warn(
          `[himalayas] Unexpected response for "${label}", page ${page}.`,
        );
        break;
      }

      pagesFetched++;

      let addedOnPage = 0;

      for (const item of data.jobs) {
        if (!item || typeof item !== "object") {
          continue;
        }

        // Himalayas requires Apply actions to use applicationLink unchanged.
        const applicationLink = item.applicationLink;

        if (
          typeof applicationLink !== "string" ||
          !applicationLink.trim()
        ) {
          continue;
        }

        if (isDuplicate(item, applicationLink, seen)) {
          continue;
        }

        const description = toPlainText(
          item.description || item.excerpt || "",
        );

        jobs.push(
          makeJob({
            title: item.title || "",
            company: item.companyName || "",
            location: formatLocations(item.locationRestrictions),
            employmentType: item.employmentType || "",
            link: applicationLink,
            description,
            source: "himalayas",
          }),
        );

        addedOnPage++;
        jobsAdded++;
      }

      console.log(
        `[himalayas] "${label}" page ${page}: ` +
        `${data.jobs.length} results, ${addedOnPage} new listings.`,
      );

      // No results means there are no further useful pages for this search.
      if (data.jobs.length === 0) {
        break;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      console.warn(
        `[himalayas] "${label}" page ${page} failed: ${message}`,
      );

      // A failed search must not prevent the other searches from running.
      break;
    }
  }

  return {
    pagesFetched,
    jobsAdded,
  };
}

export async function fetchHimalayas() {
  const jobs = [];
  const seen = new Set();

  let totalPagesFetched = 0;
  let earlyCareerJobsAdded = 0;

  // Run the original broad searches.
  for (const term of SEARCH_TERMS) {
    const result = await runSearch({
      search: { q: term },
      label: term,
      maxPages: 1,
      seen,
      jobs,
    });

    totalPagesFetched += result.pagesFetched;
  }

  // Run targeted entry-level and internship searches.
  for (const search of EARLY_CAREER_SEARCHES) {
    const filters = [];

    if (search.seniority) {
      filters.push(search.seniority);
    }

    if (search.employment_type) {
      filters.push(search.employment_type);
    }

    const label = `${search.q} [${filters.join(", ")}]`;

    const result = await runSearch({
      search,
      label,
      maxPages: EARLY_CAREER_MAX_PAGES,
      seen,
      jobs,
    });

    totalPagesFetched += result.pagesFetched;
    earlyCareerJobsAdded += result.jobsAdded;
  }

  console.log("----------------------------------------");
  console.log(`[himalayas] Unique listings retrieved: ${jobs.length}`);
  console.log(`[himalayas] Pages fetched: ${totalPagesFetched}`);
  console.log(
    `[himalayas] New listings from targeted early-career searches: ${earlyCareerJobsAdded}`,
  );
  console.log(
    `[himalayas] Searches completed: ${SEARCH_TERMS.length + EARLY_CAREER_SEARCHES.length}`,
  );
  console.log("----------------------------------------");

  return jobs;
}