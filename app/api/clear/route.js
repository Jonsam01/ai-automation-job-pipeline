import { NextResponse } from "next/server";

import { clearAllJobs } from "../../../lib/sheets.js";
import {
  isSameOriginRequest,
} from "../../../lib/requestSecurity.js";

export const runtime = "nodejs";

export async function POST(request) {
  if (process.env.ALLOW_CLEAR !== "true") {
    return NextResponse.json(
      {
        success: false,
        error: "Clearing is disabled.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden request origin.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    await clearAllJobs();

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[clear] Failed to clear spreadsheet:",
      error instanceof Error ? error.message : String(error),
    );

    return NextResponse.json(
      {
        success: false,
        error: "Could not clear job records.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}