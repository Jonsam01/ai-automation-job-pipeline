import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    const file = path.join(
      process.cwd(),
      "config",
      "applyKit.json",
    );

    const kit = JSON.parse(
      fs.readFileSync(file, "utf-8"),
    );

    return NextResponse.json(
      { success: true, kit },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[kit] Failed to load application kit:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not load the application kit.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}