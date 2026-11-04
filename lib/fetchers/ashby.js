
import { safeGet, makeJob } from "./base.js";
import { loadJson } from "../loadJson.js";

const companies = loadJson(import.meta.url, "../../config/companies.json");

const API_TEMPLATE = (slug) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;

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

function getSecondaryLocations(locations) {
  if (!Array.isArray(locations)) return [];

  return locations
    .map((item) => {
      if (typeof item === "string") return item.trim();

      return [
        item?.location,
        item?.address?.addressLocality,
        item?.address?.addressRegion,
        item?.address?.addressCountry,
      ]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean);
}

export async function fetchAshby() {
  const jobs = [];
  const seen = new Set();

  const slugs = Array.isArray(companies.ashby)
    ? companies.ashby
    : [];

  for (const rawSlug of slugs) {
    const slug = String(rawSlug || "").trim();

    if (!slug) continue;

    try {
      const response = await safeGet(API_TEMPLATE(slug));

      if (!response) {
        console.warn(`[ashby] No response for board "${slug}".`);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[ashby] Board "${slug}" returned HTTP ${response.status}.`,
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data.jobs)) {
        console.warn(
          `[ashby] Unexpected response format for board "${slug}".`,
        );
        continue;
      }

      let addedForBoard = 0;

      for (const item of data.jobs) {
        if (!item || !item.title) continue;

        // Respect public-board visibility. Unlisted roles should not be
        // displayed as public opportunities.
        if (item.isListed === false) continue;

        // Prefer the hosted job page so candidates can review the posting.
        const link = String(item.jobUrl || item.applyUrl || "").trim();

        if (!link || seen.has(link)) continue;

        seen.add(link);

        const secondaryLocations = getSecondaryLocations(
          item.secondaryLocations,
        );

        const locations = [
          item.location,
          ...secondaryLocations,
        ].filter(Boolean);

        const workplaceType = String(item.workplaceType || "").trim();

        if (
          workplaceType &&
          !locations.some(
            (location) =>
              location.toLowerCase() === workplaceType.toLowerCase(),
          )
        ) {
          locations.push(workplaceType);
        } else if (
          !locations.length &&
          item.isRemote === true
        ) {
          // Ashby's isRemote flag can include hybrid roles. Don't label
          // a role fully remote unless workplaceType explicitly says so.
          locations.push("Remote/Hybrid");
        }

        const descriptionParts = [
          toPlainText(item.descriptionPlain || item.descriptionHtml),
          item.department ? `Department: ${item.department}` : "",
          item.team ? `Team: ${item.team}` : "",
          workplaceType ? `Workplace type: ${workplaceType}` : "",
          item.employmentType
            ? `Employment type: ${item.employmentType}`
            : "",
          item.publishedAt ? `Published: ${item.publishedAt}` : "",
          item.compensation?.compensationTierSummary
            ? `Compensation: ${item.compensation.compensationTierSummary}`
            : "",
        ].filter(Boolean);

        jobs.push(
          makeJob({
            title: item.title,
            company: slug,
            location: locations.join(", ") || "Not specified",
            employmentType: item.employmentType || "",
            link,
            description: descriptionParts.join("\n\n"),
            source: "ashby",
          }),
        );

        addedForBoard++;
      }

      console.log(
        `[ashby] ${slug}: ${addedForBoard} unique listings`,
      );
    } catch (error) {
      // A failed board should not prevent the other boards from running.
      console.warn(
        `[ashby] Board "${slug}" failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[ashby] Retrieved ${jobs.length} unique listings across ${slugs.length} configured boards.`,
  );

  return jobs;
}
