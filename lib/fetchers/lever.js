
import { safeGet, makeJob } from "./base.js";
import { loadJson } from "../loadJson.js";

const companies = loadJson(import.meta.url, "../../config/companies.json");

const API_TEMPLATE = (slug) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}`;

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

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()),
    ),
  ];
}

export async function fetchLever() {
  const jobs = [];
  const seen = new Set();

  const slugs = Array.isArray(companies.lever)
    ? companies.lever
    : [];

  for (const rawSlug of slugs) {
    const slug = String(rawSlug || "").trim();

    if (!slug) continue;

    try {
      const response = await safeGet(API_TEMPLATE(slug), {
        mode: "json",
      });

      if (!response) {
        console.warn(`[lever] No response for board "${slug}".`);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[lever] Board "${slug}" returned HTTP ${response.status}.`,
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.warn(
          `[lever] Unexpected response format for board "${slug}".`,
        );
        continue;
      }

      let addedForBoard = 0;

      for (const item of data) {
        if (!item || !item.text) continue;

        // Keep the original hosted job page for review and application.
        const link = String(item.hostedUrl || "").trim();

        if (!link || seen.has(link)) continue;

        seen.add(link);

        const categories = item.categories || {};

        const locations = uniqueStrings([
          ...(Array.isArray(categories.allLocations)
            ? categories.allLocations
            : []),
          categories.location,
          item.workplaceType === "remote" ? "Remote" : "",
        ]);

        const descriptionParts = [
          toPlainText(item.descriptionPlain || item.description),
          toPlainText(item.openingPlain || item.opening),
          toPlainText(item.additionalPlain || item.additional),
          categories.team ? `Team: ${categories.team}` : "",
          categories.department
            ? `Department: ${categories.department}`
            : "",
          categories.level ? `Level: ${categories.level}` : "",
          categories.commitment
            ? `Employment type: ${categories.commitment}`
            : "",
          item.workplaceType
            ? `Workplace type: ${item.workplaceType}`
            : "",
          item.salaryDescriptionPlain
            ? `Salary information: ${item.salaryDescriptionPlain}`
            : "",
          ...(Array.isArray(item.lists)
            ? item.lists.map(
              (section) =>
                `${section?.text || ""}: ${toPlainText(section?.content)}`,
            )
            : []),
        ].filter(Boolean);

        jobs.push(
          makeJob({
            title: item.text,
            company: slug,
            location: locations.join(", ") || "Not specified",
            employmentType: categories.commitment || "",
            link,
            description: descriptionParts.join("\n\n"),
            source: "lever",
          }),
        );

        addedForBoard++;
      }

      console.log(
        `[lever] ${slug}: ${addedForBoard} unique listings`,
      );
    } catch (error) {
      // A failed company board must not prevent other boards from being checked.
      console.warn(
        `[lever] Board "${slug}" failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[lever] Retrieved ${jobs.length} unique listings across ${slugs.length} configured boards.`,
  );

  return jobs;
}
