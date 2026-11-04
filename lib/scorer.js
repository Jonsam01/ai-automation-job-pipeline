
import { loadJson } from "./loadJson.js";

const cvMapping = loadJson(import.meta.url, "../config/cvMapping.json");

const CV_CATEGORIES = Object.fromEntries(
  Object.entries(cvMapping).filter(
    ([key]) => !key.startsWith("_") && key !== "notes",
  ),
);

const DEFAULT_CV_KEY =
  Object.entries(CV_CATEGORIES).find(([, value]) => value.isDefault)?.[0] ||
  Object.keys(CV_CATEGORIES)[0];

// --------------------------------------------------
// TITLE CLASSIFICATION
// --------------------------------------------------

const EARLY_CAREER_TITLE_TERMS = [
  "junior",
  "jr",
  "intern",
  "internship",
  "trainee",
  "apprentice",
  "apprenticeship",
  "graduate",
  "entry level",
  "entry-level",
  "early career",
  "new grad",
  "associate",
];

const DIRECT_TITLE_TERMS = [
  "ai automation",
  "automation engineer",
  "automation developer",
  "automation specialist",
  "automation consultant",
  "automation analyst",
  "automation architect",
  "workflow automation",
  "workflow engineer",
  "workflow developer",
  "workflow specialist",
  "workflow architect",
  "n8n",
  "zapier",
  "make.com",
  "pipedream",
  "workato",
  "power automate",
  "rpa engineer",
  "rpa developer",
  "intelligent automation",
  "business process automation",
  "process automation",
  "crm automation",
  "marketing automation",
  "growth automation",
  "automation and integration",
  "integration and automation",
  "ai integration",
  "integration engineer",
  "integration developer",
  "integration specialist",
  "integration consultant",
  "api integration",
  "api engineer",
  "api developer",
  "ai implementation",
  "ai solutions engineer",
  "ai workflow",
  "ai agent developer",
];

const ADJACENT_TITLE_TERMS = [
  "ai engineering",
  "artificial intelligence engineering",
  "ai engineer",
  "ai developer",
  "ai specialist",
  "ai expert",
  "ai scientist",
  "ai researcher",
  "ai intern",
  "llm engineer",
  "llm developer",
  "llm specialist",
  "agentic ai",
  "ai agent",
  "generative ai",
  "genai",
  "conversational ai",
  "voice ai",
  "machine learning engineer",
];

const TARGET_TITLE_SIGNAL_TERMS = [
  "artificial intelligence",
  "ai",
  "automation",
  "workflow",
  "integration",
  "integrations",
  "n8n",
  "rpa",
  "api",
  "llm",
  "agent",
  "agentic",
  "generative ai",
  "conversational ai",
  "voice ai",
];

const TECHNICAL_ROLE_TERMS = [
  "engineer",
  "developer",
  "programmer",
  "scientist",
  "researcher",
  "specialist",
  "consultant",
  "analyst",
  "architect",
  "technologist",
  "intern",
  "trainee",
  "apprentice",
  "technical",
  "implementer",
  "implementation",
  "expert",
];

// Seniority categories are handled separately so that
// a Lead or Manager title is not missed merely because
// the word appears at the end of the title.
const SENIOR_SOFT_TERMS = [
  "senior",
  "sr",
];

const SENIOR_HARD_TERMS = [
  "staff",
  "principal",
  "director",
  "head of",
  "vice president",
  "vp",
  "chief",
];

// --------------------------------------------------
// JOBS THAT ARE NOT TARGET OPPORTUNITIES
// --------------------------------------------------

const NON_TARGET_TITLE_TERMS = [
  "account executive",
  "sales representative",
  "sales development representative",
  "business development representative",
  "business development manager",
  "recruiter",
  "talent acquisition",
  "recruitment",
  "human resources",
  "people operations",
  "hr intern",
  "graphic designer",
  "product designer",
  "content writer",
  "copywriter",
  "social media manager",
  "accountant",
  "financial analyst",
  "attorney",
  "legal counsel",
  "data entry clerk",
  "executive assistant",
  "customer service representative",
  "customer success manager",
  "community manager",
  "marketing manager",
  "teacher",
  "teaching",
  "instructor",
  "educator",
  "coach",
  "mentor",
  "tutor",
  "professor",
  "curriculum developer",
  "learning facilitator",
];

const UNRELATED_SPECIALTY_TITLE_TERMS = [
  "frontend developer",
  "front-end developer",
  "front end developer",
  "react developer",
  "react native developer",
  "ios developer",
  "android developer",
  "wordpress developer",
  "shopify developer",
  "game developer",
  "network engineer",
  "security engineer",
  "devops engineer",
  "site reliability engineer",
  "qa engineer",
  "quality assurance engineer",
  "test engineer",
  "embedded engineer",
  "firmware engineer",
  "data scientist",
  "machine learning researcher",
];

// --------------------------------------------------
// SKILL GROUPS
// --------------------------------------------------

const SKILL_GROUPS = [
  {
    name: "AI and LLM development",
    terms: [
      "generative ai",
      "genai",
      "large language model",
      "llm",
      "agentic ai",
      "ai agent",
      "ai agents",
      "function calling",
      "tool calling",
      "structured output",
      "structured outputs",
      "prompt engineering",
      "retrieval augmented generation",
      "rag",
      "langchain",
      "langgraph",
      "openai api",
      "openai",
      "anthropic",
      "claude",
      "groq",
      "vector database",
      "embeddings",
      "model inference",
      "fine tuning",
      "fine-tuning",
    ],
    basePoints: 5,
    extraPoints: 1,
    maxPoints: 10,
  },
  {
    name: "Automation platforms and workflows",
    terms: [
      "n8n",
      "zapier",
      "make.com",
      "pipedream",
      "workato",
      "power automate",
      "activepieces",
      "workflow automation",
      "business process automation",
      "process automation",
      "intelligent automation",
      "workflow orchestration",
      "automated workflow",
      "automated workflows",
      "automating workflows",
      "automation platform",
      "automation",
      "automate workflows",
      "workflow builder",
      "workflow engine",
    ],
    basePoints: 6,
    extraPoints: 2,
    maxPoints: 12,
  },
  {
    name: "APIs and integrations",
    terms: [
      "rest api",
      "restful api",
      "api integration",
      "api integrations",
      "webhook",
      "webhooks",
      "third-party integration",
      "system integration",
      "systems integration",
      "oauth",
      "graphql",
      "api",
    ],
    basePoints: 4,
    extraPoints: 2,
    maxPoints: 8,
  },
  {
    name: "Programming and development",
    terms: [
      "python",
      "javascript",
      "typescript",
      "node.js",
      "sql",
      "fastapi",
      "pydantic",
      "asyncio",
      "docker",
    ],
    basePoints: 3,
    extraPoints: 1,
    maxPoints: 6,
  },
  {
    name: "Business systems and applications",
    terms: [
      "crm integration",
      "hubspot",
      "salesforce",
      "google sheets",
      "airtable",
      "lead routing",
      "ticket classification",
      "document processing",
      "business systems",
      "crm",
      "google workspace",
    ],
    basePoints: 3,
    extraPoints: 1,
    maxPoints: 6,
  },
  {
    name: "Reliability and workflow quality",
    terms: [
      "idempotency",
      "deduplication",
      "error handling",
      "retry",
      "retries",
      "backoff",
      "audit log",
      "audit trail",
      "human-in-the-loop",
      "human approval",
      "monitoring",
      "logging",
      "observability",
      "input validation",
      "failure alert",
      "dead-letter",
    ],
    basePoints: 3,
    extraPoints: 1,
    maxPoints: 6,
  },
];

const CORE_EVIDENCE_TERMS = [
  "n8n",
  "workflow automation",
  "business process automation",
  "process automation",
  "zapier",
  "make.com",
  "pipedream",
  "workato",
  "power automate",
  "activepieces",
  "workflow orchestration",
  "automate workflows",
  "automating workflows",
  "automated workflow",
  "rest api",
  "api integration",
  "webhook",
  "webhooks",
  "openai api",
  "large language model",
  "llm",
  "ai agent",
  "agentic ai",
  "function calling",
  "tool calling",
  "langchain",
  "langgraph",
  "rag",
  "retrieval augmented generation",
  "crm integration",
  "hubspot",
  "salesforce",
  "lead routing",
  "ticket classification",
  "document processing",
];

// --------------------------------------------------
// TEXT MATCHING UTILITIES
// --------------------------------------------------

const regexCache = new Map();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTerm(text, term) {
  if (!text || !term) return false;

  const normalizedTerm = String(term).toLowerCase();

  let regex = regexCache.get(normalizedTerm);

  if (!regex) {
    const escaped = escapeRegExp(normalizedTerm);

    regex = new RegExp(
      `(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,
      "i",
    );

    regexCache.set(normalizedTerm, regex);
  }

  return regex.test(String(text));
}

function hasAny(text, terms) {
  return terms.some((term) => hasTerm(text, term));
}

function countMatches(text, terms) {
  return terms.filter((term) => hasTerm(text, term)).length;
}

function textBlob(job) {
  return `${job.title || ""} ${job.description || ""}`.toLowerCase();
}

// --------------------------------------------------
// CV SELECTION
// --------------------------------------------------

export function pickCvVersion(job) {
  const blob = textBlob(job);
  const title = (job.title || "").toLowerCase();

  let pass1Key = null;

  for (const [key, rules] of Object.entries(CV_CATEGORIES)) {
    if (
      (rules.titleKeywords || []).some((keyword) =>
        hasTerm(title, keyword.toLowerCase()),
      )
    ) {
      pass1Key = key;
      break;
    }
  }

  const scores = {};

  for (const [key, rules] of Object.entries(CV_CATEGORIES)) {
    scores[key] = (rules.skillKeywords || []).filter((keyword) =>
      hasTerm(blob, keyword.toLowerCase()),
    ).length;
  }

  const maxScore = Math.max(...Object.values(scores));

  const topKeys =
    maxScore > 0
      ? Object.keys(scores).filter((key) => scores[key] === maxScore)
      : [];

  const pass2Key = topKeys.length
    ? topKeys.includes(DEFAULT_CV_KEY)
      ? DEFAULT_CV_KEY
      : topKeys[0]
    : null;

  const finalKey = pass1Key || pass2Key || DEFAULT_CV_KEY;
  const needsReview = !pass1Key && topKeys.length > 1;

  return {
    cvKey: finalKey,
    resumeFile: CV_CATEGORIES[finalKey].resumeFile,
    needsReview,
  };
}

// --------------------------------------------------
// TITLE RELEVANCE
// --------------------------------------------------

function getTitleRelevance(title, description) {
  if (hasAny(title, DIRECT_TITLE_TERMS)) {
    return 45;
  }

  if (hasAny(title, ADJACENT_TITLE_TERMS)) {
    return 32;
  }

  const hasTargetSignal = hasAny(title, TARGET_TITLE_SIGNAL_TERMS);
  const hasTechnicalRole = hasAny(title, TECHNICAL_ROLE_TERMS);

  if (hasTargetSignal && hasTechnicalRole) {
    return 26;
  }

  if (
    hasTechnicalRole &&
    hasAny(description, CORE_EVIDENCE_TERMS)
  ) {
    return 20;
  }

  if (hasTargetSignal) {
    return 12;
  }

  return 0;
}

// --------------------------------------------------
// EXPERIENCE AND SENIORITY
// --------------------------------------------------

function getSeniorityPenalty(title, description) {
  let penalty = 0;

  const hasHardSeniorTitle = hasAny(title, SENIOR_HARD_TERMS);
  const hasSeniorTitle = hasAny(title, SENIOR_SOFT_TERMS);
  const hasManagerTitle = hasTerm(title, "manager");

  const hasLeadTitle =
    hasTerm(title, "lead") &&
    !hasTerm(title, "lead generation");

  // Highest-level roles receive the strongest penalty.
  if (hasHardSeniorTitle) {
    penalty += 35;
  } else if (hasManagerTitle) {
    penalty += 28;
  } else if (hasLeadTitle) {
    penalty += 28;
  } else if (hasSeniorTitle) {
    penalty += 22;
  }

  // Architect titles often indicate higher-level responsibility.
  if (hasTerm(title, "architect")) {
    penalty += 18;
  }

  if (hasTerm(title, "expert")) {
    penalty += 8;
  }

  // Penalise stated years of required experience.
  // This is a ranking penalty, not an automatic rejection.

  const requiresSevenOrMoreYears =
    /\b(?:7|8|9|1\d)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:(?:relevant|professional|hands-on)\s+)?experience\b/i.test(
      description,
    );

  const requiresFiveOrMoreYears =
    /\b(?:5|6)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:(?:relevant|professional|hands-on)\s+)?experience\b/i.test(
      description,
    );

  const requiresThreeOrFourYears =
    /\b(?:3|4)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:(?:relevant|professional|hands-on)\s+)?experience\b/i.test(
      description,
    );

  if (requiresSevenOrMoreYears) {
    penalty += 18;
  } else if (requiresFiveOrMoreYears) {
    penalty += 12;
  } else if (requiresThreeOrFourYears) {
    penalty += 5;
  }

  return penalty;
}

// --------------------------------------------------
// JOB EXCLUSION AND SPECIALTY PENALTIES
// --------------------------------------------------

function isExcludedJob(job) {
  const title = (job.title || "").toLowerCase();
  const blob = textBlob(job);

  if (hasAny(title, NON_TARGET_TITLE_TERMS)) {
    return true;
  }

  if (
    hasTerm(blob, "military only") ||
    hasTerm(blob, "skillbridge") ||
    hasTerm(blob, "active duty only") ||
    hasTerm(blob, "veterans only")
  ) {
    return true;
  }

  return false;
}

function getSpecialtyPenalty(title) {
  if (hasAny(title, UNRELATED_SPECIALTY_TITLE_TERMS)) {
    return 12;
  }

  return 0;
}

// --------------------------------------------------
// SKILL SCORING
// --------------------------------------------------

function getSkillScore(description) {
  let score = 0;

  for (const group of SKILL_GROUPS) {
    const hits = countMatches(description, group.terms);

    if (hits === 0) continue;

    const groupScore = Math.min(
      group.maxPoints,
      group.basePoints + (hits - 1) * group.extraPoints,
    );

    score += groupScore;
  }

  return score;
}

// --------------------------------------------------
// MAIN MATCH SCORER
// --------------------------------------------------

export function computeMatchScore(job) {
  const title = (job.title || "").toLowerCase();
  const description = (job.description || "").toLowerCase();

  if (isExcludedJob(job)) {
    return 25;
  }

  let score = 0;

  const titleScore = getTitleRelevance(title, description);
  score += titleScore;

  const skillScore = getSkillScore(description);
  score += skillScore;

  const hasCoreEvidence = hasAny(
    description,
    CORE_EVIDENCE_TERMS,
  );

  if (hasCoreEvidence) {
    score += 4;
  }

  // Small bonus for early-career titles.
  // The role still needs relevant technical evidence.
  if (hasAny(title, EARLY_CAREER_TITLE_TERMS)) {
    score += 3;
  }

  if (job.employmentType) {
    score += 1;
  }

  score -= getSeniorityPenalty(title, description);
  score -= getSpecialtyPenalty(title);

  // Technical evidence is required for a high score.
  if (!hasCoreEvidence) {
    score = Math.min(score, 44);
  }

  if (titleScore === 0) {
    score = Math.min(score, 44);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// --------------------------------------------------
// SCORE AND TAG
// --------------------------------------------------

export function scoreAndTag(job) {
  const { cvKey, resumeFile, needsReview } = pickCvVersion(job);

  return {
    ...job,
    cvVersion: cvKey,
    resumeFile,
    matchScore: computeMatchScore(job),
    needsManualReview: needsReview,
  };
}

// --------------------------------------------------
// SCORE ALL JOBS
// --------------------------------------------------

export function scoreAll(jobs, minimumScore = 55, maxPerCompany = 3) {
  const scored = jobs
    .map(scoreAndTag)
    .filter((job) => job.matchScore >= minimumScore)
    .sort((a, b) => b.matchScore - a.matchScore);

  const perCompany = new Map();

  return scored.filter((job) => {
    const key = (job.company || "unknown").toLowerCase();
    const count = perCompany.get(key) || 0;

    if (count >= maxPerCompany) return false;

    perCompany.set(key, count + 1);
    return true;
  });
}
