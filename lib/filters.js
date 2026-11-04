
import { loadJson } from "./loadJson.js";

const countriesConfig = loadJson(
    import.meta.url,
    "../config/countries.json",
);

const CANDIDATE_COUNTRY = String(
    countriesConfig.candidate_location_country || "Nigeria",
).trim().toLowerCase();

// --------------------------------------------------
// COUNTRY ALIASES
// --------------------------------------------------

const COUNTRY_ALIASES = {
    uk: "united kingdom",
    "u.k.": "united kingdom",
    britain: "united kingdom",
    "great britain": "united kingdom",
    england: "united kingdom",
    scotland: "united kingdom",
    wales: "united kingdom",
    "northern ireland": "united kingdom",

    us: "united states",
    "u.s.": "united states",
    usa: "united states",
    "u.s.a.": "united states",
    "united states of america": "united states",

    uae: "united arab emirates",
    "u.a.e.": "united arab emirates",
    dubai: "united arab emirates",
    "abu dhabi": "united arab emirates",

    holland: "netherlands",
    korea: "south korea",
    "czech republic": "czechia",
    "ivory coast": "côte d'ivoire",
    turkey: "türkiye",
    macedonia: "north macedonia",
};

// --------------------------------------------------
// COUNTRY RECOGNITION
// --------------------------------------------------

function normalizeCountryName(country) {
    const value = String(country || "").trim().toLowerCase();

    return COUNTRY_ALIASES[value] || value;
}

const COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET
FI FJ FK FM FO FR GA GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS YE YT
ZA ZM ZW
`.trim().split(/\s+/);

const displayNames = new Intl.DisplayNames(["en"], {
    type: "region",
});

const COUNTRY_NAMES = COUNTRY_CODES
    .map((code) => displayNames.of(code))
    .filter((name, index) => name && name !== COUNTRY_CODES[index])
    .sort((a, b) => b.length - a.length);

const ALL_COUNTRY_TERMS = [
    ...new Set([
        ...Object.keys(COUNTRY_ALIASES),
        ...COUNTRY_NAMES.map((country) => country.toLowerCase()),
    ]),
].sort((a, b) => b.length - a.length);

// --------------------------------------------------
// REGION DEFINITIONS
// --------------------------------------------------

const REMOTE_SIGNALS = [
    "remote",
    "worldwide",
    "anywhere",
    "global",
    "distributed",
];

const OPEN_REGIONS = [
    "worldwide",
    "global",
    "anywhere",
    "work from anywhere",
    "distributed",
    "africa",
    "africa-wide",
    "sub-saharan africa",
    "emea",
    "europe middle east and africa",
];

const CLOSED_REGIONS = [
    "amer",
    "americas",
    "north america",
    "south america",
    "latam",
    "latin america",
    "apac",
    "asia",
    "asia pacific",
    "asia-pacific",
    "apj",
    "europe",
    "european union",
    "eu",
];

const REMOTE_TEXT =
    /\b(fully remote|100% remote|remote[- ]first|remote[- ]friendly|work from anywhere|work remotely|remote position|remote role|this is a remote)\b/i;

const REMOTE_ONLY_SOURCES = [
    "remotive",
    "weworkremotely",
    "himalayas",
    "remoteok",
];

const REQUIRE_REMOTE = process.env.REQUIRE_REMOTE === "true";

// --------------------------------------------------
// URL TRACKING PARAMETERS
// --------------------------------------------------

const TRACKING_PARAMS = new Set([
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "gh_src",
    "ref",
    "source",
]);

// --------------------------------------------------
// TEXT MATCHING UTILITIES
// --------------------------------------------------

const TERM_REGEX_CACHE = new Map();

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesTerm(text, term) {
    const value = String(text || "");
    const normalizedTerm = String(term || "");

    if (!value || !normalizedTerm) return false;

    let regex = TERM_REGEX_CACHE.get(normalizedTerm);

    if (!regex) {
        const escaped = escapeRegExp(normalizedTerm);

        regex = new RegExp(
            `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
            "iu",
        );

        TERM_REGEX_CACHE.set(normalizedTerm, regex);
    }

    return regex.test(value);
}

function findMatchingTerm(text, terms) {
    return terms.find((term) => matchesTerm(text, term)) || null;
}

// --------------------------------------------------
// COUNTRY EXTRACTION
// --------------------------------------------------

function extractNamedCountries(location) {
    const loc = String(location || "");
    const countries = new Set();
    const matchedTerms = [];

    for (const term of ALL_COUNTRY_TERMS) {
        if (!matchesTerm(loc, term)) continue;

        // Avoid identifying a shorter country name inside
        // a longer country name already recognised.
        const alreadyCovered = matchedTerms.some((matched) =>
            matchesTerm(matched, term),
        );

        if (alreadyCovered) continue;

        matchedTerms.push(term);
        countries.add(normalizeCountryName(term));
    }

    return [...countries];
}

// --------------------------------------------------
// REGION DETECTION
// --------------------------------------------------

function findMatchingOpenRegion(location) {
    let text = String(location || "");

    // South Africa is a country, not the wider Africa region.
    text = text.replace(/\bsouth\s+africa\b/giu, " ");

    return findMatchingTerm(text, OPEN_REGIONS);
}

function findMatchingClosedRegion(location) {
    return findMatchingTerm(location, CLOSED_REGIONS);
}

function hasRemoteSignal(location) {
    return Boolean(findMatchingTerm(location, REMOTE_SIGNALS));
}

// --------------------------------------------------
// LOCATION ELIGIBILITY
// --------------------------------------------------

export function isLocationEligible(location) {
    const loc = String(location || "").trim();

    if (!loc) {
        return {
            ok: true,
            status: "missing_location",
            reason: `Location not specified; verify hiring eligibility for ${CANDIDATE_COUNTRY}`,
        };
    }

    const namedCountries = extractNamedCountries(loc);

    // Strongest location signal: candidate country is explicitly listed.
    if (namedCountries.includes(CANDIDATE_COUNTRY)) {
        return {
            ok: true,
            status: "candidate_country_listed",
            reason: `Candidate country '${CANDIDATE_COUNTRY}' is explicitly listed`,
        };
    }

    // Open hiring regions may include Nigerian applicants.
    const openRegion = findMatchingOpenRegion(loc);

    if (openRegion) {
        return {
            ok: true,
            status: "open_region",
            reason: `Open hiring region '${openRegion}' may include candidates in ${CANDIDATE_COUNTRY}`,
        };
    }

    // Reject explicitly closed regions.
    const restrictedRegion = findMatchingClosedRegion(loc);

    if (restrictedRegion) {
        return {
            ok: false,
            status: "restricted_region",
            reason: `Region '${restrictedRegion}' does not include ${CANDIDATE_COUNTRY} under the current location policy`,
        };
    }

    // Other country-specific listings remain available for review.
    if (namedCountries.length > 0) {
        return {
            ok: true,
            status: "country_specific_unverified",
            reason: `Listing names ${namedCountries.join(", ")} but does not confirm hiring from ${CANDIDATE_COUNTRY}`,
        };
    }

    // Generic remote opportunities are accepted provisionally.
    if (hasRemoteSignal(loc)) {
        return {
            ok: true,
            status: "remote_unverified",
            reason: `Remote location without confirmed country eligibility for ${CANDIDATE_COUNTRY}`,
        };
    }

    return {
        ok: false,
        status: "unknown_location",
        reason: `Location '${loc}' does not identify an eligible country or recognised open hiring region`,
    };
}

// --------------------------------------------------
// EXPLICIT GEOGRAPHIC RESTRICTIONS
// --------------------------------------------------

const DESTINATION_TERMS = [
    ...new Set([
        ...CLOSED_REGIONS,
        ...OPEN_REGIONS,
        ...ALL_COUNTRY_TERMS,
    ]),
].sort((a, b) => b.length - a.length);

const DESTINATION_PATTERN = DESTINATION_TERMS
    .map(escapeRegExp)
    .join("|");

const EXPLICIT_RESTRICTION_PATTERNS = [
    // Examples: LATAM only, US only, Europe-only.
    new RegExp(
        `\\b(${DESTINATION_PATTERN})(?:\\s+|[-\\u2013\\u2014:]\\s*)only\\b`,
        "iu",
    ),

    // Examples: only LATAM, restricted to the US.
    new RegExp(
        `\\b(?:only|restricted to|limited to|exclusive to)\\s+(?:the\\s+)?(${DESTINATION_PATTERN})\\b`,
        "iu",
    ),

    // Examples: applicants must be based in the United States.
    new RegExp(
        `\\b(?:applicants?|candidates?|residents?|employees?|contractors?)\\s+(?:must|need to|have to)\\s+(?:be\\s+)?(?:based|located|living|residing|resident)\\s+in\\s+(?:the\\s+)?(${DESTINATION_PATTERN})\\b`,
        "iu",
    ),

    // Examples: must be located in Europe.
    new RegExp(
        `\\b(?:must|need to|have to)\\s+(?:be\\s+)?(?:based|located|living|residing|resident)\\s+in\\s+(?:the\\s+)?(${DESTINATION_PATTERN})\\b`,
        "iu",
    ),

    // Examples: applicants only in the United States.
    new RegExp(
        `\\b(?:applicants?|candidates?|employees?|contractors?)\\s+only\\s+(?:from|in|within)\\s+(?:the\\s+)?(${DESTINATION_PATTERN})\\b`,
        "iu",
    ),
];

function assessExplicitDestination(destination) {
    const term = String(destination || "").toLowerCase();
    const canonical = normalizeCountryName(term);

    // Candidate-country restrictions are compatible.
    if (canonical === CANDIDATE_COUNTRY) {
        return {
            blocked: false,
            reason: `Explicit geographic restriction includes candidate country '${CANDIDATE_COUNTRY}'`,
        };
    }

    // Open regions are retained for employer verification.
    if (
        OPEN_REGIONS.some((region) => region.toLowerCase() === term)
    ) {
        return {
            blocked: false,
            reason: `Open region '${term}' may include ${CANDIDATE_COUNTRY}; verify employer eligibility`,
        };
    }

    // Other explicit country or closed-region restrictions exclude Nigeria.
    return {
        blocked: true,
        reason: `Explicit geographic restriction to '${term}' does not include ${CANDIDATE_COUNTRY}`,
    };
}

function findExplicitLocationRestrictions(job) {
    const fields = [
        String(job.title || ""),
        String(job.location || ""),
        String(job.description || "").slice(0, 8000),
    ];

    const findings = new Map();

    for (const text of fields) {
        if (!text) continue;

        for (const pattern of EXPLICIT_RESTRICTION_PATTERNS) {
            const match = pattern.exec(text);

            if (!match) continue;

            const destination = String(match[1] || "").toLowerCase();

            if (!findings.has(destination)) {
                findings.set(destination, {
                    destination,
                    ...assessExplicitDestination(destination),
                });
            }
        }
    }

    return [...findings.values()];
}

// --------------------------------------------------
// WORK AUTHORISATION REVIEW
// --------------------------------------------------

const WORK_AUTHORIZATION_REVIEW_PATTERN =
    /\b(?:authori[sz]ed|eligible)\s+to\s+work\b|\bwork authori[sz]ation\b|\bvisa sponsorship\b|\bwork permit sponsorship\b|\bmust have (?:a )?(?:valid )?(?:work permit|visa)\b|\b(?:citizenship|citizen)\s+(?:is\s+)?required\b/i;

function hasWorkAuthorizationSignal(job) {
    const description = String(job.description || "").slice(0, 8000);
    const title = String(job.title || "");

    return (
        WORK_AUTHORIZATION_REVIEW_PATTERN.test(title) ||
        WORK_AUTHORIZATION_REVIEW_PATTERN.test(description)
    );
}

// --------------------------------------------------
// REMOTE JOB DETECTION
// --------------------------------------------------

export function isRemoteJob(job) {
    if (
        REMOTE_ONLY_SOURCES.includes(
            String(job.source || "").toLowerCase(),
        )
    ) {
        return true;
    }

    const location = String(job.location || "");
    const title = String(job.title || "");

    if (hasRemoteSignal(location) || hasRemoteSignal(title)) {
        return true;
    }

    return REMOTE_TEXT.test(
        String(job.description || "").slice(0, 4000),
    );
}

// --------------------------------------------------
// LOCATION RESTRICTION FLAG
// --------------------------------------------------

export function isLocationRestricted(location) {
    const loc = String(location || "").trim();

    if (!loc) return false;

    const namedCountries = extractNamedCountries(loc);

    // Candidate country explicitly listed: not restricted away from Nigeria.
    if (namedCountries.includes(CANDIDATE_COUNTRY)) {
        return false;
    }

    // Other named countries require verification.
    if (namedCountries.length > 0) {
        return true;
    }

    if (findMatchingClosedRegion(loc)) {
        return true;
    }

    // Generic remote and open-region listings are not explicitly restricted.
    if (findMatchingOpenRegion(loc) || hasRemoteSignal(loc)) {
        return false;
    }

    return false;
}

// --------------------------------------------------
// MAIN JOB FILTER
// --------------------------------------------------

export function filterJobs(jobs) {
    const passed = [];

    for (const job of jobs || []) {
        if (REQUIRE_REMOTE && !isRemoteJob(job)) {
            continue;
        }

        const location = String(job.location || "");

        const decision = isLocationEligible(location);

        if (!decision.ok) {
            continue;
        }

        // Inspect restrictions in the title, location and description.
        const explicitRestrictions =
            findExplicitLocationRestrictions(job);

        const blockedRestriction = explicitRestrictions.find(
            (restriction) => restriction.blocked,
        );

        if (blockedRestriction) {
            continue;
        }

        const workAuthorizationReview =
            hasWorkAuthorizationSignal(job);

        const candidateCountryListed =
            decision.status === "candidate_country_listed";

        const locationRestricted =
            isLocationRestricted(location);

        const nonBlockingExplicitRestriction =
            explicitRestrictions.some(
                (restriction) => !restriction.blocked,
            );

        const locationReviewRequired =
            !candidateCountryListed ||
            nonBlockingExplicitRestriction ||
            workAuthorizationReview;

        const explicitReasons = explicitRestrictions
            .map((restriction) => restriction.reason)
            .join("; ");

        let eligibilityReason = decision.reason;

        if (explicitReasons) {
            eligibilityReason += `; ${explicitReasons}`;
        }

        if (workAuthorizationReview) {
            eligibilityReason +=
                "; work authorisation or visa wording requires manual verification";
        }

        passed.push({
            ...job,
            candidateCountry: CANDIDATE_COUNTRY,
            locationEligibilityStatus: decision.status,
            eligibilityReason,
            locationRestricted,
            locationReviewRequired,
            workAuthorizationReviewRequired: workAuthorizationReview,
        });
    }

    return passed;
}

// --------------------------------------------------
// URL NORMALIZATION
// --------------------------------------------------

function normalizeJobLink(link) {
    const value = String(link || "").trim();

    if (!value) return "";

    try {
        const url = new URL(value);

        url.hash = "";

        for (const key of [...url.searchParams.keys()]) {
            const normalizedKey = key.toLowerCase();

            if (
                normalizedKey.startsWith("utm_") ||
                TRACKING_PARAMS.has(normalizedKey)
            ) {
                url.searchParams.delete(key);
            }
        }

        url.searchParams.sort();

        const normalized = url.toString();

        return normalized.endsWith("/")
            ? normalized.slice(0, -1)
            : normalized;
    } catch {
        // Preserve custom identifiers and non-URL test fixtures.
        return value;
    }
}

// --------------------------------------------------
// CROSS-SOURCE JOB IDENTITY NORMALIZATION
// --------------------------------------------------

function normalizeIdentityText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeCompanyName(company) {
    let value = normalizeIdentityText(company);

    // Remove common legal suffixes.
    const suffixes = [
        "private limited",
        "public limited",
        "pvt ltd",
        "pty ltd",
        "limited",
        "incorporated",
        "corporation",
        "company",
        "gmbh",
        "llc",
        "plc",
        "corp",
        "ltd",
        "inc",
        "pty",
        "co",
    ];

    let changed = true;

    while (changed && value) {
        changed = false;

        for (const suffix of suffixes) {
            if (value.endsWith(` ${suffix}`)) {
                value = value
                    .slice(0, -(suffix.length + 1))
                    .trim();

                changed = true;
                break;
            }
        }
    }

    return value;
}

function normalizeJobTitle(title) {
    return normalizeIdentityText(title)
        // A trailing work arrangement is not part of the role identity.
        .replace(/\b(remote|hybrid|onsite|on site|work from home)\s*$/, "")
        .trim();
}

function normalizeEmploymentType(value) {
    const normalized = normalizeIdentityText(value);

    if (!normalized) return "unspecified";

    if (/\b(intern|internship)\b/.test(normalized)) {
        return "intern";
    }

    if (
        /\b(contract|contractor|freelance)\b/.test(normalized)
    ) {
        return "contract";
    }

    if (
        /\bfull\s*time\b/.test(normalized) ||
        normalized === "fulltime"
    ) {
        return "full-time";
    }

    if (
        /\bpart\s*time\b/.test(normalized) ||
        normalized === "parttime"
    ) {
        return "part-time";
    }

    if (/\btemporary\b/.test(normalized)) {
        return "temporary";
    }

    return normalized;
}

function normalizeJobLocation(location) {
    const value = String(location || "").trim();

    if (!value) return "";

    // Country order and remote labels should not affect identity.
    const countries = extractNamedCountries(value)
        .map(normalizeCountryName)
        .sort();

    if (countries.length > 0) {
        return `countries:${countries.join("|")}`;
    }

    const openRegion = findMatchingOpenRegion(value);

    if (openRegion) {
        return `open-region:${normalizeIdentityText(openRegion)}`;
    }

    const closedRegion = findMatchingClosedRegion(value);

    if (closedRegion) {
        return `closed-region:${normalizeIdentityText(closedRegion)}`;
    }

    if (hasRemoteSignal(value)) {
        return "remote-unspecified";
    }

    return normalizeIdentityText(value);
}

// Build a conservative identity from the fields shared by job sources.
function getJobIdentity(job) {
    const company = normalizeCompanyName(job.company);
    const title = normalizeJobTitle(job.title);
    const location = normalizeJobLocation(job.location);

    // Incomplete records are checked by URL only.
    if (!company || !title || !location) {
        return null;
    }

    return {
        key: [company, title, location].join("::"),
        employmentType: normalizeEmploymentType(job.employmentType),
    };
}

// Only identical normalized employment types are compatible.
// "Intern" and "Internship" both normalize to "intern".
// "Full Time" and an unspecified type remain separate.
function employmentTypesAreCompatible(first, second) {
    return first === second;
}

// --------------------------------------------------
// DEDUPLICATION
// --------------------------------------------------

export function deduplicate(jobs, existingLinks = new Set()) {
    const existing = (
        existingLinks instanceof Set || Array.isArray(existingLinks)
    )
        ? [...existingLinks]
        : [];

    const seenLinks = new Set(
        existing.map(normalizeJobLink).filter(Boolean),
    );

    const seenIdentities = new Map();

    const uniqueJobs = [];

    for (const job of jobs || []) {
        const link = normalizeJobLink(job.link);

        if (!link || seenLinks.has(link)) {
            continue;
        }

        const identity = getJobIdentity(job);

        if (identity) {
            const existingTypes =
                seenIdentities.get(identity.key) || [];

            const duplicateIdentity = existingTypes.some(
                (existingType) =>
                    employmentTypesAreCompatible(
                        existingType,
                        identity.employmentType,
                    ),
            );

            if (duplicateIdentity) {
                continue;
            }

            existingTypes.push(identity.employmentType);

            seenIdentities.set(
                identity.key,
                existingTypes,
            );
        }

        seenLinks.add(link);
        uniqueJobs.push(job);
    }

    return uniqueJobs;
}
