
import test from "node:test";
import assert from "node:assert/strict";

import {
    getNewJobReviewReasons,
    getExistingRowReviewReasons,
    canAutomaticallyApproveNewJob,
    shouldDispatchApplicationEmails,
    shouldSendOutboundEmails,
} from "../lib/pipelineRules.js";

function makeVerifiedJob(overrides = {}) {
    return {
        title: "AI Automation Engineer",
        company: "Example Company",
        location: "Nigeria",
        matchScore: 90,
        candidateCountry: "Nigeria",
        locationEligibilityStatus: "candidate_country_listed",
        locationRestricted: false,
        locationReviewRequired: false,
        workAuthorizationReviewRequired: false,
        cvSelectionReviewRequired: false,
        needsManualReview: false,
        ...overrides,
    };
}

function makeVerifiedRow(overrides = {}) {
    return {
        Company: "Example Company",
        "Role Title": "AI Automation Engineer",
        "Candidate Country": "Nigeria",
        "Location Eligibility Status": "candidate_country_listed",
        "Location Restricted": false,
        "Location Review Required": false,
        "Work Authorisation Review Required": false,
        "CV Selection Review Required": false,
        ...overrides,
    };
}

const enabledEmailConfig = {
    enableOutboundEmails: true,
    autoSendEmails: true,
};

// --------------------------------------------------
// NEW JOB REVIEW TESTS
// --------------------------------------------------

test("accepts a new job when every review field is explicitly cleared", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob(),
        "Nigeria",
    );

    assert.deepEqual(reasons, []);
});

test("flags a new job when the candidate country is missing", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({ candidateCountry: "" }),
        "Nigeria",
    );

    assert.ok(
        reasons.some((reason) => reason.includes("Candidate country")),
    );
});

test("flags a new job when location eligibility status is missing", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({ locationEligibilityStatus: "" }),
        "Nigeria",
    );

    assert.ok(
        reasons.includes("Location eligibility status is missing"),
    );
});

test("flags a new job when location review is required", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({ locationReviewRequired: true }),
        "Nigeria",
    );

    assert.ok(
        reasons.includes("Location eligibility requires review"),
    );
});

test("flags a new job when its location is restricted", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({ locationRestricted: true }),
        "Nigeria",
    );

    assert.ok(
        reasons.includes("Location is explicitly restricted"),
    );
});

test("flags a new job when work authorisation requires review", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({
            workAuthorizationReviewRequired: true,
        }),
        "Nigeria",
    );

    assert.ok(
        reasons.includes("Work authorisation requires review"),
    );
});

test("flags a new job when CV selection requires review", () => {
    const reasons = getNewJobReviewReasons(
        makeVerifiedJob({
            cvSelectionReviewRequired: true,
        }),
        "Nigeria",
    );

    assert.ok(
        reasons.includes("CV selection requires review"),
    );
});

// --------------------------------------------------
// EXISTING ROW REVIEW TESTS
// --------------------------------------------------

test("accepts an existing row with all review fields explicitly cleared", () => {
    const reasons = getExistingRowReviewReasons(
        makeVerifiedRow(),
        "Nigeria",
    );

    assert.deepEqual(reasons, []);
});

test("holds a legacy approved row with missing eligibility fields", () => {
    const legacyRow = {
        Company: "Example Company",
        "Role Title": "AI Automation Engineer",
    };

    const reasons = getExistingRowReviewReasons(
        legacyRow,
        "Nigeria",
    );

    assert.ok(reasons.length > 0);
    assert.ok(
        reasons.some((reason) => reason.includes("Candidate country")),
    );
    assert.ok(
        reasons.some((reason) => reason.includes("Location eligibility")),
    );
});

// --------------------------------------------------
// AUTOMATIC APPROVAL TESTS
// --------------------------------------------------

test("allows automatic approval for a strong, verified job with an application email and both switches enabled", () => {
    const result = canAutomaticallyApproveNewJob(
        makeVerifiedJob(),
        {
            candidateCountry: "Nigeria",
            autoApproveMinScore: 80,
            hasApplicationEmail: true,
            ...enabledEmailConfig,
        },
    );

    assert.equal(result, true);
});

test("blocks automatic approval when the match score is below the threshold", () => {
    const result = canAutomaticallyApproveNewJob(
        makeVerifiedJob({ matchScore: 79 }),
        {
            candidateCountry: "Nigeria",
            autoApproveMinScore: 80,
            hasApplicationEmail: true,
            ...enabledEmailConfig,
        },
    );

    assert.equal(result, false);
});

test("blocks automatic approval when any review remains unresolved", () => {
    const result = canAutomaticallyApproveNewJob(
        makeVerifiedJob({
            locationReviewRequired: true,
        }),
        {
            candidateCountry: "Nigeria",
            autoApproveMinScore: 80,
            hasApplicationEmail: true,
            ...enabledEmailConfig,
        },
    );

    assert.equal(result, false);
});

test("blocks automatic approval when no application email is available", () => {
    const result = canAutomaticallyApproveNewJob(
        makeVerifiedJob(),
        {
            candidateCountry: "Nigeria",
            autoApproveMinScore: 80,
            hasApplicationEmail: false,
            ...enabledEmailConfig,
        },
    );

    assert.equal(result, false);
});

// --------------------------------------------------
// EMAIL SWITCH TESTS
// --------------------------------------------------

test("application email dispatch requires both switches to be enabled", () => {
    assert.equal(
        shouldDispatchApplicationEmails({
            enableOutboundEmails: true,
            autoSendEmails: true,
        }),
        true,
    );

    assert.equal(
        shouldDispatchApplicationEmails({
            enableOutboundEmails: false,
            autoSendEmails: true,
        }),
        false,
    );

    assert.equal(
        shouldDispatchApplicationEmails({
            enableOutboundEmails: true,
            autoSendEmails: false,
        }),
        false,
    );

    assert.equal(
        shouldDispatchApplicationEmails({
            enableOutboundEmails: false,
            autoSendEmails: false,
        }),
        false,
    );
});

test("general outbound emails require the master switch", () => {
    assert.equal(
        shouldSendOutboundEmails({
            enableOutboundEmails: true,
        }),
        true,
    );

    assert.equal(
        shouldSendOutboundEmails({
            enableOutboundEmails: false,
        }),
        false,
    );

    assert.equal(
        shouldSendOutboundEmails({}),
        false,
    );
});
