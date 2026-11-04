
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runPipeline } from "../../../lib/pipeline.js";

export const runtime = "nodejs";

function checkAuth(request) {
  const expectedSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("x-cron-secret");

  if (!expectedSecret || !suppliedSecret) {
    return false;
  }

  const expected = Buffer.from(expectedSecret, "utf8");
  const supplied = Buffer.from(suppliedSecret, "utf8");

  if (expected.length !== supplied.length) {
    return false;
  }

  return timingSafeEqual(expected, supplied);
}

export async function POST(request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET is not configured.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (!checkAuth(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized.",
      },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const result = await runPipeline();

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
    headers: { "Cache-Control": "no-store" },
  });
}
