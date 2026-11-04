
import test from "node:test";
import assert from "node:assert/strict";

import { deduplicate } from "../lib/filters.js";

function makeJob(overrides = {}) {
    return {
        title: "AI Automation Engineer",
        company: "Example Company",
        location: "Nigeria",
        employmentType: "Full Time",
        link: "https://example.com/jobs/123",
        source: "himalayas",
        description: "Build automation systems.",
        ...overrides,
    };
}

test("removes duplicate URLs with different tracking parameters", () => {
    const jobs = [
        makeJob({
            link: "https://example.com/jobs/123?utm_source=himalayas",
            source: "himalayas",
        }),
        makeJob({
            link: "https://example.com/jobs/123?utm_source=ashby",
            source: "ashby",
        }),
    ];

    const result = deduplicate(jobs);

    assert.equal(result.length, 1);
    assert.equal(result[0].source, "himalayas");
});

test("removes the Vilambo-style duplicate across different URLs", () => {
    const jobs = [
        makeJob({
            title: "AI-Automation Engineer Intern",
            company: "Vilambo Private Limited",
            location: "India",
            employmentType: "Intern",
            link: "https://himalayas.app/jobs/vilambo-3441651097",
            source: "himalayas",
        }),
        makeJob({
            title: "AI Automation Engineer Intern",
            company: "Vilambo Pvt. Ltd.",
            location: "India",
            employmentType: "Internship",
            link: "https://himalayas.app/jobs/vilambo",
            source: "himalayas",
        }),
    ];

    const result = deduplicate(jobs);

    assert.equal(result.length, 1);
});

test("does not merge the same role when locations differ", () => {
    const jobs = [
        makeJob({
            company: "Example Company",
            title: "Automation Engineer",
            location: "Nigeria",
            link: "https://example.com/jobs/nigeria",
        }),
        makeJob({
            company: "Example Company",
            title: "Automation Engineer",
            location: "South Africa",
            link: "https://example.com/jobs/south-africa",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("does not merge the same role when employment types differ", () => {
    const jobs = [
        makeJob({
            title: "Automation Engineer",
            company: "Example Company",
            location: "Nigeria",
            employmentType: "Full Time",
            link: "https://example.com/jobs/full-time",
        }),
        makeJob({
            title: "Automation Engineer",
            company: "Example Company",
            location: "Nigeria",
            employmentType: "Contract",
            link: "https://example.com/jobs/contract",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("does not merge different companies", () => {
    const jobs = [
        makeJob({
            company: "Company Alpha",
            link: "https://example.com/jobs/alpha",
        }),
        makeJob({
            company: "Company Beta",
            link: "https://example.com/jobs/beta",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("does not merge different job titles", () => {
    const jobs = [
        makeJob({
            title: "Automation Engineer",
            link: "https://example.com/jobs/engineer",
        }),
        makeJob({
            title: "Automation Analyst",
            link: "https://example.com/jobs/analyst",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("does not identity-deduplicate records with missing identity fields", () => {
    const jobs = [
        makeJob({
            company: "",
            link: "https://example.com/jobs/one",
        }),
        makeJob({
            company: "",
            link: "https://example.com/jobs/two",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("checks existing stored URLs after removing tracking parameters", () => {
    const existingLinks = new Set([
        "https://example.com/jobs/123?utm_source=old-source",
    ]);

    const jobs = [
        makeJob({
            link: "https://example.com/jobs/123?utm_source=new-source",
        }),
    ];

    assert.equal(deduplicate(jobs, existingLinks).length, 0);
});

test("keeps jobs separate when one employment type is unspecified and the other is explicit", () => {
    const jobs = [
        makeJob({
            title: "Automation Engineer",
            company: "Example Company",
            location: "Nigeria",
            employmentType: "Full Time",
            link: "https://example.com/jobs/full-time",
        }),
        makeJob({
            title: "Automation Engineer",
            company: "Example Company",
            location: "Nigeria",
            employmentType: "",
            link: "https://example.com/jobs/unspecified",
        }),
    ];

    assert.equal(deduplicate(jobs).length, 2);
});

test("does not return jobs without an application link", () => {
    const jobs = [
        makeJob({ link: "" }),
        makeJob({
            link: "https://example.com/jobs/valid",
        }),
    ];

    const result = deduplicate(jobs);

    assert.equal(result.length, 1);
    assert.equal(
        result[0].link,
        "https://example.com/jobs/valid",
    );
});
