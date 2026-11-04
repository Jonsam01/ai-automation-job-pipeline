
function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
}

function isExplicitlyFalse(value) {
    if (value === false || value === 0) return true;

    return ["false", "no", "0"].includes(normalizeText(value));
}

function isExplicitlyTrue(value) {
    if (value === true || value === 1) return true;

    return ["true", "yes", "1"].includes(normalizeText(value));
}

// Missing or unrecognised values are unresolved.
// Only an explicit false clears a review requirement.
function reviewFlagIsUnresolved(value) {
    return !isExplicitlyFalse(value);
}

// --------------------------------------------------
// NEW JOB REVIEW
// --------------------------------------------------

export function getNewJobReviewReasons(
    job = {},
    candidateCountry = "Nigeria",
) {
    const reasons = [];
    const expectedCountry = normalizeText(candidateCountry);

    if (
        normalizeText(job.candidateCountry) !== expectedCountry
    ) {
        reasons.push(
            `Candidate country is missing or does not match ${expectedCountry}`,
        );
    }

    if (!String(job.locationEligibilityStatus || "").trim()) {
        reasons.push("Location eligibility status is missing");
    }

    if (reviewFlagIsUnresolved(job.locationReviewRequired)) {
        reasons.push("Location eligibility requires review");
    }

    if (isExplicitlyTrue(job.locationRestricted)) {
        reasons.push("Location is explicitly restricted");
    }

    if (
        reviewFlagIsUnresolved(
            job.workAuthorizationReviewRequired,
        )
    ) {
        reasons.push("Work authorisation requires review");
    }

    const cvReviewValue =
        job.cvSelectionReviewRequired ?? job.needsManualReview;

    if (
        job.needsManualReview === true ||
        reviewFlagIsUnresolved(cvReviewValue)
    ) {
        reasons.push("CV selection requires review");
    }

    return reasons;
}

// --------------------------------------------------
// EXISTING SHEET ROW REVIEW
// --------------------------------------------------

export function getExistingRowReviewReasons(
    row = {},
    candidateCountry = "Nigeria",
) {
    const reasons = [];
    const expectedCountry = normalizeText(candidateCountry);

    if (
        normalizeText(row["Candidate Country"]) !== expectedCountry
    ) {
        reasons.push(
            `Candidate country is missing or does not match ${expectedCountry}`,
        );
    }

    if (!String(row["Location Eligibility Status"] || "").trim()) {
        reasons.push("Location eligibility status is missing");
    }

    if (
        reviewFlagIsUnresolved(row["Location Review Required"])
    ) {
        reasons.push("Location eligibility requires review");
    }

    if (isExplicitlyTrue(row["Location Restricted"])) {
        reasons.push("Location is explicitly restricted");
    }

    if (
        reviewFlagIsUnresolved(
            row["Work Authorisation Review Required"],
        )
    ) {
        reasons.push("Work authorisation requires review");
    }

    if (
        reviewFlagIsUnresolved(
            row["CV Selection Review Required"],
        )
    ) {
        reasons.push("CV selection requires review");
    }

    return reasons;
}

// --------------------------------------------------
// AUTOMATIC APPROVAL
// --------------------------------------------------

export function canAutomaticallyApproveNewJob(
    job = {},
    {
        candidateCountry = "Nigeria",
        autoApproveMinScore = 80,
        hasApplicationEmail = false,
        enableOutboundEmails = false,
        autoSendEmails = false,
    } = {},
) {
    const score = Number(job.matchScore);

    if (!Number.isFinite(score) || score < autoApproveMinScore) {
        return false;
    }

    if (
        !enableOutboundEmails ||
        !autoSendEmails ||
        !hasApplicationEmail
    ) {
        return false;
    }

    const reviewReasons = getNewJobReviewReasons(
        job,
        candidateCountry,
    );

    return reviewReasons.length === 0;
}

// --------------------------------------------------
// OUTBOUND EMAIL GATES
// --------------------------------------------------

export function shouldDispatchApplicationEmails({
    enableOutboundEmails = false,
    autoSendEmails = false,
} = {}) {
    return (
        enableOutboundEmails === true &&
        autoSendEmails === true
    );
}

export function shouldSendOutboundEmails({
    enableOutboundEmails = false,
} = {}) {
    return enableOutboundEmails === true;
}
