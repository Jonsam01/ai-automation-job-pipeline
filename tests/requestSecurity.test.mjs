
import test from "node:test";
import assert from "node:assert/strict";

import {
    isSameOriginRequest,
} from "../lib/requestSecurity.js";

function makeRequest(
    origin,
    url = "http://localhost:3000/api/approve",
) {
    return {
        url,
        headers: {
            get(name) {
                if (name.toLowerCase() === "origin") {
                    return origin;
                }

                return null;
            },
        },
    };
}

test("allows requests from the exact same origin", () => {
    assert.equal(
        isSameOriginRequest(
            makeRequest("http://localhost:3000"),
        ),
        true,
    );
});

test("rejects requests from a different origin", () => {
    assert.equal(
        isSameOriginRequest(
            makeRequest("http://evil.example"),
        ),
        false,
    );
});

test("rejects requests without an Origin header", () => {
    assert.equal(
        isSameOriginRequest(makeRequest(null)),
        false,
    );
});

test("rejects malformed Origin headers", () => {
    assert.equal(
        isSameOriginRequest(
            makeRequest("not-a-valid-origin"),
        ),
        false,
    );
});
