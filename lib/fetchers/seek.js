
import { safeGet, makeJob } from "./base.js";

// Regional search endpoints used by the existing fetcher.
// Note: these are unofficial website endpoints, not SEEK's approved
// integration API. Use only where your access is authorized.
const MARKETS = [
  {
    key: "Australia",
    source: "seek-australia",
    apiUrl: "https://www.seek.com.au/api/jobsearch/v5/search",
    siteUrl: "https://www.seek.com.au",
    defaultLocation: "Australia",
  },
  {
    key: "New Zealand",
    source: "seek-new-zealand",
    apiUrl: "https://nz.seek.com/api/jobsearch/v5/search",
    siteUrl: "https://nz.seek.com",
    defaultLocation: "New Zealand",
  },
];

const SEARCH_TERMS = [
  "AI Automation Engineer",
  "AI Automation Specialist",
  "AI Automation Developer",
  "Workflow Automation Engineer",
  "Workflow Engineer",
  "Workflow Automation Developer",
  "Automation Engineer",
  "Automation Specialist",
  "n8n Developer",
  "n8n Automation Engineer",
  "Automation and Integrations Engineer",
  "AI Integration Engineer",
  "API Integration Engineer",
  "Business Process Automation Engineer",
  "AI Agent Engineer",
  "AI Agent Developer",
  "Agentic AI Engineer",
  "LLM Application Engineer",
  "LLM Workflow Engineer",
  "AI Solutions Engineer",
  "AI Implementation Engineer",
  "AI Operations Engineer",
  "AI Specialist",
  "AI Engineer",
  "AI Developer",
  "Generative AI Developer",
  "Conversational AI Engineer",
  "AI Automation Consultant",
  "AI Intern",
  "Artificial Intelligence Intern",
  "AI Automation Intern",
  "Automation Intern",
  "Workflow Automation Intern",
  "Workflow Engineering Intern",
  "n8n Intern",
  "AI Agent Intern",
  "LLM Intern",
  "AI Integration Intern",
  "API Integration Intern",
  "Intelligent Automation Intern",
  "Technical Intern",
  "Graduate AI Engineer",
  "Junior Automation Engineer",
  "Automation Trainee",
  "AI Apprentice",
  "n8n",
  "workflow automation",
  "AI agents",
  "webhook",
  "REST API integration",
  "LangChain",
  "generative AI",
  "Zapier",
];

// One combined query per market keeps request volume lower than
// querying every individual title separately.
const KEYWORDS = SEARCH_TERMS
  .map((term) => `"${term.replace(/"/g, '\\"')}"`)
  .join(" OR ");

function joinLabels(values) {
  if (!Array.isArray(values)) return "";

  return values
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.label || item?.description || "";
    })
    .filter(Boolean)
    .join(", ");
}

export async function fetchSeek() {
  const jobs = [];
  const seen = new Set();

  for (const market of MARKETS) {
    try {
      const response = await safeGet(market.apiUrl, {
        keywords: KEYWORDS,
        page: 1,
      });

      if (!response) {
        console.warn(`[seek] ${market.key}: no response received.`);
        continue;
      }

      if (!response.ok) {
        console.warn(
          `[seek] ${market.key}: HTTP ${response.status}.`,
        );
        continue;
      }

      const data = await response.json();

      if (!Array.isArray(data.data)) {
        console.warn(
          `[seek] ${market.key}: unexpected response format.`,
        );
        continue;
      }

      let addedForMarket = 0;

      for (const item of data.data) {
        if (!item?.id || !item?.title) continue;

        const link = `${market.siteUrl}/job/${item.id}`;

        if (seen.has(link)) continue;
        seen.add(link);

        const locationLabels = joinLabels(item.locations);
        const workTypes = joinLabels(item.workTypes);
        const workArrangements = joinLabels(item.workArrangements);
        const classifications = joinLabels(item.classifications);

        const descriptionParts = [
          item.teaser || "",
          classifications
            ? `Classifications: ${classifications}`
            : "",
          workTypes ? `Work types: ${workTypes}` : "",
          workArrangements
            ? `Work arrangements: ${workArrangements}`
            : "",
        ].filter(Boolean);

        jobs.push(
          makeJob({
            title: item.title,
            company: item.advertiser?.description || "",
            location: locationLabels || market.defaultLocation,
            employmentType: workTypes,
            link,
            description: descriptionParts.join("\n\n"),
            source: market.source,
          }),
        );

        addedForMarket++;
      }

      console.log(
        `[seek] ${market.key}: ${addedForMarket} unique listings.`,
      );
    } catch (error) {
      // A failure in one market must not stop the other market.
      console.warn(
        `[seek] ${market.key} failed: ${error.message}`,
      );
    }
  }

  console.log(
    `[seek] Retrieved ${jobs.length} unique listings across ${MARKETS.length} markets.`,
  );

  return jobs;
}
