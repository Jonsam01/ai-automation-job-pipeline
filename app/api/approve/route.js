
import { NextResponse } from "next/server";

import {
  getAllJobs,
  updateStatus,
  setFollowUpDate,
  STATUS,
} from "../../../lib/sheets.js";

import { sendApplication } from "../../../lib/autoApply.js";
import { loadJson } from "../../../lib/loadJson.js";

import {
  getExistingRowReviewReasons,
} from "../../../lib/pipelineRules.js";

import {
  isSameOriginRequest,
} from "../../../lib/requestSecurity.js";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_STATUSES = new Set(Object.values(STATUS));

const FOLLOW_UP_STATUSES = new Set([
  STATUS.APPLIED,
  STATUS.APPLIED_AUTO,
]);

const APPLICATION_IN_PROGRESS = "Application In Progress";

const RESUME_FILENAME_BY_LABEL = {
  ai_automation: "ai_automation_engineer.pdf",
};

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

// Prevent overlapping approval requests within the same Node.js process.
// The persisted intermediate status blocks subsequent sequential requests.
const activeApplicationRows = new Set();

const countriesConfig = loadJson(
  import.meta.url,
  "../../../config/countries.json",
);

const CANDIDATE_COUNTRY = String(
  countriesConfig.candidate_location_country || "Nigeria",
).trim().toLowerCase();

// --------------------------------------------------
// EMAIL SAFETY
// --------------------------------------------------

function applicationEmailSendingEnabled() {
  return (
    process.env.ENABLE_OUTBOUND_EMAILS === "true" &&
    process.env.AUTO_SEND_EMAILS === "true"
  );
}

// --------------------------------------------------
// RESPONSE HELPERS
// --------------------------------------------------

function errorResponse(message, status = 400, extra = {}) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function successResponse(payload, status = 200) {
  return NextResponse.json(
    payload,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

// --------------------------------------------------
// APPROVAL HANDLER
// --------------------------------------------------

export async function POST(request) {
  let claimedRowNumber = null;

  try {
    // Reject cross-origin requests before processing the request body.
    if (!isSameOriginRequest(request)) {
      return errorResponse(
        "Forbidden request origin.",
        403,
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Request body must contain valid JSON.",
        400,
      );
    }

    const { row, status } = body || {};

    if (
      row === undefined ||
      row === null ||
      status === undefined
    ) {
      return errorResponse(
        "row and status are required.",
        400,
      );
    }

    const rowNumber = Number(row);

    if (
      !Number.isInteger(rowNumber) ||
      rowNumber < 2
    ) {
      return errorResponse(
        "row must be a valid spreadsheet data row.",
        400,
      );
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return errorResponse(
        `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}`,
        400,
      );
    }

    // --------------------------------------------------
    // APPROVAL REQUIRES AN AWAITING-APPROVAL ROW
    // --------------------------------------------------

    if (status === STATUS.APPROVED) {
      const allJobs = await getAllJobs();

      const job = allJobs.find(
        (item) => Number(item._row) === rowNumber,
      );

      if (!job) {
        return errorResponse(
          "Job row was not found.",
          404,
        );
      }

      // Prevent re-approving jobs already applied to, rejected,
      // in progress, or otherwise moved out of the approval queue.
      if (job.Status !== STATUS.AWAITING_APPROVAL) {
        return errorResponse(
          "This job is no longer awaiting approval. Its status has not been changed.",
          409,
          {
            currentStatus: job.Status || "Unknown",
          },
        );
      }

      // Recheck stored eligibility fields before approval.
      const reviewReasons = getExistingRowReviewReasons(
        job,
        CANDIDATE_COUNTRY,
      );

      if (reviewReasons.length > 0) {
        return errorResponse(
          "This job cannot be approved until its eligibility reviews are resolved.",
          409,
          {
            reviewRequired: true,
            reviewReasons,
          },
        );
      }

      const method = String(
        job["Submission Method"] || "",
      )
        .trim()
        .toLowerCase();

      const emailMatch = String(
        job.Notes || "",
      ).match(EMAIL_RE);

      // --------------------------------------------------
      // EMAIL APPLICATION
      // --------------------------------------------------

      if (method === "email" && emailMatch) {
        // Both switches must be explicitly enabled.
        if (!applicationEmailSendingEnabled()) {
          return errorResponse(
            "Application email sending is disabled. The job status has not been changed.",
            409,
            {
              emailSendingDisabled: true,
            },
          );
        }

        // Prevent overlapping requests in this process.
        if (activeApplicationRows.has(rowNumber)) {
          return errorResponse(
            "An application attempt is already being processed for this job.",
            409,
          );
        }

        activeApplicationRows.add(rowNumber);
        claimedRowNumber = rowNumber;

        // Persist an intermediate status before attempting SMTP.
        // This prevents ordinary sequential pipeline retries.
        await updateStatus(
          rowNumber,
          APPLICATION_IN_PROGRESS,
        );

        const cvKey = String(
          job["CV Version Used"] || "ai_automation",
        );

        const resumeFile =
          RESUME_FILENAME_BY_LABEL[cvKey] ||
          RESUME_FILENAME_BY_LABEL.ai_automation;

        let sent = false;

        try {
          sent = await sendApplication(
            {
              title: job["Role Title"] || "",
              company: job.Company || "",
              resumeFile,
            },
            emailMatch[0],
          );
        } catch (sendError) {
          console.error(
            "[approve] Application email attempt failed:",
            sendError instanceof Error
              ? sendError.message
              : String(sendError),
          );

          // A failed or uncertain send must not remain Approved.
          await updateStatus(
            rowNumber,
            STATUS.NEEDS_MANUAL,
          );

          return successResponse({
            success: true,
            sent: false,
            status: STATUS.NEEDS_MANUAL,
            message:
              "The email attempt encountered an error. The job has been moved to manual review. Check your email logs before attempting another submission.",
          });
        }

        if (sent) {
          await updateStatus(
            rowNumber,
            STATUS.APPLIED_AUTO,
          );

          await setFollowUpDate(
            rowNumber,
            7,
          );

          return successResponse({
            success: true,
            sent: true,
            status: STATUS.APPLIED_AUTO,
          });
        }

        // Failed sends require human investigation.
        await updateStatus(
          rowNumber,
          STATUS.NEEDS_MANUAL,
        );

        return successResponse({
          success: true,
          sent: false,
          status: STATUS.NEEDS_MANUAL,
          message:
            "The application email was not sent successfully. The job has been moved to manual review.",
        });
      }

      // --------------------------------------------------
      // MANUAL APPLICATION
      // --------------------------------------------------

      await updateStatus(
        rowNumber,
        STATUS.NEEDS_MANUAL,
      );

      return successResponse({
        success: true,
        sent: false,
        status: STATUS.NEEDS_MANUAL,
        message:
          "This job requires manual application through the employer's application page.",
      });
    }

    // --------------------------------------------------
    // ORDINARY STATUS CHANGES
    // --------------------------------------------------

    await updateStatus(
      rowNumber,
      status,
    );

    if (FOLLOW_UP_STATUSES.has(status)) {
      await setFollowUpDate(
        rowNumber,
        7,
      );
    }

    return successResponse({
      success: true,
      status,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "[approve] Failed to update application:",
      message,
    );

    return errorResponse(
      "Could not update the application status. Check the job row before attempting another application.",
      500,
    );
  } finally {
    if (claimedRowNumber !== null) {
      activeApplicationRows.delete(claimedRowNumber);
    }
  }
}
