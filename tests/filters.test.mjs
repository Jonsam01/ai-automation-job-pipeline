
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isLocationEligible,
  isLocationRestricted,
  isRemoteJob,
  filterJobs,
  deduplicate,
} from "../lib/filters.js";

// --------------------------------------------------
// NIGERIA CANDIDATE LOCATION
// --------------------------------------------------

test("Nigeria is accepted when explicitly listed as a hiring location", () => {
  const result = isLocationEligible("Lagos, Nigeria");

  assert.equal(result.ok, true);
  assert.equal(result.status, "candidate_country_listed");
});

test("Nigeria-specific remote listings are recognised", () => {
  const result = isLocationEligible("Remote - Nigeria");

  assert.equal(result.ok, true);
  assert.equal(result.status, "candidate_country_listed");
});

// --------------------------------------------------
// COUNTRY-SPECIFIC OPPORTUNITIES
// --------------------------------------------------

test("other countries are accepted without salary-based exclusions", () => {
  const locations = [
    "Remote - USA",
    "Remote - Egypt",
    "Remote - France",
    "Remote - Germany",
    "Remote - India",
    "Remote - Philippines",
    "Remote - Russia",
    "Remote - Australia",
    "Remote - Argentina",
  ];

  for (const location of locations) {
    assert.equal(
      isLocationEligible(location).ok,
      true,
      location,
    );
  }
});

test("country-specific opportunities receive an unverified status", () => {
  const result = isLocationEligible("Remote - Germany");

  assert.equal(result.ok, true);
  assert.equal(
    result.status,
    "country_specific_unverified",
  );
});

test("country-specific remote jobs require manual location review", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote - USA",
      link: "https://example.com/jobs/usa",
    },
    {
      source: "himalayas",
      title: "Automation Engineer",
      location: "South Africa",
      link: "https://example.com/jobs/sa",
    },
  ]);

  assert.equal(jobs.length, 2);

  for (const job of jobs) {
    assert.equal(job.locationRestricted, true);
    assert.equal(job.locationReviewRequired, true);
    assert.equal(
      job.locationEligibilityStatus,
      "country_specific_unverified",
    );
  }
});

// --------------------------------------------------
// OPEN AND RESTRICTED REGIONS
// --------------------------------------------------

test("worldwide, Africa-wide and EMEA opportunities are accepted", () => {
  const locations = [
    "Remote",
    "Worldwide",
    "Remote, Global",
    "Remote - Anywhere",
    "Remote, EMEA",
    "EMEA",
    "Africa",
    "Remote - Africa",
    "Sub-Saharan Africa",
    "",
  ];

  for (const location of locations) {
    assert.equal(
      isLocationEligible(location).ok,
      true,
      location || "(blank)",
    );
  }
});

test("restricted hiring regions are rejected", () => {
  const locations = [
    "Remote - AMER",
    "Remote - Americas",
    "Remote - North America",
    "Remote - LATAM",
    "Remote - Latin America",
    "Remote - APAC",
    "Remote - Asia Pacific",
    "Remote - Asia",
    "Remote - Europe",
  ];

  for (const location of locations) {
    assert.equal(
      isLocationEligible(location).ok,
      false,
      location,
    );
  }
});

test("open hiring regions are not flagged as country-restricted", () => {
  const locations = [
    "Remote",
    "Remote, EMEA",
    "Remote, Africa",
    "Remote, Global",
    "Worldwide",
    "Anywhere",
  ];

  for (const location of locations) {
    assert.equal(
      isLocationRestricted(location),
      false,
      location,
    );
  }
});

test("closed geographic regions are flagged as restricted", () => {
  for (const location of [
    "Remote - LATAM",
    "Remote - APAC",
    "Remote - Europe",
    "Remote - North America",
  ]) {
    assert.equal(
      isLocationRestricted(location),
      true,
      location,
    );
  }
});

// --------------------------------------------------
// COUNTRY AND REGION DISTINCTION
// --------------------------------------------------

test("South Africa is recognised as a country, not the open Africa region", () => {
  assert.equal(
    isLocationEligible("South Africa").status,
    "country_specific_unverified",
  );

  assert.equal(
    isLocationEligible("Remote - South Africa").status,
    "country_specific_unverified",
  );

  assert.equal(
    isLocationRestricted("South Africa"),
    true,
  );

  assert.equal(
    isLocationRestricted("Africa"),
    false,
  );
});

test("multi-country listings explicitly including Nigeria are recognised", () => {
  const location =
    "Egypt, Argentina, Ethiopia, South Africa, Nigeria, Remote";

  const result = isLocationEligible(location);

  assert.equal(result.ok, true);
  assert.equal(result.status, "candidate_country_listed");

  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location,
      link: "https://example.com/jobs/multicountry",
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].locationRestricted, false);
  assert.equal(jobs[0].locationReviewRequired, false);
});

test("multi-country listings without Nigeria remain unverified", () => {
  const location = "United States, Canada, Remote";

  const result = isLocationEligible(location);

  assert.equal(result.ok, true);
  assert.equal(
    result.status,
    "country_specific_unverified",
  );
});

// --------------------------------------------------
// EXPLICIT GEOGRAPHIC RESTRICTIONS
// --------------------------------------------------

test("LATAM-only restrictions in descriptions are rejected", () => {
  const jobs = filterJobs([
    {
      source: "himalayas",
      title: "AI Automation Engineer",
      location: "Remote",
      description: "This opportunity is LATAM only.",
      link: "https://example.com/jobs/latam-description",
    },
  ]);

  assert.equal(jobs.length, 0);
});

test("LATAM-only restrictions in titles are rejected", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer - LATAM only",
      location: "Remote",
      description: "Remote position.",
      link: "https://example.com/jobs/latam-title",
    },
  ]);

  assert.equal(jobs.length, 0);
});

test("US-only restrictions are rejected for a Nigeria-based candidate", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote",
      description: "US only.",
      link: "https://example.com/jobs/us-only",
    },
  ]);

  assert.equal(jobs.length, 0);
});

test("Nigeria-only restrictions are not rejected", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote",
      description: "Nigeria only.",
      link: "https://example.com/jobs/nigeria-only",
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].locationReviewRequired, true);
});

// --------------------------------------------------
// PROVISIONAL LOCATION REVIEW
// --------------------------------------------------

test("generic Remote jobs are accepted provisionally and flagged for review", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote",
      link: "https://example.com/jobs/generic-remote",
    },
  ]);

  assert.equal(jobs.length, 1);

  assert.equal(jobs[0].locationRestricted, false);
  assert.equal(jobs[0].locationReviewRequired, true);
  assert.equal(
    jobs[0].locationEligibilityStatus,
    "remote_unverified",
  );
});

test("missing locations are accepted provisionally and require review", () => {
  const result = isLocationEligible("");

  assert.equal(result.ok, true);
  assert.equal(result.status, "missing_location");

  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "",
      link: "https://example.com/jobs/no-location",
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].locationReviewRequired, true);
});

test("work authorisation wording triggers manual review", () => {
  const jobs = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Nigeria",
      description: "Applicants must be authorised to work in Nigeria.",
      link: "https://example.com/jobs/authorisation",
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(
    jobs[0].workAuthorizationReviewRequired,
    true,
  );
  assert.equal(
    jobs[0].locationReviewRequired,
    true,
  );
});

// --------------------------------------------------
// REMOTE JOB DETECTION
// --------------------------------------------------

test("remote-only job sources are classified as remote", () => {
  for (const source of [
    "remotive",
    "weworkremotely",
    "himalayas",
    "remoteok",
  ]) {
    assert.equal(
      isRemoteJob({
        source,
        location: "United States",
        title: "AI Automation Engineer",
      }),
      true,
      source,
    );
  }
});

test("ordinary company boards are not automatically classified as remote", () => {
  assert.equal(
    isRemoteJob({
      source: "greenhouse",
      location: "Berlin, Germany",
      title: "AI Automation Engineer",
      description: "",
    }),
    false,
  );

  assert.equal(
    isRemoteJob({
      source: "greenhouse",
      location: "",
      title: "AI Automation Engineer",
      description: "This is a fully remote role.",
    }),
    true,
  );
});

test("remote-only sources do not bypass closed-region restrictions", () => {
  const jobs = filterJobs([
    {
      source: "himalayas",
      title: "AI Automation Engineer",
      location: "Remote - LATAM",
      link: "https://example.com/jobs/latam",
    },
    {
      source: "himalayas",
      title: "AI Automation Engineer",
      location: "South Africa",
      link: "https://example.com/jobs/south-africa",
    },
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, "South Africa");
});

// --------------------------------------------------
// FILTER OUTPUT
// --------------------------------------------------

test("filterJobs attaches eligibility and review information", () => {
  const results = filterJobs([
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Nigeria",
      link: "https://example.com/jobs/nigeria",
    },
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote - USA",
      link: "https://example.com/jobs/usa",
    },
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote - LATAM",
      link: "https://example.com/jobs/latam",
    },
    {
      source: "ashby",
      title: "AI Automation Engineer",
      location: "Remote",
      link: "https://example.com/jobs/remote",
    },
  ]);

  assert.equal(results.length, 3);

  assert.equal(
    results[0].locationEligibilityStatus,
    "candidate_country_listed",
  );

  assert.equal(results[0].locationReviewRequired, false);

  assert.equal(
    results[1].locationEligibilityStatus,
    "country_specific_unverified",
  );

  assert.equal(results[1].locationReviewRequired, true);

  assert.equal(
    results[2].locationEligibilityStatus,
    "remote_unverified",
  );

  assert.equal(results[2].locationReviewRequired, true);
});

// --------------------------------------------------
// DEDUPLICATION
// --------------------------------------------------

test("deduplicate removes existing links, repeats and missing links", () => {
  const results = deduplicate(
    [
      { link: "a" },
      { link: "b" },
      { link: "b" },
      { link: "" },
      { link: "c" },
    ],
    new Set(["a"]),
  );

  assert.deepEqual(
    results.map((job) => job.link),
    ["b", "c"],
  );
});

test("deduplicate removes tracking parameters from job URLs", () => {
  const results = deduplicate([
    {
      link: "https://example.com/jobs/123?utm_source=linkedin",
    },
    {
      link: "https://example.com/jobs/123?utm_campaign=automation",
    },
    {
      link: "https://example.com/jobs/456?ref=homepage",
    },
  ]);

  assert.equal(results.length, 2);
});

test("deduplicate recognizes existing URLs with tracking parameters", () => {
  const existing = new Set([
    "https://example.com/jobs/123?utm_source=old",
  ]);

  const results = deduplicate(
    [
      {
        link: "https://example.com/jobs/123?utm_source=new",
      },
      {
        link: "https://example.com/jobs/456",
      },
    ],
    existing,
  );

  assert.equal(results.length, 1);

  assert.equal(
    results[0].link,
    "https://example.com/jobs/456",
  );
});
