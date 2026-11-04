
import test from "node:test";
import assert from "node:assert/strict";

import {
  computeMatchScore,
  pickCvVersion,
  scoreAll,
} from "../lib/scorer.js";

const MINIMUM = 55;

const relevantDescription = `
We are looking for an AI Automation Engineer to build and maintain
AI-powered business process automation and workflow solutions.

You will develop n8n workflows, integrate REST APIs and webhooks,
and build applications using the OpenAI API, large language models,
and AI agents.

Experience with function calling, tool calling, structured outputs,
LangChain, retrieval augmented generation (RAG), and vector databases
is useful.

You will also work with Python, JavaScript, SQL, HubSpot, Google Sheets,
CRM integrations, and automated document processing.

The role requires reliable workflows with input validation,
error handling, retries, backoff, deduplication, idempotency,
audit logs, monitoring, and human-in-the-loop approval.
`;

function job(title, overrides = {}) {
  return {
    title,
    company: "Example Company",
    description: "",
    link: "https://example.com/jobs/example",
    employmentType: "Full-time",
    ...overrides,
  };
}

// --------------------------------------------------
// MATCH SCORING TESTS
// --------------------------------------------------

test("AI automation engineer roles receive a strong match score", () => {
  const result = computeMatchScore(
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  assert.ok(
    result >= 70,
    `Expected a strong match score, received ${result}`,
  );
});

test("n8n workflow automation roles are recognised", () => {
  const result = computeMatchScore(
    job("Automation Specialist (n8n Expert)", {
      description: `
        Build n8n workflow automation solutions.
        Integrate REST APIs, webhooks, OpenAI API,
        CRM systems, and automated business processes.
        Maintain retries, error handling, and audit logs.
      `,
    }),
  );

  assert.ok(
    result >= MINIMUM,
    `Expected at least ${MINIMUM}, received ${result}`,
  );
});

test("AI engineering internships with relevant technical skills qualify", () => {
  const result = computeMatchScore(
    job("AI Engineering Intern", {
      employmentType: "Internship",
      description: `
        Assist with AI agent development and LLM applications.
        Work with Python, LangChain, OpenAI API, REST APIs,
        webhooks, RAG, and vector databases.
      `,
    }),
  );

  assert.ok(
    result >= MINIMUM,
    `Expected an eligible early-career score, received ${result}`,
  );
});

test("teaching and coaching roles are penalised", () => {
  const result = computeMatchScore(
    job("AI Automation Teaching Experts", {
      description: `
        Teach students about n8n, workflow automation,
        AI agents, and large language models.
      `,
    }),
  );

  assert.equal(result, 25);
});

test("unrelated frontend development roles do not rank highly", () => {
  const result = computeMatchScore(
    job("Frontend Developer", {
      description: `
        Build responsive websites using React,
        CSS, HTML, and frontend development tools.
      `,
    }),
  );

  assert.ok(
    result < MINIMUM,
    `Expected a score below ${MINIMUM}, received ${result}`,
  );
});

test("unrelated people operations jobs are penalised", () => {
  const result = computeMatchScore(
    job("People Operations Intern", {
      description: `
        Support recruitment, employee onboarding,
        human resources administration, and staff records.
      `,
    }),
  );

  assert.equal(result, 25);
});

// --------------------------------------------------
// SENIORITY REGRESSION TESTS
// --------------------------------------------------

test("senior AI automation engineers score below equivalent non-senior roles", () => {
  const regularScore = computeMatchScore(
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  const seniorScore = computeMatchScore(
    job("Senior AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  assert.ok(
    seniorScore < regularScore,
    `Senior score ${seniorScore} should be lower than regular score ${regularScore}`,
  );

  assert.ok(
    regularScore - seniorScore >= 20,
    "Senior title should receive a meaningful ranking penalty",
  );
});

test("leadership roles are penalised even when Lead appears at the end of the title", () => {
  const regularScore = computeMatchScore(
    job("AI Integration Engineer", {
      description: relevantDescription,
    }),
  );

  const leadScore = computeMatchScore(
    job("AI Integration Lead", {
      description: relevantDescription,
    }),
  );

  assert.ok(
    leadScore < regularScore,
    `Lead score ${leadScore} should be lower than regular score ${regularScore}`,
  );

  assert.ok(
    regularScore - leadScore >= 25,
    "Leadership title should receive a meaningful ranking penalty",
  );
});

test("principal AI engineering positions receive a stronger penalty than ordinary engineering roles", () => {
  const regularScore = computeMatchScore(
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  const principalScore = computeMatchScore(
    job("Principal AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  assert.ok(
    principalScore < regularScore,
    `Principal score ${principalScore} should be lower than regular score ${regularScore}`,
  );

  assert.ok(
    regularScore - principalScore >= 30,
    "Principal title should receive a substantial ranking penalty",
  );
});

test("roles requiring seven or more years of experience are penalised", () => {
  const ordinaryScore = computeMatchScore(
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  const experiencedScore = computeMatchScore(
    job("AI Automation Engineer", {
      description: `
        ${relevantDescription}

        Applicants must have 7+ years of relevant experience.
      `,
    }),
  );

  assert.ok(
    experiencedScore < ordinaryScore,
    `Experience-heavy role score ${experiencedScore} should be lower than ${ordinaryScore}`,
  );

  assert.ok(
    ordinaryScore - experiencedScore >= 15,
    "Seven or more years of required experience should receive a substantial penalty",
  );
});

// --------------------------------------------------
// CV SELECTION AND SCORE VALIDATION
// --------------------------------------------------

test("AI automation jobs select the default AI automation CV", () => {
  const result = pickCvVersion(
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  );

  assert.equal(result.cvKey, "ai_automation");
  assert.equal(result.needsReview, false);
});

test("match scores always remain between 0 and 100", () => {
  const jobs = [
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
    job("AI Specialist", {
      description: "Maintains n8n workflows and webhooks.",
    }),
    job("Frontend Developer", {
      description: "Builds websites using React and CSS.",
    }),
    job("People Operations Intern", {
      description: "Supports recruitment and employee onboarding.",
    }),
  ];

  for (const item of jobs) {
    const score = computeMatchScore(item);

    assert.ok(
      score >= 0 && score <= 100,
      `Invalid score ${score} for ${item.title}`,
    );
  }
});

// --------------------------------------------------
// SCORE ALL TESTS
// --------------------------------------------------

test("scoreAll filters jobs below the requested minimum score", () => {
  const jobs = [
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
    job("Frontend Developer", {
      description: "Build websites using React and CSS.",
    }),
  ];

  const result = scoreAll(jobs, MINIMUM);

  assert.ok(result.length >= 1);
  assert.ok(result.every((item) => item.matchScore >= MINIMUM));
});

test("one company cannot fill the list beyond three jobs", () => {
  const jobs = Array.from({ length: 5 }, (_, index) =>
    job("AI Automation Engineer", {
      company: "Example Company",
      link: `https://example.com/jobs/${index}`,
      description: relevantDescription,
    }),
  );

  const result = scoreAll(jobs, MINIMUM);

  assert.equal(result.length, 3);
  assert.ok(
    result.every((item) => item.company === "Example Company"),
  );
});

test("results are sorted by match score from highest to lowest", () => {
  const jobs = [
    job("AI Specialist", {
      description:
        "This AI specialist maintains n8n workflows and webhooks.",
    }),
    job("AI Automation Engineer", {
      description: relevantDescription,
    }),
  ];

  // Test sorting independently of the production threshold.
  const result = scoreAll(jobs, 0);
  const scores = result.map((item) => item.matchScore);

  assert.equal(result.length, 2);

  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => b - a),
  );
});
