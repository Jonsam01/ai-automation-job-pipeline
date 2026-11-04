
import Parser from "rss-parser";
import { makeJob } from "./base.js";

const parser = new Parser();

// Official public RSS feeds from We Work Remotely.
// Broad feeds improve discovery; lib/scorer.js evaluates relevance afterward.
const FEEDS = {
  allJobs: "https://weworkremotely.com/remote-jobs.rss",
  programming:
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  backend:
    "https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss",
  devopsSysadmin:
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  product:
    "https://weworkremotely.com/categories/remote-product-jobs.rss",
  allOther:
    "https://weworkremotely.com/categories/all-other-remote-jobs.rss",
};

export async function fetchWeWorkRemotely() {
  const jobs = [];
  const seen = new Set();

  for (const [category, url] of Object.entries(FEEDS)) {
    try {
      const feed = await parser.parseURL(url);
      let categoryCount = 0;

      for (const entry of feed.items || []) {
        const link = String(entry.link || "").trim();

        // The same listing can occur in multiple RSS feeds.
        if (!link || seen.has(link)) {
          continue;
        }

        seen.add(link);

        const rawTitle = String(entry.title || "").trim();
        let company = "";
        let title = rawTitle;

        // WWR often formats RSS titles as "Company: Role".
        const separator = rawTitle.indexOf(":");

        if (separator > 0) {
          company = rawTitle.slice(0, separator).trim();
          title = rawTitle.slice(separator + 1).trim();
        }

        // Prefer plain-text content when available for keyword matching.
        const description = String(
          entry.contentSnippet ||
          entry.summary ||
          entry.content ||
          "",
        );

        jobs.push(
          makeJob({
            title,
            company,
            location: "Remote",
            employmentType: "",
            link,
            description,
            source: "weworkremotely",
          }),
        );

        categoryCount++;
      }

      console.log(
        `[weworkremotely] ${category}: ${categoryCount} unique listings`,
      );
    } catch (error) {
      // One broken feed should not prevent other feeds from being processed.
      console.warn(
        `[weworkremotely] Feed ${category} failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[weworkremotely] Retrieved ${jobs.length} unique listings across ${Object.keys(FEEDS).length} feeds.`,
  );

  return jobs;
}
