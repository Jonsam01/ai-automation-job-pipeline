
import { fetchAllJobs } from "./fetchers/index.js";
import { filterJobs, deduplicate } from "./filters.js";
import { scoreAll } from "./scorer.js";
import { findApplyEmail } from "./emailApply.js";
import { loadJson } from "./loadJson.js";

import {
  addJobs,
  getExistingLinks,
  getJobsByStatus,
  updateStatus,
  setFollowUpDate,
  getDueFollowUps,
  STATUS,
} from "./sheets.js";

import {
  sendDailyDigest,
  sendFollowUpReminder,
} from "./mailer.js";

import { sendApplication } from "./autoApply.js";

import {
  getNewJobReviewReasons,
  getExistingRowReviewReasons,
  canAutomaticallyApproveNewJob,
  shouldDispatchApplicationEmails,
  shouldSendOutboundEmails,
} from "./pipelineRules.js";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const MAX_NEW_ROWS_PER_RUN = 50;

const RESUME_FILENAME_BY_LABEL = {
  ai_automation: "ai_automation_engineer.pdf",
};

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

// Load the same candidate-country configuration used by filters.js.
const countriesConfig = loadJson(
  import.meta.url,
  "../config/countries.json",
);

const CANDIDATE_COUNTRY = String(
  countriesConfig.candidate_location_country || "Nigeria",
).trim().toLowerCase();

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

function getPipelineConfig() {
  const minimumScore = Number(
    process.env.MINIMUM_MATCH_SCORE || 55,
  );

  const autoApproveMin = Number(
    process.env.AUTO_APPROVE_MIN_SCORE || 80,
  );

  // Master email switch.
  // Defaults to false: no application or notification emails.
  const enableOutboundEmails =
    process.env.ENABLE_OUTBOUND_EMAILS === "true";

  // Controls automatic application email approval and dispatch.
  const autoSendEmails =
    process.env.AUTO_SEND_EMAILS === "true";

  const configuredMaxEmails = Number(
    process.env.MAX_EMAILS_PER_RUN || 10,
  );

  const maxEmails = Number.isFinite(configuredMaxEmails)
    ? Math.max(0, Math.floor(configuredMaxEmails))
    : 0;

  if (
    !Number.isFinite(minimumScore) ||
    !Number.isFinite(autoApproveMin)
  ) {
    throw new Error(
      "MINIMUM_MATCH_SCORE and AUTO_APPROVE_MIN_SCORE must be valid numbers.",
    );
  }

  return {
    minimumScore,
    autoApproveMin,
    enableOutboundEmails,
    autoSendEmails,
    maxEmails,
  };
}

// --------------------------------------------------
// MAIN PIPELINE
// --------------------------------------------------

export async function runPipeline() {
  const log = [];

  const pushLog = (message) => {
    console.log(message);
    log.push(message);
  };

  try {
    const {
      minimumScore,
      autoApproveMin,
      enableOutboundEmails,
      autoSendEmails,
      maxEmails,
    } = getPipelineConfig();

    pushLog("=== Job discovery pipeline started ===");

    pushLog(
      `Candidate country: ${CANDIDATE_COUNTRY}`,
    );

    pushLog(
      `Outbound emails enabled: ${enableOutboundEmails}`,
    );

    pushLog(
      `Automatic application emails enabled: ${autoSendEmails}`,
    );

    // --------------------------------------------------
    // STEP 1: FETCH, FILTER AND DEDUPLICATE
    // --------------------------------------------------

    pushLog("=== Fetching jobs from all sources ===");

    const rawJobs = await fetchAllJobs();

    pushLog(
      `Total raw jobs found: ${rawJobs.length}`,
    );

    const eligibleJobs = filterJobs(rawJobs);

    pushLog(
      `After country and location eligibility filter: ${eligibleJobs.length}`,
    );

    const existingLinks = await getExistingLinks();

    const newJobs = deduplicate(
      eligibleJobs,
      existingLinks,
    );

    pushLog(
      `After removing duplicates already in sheet: ${newJobs.length}`,
    );

    // --------------------------------------------------
    // STEP 2: SCORE NEW JOBS
    // --------------------------------------------------

    const scoredJobs = scoreAll(
      newJobs,
      minimumScore,
    );

    pushLog(
      `After minimum match score (${minimumScore}): ${scoredJobs.length}`,
    );

    // --------------------------------------------------
    // STEP 3: PREPARE NEW SHEET ROWS
    // --------------------------------------------------

    const toAdd = [...scoredJobs]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, MAX_NEW_ROWS_PER_RUN);

    let emailJobs = 0;
    let automaticallyApproved = 0;
    let awaitingApproval = 0;
    let manualApplications = 0;

    const newNeedsManualApply = [];

    const rowsToAdd = toAdd.map((job) => {
      const applyEmail = findApplyEmail(
        job.description,
      );

      if (applyEmail) {
        emailJobs++;
      }

      // Review reasons are stored for diagnostics and notes.
      const reviewReasons = getNewJobReviewReasons(
        job,
        CANDIDATE_COUNTRY,
      );

      const strong =
        Number(job.matchScore) >= autoApproveMin &&
        !job.needsManualReview;

      // The shared rule function is the authority for automatic approval.
      const canAutoApprove =
        canAutomaticallyApproveNewJob(
          job,
          {
            candidateCountry: CANDIDATE_COUNTRY,
            autoApproveMinScore: autoApproveMin,
            hasApplicationEmail: Boolean(applyEmail),
            enableOutboundEmails,
            autoSendEmails,
          },
        );

      let status = STATUS.AWAITING_APPROVAL;

      if (canAutoApprove) {
        status = STATUS.APPROVED;
        automaticallyApproved++;
      } else if (
        strong &&
        reviewReasons.length === 0 &&
        !applyEmail
      ) {
        // No application email: user must apply manually.
        status = STATUS.NEEDS_MANUAL;
        manualApplications++;
      } else {
        awaitingApproval++;
      }

      if (status === STATUS.NEEDS_MANUAL) {
        newNeedsManualApply.push(job);
      }

      // --------------------------------------------------
      // BUILD NOTES
      // --------------------------------------------------

      const notes = [];

      if (status === STATUS.APPROVED) {
        notes.push(
          `Automatically approved (score ${job.matchScore})`,
        );
      } else if (status === STATUS.NEEDS_MANUAL) {
        notes.push(
          "Strong match; manual application required because no application email was detected",
        );
      } else if (strong && reviewReasons.length > 0) {
        notes.push(
          `Strong match held for review (score ${job.matchScore})`,
        );
      }

      if (job.needsManualReview) {
        notes.push("Flagged for CV selection review");
      }

      if (job.locationReviewRequired) {
        notes.push("Location eligibility review required");
      }

      if (job.locationRestricted) {
        notes.push("Location is explicitly restricted");
      }

      if (job.workAuthorizationReviewRequired) {
        notes.push("Work authorisation review required");
      }

      if (job.eligibilityReason) {
        notes.push(
          `Eligibility: ${job.eligibilityReason}`,
        );
      }

      if (applyEmail) {
        notes.push(`Apply by email: ${applyEmail}`);
      }

      if (reviewReasons.length > 0) {
        notes.push(
          `Approval blockers: ${reviewReasons.join("; ")}`,
        );
      }

      // --------------------------------------------------
      // GOOGLE SHEETS ROW
      // --------------------------------------------------

      return {
        company: job.company || "",
        roleTitle: job.title || "",
        employmentType: job.employmentType || "Not specified",
        countryRemote: job.location || "",
        estSalary: "Not listed",
        matchScore: job.matchScore,
        cvVersion: job.cvVersion,
        link: job.link || "",
        submissionMethod: applyEmail
          ? "Email"
          : "Unknown (check posting)",
        status,
        notes: notes.join(". "),

        // Structured eligibility fields.
        candidateCountry: job.candidateCountry || "",
        locationEligibilityStatus:
          job.locationEligibilityStatus || "",
        eligibilityReason: job.eligibilityReason || "",
        locationRestricted: job.locationRestricted,
        locationReviewRequired:
          job.locationReviewRequired,
        workAuthorizationReviewRequired:
          job.workAuthorizationReviewRequired,

        // Missing CV review information is not considered cleared.
        cvSelectionReviewRequired:
          typeof job.cvSelectionReviewRequired === "boolean"
            ? job.cvSelectionReviewRequired
            : typeof job.needsManualReview === "boolean"
              ? job.needsManualReview
              : true,
      };
    });

    await addJobs(rowsToAdd);

    pushLog(
      `Added ${rowsToAdd.length} new rows. ` +
      `Automatically approved: ${automaticallyApproved}; ` +
      `awaiting approval: ${awaitingApproval}; ` +
      `manual applications: ${manualApplications}; ` +
      `with application email: ${emailJobs}.`,
    );

    // --------------------------------------------------
    // STEP 4: PROCESS EXISTING APPROVED APPLICATIONS
    // --------------------------------------------------

    const approved = await getJobsByStatus(
      STATUS.APPROVED,
    );

    const autoAppliedToday = [];
    const needsManualApply = [];

    let emailsSent = 0;
    let emailAttempts = 0;
    let approvedRowsHeldForReview = 0;

    const applicationDispatchEnabled =
      shouldDispatchApplicationEmails({
        enableOutboundEmails,
        autoSendEmails,
      });

    if (!applicationDispatchEnabled) {
      pushLog(
        "Application email dispatch skipped. " +
        `ENABLE_OUTBOUND_EMAILS=${enableOutboundEmails}; ` +
        `AUTO_SEND_EMAILS=${autoSendEmails}.`,
      );
    } else {
      for (const row of approved) {
        // Recheck eligibility immediately before application.
        const reviewReasons =
          getExistingRowReviewReasons(
            row,
            CANDIDATE_COUNTRY,
          );

        if (reviewReasons.length > 0) {
          approvedRowsHeldForReview++;

          await updateStatus(
            row._row,
            STATUS.AWAITING_APPROVAL,
          );

          pushLog(
            `Held approved row ${row._row} ` +
            `(${row.Company || "Unknown company"}): ` +
            reviewReasons.join("; "),
          );

          continue;
        }

        const method = String(
          row["Submission Method"] || "",
        )
          .trim()
          .toLowerCase();

        const emailMatch = String(
          row.Notes || "",
        ).match(EMAIL_RE);

        if (method === "email" && emailMatch) {
          // Limit the number of attempts, not just successful sends.
          if (emailAttempts >= maxEmails) {
            continue;
          }

          emailAttempts++;

          const resumeFile =
            RESUME_FILENAME_BY_LABEL[
            row["CV Version Used"]
            ] ||
            RESUME_FILENAME_BY_LABEL.ai_automation;

          const success = await sendApplication(
            {
              title: row["Role Title"] || "",
              company: row.Company || "",
              resumeFile,
            },
            emailMatch[0],
          );

          if (success) {
            emailsSent++;

            await updateStatus(
              row._row,
              STATUS.APPLIED_AUTO,
            );

            await setFollowUpDate(
              row._row,
              7,
            );

            autoAppliedToday.push(row);
            continue;
          }

          // Failed sends require human investigation.
          // Do not leave the row Approved for an automatic retry.
          await updateStatus(
            row._row,
            STATUS.NEEDS_MANUAL,
          );

          needsManualApply.push(row);

          pushLog(
            `Application email failed for row ${row._row} ` +
            `(${row.Company || "Unknown company"}). ` +
            "Moved to manual review.",
          );

          continue;
        }

        // Unsupported application method.
        await updateStatus(
          row._row,
          STATUS.NEEDS_MANUAL,
        );

        needsManualApply.push(row);
      }
    }

    pushLog(
      `Application email attempts: ${emailAttempts}; ` +
      `emails sent: ${emailsSent}; ` +
      `approved rows held for review: ${approvedRowsHeldForReview}; ` +
      `needs manual application: ${needsManualApply.length}.`,
    );

    // --------------------------------------------------
    // STEP 5: FOLLOW-UP REMINDERS
    // --------------------------------------------------

    const outboundEmailsEnabled =
      shouldSendOutboundEmails({
        enableOutboundEmails,
      });

    if (outboundEmailsEnabled) {
      const dueFollowUps = await getDueFollowUps();

      if (dueFollowUps.length > 0) {
        const remindersSent =
          await sendFollowUpReminder(dueFollowUps);

        if (remindersSent) {
          // Only update the spreadsheet after successful delivery.
          for (const row of dueFollowUps) {
            await updateStatus(
              row._row,
              STATUS.FOLLOWUP_SENT,
            );
          }

          pushLog(
            `Follow-up reminders successfully sent: ${dueFollowUps.length}.`,
          );
        } else {
          // Preserve the original follow-up status and date.
          pushLog(
            "Follow-up email delivery failed. Job statuses were not changed.",
          );
        }
      } else {
        pushLog("No follow-up reminders are due.");
      }
    } else {
      pushLog(
        "Follow-up reminders skipped: outbound emails are disabled.",
      );
    }

    // --------------------------------------------------
    // STEP 6: DAILY DIGEST
    // --------------------------------------------------

    const stillAwaiting = await getJobsByStatus(
      STATUS.AWAITING_APPROVAL,
    );

    if (outboundEmailsEnabled) {
      const digestSent = await sendDailyDigest({
        needsApproval: stillAwaiting,
        needsManualApply: [
          ...newNeedsManualApply,
          ...needsManualApply,
        ],
        autoAppliedToday,
      });

      pushLog(
        digestSent
          ? "Daily digest successfully sent."
          : "Daily digest delivery failed.",
      );
    } else {
      pushLog(
        "Daily digest skipped: outbound emails are disabled.",
      );
    }

    // --------------------------------------------------
    // COMPLETION
    // --------------------------------------------------

    pushLog("=== Job discovery pipeline completed ===");

    return {
      success: true,
      log,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    pushLog(`ERROR: ${message}`);

    return {
      success: false,
      error: message,
      log,
    };
  }
}
