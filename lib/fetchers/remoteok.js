
import { safeGet, makeJob } from "./base.js";

const API_URL = "https://remoteok.com/api";

function toPlainText(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6])>/gi, " ")
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

export async function fetchRemoteOK() {
  const jobs = [];
  const seen = new Set();

  try {
    // Make one request per pipeline run.
    // Remote OK asks API consumers to keep requests infrequent.
    const response = await safeGet(API_URL);

    if (!response) {
      console.warn("[remoteok] No response received from the API.");
      return jobs;
    }

    if (!response.ok) {
      console.warn(
        `[remoteok] API returned HTTP ${response.status}.`,
      );
      return jobs;
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("[remoteok] Unexpected API response format.");
      return jobs;
    }

    // The first array entry is a notice, not a job.
    for (const item of data.slice(1)) {
      if (!item || !item.position) {
        continue;
      }

      const link = String(item.url || "").trim();

      // Do not store listings without their original application page.
      if (!link || seen.has(link)) {
        continue;
      }

      seen.add(link);

      const tags = Array.isArray(item.tags)
        ? item.tags.filter((tag) => typeof tag === "string")
        : [];

      // Include tags in the searchable text because some listings
      // describe relevant tools more clearly in their tag list.
      const descriptionParts = [
        toPlainText(item.description),
        tags.length ? `Remote OK tags: ${tags.join(", ")}` : "",
      ].filter(Boolean);

      jobs.push(
        makeJob({
          title: item.position || "",
          company: item.company || "",
          location: item.location || "Worldwide",
          employmentType: "",
          link,
          description: descriptionParts.join("\n\n"),
          source: "remoteok",
        }),
      );
    }

    console.log(
      `[remoteok] Retrieved ${jobs.length} unique listings.`,
    );
  } catch (error) {
    // A Remote OK outage should not crash the entire job pipeline.
    console.warn(`[remoteok] Fetch failed: ${error.message}`);
  }

  return jobs;
}
