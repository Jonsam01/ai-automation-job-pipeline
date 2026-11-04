
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "config", "companies.json");
const config = JSON.parse(fs.readFileSync(file, "utf-8"));

const fix = process.argv.includes("--fix");
const addArg = process.argv.find((arg) => arg.startsWith("--add="));

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; job-pipeline-checker/1.0)",
  Accept: "application/json",
};

const BOARDS = {
  greenhouse: (slug) => ({
    url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`,
    count: (data) =>
      Array.isArray(data.jobs) ? data.jobs.length : null,
  }),

  lever: (slug) => ({
    url: `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
    count: (data) =>
      Array.isArray(data) ? data.length : null,
  }),

  ashby: (slug) => ({
    url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
    count: (data) =>
      Array.isArray(data.jobs) ? data.jobs.length : null,
  }),

  bamboohr: (slug) => ({
    url: `https://${slug}.bamboohr.com/careers/list`,
    count: (data) =>
      Array.isArray(data.result) ? data.result.length : null,
  }),
};

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function check(board, slug) {
  const boardConfig = BOARDS[board];

  if (!boardConfig) {
    return { status: "error", detail: "Unknown board type" };
  }

  try {
    const { url, count } = boardConfig(slug);

    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });

    // Only a genuine 404 is considered a dead board.
    if (response.status === 404) {
      return { status: "dead" };
    }

    if (!response.ok) {
      return {
        status: "error",
        detail: `HTTP ${response.status}`,
      };
    }

    let data;

    try {
      data = await response.json();
    } catch {
      return {
        status: "error",
        detail: "Response was not valid JSON",
      };
    }

    const jobs = count(data);

    // An unexpected response shape must not be mistaken for an empty board.
    if (jobs === null) {
      return {
        status: "error",
        detail: "Unexpected API response structure",
      };
    }

    return {
      status: "ok",
      jobs,
    };
  } catch (error) {
    return {
      status: "error",
      detail: error.message,
    };
  }
}

let changed = false;

// 1. Validate and optionally add new companies.
if (addArg) {
  const items = addArg
    .slice("--add=".length)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const item of items) {
    const separator = item.indexOf(":");

    if (separator === -1) {
      console.log(`SKIP  ${item} (expected board:slug)`);
      continue;
    }

    const board = item.slice(0, separator).trim().toLowerCase();
    const slug = item.slice(separator + 1).trim();

    if (!BOARDS[board] || !slug) {
      console.log(
        `SKIP  ${item} (supported boards: ${Object.keys(BOARDS).join(", ")})`,
      );
      continue;
    }

    config[board] = Array.isArray(config[board])
      ? config[board]
      : [];

    if (config[board].includes(slug)) {
      console.log(`HAVE  ${board}/${slug} already configured`);
      continue;
    }

    const result = await check(board, slug);

    if (result.status === "ok") {
      config[board].push(slug);
      changed = true;

      console.log(
        `ADDED ${board}/${slug} (${result.jobs} current jobs)`,
      );
    } else if (result.status === "dead") {
      console.log(`NOPE  ${board}/${slug} (HTTP 404)`);
    } else {
      console.log(
        `WARN  ${board}/${slug}: ${result.detail}. Not added.`,
      );
    }

    await sleep(300);
  }

  console.log("");
}

// 2. Check the companies already in configuration.
for (const board of Object.keys(BOARDS)) {
  const configured = Array.isArray(config[board])
    ? config[board]
    : [];

  const keep = [];

  console.log(`\nChecking ${board.toUpperCase()} boards...`);

  for (const rawSlug of configured) {
    const slug = String(rawSlug || "").trim();

    if (!slug) continue;

    const result = await check(board, slug);

    if (result.status === "ok") {
      console.log(
        `OK    ${board}/${slug} (${result.jobs} jobs)`,
      );

      keep.push(slug);
    } else if (result.status === "dead") {
      console.log(
        `DEAD  ${board}/${slug}${fix ? " - removed" : ""}`,
      );

      if (fix) {
        changed = true;
      } else {
        keep.push(slug);
      }
    } else {
      console.log(
        `WARN  ${board}/${slug} (${result.detail}) - kept`,
      );

      keep.push(slug);
    }

    await sleep(300);
  }

  config[board] = keep;
}

// 3. Save only when explicitly requested or when valid companies were added.
if (changed) {
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  console.log("\nCompany configuration updated.");
} else {
  console.log("\nNo configuration changes made.");

  if (fix) {
    console.log("No confirmed dead boards needed removal.");
  } else {
    console.log("Run with --fix to remove confirmed HTTP 404 boards.");
  }
}
