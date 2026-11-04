
import { safeGet, makeJob } from "./base.js";
import { loadJson } from "../loadJson.js";

const companies = loadJson(import.meta.url, "../../config/companies.json");

const LIST_URL = (slug) =>
  `https://${encodeURIComponent(slug)}.bamboohr.com/careers/list`;

const DETAIL_URL = (slug, id) =>
  `https://${encodeURIComponent(slug)}.bamboohr.com/careers/${encodeURIComponent(String(id))}/detail`;

// Fetch details for likely technical or AI-related roles.
// Broad terms intentionally include internships and adjacent engineering roles.
const CANDIDATE_TITLE_TERMS = [
  "ai",
  "artificial intelligence",
  "automation",
  "workflow",
  "n8n",
  "integration",
  "integrations",
  "llm",
  "agent",
  "agentic",
  "generative",
  "software",
  "engineer",
  "developer",
  "programmer",
  "intern",
  "internship",
  "trainee",
  "graduate",
  "apprentice",
  "technical",
  "systems",
  "operations",
  "process",
  "implementation",
  "solutions",
  "specialist",
  "consultant",
  "platform",
  "analyst",
  "product",
  "business systems",
  "machine learning",
  "conversational",
  "voice ai",
  "rpa",
  "api",
];

const TITLE_REGEX_CACHE = new Map();

function looksRelevantTitle(title) {
  const value = String(title || "").toLowerCase();

  return CANDIDATE_TITLE_TERMS.some((term) => {
    let regex = TITLE_REGEX_CACHE.get(term);

    if (!regex) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      regex = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i");
      TITLE_REGEX_CACHE.set(term, regex);
    }

    return regex.test(value);
  });
}

function toPlainText(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6]|tr)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLocation(location) {
  if (typeof location === "string") {
    return location.trim();
  }

  if (!location || typeof location !== "object") {
    return "";
  }

  return [
    location.city,
    location.state,
    location.region,
    location.addressCountry,
    location.country,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
}

async function fetchJobDetail(slug, item) {
  if (item.id === undefined || item.id === null || item.id === "") {
    return null;
  }

  try {
    const response = await safeGet(DETAIL_URL(slug, item.id));

    if (!response || !response.ok) {
      console.warn(
        `[bamboohr] Detail request failed for board "${slug}", job "${item.id}".`,
      );
      return null;
    }

    const data = await response.json();

    // Public careers detail responses commonly wrap the posting
    // as result.jobOpening. Check the alternate wrappers defensively.
    const detail =
      data?.result?.jobOpening ||
      data?.jobOpening ||
      data?.result ||
      null;

    return detail && typeof detail === "object" ? detail : null;
  } catch (error) {
    console.warn(
      `[bamboohr] Could not read detail for "${slug}" job "${item.id}": ${error.message}`,
    );
    return null;
  }
}

export async function fetchBambooHR() {
  const jobs = [];
  const seen = new Set();

  const slugs = Array.isArray(companies.bamboohr)
    ? companies.bamboohr
    : [];

  for (const rawSlug of slugs) {
    const slug = String(rawSlug || "").trim();

    if (!slug) continue;

    try {
      const response = await safeGet(LIST_URL(slug));

      if (!response) {
        console.warn(`[bamboohr] No response for board "${slug}".`);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[bamboohr] Board "${slug}" returned HTTP ${response.status}.`,
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data.result)) {
        console.warn(
          `[bamboohr] Unexpected listing response for board "${slug}".`,
        );
        continue;
      }

      let addedForBoard = 0;
      let detailRequests = 0;

      for (const item of data.result) {
        if (!item || !item.jobOpeningName || !item.id) {
          continue;
        }

        // Save detail requests for potentially relevant technical roles.
        if (!looksRelevantTitle(item.jobOpeningName)) {
          continue;
        }

        const detail = await fetchJobDetail(slug, item);
        detailRequests++;

        const opening = detail || item;

        const title =
          opening.jobOpeningName ||
          item.jobOpeningName ||
          "";

        const link =
          opening.jobOpeningShareUrl ||
          `https://${encodeURIComponent(slug)}.bamboohr.com/careers/${encodeURIComponent(String(item.id))}`;

        if (seen.has(link)) {
          continue;
        }

        seen.add(link);

        const departments = [
          item.departmentLabel,
          opening.departmentLabel,
          opening.department,
        ]
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter((value, index, values) => values.indexOf(value) === index);

        const locationParts = [
          formatLocation(opening.location),
          formatLocation(item.location),
        ].filter(Boolean);

        const isRemote =
          opening.isRemote === true || item.isRemote === true;

        if (isRemote) {
          locationParts.push("Remote");
        }

        const locations = locationParts
          .flatMap((value) => value.split(","))
          .map((value) => value.trim())
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index);

        const descriptionParts = [
          toPlainText(opening.description || opening.descriptionHtml),
          departments.length
            ? `Department: ${departments.join(", ")}`
            : "",
          opening.minimumExperience
            ? `Experience level: ${opening.minimumExperience}`
            : "",
          opening.compensation
            ? `Compensation: ${opening.compensation}`
            : "",
          opening.datePosted
            ? `Date posted: ${opening.datePosted}`
            : "",
        ].filter(Boolean);

        jobs.push(
          makeJob({
            title,
            company: slug,
            location: locations.join(", ") || "Not specified",
            employmentType:
              opening.employmentStatusLabel ||
              item.employmentStatusLabel ||
              "",
            link,
            description: descriptionParts.join("\n\n"),
            source: "bamboohr",
          }),
        );

        addedForBoard++;
      }

      console.log(
        `[bamboohr] ${slug}: ${addedForBoard} relevant listings; ${detailRequests} detail requests`,
      );
    } catch (error) {
      // One broken board must not stop other companies from being checked.
      console.warn(
        `[bamboohr] Board "${slug}" failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[bamboohr] Retrieved ${jobs.length} relevant listings across ${slugs.length} configured boards.`,
  );

  return jobs;
}
