
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Only explicitly approved CV filenames can be downloaded.
const FILES = {
  ai_automation: "ai_automation_engineer.pdf",
};

export async function GET(request) {
  try {
    const url = new URL(request.url);

    const cv = url.searchParams.get("cv") || "ai_automation";
    const fileName = FILES[cv];

    if (!fileName) {
      return NextResponse.json(
        { error: "Unknown CV." },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const resumesDirectory = path.join(
      process.cwd(),
      "resumes",
    );

    const filePath = path.join(
      resumesDirectory,
      fileName,
    );

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Resume file not found." },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const fileInfo = fs.lstatSync(filePath);

    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
      return NextResponse.json(
        { error: "Invalid resume file." },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const data = fs.readFileSync(filePath);

    if (
      data.length < 5 ||
      data.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "Resume file is not a valid PDF." },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[resume] Failed to serve CV:", error);

    return NextResponse.json(
      { error: "Could not serve resume." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
