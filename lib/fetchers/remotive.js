
import { safeGet, makeJob } from "./base.js";

const API_URL = "https://remotive.com/api/remote-jobs";

// Fetch listings once per pipeline run.
// The central scoring engine determines which roles match our
// AI automation, workflow engineering, integration, and AI internship targets.
export async function fetchRemotive() {
  const response = await safeGet(API_URL, {});

  if (!response) {
    console.warn("[remotive] No response received from the API.");
    return [];
  }

  if (!response.ok) {
    console.warn(
      `[remotive] API returned HTTP ${response.status}.`,
    );
    return [];
  }

  const data = await response.json();

  if (!Array.isArray(data.jobs)) {
    console.warn("[remotive] Unexpected API response format.");
    return [];
  }

  const jobs = [];
  const seen = new Set();

  for (const item of data.jobs) {
    const link = item.url || "";

    // Skip records without a usable job link and eliminate duplicates.
    if (!link || seen.has(link)) {
      continue;
    }

    seen.add(link);

    jobs.push(
      makeJob({
        title: item.title || "",
        company: item.company_name || "",
        location: item.candidate_required_location || "Worldwide",
        employmentType: item.job_type || "",
        link,
        description: item.description || "",
        source: "remotive",
      }),
    );
  }

  console.log(`[remotive] Retrieved ${jobs.length} unique listings.`);

  return jobs;
}
