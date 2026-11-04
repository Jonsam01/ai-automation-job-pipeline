
import test from "node:test";
import assert from "node:assert/strict";

import { sendApplication } from "../lib/autoApply.js";

import {
    sendDailyDigest,
    sendFollowUpReminder,
    escapeHtml,
    safeHttpUrl,
} from "../lib/mailer.js";

// Temporarily configure environment variables for isolated tests.
async function withEnvironment(overrides, callback) {
    const previous = {};

    for (const key of Object.keys(overrides)) {
        previous[key] = Object.hasOwn(process.env, key)
            ? process.env[key]
            : undefined;

        if (overrides[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = String(overrides[key]);
        }
    }

    try {
        return await callback();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test("application sender blocks sending when the master switch is disabled", async () => {
    await withEnvironment(
        {
            ENABLE_OUTBOUND_EMAILS: "false",
            AUTO_SEND_EMAILS: "true",
        },
        async () => {
            const result = await sendApplication(
                {
                    title: "AI Automation Engineer",
                    company: "Example Company",
                    resumeFile: "ai_automation_engineer.pdf",
                },
                "jobs@example.com",
            );

            assert.equal(result, false);
        },
    );
});

test("application sender blocks sending when automatic application is disabled", async () => {
    await withEnvironment(
        {
            ENABLE_OUTBOUND_EMAILS: "true",
            AUTO_SEND_EMAILS: "false",
        },
        async () => {
            const result = await sendApplication(
                {
                    title: "AI Automation Engineer",
                    company: "Example Company",
                    resumeFile: "ai_automation_engineer.pdf",
                },
                "jobs@example.com",
            );

            assert.equal(result, false);
        },
    );
});

test("daily digest is blocked when outbound emails are disabled", async () => {
    await withEnvironment(
        {
            ENABLE_OUTBOUND_EMAILS: "false",
        },
        async () => {
            const result = await sendDailyDigest({
                needsApproval: [],
                needsManualApply: [],
                autoAppliedToday: [],
            });

            assert.equal(result, false);
        },
    );
});

test("follow-up reminders are blocked when outbound emails are disabled", async () => {
    await withEnvironment(
        {
            ENABLE_OUTBOUND_EMAILS: "false",
        },
        async () => {
            const result = await sendFollowUpReminder([
                {
                    Company: "Example Company",
                    "Role Title": "AI Automation Engineer",
                    "Country/Remote": "Nigeria",
                },
            ]);

            assert.equal(result, false);
        },
    );
});

test("HTML escaping protects dynamic email content", () => {
    const result = escapeHtml(
        `<script>alert("test")</script> & 'quoted'`,
    );

    assert.equal(
        result,
        "&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;",
    );
});

test("email links reject unsafe protocols", () => {
    assert.equal(
        safeHttpUrl("javascript:alert(1)"),
        null,
    );

    assert.equal(
        safeHttpUrl("data:text/html,test"),
        null,
    );

    assert.equal(
        safeHttpUrl("https://example.com/jobs/123"),
        "https://example.com/jobs/123",
    );
});
