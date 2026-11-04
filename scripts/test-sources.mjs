
import { fetchAllJobs } from "../lib/fetchers/index.js";

import {
    filterJobs,
    deduplicate,
} from "../lib/filters.js";

import {
    scoreAll,
} from "../lib/scorer.js";

// --------------------------------------------------
// DIAGNOSTIC CONFIGURATION
// --------------------------------------------------

const MINIMUM_SCORE = 55;
const STRONG_SCORE = 70;
const MAX_PER_COMPANY = Number.MAX_SAFE_INTEGER;

const SOURCES = [
    "remotive",
    "weworkremotely",
    "himalayas",
    "remoteok",
    "greenhouse",
    "lever",
    "ashby",
    "bamboohr",
    "seek-australia",
    "seek-new-zealand",
];

const INTERNSHIP_RE =
    /\b(intern(?:ship)?|trainee|apprentice|graduate|entry[- ]level|junior|jr|associate|early career|new grad)\b/i;

// --------------------------------------------------
// REPORTING HELPERS
// --------------------------------------------------

function countBySource(jobs) {
    const counts = {};

    for (const job of jobs) {
        const source = job.source || "unknown";
        counts[source] = (counts[source] || 0) + 1;
    }

    return counts;
}

function printSourceCounts(title, jobs) {
    console.log(`\n${title}`);

    const counts = countBySource(jobs);

    for (const source of SOURCES) {
        console.log(
            `${source.padEnd(20)} ${counts[source] || 0}`,
        );
    }

    const otherSources = Object.keys(counts).filter(
        (source) => !SOURCES.includes(source),
    );

    for (const source of otherSources) {
        console.log(
            `${source.padEnd(20)} ${counts[source]}`,
        );
    }
}

function countFlag(jobs, property) {
    return jobs.filter((job) => job[property] === true).length;
}

function printRegionSummary(jobs) {
    const restricted = countFlag(
        jobs,
        "locationRestricted",
    );

    const locationReviewRequired = countFlag(
        jobs,
        "locationReviewRequired",
    );

    const workAuthorizationReviewRequired = countFlag(
        jobs,
        "workAuthorizationReviewRequired",
    );

    const missingLocation = jobs.filter(
        (job) => !String(job.location || "").trim(),
    ).length;

    console.log("\nLOCATION AND ELIGIBILITY REVIEW");
    console.log("--------------------------------------");

    console.log(
        `Location-restricted jobs: ${restricted}`,
    );

    console.log(
        `Location review required: ${locationReviewRequired}`,
    );

    console.log(
        `Work authorisation review required: ${workAuthorizationReviewRequired}`,
    );

    console.log(
        `Missing location information: ${missingLocation}`,
    );
}

function printMatches(title, jobs) {
    console.log(`\n${title}`);

    if (!jobs.length) {
        console.log("No matching jobs found.");
        return;
    }

    for (const [index, job] of jobs.entries()) {
        console.log(
            `\n${index + 1}. [${job.matchScore}/100] ${job.title}`,
        );

        console.log(
            `   Company: ${job.company || "Not specified"}`,
        );

        console.log(
            `   Source: ${job.source || "Unknown"}`,
        );

        console.log(
            `   Location: ${job.location || "Not specified"}`,
        );

        console.log(
            `   Employment type: ${job.employmentType || "Not specified"}`,
        );

        console.log(
            `   CV: ${job.cvVersion || "Not assigned"}`,
        );

        // This flag relates only to CV category selection.
        console.log(
            `   CV selection review required: ${Boolean(job.needsManualReview)}`,
        );

        // These flags relate to geographic and employment eligibility.
        console.log(
            `   Location restricted: ${Boolean(job.locationRestricted)}`,
        );

        console.log(
            `   Location review required: ${typeof job.locationReviewRequired === "boolean"
                ? job.locationReviewRequired
                : "NOT SET"
            }`,
        );

        console.log(
            `   Work authorisation review required: ${typeof job.workAuthorizationReviewRequired === "boolean"
                ? job.workAuthorizationReviewRequired
                : "NOT SET"
            }`,
        );

        console.log(
            `   Eligibility reason: ${job.eligibilityReason || "Not provided"}`,
        );

        console.log(
            `   URL: ${job.link || "No URL"}`,
        );
    }
}

function printReviewSummary(title, jobs) {
    console.log(`\n${title}`);

    const cvReview = countFlag(
        jobs,
        "needsManualReview",
    );

    const locationReview = countFlag(
        jobs,
        "locationReviewRequired",
    );

    const workAuthorizationReview = countFlag(
        jobs,
        "workAuthorizationReviewRequired",
    );

    console.log(`CV selection review: ${cvReview}`);
    console.log(`Location eligibility review: ${locationReview}`);
    console.log(`Work authorisation review: ${workAuthorizationReview}`);
}

// --------------------------------------------------
// MAIN DIAGNOSTIC
// --------------------------------------------------

async function main() {
    const startedAt = Date.now();

    console.log("======================================");
    console.log(" AI AUTOMATION JOB DISCOVERY DIAGNOSTIC");
    console.log("======================================");

    // STAGE 1: FETCH

    console.log("\nStage 1: Fetching jobs from all sources...");

    // Read-only: no Google Sheets writes or application actions.
    const rawJobs = await fetchAllJobs();

    console.log(
        `\nRaw listings discovered: ${rawJobs.length}`,
    );

    printSourceCounts(
        "RAW LISTINGS BY SOURCE",
        rawJobs,
    );

    // STAGE 2: LOCATION ELIGIBILITY

    const eligibleJobs = filterJobs(rawJobs);

    console.log("\nStage 2: Location eligibility");

    console.log(
        `Eligible listings: ${eligibleJobs.length}`,
    );

    console.log(
        `Rejected by location rules: ${rawJobs.length - eligibleJobs.length
        }`,
    );

    // STAGE 3: DUPLICATE REMOVAL

    // This diagnostic removes duplicates within the fetched batch.
    // It deliberately does not query or modify Google Sheets.
    const uniqueJobs = deduplicate(
        eligibleJobs,
        new Set(),
    );

    console.log("\nStage 3: Duplicate removal");

    console.log(
        `Unique eligible listings: ${uniqueJobs.length}`,
    );

    console.log(
        `Duplicates removed: ${eligibleJobs.length - uniqueJobs.length
        }`,
    );

    printSourceCounts(
        "ELIGIBLE UNIQUE LISTINGS BY SOURCE",
        uniqueJobs,
    );

    printRegionSummary(uniqueJobs);

    // STAGE 4: SCORING

    const matches55 = scoreAll(
        uniqueJobs,
        MINIMUM_SCORE,
        MAX_PER_COMPANY,
    );

    const matches70 = scoreAll(
        uniqueJobs,
        STRONG_SCORE,
        MAX_PER_COMPANY,
    );

    const internships = matches55.filter((job) =>
        INTERNSHIP_RE.test(job.title || ""),
    );

    const restrictedMatches = matches55.filter(
        (job) => job.locationRestricted === true,
    );

    const locationReviewMatches = matches55.filter(
        (job) => job.locationReviewRequired === true,
    );

    const workAuthorizationMatches = matches55.filter(
        (job) => job.workAuthorizationReviewRequired === true,
    );

    const cvReviewMatches = matches55.filter(
        (job) => job.needsManualReview === true,
    );

    // STAGE 5: SUMMARY

    console.log("\n======================================");
    console.log(" MATCHING SUMMARY");
    console.log("======================================");

    console.log(`Raw discovered: ${rawJobs.length}`);
    console.log(`Location eligible: ${eligibleJobs.length}`);
    console.log(`Unique eligible: ${uniqueJobs.length}`);

    console.log(
        `Matches scoring ${MINIMUM_SCORE}+: ${matches55.length}`,
    );

    console.log(
        `Strong matches scoring ${STRONG_SCORE}+: ${matches70.length}`,
    );

    console.log(
        `Internship / early-career matches: ${internships.length}`,
    );

    console.log(
        `Location-restricted matches: ${restrictedMatches.length}`,
    );

    console.log(
        `Location review required: ${locationReviewMatches.length}`,
    );

    console.log(
        `Work authorisation review required: ${workAuthorizationMatches.length}`,
    );

    console.log(
        `CV selection review required: ${cvReviewMatches.length}`,
    );

    printSourceCounts(
        "MATCHES SCORING 55+",
        matches55,
    );

    printSourceCounts(
        "STRONG MATCHES SCORING 70+",
        matches70,
    );

    // STAGE 6: REVIEW SUMMARY

    printReviewSummary(
        "REVIEW REQUIREMENTS FOR ALL MATCHING JOBS",
        matches55,
    );

    // STAGE 7: TOP OPPORTUNITIES

    printMatches(
        "TOP 25 AI AUTOMATION OPPORTUNITIES",
        matches55.slice(0, 25),
    );

    printMatches(
        "TOP 15 INTERNSHIP AND EARLY-CAREER OPPORTUNITIES",
        internships.slice(0, 15),
    );

    // STAGE 8: COMPLETION

    const elapsed = (
        (Date.now() - startedAt) / 1000
    ).toFixed(1);

    console.log("\n======================================");
    console.log(" DIAGNOSTIC COMPLETED");
    console.log(` Duration: ${elapsed} seconds`);
    console.log(" No Google Sheets writes performed.");
    console.log(" No applications or emails sent.");
    console.log("======================================");
}

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

main().catch((error) => {
    console.error("\nDiagnostic failed:", error);
    process.exitCode = 1;
});
