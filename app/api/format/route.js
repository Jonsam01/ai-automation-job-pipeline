
import { NextResponse } from "next/server";

import { formatSheet } from "../../../lib/sheets.js";
import { isSameOriginRequest } from "../../../lib/requestSecurity.js";

export async function POST(request) {
  if (process.env.ALLOW_FORMAT !== "true") {
    return NextResponse.json(
      {
        success: false,
        error: "Sheet formatting is disabled.",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
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
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    await formatSheet();

    return NextResponse.json(
      { success: true },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[format] Failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not format the spreadsheet.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
