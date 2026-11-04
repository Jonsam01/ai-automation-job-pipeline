
import { safeGet, makeJob } from "./base.js";
import { loadJson } from "../loadJson.js";

const companies = loadJson(import.meta.url, "../../config/companies.json");

const API_TEMPLATE = (slug) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;

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

function uniqueNames(items, key = "name") {
  if (!Array.isArray(items)) return [];

  return [
    ...new Set(
      items
        .map((item) =>
          typeof item === "string" ? item : item?.[key],
        )
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()),
    ),
  ];
}

export async function fetchGreenhouse() {
  const jobs = [];
  const seen = new Set();

  const slugs = Array.isArray(companies.greenhouse)
    ? companies.greenhouse
    : [];

  for (const rawSlug of slugs) {
    const slug = String(rawSlug || "").trim();

    if (!slug) continue;

    try {
      const response = await safeGet(API_TEMPLATE(slug), {
        content: "true",
      });

      if (!response) {
        console.warn(`[greenhouse] No response for board "${slug}".`);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[greenhouse] Board "${slug}" returned HTTP ${response.status}.`,
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data.jobs)) {
        console.warn(
          `[greenhouse] Unexpected response format for board "${slug}".`,
        );
        continue;
      }

      let addedForBoard = 0;

      for (const item of data.jobs) {
        if (!item || !item.title) continue;

        const link = String(item.absolute_url || "").trim();

        if (!link || seen.has(link)) continue;

        seen.add(link);

        const departments = uniqueNames(item.departments);
        const offices = uniqueNames(item.offices);
        const locationDetails = uniqueNames(
          item.offices?.map((office) => ({
            name: office?.location || office?.name || "",
          })) || [],
        );

        const location =
          item.location?.name ||
          locationDetails.join(", ") ||
          offices.join(", ") ||
          "";

        const descriptionParts = [
          toPlainText(item.content),
          departments.length
            ? `Departments: ${departments.join(", ")}`
            : "",
          offices.length ? `Offices: ${offices.join(", ")}` : "",
        ].filter(Boolean);

        jobs.push(
          makeJob({
            title: item.title,
            company: slug,
            location: location || "Not specified",
            employmentType: "",
            link,
            description: descriptionParts.join("\n\n"),
            source: "greenhouse",
          }),
        );

        addedForBoard++;
      }

      console.log(
        `[greenhouse] ${slug}: ${addedForBoard} unique listings`,
      );
    } catch (error) {
      // A failed board must not prevent other companies from being checked.
      console.warn(
        `[greenhouse] Board "${slug}" failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[greenhouse] Retrieved ${jobs.length} unique listings across ${slugs.length} configured boards.`,
  );

  return jobs;
}
